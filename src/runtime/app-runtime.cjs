"use strict";
const path=require("node:path");
const {ChatWindowManager}=require("../services/chat-window-manager.cjs");
const {ChatCore}=require("../services/chat-core.cjs");
const {PlatformManager}=require("../services/platform-manager.cjs");
const {TikTokAdapter}=require("../platforms/tiktok/tiktok-adapter.cjs");
const {TwitchAdapter}=require("../platforms/twitch/twitch-adapter.cjs");
const {YouTubeAdapter}=require("../platforms/youtube/youtube-adapter.cjs");
const {CngAdapter}=require("../platforms/cng/cng-adapter.cjs");
const {ObsWebSocketService}=require("../services/obs-websocket.cjs");
const {StreamOverlayServer}=require("../services/stream-overlay-server.cjs");
const {HologramServer}=require("../services/hologram-server.cjs");
const {SecretStore}=require("../storage/secret-store.cjs");
const {SettingsStore}=require("../storage/settings-store.cjs");
const {EulerOAuth,DEFAULT_SCOPES}=require("../platforms/tiktok/euler-oauth.cjs");
const {EulerClient}=require("../platforms/tiktok/euler-client.cjs");
const {TwitchOAuth}=require("../platforms/twitch/twitch-oauth.cjs");
const {YouTubeOAuth}=require("../platforms/youtube/youtube-oauth.cjs");

const DEFAULT_SETTINGS={
  accounts:{tiktok:{username:""},twitch:{},youtube:{},cng:{websocketUrl:""}},
  obs:{url:"ws://127.0.0.1:4455"},
  tiktokOAuth:{clientId:"",redirectUri:"http://127.0.0.1:48731/oauth/tiktok/callback",scopes:DEFAULT_SCOPES},
  tiktokSession:{},twitchOAuth:{clientId:"",redirectUri:"http://127.0.0.1:48732/oauth/twitch/callback",scopes:["chat:read","chat:edit"]},twitchSession:{},
  youtubeOAuth:{clientId:"",redirectUri:"http://127.0.0.1:48733",scopes:["https://www.googleapis.com/auth/youtube.readonly"]},youtubeSession:{},
  tts:{enabled:false,language:"de-DE",rate:1,pitch:1,volume:1,platforms:["twitch","cng","tiktok","youtube"]}
};

const GIFT_TEST_FALLBACKS={
  "rosennebel":{giftId:8912,giftName:"Rosennebel",diamondCount:15000,imageUrl:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/f722088231103b66875dae33f13f8719.png~tplv-obj.webp"},
  "rosa nebula":{giftId:8912,giftName:"Rosennebel",diamondCount:15000,imageUrl:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/f722088231103b66875dae33f13f8719.png~tplv-obj.webp"},
  "löwe":{giftId:6369,giftName:"Löwe",diamondCount:29999,imageUrl:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4fb89af2082a290b37d704e20f4fe729~tplv-obj.webp"},
  "lion":{giftId:6369,giftName:"Löwe",diamondCount:29999,imageUrl:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4fb89af2082a290b37d704e20f4fe729~tplv-obj.webp"},
  "universe":{giftId:9072,giftName:"TikTok Universe",diamondCount:44999,imageUrl:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8f471afbcebfda3841a6cc515e381f58~tplv-obj.webp"},
  "tiktok universe":{giftId:9072,giftName:"TikTok Universe",diamondCount:44999,imageUrl:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8f471afbcebfda3841a6cc515e381f58~tplv-obj.webp"}
};

function deepFindString(value,names,depth=0){if(depth>8||!value||typeof value!=="object")return"";for(const name of names){const found=value[name];if(typeof found==="string"&&found)return found;if(typeof found==="number"&&Number.isFinite(found))return String(found)}for(const child of Object.values(value)){const result=deepFindString(child,names,depth+1);if(result)return result}return""}
function firstGift(payload){const list=payload?.gifts||payload?.data?.gifts||payload?.response?.gifts||[];return Array.isArray(list)?list[0]:null}
function normalizeCatalogGift(gift={}){const raw=typeof gift.raw==="string"?(()=>{try{return JSON.parse(gift.raw)}catch{return{}}})():gift.raw||{};const names=gift.names||raw.names||{};return{giftId:Number(gift.id||gift.gift_id||gift.giftId||raw.id||0)||0,giftName:String(gift.name||gift.title||names.de||names.en||raw.name||raw.title||"TikTok Gift"),diamondCount:Number(gift.diamond_count||gift.diamondCount||raw.diamond_count||raw.diamondCount||0)||0,imageUrl:String(gift.image_url||gift.imageUrl||raw.image_url||raw.imageUrl||raw.image?.url_list?.[0]||"")}}

class AppRuntime{
  constructor({app,ipcMain,safeStorage,shell,clipboard}={}){Object.assign(this,{app,ipcMain,safeStorage,shell,clipboard});this.core=new ChatCore();this.platforms=new PlatformManager(this.core);this.obs=new ObsWebSocketService();this.context={username:"",roomId:"",anchorId:"",secAnchorId:"",isLive:false};}
  async start(){
    const userData=this.app.getPath("userData");
    this.settings=new SettingsStore(path.join(userData,"settings.json"),DEFAULT_SETTINGS);await this.settings.load();
    this.secrets=new SecretStore(path.join(userData,"secrets.dat"),this.safeStorage);
    this.eulerOAuth=new EulerOAuth({secretStore:this.secrets,settingsStore:this.settings,shell:this.shell});
    this.euler=new EulerClient({oauth:this.eulerOAuth,apiKeyProvider:()=>this.secrets.get("euler.apiKey")});
    this.twitchOAuth=new TwitchOAuth({secretStore:this.secrets,settingsStore:this.settings,shell:this.shell});
    this.youtubeOAuth=new YouTubeOAuth({secretStore:this.secrets,settingsStore:this.settings,shell:this.shell});
    this.platforms.register("tiktok",new TikTokAdapter({getApiKey:()=>this.secrets.get("euler.apiKey")}));
    this.platforms.register("twitch",new TwitchAdapter());
    this.platforms.register("youtube",new YouTubeAdapter({oauth:this.youtubeOAuth}));
    this.platforms.register("cng",new CngAdapter());
    const accounts=await this.settings.get("accounts");this.context.username=String(accounts?.tiktok?.username||"").replace(/^@/,"");
    this.streamOverlay=new StreamOverlayServer({webRoot:path.join(__dirname,"..","stream-overlay"),configFile:path.join(userData,"stream-overlay.json"),port:48621});
    this.hologram=new HologramServer({port:17821});
    try{await this.streamOverlay.start()}catch(error){console.error("Stream-Overlay konnte nicht gestartet werden:",error)}
    try{await this.hologram.start()}catch(error){console.error("Hologramm konnte nicht gestartet werden:",error)}
    this.windowManager=new ChatWindowManager({userDataFile:path.join(userData,"multichat-window.json"),preloadPath:path.join(__dirname,"..","preload.cjs"),rendererPath:path.join(__dirname,"..","renderer","multi-chat.html"),iconPath:path.join(__dirname,"..","..","resources","batto-icon.png"),onClosed:()=>{if(process.platform!=="darwin")this.app.quit()}});
    await this.windowManager.load();this.registerIpc();this.windowManager.create();
    this.core.on("messages",batch=>{this.windowManager?.window?.webContents.send("chat:messages",batch);for(const message of batch||[]){if(message.eventType&&message.eventType!=="chat")this.streamOverlay.pushEvent(message);else{this.streamOverlay.pushChat(message);this.hologram.push(message)}}});
    this.core.on("status",status=>this.windowManager?.window?.webContents.send("chat:status",status));
  }
  async stop(){await Promise.allSettled([this.streamOverlay?.stop?.(),this.hologram?.stop?.(),...Array.from(this.platforms.adapters?.values?.()||[]).map(a=>a.disconnect?.())]);}
  async resolveTikTokContext(username){
    username=String(username||this.context.username||"").trim().replace(/^@/,"");if(!username)throw new Error("TikTok @Username fehlt.");
    const [room,user,info]=await Promise.all([this.euler.roomId(username),this.euler.userId(username),this.euler.roomInfo(username)]);
    this.context.username=username;this.context.roomId=String(room?.room_id||room?.response?.room_id||"");this.context.isLive=Boolean(room?.is_live??room?.response?.is_live??this.context.roomId);
    this.context.anchorId=String(user?.numeric_user_id||user?.user_id||user?.response?.numeric_user_id||user?.response?.user_id||"");
    this.context.secAnchorId=deepFindString(info,["sec_uid","secUid","sec_user_id","secUserId"]);
    return{...this.context};
  }
  async connectTwitch(channel){const token=await this.twitchOAuth.accessToken();if(!token)throw new Error("Twitch ist nicht angemeldet.");const status=await this.twitchOAuth.status();channel=String(channel||status.profile?.channel||status.profile?.username||"").trim().replace(/^#/,"");if(!channel)throw new Error("Twitch-Kanal fehlt.");return this.platforms.connect("twitch",{channel,token,username:status.profile?.username||channel});}
  async giftTest(name){
    const key=String(name||"TikTok Universe").trim().toLowerCase();let gift=null,source="catalog";
    try{gift=normalizeCatalogGift(firstGift(await this.euler.searchGifts(name||"TikTok Universe"))||{})}catch{gift=null}
    if(!gift?.giftId){gift={...(GIFT_TEST_FALLBACKS[key]||GIFT_TEST_FALLBACKS["tiktok universe"])};source="test-fallback"}
    const event={platform:"tiktok",eventType:"gift",username:"BATTO-Test",displayName:"BATTO Gift Test",message:`${gift.giftName} ×1`,gift:{...gift,repeatCount:1,repeatEnd:true,totalDiamonds:gift.diamondCount},test:true,testSource:source};
    this.streamOverlay.pushEvent(event);return event;
  }
  async liveCenterSummary(){
    const username=this.context.username;if(!username)throw new Error("TikTok @Username fehlt.");const safe=async(fn)=>{try{return await fn()}catch(error){return{error:String(error?.message||error)}}};
    if(!this.context.roomId)await safe(()=>this.resolveTikTokContext(username));
    const [profile,roomInfo,gallery,rooms,earnings]=await Promise.all([safe(()=>this.euler.userBasic(username)),safe(()=>this.euler.roomInfo(username)),safe(()=>this.euler.giftGallery(username)),safe(()=>this.euler.myRooms({count:20,offset:0})),safe(()=>this.euler.earnings(username,"30d"))]);
    return{context:{...this.context},profile,roomInfo,giftGallery:gallery,recentLives:rooms,earnings};
  }
  registerIpc(){
    const h=(name,fn)=>this.ipcMain.handle(name,fn);
    h("chat:history",(_e,o={})=>this.core.history(o.limit));h("chat:clear",(_e,p="all")=>this.core.clear(p));h("chat:statuses",()=>this.platforms.statuses());
    h("chat:connect",async(_e,p,c={})=>{if(p==="tiktok"){const key=await this.secrets.get("euler.apiKey");if(!key)throw new Error("Euler Stream API-Key fehlt. Einmal unter TikTok → Verbindung eintragen.");c={...c,signApiKey:key}}const result=await this.platforms.connect(p,c);if(p==="tiktok"&&c.username){const accounts=await this.settings.get("accounts");accounts.tiktok={...(accounts.tiktok||{}),username:String(c.username)};await this.settings.set("accounts",accounts);this.context.username=String(c.username).replace(/^@/,"")}return result});
    h("chat:disconnect",(_e,p)=>this.platforms.disconnect(p));h("window:alwaysOnTop",()=>this.windowManager.toggleAlwaysOnTop());h("settings:get",()=>this.settings.get());h("settings:patch",(_e,v)=>this.settings.patch(v||{}));
    h("obs:status",()=>this.obs.status());h("obs:connect",async(_e,c={})=>{const password=String(c.password||await this.secrets.get("obs.password")||"");const r=await this.obs.connect({...c,password});await this.settings.set("obs",{url:c.url||"ws://127.0.0.1:4455"});if(c.password)await this.secrets.set("obs.password",c.password);return r});h("obs:disconnect",()=>this.obs.disconnect());h("obs:savedPassword",async()=>Boolean(await this.secrets.get("obs.password")));h("obs:scenes",()=>this.obs.scenes());h("obs:sceneItems",(_e,s)=>this.obs.sceneItems(s));h("obs:setScene",(_e,s)=>this.obs.setScene(s));h("obs:setItemEnabled",(_e,v)=>this.obs.setSceneItemEnabled(v.sceneName,v.sceneItemId,v.enabled));h("obs:ensureOverlay",(_e,v={})=>this.obs.ensureOverlaySource({...v,url:this.streamOverlay.status().overlayUrl}));h("obs:ensureHologram",(_e,v={})=>this.obs.ensureOverlaySource({...v,inputName:v.inputName||"BATTO Hologramm",url:this.hologram.status().url,width:v.width||1200,height:v.height||500}));
    h("overlay:status",()=>this.streamOverlay.status());h("overlay:open",()=>this.shell.openExternal(this.streamOverlay.status().overlayUrl));h("overlay:openEditor",()=>this.shell.openExternal(this.streamOverlay.status().editorUrl));h("overlay:copyUrl",()=>{const url=this.streamOverlay.status().overlayUrl;this.clipboard.writeText(url);return url});h("overlay:testChat",()=>{const m={platform:"tiktok",username:"Crazy_Batto",displayName:"Crazy_Batto",message:"BATTO MULTI-CHAT Overlay-Test",role:"moderator"};this.streamOverlay.pushChat(m);this.hologram.push(m);return true});h("overlay:testEvent",()=>this.giftTest("TikTok Universe"));h("overlay:testGift",(_e,name)=>this.giftTest(name));
    h("hologram:status",()=>this.hologram.status());h("hologram:open",()=>this.shell.openExternal(this.hologram.status().url));h("hologram:copyUrl",()=>{const url=this.hologram.status().url;this.clipboard.writeText(url);return url});
    h("tiktok:apiKeyStatus",async()=>({configured:Boolean(await this.secrets.get("euler.apiKey"))}));h("tiktok:setApiKey",async(_e,key)=>{key=String(key||"").trim();if(!key)throw new Error("Euler Stream API-Key fehlt.");await this.secrets.set("euler.apiKey",key);return{configured:true}});h("tiktok:clearApiKey",async()=>{await this.secrets.delete("euler.apiKey");return{configured:false}});
    h("tiktok:oauthStatus",()=>this.eulerOAuth.status());h("tiktok:oauthBegin",(_e,c={})=>this.eulerOAuth.begin(c));h("tiktok:oauthRefresh",()=>this.eulerOAuth.refresh());h("tiktok:oauthRevoke",()=>this.eulerOAuth.revoke());h("tiktok:resolveContext",(_e,u)=>this.resolveTikTokContext(u));h("tiktok:context",()=>({...this.context}));
    h("tiktok:gifts",(_e,o={})=>this.euler.gifts(o));h("tiktok:gift",(_e,id)=>this.euler.gift(id));h("tiktok:giftSearch",(_e,q)=>this.euler.searchGifts(q));h("tiktok:giftTest",(_e,name)=>this.giftTest(name));h("tiktok:giftTestPresets",()=>["Rosennebel","Löwe","TikTok Universe"]);
    h("tiktok:sendChat",async(_e,m)=>{if(!this.context.roomId)await this.resolveTikTokContext();return this.euler.sendChat(this.context.roomId,m)});h("tiktok:muted",async()=>{if(!this.context.roomId)await this.resolveTikTokContext();return this.euler.muted(this.context.roomId)});h("tiktok:mute",async(_e,{userId,duration,commentMsgId}={})=>{if(!this.context.roomId)await this.resolveTikTokContext();return this.euler.mute(this.context.roomId,userId,duration||300,commentMsgId)});h("tiktok:unmute",async(_e,u)=>{if(!this.context.roomId)await this.resolveTikTokContext();return this.euler.unmute(this.context.roomId,u)});h("tiktok:banned",async()=>{if(!this.context.roomId)await this.resolveTikTokContext();return this.euler.banned(this.context.roomId)});h("tiktok:ban",async(_e,{userId,commentMsgId}={})=>{if(!this.context.roomId)await this.resolveTikTokContext();return this.euler.ban(this.context.roomId,userId,commentMsgId)});h("tiktok:unban",async(_e,u)=>{if(!this.context.roomId)await this.resolveTikTokContext();return this.euler.unban(this.context.roomId,u)});h("tiktok:moderators",async()=>{if(!this.context.anchorId)await this.resolveTikTokContext();return this.euler.moderators(this.context.anchorId)});h("tiktok:addModerator",async(_e,u)=>{if(!this.context.anchorId)await this.resolveTikTokContext();return this.euler.addModerator(this.context.anchorId,u)});h("tiktok:removeModerator",async(_e,u)=>{if(!this.context.anchorId)await this.resolveTikTokContext();return this.euler.removeModerator(this.context.anchorId,u)});h("tiktok:comments",async(_e,en)=>{if(!this.context.roomId)await this.resolveTikTokContext();return this.euler.toggleComments(this.context.roomId,en)});h("tiktok:sensitiveWords",async()=>{if(!this.context.roomId||!this.context.secAnchorId)await this.resolveTikTokContext();if(!this.context.secAnchorId)throw new Error("TikTok sec_anchor_id konnte nicht aufgelöst werden.");return this.euler.sensitiveWords(this.context.roomId,this.context.secAnchorId)});h("tiktok:addSensitiveWord",async(_e,w)=>{if(!this.context.roomId||!this.context.secAnchorId)await this.resolveTikTokContext();return this.euler.addSensitiveWord(this.context.roomId,w,this.context.secAnchorId)});h("tiktok:deleteSensitiveWord",async(_e,id)=>{if(!this.context.roomId||!this.context.secAnchorId)await this.resolveTikTokContext();return this.euler.deleteSensitiveWord(this.context.roomId,id,this.context.secAnchorId)});
    h("tiktok:liveCenterOpen",()=>this.shell.openExternal("https://livecenter.tiktok.com/?enterFrom=profile_hover&lang=de-DE&source=ls_end"));h("tiktok:liveCenterSummary",()=>this.liveCenterSummary());h("tiktok:liveCenterRoomDetails",(_e,roomId)=>this.euler.roomDetails(roomId));h("tiktok:liveCenterInteractions",(_e,{roomId,userId})=>this.euler.roomInteractions(roomId,userId));h("tiktok:giftGallery",()=>this.euler.giftGallery(this.context.username));h("tiktok:earnings",(_e,period="30d")=>this.euler.earnings(this.context.username,period));
    h("twitch:oauthStatus",()=>this.twitchOAuth.status());h("twitch:oauthBegin",(_e,c={})=>this.twitchOAuth.begin(c));h("twitch:oauthRefresh",()=>this.twitchOAuth.refresh());h("twitch:oauthRevoke",()=>this.twitchOAuth.revoke());h("twitch:connect",(_e,c)=>this.connectTwitch(c));
    h("youtube:oauthStatus",()=>this.youtubeOAuth.status());h("youtube:oauthBegin",(_e,c={})=>this.youtubeOAuth.begin(c));h("youtube:oauthRefresh",()=>this.youtubeOAuth.refresh());h("youtube:oauthRevoke",()=>this.youtubeOAuth.revoke());h("youtube:connect",(_e,c={})=>this.platforms.connect("youtube",c));
    h("cng:connect",async(_e,c={})=>{const accounts=await this.settings.get("accounts");accounts.cng={...(accounts.cng||{}),websocketUrl:String(c.websocketUrl||"")};await this.settings.set("accounts",accounts);if(c.token)await this.secrets.set("cng.token",c.token);return this.platforms.connect("cng",{websocketUrl:c.websocketUrl,token:c.token||await this.secrets.get("cng.token")})});
  }
}
module.exports={AppRuntime,DEFAULT_SETTINGS,GIFT_TEST_FALLBACKS,normalizeCatalogGift};
