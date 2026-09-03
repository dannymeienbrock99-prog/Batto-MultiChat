"use strict";
const { EventEmitter } = require("node:events");
class BaseAdapter extends EventEmitter {
  constructor(platform){ super(); this.platform=platform; this.connected=false; this.configured=false; }
  status(){ return {platform:this.platform,connected:this.connected,configured:this.configured}; }
  emitStatus(extra={}){ this.emit("status",{...this.status(),...extra}); }
  async connect(){ throw new Error(`${this.platform} Connector ist noch nicht konfiguriert.`); }
  async disconnect(){ this.connected=false; this.emitStatus(); return this.status(); }
}
module.exports={BaseAdapter};
