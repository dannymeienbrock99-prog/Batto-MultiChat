"use strict";
const path=require("node:path");
const fs=require("node:fs/promises");
const {BrowserWindow,screen}=require("electron");
class ChatWindowManager{
  constructor({userDataFile,preloadPath,rendererPath,iconPath,onClosed}={}){this.userDataFile=userDataFile;this.preloadPath=preloadPath;this.rendererPath=rendererPath;this.iconPath=iconPath||path.join(__dirname,"..","..","resources","batto-icon.png");this.onClosed=onClosed||(()=>{});this.window=null;this.settings={x:null,y:null,width:560,height:760,alwaysOnTop:false};}
  async load(){try{this.settings={...this.settings,...JSON.parse(await fs.readFile(this.userDataFile,"utf8"))}}catch{}return this.settings}
  async save(){await fs.mkdir(path.dirname(this.userDataFile),{recursive:true});await fs.writeFile(this.userDataFile,JSON.stringify(this.settings,null,2),"utf8")}
  create(){if(this.window&&!this.window.isDestroyed()){this.window.show();this.window.focus();return this.window}const display=screen.getPrimaryDisplay(),work=display.workArea,x=Number.isFinite(this.settings.x)?this.settings.x:work.x+Math.max(0,Math.round((work.width-this.settings.width)/2)),y=Number.isFinite(this.settings.y)?this.settings.y:work.y+Math.max(0,Math.round((work.height-this.settings.height)/2));this.window=new BrowserWindow({title:"Batto Multi-Chat",icon:this.iconPath,width:this.settings.width,height:this.settings.height,minWidth:420,minHeight:520,x,y,show:false,backgroundColor:"#070b12",autoHideMenuBar:true,webPreferences:{preload:this.preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false}});this.window.setAlwaysOnTop(Boolean(this.settings.alwaysOnTop));this.window.loadFile(this.rendererPath);this.window.once("ready-to-show",()=>this.window?.show());const capture=()=>{if(!this.window||this.window.isDestroyed())return;const b=this.window.getBounds();this.settings={...this.settings,x:b.x,y:b.y,width:b.width,height:b.height};void this.save()};this.window.on("move",capture);this.window.on("resize",capture);this.window.on("closed",()=>{this.window=null;this.onClosed()});return this.window}
  toggleAlwaysOnTop(){this.settings.alwaysOnTop=!this.settings.alwaysOnTop;this.window?.setAlwaysOnTop(this.settings.alwaysOnTop);void this.save();return this.settings.alwaysOnTop}
}
module.exports={ChatWindowManager};
