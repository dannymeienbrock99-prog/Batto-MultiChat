"use strict";
const { BaseAdapter } = require("../base-adapter.cjs");

function first(...values){return values.find(v=>v!==undefined&&v!==null&&v!=="")}
function userFrom(data={}){
  const u=data.user||data.userInfo||{};
  return{
    username:first(u.uniqueId,u.unique_id,data.uniqueId,data.unique_id,u.nickname,data.nickname,"TikTok User"),
    displayName:first(u.nickname,data.nickname,u.uniqueId,data.uniqueId,"TikTok User"),
    userId:String(first(u.userId,u.user_id,u.id,data.userId,data.user_id,"")),
    avatar:first(u.profilePictureUrl,u.avatarThumb?.urlList?.[0],u.avatar_medium?.url_list?.[0],data.profilePictureUrl,data.avatarUrl,""),
    role:(u.isModerator||data.isModerator)?"moderator":(u.isSubscriber||data.isSubscriber)?"subscriber":"",
    badges:first(u.userBadges,data.userBadges,[])||[]
  };
}
function giftFrom(data={}){
  const ext=data.extendedGiftInfo||data.giftDetails||data.gift||{};
  const id=Number(first(data.giftId,data.gift_id,ext.id,0))||0;
  const name=String(first(data.giftName,ext.name,ext.title,`Gift ${id||""}`)).trim();
  const repeatCount=Number(first(data.repeatCount,data.repeat_count,data.comboCount,1))||1;
  const diamondCount=Number(first(data.diamondCount,data.diamond_count,ext.diamondCount,ext.diamond_count,0))||0;
  const repeatEnd=Boolean(first(data.repeatEnd,data.repeat_end,data.isFinalRepeat,data.is_final_repeat,false));
  const image=first(ext.image?.urlList?.[0],ext.image?.url_list?.[0],ext.imageUrl,ext.image_url,data.giftPictureUrl,data.gift_image_url,"");
  return{giftId:id,giftName:name,repeatCount,diamondCount,repeatEnd,imageUrl:image,totalDiamonds:diamondCount*repeatCount};
}

class TikTokAdapter extends BaseAdapter{
  constructor({getApiKey=null}={}){super("tiktok");this.client=null;this.username="";this.getApiKey=getApiKey;this.roomId="";}
  async connect(config={}){
    await this.disconnect();
    this.username=String(config.username||config.uniqueId||"").trim().replace(/^@/,"");
    this.configured=Boolean(this.username);
    if(!this.username)throw new Error("TikTok LIVE benötigt einen @Username.");
    const signApiKey=String(config.signApiKey||await this.getApiKey?.()||"").trim();
    let mod;
    try{mod=await import("tiktok-live-connector");}catch(error){throw new Error(`tiktok-live-connector ist nicht verfügbar: ${error.message}`)}
    const Connector=mod.TikTokLiveConnection||mod.default?.TikTokLiveConnection;
    if(typeof Connector!=="function")throw new Error("Die installierte TikTok-Live-Connector-Version stellt TikTokLiveConnection nicht bereit.");
    const options={processInitialData:true,fetchRoomInfoOnConnect:true,enableExtendedGiftInfo:true};
    if(signApiKey)options.signApiKey=signApiKey;
    this.client=new Connector(this.username,options);
    const on=(name,handler)=>{try{this.client.on?.(name,handler)}catch{}}
    on("connected",state=>{this.roomId=String(first(state?.roomId,state?.room_id,this.client?.roomId,""));this.connected=true;this.emitStatus({roomId:this.roomId});});
    on("disconnected",()=>{this.connected=false;this.emitStatus({roomId:this.roomId});});
    on("streamEnd",()=>{this.connected=false;this.emitStatus({roomId:this.roomId,streamEnded:true});});
    on("chat",data=>{const u=userFrom(data);this.emit("message",{...u,message:String(first(data.comment,data.message,"")),eventType:"chat",commentMsgId:String(first(data.msgId,data.messageId,data.common?.msgId,"")),metadata:data});});
    on("gift",data=>{const u=userFrom(data),gift=giftFrom(data);this.emit("message",{...u,message:`${gift.giftName}${gift.repeatCount>1?` ×${gift.repeatCount}`:""}`,eventType:"gift",gift,metadata:data});});
    for(const name of ["like","member","share","follow","social","subscribe","roomUser"])on(name,data=>{const u=userFrom(data);this.emit("message",{...u,message:name,eventType:name,metadata:data});});
    try{
      const state=await this.client.connect();
      this.roomId=String(first(state?.roomId,state?.room_id,this.client?.roomId,""));
      this.connected=true;this.emitStatus({roomId:this.roomId});return this.status();
    }catch(error){this.connected=false;this.emitStatus({error:String(error?.message||error)});await this.disconnect();throw new Error(`TikTok LIVE Verbindung fehlgeschlagen: ${error?.message||error}`)}
  }
  status(){return{...super.status(),username:this.username,roomId:this.roomId};}
  async disconnect(){try{await this.client?.disconnect?.()}catch{}this.client=null;this.connected=false;this.emitStatus();return this.status();}
}
module.exports={TikTokAdapter,userFrom,giftFrom};
