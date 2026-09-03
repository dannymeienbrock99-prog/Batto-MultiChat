"use strict";
const {CngBrowserTools}=require("../services/cng-browser-tools.cjs");

function adapter(runtime,name){const a=runtime.platforms?.adapters?.get?.(name);if(!a)throw new Error(`${name} Connector ist nicht verfügbar.`);return a;}
async function eulerApiKeyRequest(runtime,path){return runtime.euler.request(path,{oauth:false,requireApiKey:true});}

async function sendChat(runtime,platform,message){
  platform=String(platform||"").toLowerCase();message=String(message||"").trim();if(!message)throw new Error("Nachricht ist leer.");
  if(platform==="tiktok"){if(!runtime.context.roomId)await runtime.resolveTikTokContext();return runtime.euler.sendChat(runtime.context.roomId,message)}
  if(platform==="twitch")return adapter(runtime,"twitch").send(message);
  if(platform==="youtube")return adapter(runtime,"youtube").send(message);
  if(platform==="cng")throw new Error("CNG stellt derzeit nur OBS Alert-/Chat-Browserquellen bereit; ein offizieller API-Endpunkt zum Senden von Chatnachrichten ist nicht verfügbar.");
  throw new Error("Bitte Twitch, TikTok oder YouTube als Chat-Tab auswählen.");
}

async function diagnostics(runtime){
  const cng=runtime.cngBrowser?await runtime.cngBrowser.status().catch(e=>({error:e.message})):null;
  const tiktokApiKey=Boolean(await runtime.secrets?.get?.("euler.apiKey"));
  const tiktokOAuth=await runtime.eulerOAuth?.status?.().catch(e=>({connected:false,error:e.message}))||{connected:false};
  const twitchOAuth=await runtime.twitchOAuth?.status?.().catch(e=>({connected:false,error:e.message}))||{connected:false};
  const youtubeOAuth=await runtime.youtubeOAuth?.status?.().catch(e=>({connected:false,error:e.message}))||{connected:false};
  return{
    app:{overlay:runtime.streamOverlay?.status?.()||null,hologram:runtime.hologram?.status?.()||null},
    obs:runtime.obs?.status?.()||null,
    platforms:runtime.platforms?.statuses?.()||{},
    tiktok:{apiKeyConfigured:tiktokApiKey,encryptionAvailable:Boolean(runtime.secrets?.available?.()),oauth:tiktokOAuth,context:{...runtime.context}},
    twitch:{oauth:twitchOAuth},youtube:{oauth:youtubeOAuth},cng
  };
}

async function saveEulerApiKey(runtime,key){
  key=String(key||"").trim();
  if(!key)throw new Error("Euler Stream API-Key fehlt.");
  if(!runtime.secrets?.available?.())throw new Error("Windows safeStorage ist nicht verfügbar. Der Euler API-Key kann deshalb nicht sicher gespeichert werden.");
  await runtime.secrets.set("euler.apiKey",key);
  const readBack=await runtime.secrets.get("euler.apiKey");
  if(readBack!==key){await runtime.secrets.delete("euler.apiKey").catch(()=>{});throw new Error("Euler API-Key konnte nicht zuverlässig aus Windows safeStorage zurückgelesen werden.");}
  return{configured:true,encryptionAvailable:true};
}

async function tikTokPreflight(runtime,config={}){
  const username=String(config.username||config.uniqueId||runtime.context?.username||"").trim().replace(/^@/,"");
  if(!username)throw new Error("TikTok @Username fehlt.");
  const key=String(await runtime.secrets.get("euler.apiKey")||"").trim();
  if(!key)throw new Error("Euler Stream API-Key fehlt. Bitte zuerst unter TikTok → Euler Stream LIVE-Verbindung den API-Key eingeben und „API-Key speichern & prüfen“ drücken.");
  let room;
  try{room=await runtime.euler.roomId(username)}catch(error){throw new Error(`Euler konnte den LIVE-Status für @${username} nicht prüfen: ${error?.message||error}`)}
  const payload=room?.data||room?.response||room||{};
  const isLive=Boolean(payload.is_live??room?.is_live);
  const roomId=String(payload.room_id??room?.room_id??"");
  if(!isLive||!roomId)throw new Error(`@${username} ist derzeit nicht als TikTok LIVE erkannt. Der LIVE-Reader kann erst verbunden werden, wenn dieser Account wirklich live ist.`);
  runtime.context.username=username;runtime.context.roomId=roomId;runtime.context.isLive=true;
  return{username,roomId,key};
}

function installPostRegisterOverrides(runtime,ipcMain){
  const original=runtime.registerIpc.bind(runtime);
  runtime.registerIpc=function(){
    original();
    ipcMain.removeHandler("tiktok:setApiKey");
    ipcMain.handle("tiktok:setApiKey",(_e,key)=>saveEulerApiKey(runtime,key));
    ipcMain.removeHandler("tiktok:apiKeyStatus");
    ipcMain.handle("tiktok:apiKeyStatus",async()=>({configured:Boolean(await runtime.secrets.get("euler.apiKey")),encryptionAvailable:Boolean(runtime.secrets.available())}));
    ipcMain.removeHandler("chat:connect");
    ipcMain.handle("chat:connect",async(_e,platform,config={})=>{
      platform=String(platform||"").toLowerCase();
      if(platform!=="tiktok")return runtime.platforms.connect(platform,config);
      const preflight=await tikTokPreflight(runtime,config);
      const result=await runtime.platforms.connect("tiktok",{...config,username:preflight.username,signApiKey:preflight.key});
      const accounts=await runtime.settings.get("accounts")||{};accounts.tiktok={...(accounts.tiktok||{}),username:preflight.username};await runtime.settings.set("accounts",accounts);
      return{...result,roomId:preflight.roomId};
    });
  };
}

function applyReleaseHardening(runtime,{ipcMain,shell,clipboard}={}){
  if(!runtime)throw new Error("Runtime fehlt.");
  installPostRegisterOverrides(runtime,ipcMain);
  runtime.cngBrowser=new CngBrowserTools({runtime,ipcMain,shell,clipboard});runtime.cngBrowser.register();
  ipcMain.handle("chat:send",(_e,v={})=>sendChat(runtime,v.platform,v.message));
  ipcMain.handle("runtime:diagnostics",()=>diagnostics(runtime));
  ipcMain.handle("tiktok:oauthIntrospect",()=>runtime.eulerOAuth.introspect());
  ipcMain.handle("tiktok:eulerAccount",()=>eulerApiKeyRequest(runtime,"/accounts/me"));
  ipcMain.handle("tiktok:eulerRateLimits",()=>eulerApiKeyRequest(runtime,"/accounts/me/rate_limits"));
  return runtime;
}
module.exports={applyReleaseHardening,sendChat,diagnostics,eulerApiKeyRequest,saveEulerApiKey,tikTokPreflight,installPostRegisterOverrides};
