"use strict";
(()=>{
  const colors=window.BattoChatAppearance,palette=colors.twitchColors;
  window.createBattoTwitchColorEditor=({api,localColor})=>{
    let choice="blue",custom="#9146ff",dirty=false,busy="",account=null,notice="",failed=false,polling=false;
    const $=id=>document.getElementById(id);
    function message(text,error=false){notice=text;failed=error;draw();}
    function color(){return choice==="custom"?colors.hex(custom):palette[choice]?.[1]||"";}
    function choose(value){
      choice=Object.keys(palette).find(key=>palette[key][1]===value)||"custom";
      custom=colors.hex(value)||"#9146ff";
    }
    function draw(){
      if(!$("twitch-color-form"))return;
      $("twitch-color-choice").value=choice;
      $("twitch-color-hex").value=custom;
      $("twitch-color-hex").disabled=choice!=="custom";
      if(choice!=="custom")$("twitch-color-hex").setCustomValidity("");
      $("twitch-color-custom").hidden=choice!=="custom";
      $("twitch-color-fields").disabled=Boolean(busy);
      $("twitch-color-load").disabled=Boolean(busy);
      $("twitch-color-authorize").disabled=Boolean(busy);
      $("twitch-color-apply").disabled=Boolean(busy)||!account?.canUpdate;
      $("twitch-color-cancel").hidden=busy!=="auth";
      $("twitch-color-account").textContent=account?`Twitch-Konto: ${account.displayName||account.username}`:"Twitch-Farben für dein eigenes Konto freigeben oder aktuelle Farbe laden.";
      $("twitch-color-preview").textContent=account?.displayName||account?.username||"Dein Twitch-Name";
      $("twitch-color-preview").style.color=color()||"#dbe3ee";
      $("twitch-color-status").textContent=notice;
      $("twitch-color-status").style.color=failed?"var(--bad)":"";
    }
    async function load(){
      if(busy)return;busy="load";message("Twitch-Farbe wird geladen …");
      try{
        const auth=await api.twitchOAuthStatus();
        if(!auth.connected){account=null;message("Bitte zuerst Twitch-Farben freigeben.");return;}
        account=await api.twitchChatColorGet();
        if(!dirty&&account.color)choose(account.color);
        message(account.canUpdate?"Aktuelle Twitch-Farbe geladen.":"Farbe geladen. Zum Ändern bitte Twitch-Farben freigeben.");
      }catch(error){account=null;message(error.message,true);}
      finally{busy="";draw();}
    }
    async function pollAuthorization(){
      if(polling)return;polling=true;
      try{
        const auth=await api.twitchOAuthStatus();
        if(busy==="auth"&&auth.pending?.userCode)message(`Im geöffneten Twitch-Fenster bestätigen. Anmeldecode: ${auth.pending.userCode}`);
      }catch{/* The awaited authorization request reports actionable errors. */}
      finally{polling=false;}
    }
    async function authorize(){
      if(busy)return;busy="auth";message("Twitch-Freigabe wird im Browser geöffnet …");
      const timer=setInterval(()=>void pollAuthorization(),750);
      let authorized=false;
      try{await api.twitchChatColorAuthorize();authorized=true;}
      catch(error){message(error.message,true);}
      finally{clearInterval(timer);busy="";draw();}
      if(authorized)await load();
    }
    function markup(){return `<section id="twitch-color-panel" class="card appearance-editor" hidden>
      <h3>Meine Farbe im Twitch-Chat</h3>
      <p class="muted">Ändert deine eigene Namensfarbe direkt bei Twitch. Deine normalen Nachrichtentexte behalten dort die Twitch-Darstellung.</p>
      <p id="twitch-color-account" class="muted"></p>
      <div class="row"><button type="button" id="twitch-color-authorize">Twitch-Farben freigeben</button><button type="button" id="twitch-color-load">Aktuelle Farbe laden</button><button type="button" id="twitch-color-cancel" hidden>Anmeldung abbrechen</button></div>
      <form id="twitch-color-form">
        <fieldset id="twitch-color-fields">
          <label for="twitch-color-choice">Farbe bei Twitch</label>
          <select id="twitch-color-choice">${Object.entries(palette).map(([key,value])=>`<option value="${key}">${value[0]}</option>`).join("")}<option value="custom">Eigener Hex-Wert</option></select>
          <label id="twitch-color-custom" hidden>Hex-Farbe<input id="twitch-color-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Eigene Twitch-Hex-Farbe"></label>
          <p class="muted">Die Standardfarben stehen allen zur Verfügung. Freie Hex-Farben benötigen bei Twitch Prime oder Turbo.</p>
          <div class="row"><button type="button" id="twitch-color-copy">BATTO-Namensfarbe übernehmen</button></div>
          <p><strong id="twitch-color-preview"></strong></p>
          <div class="row"><button type="submit" id="twitch-color-apply" class="primary">Bei Twitch speichern</button></div>
        </fieldset>
      </form>
      <p id="twitch-color-status" class="muted" role="status" aria-live="polite"></p>
    </section>`;}
    function bind(){
      if(!$("twitch-color-form"))return;
      draw();
      $("twitch-color-choice").onchange=e=>{choice=e.target.value;dirty=true;message("Auswahl bereit. Mit „Bei Twitch speichern“ übernehmen.");};
      $("twitch-color-hex").oninput=e=>{custom=e.target.value;dirty=true;e.target.setCustomValidity("");$("twitch-color-preview").style.color=color()||"#dbe3ee";};
      $("twitch-color-copy").onclick=()=>{choose(colors.hex(localColor())||"#9146ff");dirty=true;message("BATTO-Namensfarbe ausgewählt. Mit „Bei Twitch speichern“ übernehmen.");};
      $("twitch-color-load").onclick=load;
      $("twitch-color-authorize").onclick=authorize;
      $("twitch-color-cancel").onclick=async()=>{try{await api.twitchOAuthCancel();}catch(error){message(error.message,true);}};
      $("twitch-color-form").onsubmit=async e=>{
        e.preventDefault();if(busy||!account?.canUpdate)return;
        if(!color()){
          const input=$("twitch-color-hex");input.setCustomValidity("Bitte eine Hex-Farbe wie #9146ff eingeben.");input.reportValidity();return;
        }
        busy="save";message("Namensfarbe wird bei Twitch gespeichert …");
        try{
          account=await api.twitchChatColorSet(choice==="custom"?colors.hex(custom):choice);
          dirty=false;choose(account.color);
          message(`Bei Twitch gespeichert für ${account.username}. Neue Twitch-Nachrichten verwenden diese Namensfarbe.`);
        }catch(error){message(error.message,true);}
        finally{busy="";draw();}
      };
    }
    function activate(platform,active){
      if($("twitch-color-panel"))$("twitch-color-panel").hidden=platform!=="twitch";
      if(active&&platform==="twitch")void load();
    }
    return {markup,bind,activate};
  };
})();
