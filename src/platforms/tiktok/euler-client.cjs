"use strict";
const API="https://tiktok.eulerstream.com";
class EulerClient{
  constructor({oauth}={}){this.oauth=oauth;}
  async request(pathname,{method="GET",query,body}={}){const token=await this.oauth.accessToken();if(!token)throw new Error("TikTok/Euler ist nicht angemeldet.");const url=new URL(pathname,API);for(const [k,v] of Object.entries(query||{}))if(v!==undefined&&v!==null&&v!=="")url.searchParams.set(k,String(v));const response=await fetch(url,{method,headers:{"x-oauth-token":token,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error_description||`Euler HTTP ${response.status}`);return data;}
  roomId(uniqueId){return this.request(`/webcast/anchors/${encodeURIComponent(String(uniqueId).replace(/^@/,""))}/room_id`);}
  userId(uniqueId){return this.request(`/webcast/anchors/${encodeURIComponent(String(uniqueId).replace(/^@/,""))}/user_id`);}
  sendChat(roomId,message){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/chat`,{method:"POST",body:{message:String(message)}});}
  gifts(){return this.request("/webcast/gifts/catalog");}
  gift(id){return this.request(`/webcast/gifts/catalog/${encodeURIComponent(id)}`);}
  searchGifts(query){return this.request("/webcast/gifts/catalog/search",{method:"POST",body:{query:String(query)}});}
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
  sensitiveWords(roomId){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/sensitive-words`);}
  addSensitiveWord(roomId,word){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/sensitive-words`,{method:"POST",body:{word:String(word)}});}
  deleteSensitiveWord(roomId,word){return this.request(`/webcast/rooms/${encodeURIComponent(roomId)}/moderation/sensitive-words`,{method:"DELETE",query:{word:String(word)}});}
}
module.exports={EulerClient};
