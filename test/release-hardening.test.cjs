"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {sendChat,eulerApiKeyRequest}=require("../src/runtime/release-hardening.cjs");
const {TwitchAdapter}=require("../src/platforms/twitch/twitch-adapter.cjs");
const {YouTubeAdapter}=require("../src/platforms/youtube/youtube-adapter.cjs");

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
