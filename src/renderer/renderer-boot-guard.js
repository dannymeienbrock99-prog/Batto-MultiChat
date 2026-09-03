"use strict";
(()=>{
  const root=document.getElementById("multi-chat-root");
  if(!root)return;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const started=Date.now();
  function shell(message="BATTO MULTI-CHAT wird geladen …",detail=""){
    if(root.querySelector(".multi-chat"))return;
    root.innerHTML=`<div style="height:100%;display:grid;place-items:center;background:#090d14;color:#e9eef6;font:14px system-ui,-apple-system,Segoe UI,sans-serif"><div style="width:min(460px,calc(100% - 40px));padding:24px;border:1px solid #223044;border-radius:12px;background:#0c121c;box-shadow:0 18px 60px #0008"><div style="font-size:18px;font-weight:800;margin-bottom:8px">BATTO MULTI-CHAT</div><div id="batto-boot-message" style="color:#9fb0c8">${esc(message)}</div>${detail?`<pre style="white-space:pre-wrap;margin:14px 0 0;padding:10px;border-radius:8px;background:#080d14;color:#ff9ca2;border:1px solid #4a2730">${esc(detail)}</pre>`:""}</div></div>`;
  }
  function fail(title,error){
    const detail=error?.stack||error?.message||String(error||"");
    shell(title,detail);
    console.error(title,error);
  }
  shell();
  window.addEventListener("error",event=>fail("Renderer-Fehler beim Start",event.error||event.message));
  window.addEventListener("unhandledrejection",event=>fail("Unbehandelter Renderer-/IPC-Fehler",event.reason));
  setTimeout(()=>{
    if(root.querySelector(".multi-chat"))return;
    if(!window.batto){
      fail("Preload wurde nicht geladen","window.batto fehlt. Der Electron-Preload konnte die BATTO-API nicht bereitstellen.");
      return;
    }
    const elapsed=Math.round((Date.now()-started)/1000);
    shell(`Renderer wartet seit ${elapsed} Sekunden auf den Main-Prozess …`,`Preload ist vorhanden, aber die Hauptoberfläche wurde noch nicht gerendert. Prüfe BATTO-Startdiagnose / IPC-Handler.`);
  },4000);
})();
