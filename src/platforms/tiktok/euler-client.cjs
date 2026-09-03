"use strict";
const API="https://tiktok.eulerstream.com";
class EulerClient{
  constructor({oauth,apiKeyProvider=null}={}){this.oauth=oauth;this.apiKeyProvider=apiKeyProvider;}
  async request(pathname,{method="GET",query,body,oauth=true}={}){
    const url=new URL(pathname,API);for(const[k,v]of Object.entries(query||{}))if(v!==undefined&&v!==null&&v!=="")url.searchParams.set(k,String(v));
    const headers={"Content-Type":"application/json"};
    if(oauth){const token=await this.oauth.accessToken();if(!token)throw new Error("TikTok/Euler ist nicht angemeldet.");headers["x-oauth-token"]=token;}
    else{const apiKey=String(await this.apiKeyProvider?.()||"").trim();if(apiKey)headers["X-Api-Key"]=apiKey;}
    const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json().catch(()=>({}));
    if(!response.ok||Number(data?.code||200)>=400)throw new Error(data?.error?.error_description||data?.error_description||data?.message||`Euler HTTP ${response.status}`);return data;
  }
  roomId(uniqueId){return this.request(`/webcast/anchors/${encodeURIComponent(String(uniqueId).replace(/^@/,""))}/room_id`,{oauth:false});}
  roomInfo(uniqueId){return this.request(`/webcast/anchors/${encodeURIComponent(String(uniqueId).replace(/^@/,""))}/room_info`,{oauth:false});}
  userId(uniqueId){return this.request(`/webcast/anchors/${encodeURIComponent(String(uniqueId).replace(/^@/,""))}/user_id`,{oauth:false});}
  userBasic(uniqueId){return this.request(`/tiktok/users/${encodeURIComponent(String(uniqueId).replace(/^@/,""))}/basic`,{oauth:false});}
  sendChat(roomId,message){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/chat`,{method:"POST",query:{message:String(message)}});}
  gifts({pageSize=100,pageNumber=1,orderBy,ascending=true}={}){return this.request("/webcast/gifts/catalog",{query:{pageSize,pageNumber,orderBy,ascending},oauth:false});}
  gift(id){return this.request(`/webcast/gifts/catalog/${encodeURIComponent(id)}`,{oauth:false});}
  searchGifts(query){return this.request("/webcast/gifts/catalog/search",{method:"POST",query:{query:String(query)},oauth:false});}
  roomGifts(roomId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/gifts`);}
  giftGallery(uniqueId,webcast_language="de"){return this.request(`/webcast/anchors/${encodeURIComponent(String(uniqueId).replace(/^@/,""))}/gift_gallery`,{query:{webcast_language}});}
  earnings(uniqueId,period="30d"){return this.request(`/webcast/anchors/${encodeURIComponent(String(uniqueId).replace(/^@/,""))}/earnings`,{query:{period}});}
  myRooms({count=20,offset=0}={}){return this.request("/webcast/anchors/me/rooms",{query:{count,offset}});}
  roomDetails(roomId){return this.request(`/webcast/anchors/me/rooms/${encodeURIComponent(roomId)}/details`);}
  roomInteractions(roomId,userId){return this.request(`/webcast/anchors/me/rooms/${encodeURIComponent(roomId)}/interactions`,{query:{user_id:userId}});}
  scheduledEvents(anchorId,page=0){return this.request(`/webcast/events/anchors/${encodeURIComponent(anchorId)}`,{query:{page}});}
  muted(roomId,page=0){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/mutes`,{query:{page}});}
  mute(roomId,userId,duration,commentMsgId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/mutes`,{method:"PUT",query:{user_id:userId,duration,comment_msg_id:commentMsgId}});}
  unmute(roomId,userId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/mutes`,{method:"DELETE",query:{user_id:userId}});}
  banned(roomId,page=0){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/bans`,{query:{page}});}
  ban(roomId,userId,commentMsgId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/bans`,{method:"PUT",query:{tiktok_user_id:userId,comment_msg_id:commentMsgId}});}
  unban(roomId,userId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/bans`,{method:"DELETE",query:{tiktok_user_id:userId}});}
  moderators(anchorId){return this.request(`/webcast/anchors/${encodeURIComponent(anchorId)}/moderation/moderators`);}
  addModerator(anchorId,userId){return this.request(`/webcast/anchors/${encodeURIComponent(anchorId)}/moderation/moderators`,{method:"PUT",query:{to_user_id:userId}});}
  removeModerator(anchorId,userId){return this.request(`/webcast/anchors/${encodeURIComponent(anchorId)}/moderation/moderators`,{method:"DELETE",query:{to_user_id:userId}});}
  toggleComments(roomId,enabled){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/toggle_comments`,{method:"POST",query:{enabled:Boolean(enabled)}});}
  sensitiveWords(roomId,secAnchorId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/sensitive-words`,{query:{sec_anchor_id:secAnchorId}});}
  addSensitiveWord(roomId,word,secAnchorId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/sensitive-words`,{method:"POST",query:{word:String(word),sec_anchor_id:secAnchorId}});}
  deleteSensitiveWord(roomId,wordId,secAnchorId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/sensitive-words`,{method:"DELETE",query:{word_id:String(wordId),sec_anchor_id:secAnchorId}});}
}
module.exports={EulerClient};
