"use strict";
(()=>{
  const api=window.batto;if(!api)return;
  let polling=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function text(value,error=false){const el=document.getElementById("tt-login-state");if(!el)return;el.textContent=value||"";el.style.color=error?"var(--bad)":"";}
  async function pollStatus(){
    if(polling)return;polling=true;
    try{
      const until=Date.now()+10*60*1000;
      while(Date.now()<until){
        const status=await api.tiktokOAuthStatus();
        if(status.connected){text("✓ TikTok Creator-Anmeldung erfolgreich verbunden");return;}
        if(status.pending?.state==="error"||status.lastError){text(`TikTok OAuth Fehler: ${status.pending?.error||status.lastError}`,true);return;}
        text("TikTok-Anmeldung wartet auf Bestätigung im Browser / QR-Code …");
        await sleep(1500);
      }
      text("TikTok-Anmeldung hat zu lange gedauert. Bitte erneut starten.",true);
    }catch(error){text(`TikTok OAuth Statusfehler: ${error?.message||error}`,true)}
    finally{polling=false}
  }
  async function start(){
    const clientId=document.getElementById("tt-client-id")?.value.trim()||"";
    const clientSecret=document.getElementById("tt-client-secret")?.value.trim()||"";
    const username=document.getElementById("tt-user")?.value.trim()||"";
    try{
      if(username){const settings=await api.settingsGet();const accounts={...(settings.accounts||{}),tiktok:{...(settings.accounts?.tiktok||{}),username}};await api.settingsPatch({accounts});}
      text("Starte TikTok Creator-Anmeldung …");
      const result=await api.tiktokOAuthBegin({clientId,clientSecret});
      if(!result?.started)throw new Error("OAuth-Start wurde nicht bestätigt.");
      text("TikTok-Anmeldung wurde im Browser geöffnet …");
      void pollStatus();
    }catch(error){text(error?.message||String(error),true)}
  }
  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("#tt-login");if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void start();
  },true);
})();
