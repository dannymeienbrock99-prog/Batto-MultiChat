"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {TwitchChatColor,COLOR_SCOPE}=require("../src/platforms/twitch/twitch-chat-color.cjs");
const {TwitchOAuth}=require("../src/platforms/twitch/twitch-oauth.cjs");
const {AppRuntime}=require("../src/runtime/app-runtime.cjs");
const colors=require("../src/shared/chat-appearance.js");
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});

function fixture({scopes=[COLOR_SCOPE],identity={},status=204,token="test-token",data}={}){
  const calls=[];
  const service=new TwitchChatColor({oauth:{accessToken:async()=>token},fetchImpl:async(url,options)=>{
    calls.push({url:new URL(url),options});
    if(url.includes("/validate"))return json({user_id:"123",client_id:"verified-client",login:"batto",scopes,...identity});
    if(options.method==="PUT")return status===204?new Response(null,{status}):json({message:"rejected"},status);
    return json(data||{data:[{user_id:"123",user_name:"Batto",color:"#ABCDEF"}]});
  }});
  return {service,calls};
}

test("preload color methods reach the actual runtime handlers",async()=>{
  const handlers=new Map(),{service,calls}=fixture();
  const runtime=new AppRuntime({ipcMain:{handle:(name,handler)=>handlers.set(name,handler)}});
  runtime.twitchChatColor=service;runtime.registerIpc();
  let api;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/preload.cjs"),"utf8"),{
    require:()=>({contextBridge:{exposeInMainWorld:(_key,value)=>{api=value;}},ipcRenderer:{invoke:(name,...args)=>handlers.get(name)({},...args)}})
  });
  assert.equal((await api.twitchChatColorGet()).userId,"123");
  assert.equal((await api.twitchChatColorSet("red")).color,"#ff0000");
  assert.equal(calls.filter(call=>call.options.method==="PUT").length,1);
  let authorized=false,cancelled=false;
  runtime.twitchChatColor.authorize=async()=>{authorized=true;};
  runtime.twitchOAuth={cancelAuthorization:()=>{cancelled=true;}};
  await api.twitchChatColorAuthorize();await api.twitchOAuthCancel();
  assert.equal(authorized,true);assert.equal(cancelled,true);
});

test("Twitch update uses the validated token identity, client ID, scope and named color",async()=>{
  const {service,calls}=fixture();
  assert.deepEqual(await service.set("hot_pink"),{userId:"123",username:"batto",color:"#ff69b4",canUpdate:true});
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.headers.Authorization,"OAuth test-token");
  assert.equal(calls[1].url.pathname,"/helix/chat/color");
  assert.equal(calls[1].url.searchParams.get("user_id"),"123");
  assert.equal(calls[1].url.searchParams.get("color"),"hot_pink");
  assert.equal(calls[1].options.method,"PUT");
  assert.deepEqual(calls[1].options.headers,{Authorization:"Bearer test-token","Client-Id":"verified-client"});
});

test("hex color is normalized and URL-encoded, with no token in returned state",async()=>{
  const {service,calls}=fixture();
  const value=await service.set("#aBc");
  assert.equal(value.color,"#aabbcc");
  assert.equal(calls[1].url.searchParams.get("color"),"#aabbcc");
  assert.match(calls[1].url.href,/color=%23aabbcc/);
  assert.doesNotMatch(JSON.stringify(value),/test-token|verified-client/);
});

test("invalid colors and renderer-supplied identities are rejected before a network request",async()=>{
  for(const input of ["red&user_id=999","#fff;position:fixed","__proto__",{color:"red",userId:"999"},null]){
    const {service,calls}=fixture();
    await assert.rejects(service.set(input),/gültigen Hex-Wert/);
    assert.equal(calls.length,0);
  }
});

test("missing sign-in, missing scope and invalid identity prevent any color PUT",async()=>{
  for(const options of [{token:""},{scopes:["chat:read"]},{identity:{user_id:null}},{identity:{client_id:""}}]){
    const {service,calls}=fixture(options);
    await assert.rejects(service.set("red"));
    assert.ok(calls.every(call=>call.options.method!=="PUT"));
  }
});

test("GET reads only the validated user's current color and reports permission separately",async()=>{
  const {service,calls}=fixture({scopes:["chat:read"]});
  assert.deepEqual(await service.get(),{userId:"123",username:"batto",displayName:"Batto",color:"#abcdef",canUpdate:false});
  assert.equal(calls[1].url.searchParams.get("user_id"),"123");
  const other=fixture({data:{data:[{user_id:"999",color:"#ffffff"}]}});
  await assert.rejects(other.service.get(),/eigene Chatfarbe/);
});

test("Twitch rejection never becomes a success, including Prime/Turbo and rate limits",async()=>{
  for(const [status,pattern] of [[400,/Prime oder Turbo/],[401,/erneut freigeben/],[403,/erneut freigeben/],[429,/kurz warten/],[500,/HTTP 500/],[200,/HTTP 200/]]){
    await assert.rejects(fixture({status}).service.set("#123456"),pattern);
  }
});

test("network failure returns an actionable error without leaking tokens",async()=>{
  const service=new TwitchChatColor({oauth:{accessToken:async()=>"private-token"},fetchImpl:async()=>{throw new Error("private-token failed");}});
  await assert.rejects(service.set("red"),error=>{
    assert.match(error.message,/nicht erreichbar/);assert.doesNotMatch(error.message,/private-token/);return true;
  });
});

test("color authorization adds its scope while retaining chat and existing permissions",async()=>{
  let requested;
  const service=new TwitchChatColor({oauth:{status:async()=>({scopes:["chat:read","user:read:email"]}),begin:async value=>{requested=value;return {connected:true};}}});
  await service.authorize();
  assert.deepEqual(new Set(requested.scopes),new Set(["chat:read","chat:edit","user:read:email",COLOR_SCOPE]));
});

function oauthFixture(){
  const values={twitchOAuth:{clientId:"client",scopes:["chat:read","chat:edit",COLOR_SCOPE]},accounts:{}};
  const tokens=new Map(),oauth=new TwitchOAuth({settingsStore:{get:async key=>values[key],set:async(key,value)=>{values[key]=value;}},secretStore:{get:async key=>tokens.get(key),set:async(key,value)=>tokens.set(key,value)},shell:{openExternal:async()=>{}}});
  return {oauth,values,tokens};
}

test("ordinary Twitch reauthorization preserves the chat-color permission and clears completed pending state",async t=>{
  const {oauth}=oauthFixture();let requested;
  t.mock.method(globalThis,"fetch",async(_url,options)=>{
    requested=options.body.get("scopes");return json({device_code:"device",user_code:"ABCD",verification_uri:"https://www.twitch.tv/activate",expires_in:300});
  });
  oauth.pollDeviceToken=async()=>({connected:true});
  await oauth.begin();
  assert.ok(requested.split(" ").includes(COLOR_SCOPE));
  assert.equal(oauth.pending,null);assert.equal(oauth.authorization,null);
});

test("canceling device authorization stops polling and duplicate login requests are rejected",async t=>{
  const {oauth,tokens}=oauthFixture();let started;
  const deviceOpened=new Promise(resolve=>{started=resolve;});
  t.mock.method(globalThis,"fetch",async()=>json({device_code:"device",user_code:"ABCD",verification_uri:"https://www.twitch.tv/activate",expires_in:300}));
  oauth.shell.openExternal=async()=>started();
  const pending=oauth.begin(),rejected=assert.rejects(pending,/abgebrochen/);
  await deviceOpened;
  await assert.rejects(oauth.begin(),/läuft bereits/);
  oauth.cancelAuthorization();await rejected;
  assert.equal(oauth.pending,null);assert.equal(oauth.authorization,null);assert.equal(tokens.size,0);
});

function editorFixture({color="#9146ff",canUpdate=true,setError=""}={}){
  const elements=new Map(),calls=[],window={BattoChatAppearance:colors};
  const context={window,document:{getElementById:id=>elements.get(id)||null},setInterval:()=>1,clearInterval(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/renderer/twitch-color-controls.js"),"utf8"),context);
  const api={
    twitchOAuthStatus:async()=>({connected:true}),
    twitchChatColorGet:async()=>({userId:"123",username:"batto",displayName:"Batto",color,canUpdate}),
    twitchChatColorSet:async value=>{calls.push(value);if(setError)throw new Error(setError);return {username:"batto",color:colors.hex(value)||colors.twitchColors[value][1],canUpdate:true};},
    twitchChatColorAuthorize:async()=>{calls.push("authorize");},twitchOAuthCancel:async()=>{calls.push("cancel");}
  };
  const editor=window.createBattoTwitchColorEditor({api,localColor:()=>"#ff0000"});
  for(const match of editor.markup().matchAll(/\bid="([^"]+)"/g))elements.set(match[1],{
    value:"",textContent:"",style:{},disabled:false,hidden:false,validity:"",
    setCustomValidity(value){this.validity=value;},reportValidity(){return !this.validity;}
  });
  editor.bind();
  return {get:id=>elements.get(id),calls,editor};
}

test("editor loads current color, copies local color without a write, and saves only on explicit submit",async()=>{
  const {get,calls}=editorFixture();
  await get("twitch-color-load").onclick();
  assert.equal(get("twitch-color-hex").value,"#9146ff");
  get("twitch-color-copy").onclick();
  assert.equal(get("twitch-color-choice").value,"red");assert.deepEqual(calls,[]);
  await get("twitch-color-form").onsubmit({preventDefault(){}});
  assert.deepEqual(calls,["red"]);assert.match(get("twitch-color-status").textContent,/Bei Twitch gespeichert für batto/);
});

test("editor keeps apply disabled without scope and displays failed API writes honestly",async()=>{
  const missing=editorFixture({canUpdate:false});await missing.get("twitch-color-load").onclick();
  assert.equal(missing.get("twitch-color-apply").disabled,true);
  await missing.get("twitch-color-form").onsubmit({preventDefault(){}});assert.deepEqual(missing.calls,[]);
  const denied=editorFixture({setError:"Prime oder Turbo erforderlich"});await denied.get("twitch-color-load").onclick();
  await denied.get("twitch-color-form").onsubmit({preventDefault(){}});
  assert.match(denied.get("twitch-color-status").textContent,/Prime oder Turbo erforderlich/);
  assert.doesNotMatch(denied.get("twitch-color-status").textContent,/gespeichert/);
  assert.equal(denied.get("twitch-color-fields").disabled,false);
});

test("switching from an invalid custom hex to a named color clears hidden input validation",async()=>{
  const {get,calls}=editorFixture();await get("twitch-color-load").onclick();
  const input=get("twitch-color-hex");input.value="invalid";input.oninput({target:input});
  await get("twitch-color-form").onsubmit({preventDefault(){}});assert.deepEqual(calls,[]);assert.ok(input.validity);
  const select=get("twitch-color-choice");select.value="blue";select.onchange({target:select});
  assert.equal(input.validity,"");assert.equal(input.disabled,true);
  await get("twitch-color-form").onsubmit({preventDefault(){}});assert.deepEqual(calls,["blue"]);
});
