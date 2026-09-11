"use strict";
const root=document.getElementById("overlay");let config={elements:[]},state={messages:[],events:[],stats:{likeCount:0,topGifters:[]}},timerStarted=Date.now();
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
function style(el){return`left:${el.x}%;top:${el.y}%;width:${el.width}%;height:${el.height}%;z-index:${el.zIndex};font-size:${el.fontSize}px;font-family:${el.fontFamily};font-weight:${el.fontWeight};color:${el.textColor};background:${hexAlpha(el.backgroundColor,el.backgroundOpacity)};border:${el.borderWidth}px solid ${el.borderColor};border-radius:${el.borderRadius}px;padding:${el.padding}px;box-shadow:0 0 ${el.shadow}px ${hexAlpha(el.accentColor,.25)};--accent:${el.accentColor};`}
function hexAlpha(hex,a){const h=String(hex||"#000000").replace('#','');if(h.length!==6)return`rgba(0,0,0,${a})`;return`rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${Number(a)})`}
function title(el){return`<span class="overlay-title">${esc(el.title||'')}</span>`}
function giftData(event={}){const g=event.gift||event.data?.gift||{};return{giftId:g.giftId||g.id||event.giftId||0,name:g.giftName||g.name||event.giftName||event.title||"Geschenk",image:g.imageUrl||g.image_url||event.giftPictureUrl||event.imageUrl||"",diamonds:Number(g.diamondCount||g.diamond_count||event.diamondCount||0)||0,repeat:Number(g.repeatCount||event.repeatCount||1)||1,total:Number(g.totalDiamonds||0)||((Number(g.diamondCount||0)||0)*(Number(g.repeatCount||1)||1)),user:event.displayName||event.username||event.name||"TikTok User"}}
function giftEvents(){return state.events.filter(e=>(e.eventType||e.type)==='gift'||e.gift)}
function chatHtml(el){return state.messages.slice(-Number(el.maximumItems||8)).map(m=>`<div class="msg ${esc(m.platform||'')}"><div class="meta"><span class="platform">${esc(m.platform||'chat')}</span><span class="user"${/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(m.color||"")?` style="color:${esc(m.color)}"`:""}>${esc(m.displayName||m.username||'User')}</span></div><div class="text">${esc(m.message||m.text||'')}</div></div>`).join('')}
function giftRow(event){const g=giftData(event);return`<div class="gift-row">${g.image?`<img class="gift-image" src="${esc(g.image)}" alt="">`:''}<div class="gift-copy"><strong>${esc(g.user)}</strong><span>${esc(g.name)}${g.repeat>1?` ×${g.repeat}`:''}</span>${g.diamonds?`<small>${g.diamonds.toLocaleString('de-DE')} Diamanten${g.repeat>1?` · gesamt ${g.total.toLocaleString('de-DE')}`:''}</small>`:''}</div></div>`}
function giftsHtml(el){return giftEvents().slice(-Number(el.maximumItems||8)).map(giftRow).join('')}
function giftAlarmHtml(el,event){const g=giftData(event),tier=g.diamonds>=10000?'legendary':g.diamonds>=1000?'major':'normal';return`${title(el)}<div class="gift-alarm ${tier}">${g.image?`<img src="${esc(g.image)}" alt="">`:''}<div><small>${esc(g.user)} sendet</small><strong>${esc(g.name)}${g.repeat>1?` ×${g.repeat}`:''}</strong>${g.diamonds?`<span>${g.total.toLocaleString('de-DE')} Diamanten</span>`:''}</div></div>`}
function topGifters(){return(state.stats?.topGifters||[]).map(user=>[user.displayName||user.username||"Unbekannt",user.totalDiamonds])}
function elementHtml(el){if(el.visible===false)return'';let body='';if(el.type==='goal'){const pct=Math.max(0,Math.min(100,(Number(el.value)||0)/Math.max(1,Number(el.target)||1)*100));body=`${title(el)}<span class="overlay-value">${esc(el.value||0)} / ${esc(el.target||0)}</span><span class="progress"><i style="width:${pct}%"></i></span>`}else if(el.type==='timer'){body=`${title(el)}<span class="overlay-value" data-timer>00:00:00</span>`}else if(el.type==='chat'){body=`${title(el)}<div class="overlay-chat">${chatHtml(el)}</div>`}else if(el.type==='giftFeed'){body=`${title(el)}<div class="overlay-gifts">${giftsHtml(el)}</div>`}else if(el.type==='giftAlarm'){const event=giftEvents().at(-1);if(!event)return'';body=giftAlarmHtml(el,event)}else if(el.type==='likeCounter'){const likes=Number(state.stats?.likeCount||0);body=`${title(el)}<span class="overlay-value">${likes.toLocaleString('de-DE')}</span>`}else if(el.type==='coHost'){body=`${title(el)}<span class="overlay-value">${esc(el.text||'Kein Co-Host')}</span>`}else if(el.type==='topList'){const rows=topGifters();body=`${title(el)}<div class="top-gifters">${rows.length?rows.map(([name,value],i)=>`<div><b>#${i+1}</b><span>${esc(name)}</span><strong>${value.toLocaleString('de-DE')}</strong></div>`).join(''):'<span class="overlay-value">Noch keine Gifts</span>'}</div>`}else if(el.type==='tiktokEvents'){const e=state.events.at(-1);body=`${title(el)}<span class="overlay-value">${esc(e?.title||e?.message||e?.eventType||'Keine Ereignisse')}</span>`}else if(el.type==='logo'){body=`${title(el)}<span class="overlay-value">BATTO</span>`}else{body=`${title(el)}<span class="overlay-value">${esc(el.text||el.title||'')}</span>`}return`<section class="overlay-element overlay-${el.type}" data-id="${esc(el.id)}" style="${style(el)}">${body}</section>`}
function render(){root.style.background=config.transparent===false?hexAlpha(config.backgroundColor,config.backgroundOpacity):'transparent';root.innerHTML=(config.elements||[]).sort((a,b)=>(a.zIndex||0)-(b.zIndex||0)).map(elementHtml).join('');updateTimers()}
function updateTimers(){const elapsed=Math.max(0,Date.now()-timerStarted),total=Math.floor(elapsed/1000),h=String(Math.floor(total/3600)).padStart(2,'0'),m=String(Math.floor(total%3600/60)).padStart(2,'0'),s=String(total%60).padStart(2,'0');document.querySelectorAll('[data-timer]').forEach(x=>x.textContent=`${h}:${m}:${s}`)}setInterval(updateTimers,1000);
// Every SSE connection starts with one ordered snapshot, including session totals.
// A second HTTP fetch could overwrite newer live events with an older snapshot.
function receive(data){
  if(data.type==='config'){
    config=data.config||config;
    if(data.state){state=data.state;timerStarted=state.startedAt||Date.now()}
    render();return;
  }
  if(data.type==='clear'){
    state={...state,messages:[],events:[],stats:data.stats||{likeCount:0,topGifters:[]}};
    render();return;
  }
  if(data.type==='chat'){
    state.messages.push(data);
    if(state.messages.length>250)state.messages.shift();
  }else{
    if(data.stats)state.stats=data.stats;
    state.events.push(data);
    if(state.events.length>100)state.events.shift();
  }
  render();
}
const es=new EventSource('/events');
es.onmessage=ev=>{try{receive(JSON.parse(ev.data))}catch{}};
