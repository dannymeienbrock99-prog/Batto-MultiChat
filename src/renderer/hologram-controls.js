"use strict";
(()=>{
  const api=window.batto;
  if(!api)return;
  function mount(){
    const overlayState=document.getElementById("overlay-state");
    if(!overlayState)return;
    const host=overlayState.closest(".card")?.parentElement;
    if(!host||document.getElementById("hologram-card"))return;
    const card=document.createElement("div");card.className="card";card.id="hologram-card";
    card.innerHTML=`<div class="perm"><span>BATTO Hologramm</span><strong id="hologram-url">http://127.0.0.1:17821/hologram</strong></div><p class="muted">Eigene transparente OBS-Browserquelle für Namen, Rollen und Chattext.</p><div class="row"><button id="hologram-open">Öffnen</button><button id="hologram-copy">URL kopieren</button><button id="hologram-add">In ausgewählte OBS-Szene einfügen</button></div><div id="hologram-state" class="muted"></div>`;
    host.appendChild(card);
    card.querySelector("#hologram-open").onclick=()=>api.hologramOpen();
    card.querySelector("#hologram-copy").onclick=()=>api.hologramCopyUrl();
    card.querySelector("#hologram-add").onclick=async()=>{try{const scene=document.getElementById("obs-scene")?.value;if(!scene)throw new Error("Bitte zuerst eine OBS-Szene auswählen.");await api.obsEnsureHologram({sceneName:scene,inputName:"BATTO Hologramm",width:1200,height:500});alert("BATTO Hologramm wurde der OBS-Szene hinzugefügt bzw. war bereits vorhanden.");}catch(e){alert(e.message)}};
    void refresh();
  }
  async function refresh(){const state=document.getElementById("hologram-state"),url=document.getElementById("hologram-url");if(!state)return;try{const s=await api.hologramStatus();if(url)url.textContent=s.url||"http://127.0.0.1:17821/hologram";state.textContent=s.active?`● Lokal aktiv · Port ${s.port}`:"○ Hologramm offline";}catch(e){state.textContent=`Fehler: ${e.message}`}}
  new MutationObserver(()=>mount()).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener("DOMContentLoaded",mount);setInterval(()=>{mount();void refresh()},3000);
})();
