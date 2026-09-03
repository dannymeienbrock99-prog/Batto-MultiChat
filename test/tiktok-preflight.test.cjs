"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {tikTokPreflight,saveEulerApiKey}=require("../src/runtime/release-hardening.cjs");

function runtimeFixture({key="",room={is_live:true,room_id:"123"}}={}){
  const secrets=new Map(key?[["euler.apiKey",key]]:[]);
  return{
    context:{username:"",roomId:"",isLive:false},
    secrets:{available:()=>true,get:async k=>secrets.get(k)||"",set:async(k,v)=>secrets.set(k,v),delete:async k=>secrets.delete(k)},
    euler:{roomId:async()=>room}
  };
}

test("TikTok preflight stops before connector when Euler API key is missing",async()=>{
  const runtime=runtimeFixture();
  await assert.rejects(()=>tikTokPreflight(runtime,{username:"crazy_batto"}),/API-Key fehlt/);
});

test("TikTok preflight reports account not LIVE instead of connector room-id error",async()=>{
  const runtime=runtimeFixture({key:"euler_test",room:{is_live:false,room_id:""}});
  await assert.rejects(()=>tikTokPreflight(runtime,{username:"crazy_batto"}),/derzeit nicht als TikTok LIVE erkannt/);
});

test("TikTok preflight returns room id for live account",async()=>{
  const runtime=runtimeFixture({key:"euler_test",room:{is_live:true,room_id:"987654"}});
  const result=await tikTokPreflight(runtime,{username:"crazy_batto"});
  assert.equal(result.roomId,"987654");
  assert.equal(runtime.context.isLive,true);
});

test("Euler API key save verifies secure readback",async()=>{
  const runtime=runtimeFixture();
  const result=await saveEulerApiKey(runtime,"euler_example");
  assert.equal(result.configured,true);
  assert.equal(await runtime.secrets.get("euler.apiKey"),"euler_example");
});
