"use strict";
const { EventEmitter } = require("node:events");

class PlatformManager extends EventEmitter {
  constructor(chatCore){ super(); this.chatCore=chatCore; this.adapters=new Map(); }
  register(name,adapter){
    const platform=String(name).toLowerCase();
    this.adapters.set(platform,adapter);
    adapter.on?.("message",m=>this.chatCore.push({...m,platform}));
    adapter.on?.("status",s=>this.chatCore.setStatus(platform,s));
    return adapter;
  }
  async connect(platform,config={}){ const adapter=this.adapters.get(platform); if(!adapter)throw new Error(`Connector ${platform} ist nicht registriert.`); return adapter.connect(config); }
  async disconnect(platform){ const adapter=this.adapters.get(platform); return adapter?.disconnect?.(); }
  statuses(){ const result={}; for(const [name,adapter] of this.adapters) result[name]=adapter.status?.()||{connected:false}; return result; }
}
module.exports={PlatformManager};
