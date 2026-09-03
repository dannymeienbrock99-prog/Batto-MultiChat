"use strict";
const crypto=require("node:crypto");
const http=require("node:http");
const {URL}=require("node:url");
const AUTH_URL="https://www.eulerstream.com/tiktok/oauth/authorize";
const TOKEN_URL="https://tiktok.eulerstream.com/tiktok/oauth/token";
const REVOKE_URL="https://tiktok.eulerstream.com/tiktok/oauth/revoke";
const DEFAULT_SCOPES=["webcast:fetch","webcast:chat","webcast:mute","webcast:ban","webcast:comments","webcast:moderators","webcast:sensitive_words","user:info"];
class EulerOAuth{
  constructor({secretStore,settingsStore,shell,port=48731}={}){this.secretStore=secretStore;this.settingsStore=settingsStore;this.shell=shell;this.port=port;this.pending=null;}
  async config(){return(await this.settingsStore.get("tiktokOAuth"))||{};}
  async begin({clientId,clientSecret,scopes=DEFAULT_SCOPES}={}){
    const cfg=await this.config();clientId=String(clientId||cfg.clientId||"").trim();clientSecret=String(clientSecret||"").trim();
    if(!clientId)throw new Error("Euler OAuth Client ID fehlt.");
    if(clientSecret)await this.secretStore.set("euler.clientSecret",clientSecret);
    const savedSecret=await this.secretStore.get("euler.clientSecret");if(!savedSecret)throw new Error("Euler OAuth Client Secret fehlt.");
    const state=crypto.randomBytes(24).toString("hex"),redirectUri=`http://127.0.0.1:${this.port}/oauth/tiktok/callback`;
    await this.settingsStore.set("tiktokOAuth",{clientId,redirectUri,scopes});
    const auth=new URL(AUTH_URL);auth.searchParams.set("client_id",clientId);auth.searchParams.set("redirect_uri",redirectUri);auth.searchParams.set("response_type","code");auth.searchParams.set("scope",scopes.join(" "));auth.searchParams.set("state",state);
    const result=this.waitForCallback(state,redirectUri);await this.shell.openExternal(auth.toString());return result;
  }
  waitForCallback(state,redirectUri){if(this.pending?.server)try{this.pending.server.close()}catch{}return new Promise((resolve,reject)=>{const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,"http://127.0.0.1");if(url.pathname!=="/oauth/tiktok/callback"){res.writeHead(404);return res.end("Not found")}if(url.searchParams.get("state")!==state)throw new Error("Ungültiger OAuth-State.");const error=url.searchParams.get("error");if(error)throw new Error(url.searchParams.get("error_description")||error);const code=url.searchParams.get("code");if(!code)throw new Error("Kein Authorization Code erhalten.");const tokens=await this.exchangeCode(code,redirectUri);res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end("<h2>BATTO MULTI-CHAT</h2><p>TikTok wurde erfolgreich verbunden. Du kannst dieses Fenster schließen.</p>");server.close();this.pending=null;resolve(tokens)}catch(e){res.writeHead(400,{"Content-Type":"text/plain; charset=utf-8"});res.end(String(e.message||e));server.close();this.pending=null;reject(e)}});server.on("error",reject);server.listen(this.port,"127.0.0.1");this.pending={server}})}
  async requestToken(body){const response=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const envelope=await response.json().catch(()=>({}));const data=envelope?.data||envelope;if(!response.ok||Number(envelope?.code||200)>=400)throw new Error(envelope?.error?.error_description||envelope?.error_description||envelope?.message||`OAuth HTTP ${response.status}`);if(!data?.access_token)throw new Error("Euler OAuth hat keinen Access Token geliefert.");return data;}
  async exchangeCode(code,redirectUri){const cfg=await this.config(),clientSecret=await this.secretStore.get("euler.clientSecret");if(!clientSecret)throw new Error("Euler OAuth Client Secret fehlt.");const data=await this.requestToken({grant_type:"authorization_code",code,client_id:cfg.clientId,client_secret:clientSecret,redirect_uri:redirectUri});await this.saveTokens(data);return this.status();}
  async refresh(){const cfg=await this.config(),clientSecret=await this.secretStore.get("euler.clientSecret"),refreshToken=await this.secretStore.get("euler.refreshToken");if(!refreshToken)throw new Error("Kein TikTok Refresh Token vorhanden.");if(!clientSecret)throw new Error("Euler OAuth Client Secret fehlt.");const data=await this.requestToken({grant_type:"refresh_token",refresh_token:refreshToken,client_id:cfg.clientId,client_secret:clientSecret});await this.saveTokens(data);return this.status();}
  async saveTokens(data){if(data.access_token)await this.secretStore.set("euler.accessToken",data.access_token);if(data.refresh_token)await this.secretStore.set("euler.refreshToken",data.refresh_token);await this.settingsStore.set("tiktokSession",{scopes:Array.isArray(data.scopes)?data.scopes:String(data.scope||"").split(/[ ,]+/).filter(Boolean),accessExpiresAt:Date.now()+Number(data.expires_in||3600)*1000,refreshExpiresAt:Date.now()+Number(data.refresh_expires_in||2592000)*1000,updatedAt:Date.now()});}
  async accessToken(){const session=(await this.settingsStore.get("tiktokSession"))||{};if(session.refreshExpiresAt&&Date.now()>=session.refreshExpiresAt)throw new Error("TikTok-Anmeldung ist abgelaufen. Bitte erneut anmelden.");if(session.accessExpiresAt&&Date.now()>session.accessExpiresAt-120000)await this.refresh();return this.secretStore.get("euler.accessToken");}
  async revoke(){const token=await this.secretStore.get("euler.accessToken");if(token)await fetch(REVOKE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).catch(()=>{});for(const key of ["euler.accessToken","euler.refreshToken"])await this.secretStore.delete(key);await this.settingsStore.set("tiktokSession",{});return this.status();}
  async status(){const session=(await this.settingsStore.get("tiktokSession"))||{},token=await this.secretStore.get("euler.accessToken");return{connected:Boolean(token),scopes:session.scopes||[],accessExpiresAt:session.accessExpiresAt||0,refreshExpiresAt:session.refreshExpiresAt||0,needsReauth:Boolean(session.refreshExpiresAt&&Date.now()>=session.refreshExpiresAt)};}
}
module.exports={EulerOAuth,DEFAULT_SCOPES};
