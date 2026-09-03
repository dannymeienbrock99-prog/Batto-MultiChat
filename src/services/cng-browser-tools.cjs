"use strict";

function normalizeCreatorId(value){
  const id=String(value||"").trim();
  if(!/^\d+$/.test(id))throw new Error("CNG Creator-ID fehlt oder ist ungültig.");
  return id;
}

function bool01(value){return value?1:0;}

class CngBrowserTools{
  constructor({runtime,ipcMain,shell,clipboard}={}){Object.assign(this,{runtime,ipcMain,shell,clipboard});}
  async config(){
    const accounts=await this.runtime.settings.get("accounts")||{};
    const cng=accounts.cng||{};
    const hasToken=Boolean(await this.runtime.secrets.get("cng.obsChatToken"));
    return{
      creatorId:String(cng.creatorId||""),
      alertTts:cng.alertTts!==false,
      chatTts:Boolean(cng.chatTts),
      hasToken
    };
  }
  async save({creatorId,obsChatToken,alertTts=true,chatTts=false}={}){
    creatorId=normalizeCreatorId(creatorId);
    const accounts=await this.runtime.settings.get("accounts")||{};
    accounts.cng={...(accounts.cng||{}),creatorId,alertTts:Boolean(alertTts),chatTts:Boolean(chatTts)};
    delete accounts.cng.websocketUrl;
    await this.runtime.settings.set("accounts",accounts);
    if(String(obsChatToken||"").trim())await this.runtime.secrets.set("cng.obsChatToken",String(obsChatToken).trim());
    return this.status();
  }
  async clearToken(){await this.runtime.secrets.delete("cng.obsChatToken");return this.status();}
  async urls(){
    const cfg=await this.config();
    const creatorId=normalizeCreatorId(cfg.creatorId);
    const alertUrl=new URL("https://cng-plattform.com/alert-overlay");
    alertUrl.searchParams.set("creatorId",creatorId);
    alertUrl.searchParams.set("alertTts",String(bool01(cfg.alertTts)));
    alertUrl.searchParams.set("chatTts",String(bool01(cfg.chatTts)));
    const token=String(await this.runtime.secrets.get("cng.obsChatToken")||"").trim();
    const chatUrl=new URL(`https://cng-plattform.com/chat-popout/${encodeURIComponent(creatorId)}`);
    chatUrl.searchParams.set("mode","obs");
    if(token)chatUrl.searchParams.set("obsChatToken",token);
    return{alertUrl:alertUrl.toString(),chatUrl:chatUrl.toString(),hasToken:Boolean(token)};
  }
  async status(){
    const cfg=await this.config();
    let alertUrl="",chatUrlReady=false;
    if(cfg.creatorId){
      const urls=await this.urls();alertUrl=urls.alertUrl;chatUrlReady=urls.hasToken;
    }
    return{...cfg,mode:"browser-source",alertUrl,chatUrlReady};
  }
  async openAlert(){const {alertUrl}=await this.urls();return this.shell.openExternal(alertUrl);}
  async openChat(){const {chatUrl,hasToken}=await this.urls();if(!hasToken)throw new Error("CNG OBS-Chat-Token fehlt.");return this.shell.openExternal(chatUrl);}
  async copyAlert(){const {alertUrl}=await this.urls();this.clipboard.writeText(alertUrl);return true;}
  async copyChat(){const {chatUrl,hasToken}=await this.urls();if(!hasToken)throw new Error("CNG OBS-Chat-Token fehlt.");this.clipboard.writeText(chatUrl);return true;}
  async addAlertToObs({sceneName,width=1920,height=1080}={}){
    const {alertUrl}=await this.urls();
    return this.runtime.obs.ensureOverlaySource({sceneName,inputName:"CNG Alerts",url:alertUrl,width,height});
  }
  async addChatToObs({sceneName,width=520,height=900}={}){
    const {chatUrl,hasToken}=await this.urls();if(!hasToken)throw new Error("CNG OBS-Chat-Token fehlt.");
    return this.runtime.obs.ensureOverlaySource({sceneName,inputName:"CNG Chat",url:chatUrl,width,height});
  }
  register(){
    const h=(name,fn)=>this.ipcMain.handle(name,fn);
    h("cng:browserStatus",()=>this.status());
    h("cng:browserSave",(_e,v)=>this.save(v||{}));
    h("cng:browserClearToken",()=>this.clearToken());
    h("cng:browserOpenAlert",()=>this.openAlert());
    h("cng:browserOpenChat",()=>this.openChat());
    h("cng:browserCopyAlert",()=>this.copyAlert());
    h("cng:browserCopyChat",()=>this.copyChat());
    h("cng:browserAddAlertObs",(_e,v)=>this.addAlertToObs(v||{}));
    h("cng:browserAddChatObs",(_e,v)=>this.addChatToObs(v||{}));
  }
}
module.exports={CngBrowserTools};
