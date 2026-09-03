"use strict";
const WebSocket=require("ws");
class ObsWebSocketService{
  constructor(){this.socket=null;this.connected=false;this.url="ws://127.0.0.1:4455";}
  status(){return{connected:this.connected,url:this.url};}
  async connect({url,password}={}){
    this.url=String(url||this.url);
    await this.disconnect();
    return await new Promise((resolve,reject)=>{
      const ws=new WebSocket(this.url); this.socket=ws;
      const timer=setTimeout(()=>{try{ws.terminate()}catch{};reject(new Error("OBS WebSocket Zeitüberschreitung."));},5000);
      ws.on("open",()=>{});
      ws.on("message",raw=>{
        try{
          const msg=JSON.parse(String(raw));
          if(msg.op===0){
            const identify={op:1,d:{rpcVersion:1}};
            if(password)identify.d.authentication=password;
            ws.send(JSON.stringify(identify));
          }else if(msg.op===2){clearTimeout(timer);this.connected=true;resolve(this.status());}
        }catch{}
      });
      ws.on("error",e=>{clearTimeout(timer);this.connected=false;reject(e);});
      ws.on("close",()=>{this.connected=false;});
    });
  }
  async disconnect(){if(this.socket){try{this.socket.close()}catch{}}this.socket=null;this.connected=false;return this.status();}
}
module.exports={ObsWebSocketService};
