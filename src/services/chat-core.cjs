"use strict";
const { EventEmitter } = require("node:events");
function cloneObject(value){if(!value||typeof value!=="object")return null;try{return structuredClone(value)}catch{try{return JSON.parse(JSON.stringify(value))}catch{return value}}}
class ChatCore extends EventEmitter{
  constructor(){super();this.messages=[];this.statuses={twitch:{connected:false},cng:{connected:false},tiktok:{connected:false},youtube:{connected:false}};}
  normalize(input={}){
    const metadata=input.metadata&&typeof input.metadata==="object"?input.metadata:{};
    return{
      id:String(input.id||`${Date.now()}-${Math.random().toString(36).slice(2)}`),platform:String(input.platform||"unknown").toLowerCase(),
      userId:String(input.userId||""),username:String(input.username||"Unbekannt"),displayName:String(input.displayName||input.username||"Unbekannt"),avatar:String(input.avatar||""),
      roles:Array.isArray(input.roles)?input.roles:[],badges:Array.isArray(input.badges)?input.badges:[],role:String(input.role||""),message:String(input.message||""),timestamp:Number(input.timestamp||Date.now()),eventType:String(input.eventType||"chat"),
      commentMsgId:String(input.commentMsgId||input.messageId||metadata?.common?.msgId||metadata?.msgId||""),
      gift:cloneObject(input.gift),battle:cloneObject(input.battle),
      metrics:{likeCount:Number(input.likeCount??metadata.likeCount??metadata.like_count??0)||0,totalLikeCount:Number(input.totalLikeCount??metadata.totalLikeCount??metadata.total_like_count??0)||0,viewerCount:Number(input.viewerCount??metadata.viewerCount??metadata.viewer_count??metadata.userCount??0)||0},
      metadata
    };
  }
  push(input){const msg=this.normalize(input);this.messages.push(msg);if(this.messages.length>1000)this.messages.splice(0,this.messages.length-1000);this.emit("messages",[msg]);return msg;}
  history(limit=300){return this.messages.slice(-Math.max(1,Math.min(1000,Number(limit)||300)));}
  clear(platform="all"){this.messages=platform==="all"?[]:this.messages.filter(m=>m.platform!==platform);return true;}
  setStatus(platform,status={}){this.statuses[platform]={...this.statuses[platform],...status};this.emit("status",{platform,...this.statuses[platform]});}
}
module.exports={ChatCore};
