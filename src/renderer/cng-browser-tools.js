"use strict";
(()=>{
  const api=window.batto;if(!api)return;
  let busy=false;
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  function sceneName(){return document.getElementById("obs-scene")?.value||"";}
  function state(text,error=false){const el=document.getElementById("cng-browser-state");if(el){el.textContent=text;el.classList.toggle("error",Boolean(error));}}
  async function refresh(){
    try{
      const s=await api.cngBrowserStatus();
      const creator=document.getElementById("cng-creator-id");if(creator&&!creator.value)creator.value=s.creatorId||"";
      const alert=document.getElementById("cng-alert-tts");if(alert)alert.checked=s.alertTts!==false;
      const chat=document.getElementById("cng-chat-tts");if(chat)chat.checked=Boolean(s.chatTts);
      state(`${s.creatorId?`Creator ${s.creatorId} · `:""}${s.hasToken?"✓ OBS-Chat-Token gespeichert":"○ OBS-Chat-Token fehlt"}`);
    }catch(e){state(`Fehler: ${e.message}`,true)}
  }
  async function save(){
    const creatorId=document.getElementById("cng-creator-id")?.value.trim()||"";
    const obsChatToken=document.getElementById("cng-obs-token")?.value.trim()||"";
    const alertTts=Boolean(document.getElementById("cng-alert-tts")?.checked);
    const chatTts=Boolean(document.getElementById("cng-chat-tts")?.checked);
    state("Speichere CNG-Einstellungen …");
    try{await api.cngBrowserSave({creatorId,obsChatToken,alertTts,chatTts});const token=document.getElementById("cng-obs-token");if(token)token.value="";await refresh();}
    catch(e){state(`Fehler: ${e.message}`,true)}
  }
  async function run(action,ok){try{await save();await action();state(ok)}catch(e){state(`Fehler: ${e.message}`,true)}}
  function decorate(){
    if(busy)return;busy=true;
    try{
      const old=document.getElementById("cng-url");if(!old)return;
      const card=old.closest(".card");if(!card||card.dataset.cngBrowserMode==="1")return;
      card.dataset.cngBrowserMode="1";
      card.innerHTML=`<div class="card-head"><strong>CNG</strong><span class="status-dot"></span></div>
        <p class="muted">CNG liefert für OBS eine Alert-Browserquelle und einen geschützten Chat-Popout. BATTO nutzt genau diese offiziellen URLs; es wird kein nicht vorhandener CNG-WebSocket erfunden.</p>
        <label>Creator-ID<input id="cng-creator-id" inputmode="numeric" placeholder="z. B. 210048"></label>
        <label>OBS-Chat-Token<input id="cng-obs-token" type="password" autocomplete="off" placeholder="obsChatToken aus der CNG Chat-Popout-URL"></label>
        <div class="row"><label class="inline-check"><input id="cng-alert-tts" type="checkbox" checked> Alert-TTS</label><label class="inline-check"><input id="cng-chat-tts" type="checkbox"> Chat-TTS</label></div>
        <div class="row"><button class="primary" id="cng-save-browser">CNG speichern</button><button id="cng-clear-token">Chat-Token entfernen</button></div>
        <div id="cng-browser-state" class="muted"></div>
        <details open><summary>OBS Browserquellen</summary>
          <p class="muted">OBS vorher unter „OBS & Overlay“ verbinden und eine Szene auswählen.</p>
          <div class="row"><button id="cng-obs-alert">CNG Alerts zu OBS</button><button id="cng-obs-chat">CNG Chat zu OBS</button></div>
          <div class="row"><button id="cng-open-alert">Alert öffnen</button><button id="cng-open-chat">Chat öffnen</button><button id="cng-copy-alert">Alert-URL kopieren</button><button id="cng-copy-chat">Chat-URL kopieren</button></div>
        </details>
        <p class="muted"><strong>Hinweis:</strong> Der Chat-Token ist ein Geheimnis. Er wird lokal verschlüsselt gespeichert und nicht im GitHub-Repo abgelegt.</p>`;
      card.querySelector("#cng-save-browser").onclick=save;
      card.querySelector("#cng-clear-token").onclick=async()=>{try{await api.cngBrowserClearToken();await refresh()}catch(e){state(`Fehler: ${e.message}`,true)}};
      card.querySelector("#cng-open-alert").onclick=()=>run(()=>api.cngBrowserOpenAlert(),"CNG Alert-Overlay geöffnet.");
      card.querySelector("#cng-open-chat").onclick=()=>run(()=>api.cngBrowserOpenChat(),"CNG Chat-Popout geöffnet.");
      card.querySelector("#cng-copy-alert").onclick=()=>run(()=>api.cngBrowserCopyAlert(),"CNG Alert-URL kopiert.");
      card.querySelector("#cng-copy-chat").onclick=()=>run(()=>api.cngBrowserCopyChat(),"CNG Chat-URL kopiert.");
      card.querySelector("#cng-obs-alert").onclick=()=>run(async()=>{const s=sceneName();if(!s)throw new Error("Bitte zuerst unter OBS & Overlay eine OBS-Szene auswählen.");await api.cngBrowserAddAlertObs({sceneName:s,width:1920,height:1080})},"CNG Alerts wurden der OBS-Szene hinzugefügt.");
      card.querySelector("#cng-obs-chat").onclick=()=>run(async()=>{const s=sceneName();if(!s)throw new Error("Bitte zuerst unter OBS & Overlay eine OBS-Szene auswählen.");await api.cngBrowserAddChatObs({sceneName:s,width:520,height:900})},"CNG Chat wurde der OBS-Szene hinzugefügt.");
      refresh();
    }finally{busy=false}
  }
  const observer=new MutationObserver(decorate);observer.observe(document.documentElement,{subtree:true,childList:true});decorate();
})();
