"use strict";
const crypto=require("node:crypto");
const http=require("node:http");
const {URL}=require("node:url");
const AUTH_URL="https://www.eulerstream.com/tiktok/oauth/authorize";
const API_BASE="https://tiktok.eulerstream.com";
const TOKEN_URL=`${API_BASE}/tiktok/oauth/token`;
const REVOKE_URL=`${API_BASE}/tiktok/oauth/revoke`;
const INTROSPECT_URL=`${API_BASE}/tiktok/oauth/introspect`;
const DEFAULT_SCOPES=["webcast:fetch","webcast:chat","webcast:mute","webcast:ban","webcast:comments","webcast:moderators","webcast:sensitive_words","webcast:live_analytics","webcast:user_earnings","webcast:rankings","user:info"];
function oauthFriendlyError(code,description=""){
  const desc=String(description||"").trim();
  if(code==="access_denied")return new Error("TikTok/Euler-Anmeldung wurde nicht bestätigt oder abgebrochen. Starte „Mit TikTok anmelden“ erneut und bestätige die Freigabe in TikTok vollständig.");
  if(code==="invalid_client")return new Error(`Euler OAuth Client ID ist ungültig oder wurde gelöscht.${desc?` ${desc}`:""}`);
  if(code==="invalid_scope")return new Error(`Der Euler OAuth Client erlaubt nicht alle von BATTO benötigten Berechtigungen.${desc?` ${desc}`:""}`);
  if(code==="invalid_request")return new Error(`Euler OAuth Anfrage ist unvollständig oder die Redirect-URI stimmt nicht exakt.${desc?` ${desc}`:""}`);
  if(code==="invalid_grant")return new Error("Der Euler OAuth Login-Code ist abgelaufen oder wurde bereits verwendet. Starte die Anmeldung erneut.");
  return new Error(desc||code||"Euler OAuth fehlgeschlagen.");
}
class EulerOAuth{
  constructor({secretStore,settingsStore,shell,port=48731}={}){this.secretStore=secretStore;this.settingsStore=settingsStore;this.shell=shell;this.port=port;this.pending=null;this.refreshPromise=null;this.lastError="";}
  async config(){return(await this.settingsStore.get("tiktokOAuth"))||{};}
  async validateClient(clientId,scopes){
    const response=await fetch(`${API_BASE}/tiktok/oauth/clients/${encodeURIComponent(clientId)}`);
    const envelope=await response.json().catch(()=>({}));
    if(!response.ok||Number(envelope?.code||200)>=400){const code=envelope?.error?.error||envelope?.error||"invalid_client";throw oauthFriendlyError(String(code),envelope?.error?.error_description||envelope?.message||"");}
    const client=envelope?.client||envelope?.data?.client||envelope?.data||{};
    const supported=client.supported_scopes||client.supportedScopes;
    if(Array.isArray(supported)&&supported.length){const missing=scopes.filter(s=>!supported.includes(s));if(missing.length)throw new Error(`Euler OAuth Client ist für diese BATTO-Berechtigungen noch nicht freigeschaltet: ${missing.join(", ")}. Passe beim OAuth Client die supported_scopes an oder reduziere die angeforderten Funktionen.`);}
    return client;
  }
  async begin({clientId,clientSecret,scopes=DEFAULT_SCOPES}={}){
    const cfg=await this.config();clientId=String(clientId||cfg.clientId||"").trim();clientSecret=String(clientSecret||"").trim();scopes=Array.isArray(scopes)&&scopes.length?scopes:DEFAULT_SCOPES;
    if(!clientId)throw new Error("Euler OAuth Client ID fehlt. Erstelle im Euler Dashboard unter OAuth einen Client.");
    if(clientSecret)await this.secretStore.set("euler.clientSecret",clientSecret);
    if(!await this.secretStore.get("euler.clientSecret"))throw new Error("Euler OAuth Client Secret fehlt.");
    await this.validateClient(clientId,scopes);
    if(this.pending?.server)try{this.pending.server.close()}catch{}
    const state=crypto.randomBytes(32).toString("hex"),redirectUri=`http://127.0.0.1:${this.port}/oauth/tiktok/callback`;
    await this.settingsStore.set("tiktokOAuth",{clientId,redirectUri,scopes});
    const auth=new URL(AUTH_URL);auth.searchParams.set("client_id",clientId);auth.searchParams.set("redirect_uri",redirectUri);auth.searchParams.set("response_type","code");auth.searchParams.set("scope",scopes.join(" "));auth.searchParams.set("state",state);
    const flow=await this.createCallbackServer(state,redirectUri);
    const startedAt=Date.now();this.lastError="";this.pending={server:flow.server,state:"waiting",startedAt,error:""};
    flow.promise.then(()=>{this.pending=null;this.lastError=""}).catch(error=>{this.lastError=String(error?.message||error);this.pending={server:null,state:"error",startedAt,error:this.lastError};});
    try{await this.shell.openExternal(auth.toString())}catch(error){try{flow.server.close()}catch{}this.pending=null;throw error}
    return{started:true,pending:true,redirectUri,startedAt};
  }
  createCallbackServer(state,redirectUri){
    return new Promise((resolveStart,rejectStart)=>{
      let resolveFlow,rejectFlow,settled=false;
      const promise=new Promise((resolve,reject)=>{resolveFlow=resolve;rejectFlow=reject});
      const server=http.createServer(async(req,res)=>{
        try{
          const url=new URL(req.url,"http://127.0.0.1");
          if(url.pathname!=="/oauth/tiktok/callback"){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found")}
          if(url.searchParams.get("state")!==state)throw new Error("Ungültiger OAuth-State. Bitte Anmeldung erneut starten.");
          const oauthError=url.searchParams.get("error");if(oauthError)throw oauthFriendlyError(oauthError,url.searchParams.get("error_description")||"");
          const code=url.searchParams.get("code");if(!code)throw new Error("Kein Authorization Code erhalten. Bitte Anmeldung erneut starten.");
          const tokens=await this.exchangeCode(code,redirectUri);
          res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end("<h2>BATTO MULTI-CHAT</h2><p>TikTok wurde erfolgreich verbunden. Du kannst dieses Fenster schließen.</p>");
          if(!settled){settled=true;clearTimeout(timer);server.close();resolveFlow(tokens)}
        }catch(error){
          res.writeHead(400,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(`<h2>BATTO MULTI-CHAT</h2><p>${String(error?.message||error).replace(/[<>&\"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;"}[c]))}</p><p>Du kannst dieses Fenster schließen und die Anmeldung in BATTO erneut starten.</p>`);
          if(!settled){settled=true;clearTimeout(timer);server.close();rejectFlow(error)}
        }
      });
      const timer=setTimeout(()=>{if(settled)return;settled=true;try{server.close()}catch{}rejectFlow(new Error("TikTok/Euler Login-Fluss ist abgelaufen. Klicke in BATTO erneut auf „Mit TikTok anmelden“ und bestätige den QR-Code vollständig."));},10*60*1000);
      server.once("error",error=>{clearTimeout(timer);if(!settled){settled=true;rejectFlow(error)}rejectStart(error)});
      server.listen(this.port,"127.0.0.1",()=>resolveStart({server,promise}));
    });
  }
  async requestToken(body){const response=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const envelope=await response.json().catch(()=>({}));const data=envelope?.data||envelope;if(!response.ok||Number(envelope?.code||200)>=400){const code=envelope?.error?.error||envelope?.error||"";throw oauthFriendlyError(String(code),envelope?.error?.error_description||envelope?.error_description||envelope?.message||`OAuth HTTP ${response.status}`)}if(!data?.access_token)throw new Error("Euler OAuth hat keinen Access Token geliefert.");return data;}
  async exchangeCode(code,redirectUri){const cfg=await this.config(),clientSecret=await this.secretStore.get("euler.clientSecret");if(!clientSecret)throw new Error("Euler OAuth Client Secret fehlt.");const data=await this.requestToken({grant_type:"authorization_code",code,client_id:cfg.clientId,client_secret:clientSecret,redirect_uri:redirectUri});await this.saveTokens(data);return this.status();}
  async refresh(){if(this.refreshPromise)return this.refreshPromise;this.refreshPromise=(async()=>{const cfg=await this.config(),clientSecret=await this.secretStore.get("euler.clientSecret"),refreshToken=await this.secretStore.get("euler.refreshToken");if(!refreshToken)throw new Error("Kein TikTok Refresh Token vorhanden.");if(!clientSecret||!cfg.clientId)throw new Error("Euler OAuth Client-Konfiguration fehlt.");const data=await this.requestToken({grant_type:"refresh_token",refresh_token:refreshToken,client_id:cfg.clientId,client_secret:clientSecret});await this.saveTokens(data);return this.status();})();try{return await this.refreshPromise}finally{this.refreshPromise=null}}
  async saveTokens(data){if(data.access_token)await this.secretStore.set("euler.accessToken",data.access_token);if(data.refresh_token)await this.secretStore.set("euler.refreshToken",data.refresh_token);await this.settingsStore.set("tiktokSession",{scopes:Array.isArray(data.scopes)?data.scopes:String(data.scope||"").split(/[ ,]+/).filter(Boolean),accessExpiresAt:Date.now()+Number(data.expires_in||3600)*1000,refreshExpiresAt:Date.now()+Number(data.refresh_expires_in||2592000)*1000,updatedAt:Date.now()});}
  async accessToken(){const session=(await this.settingsStore.get("tiktokSession"))||{};if(session.refreshExpiresAt&&Date.now()>=session.refreshExpiresAt)throw new Error("TikTok-Anmeldung ist abgelaufen. Bitte erneut anmelden.");if(session.accessExpiresAt&&Date.now()>session.accessExpiresAt-120000)await this.refresh();return this.secretStore.get("euler.accessToken");}
  async introspect(){const token=await this.secretStore.get("euler.accessToken"),cfg=await this.config(),clientSecret=await this.secretStore.get("euler.clientSecret");if(!token||!cfg.clientId||!clientSecret)return{active:false};const response=await fetch(INTROSPECT_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,token_type_hint:"access_token",client_id:cfg.clientId,client_secret:clientSecret})});const envelope=await response.json().catch(()=>({}));if(!response.ok||Number(envelope?.code||200)>=400)return{active:false,error:envelope?.error?.error_description||envelope?.message||`HTTP ${response.status}`};return envelope.data||envelope;}
  async revoke(){const token=await this.secretStore.get("euler.accessToken"),cfg=await this.config(),clientSecret=await this.secretStore.get("euler.clientSecret");if(token&&cfg.clientId&&clientSecret)await fetch(REVOKE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,token_type_hint:"access_token",client_id:cfg.clientId,client_secret:clientSecret})}).catch(()=>{});for(const key of ["euler.accessToken","euler.refreshToken"])await this.secretStore.delete(key);await this.settingsStore.set("tiktokSession",{});this.lastError="";return this.status();}
  async status(){const session=(await this.settingsStore.get("tiktokSession"))||{},token=await this.secretStore.get("euler.accessToken"),cfg=await this.config();return{connected:Boolean(token),configured:Boolean(cfg.clientId&&await this.secretStore.get("euler.clientSecret")),scopes:session.scopes||[],accessExpiresAt:session.accessExpiresAt||0,refreshExpiresAt:session.refreshExpiresAt||0,needsReauth:Boolean(session.refreshExpiresAt&&Date.now()>=session.refreshExpiresAt),pending:this.pending?{state:this.pending.state,startedAt:this.pending.startedAt,error:this.pending.error||""}:null,lastError:this.lastError||""};}
}
module.exports={EulerOAuth,DEFAULT_SCOPES,oauthFriendlyError};
