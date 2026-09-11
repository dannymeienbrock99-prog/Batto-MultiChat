"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {setImmediate:flush}=require("node:timers/promises");
const model=require("../src/shared/auto-broadcast.js");
const {AutoBroadcast}=require("../src/services/auto-broadcast.cjs");
const {AppRuntime}=require("../src/runtime/app-runtime.cjs");

function editorFixture(overrides={}){
  const elements=new Map(),calls=[],window={BattoAutoBroadcast:model};
  const state=()=>({config:{intervalMinutes:2,platforms:["twitch"],messages:["Hallo Chat"]},running:false,busy:false,saving:false,nextMessageIndex:0,nextRunAt:0});
  const api={autoBroadcastSave:async config=>{calls.push(["save",config]);return{...state(),config}},autoBroadcastStart:async()=>{calls.push(["start"]);return{...state(),running:true,nextRunAt:Date.now()+120000}},autoBroadcastPause:async()=>{calls.push(["pause"]);return state()},...overrides};
  function install(html){for(const match of html.matchAll(/\bid="([^"]+)"/g))if(!elements.has(match[1])){
    let content="";elements.set(match[1],{value:"",checked:false,textContent:"",style:{},disabled:false,dataset:{},focus(){},get innerHTML(){return content},set innerHTML(value){content=value;install(value)}});
  }}
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/renderer/auto-broadcast-controls.js"),"utf8"),{window,document:{getElementById:id=>elements.get(id)||null},structuredClone});
  const editor=window.createBattoBroadcastEditor({api});editor.load(state());install(editor.markup());editor.bind();
  return{editor,calls,get:id=>elements.get(id),state};
}

test("broadcast editor saves without sending and requires an explicit start action",async()=>{
  const f=editorFixture();f.get("broadcast-message-0").oninput({target:{value:"Meine Ankündigung"}});
  f.get("broadcast-interval").oninput({target:{value:"3"}});f.get("broadcast-platform-youtube").onchange({target:{checked:true}});
  await f.get("broadcast-form").onsubmit({preventDefault(){}});
  assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],["save",{intervalMinutes:3,platforms:["twitch","youtube"],messages:["Meine Ankündigung"]}]);
  await f.get("broadcast-start").onclick();assert.equal(f.calls.at(-1)[0],"start");assert.equal(f.get("broadcast-fields").disabled,true);assert.equal(f.get("broadcast-pause").disabled,false);
  await f.get("broadcast-pause").onclick();assert.equal(f.calls.at(-1)[0],"pause");assert.equal(f.get("broadcast-fields").disabled,false);
});

test("broadcast UI keeps drafts on status changes and refuses invalid or empty templates",async()=>{
  const f=editorFixture();f.get("broadcast-message-0").oninput({target:{value:"Mein Entwurf"}});
  f.editor.update({...f.state(),lastRun:{startedAt:1000,index:0,message:"Alt",results:{twitch:{state:"failed",detail:"Fehler <img src=x onerror=alert(1)>"}}}});
  assert.match(f.editor.markup(),/Mein Entwurf/);assert.doesNotMatch(f.get("broadcast-results").innerHTML,/<img/);
  f.get("broadcast-add").onclick();await f.get("broadcast-start").onclick();assert.equal(f.calls.length,0);assert.match(f.get("broadcast-feedback").textContent,/Nachricht 2/);
  f.get("broadcast-remove-1").onclick();f.get("broadcast-interval").oninput({target:{value:"0"}});
  await f.get("broadcast-start").onclick();assert.equal(f.calls.length,0);assert.match(f.get("broadcast-feedback").textContent,/Intervall/);
});

test("pause during saving prevents a delayed save response from starting a broadcast",async()=>{
  let finish;const gate=new Promise(resolve=>{finish=resolve});
  const f=editorFixture({autoBroadcastSave:()=>gate});
  const pending=f.get("broadcast-start").onclick();await flush();await f.get("broadcast-pause").onclick();
  finish(f.state());await pending;assert.deepEqual(f.calls,[["pause"]]);assert.equal(f.get("broadcast-fields").disabled,false);
});

test("failed saves stay visible and never fall through to start",async()=>{
  const f=editorFixture({autoBroadcastSave:async()=>{throw new Error("Datenträger voll")}});
  await f.get("broadcast-start").onclick();assert.deepEqual(f.calls,[]);assert.match(f.get("broadcast-feedback").textContent,/Datenträger voll/);
  assert.equal(f.get("broadcast-start").disabled,false);
});

test("the actual preload and runtime IPC save, start, publish status, pause and stop without a chat write",async()=>{
  const handlers=new Map(),listeners=new Map(),values={};let sends=0,api;
  const runtime=new AppRuntime({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)}});
  runtime.settings={get:async key=>values[key],set:async(key,value)=>{values[key]=value}};
  runtime.autoBroadcast=new AutoBroadcast({settingsStore:runtime.settings,getStatuses:()=>({}),send:async()=>{sends++},onChange:value=>listeners.get("autoBroadcast:changed")?.({},value)});
  await runtime.autoBroadcast.load();runtime.registerIpc();
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/preload.cjs"),"utf8"),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{api=value}},ipcRenderer:{invoke:(name,...args)=>handlers.get(name)({},...args),on:(name,listener)=>listeners.set(name,listener)}})});
  let received;api.onAutoBroadcastChanged(value=>{received=value});
  assert.equal((await api.autoBroadcastGet()).running,false);
  const config={intervalMinutes:5,platforms:["youtube"],messages:["Mein Hinweis"]};
  await api.autoBroadcastSave(config);assert.deepEqual(values.autoBroadcast,config);assert.equal(sends,0);
  await api.autoBroadcastStart();assert.equal(received.running,true);assert.equal((await api.autoBroadcastGet()).running,true);
  await api.autoBroadcastPause();assert.equal(received.running,false);
  await api.autoBroadcastStart();await runtime.stop();assert.equal(received.running,false);assert.equal(sends,0);
});
