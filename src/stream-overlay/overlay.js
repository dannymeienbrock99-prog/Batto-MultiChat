"use strict";
const chat=document.getElementById("chat");const eventBox=document.getElementById("event");
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
function addMessage(m){const el=document.createElement("div");const p=["twitch","cng","tiktok","youtube"].includes(m.platform)?m.platform:"";el.className=`msg ${p}`;el.innerHTML=`<div class="meta"><span class="platform">${esc(m.platform||"chat")}</span><span class="user">${esc(m.displayName||m.username||"User")}</span></div><div class="text">${esc(m.message||m.text||"")}</div>`;chat.appendChild(el);while(chat.children.length>8)chat.firstElementChild.remove();setTimeout(()=>el.remove(),18000);}
let eventTimer=null;function showEvent(e){clearTimeout(eventTimer);eventBox.innerHTML=`<div class="event-card">${esc(e.title||e.message||e.eventType||"Live-Ereignis")}</div>`;eventTimer=setTimeout(()=>eventBox.innerHTML="",7000);}
fetch("/api/state").then(r=>r.json()).then(d=>(d.state?.messages||[]).slice(-4).forEach(addMessage)).catch(()=>{});
const es=new EventSource("/events");es.onmessage=ev=>{try{const data=JSON.parse(ev.data);if(data.type==="chat")addMessage(data);else showEvent(data);}catch{}};
