"use strict";
(()=>{
  const api=window.batto;if(!api?.tiktokEulerAccount)return;
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const pretty=v=>JSON.stringify(v,null,2);
  let busy=false;
  async function check(){const out=document.getElementById("euler-account-output");if(!out)return;out.textContent="Prüfe Euler Sign API Account …";try{const [account,limits]=await Promise.all([api.tiktokEulerAccount(),api.tiktokEulerRateLimits()]);out.textContent=pretty({account,rateLimits:limits})}catch(e){out.textContent=`Fehler: ${e.message||e}`}}
  function decorate(){if(busy)return;busy=true;try{const key=document.getElementById("euler-api-key");if(!key||document.getElementById("euler-account-check"))return;const card=key.closest(".card");if(!card)return;const box=document.createElement("div");box.className="card";box.id="euler-account-check";box.innerHTML=`<div class="card-head"><strong>Euler Sign API Account</strong></div><p class="muted">Prüft den gespeicherten API-Key direkt gegen Euler <code>/accounts/me</code> und <code>/accounts/me/rate_limits</code>. Der API-Key wird nicht angezeigt.</p><div class="row"><button id="euler-account-run">Account & Limits prüfen</button></div><pre id="euler-account-output" class="diag">Noch nicht geprüft.</pre>`;card.insertAdjacentElement("afterend",box);box.querySelector("#euler-account-run").onclick=check;}finally{busy=false}}
  const observer=new MutationObserver(decorate);observer.observe(document.documentElement,{subtree:true,childList:true});decorate();
})();
