"use strict";
const { BaseAdapter } = require("../base-adapter.cjs");
class TikTokAdapter extends BaseAdapter {
  constructor(){ super("tiktok"); this.client=null; this.username=""; }
  async connect(config={}){
    await this.disconnect();
    this.username=String(config.username||config.uniqueId||"").trim().replace(/^@/,"");
    this.configured=Boolean(this.username);
    if(!this.username)throw new Error("TikTok LIVE benötigt einen @Username.");
    let Connector;
    try{ const mod=await import("tiktok-live-connector"); Connector=mod.TikTokLiveConnection||mod.default?.TikTokLiveConnection||mod.default; }
    catch{ throw new Error("tiktok-live-connector ist nicht verfügbar."); }
    this.client=new Connector(this.username);
    this.client.on?.("chat",d=>this.emit("message",{username:d?.nickname||d?.uniqueId||"TikTok User",userId:d?.userId||"",avatar:d?.profilePictureUrl||"",message:d?.comment||"",role:d?.isModerator?"moderator":d?.isSubscriber?"subscriber":"",badges:d?.userBadges||[],eventType:"chat",metadata:d}));
    for(const event of ["gift","like","member","social","subscribe"]) this.client.on?.(event,d=>this.emit("message",{username:d?.nickname||d?.uniqueId||"TikTok User",userId:d?.userId||"",avatar:d?.profilePictureUrl||"",message:event==="gift"?`${d?.giftName||"Geschenk"}${d?.repeatCount?` ×${d.repeatCount}`:""}`:event,eventType:event,metadata:d}));
    this.client.on?.("connected",()=>{this.connected=true;this.emitStatus();});
    this.client.on?.("disconnected",()=>{this.connected=false;this.emitStatus();});
    await this.client.connect(); this.connected=true; this.emitStatus(); return this.status();
  }
  async disconnect(){ try{await this.client?.disconnect?.();}catch{} this.client=null; this.connected=false; this.emitStatus(); return this.status(); }
}
module.exports={TikTokAdapter};
