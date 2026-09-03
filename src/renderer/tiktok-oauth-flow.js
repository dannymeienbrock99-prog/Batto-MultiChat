"use strict";
(()=>{
  const api=window.batto;if(!api)return;
  const BASIC_SCOPES=["webcast:fetch","user:info"];
  const EXTENDED_SCOPES=["webcast:fetch","webcast:rankings","webcast:bulk_live_check","webcast:sign_url","webcast:user_earnings","webcast:comments","webcast:chat","webcast:mute","webcast:sensitive_words","user:info","webcast:live_analytics","webcast:moderators","webcast:ban"];
  let polling=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function text(value,error=false){const el=document.getElementById("tt-login-state");if(!el)return;el.textContent=value||"";el.style.color=error?"var(--bad)":"";}
  async function pollStatus(){
    if(polling)return;polling=true;
    try{
      const until=Date.now()+10*60*1000;
      while(Date.now()<until){
        const status=await api.tiktokOAuthStatus();
        if(status.connected){text(`✓ TikTok Creator-Anmeldung erfolgreich verbunden · ${status.scopes?.length||0} Rechte`);return;}
        if(status.pending?.state==="error"||status.lastError){
          const raw=String(status.pending?.error||status.lastError||"");
          if(/access_denied/i.test(raw))text("TikTok/Euler-Anmeldung wurde nicht bestätigt oder abgebrochen. Bitte erneut starten und die Freigabe am Handy vollständig bestätigen.",true);
          else text(`TikTok OAuth Fehler: ${raw}`,true);
          return;
        }
        text("TikTok-Anmeldung wartet auf Bestätigung im Browser / QR-Code …");
        await sleep(1500);
      }
      text("TikTok-Anmeldung hat zu lange gedauert. Bitte erneut starten.",true);
    }catch(error){text(`TikTok OAuth Statusfehler: ${error?.message||error}`,true)}
    finally{polling=false}
  }
  async function start(scopes=BASIC_SCOPES){
    const clientId=document.getElementById("tt-client-id")?.value.trim()||"";
    const clientSecret=document.getElementById("tt-client-secret")?.value.trim()||"";
    const username=document.getElementById("tt-user")?.value.trim()||"";
    try{
      if(username){const settings=await api.settingsGet();const accounts={...(settings.accounts||{}),tiktok:{...(settings.accounts?.tiktok||{}),username}};await api.settingsPatch({accounts});}
      text(scopes.length<=2?"Starte TikTok Basis-Anmeldung mit 2 Rechten …":"Starte TikTok Anmeldung mit erweiterten Creator-Rechten …");
      const result=await api.tiktokOAuthBegin({clientId,clientSecret,scopes});
      if(!result?.started)throw new Error("OAuth-Start wurde nicht bestätigt.");
      text("TikTok-Anmeldung wurde im Browser geöffnet …");
      void pollStatus();
    }catch(error){text(error?.message||String(error),true)}
  }
  function decorate(){
    const button=document.getElementById("tt-login");
    if(!button||button.dataset.battoOauthDecorated==="1"||document.getElementById("tt-oauth-extended"))return;
    button.dataset.battoOauthDecorated="1";
    button.textContent="TikTok Basis-Login testen";
    const extended=document.createElement("button");extended.id="tt-oauth-extended";extended.textContent="Creator-Rechte freischalten";
    button.insertAdjacentElement("afterend",extended);
    const hint=document.createElement("div");hint.className="muted";hint.id="tt-oauth-hint";hint.textContent="Basis-Test: nur LIVE-Zugriff + Kontoinfo. Erst wenn das klappt, Creator-Rechte wie Chat, Mute, Ban und Moderatoren freischalten.";
    extended.closest(".row")?.insertAdjacentElement("afterend",hint);
    extended.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void start(EXTENDED_SCOPES);},true);
  }
  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("#tt-login");if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void start(BASIC_SCOPES);
  },true);
  const observer=new MutationObserver(()=>decorate());observer.observe(document.documentElement,{subtree:true,childList:true});decorate();
})();
