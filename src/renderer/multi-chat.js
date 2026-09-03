"use strict";
(() => {
  const api=window.batto;
  const root=document.getElementById("multi-chat-root");
  const meta={all:["Alle","#5aa7ff","✦"],twitch:["Twitch","#9146ff","◉"],cng:["CNG","#2f9cff","◆"],tiktok:["TikTok","#111111","♪"],youtube:["YouTube","#ff3030","▶"]};
  let filter="all",messages=[],settingsPage="accounts";
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

  function settingsHtml(){return `<section class="settings-shell" id="settings" hidden>
    <header class="settings-top"><div><strong>Einstellungen & Datenschutz</strong><div class="muted">BATTO MULTI-CHAT</div></div><button class="icon-btn" id="settings-close">✕</button></header>
    <div class="settings-body">
      <nav class="settings-nav">
        ${[["accounts","Konten"],["moderation","Moderation"],["filters","Chatfilter"],["tts","TTS"],["gifts","Geschenke"],["guests","Multi-Gast"],["obs","OBS & Overlay"],["privacy","Datenschutz"],["diagnostics","Diagnose"]].map(([k,n])=>`<button data-settings-page="${k}" class="${settingsPage===k?'active':''}">${n}</button>`).join("")}
      </nav>
      <main class="settings-content">${settingsPages()}</main>
    </div>
  </section>`}

  function settingsPages(){return `
    <section class="settings-page ${settingsPage==='accounts'?'active':''}" data-page="accounts"><h2>Konten & Verbindungen</h2><p>Saubere Plattform-Anmeldungen und Verbindungsstatus.</p>
      ${accountCard("TikTok","tiktok","OAuth / QR-Code wird hier angebunden.",'<label>@Username<input id="tt-user" placeholder="@Crazy_Batto"></label><div class="row"><button id="tt-connect">TikTok LIVE verbinden</button><button data-disconnect="tiktok">Trennen</button></div>')}
      ${accountCard("Twitch","twitch","OAuth-Anmeldung vorbereitet.",'<div class="row"><button disabled>Mit Twitch anmelden</button></div>')}
      ${accountCard("YouTube","youtube","Google / YouTube OAuth vorbereitet.",'<div class="row"><button disabled>Mit YouTube anmelden</button></div>')}
      ${accountCard("CNG","cng","Eigener Connector vorbereitet.",'<div class="row"><button disabled>CNG einrichten</button></div>')}
    </section>
    <section class="settings-page ${settingsPage==='moderation'?'active':''}" data-page="moderation"><h2>Moderation</h2><p>Moderatoren, Sperren und Stummschaltungen zentral verwalten.</p><div class="card"><div class="perm"><span>Moderatoren</span><span class="muted">vorbereitet</span></div><div class="perm"><span>Gesperrte Nutzer</span><span class="muted">vorbereitet</span></div><div class="perm"><span>Stummgeschaltete Nutzer</span><span class="muted">vorbereitet</span></div></div></section>
    <section class="settings-page ${settingsPage==='filters'?'active':''}" data-page="filters"><h2>Chatfilter</h2><p>Sensible Wörter und Plattformfilter.</p><div class="card"><label>Sensible Wörter<textarea placeholder="Ein Wort pro Zeile"></textarea></label><button disabled>Speichern</button></div></section>
    <section class="settings-page ${settingsPage==='tts'?'active':''}" data-page="tts"><h2>TTS</h2><p>Stimme, Lautstärke, Geschwindigkeit und Plattformen.</p><div class="card muted">TTS-Modul wird getrennt angebunden.</div></section>
    <section class="settings-page ${settingsPage==='gifts'?'active':''}" data-page="gifts"><h2>Geschenke</h2><p>TikTok Gift-Katalog, Gift-ID, Diamanten und Combo/Streak.</p><div class="card muted">Euler Gift-Service vorbereitet.</div></section>
    <section class="settings-page ${settingsPage==='guests'?'active':''}" data-page="guests"><h2>Multi-Gast</h2><p>Gast-Slots und OBS-Zuordnung.</p><div class="card muted">Multi-Gast-Modul vorbereitet.</div></section>
    <section class="settings-page ${settingsPage==='obs'?'active':''}" data-page="obs"><h2>OBS & Overlay</h2><p>Verbindung zu OBS WebSocket und Overlay-Status.</p><div class="card"><label>OBS WebSocket URL<input id="obs-url" value="ws://127.0.0.1:4455"></label><label>Passwort<input id="obs-pass" type="password" placeholder="OBS WebSocket Passwort"></label><div class="row"><button id="obs-connect">OBS verbinden</button><button id="obs-disconnect">Trennen</button></div><div id="obs-state" class="muted"></div></div></section>
    <section class="settings-page ${settingsPage==='privacy'?'active':''}" data-page="privacy"><h2>Datenschutz & Sicherheit</h2><p>Tokens und Secrets gehören ausschließlich in den Main-Prozess.</p><div class="card"><div class="perm"><span>Renderer-Zugriff auf Secrets</span><span class="ok">gesperrt</span></div><div class="perm"><span>Context Isolation</span><span class="ok">aktiv</span></div></div></section>
    <section class="settings-page ${settingsPage==='diagnostics'?'active':''}" data-page="diagnostics"><h2>Diagnose</h2><p>Technische Zustände ohne das Chatfenster zu überladen.</p><div class="diag" id="diag">Lade Status …</div></section>`}

  function accountCard(title,key,desc,actions){return `<div class="card"><div class="card-head"><strong>${title}</strong><span class="status-dot" id="status-${key}"></span></div><p class="muted">${desc}</p>${actions}</div>`}

  function render(){root.innerHTML=`<div class="multi-chat">
    <header class="chat-head"><div class="chat-title"><span style="font-size:18px">✦</span><div><strong>BATTO MULTI-CHAT</strong><small>Twitch · CNG · TikTok · YouTube</small></div></div><div class="chat-actions"><button class="icon-btn" id="open-settings" title="Einstellungen">⚙</button><button class="icon-btn" id="always-top" title="Immer im Vordergrund">⌃</button></div></header>
    <nav class="chat-tabs">${Object.entries(meta).map(([k,v])=>`<button class="chat-tab ${filter===k?'active':''}" data-filter="${k}" ${k!=="all"?`data-platform="${k}"`:""}>${v[0]}</button>`).join("")}</nav>
    <section class="chat-body" id="chat-body"></section>
    <section class="chat-compose"><textarea id="chat-input" maxlength="1000" placeholder="Nachricht schreiben …"></textarea><div class="compose-row"><small>Anzeige und TTS laufen lokal.</small><button class="send-btn" disabled>Senden</button></div></section>
    <footer class="chat-footer"><span id="chat-status">● Initialisiere …</span><span id="chat-count">0 Nachrichten</span></footer>${settingsHtml()}</div>`;
    bind(); updateBody(); refreshStatuses();
  }

  function bind(){
    root.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});
    root.querySelector("#open-settings").onclick=()=>{root.querySelector("#settings").hidden=false;refreshStatuses();};
    root.querySelector("#settings-close").onclick=()=>root.querySelector("#settings").hidden=true;
    root.querySelector("#always-top").onclick=()=>api.toggleAlwaysOnTop();
    root.querySelectorAll("[data-settings-page]").forEach(b=>b.onclick=()=>{settingsPage=b.dataset.settingsPage;render();root.querySelector("#settings").hidden=false;refreshStatuses();});
    root.querySelector("#tt-connect")?.addEventListener("click",async()=>{try{await api.chatConnect("tiktok",{username:root.querySelector("#tt-user").value});await refreshStatuses();}catch(e){alert(e.message)}});
    root.querySelectorAll("[data-disconnect]").forEach(b=>b.onclick=async()=>{await api.chatDisconnect(b.dataset.disconnect);refreshStatuses();});
    root.querySelector("#obs-connect")?.addEventListener("click",async()=>{try{const s=await api.obsConnect({url:root.querySelector("#obs-url").value,password:root.querySelector("#obs-pass").value});setObsState(s);}catch(e){setObsState({connected:false,error:e.message})}});
    root.querySelector("#obs-disconnect")?.addEventListener("click",async()=>setObsState(await api.obsDisconnect()));
  }

  function updateBody(){const body=root.querySelector("#chat-body");const visible=messages.filter(m=>filter==="all"||m.platform===filter).slice(-300);root.querySelector("#chat-count").textContent=`${visible.length} Nachrichten`;if(!visible.length){body.innerHTML='<div class="chat-empty"><div><strong>Noch keine Nachrichten</strong><br><small>Verbinde Twitch/CNG/TikTok oder YouTube, um alles in einem Verlauf zu sehen.</small></div></div>';return;}body.innerHTML=visible.map(m=>{const v=meta[m.platform]||meta.all;return `<div class="chat-row"><span class="platform-badge" style="background:${esc(v[1])}">${v[2]}</span><div><div class="chat-meta"><span class="chat-user" style="color:${esc(v[1])}">${esc(m.displayName||m.username)}</span><span class="chat-role">${esc(v[0])}</span>${m.role?`<span class="chat-role">${esc(m.role)}</span>`:""}</div><div class="chat-message">${esc(m.message)}</div></div></div>`}).join("");body.scrollTop=body.scrollHeight;}

  async function refreshStatuses(){if(!api)return;const s=await api.chatStatuses();for(const [k,v] of Object.entries(s)){const dot=root.querySelector(`#status-${k}`);if(dot)dot.classList.toggle("on",Boolean(v.connected));}const obs=await api.obsStatus();setObsState(obs);const diag=root.querySelector("#diag");if(diag)diag.textContent=JSON.stringify({platforms:s,obs},null,2);}
  function setObsState(s){const el=root.querySelector("#obs-state");if(el)el.textContent=s?.connected?`● Verbunden · ${s.url}`:`○ Nicht verbunden${s?.error?` · ${s.error}`:""}`;}

  async function init(){render();messages=await api.chatHistory({limit:300});updateBody();api.onChatMessages(batch=>{messages.push(...batch);if(messages.length>1000)messages=messages.slice(-1000);updateBody();});api.onChatStatus(()=>{const el=root.querySelector("#chat-status");if(el)el.textContent="● Verbindungen aktualisiert";refreshStatuses();});}
  init();
})();
