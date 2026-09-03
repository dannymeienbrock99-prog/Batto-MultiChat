"use strict";
(()=>{
  const scripts=[
    "multi-chat.js",
    "hologram-controls.js",
    "tiktok-live-tools.js",
    "euler-account-tools.js",
    "oauth-setup-helper.js",
    "cng-browser-tools.js",
    "chat-send-tools.js",
    "tiktok-oauth-flow.js"
  ];
  const status=()=>document.getElementById("batto-static-status");
  const setStatus=(text,error=false)=>{const el=status();if(el){el.textContent=text;el.style.color=error?"#ff9ca2":"#9fb0c8";}console.log(`[BATTO Loader] ${text}`);};
  const loadOne=src=>new Promise((resolve,reject)=>{
    setStatus(`Lade ${src} …`);
    const script=document.createElement("script");
    script.src=`./${src}?v=R20260903-5`;
    script.async=false;
    script.onload=()=>{console.log(`[BATTO Loader] OK ${src}`);resolve();};
    script.onerror=()=>reject(new Error(`${src} konnte nicht geladen werden.`));
    document.body.appendChild(script);
  });
  async function boot(){
    try{
      setStatus("Renderer-Grundseite geladen. Starte BATTO-Module …");
      for(const src of scripts)await loadOne(src);
      if(!document.querySelector(".multi-chat"))throw new Error("Alle Renderer-Dateien wurden geladen, aber .multi-chat wurde nicht erzeugt.");
      console.log("[BATTO Loader] Renderer vollständig gestartet.");
    }catch(error){
      console.error("[BATTO Loader] FEHLER",error);
      setStatus(`Renderer-Fehler: ${error?.message||error}`,true);
    }
  }
  window.addEventListener("load",()=>setTimeout(()=>void boot(),0),{once:true});
})();
