"use strict";
(()=>{
  const model=window.BattoAutoBroadcast;
  const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const time=value=>new Date(value).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  window.createBattoBroadcastEditor=({api,onStatus=()=>{}})=>{
    let draft=model.defaults(),state={config:model.defaults(),running:false,busy:false},busy=false,operation=0,notice="",failed=false;
    const $=id=>document.getElementById(id);
    function announce(text,error=false){notice=text;failed=error;const el=$("broadcast-feedback");if(el){el.textContent=text;el.style.color=error?"var(--bad)":"";}}
    function messagesMarkup(){return draft.messages.map((text,index)=>`<div class="broadcast-message">
      <label for="broadcast-message-${index}">Nachricht ${index+1}</label>
      <textarea id="broadcast-message-${index}" rows="3" maxlength="200" required placeholder="Deine Nachricht für den Chat">${esc(text)}</textarea>
      <div class="row"><small class="muted" id="broadcast-count-${index}">${text.length}/200 Zeichen</small><button type="button" id="broadcast-remove-${index}" aria-label="Nachricht ${index+1} entfernen">Entfernen</button></div>
    </div>`).join("")||'<p class="muted">Füge deine erste Nachricht hinzu.</p>';}
    function markup(){return `<h2>Auto-Broadcast</h2>
      <p>Deine Texte werden der Reihe nach automatisch in die ausgewählten Plattform-Chats gesendet.</p>
      <form id="broadcast-form" class="broadcast-editor card">
        <fieldset id="broadcast-fields">
          <label for="broadcast-interval">Abstand zwischen Nachrichten (Minuten)</label>
          <input id="broadcast-interval" type="number" min="1" max="1440" step="1" required value="${esc(draft.intervalMinutes)}">
          <p class="muted">Der erste Versand erfolgt nach diesem Intervall. Zum Bearbeiten einen laufenden Broadcast pausieren.</p>
          <fieldset class="broadcast-platforms"><legend>Zielplattformen</legend>
            ${Object.entries(model.platforms).map(([key,name])=>`<label class="broadcast-toggle"><input id="broadcast-platform-${key}" type="checkbox" ${draft.platforms.includes(key)?"checked":""}> ${name}</label>`).join("")}
            <label class="broadcast-toggle muted"><input type="checkbox" disabled> CNG – Senden noch nicht angebunden</label>
          </fieldset>
          <div id="broadcast-messages">${messagesMarkup()}</div>
          <div class="row"><button id="broadcast-add" type="button">Nachricht hinzufügen</button></div>
          <p class="muted">Bis zu 20 Vorlagen mit je 200 Zeichen. Jede Runde verwendet einen Text für alle ausgewählten Chats.</p>
        </fieldset>
        <div class="row broadcast-actions"><button type="submit" id="broadcast-save">Speichern</button><button type="button" class="primary" id="broadcast-start">Speichern & starten</button><button type="button" id="broadcast-pause">Pause</button></div>
        <p id="broadcast-feedback" class="muted" role="status" aria-live="polite"></p>
      </form>
      <div class="card broadcast-editor"><strong>Versandstatus</strong><p id="broadcast-state" role="status" aria-live="polite"></p><div id="broadcast-results"></div>
        <p class="muted">BATTO muss geöffnet bleiben. Nicht verbundene Chats werden übersprungen. Nach einem Neustart ist Auto-Broadcast pausiert; deine Vorlagen bleiben gespeichert.</p>
        <p class="muted">Für TikTok brauchst du zusätzlich zur LIVE-Verbindung die Euler-OAuth-Anmeldung. Bei fehlenden Schreibrechten YouTube unter „Konten“ neu autorisieren. CNG-Browserquellen können keine Nachrichten senden.</p>
      </div>`;}
    function controls(){
      if(!$("broadcast-form"))return;
      $("broadcast-fields").disabled=busy||state.running;
      $("broadcast-add").disabled=draft.messages.length>=20;
      $("broadcast-save").disabled=busy||state.running;
      $("broadcast-start").disabled=busy||state.running||state.busy||state.saving;
      $("broadcast-pause").disabled=!busy&&!state.running&&!state.busy&&!state.saving;
      const next=state.nextRunAt?` Nächste Runde: ${time(state.nextRunAt)} · Nachricht ${state.nextMessageIndex+1}.`:"";
      $("broadcast-state").textContent=state.error||((state.running?"Aktiv.":"Pausiert.")+(state.busy?" Ein Versand wird noch abgeschlossen.":next));
      const run=state.lastRun;
      $("broadcast-results").innerHTML=run?`<p class="muted">Letzte Runde · ${time(run.startedAt)} · Nachricht ${run.index+1}</p><p class="broadcast-text">${esc(run.message)}</p>${Object.entries(run.results||{}).map(([platform,result])=>`<div class="broadcast-result"><strong>${esc(model.platforms[platform]||platform)}</strong><span class="${result.state==="failed"?"broadcast-error":result.state==="submitted"?"ok":"muted"}">${esc(result.detail)}</span></div>`).join("")}`:'<p class="muted">Noch kein Versand in dieser Sitzung.</p>';
      announce(notice,failed);
    }
    function update(value){state=value;controls();onStatus(value);}
    function bindMessages(){
      draft.messages.forEach((_,index)=>{
        $("broadcast-message-"+index).oninput=e=>{
          draft.messages[index]=e.target.value;$("broadcast-count-"+index).textContent=`${e.target.value.length}/200 Zeichen`;announce("Ungespeicherte Änderungen.");
        };
        $("broadcast-remove-"+index).onclick=()=>{
          if(busy||state.running)return;
          draft.messages.splice(index,1);$("broadcast-messages").innerHTML=messagesMarkup();bindMessages();controls();announce("Ungespeicherte Änderungen.");
        };
      });
    }
    async function commit(start){
      if(busy||state.running)return;
      let config;
      try{config=model.validate(draft);if(start)model.requireReady(config)}catch(error){announce(error.message,true);return;}
      const token=++operation;busy=true;controls();announce("Speichere …");
      try{
        const saved=await api.autoBroadcastSave(config);
        if(token!==operation)return;
        draft=structuredClone(saved.config);update(saved);
        if(start){const active=await api.autoBroadcastStart();if(token!==operation)return;update(active);announce("Auto-Broadcast gestartet. Der erste Versand folgt nach dem eingestellten Intervall.");}
        else announce("Gespeichert. Auto-Broadcast ist pausiert.");
      }catch(error){if(token===operation)announce(error.message||String(error),true)}
      finally{if(token===operation){busy=false;controls();}}
    }
    async function pause(){
      const token=++operation;busy=true;controls();
      try{const value=await api.autoBroadcastPause();if(token!==operation)return;update(value);announce("Pausiert. Bereits übergebene Nachrichten können noch ankommen.");}
      catch(error){if(token===operation)announce(error.message||String(error),true)}
      finally{if(token===operation){busy=false;controls();}}
    }
    function bind(){
      if(!$("broadcast-form"))return;
      $("broadcast-interval").oninput=e=>{draft.intervalMinutes=e.target.value;announce("Ungespeicherte Änderungen.");};
      Object.keys(model.platforms).forEach(platform=>{$("broadcast-platform-"+platform).onchange=e=>{
        draft.platforms=draft.platforms.filter(p=>p!==platform);if(e.target.checked)draft.platforms.push(platform);announce("Ungespeicherte Änderungen.");
      };});
      $("broadcast-add").onclick=()=>{
        if(busy||state.running||draft.messages.length>=20)return;
        draft.messages.push("");$("broadcast-messages").innerHTML=messagesMarkup();bindMessages();controls();announce("Ungespeicherte Änderungen.");$("broadcast-message-"+(draft.messages.length-1))?.focus();
      };
      $("broadcast-form").onsubmit=e=>{e.preventDefault();return commit(false);};
      $("broadcast-start").onclick=()=>commit(true);$("broadcast-pause").onclick=pause;
      bindMessages();controls();onStatus(state);
    }
    return{markup,bind,update,load(value){state=value;draft=structuredClone(value.config);onStatus(value);}};
  };
})();
