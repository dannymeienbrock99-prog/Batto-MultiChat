"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {CngBrowserTools}=require("../src/services/cng-browser-tools.cjs");

function fixture(){
  const data={accounts:{cng:{creatorId:"210048",alertTts:true,chatTts:false}}};
  const secrets=new Map([["cng.obsChatToken","secret-token"]]);
  const runtime={
    settings:{get:async k=>data[k],set:async(k,v)=>{data[k]=v}},
    secrets:{get:async k=>secrets.get(k)||"",set:async(k,v)=>secrets.set(k,v),delete:async k=>secrets.delete(k)},
    obs:{ensureOverlaySource:async v=>v}
  };
  return new CngBrowserTools({runtime,ipcMain:{handle(){}},shell:{openExternal:async()=>true},clipboard:{writeText(){}}});
}

test("CNG status leaks no OBS chat token",async()=>{
  const cng=fixture();const status=await cng.status();
  assert.equal(status.creatorId,"210048");
  assert.equal(status.hasToken,true);
  assert.equal(Object.hasOwn(status,"obsChatToken"),false);
});

test("CNG builds official alert and chat-popout URL shapes",async()=>{
  const cng=fixture();const urls=await cng.urls();
  const alert=new URL(urls.alertUrl),chat=new URL(urls.chatUrl);
  assert.equal(alert.hostname,"cng-plattform.com");
  assert.equal(alert.pathname,"/alert-overlay");
  assert.equal(alert.searchParams.get("creatorId"),"210048");
  assert.equal(alert.searchParams.get("alertTts"),"1");
  assert.equal(alert.searchParams.get("chatTts"),"0");
  assert.equal(chat.pathname,"/chat-popout/210048");
  assert.equal(chat.searchParams.get("mode"),"obs");
  assert.equal(chat.searchParams.get("obsChatToken"),"secret-token");
});
