"use strict";
const WebSocket=require("ws");
const {EventEmitter}=require("node:events");
class TwitchAdapter extends EventEmitter{
  constructor(){super();this.platform="twitch";this.ws=null;this.config={};this.connected=false;this.connectTimer=null;}
  status(){return{platform:this.platform,connected:this.connected,configured:Boolean(this.config.channel&&this.config.token),channel:this.config.channel||""};}
  emitStatus(extra={}){this.emit("status",{...this.status(),...extra});}
  async connect(config={}){
    await this.disconnect();
    const channel=String(config.channel||"").trim().replace(/^#/,"").toLowerCase();
    const token=String(config.token||"").trim().replace(/^oauth:/i,"");
    const username=String(config.username||channel||"batto_reader").trim().toLowerCase();
    if(!channel||!token)throw new Error("Twitch-Konto oder Kanal ist nicht vollständig eingerichtet.");
    this.config={channel,token,username};
    this.ws=new WebSocket("wss://irc-ws.chat.twitch.tv:443",{handshakeTimeout:10000});
    return new Promise((resolve,reject)=>{
      let settled=false;
      const fail=e=>{const err=e instanceof Error?e:new Error(String(e));this.emitStatus({error:err.message});if(!settled){settled=true;clearTimeout(this.connectTimer);reject(err)}};
      this.connectTimer=setTimeout(()=>fail(new Error("Zeitüberschreitung beim Verbinden mit Twitch Chat.")),12000);
      this.ws.on("open",()=>{this.ws.send(`PASS oauth:${token}`);this.ws.send(`NICK ${username}`);this.ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");this.ws.send(`JOIN #${channel}`)});
      this.ws.on("message",data=>{for(const line of String(data).split(/\r?\n/).filter(Boolean))this.handleLine(line);if(this.connected&&!settled){settled=true;clearTimeout(this.connectTimer);resolve(this.status())}});
      this.ws.on("error",fail);
      this.ws.on("close",()=>{clearTimeout(this.connectTimer);this.connected=false;this.emitStatus()});
      this.emitStatus({connecting:true});
    });
  }
  handleLine(line){
    if(line.startsWith("PING")){this.ws?.send("PONG :tmi.twitch.tv");return;}
    if(line.includes(" NOTICE * :Login authentication failed")||line.includes(" NOTICE * :Improperly formatted auth")){this.emitStatus({error:"Twitch-Anmeldung wurde vom IRC-Server abgelehnt. Bitte Twitch neu anmelden."});return;}
    if(line.includes(" 001 ")||line.includes(` JOIN #${this.config.channel}`)){this.connected=true;this.emitStatus();return;}
    if(!line.includes(" PRIVMSG #"))return;
    const tagText=line.startsWith("@")?line.slice(1,line.indexOf(" ")):"";
    const tags=Object.fromEntries(tagText.split(";").filter(Boolean).map(part=>{const [k,...r]=part.split("=");return[k,r.join("=")]}));
    const bodyIndex=line.indexOf(" :",line.indexOf(" PRIVMSG "));if(bodyIndex<0)return;
    const message=line.slice(bodyIndex+2),prefixStart=line.indexOf(" :")+2,prefixEnd=line.indexOf("!",prefixStart);
    const username=tags["display-name"]||line.slice(prefixStart,prefixEnd>prefixStart?prefixEnd:bodyIndex);
    const badges=String(tags.badges||"").split(",").filter(Boolean).map(x=>x.split("/")[0]);
    this.connected=true;this.emitStatus();
    this.emit("message",{platform:"twitch",username,userId:tags["user-id"]||"",message,color:tags.color||"#9146ff",badges,role:badges.includes("broadcaster")?"broadcaster":badges.includes("moderator")?"moderator":badges.includes("vip")?"vip":"",eventType:"chat",metadata:{channel:this.config.channel,rawTags:tags,msgId:tags.id||""}});
  }
  async send(message){
    message=String(message||"").replace(/[\r\n]+/g," ").trim();
    if(!message)throw new Error("Twitch-Nachricht ist leer.");
    if(!this.connected||!this.ws||this.ws.readyState!==WebSocket.OPEN)throw new Error("Twitch Chat ist nicht verbunden.");
    if(Buffer.byteLength(message,"utf8")>450)throw new Error("Twitch-Nachricht ist zu lang.");
    await new Promise((resolve,reject)=>this.ws.send(`PRIVMSG #${this.config.channel} :${message}`,e=>e?reject(e):resolve()));
    return{ok:true,platform:"twitch",channel:this.config.channel};
  }
  async disconnect(){clearTimeout(this.connectTimer);this.connectTimer=null;const ws=this.ws;this.ws=null;this.connected=false;if(ws)try{ws.close(1000,"BATTO disconnect")}catch{}this.emitStatus();return this.status()}
}
module.exports={TwitchAdapter};
