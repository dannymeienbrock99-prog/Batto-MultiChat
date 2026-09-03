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
  const tiktokApiKey=Boolean(await runtime.secrets.get("euler.apiKey"));
  const tiktokOAuth=await runtime.eulerOAuth.status().catch(e=>({connected:false,error:e.message}));
  const twitchOAuth=await runtime.twitchOAuth.status().catch(e=>({connected:false,error:e.message}));
  const youtubeOAuth=await runtime.youtubeOAuth.status().catch(e=>({connected:false,error:e.message}));
  return{
    app:{overlay:runtime.streamOverlay?.status?.()||null,hologram:runtime.hologram?.status?.()||null},
    obs:runtime.obs?.status?.()||null,
    platforms:runtime.platforms?.statuses?.()||{},
    tiktok:{apiKeyConfigured:tiktokApiKey,oauth:tiktokOAuth,context:{...runtime.context}},
    twitch:{oauth:twitchOAuth},youtube:{oauth:youtubeOAuth},cng
  };
}

function applyReleaseHardening(runtime,{ipcMain,shell,clipboard}={}){
  if(!runtime)throw new Error("Runtime fehlt.");
  runtime.cngBrowser=new CngBrowserTools({runtime,ipcMain,shell,clipboard});runtime.cngBrowser.register();
  ipcMain.handle("chat:send",(_e,v={})=>sendChat(runtime,v.platform,v.message));
  ipcMain.handle("runtime:diagnostics",()=>diagnostics(runtime));
  ipcMain.handle("tiktok:oauthIntrospect",()=>runtime.eulerOAuth.introspect());
  ipcMain.handle("tiktok:eulerAccount",()=>eulerApiKeyRequest(runtime,"/accounts/me"));
  ipcMain.handle("tiktok:eulerRateLimits",()=>eulerApiKeyRequest(runtime,"/accounts/me/rate_limits"));
  return runtime;
}
module.exports={applyReleaseHardening,sendChat,diagnostics,eulerApiKeyRequest};
