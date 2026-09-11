"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const os=require("node:os");
const path=require("node:path");
const {setImmediate:flush}=require("node:timers/promises");
const {AutoBroadcast}=require("../src/services/auto-broadcast.cjs");
const {SettingsStore}=require("../src/storage/settings-store.cjs");
const {validate,defaults,requireReady}=require("../src/shared/auto-broadcast.js");
const config=()=>({intervalMinutes:1,platforms:["twitch","tiktok","youtube"],messages:["Erster Text","Zweiter Text"]});
function fixture(options={}){
  let now=1000,id=0;const timers=new Map(),calls=[],saved={};
  const statuses={twitch:{connected:true},tiktok:{connected:true},youtube:{connected:true}};
  const service=new AutoBroadcast({settingsStore:{get:async key=>saved[key],set:async(key,value)=>{saved[key]=structuredClone(value)}},
    getStatuses:()=>statuses,send:async(platform,message)=>{calls.push([platform,message]);return{ok:true}},
    now:()=>now,setTimer:(fn,delay)=>{const key=++id;timers.set(key,{at:now+delay,fn});return key},clearTimer:key=>timers.delete(key),...options});
  return{service,calls,saved,statuses,timers,async advance(ms){now+=ms;for(const [key,timer] of [...timers])if(timer.at<=now&&timers.has(key)){timers.delete(key);timer.fn()}await flush();}};
}

test("broadcast rejects invalid intervals, unsupported platforms, long texts and IRC controls",()=>{
  assert.deepEqual(validate(defaults()),defaults());assert.throws(()=>requireReady(defaults()),/Nachricht/);
  for(const intervalMinutes of [0,-1,0.5,1441,NaN,Infinity])assert.throws(()=>validate({...config(),intervalMinutes}),/Intervall/);
  assert.throws(()=>validate({...config(),platforms:["cng"]}),/CNG/);
  assert.throws(()=>validate({...config(),platforms:["constructor"]}),/unterstützt/);
  for(const messages of [[" "],["x".repeat(201)],Array(21).fill("Text"),["hi\x01ACTION test"]])assert.throws(()=>validate({...config(),messages}));
  assert.throws(()=>validate({...config(),messages:["界".repeat(151)]}),/Twitch/);
  assert.deepEqual(validate({...config(),messages:[" Text\nmit Umbruch "],platforms:["twitch","twitch"]}),{intervalMinutes:1,platforms:["twitch"],messages:["Text mit Umbruch"]});
});

test("saved templates persist per profile but never resume automatically",async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"batto-broadcast-"));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const file=path.join(directory,"settings.json"),first=fixture({settingsStore:new SettingsStore(file)});
  await first.service.load();await first.service.save(config());first.service.start();first.service.stop();
  const restarted=fixture({settingsStore:new SettingsStore(file)});await restarted.service.load();
  assert.deepEqual(restarted.service.status().config,config());assert.equal(restarted.service.status().running,false);
  await restarted.advance(3600000);assert.deepEqual(restarted.calls,[]);assert.equal(restarted.timers.size,0);
  const secondProfile=fixture({settingsStore:new SettingsStore(path.join(directory,"other.json"))});await secondProfile.service.load();assert.deepEqual(secondProfile.service.status().config,defaults());
});

test("start waits an interval, rotates one template to all selected chats and is idempotent",async()=>{
  const f=fixture();await f.service.save(config());f.service.start();f.service.start();assert.equal(f.timers.size,1);
  await f.advance(59999);assert.deepEqual(f.calls,[]);
  await f.advance(1);assert.deepEqual(f.calls,[["twitch","Erster Text"],["tiktok","Erster Text"],["youtube","Erster Text"]]);
  assert.equal(f.service.status().nextMessageIndex,1);assert.equal(f.service.status().lastRun.results.twitch.state,"submitted");
  await f.advance(60000);assert.equal(f.calls.length,6);assert.equal(f.calls[3][1],"Zweiter Text");assert.equal(f.service.status().nextMessageIndex,0);f.service.stop();
});

test("offline chats are skipped without consuming templates or building a catch-up queue",async()=>{
  const f=fixture();for(const status of Object.values(f.statuses))status.connected=false;
  await f.service.save(config());f.service.start();await f.advance(3600000);
  assert.deepEqual(f.calls,[]);assert.equal(f.service.status().lastRun.results.youtube.state,"skipped");assert.equal(f.service.status().nextMessageIndex,0);
  f.statuses.twitch.connected=true;await f.advance(59999);assert.deepEqual(f.calls,[]);
  await f.advance(1);assert.deepEqual(f.calls,[["twitch","Erster Text"]]);f.service.stop();
});

test("a failed platform does not block the other selected platforms or become a success",async()=>{
  const calls=[];const f=fixture({send:async(platform,message)=>{calls.push([platform,message]);if(platform==="youtube")throw new Error("YouTube: Schreibrechte fehlen");return{ok:platform!=="tiktok"}}});
  await f.service.save(config());f.service.start();await f.advance(60000);
  const results=f.service.status().lastRun.results;assert.equal(calls.length,3);assert.equal(results.twitch.state,"submitted");
  assert.equal(results.youtube.state,"failed");assert.match(results.youtube.detail,/Schreibrechte/);assert.equal(results.tiktok.state,"failed");f.service.stop();
});

test("pause aborts a pending send, prevents overlap and never re-arms its timer",async()=>{
  let signal,calls=0;const f=fixture({send:async(_platform,_message,options)=>{signal=options.signal;calls++;return new Promise(()=>{})}});
  await f.service.save({...config(),platforms:["twitch"]});f.service.start();await f.advance(60000);assert.equal(f.service.status().busy,true);
  await f.advance(10000);assert.equal(calls,1);f.service.pause();assert.equal(signal.aborted,true);
  assert.throws(()=>f.service.start(),/vorige Versand/);await flush();assert.equal(f.service.status().busy,false);
  assert.equal(f.service.status().lastRun.results.twitch.state,"canceled");assert.equal(f.timers.size,0);
  await f.advance(3600000);assert.equal(calls,1);
});

test("a hanging request times out and the next round still waits a full interval",async()=>{
  let signal,calls=0;const f=fixture({send:async(_platform,_message,options)=>{signal=options.signal;calls++;return new Promise(()=>{})}});
  await f.service.save({...config(),platforms:["twitch"]});f.service.start();await f.advance(60000);await f.advance(20000);
  assert.equal(signal.aborted,true);assert.equal(f.service.status().lastRun.results.twitch.state,"failed");assert.match(f.service.status().lastRun.results.twitch.detail,/Zeitüberschreitung/);
  await f.advance(59999);assert.equal(calls,1);await f.advance(1);assert.equal(calls,2);f.service.stop();await flush();
});

test("saving pauses immediately and a failed disk write keeps the prior active configuration",async()=>{
  const f=fixture();await f.service.save(config());f.service.start();f.service.settingsStore.set=async()=>{throw new Error("Datenträger voll")};
  await assert.rejects(f.service.save({...config(),messages:["Neuer Text"]}),/Datenträger/);
  assert.equal(f.service.status().running,false);assert.deepEqual(f.service.status().config,config());assert.equal(f.timers.size,0);
  f.service.settingsStore.set=async()=>{};await f.service.save({...config(),messages:["Neuer Text"]});assert.equal(f.service.status().config.messages[0],"Neuer Text");
});

test("save requests are serialized and start is rejected while a save is pending",async()=>{
  let finish;const gate=new Promise(resolve=>{finish=resolve}),writes=[];
  const f=fixture({settingsStore:{get:async()=>null,set:async(_key,value)=>{writes.push(value.messages[0]);await gate}}});
  const first=f.service.save(config()),second=f.service.save({...config(),messages:["Aktuell"]});await flush();
  assert.deepEqual(writes,["Erster Text"]);assert.throws(()=>f.service.start(),/gespeichert/);
  finish();await Promise.all([first,second]);assert.deepEqual(writes,["Erster Text","Aktuell"]);assert.equal(f.service.status().config.messages[0],"Aktuell");assert.equal(f.service.status().running,false);
});

test("shutdown and malformed saved settings cannot start broadcasts",async()=>{
  const f=fixture({settingsStore:{get:async()=>({running:true,intervalMinutes:0,platforms:["cng"],messages:["oops"]})}});
  await f.service.load();assert.match(f.service.status().error,/ungültig/);assert.deepEqual(f.service.status().config,defaults());
  f.service.stop();assert.throws(()=>f.service.start(),/beendet/);assert.throws(()=>f.service.save(config()),/beendet/);
});
