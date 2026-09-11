"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {sendChat,eulerApiKeyRequest}=require("../src/runtime/release-hardening.cjs");
const {TwitchAdapter}=require("../src/platforms/twitch/twitch-adapter.cjs");
const {YouTubeAdapter}=require("../src/platforms/youtube/youtube-adapter.cjs");
const {EulerClient}=require("../src/platforms/tiktok/euler-client.cjs");

test("Unified chat send routes Twitch and YouTube to adapters",async()=>{
  const calls=[];const adapters=new Map([
    ["twitch",{send:async m=>{calls.push(["twitch",m]);return{ok:true}}}],
    ["youtube",{send:async m=>{calls.push(["youtube",m]);return{ok:true}}}]
  ]);
  const runtime={platforms:{adapters},context:{roomId:""}};
  await sendChat(runtime,"twitch","Hallo Twitch");await sendChat(runtime,"youtube","Hallo YouTube");
  assert.deepEqual(calls,[["twitch","Hallo Twitch"],["youtube","Hallo YouTube"]]);
});

test("Unified chat send refuses CNG because only browser sources are available",async()=>{
  await assert.rejects(()=>sendChat({platforms:{adapters:new Map()}},"cng","Hallo"),/Browserquellen|Browserquellen bereit/);
});

test("Euler account helper always uses saved API-key auth mode",async()=>{
  const calls=[];const runtime={euler:{request:async(path,opts)=>{calls.push([path,opts]);return{code:200}}}};
  await eulerApiKeyRequest(runtime,"/accounts/me");
  assert.equal(calls[0][0],"/accounts/me");assert.equal(calls[0][1].oauth,false);assert.equal(calls[0][1].requireApiKey,true);
});

test("Twitch send writes PRIVMSG only on an open connection",async()=>{
  const adapter=new TwitchAdapter();const sent=[];adapter.connected=true;adapter.config={channel:"batto",token:"x",username:"batto"};adapter.ws={readyState:1,send:(value,cb)=>{sent.push(value);cb?.()}};
  await adapter.send("Hallo Chat");assert.equal(sent[0],"PRIVMSG #batto :Hallo Chat");
});

test("YouTube send uses liveChatMessages insert shape",async()=>{
  const adapter=new YouTubeAdapter({oauth:{accessToken:async()=>"token"}});adapter.liveChatId="chat-1";
  const original=global.fetch;let request;
  global.fetch=async(url,opts)=>{request={url:String(url),opts};return{ok:true,json:async()=>({id:"msg-1"})}};
  try{const result=await adapter.send("Hallo YouTube");assert.equal(result.id,"msg-1");assert.match(request.url,/liveChat\/messages/);const body=JSON.parse(request.opts.body);assert.equal(body.snippet.liveChatId,"chat-1");assert.equal(body.snippet.textMessageDetails.messageText,"Hallo YouTube");}finally{global.fetch=original}
});

test("TikTok sends content and the current reader room in the documented JSON body",async t=>{
  let request;const euler=new EulerClient({oauth:{accessToken:async()=>"test-token"}});
  t.mock.method(globalThis,"fetch",async(url,opts)=>{request={url,opts};return{ok:true,json:async()=>({code:200,data:{}})}});
  const runtime={euler,context:{roomId:"old-room"},platforms:{adapters:new Map([["tiktok",{status:()=>({connected:true,roomId:"current-room"})}]])}};
  const result=await sendChat(runtime,"tiktok","Hallo TikTok",{requireConnected:true});
  assert.equal(result.ok,true);assert.equal(request.url.pathname,"/webcast/rooms/current-room/chat");assert.equal(request.url.search,"");
  assert.deepEqual(JSON.parse(request.opts.body),{content:"Hallo TikTok",targetRoomId:"current-room"});assert.equal(request.opts.headers["x-oauth-token"],"test-token");
});

test("TikTok and YouTube do not report malformed API responses as accepted messages",async t=>{
  t.mock.method(globalThis,"fetch",async()=>({ok:true,json:async()=>({})}));
  const euler=new EulerClient({oauth:{accessToken:async()=>"token"}});
  await assert.rejects(euler.sendChat("room","Test"),/nicht bestätigt/);
  const youtube=new YouTubeAdapter({oauth:{accessToken:async()=>"token"}});youtube.liveChatId="live";
  await assert.rejects(youtube.send("Test"),/keine Nachrichten-ID/);
});

test("canceling during OAuth prevents a late TikTok or YouTube chat write",async t=>{
  let writes=0;t.mock.method(globalThis,"fetch",async()=>{writes++;throw new Error("unexpected write")});
  for(const platform of ["tiktok","youtube"]){
    let finish;const gate=new Promise(resolve=>{finish=resolve});const oauth={accessToken:()=>gate};
    const adapter=platform==="youtube"?new YouTubeAdapter({oauth}):new EulerClient({oauth});adapter.liveChatId="live";
    const controller=new AbortController();
    const operation=platform==="youtube"?adapter.send("Test",{signal:controller.signal}):adapter.sendChat("room","Test",{signal:controller.signal});
    const rejected=assert.rejects(operation,{name:"AbortError"});controller.abort();finish("token");await rejected;
  }
  assert.equal(writes,0);
});

test("changing a broadcast destination during authentication cancels the old write",async t=>{
  let writes=0;t.mock.method(globalThis,"fetch",async()=>{writes++;throw new Error("unexpected write")});
  for(const platform of ["tiktok","youtube"]){
    let finish;const token=new Promise(resolve=>{finish=resolve});const oauth={accessToken:()=>token};
    const youtube=new YouTubeAdapter({oauth});youtube.liveChatId="first-chat";youtube.connected=true;
    let roomId="first-room";
    const reader={status:()=>({connected:true,roomId})};
    const runtime={context:{roomId:"stale-room"},euler:new EulerClient({oauth}),platforms:{adapters:new Map([["youtube",youtube],["tiktok",reader]])}};
    const pending=sendChat(runtime,platform,"Test",{requireConnected:true});
    const rejected=assert.rejects(pending,/getrennt oder gewechselt/);
    youtube.liveChatId="second-chat";roomId="second-room";finish("token");await rejected;
  }
  assert.equal(writes,0);
});

test("automatic sends reject offline chats even when old destination IDs remain",async()=>{
  let sends=0;
  const runtime={platforms:{adapters:new Map([["twitch",{status:()=>({connected:false,channel:"batto"}),send:async()=>{sends++}}]])}};
  await assert.rejects(sendChat(runtime,"twitch","Test",{requireConnected:true}),/getrennt/);assert.equal(sends,0);
  const adapter=new TwitchAdapter(),controller=new AbortController();adapter.connected=true;adapter.ws={readyState:1,send:()=>{sends++}};controller.abort();
  await assert.rejects(adapter.send("Test",{signal:controller.signal}),{name:"AbortError"});assert.equal(sends,0);
});

test("manual TikTok send does not replace a resolved destination with an old disconnected reader room",async()=>{
  let sentRoom;
  const runtime={context:{roomId:"resolved-room"},euler:{sendChat:async roomId=>{sentRoom=roomId}},platforms:{adapters:new Map([["tiktok",{status:()=>({connected:false,roomId:"old-room"})}]])}};
  await sendChat(runtime,"tiktok","Test");assert.equal(sentRoom,"resolved-room");
});
