"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const os=require("node:os");
const path=require("node:path");
const vm=require("node:vm");
const {AppRuntime}=require("../src/runtime/app-runtime.cjs");
const colors=require("../src/shared/chat-appearance.js");
const {ChatAppearanceService}=require("../src/services/chat-appearance.cjs");
const {SettingsStore}=require("../src/storage/settings-store.cjs");
const {HologramServer}=require("../src/services/hologram-server.cjs");
const {StreamOverlayServer}=require("../src/services/stream-overlay-server.cjs");

test("the actual preload calls the registered appearance IPC and receives saved values",async t=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),"batto-appearance-ipc-"));
  t.after(()=>fs.rm(folder,{recursive:true,force:true}));
  const handlers=new Map(),runtime=new AppRuntime({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)}});
  runtime.settings=new SettingsStore(path.join(folder,"settings.json"));
  runtime.appearance=new ChatAppearanceService({settingsStore:runtime.settings});
  await runtime.appearance.load();runtime.registerIpc();
  let api,listener;
  vm.runInNewContext(await fs.readFile(path.join(__dirname,"../src/preload.cjs"),"utf8"),{
    require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{api=value;}},ipcRenderer:{
      invoke:(name,...args)=>handlers.get(name)({},...args),
      on:(name,fn)=>{assert.equal(name,"appearance:changed");listener=fn;}
    }})
  });
  assert.deepEqual(await api.appearanceGet(),colors.normalize());
  const custom=colors.normalize({twitch:{customName:true,nameColor:"#abcdef"}});
  assert.deepEqual(await api.appearanceSave(custom),custom);
  assert.deepEqual((await api.settingsGet()).chatAppearance,custom);
  let received;api.onAppearanceChanged(value=>{received=value;});listener({},custom);
  assert.deepEqual(received,custom);
});

test("older profiles keep source colors until each platform override is enabled",()=>{
  const defaults=colors.normalize();
  for(const platform of Object.keys(colors.platforms)){
    assert.deepEqual(colors.resolve(defaults,{platform,color:"#abc"}),{nameColor:"#aabbcc",messageColor:""});
  }
  const custom=colors.normalize({twitch:{customName:true,nameColor:"#123456",customMessage:true,messageColor:"#abcdef"}});
  assert.deepEqual(colors.resolve(custom,{platform:"twitch",color:"#fff"}),{nameColor:"#123456",messageColor:"#abcdef"});
  assert.deepEqual(colors.resolve(custom,{platform:"youtube",color:"#fff"}),{nameColor:"#ffffff",messageColor:""});
});

test("invalid saved data cannot inject CSS and normalization returns independent profiles",()=>{
  for(const input of [null,[],"wrong",{twitch:{customName:"true",customMessage:true,nameColor:"red",messageColor:'red;position:fixed"'}}]){
    const profile=colors.normalize(input);
    assert.equal(profile.twitch.customName,false);
    assert.equal(profile.twitch.nameColor,"#9146ff");
    assert.equal(profile.twitch.messageColor,"#dbe3ee");
  }
  assert.deepEqual(colors.resolve(colors.normalize(),{platform:"__proto__",color:"red"}),{nameColor:"#5aa7ff",messageColor:""});
  const first=colors.normalize(),second=colors.normalize();
  first.twitch.nameColor="#000000";
  assert.equal(second.twitch.nameColor,"#9146ff");
});

test("colors persist across restart, stay separate by user profile, and survive concurrent settings saves",async t=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),"batto-appearance-"));
  t.after(()=>fs.rm(folder,{recursive:true,force:true}));
  const file=path.join(folder,"user-a","settings.json"),store=new SettingsStore(file,{tts:{enabled:false}});
  await store.load();
  const changes=[],service=new ChatAppearanceService({settingsStore:store,onChange:value=>changes.push(value)});
  await service.load();
  const custom=colors.normalize({tiktok:{customName:true,nameColor:"#f0a",customMessage:true,messageColor:"#123456"}});
  await Promise.all([service.save(custom),...Array.from({length:12},(_,i)=>store.set("accountRefresh",i))]);
  const loaded=new SettingsStore(file),restarted=new ChatAppearanceService({settingsStore:loaded});
  assert.deepEqual(await restarted.load(),custom);
  assert.equal((await loaded.get()).accountRefresh,11);
  assert.deepEqual((await loaded.get()).tts,{enabled:false});
  assert.deepEqual(changes,[custom]);
  const other=new ChatAppearanceService({settingsStore:new SettingsStore(path.join(folder,"user-b","settings.json"))});
  assert.deepEqual(await other.load(),colors.normalize());
  await restarted.save(colors.normalize());
  assert.deepEqual(await new ChatAppearanceService({settingsStore:new SettingsStore(file)}).load(),colors.normalize());
});

test("a failed save is reported without applying colors, and a retry can succeed",async()=>{
  let fail=true,notifications=0;
  const service=new ChatAppearanceService({settingsStore:{get:async()=>null,set:async()=>{if(fail)throw new Error("disk unavailable");}},onChange:()=>notifications++});
  await service.load();
  const custom=colors.normalize({youtube:{customMessage:true,messageColor:"#abcdef"}});
  await assert.rejects(service.save(custom),/disk unavailable/);
  assert.deepEqual(service.get(),colors.normalize());assert.equal(notifications,0);
  fail=false;
  assert.deepEqual(await service.save(custom),custom);assert.equal(notifications,1);
});

test("hologram recoloring preserves message lifetime and initial reconnect colors",async()=>{
  const server=new HologramServer(),frames=[];
  await server.handle({url:"/events",on(){}},{writeHead(){},write:line=>frames.push(JSON.parse(line.slice(6)))});
  const initial=server.push({platform:"twitch",username:"Viewer",message:"Hallo",color:"#0f0"});
  server.setAppearance({twitch:{customMessage:true,messageColor:"#abc"}});
  assert.equal(frames[1].type,"appearance");assert.equal(frames[1].timestamp,initial.timestamp);
  assert.equal(frames[1].messageColor,"#aabbcc");
  let snapshot;
  await server.handle({url:"/events",on(){}},{writeHead(){},write:line=>{snapshot=JSON.parse(line.slice(6));}});
  assert.equal(snapshot.messageColor,"#aabbcc");assert.equal(snapshot.type,undefined);
});

test("OBS serves its shared color module and sends saved appearance in the SSE snapshot",{timeout:10000},async t=>{
  const server=new StreamOverlayServer({port:0,webRoot:path.join(__dirname,"../src/stream-overlay")});
  server.setAppearance({cng:{customName:true,nameColor:"#aabbcc"}});
  await server.start();t.after(()=>server.stop());
  const url=`http://127.0.0.1:${server.server.address().port}`;
  const html=await fetch(url+"/overlay").then(r=>r.text());
  assert.match(html,/<script src="\/chat-appearance.js"><\/script><script src="\/overlay.js">/);
  const script=await fetch(url+"/chat-appearance.js");assert.equal(script.status,200);
  assert.match(await script.text(),/BattoChatAppearance/);
  const controller=new AbortController();t.after(()=>controller.abort());
  const response=await fetch(url+"/events",{signal:controller.signal});
  const chunk=await response.body.getReader().read();
  const initial=JSON.parse(Buffer.from(chunk.value).toString().split("\n\n")[0].slice(6));
  assert.equal(initial.appearance.cng.nameColor,"#aabbcc");
  controller.abort();
});
