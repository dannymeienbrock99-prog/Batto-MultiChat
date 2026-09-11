"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {ChatCore}=require("../src/services/chat-core.cjs");
const {StreamOverlayServer}=require("../src/services/stream-overlay-server.cjs");
const {giftFrom}=require("../src/platforms/tiktok/tiktok-adapter.cjs");

function fixture(){
  const core=new ChatCore();
  const server=new StreamOverlayServer();
  core.on("messages",batch=>batch.forEach(message=>server.pushEvent(message)));
  return{core,server};
}

function gift(core,{repeatCount=1,repeatEnd=true,giftType=1,groupId="group-1",msgId="",userId="user-1",username="gifter",displayName="Gifter",...rest}={}){
  const data={giftId:1,giftName:"Rose",diamondCount:1,repeatCount,repeatEnd,giftType,groupId,msgId,...rest};
  return core.push({platform:"tiktok",eventType:"gift",userId,username,displayName,gift:giftFrom(data),metadata:data});
}

function overlayRenderer(){
  const root={style:{},innerHTML:""};
  let stream;
  const context={
    window:{BattoChatAppearance:require("../src/shared/chat-appearance.js")},
    document:{getElementById:()=>root,querySelectorAll:()=>[]},
    setInterval:()=>0,
    EventSource:class{constructor(){stream=this;}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/stream-overlay/overlay.js"),"utf8"),context);
  return{root,send:payload=>stream.onmessage({data:JSON.stringify(payload)})};
}

async function attachOverlay(server){
  const renderer=overlayRenderer();
  // Exercise the same initial snapshot and event frames used by OBS EventSource.
  await server.handle({url:"/events",method:"GET",on(){}},{
    writeHead(){},
    write(frame){renderer.send(JSON.parse(frame.slice(6)));}
  });
  return renderer;
}

test("12 normalized TikTok likes render as 12 and remain after feed eviction and OBS reload",async()=>{
  const {core,server}=fixture();
  const overlay=await attachOverlay(server);
  core.push({platform:"tiktok",eventType:"like",metadata:{likeCount:12,totalLikeCount:240,msgId:"likes-1"}});
  assert.equal(server.state.stats.likeCount,12);
  assert.match(overlay.root.innerHTML,/overlay-likeCounter[\s\S]*?overlay-value">12<\/span>/);
  for(let i=0;i<120;i++)core.push({platform:"tiktok",eventType:"member",username:"viewer"});
  assert.equal(server.state.events.length,100);
  const reloaded=await attachOverlay(server);
  assert.match(reloaded.root.innerHTML,/overlay-likeCounter[\s\S]*?overlay-value">12<\/span>/);
  core.push({platform:"tiktok",eventType:"like",metrics:{likeCount:3},metadata:{msgId:"likes-2"}});
  assert.equal(server.state.stats.likeCount,15);
  assert.match(reloaded.root.innerHTML,/overlay-likeCounter[\s\S]*?overlay-value">15<\/span>/);
});

test("gift streak progress 1, 2 and final 2 counts two diamonds, including final-event replay",()=>{
  const {core,server}=fixture();
  gift(core,{repeatCount:1,repeatEnd:false,msgId:"progress-1"});
  gift(core,{repeatCount:2,repeatEnd:false,msgId:"progress-2"});
  assert.deepEqual(server.state.stats.topGifters,[]);
  gift(core,{repeatCount:2,repeatEnd:true,msgId:"final-1"});
  gift(core,{repeatCount:2,repeatEnd:true,msgId:"replayed-final"});
  assert.equal(server.state.stats.topGifters[0].totalDiamonds,2);
  gift(core,{repeatCount:1,repeatEnd:false,groupId:"group-2"});
  gift(core,{repeatCount:1,repeatEnd:true,groupId:"group-2"});
  assert.equal(server.state.stats.topGifters[0].totalDiamonds,3);
});

test("modern nested gift details preserve gift type alongside extended catalog data",()=>{
  const normalized=giftFrom({
    giftId:42,repeatCount:2,repeatEnd:0,groupId:"large-group-id",
    giftDetails:{giftType:1,giftName:"Rose",diamondCount:1},
    extendedGiftInfo:{imageUrl:"https://example.test/rose.webp"}
  });
  assert.equal(normalized.giftType,1);
  assert.equal(normalized.giftName,"Rose");
  assert.equal(normalized.groupId,"large-group-id");
  const {core,server}=fixture();
  core.push({platform:"tiktok",eventType:"gift",username:"gifter",gift:normalized});
  assert.deepEqual(server.state.stats.topGifters,[]);
  core.push({platform:"tiktok",eventType:"gift",username:"gifter",gift:{...normalized,repeatEnd:true}});
  assert.equal(server.state.stats.topGifters[0].totalDiamonds,2);
});

test("legacy gifts with repeat-end flags but no gift type still count the final streak once",()=>{
  const {core,server}=fixture();
  for(const [repeatCount,repeatEnd] of [[1,false],[2,false],[2,true]]){
    const data={giftId:1,giftName:"Rose",diamondCount:1,repeatCount,repeatEnd};
    core.push({platform:"tiktok",eventType:"gift",username:"gifter",gift:giftFrom(data),metadata:data});
  }
  assert.equal(server.state.stats.topGifters[0].totalDiamonds,2);
});

test("non-streak gifts count immediately and only actual replay IDs are deduplicated",()=>{
  const {core,server}=fixture();
  gift(core,{giftType:2,diamondCount:10,repeatEnd:false,msgId:"gift-a",groupId:"0"});
  gift(core,{giftType:2,diamondCount:10,repeatEnd:false,msgId:"gift-a",groupId:"0"});
  gift(core,{giftType:2,diamondCount:10,repeatEnd:false,msgId:"gift-b",groupId:"0"});
  assert.equal(server.state.stats.topGifters[0].totalDiamonds,20);
});

test("top-gifter totals survive more than 100 events and a new overlay connection",async()=>{
  const {core,server}=fixture();
  const overlay=await attachOverlay(server);
  for(let i=0;i<125;i++)gift(core,{giftType:2,msgId:`gift-${i}`,groupId:"0"});
  assert.equal(server.state.events.length,100);
  assert.equal(server.state.stats.topGifters[0].totalDiamonds,125);
  assert.match(overlay.root.innerHTML,/<span>Gifter<\/span><strong>125<\/strong>/);
  const reloaded=await attachOverlay(server);
  assert.match(reloaded.root.innerHTML,/<span>Gifter<\/span><strong>125<\/strong>/);
});

test("gifters with the same display name remain separate and earlier rank-six totals survive",()=>{
  const {core,server}=fixture();
  for(let i=0;i<6;i++)gift(core,{giftType:2,userId:`user-${i}`,displayName:"Same Name",diamondCount:6-i,msgId:`gift-${i}`});
  assert.equal(server.state.stats.topGifters.length,5);
  assert.equal(new Set(server.state.stats.topGifters.map(user=>user.userId)).size,5);
  gift(core,{giftType:2,userId:"user-5",displayName:"Renamed",diamondCount:10,msgId:"comeback"});
  assert.equal(server.state.stats.topGifters[0].totalDiamonds,11);
  assert.equal(server.state.stats.topGifters[0].displayName,"Renamed");
});

test("duplicate like events and invalid counts do not inflate session totals",()=>{
  const {core,server}=fixture();
  for(let i=0;i<2;i++)core.push({platform:"tiktok",eventType:"like",metadata:{likeCount:12,common:{msgId:"same-like"}}});
  for(const likeCount of [-5,"bad",Infinity])core.push({platform:"tiktok",eventType:"like",metrics:{likeCount}});
  assert.equal(server.state.stats.likeCount,12);
});

test("clearing resets counters, rankings and replay tracking on existing and new overlays",async()=>{
  const {core,server}=fixture();
  const overlay=await attachOverlay(server);
  core.push({platform:"tiktok",eventType:"like",likeCount:12});
  gift(core);
  server.clear();
  assert.deepEqual(server.state.stats,{likeCount:0,topGifters:[]});
  assert.match(overlay.root.innerHTML,/overlay-likeCounter[\s\S]*?overlay-value">0<\/span>/);
  assert.match(overlay.root.innerHTML,/Noch keine Gifts/);
  const reloaded=await attachOverlay(server);
  assert.match(reloaded.root.innerHTML,/Noch keine Gifts/);
  gift(core);
  assert.equal(server.state.stats.topGifters[0].totalDiamonds,1);
});

test("HTTP state and SSE reconnect snapshots carry full totals in event order",{timeout:10000},async t=>{
  const {core,server}=fixture();
  server.port=0;
  await server.start();
  t.after(()=>server.stop());
  const url=`http://127.0.0.1:${server.server.address().port}`;
  core.push({platform:"tiktok",eventType:"like",likeCount:12});
  gift(core,{repeatCount:2});
  const snapshot=await fetch(`${url}/api/state`).then(response=>response.json());
  assert.equal(snapshot.state.stats.likeCount,12);
  assert.equal(snapshot.state.stats.topGifters[0].totalDiamonds,2);
  for(let connection=0;connection<2;connection++){
    const controller=new AbortController();
    t.after(()=>controller.abort());
    const response=await fetch(`${url}/events`,{signal:controller.signal});
    const reader=response.body.getReader();
    let buffered="";
    async function next(){
      while(!buffered.includes("\n\n")){
        const chunk=await reader.read();
        assert.equal(chunk.done,false);
        buffered+=Buffer.from(chunk.value).toString("utf8");
      }
      const end=buffered.indexOf("\n\n");
      const frame=buffered.slice(0,end);buffered=buffered.slice(end+2);
      return JSON.parse(frame.slice(6));
    }
    const initial=await next();
    assert.equal(initial.type,"config");
    assert.equal(initial.state.stats.likeCount,12+connection);
    assert.equal(initial.state.stats.topGifters[0].totalDiamonds,2);
    core.push({platform:"tiktok",eventType:"like",likeCount:1});
    const update=await next();
    assert.equal(update.stats.likeCount,13+connection);
    controller.abort();
  }
});
