"use strict";
const { EventEmitter } = require("node:events");

class ChatCore extends EventEmitter {
  constructor(){ super(); this.messages=[]; this.statuses={twitch:{connected:false},cng:{connected:false},tiktok:{connected:false},youtube:{connected:false}}; }
  normalize(input={}){
    return {
      id:String(input.id||`${Date.now()}-${Math.random().toString(36).slice(2)}`),
      platform:String(input.platform||"unknown").toLowerCase(),
      userId:String(input.userId||""), username:String(input.username||"Unbekannt"), displayName:String(input.displayName||input.username||"Unbekannt"),
      avatar:String(input.avatar||""), roles:Array.isArray(input.roles)?input.roles:[], badges:Array.isArray(input.badges)?input.badges:[], role:String(input.role||""),
      message:String(input.message||""), timestamp:Number(input.timestamp||Date.now()), eventType:String(input.eventType||"chat"), metadata:input.metadata||{}
    };
  }
  push(input){ const msg=this.normalize(input); this.messages.push(msg); if(this.messages.length>1000)this.messages.splice(0,this.messages.length-1000); this.emit("messages",[msg]); return msg; }
  history(limit=300){ return this.messages.slice(-Math.max(1,Math.min(1000,Number(limit)||300))); }
  clear(platform="all"){ this.messages=platform==="all"?[]:this.messages.filter(m=>m.platform!==platform); return true; }
  setStatus(platform,status={}){ this.statuses[platform]={...this.statuses[platform],...status}; this.emit("status",{platform,...this.statuses[platform]}); }
}
module.exports={ChatCore};
