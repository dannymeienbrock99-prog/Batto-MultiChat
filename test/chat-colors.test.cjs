"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {ChatCore}=require("../src/services/chat-core.cjs");
const {PlatformManager}=require("../src/services/platform-manager.cjs");
const {TwitchAdapter}=require("../src/platforms/twitch/twitch-adapter.cjs");
const {HologramServer}=require("../src/services/hologram-server.cjs");
const {StreamOverlayServer}=require("../src/services/stream-overlay-server.cjs");

async function chatRenderer(history){
  const elements=new Map();
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{
      innerHTML:"",textContent:"",style:{},classList:{add(){},toggle(){}},
      addEventListener(){},querySelectorAll:()=>[]
    });
    return elements.get(selector);
  };
  const root={innerHTML:"",querySelector:element,querySelectorAll:()=>[]};
  let onMessages;
  const empty=async()=>({});
  const api={
    settingsGet:empty,chatHistory:async()=>history.slice(),chatStatuses:empty,
    tiktokOAuthStatus:empty,twitchOAuthStatus:empty,youtubeOAuthStatus:empty,
    tiktokContext:empty,obsStatus:async()=>({connected:false}),overlayStatus:empty,
    onChatMessages:callback=>{onMessages=callback;},onChatStatus(){}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/renderer/multi-chat.js"),"utf8"),{
    window:{batto:api},document:{getElementById:()=>root}
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.doesNotMatch(root.innerHTML,/<pre/);
  return{body:element("#chat-body"),send:messages=>onMessages(messages)};
}

async function renderOverlay(server){
  const root={style:{},innerHTML:""};
  let stream;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/stream-overlay/overlay.js"),"utf8"),{
    document:{getElementById:()=>root,querySelectorAll:()=>[]},setInterval:()=>0,
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
  assert.equal(hologram.last.color,"#00FF00");
  const chat=await chatRenderer(core.history());
  assert.match(chat.body.innerHTML,/class="chat-user" style="color:#00FF00">GreenUser/);
  const browser=await renderOverlay(overlay);
  assert.match(browser.innerHTML,/class="user" style="color:#00FF00">GreenUser/);
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
  assert.match(browser.innerHTML,/class="user" style="color:#abc">Valid/);
  assert.match(browser.innerHTML,/class="user">Invalid/);
  assert.doesNotMatch(browser.innerHTML,/onclick|position:fixed/);
});
