"use strict";
(()=>{
  function enhance(){
    const twitchId=document.getElementById("tw-client-id");
    if(twitchId){
      const details=twitchId.closest("details");
      if(details&&!details.dataset.battoOauthEnhanced){
        details.dataset.battoOauthEnhanced="1";
        const secret=document.getElementById("tw-client-secret");
        const secretLabel=secret?.closest("label");
        if(secretLabel){secret.value="";secretLabel.style.display="none";}
        const info=document.createElement("div");
        info.className="oauth-setup-note";
        info.innerHTML='<strong>Twitch Desktop-Anmeldung</strong><p>BATTO verwendet den Twitch Device-Code-Flow für Electron/Windows. Dafür wird nur eine Twitch Client ID benötigt – kein Client Secret. Erstelle einmal eine App in der Twitch Developer Console und trage die Client ID hier ein.</p><code>https://dev.twitch.tv/console/apps</code>';
        details.appendChild(info);
      }
    }
    const youtubeId=document.getElementById("yt-client-id");
    if(youtubeId){
      const details=youtubeId.closest("details");
      if(details&&!details.dataset.battoOauthEnhanced){
        details.dataset.battoOauthEnhanced="1";
        const info=document.createElement("div");
        info.className="oauth-setup-note";
        info.innerHTML='<strong>YouTube Desktop-Anmeldung</strong><p>Erstelle in Google Cloud einen OAuth-Client vom Typ <b>Desktop-App</b>. Die Client ID ist erforderlich. Ein Client Secret ist bei diesem Desktop-/PKCE-Flow optional.</p><code>https://console.cloud.google.com/apis/credentials</code><p class="muted">Die YouTube Data API v3 muss für das Projekt aktiviert sein.</p>';
        details.appendChild(info);
      }
    }
    const cngUrl=document.getElementById("cng-url");
    if(cngUrl){
      const card=cngUrl.closest(".card");
      if(card&&!card.dataset.battoCngEnhanced){
        card.dataset.battoCngEnhanced="1";
        const note=document.createElement("div");
        note.className="oauth-setup-note";
        note.innerHTML='<strong>CNG Realtime</strong><p>CNG ist hier bewusst kein erfundener OAuth-Login. BATTO verbindet nur eine echte bekannte WebSocket-URL samt optionalem Token. Ohne dokumentierte CNG-Realtime-Schnittstelle bleibt dieser Connector getrennt.</p>';
        card.appendChild(note);
      }
    }
  }
  const observer=new MutationObserver(enhance);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  enhance();
})();
