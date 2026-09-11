"use strict";
const {hex,twitchColors}=require("../../shared/chat-appearance.js");
const COLOR_SCOPE="user:manage:chat_color";

class TwitchChatColor{
  constructor({oauth,fetchImpl=(...args)=>fetch(...args)}){this.oauth=oauth;this.fetch=fetchImpl;}
  async authorize(){
    const status=await this.oauth.status();
    return this.oauth.begin({scopes:[...new Set(["chat:read","chat:edit",...(status.scopes||[]),COLOR_SCOPE])]});
  }
  async request(url,options={}){
    try{return await this.fetch(url,{...options,signal:AbortSignal.timeout(15000)});}
    catch{throw new Error("Twitch ist gerade nicht erreichbar. Bitte erneut versuchen.");}
  }
  async session(manage=false){
    const token=await this.oauth.accessToken();
    if(!token)throw new Error("Bitte zuerst Twitch-Farben freigeben und dich anmelden.");
    // Derive identity and Client-Id from the exact token used for the request.
    // Neither an arbitrary user ID nor a token is accepted from the renderer.
    const response=await this.request("https://id.twitch.tv/oauth2/validate",{headers:{Authorization:`OAuth ${token}`}});
    if(!response.ok)throw new Error("Twitch-Anmeldung ungültig. Bitte Twitch-Farben erneut freigeben.");
    const data=await response.json().catch(()=>({}));
    if(!/^\d+$/.test(data.user_id||"")||!data.client_id)throw new Error("Twitch hat kein gültiges Benutzerkonto bestätigt. Bitte erneut anmelden.");
    const canUpdate=Array.isArray(data.scopes)&&data.scopes.includes(COLOR_SCOPE);
    if(manage&&!canUpdate)throw new Error("Die Berechtigung für Chatfarben fehlt. Bitte zuerst „Twitch-Farben freigeben“ wählen.");
    return {token,userId:data.user_id,clientId:data.client_id,username:String(data.login||data.user_id),canUpdate};
  }
  headers(session){return {Authorization:`Bearer ${session.token}`,"Client-Id":session.clientId};}
  responseError(status,custom=false){
    if(status===401||status===403)return new Error("Twitch hat die Änderung nicht erlaubt. Bitte Twitch-Farben erneut freigeben.");
    if(status===429)return new Error("Zu viele Twitch-Anfragen. Bitte kurz warten und erneut versuchen.");
    if(status===400&&custom)return new Error("Twitch hat diese Hex-Farbe abgelehnt. Freie Hex-Farben benötigen Prime oder Turbo; wähle sonst eine Standardfarbe.");
    return new Error(`Twitch konnte die Chatfarbe nicht verarbeiten (HTTP ${status}).`);
  }
  async get(){
    const session=await this.session();
    const query=new URLSearchParams({user_id:session.userId});
    const response=await this.request(`https://api.twitch.tv/helix/chat/color?${query}`,{headers:this.headers(session)});
    if(!response.ok)throw this.responseError(response.status);
    const data=await response.json().catch(()=>({}));
    const user=data.data?.find(item=>item.user_id===session.userId);
    if(!user)throw new Error("Twitch hat die eigene Chatfarbe nicht zurückgegeben. Bitte erneut laden.");
    return {userId:session.userId,username:session.username,displayName:String(user.user_name||session.username),color:hex(user.color),canUpdate:session.canUpdate};
  }
  async set(input){
    const value=typeof input==="string"?input.trim().toLowerCase():"";
    const color=Object.hasOwn(twitchColors,value)?value:hex(value);
    if(!color)throw new Error("Bitte eine Twitch-Standardfarbe oder einen gültigen Hex-Wert wählen.");
    const session=await this.session(true);
    const query=new URLSearchParams({user_id:session.userId,color});
    const response=await this.request(`https://api.twitch.tv/helix/chat/color?${query}`,{method:"PUT",headers:this.headers(session)});
    if(response.status!==204)throw this.responseError(response.status,color.startsWith("#"));
    return {userId:session.userId,username:session.username,color:hex(color)||twitchColors[color][1],canUpdate:true};
  }
}
module.exports={TwitchChatColor,COLOR_SCOPE};
