"use strict";
const WebSocket=require("ws");
const {EventEmitter}=require("node:events");
class CngAdapter extends EventEmitter{
  constructor(){super();this.platform="cng";this.ws=null;this.config={};this.connected=false;}
  status(){return{platform:this.platform,connected:this.connected,configured:Boolean(this.config.websocketUrl),transport:this.config.websocketUrl?"websocket":"not-configured"};}
  emitStatus(extra={}){this.emit("status",{...this.status(),...extra});}
  async connect(config={}){await this.disconnect();this.config={websocketUrl:String(config.websocketUrl||"").trim(),token:String(config.token||"").trim()};if(!this.config.websocketUrl){this.emitStatus({error:"CNG-Realtime-Endpunkt ist noch nicht konfiguriert."});return this.status();}const url=new URL(this.config.websocketUrl);if(this.config.token&&!url.searchParams.has("token"))url.searchParams.set("token",this.config.token);this.ws=new WebSocket(url.toString());return new Promise((resolve,reject)=>{let settled=false;this.ws.on("open",()=>{this.connected=true;this.emitStatus();if(!settled){settled=true;resolve(this.status())}});this.ws.on("message",raw=>this.handle(raw));this.ws.on("error",e=>{this.emitStatus({error:String(e.message||e)});if(!settled){settled=true;reject(e)}});this.ws.on("close",()=>{this.connected=false;this.emitStatus()})});}
  handle(raw){let data;try{data=JSON.parse(String(raw))}catch{return}const source=data.message||data.data||data;const text=source.text??source.message??source.comment??"";if(!text)return;this.emit("message",{platform:"cng",username:source.displayName||source.username||source.user?.name||"CNG User",userId:String(source.userId||source.user?.id||""),avatar:source.avatar||source.user?.avatar||"",message:String(text),role:source.role||"",badges:source.badges||[],eventType:source.eventType||"chat",metadata:data});}
  async disconnect(){if(this.ws)try{this.ws.close()}catch{}this.ws=null;this.connected=false;this.emitStatus();return this.status()}
}
module.exports={CngAdapter};
