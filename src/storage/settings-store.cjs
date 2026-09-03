"use strict";
const fs=require("node:fs/promises");
const path=require("node:path");
class SettingsStore{
  constructor(file,defaults={}){this.file=path.resolve(file);this.defaults=structuredClone(defaults);this.data=structuredClone(defaults);this.loaded=false;}
  async load(){if(this.loaded)return this.data;try{const raw=JSON.parse(await fs.readFile(this.file,"utf8"));this.data={...structuredClone(this.defaults),...(raw&&typeof raw==="object"?raw:{})};}catch{this.data=structuredClone(this.defaults);}this.loaded=true;return this.data;}
  async get(key){await this.load();return key?this.data[key]:structuredClone(this.data);}
  async set(key,value){await this.load();this.data[key]=value;await this.save();return value;}
  async patch(value){await this.load();this.data={...this.data,...value};await this.save();return structuredClone(this.data);}
  async save(){await fs.mkdir(path.dirname(this.file),{recursive:true});const tmp=`${this.file}.${process.pid}.tmp`;await fs.writeFile(tmp,JSON.stringify(this.data,null,2),{encoding:"utf8",mode:0o600});await fs.rename(tmp,this.file);}
}
module.exports={SettingsStore};
