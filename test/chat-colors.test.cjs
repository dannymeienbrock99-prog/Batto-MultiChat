"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const colors=require("../src/shared/chat-appearance.js");
const {ChatCore}=require("../src/services/chat-core.cjs");
const {PlatformManager}=require("../src/services/platform-manager.cjs");
const {TwitchAdapter}=require("../src/platforms/twitch/twitch-adapter.cjs");
const {HologramServer}=require("../src/services/hologram-server.cjs");
const {StreamOverlayServer}=require("../src/services/stream-overlay-server.cjs");

async function chatRenderer(history,appearance=colors.normalize()){
  const elements=new Map();
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{
      innerHTML:"",textContent:"",style:{},classList:{add(){},toggle(){}},
      addEventListener(){},querySelectorAll:()=>[]
    });
    return elements.get(selector);
  };
  const root={innerHTML:"",querySelector:element,querySelectorAll:()=>[]};
  let onMessages,onAppearance;
  const empty=async()=>({});
  const api={
    appearanceGet:async()=>appearance,onAppearanceChanged:cb=>{onAppearance=cb;},
    autoBroadcastGet:empty,onAutoBroadcastChanged(){},
    settingsGet:empty,chatHistory:async()=>history.slice(),chatStatuses:empty,
    tiktokOAuthStatus:empty,twitchOAuthStatus:empty,youtubeOAuthStatus:empty,
    tiktokContext:empty,obsStatus:async()=>({connected:false}),overlayStatus:empty,
    onChatMessages:callback=>{onMessages=callback;},onChatStatus(){}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/renderer/multi-chat.js"),"utf8"),{
    window:{batto:api,BattoChatAppearance:colors,createBattoAppearanceEditor:()=>({markup:()=>"",bind(){},load(){}}),createBattoBroadcastEditor:()=>({markup:()=>"",bind(){},load(){}})},document:{getElementById:()=>root}
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.doesNotMatch(root.innerHTML,/<pre/);
  return{body:element("#chat-body"),send:messages=>onMessages(messages),appearance:value=>onAppearance(value)};
}

async function renderOverlay(server){
  const root={style:{},innerHTML:""};
  let stream;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/stream-overlay/overlay.js"),"utf8"),{
    window:{BattoChatAppearance:colors},document:{getElementById:()=>root,querySelectorAll:()=>[]},setInterval:()=>0,
    EventSource:class{constructor(){stream=this;}}
  });
  await server.handle({url:"/events",method:"GET",on(){}},{
    writeHead(){},write:frame=>stream.onmessage({data:frame.slice(6)})
  });
  return root;
}

test("Twitch IRC name color reaches history, desktop chat, OBS overlay and hologram",async()=>{
  const core=new ChatCore(),platforms=new PlatformManager(core),twitch=new TwitchAdapter();
  const overlay=new StreamOverlayServer(),hologram=new HologramServer();
  platforms.register("twitch",twitch);
  core.on("messages",messages=>messages.forEach(message=>{overlay.pushChat(message);hologram.push(message);}));
  twitch.config={channel:"batto"};
  twitch.handleLine("@badges=;color=#00FF00;display-name=GreenUser;user-id=123;id=chat-1 :greenuser!greenuser@greenuser.tmi.twitch.tv PRIVMSG #batto :Hallo");
  const message=core.history()[0];
  assert.equal(message.color,"#00FF00");
  assert.equal(hologram.last.color,"#00ff00");
  const chat=await chatRenderer(core.history());
  assert.match(chat.body.innerHTML,/class="chat-user" style="color:#00ff00">GreenUser/);
  const browser=await renderOverlay(overlay);
  assert.match(browser.innerHTML,/class="user" style="color:#00ff00">GreenUser/);
  const next=core.push({platform:"twitch",username:"Next",message:"Weiter",color:"#ff6600"});
  chat.send([next]);
  assert.match(chat.body.innerHTML,/class="chat-user" style="color:#ff6600">Next/);
  assert.match(browser.innerHTML,/class="user" style="color:#ff6600">Next/);
  assert.equal(hologram.last.color,"#ff6600");
});

test("missing and unsafe colors use the desktop platform fallback",async()=>{
  const core=new ChatCore();
  for(const color of ["",'red;position:fixed',`#fff\" onmouseover=\"alert(1)`]){
    const message=core.push({platform:"twitch",username:"Fallback",message:"Hallo",color});
    assert.equal(message.color,"");
  }
  const chat=await chatRenderer(core.history());
  assert.equal((chat.body.innerHTML.match(/class="chat-user" style="color:#9146ff">/g)||[]).length,3);
  assert.doesNotMatch(chat.body.innerHTML,/onmouseover|position:fixed/);
});

test("direct overlay chat ingest accepts hex colors and rejects CSS or attribute injection",async()=>{
  const server=new StreamOverlayServer();
  const browser=await renderOverlay(server);
  server.pushChat({platform:"twitch",username:"Valid",message:"Hallo",color:"#abc"});
  server.pushChat({platform:"twitch",username:"Invalid",message:"Hallo",color:'red;position:fixed" onclick="alert(1)'});
  assert.match(browser.innerHTML,/class="user" style="color:#aabbcc">Valid/);
  assert.match(browser.innerHTML,/class="user" style="color:#9146ff">Invalid/);
  assert.doesNotMatch(browser.innerHTML,/onclick|position:fixed/);
});


test("saved colors restyle existing and future chat on every BATTO surface; reset restores source colors",async()=>{
  const message={platform:"twitch",username:"Viewer",message:"Hallo",color:"#00ff00"};
  const overlay=new StreamOverlayServer(),hologram=new HologramServer();
  overlay.pushChat(message);hologram.push(message);
  const chat=await chatRenderer([message]),browser=await renderOverlay(overlay);
  const custom=colors.normalize({twitch:{customName:true,nameColor:"#ff00aa",customMessage:true,messageColor:"#ffee00"}});
  chat.appearance(custom);overlay.setAppearance(custom);hologram.setAppearance(custom);
  for(const html of [chat.body.innerHTML,browser.innerHTML]){
    assert.match(html,/style="color:#ff00aa">Viewer/);
    assert.match(html,/style="color:#ffee00">Hallo/);
  }
  assert.equal(hologram.last.color,"#ff00aa");assert.equal(hologram.last.messageColor,"#ffee00");
  assert.equal(overlay.state.events.length,0,"appearance updates must not become stream events");
  const reconnected=await renderOverlay(overlay);
  assert.match(reconnected.innerHTML,/style="color:#ffee00">Hallo/);
  const next={...message,username:"Next",message:"Weiter"};
  chat.send([next]);overlay.pushChat(next);hologram.push(next);
  assert.match(chat.body.innerHTML,/style="color:#ff00aa">Next/);
  assert.match(browser.innerHTML,/style="color:#ffee00">Weiter/);
  assert.equal(hologram.last.color,"#ff00aa");
  const defaults=colors.normalize();
  chat.appearance(defaults);overlay.setAppearance(defaults);hologram.setAppearance(defaults);
  for(const html of [chat.body.innerHTML,browser.innerHTML]){
    assert.match(html,/style="color:#00ff00">Viewer/);
    assert.doesNotMatch(html,/#ff00aa|#ffee00/);
  }
  assert.equal(hologram.last.color,"#00ff00");assert.equal(hologram.last.messageColor,"");
  assert.equal(message.color,"#00ff00","original messages must remain unchanged");
});
