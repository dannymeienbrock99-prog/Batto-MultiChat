"use strict";
const {normalize}=require("../shared/chat-appearance.js");

class ChatAppearanceService{
  constructor({settingsStore,onChange=()=>{}}){
    this.settingsStore=settingsStore;
    this.onChange=onChange;
    this.value=normalize();
    this.pending=Promise.resolve();
  }
  async load(){this.value=normalize(await this.settingsStore.get("chatAppearance"));return this.get();}
  get(){return normalize(this.value);}
  save(value){
    const next=normalize(value);
    const operation=this.pending.then(async()=>{
      await this.settingsStore.set("chatAppearance",next);
      this.value=next;
      this.onChange(this.get());
      return this.get();
    });
    this.pending=operation.catch(()=>{});
    return operation;
  }
}
module.exports={ChatAppearanceService};
