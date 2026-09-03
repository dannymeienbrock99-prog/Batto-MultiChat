"use strict";
(()=>{
  const api=window.batto;
  if(!api)return;
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  let decorating=false;
  function card(title,body){return`<div class="card"><div class="card-head"><strong>${esc(title)}</strong></div>${body}</div>`}
  function pretty(value){return JSON.stringify(value,null,2)}
  function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value}
  async function refreshApiKeyStatus(){try{const s=await api.tiktokApiKeyStatus();setText("euler-api-key-state",s.configured?"✓ Euler Stream API-Key sicher gespeichert":"○ Noch kein Euler Stream API-Key gespeichert");}catch(e){setText("euler-api-key-state",e.message)}}
  async function loadLiveCenter(){setText("tt-live-center-output","Lade LIVE Center …");try{const data=await api.tiktokLiveCenterSummary();setText("tt-live-center-output",pretty(data));}catch(e){setText("tt-live-center-output",`Fehler: ${e.message}`)}}
  function renderGift(gift){const raw=typeof gift?.raw==="string"?(()=>{try{return JSON.parse(gift.raw)}catch{return{}}})():gift?.raw||{};const name=gift?.name||gift?.title||gift?.names?.de||gift?.names?.en||raw?.names?.de||raw?.names?.en||`Gift ${gift?.id||""}`;const image=gift?.image_url||gift?.imageUrl||raw?.image_url||raw?.imageUrl||raw?.image?.url_list?.[0]||"";const diamonds=gift?.diamond_count??gift?.diamondCount??raw?.diamond_count??raw?.diamondCount??"?";return`<div class="gift-catalog-card">${image?`<img src="${esc(image)}" alt="">`:""}<div><strong>${esc(name)}</strong><small>ID ${esc(gift?.id||gift?.gift_id||"?")} · ${esc(diamonds)} Diamanten</small></div></div>`}
  async function loadGiftGallery(){const host=document.getElementById("tt-gift-gallery");if(!host)return;host.innerHTML="Lade Gift-Katalog …";try{const data=await api.tiktokGifts({pageSize:100,pageNumber:1});const gifts=data?.gifts||data?.data?.gifts||data?.response?.gifts||[];host.innerHTML=Array.isArray(gifts)&&gifts.length?`<div class="gift-catalog-grid">${gifts.map(renderGift).join("")}</div>`:`<pre class="diag">${esc(pretty(data))}</pre>`;}catch(e){host.textContent=`Fehler: ${e.message}`}}
  async function testGift(name){const out=document.getElementById("tt-gift-test-state");if(out)out.textContent=`Teste ${name} …`;try{const data=await api.tiktokGiftTest(name);if(out)out.textContent=`✓ ${data?.gift?.giftName||name} an OBS-Overlay gesendet${data?.testSource==="test-fallback"?" (Test-Fallback)":" (Euler-Katalog)"}`;}catch(e){if(out)out.textContent=`Fehler: ${e.message}`}}
  function decorate(){
    if(decorating)return;decorating=true;
    try{
      const shell=document.querySelector(".settings-shell"),nav=document.querySelector(".settings-nav"),content=document.querySelector(".settings-content");
      if(!shell||!nav||!content)return;
      if(!nav.querySelector('[data-extra-page="livecenter"]')){
        const b=document.createElement("button");b.dataset.extraPage="livecenter";b.textContent="TikTok LIVE Center";b.onclick=()=>{nav.querySelectorAll("button").forEach(x=>x.classList.remove("active"));content.querySelectorAll(".settings-page").forEach(x=>x.classList.remove("active"));b.classList.add("active");content.querySelector('[data-extra-livecenter="1"]')?.classList.add("active");};nav.appendChild(b);
      }
      if(!content.querySelector('[data-extra-livecenter="1"]')){
        const section=document.createElement("section");section.className="settings-page";section.dataset.extraLivecenter="1";section.innerHTML=`<h2>TikTok LIVE Center</h2><p>LIVE-Status, Creator-Daten, Gifts und verfügbare Analytics – getrennt von der normalen Chatansicht.</p>${card("TikTok LIVE Center",'<div class="row"><button id="tt-live-center-refresh">Daten laden</button><button id="tt-live-center-open">Offizielles LIVE Center öffnen</button></div><div id="tt-live-center-output" class="diag">Noch nicht geladen.</div>')}${card("LIVE-Studio-Werkzeuge",'<div class="tool-matrix"><span>Chat & Moderation</span><b>aktiv</b><span>Geschenk-Alerts</span><b>aktiv</b><span>Follower-/Like-Ziele</span><b>Overlay</b><span>Countdown/Timer</span><b>Overlay</b><span>Viewer-/Top-Gifter-Ranking</span><b>Overlay</b><span>Co-Host/Multi-Gast</span><b>OBS + API soweit verfügbar</b><span>Umfragen/Gift-Votes</span><b>lokale Overlay-Werkzeuge</b><span>LIVE-Match/PK</span><b>Event-Anzeige</b></div>')}`;content.appendChild(section);section.querySelector("#tt-live-center-refresh").onclick=loadLiveCenter;section.querySelector("#tt-live-center-open").onclick=()=>api.tiktokLiveCenterOpen();
      }
      const accounts=content.querySelector('.settings-page.active')?.querySelector("#tt-client-id")?.closest(".card")?.parentElement||content;
      const ttClient=document.getElementById("tt-client-id");
      if(ttClient&&!document.getElementById("euler-api-key")){
        const parent=ttClient.closest(".card");const box=document.createElement("div");box.className="card";box.innerHTML=`<div class="card-head"><strong>Euler Stream LIVE-Verbindung</strong></div><p class="muted">Der API-Key wird nur für den LIVE-Reader, den Gift-Katalog und die Euler-Signierung verwendet und verschlüsselt gespeichert.</p><label>Euler Stream API-Key<input id="euler-api-key" type="password" autocomplete="off" placeholder="einmalig aus dem Euler Stream Dashboard"></label><div class="row"><button id="euler-api-key-save">API-Key speichern</button><button id="euler-api-key-clear">Entfernen</button></div><div id="euler-api-key-state" class="muted"></div>`;parent.insertAdjacentElement("afterend",box);box.querySelector("#euler-api-key-save").onclick=async()=>{const key=box.querySelector("#euler-api-key").value.trim();try{await api.tiktokSetApiKey(key);box.querySelector("#euler-api-key").value="";await refreshApiKeyStatus()}catch(e){setText("euler-api-key-state",`Fehler: ${e.message}`)}};box.querySelector("#euler-api-key-clear").onclick=async()=>{await api.tiktokClearApiKey();refreshApiKeyStatus()};refreshApiKeyStatus();
      }
      const giftPage=Array.from(content.querySelectorAll(".settings-page")).find(s=>s.querySelector("#load-gifts"));
      if(giftPage&&!giftPage.querySelector("#tt-gift-tests")){
        const box=document.createElement("div");box.className="card";box.id="tt-gift-tests";box.innerHTML=`<div class="card-head"><strong>OBS Geschenk-Test</strong></div><p class="muted">Die App versucht zuerst den aktuellen Euler-Gift-Katalog. Nur falls der Katalog nicht erreichbar ist, werden reine Test-Metadaten verwendet.</p><div class="row"><button data-gift-test="Rosennebel">Rosennebel testen</button><button data-gift-test="Löwe">Löwe testen</button><button data-gift-test="TikTok Universe">Universe testen</button></div><div id="tt-gift-test-state" class="muted"></div><div class="row" style="margin-top:10px"><button id="tt-gift-gallery-load">Geschenk-Galerie laden</button></div><div id="tt-gift-gallery"></div>`;giftPage.appendChild(box);box.querySelectorAll("[data-gift-test]").forEach(b=>b.onclick=()=>testGift(b.dataset.giftTest));box.querySelector("#tt-gift-gallery-load").onclick=loadGiftGallery;
      }
    }finally{decorating=false}
  }
  const observer=new MutationObserver(()=>decorate());observer.observe(document.documentElement,{subtree:true,childList:true});decorate();
})();
