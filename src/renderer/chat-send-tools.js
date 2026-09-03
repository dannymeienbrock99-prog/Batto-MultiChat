"use strict";
(()=>{
  const api=window.batto;if(!api?.chatSend)return;
  let busy=false;
  function selectedPlatform(){const active=document.querySelector('.chat-tab.active');return active?.dataset?.filter||"all";}
  async function send(){if(busy)return;const input=document.getElementById("chat-input");if(!input)return;const message=input.value.trim();if(!message)return;const platform=selectedPlatform();if(platform==="all"){alert("Bitte zuerst Twitch, TikTok oder YouTube als Chat-Tab auswählen.");return}if(platform==="cng"){alert("CNG stellt derzeit nur die OBS-Chat-/Alert-Browserquellen bereit. Nachrichten können über diese Quelle nicht gesendet werden.");return}busy=true;const button=document.getElementById("chat-send");if(button){button.disabled=true;button.textContent="Sende …"}try{await api.chatSend(platform,message);input.value=""}catch(e){alert(e.message||String(e))}finally{busy=false;if(button){button.disabled=false;button.textContent="Senden"}}}
  document.addEventListener("click",e=>{const target=e.target?.closest?.("#chat-send");if(!target)return;e.preventDefault();e.stopImmediatePropagation();void send()},true);
  document.addEventListener("keydown",e=>{if(e.target?.id!=="chat-input"||e.key!=="Enter"||e.shiftKey)return;e.preventDefault();void send()},true);
})();
