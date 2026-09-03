"use strict";
class TwitchOAuth{
  constructor({secretStore,settingsStore,shell}={}){this.secretStore=secretStore;this.settingsStore=settingsStore;this.shell=shell;this.pending=null;}
  async begin({clientId,scopes=["chat:read","chat:edit"]}={}){
    const cfg=await this.settingsStore.get("twitchOAuth")||{};
    clientId=String(clientId||cfg.clientId||"").trim();
    if(!clientId)throw new Error("Twitch Client ID fehlt. Erstelle einmal eine Twitch Developer App und trage nur die Client ID ein.");
    await this.settingsStore.set("twitchOAuth",{clientId,scopes,flow:"device_code"});
    const body=new URLSearchParams({client_id:clientId,scopes:scopes.join(" ")});
    const response=await fetch("https://id.twitch.tv/oauth2/device",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||`Twitch Device OAuth HTTP ${response.status}`);
    if(!data.device_code||!data.verification_uri)throw new Error("Twitch hat keinen Device-Code geliefert.");
    const expiresAt=Date.now()+Number(data.expires_in||1800)*1000;
    const interval=Math.max(5,Number(data.interval||5));
    this.pending={deviceCode:data.device_code,userCode:data.user_code||"",verificationUri:data.verification_uri,expiresAt,interval,clientId,scopes};
    await this.shell.openExternal(data.verification_uri);
    return this.pollDeviceToken(this.pending);
  }
  async pollDeviceToken(session){
    while(Date.now()<session.expiresAt){
      await new Promise(r=>setTimeout(r,session.interval*1000));
      const body=new URLSearchParams({client_id:session.clientId,scopes:session.scopes.join(" "),device_code:session.deviceCode,grant_type:"urn:ietf:params:oauth:grant-type:device_code"});
      const response=await fetch("https://id.twitch.tv/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
      const data=await response.json().catch(()=>({}));
      if(response.ok&&data.access_token){await this.save(data);await this.storeProfile();this.pending=null;return this.status();}
      const message=String(data.message||data.error||"");
      if(response.status===400&&message.toLowerCase().includes("authorization_pending"))continue;
      if(response.status===400&&message.toLowerCase().includes("slow_down")){session.interval+=5;continue;}
      if(response.status===400&&message.toLowerCase().includes("invalid device code"))throw new Error("Der Twitch-Anmeldecode ist ungültig oder bereits verwendet.");
      if(response.status===400&&message.toLowerCase().includes("expired"))throw new Error("Der Twitch-Anmeldecode ist abgelaufen. Bitte erneut anmelden.");
      throw new Error(message||`Twitch OAuth HTTP ${response.status}`);
    }
    this.pending=null;
    throw new Error("Die Twitch-Anmeldung ist abgelaufen. Bitte erneut versuchen.");
  }
  async refresh(){
    const cfg=await this.settingsStore.get("twitchOAuth")||{},refresh=await this.secretStore.get("twitch.refreshToken");
    if(!refresh)throw new Error("Kein Twitch Refresh Token vorhanden.");
    if(!cfg.clientId)throw new Error("Twitch Client ID fehlt.");
    const body=new URLSearchParams({grant_type:"refresh_token",refresh_token:refresh,client_id:cfg.clientId});
    const response=await fetch("https://id.twitch.tv/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||`Twitch OAuth HTTP ${response.status}`);
    await this.save(data);return this.status();
  }
  async save(data){if(data.access_token)await this.secretStore.set("twitch.accessToken",data.access_token);if(data.refresh_token)await this.secretStore.set("twitch.refreshToken",data.refresh_token);await this.settingsStore.set("twitchSession",{scopes:data.scope||[],expiresAt:Date.now()+Number(data.expires_in||0)*1000,updatedAt:Date.now(),flow:"device_code"});}
  async accessToken(){const s=await this.settingsStore.get("twitchSession")||{};if(s.expiresAt&&Date.now()>s.expiresAt-120000)await this.refresh();return this.secretStore.get("twitch.accessToken");}
  async validate(){const token=await this.accessToken();if(!token)return null;const response=await fetch("https://id.twitch.tv/oauth2/validate",{headers:{Authorization:`OAuth ${token}`}});if(!response.ok)return null;return response.json();}
  async profile(){const cfg=await this.settingsStore.get("twitchOAuth")||{};const token=await this.accessToken();if(!token||!cfg.clientId)return null;const response=await fetch("https://api.twitch.tv/helix/users",{headers:{Authorization:`Bearer ${token}`,"Client-Id":cfg.clientId}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||`Twitch HTTP ${response.status}`);return data.data?.[0]||null;}
  async storeProfile(){const p=await this.profile().catch(()=>null);if(!p)return null;const accounts=await this.settingsStore.get("accounts")||{};accounts.twitch={...(accounts.twitch||{}),id:p.id||"",username:p.login||"",displayName:p.display_name||p.login||"",avatar:p.profile_image_url||"",channel:p.login||""};await this.settingsStore.set("accounts",accounts);return p;}
  async status(){const token=await this.secretStore.get("twitch.accessToken"),s=await this.settingsStore.get("twitchSession")||{},accounts=await this.settingsStore.get("accounts")||{},cfg=await this.settingsStore.get("twitchOAuth")||{};return{connected:Boolean(token),configured:Boolean(cfg.clientId),scopes:s.scopes||[],expiresAt:s.expiresAt||0,profile:accounts.twitch||{},flow:"device_code",pending:this.pending?{userCode:this.pending.userCode,verificationUri:this.pending.verificationUri,expiresAt:this.pending.expiresAt}:null};}
  async revoke(){const cfg=await this.settingsStore.get("twitchOAuth")||{},token=await this.secretStore.get("twitch.accessToken");if(token&&cfg.clientId){const body=new URLSearchParams({client_id:cfg.clientId,token});await fetch("https://id.twitch.tv/oauth2/revoke",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body}).catch(()=>{});}for(const k of ["twitch.accessToken","twitch.refreshToken","twitch.clientSecret"])await this.secretStore.delete(k);await this.settingsStore.set("twitchSession",{});this.pending=null;return this.status();}
}
module.exports={TwitchOAuth};
