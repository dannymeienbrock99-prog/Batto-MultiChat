"use strict";
const {defaults,validate,requireReady}=require("../shared/auto-broadcast.js");

class AutoBroadcast{
  constructor({settingsStore,send,getStatuses,onChange=()=>{},now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,sendTimeoutMs=20000}={}){
    Object.assign(this,{settingsStore,send,getStatuses,onChange,now,setTimer,clearTimer,sendTimeoutMs});
    this.config=defaults();this.running=false;this.busy=false;this.saving=0;
    this.timer=null;this.nextRunAt=0;this.nextMessageIndex=0;this.lastRun=null;this.error="";
    this.controller=null;this.pendingSave=Promise.resolve();this.closed=false;
  }
  async load(){
    const saved=await this.settingsStore.get("autoBroadcast");
    if(saved)try{this.config=validate(saved)}catch{this.error="Gespeicherte Auto-Broadcast-Einstellungen sind ungültig. Bitte neu speichern."}
    // Only configuration is persisted. Opening BATTO never starts sending.
    return this.status();
  }
  status(){return structuredClone({config:this.config,running:this.running,busy:this.busy,saving:this.saving>0,nextRunAt:this.nextRunAt,nextMessageIndex:this.nextMessageIndex,lastRun:this.lastRun,error:this.error});}
  changed(){this.onChange(this.status());}
  save(value){
    const config=validate(value);
    if(this.closed)throw new Error("Auto-Broadcast wurde beendet.");
    this.pause();this.saving++;this.changed();
    const operation=this.pendingSave.then(async()=>{
      await this.settingsStore.set("autoBroadcast",config);
      this.config=config;this.nextMessageIndex=0;this.error="";
    });
    this.pendingSave=operation.catch(()=>{});
    return operation.finally(()=>{this.saving--;this.changed()}).then(()=>this.status());
  }
  start(){
    if(this.closed)throw new Error("Auto-Broadcast wurde beendet.");
    if(this.running)return this.status();
    if(this.saving)throw new Error("Die Einstellungen werden noch gespeichert.");
    if(this.busy)throw new Error("Der vorige Versand wird noch beendet. Bitte kurz warten.");
    requireReady(this.config);
    this.running=true;this.error="";this.schedule();this.changed();return this.status();
  }
  pause(){
    this.running=false;this.nextRunAt=0;
    if(this.timer!==null)this.clearTimer(this.timer);
    this.timer=null;this.controller?.abort();this.changed();return this.status();
  }
  stop(){this.closed=true;return this.pause();}
  schedule(){
    if(!this.running||this.closed)return;
    const delay=this.config.intervalMinutes*60000;
    this.nextRunAt=this.now()+delay;
    this.timer=this.setTimer(()=>{
      this.timer=null;
      void this.run().catch(error=>{this.error=String(error?.message||error);this.pause()});
    },delay);
    this.timer?.unref?.();
  }
  async deliver(platform,message,signal){
    let timer,abortListener;
    const timeout=new AbortController();
    const requestSignal=AbortSignal.any([signal,timeout.signal]);
    try{
      if(!this.getStatuses()?.[platform]?.connected)return{state:"skipped",detail:"Chat nicht verbunden; nicht nachgeholt."};
      requestSignal.throwIfAborted();
      const aborted=new Promise((_,reject)=>{
        abortListener=()=>reject(requestSignal.reason);
        requestSignal.addEventListener("abort",abortListener,{once:true});
      });
      timer=this.setTimer(()=>timeout.abort(new Error("Zeitüberschreitung beim Senden. Die Zustellung ist unklar.")),this.sendTimeoutMs);
      timer?.unref?.();
      // The sender must honor the signal before writing, including after OAuth awaits.
      const result=await Promise.race([this.send(platform,message,{signal:requestSignal}),aborted]);
      if(result?.ok===false)throw new Error("Die Plattform hat die Nachricht abgelehnt.");
      return{state:"submitted",detail:platform==="twitch"?"An Twitch übergeben; IRC bestätigt die Anzeige nicht.":"Von der Sende-API angenommen."};
    }catch(error){
      if(signal.aborted)return{state:"canceled",detail:"Abgebrochen. Bereits übergebene Nachrichten können noch ankommen."};
      return{state:"failed",detail:String(error?.message||error).slice(0,500)};
    }finally{
      if(timer!==undefined)this.clearTimer(timer);
      if(abortListener)requestSignal.removeEventListener("abort",abortListener);
    }
  }
  async run(){
    if(!this.running||this.busy||this.closed)return;
    this.busy=true;this.nextRunAt=0;
    const controller=new AbortController();this.controller=controller;
    const index=this.nextMessageIndex,message=this.config.messages[index];
    const run={startedAt:this.now(),completedAt:0,message,index,results:{}};
    this.lastRun=run;this.changed();
    try{
      const results=await Promise.all(this.config.platforms.map(async platform=>[platform,await this.deliver(platform,message,controller.signal)]));
      run.results=Object.fromEntries(results);
      // Offline periods do not accumulate messages or consume the next template.
      if(!controller.signal.aborted&&results.some(([,r])=>r.state!=="skipped"))this.nextMessageIndex=(index+1)%this.config.messages.length;
    }finally{
      run.completedAt=this.now();this.busy=false;this.controller=null;
      // A single timer is armed after completion: no overlap or catch-up bursts.
      this.schedule();this.changed();
    }
  }
}
module.exports={AutoBroadcast};
