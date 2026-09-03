"use strict";
const fs=require("node:fs/promises");
const path=require("node:path");
class SecretStore{
  constructor(filename,safeStorage){this.filename=filename;this.safeStorage=safeStorage;this.values={};this.loaded=false;}
  async load(){if(this.loaded)return;try{this.values=JSON.parse(await fs.readFile(this.filename,"utf8"));}catch{this.values={};}this.loaded=true;}
  available(){return Boolean(this.safeStorage?.isEncryptionAvailable?.());}
  async get(key){await this.load();const v=this.values[key];if(!v||!this.available())return"";try{return this.safeStorage.decryptString(Buffer.from(v,"base64"));}catch{return"";}}
  async set(key,value){await this.load();if(!this.available())throw new Error("Windows-Verschlüsselung ist nicht verfügbar.");if(!value)delete this.values[key];else this.values[key]=this.safeStorage.encryptString(String(value)).toString("base64");await fs.mkdir(path.dirname(this.filename),{recursive:true});await fs.writeFile(this.filename,JSON.stringify(this.values,null,2),"utf8");}
  async delete(key){await this.set(key,"");}
}
module.exports={SecretStore};
