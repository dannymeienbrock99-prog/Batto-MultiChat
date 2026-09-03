"use strict";
const path=require("node:path");
const {app,ipcMain,safeStorage,shell,clipboard}=require("electron");
const {ChatWindowManager}=require("./services/chat-window-manager.cjs");
const {ChatCore}=require("./services/chat-core.cjs");
const {PlatformManager}=require("./services/platform-manager.cjs");
const {BaseAdapter}=require("./platforms/base-adapter.cjs");
const {TikTokAdapter}=require("./platforms/tiktok/tiktok-adapter.cjs");
const {TwitchAdapter}=require("./platforms/twitch/twitch-adapter.cjs");
const {YouTubeAdapter}=require("./platforms/youtube/youtube-adapter.cjs");
const {ObsWebSocketService}=require("./services/obs-websocket.cjs");
const {StreamOverlayServer}=require("./services/stream-overlay-server.cjs");
const {SecretStore}=require("./storage/secret-store.cjs");
const {SettingsStore}=require("./storage/settings-store.cjs");
const {EulerOAuth}=require("./platforms/tiktok/euler-oauth.cjs");
const {EulerClient}=require("./platforms/tiktok/euler-client.cjs");
const {TwitchOAuth}=require("./platforms/twitch/twitch-oauth.cjs");
const {YouTubeOAuth}=require("./platforms/youtube/youtube-oauth.cjs");

const core=new ChatCore();
const platforms=new PlatformManager(core);
platforms.register("tiktok",new TikTokAdapter());
platforms.register("cng",new BaseAdapter("cng"));
const obs=new ObsWebSocketService();
let manager,settings,secrets,eulerOAuth,euler,twitchOAuth,youtubeOAuth,streamOverlay;
let tiktokContext={username:"",roomId:"",anchorId:""};

const DEFAULT_SETTINGS={
  accounts:{tiktok:{username:""},twitch:{},youtube:{},cng:{}},
  obs:{url:"ws://127.0.0.1:4455"},
  tiktokOAuth:{clientId:"",redirectUri:"http://127.0.0.1:48731/oauth/tiktok/callback",scopes:["webcast:fetch","webcast:chat","webcast:mute","webcast:ban","webcast:comments","webcast:moderators","webcast:sensitive_words","user:info"]},
  tiktokSession:{},
  twitchOAuth:{clientId:"",redirectUri:"http://127.0.0.1:48732/oauth/twitch/callback",scopes:["chat:read","chat:edit"]},
  twitchSession:{},
  youtubeOAuth:{clientId:"",redirectUri:"http://127.0.0.1:48733",scopes:["https://www.googleapis.com/auth/youtube.readonly"]},
  youtubeSession:{},
  ui:{ttsEnabled:false}
};

async function resolveTikTokContext(username){
  username=String(username||tiktokContext.username||"").trim().replace(/^@/,"");
  if(!username)throw new Error("TikTok @Username fehlt.");
  tiktokContext.username=username;
  const [room,user]=await Promise.all([euler.roomId(username),euler.userId(username)]);
  tiktokContext.roomId=String(room?.response?.room_id||room?.room_id||room?.response?.roomId||"");
  tiktokContext.anchorId=String(user?.response?.user_id||user?.user_id||user?.response?.userId||"");
  return{...tiktokContext};
}

async function connectTwitch(channel){
  const token=await twitchOAuth.accessToken();
  if(!token)throw new Error("Twitch ist nicht angemeldet.");
  const status=await twitchOAuth.status();
  channel=String(channel||status.profile?.channel||status.profile?.username||"").trim().replace(/^#/,"");
  if(!channel)throw new Error("Twitch-Kanal fehlt.");
  return platforms.connect("twitch",{channel,token,username:status.profile?.username||channel});
}

function registerIpc(){
  ipcMain.handle("chat:history",(_e,o={})=>core.history(o.limit));
  ipcMain.handle("chat:clear",(_e,p="all")=>core.clear(p));
  ipcMain.handle("chat:statuses",()=>platforms.statuses());
  ipcMain.handle("chat:connect",async(_e,p,c)=>{const result=await platforms.connect(p,c||{});if(p==="tiktok"&&c?.username){const accounts=await settings.get("accounts");accounts.tiktok={...(accounts.tiktok||{}),username:String(c.username)};await settings.set("accounts",accounts);tiktokContext.username=String(c.username).replace(/^@/,"");}return result;});
  ipcMain.handle("chat:disconnect",(_e,p)=>platforms.disconnect(p));
  ipcMain.handle("window:alwaysOnTop",()=>manager.toggleAlwaysOnTop());
  ipcMain.handle("settings:get",()=>settings.get());
  ipcMain.handle("settings:patch",(_e,value)=>settings.patch(value||{}));

  ipcMain.handle("obs:status",()=>obs.status());
  ipcMain.handle("obs:connect",async(_e,c)=>{const password=String(c?.password||await secrets.get("obs.password")||"");const result=await obs.connect({...c,password});await settings.set("obs",{url:c?.url||"ws://127.0.0.1:4455"});if(c?.password)await secrets.set("obs.password",c.password);return result;});
  ipcMain.handle("obs:disconnect",()=>obs.disconnect());
  ipcMain.handle("obs:savedPassword",async()=>Boolean(await secrets.get("obs.password")));

  ipcMain.handle("overlay:status",()=>streamOverlay.status());
  ipcMain.handle("overlay:open",()=>shell.openExternal(streamOverlay.status().overlayUrl));
  ipcMain.handle("overlay:copyUrl",()=>{const url=streamOverlay.status().overlayUrl;clipboard.writeText(url);return url;});
  ipcMain.handle("overlay:testChat",()=>{streamOverlay.pushChat({platform:"tiktok",username:"Crazy_Batto",displayName:"Crazy_Batto",message:"BATTO MULTI-CHAT Overlay-Test",role:"moderator"});return true;});
  ipcMain.handle("overlay:testEvent",()=>{streamOverlay.pushEvent({platform:"tiktok",eventType:"gift",title:"Geschenk-Test · BATTO MULTI-CHAT"});return true;});

  ipcMain.handle("tiktok:oauthStatus",()=>eulerOAuth.status());
  ipcMain.handle("tiktok:oauthBegin",(_e,c={})=>eulerOAuth.begin(c));
  ipcMain.handle("tiktok:oauthRefresh",()=>eulerOAuth.refresh());
  ipcMain.handle("tiktok:oauthRevoke",()=>eulerOAuth.revoke());
  ipcMain.handle("tiktok:resolveContext",(_e,u)=>resolveTikTokContext(u));
  ipcMain.handle("tiktok:context",()=>({...tiktokContext}));
  ipcMain.handle("tiktok:gifts",()=>euler.gifts());
  ipcMain.handle("tiktok:giftSearch",(_e,q)=>euler.searchGifts(q));
  ipcMain.handle("tiktok:sendChat",async(_e,message)=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.sendChat(tiktokContext.roomId,message);});
  ipcMain.handle("tiktok:muted",async()=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.muted(tiktokContext.roomId);});
  ipcMain.handle("tiktok:mute",async(_e,{userId,duration,commentMsgId}={})=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.mute(tiktokContext.roomId,userId,duration||300,commentMsgId);});
  ipcMain.handle("tiktok:unmute",async(_e,userId)=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.unmute(tiktokContext.roomId,userId);});
  ipcMain.handle("tiktok:banned",async()=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.banned(tiktokContext.roomId);});
  ipcMain.handle("tiktok:ban",async(_e,{userId,commentMsgId}={})=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.ban(tiktokContext.roomId,userId,commentMsgId);});
  ipcMain.handle("tiktok:unban",async(_e,userId)=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.unban(tiktokContext.roomId,userId);});
  ipcMain.handle("tiktok:moderators",async()=>{if(!tiktokContext.anchorId)await resolveTikTokContext();return euler.moderators(tiktokContext.anchorId);});
  ipcMain.handle("tiktok:addModerator",async(_e,userId)=>{if(!tiktokContext.anchorId)await resolveTikTokContext();return euler.addModerator(tiktokContext.anchorId,userId);});
  ipcMain.handle("tiktok:removeModerator",async(_e,userId)=>{if(!tiktokContext.anchorId)await resolveTikTokContext();return euler.removeModerator(tiktokContext.anchorId,userId);});
  ipcMain.handle("tiktok:comments",async(_e,enabled)=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.toggleComments(tiktokContext.roomId,enabled);});
  ipcMain.handle("tiktok:sensitiveWords",async()=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.sensitiveWords(tiktokContext.roomId);});
  ipcMain.handle("tiktok:addSensitiveWord",async(_e,word)=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.addSensitiveWord(tiktokContext.roomId,word);});
  ipcMain.handle("tiktok:deleteSensitiveWord",async(_e,word)=>{if(!tiktokContext.roomId)await resolveTikTokContext();return euler.deleteSensitiveWord(tiktokContext.roomId,word);});

  ipcMain.handle("twitch:oauthStatus",()=>twitchOAuth.status());
  ipcMain.handle("twitch:oauthBegin",(_e,c={})=>twitchOAuth.begin(c));
  ipcMain.handle("twitch:oauthRefresh",()=>twitchOAuth.refresh());
  ipcMain.handle("twitch:oauthRevoke",()=>twitchOAuth.revoke());
  ipcMain.handle("twitch:connect",(_e,channel)=>connectTwitch(channel));

  ipcMain.handle("youtube:oauthStatus",()=>youtubeOAuth.status());
  ipcMain.handle("youtube:oauthBegin",(_e,c={})=>youtubeOAuth.begin(c));
  ipcMain.handle("youtube:oauthRefresh",()=>youtubeOAuth.refresh());
  ipcMain.handle("youtube:oauthRevoke",()=>youtubeOAuth.revoke());
  ipcMain.handle("youtube:connect",(_e,c={})=>platforms.connect("youtube",c));
}

app.whenReady().then(async()=>{
  const userData=app.getPath("userData");
  settings=new SettingsStore(path.join(userData,"settings.json"),DEFAULT_SETTINGS);await settings.load();
  secrets=new SecretStore(path.join(userData,"secrets.dat"),safeStorage);
  eulerOAuth=new EulerOAuth({secretStore:secrets,settingsStore:settings,shell});
  euler=new EulerClient({oauth:eulerOAuth});
  twitchOAuth=new TwitchOAuth({secretStore:secrets,settingsStore:settings,shell});
  youtubeOAuth=new YouTubeOAuth({secretStore:secrets,settingsStore:settings,shell});
  platforms.register("twitch",new TwitchAdapter());
  platforms.register("youtube",new YouTubeAdapter({oauth:youtubeOAuth}));
  const accounts=await settings.get("accounts");tiktokContext.username=String(accounts?.tiktok?.username||"").replace(/^@/,"");
  streamOverlay=new StreamOverlayServer({webRoot:path.join(__dirname,"stream-overlay"),port:48621});
  try{await streamOverlay.start();}catch(error){console.error("Stream-Overlay konnte nicht gestartet werden:",error);}
  manager=new ChatWindowManager({userDataFile:path.join(userData,"multichat-window.json"),preloadPath:path.join(__dirname,"preload.cjs"),rendererPath:path.join(__dirname,"renderer","multi-chat.html"),onClosed:()=>{if(process.platform!=="darwin")app.quit();}});
  await manager.load();manager.create();registerIpc();
  core.on("messages",batch=>{manager?.window?.webContents.send("chat:messages",batch);for(const message of batch||[]){if(message.eventType&&message.eventType!=="chat")streamOverlay.pushEvent(message);else streamOverlay.pushChat(message);}});
  core.on("status",status=>manager?.window?.webContents.send("chat:status",status));
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
app.on("before-quit",()=>{void streamOverlay?.stop?.();});
