"use strict";
(()=>{
  const colors=window.BattoChatAppearance;
  const labels={twitch:"Twitch",tiktok:"TikTok",youtube:"YouTube",cng:"CNG"};
  window.createBattoAppearanceEditor=({api,onSaved})=>{
    let saved=colors.normalize(),draft=colors.normalize(),platform="twitch",saving=false,status="",failed=false,activePage=false;
    const twitchEditor=window.createBattoTwitchColorEditor({api,localColor:()=>draft.twitch.nameColor});
    const $=id=>document.getElementById(id);
    function announce(text,error=false){
      status=text;failed=error;
      const el=$("appearance-status");
      if(el){el.textContent=text;el.style.color=error?"var(--bad)":"";}
    }
    function preview(){
      const value=colors.resolve(draft,{platform});
      $("appearance-preview-name").style.color=value.nameColor;
      $("appearance-preview-message").style.color=value.messageColor||"#dbe3ee";
      $("appearance-preview").style.setProperty("--preview-color",value.nameColor);
      $("appearance-preview-platform").textContent=labels[platform];
      $("appearance-platform-note").textContent=platform==="cng"
        ?"Gilt für CNG-Nachrichten in BATTO. Der separate offizielle CNG-Chat bleibt unverändert."
        :"Gilt für alle angezeigten Nachrichten dieser Plattform in deinem BATTO-Chat und deinen BATTO-Overlays.";
    }
    function fill(){
      const entry=draft[platform];
      $("appearance-platform").value=platform;
      for(const [kind,key] of [["name","customName"],["message","customMessage"]]){
        $("appearance-"+kind+"-custom").checked=entry[key];
        for(const suffix of ["picker","hex"]){
          const el=$("appearance-"+kind+"-"+suffix);
          el.value=entry[kind+"Color"];el.disabled=!entry[key];el.setCustomValidity("");
        }
      }
      $("appearance-fields").disabled=saving;
      preview();announce(status,failed);
    }
    function valid(){
      for(const kind of ["name","message"]){
        const input=$("appearance-"+kind+"-hex");
        if(!input.disabled&&!colors.hex(input.value)){
          input.setCustomValidity("Bitte eine Hex-Farbe wie #9146ff eingeben.");
          input.reportValidity();announce("Bitte die markierte Farbe korrigieren.",true);return false;
        }
      }
      return true;
    }
    function markup(){return `<h2>Hologramm & Chatfarben</h2>
      <p>Deine Farben für Multi-Chat, Hologramm und Stream-Overlay. Sie werden in deinem Benutzerprofil gespeichert.</p>
      <form id="appearance-form" class="appearance-editor card">
        <h3>Farben in BATTO</h3>
        <fieldset id="appearance-fields">
          <label for="appearance-platform">Plattform</label>
          <select id="appearance-platform">${Object.entries(labels).map(([key,name])=>`<option value="${key}">${name}</option>`).join("")}</select>
          <p id="appearance-platform-note" class="muted"></p>
          ${[["name","Namensfarbe"],["message","Nachrichtenfarbe"]].map(([kind,title])=>`<div class="appearance-color">
            <label class="appearance-toggle"><input type="checkbox" id="appearance-${kind}-custom"> Eigene ${title}</label>
            <div class="appearance-inputs">
              <input type="color" id="appearance-${kind}-picker" aria-label="${title} auswählen">
              <input type="text" id="appearance-${kind}-hex" aria-label="${title} als Hex-Wert" maxlength="7" spellcheck="false" autocomplete="off">
            </div>
          </div>`).join("")}
          <p class="muted">Ohne Häkchen bleiben ursprüngliche Namensfarben und die Standard-Textfarbe der jeweiligen Ansicht erhalten.</p>
          <div class="appearance-preview-label muted">Vorschau · nur hier sichtbar</div>
          <div id="appearance-preview" class="appearance-preview">
            <div><strong id="appearance-preview-name">DeinName</strong> <span id="appearance-preview-platform" class="chat-role"></span></div>
            <div id="appearance-preview-message">Hallo zusammen! So sieht dein Chat aus.</div>
          </div>
          <div class="row appearance-actions"><button type="submit" class="primary">Farben speichern</button><button type="button" id="appearance-cancel">Änderungen verwerfen</button></div>
          <div class="row"><button type="button" id="appearance-reset">Plattform zurücksetzen</button><button type="button" id="appearance-reset-all">Alle zurücksetzen</button></div>
        </fieldset>
        <p id="appearance-status" class="muted" role="status" aria-live="polite"></p>
      </form>
      ${twitchEditor.markup()}<div class="card appearance-provider-note"><strong>Farben in den Anbieter-Chats</strong><p class="muted">Bei Twitch kannst du im Abschnitt „Meine Farbe im Twitch-Chat“ deine eigene Namensfarbe freigeben und mit „Bei Twitch speichern“ übertragen. Die lokale Farbauswahl oben gestaltet alle Nachrichten in BATTO.</p><p class="muted">Für TikTok, YouTube und CNG ist keine Übertragung frei wählbarer Namens- und Nachrichtenfarben angebunden. Ihre offiziellen Chats behalten die Anbieter-Darstellung; deine BATTO-Farben funktionieren unabhängig davon.</p></div>`;}
    function bind(active=false){
      activePage=active;
      if(!$("appearance-form"))return;
      fill();twitchEditor.bind();twitchEditor.activate(platform,activePage);
      $("appearance-platform").onchange=e=>{
        if(!valid()){e.target.value=platform;return;}
        platform=e.target.value;fill();twitchEditor.activate(platform,activePage);
      };
      for(const [kind,key] of [["name","customName"],["message","customMessage"]]){
        $("appearance-"+kind+"-custom").onchange=e=>{
          draft[platform][key]=e.target.checked;announce("Ungespeicherte Änderungen.");fill();
        };
        for(const suffix of ["picker","hex"]){
          $("appearance-"+kind+"-"+suffix).oninput=e=>{
            e.target.setCustomValidity("");
            const value=colors.hex(e.target.value);
            if(value){
              draft[platform][kind+"Color"]=value;
              $("appearance-"+kind+"-"+(suffix==="picker"?"hex":"picker")).value=value;
              preview();
            }
            announce("Ungespeicherte Änderungen.");
          };
        }
      }
      $("appearance-form").onsubmit=async e=>{
        e.preventDefault();if(saving||!valid())return;
        saving=true;$("appearance-fields").disabled=true;announce("Farben werden gespeichert …");
        try{
          saved=colors.normalize(await api.appearanceSave(draft));draft=colors.normalize(saved);
          onSaved(saved);announce("Gespeichert · Multi-Chat und BATTO-Overlays sind aktualisiert.");
        }catch(error){announce(`Speichern fehlgeschlagen: ${error.message}`,true);}
        finally{saving=false;if($("appearance-form"))fill();}
      };
      $("appearance-cancel").onclick=()=>{draft=colors.normalize(saved);announce("Ungespeicherte Änderungen verworfen.");fill();};
      $("appearance-reset").onclick=()=>{draft[platform]=colors.normalize()[platform];announce("Plattform zurückgesetzt. Zum Übernehmen speichern.");fill();};
      $("appearance-reset-all").onclick=()=>{draft=colors.normalize();announce("Alle Plattformen zurückgesetzt. Zum Übernehmen speichern.");fill();};
    }
    return {markup,bind,load(value){saved=colors.normalize(value);draft=colors.normalize(saved);}};
  };
})();
