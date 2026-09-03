"use strict";
const path=require("node:path");
const fs=require("node:fs/promises");
const {BrowserWindow,screen}=require("electron");

function intersects(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function visibleOnAnyDisplay(bounds,displays){return displays.some(d=>intersects(bounds,d.workArea));}

class ChatWindowManager{
  constructor({userDataFile,preloadPath,rendererPath,iconPath,onClosed,onDiagnostic}={}){
    this.userDataFile=userDataFile;this.preloadPath=preloadPath;this.rendererPath=rendererPath;this.iconPath=iconPath||path.join(__dirname,"..","..","resources","batto-icon.png");this.onClosed=onClosed||(()=>{});this.onDiagnostic=onDiagnostic||(()=>{});this.window=null;this.settings={x:null,y:null,width:560,height:760,alwaysOnTop:false};
  }
  async load(){try{this.settings={...this.settings,...JSON.parse(await fs.readFile(this.userDataFile,"utf8"))}}catch{}return this.settings}
  async save(){await fs.mkdir(path.dirname(this.userDataFile),{recursive:true});await fs.writeFile(this.userDataFile,JSON.stringify(this.settings,null,2),"utf8")}
  create(){
    if(this.window&&!this.window.isDestroyed()){this.window.show();this.window.focus();return this.window}
    const displays=screen.getAllDisplays(),primary=screen.getPrimaryDisplay(),work=primary.workArea;
    const width=Math.max(420,Number(this.settings.width)||560),height=Math.max(520,Number(this.settings.height)||760);
    let x=Number.isFinite(this.settings.x)?this.settings.x:work.x+Math.max(0,Math.round((work.width-width)/2));
    let y=Number.isFinite(this.settings.y)?this.settings.y:work.y+Math.max(0,Math.round((work.height-height)/2));
    if(!visibleOnAnyDisplay({x,y,width,height},displays)){
      x=work.x+Math.max(0,Math.round((work.width-width)/2));
      y=work.y+Math.max(0,Math.round((work.height-height)/2));
      this.settings={...this.settings,x,y,width,height};void this.save();
      this.onDiagnostic("Gespeicherte Fensterposition lag außerhalb aller Monitore; BATTO wurde auf den Hauptmonitor zurückgesetzt.");
    }
    this.window=new BrowserWindow({title:"Batto Multi-Chat",icon:this.iconPath,width,height,minWidth:420,minHeight:520,x,y,show:false,backgroundColor:"#070b12",autoHideMenuBar:true,webPreferences:{preload:this.preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false}});
    this.window.setAlwaysOnTop(Boolean(this.settings.alwaysOnTop));
    let shown=false;
    const ensureVisible=()=>{if(shown||!this.window||this.window.isDestroyed())return;shown=true;this.window.show();this.window.focus();};
    this.window.once("ready-to-show",ensureVisible);
    this.window.webContents.once("did-finish-load",ensureVisible);
    this.window.webContents.on("did-fail-load",(_event,code,description,url)=>{this.onDiagnostic(`Renderer konnte nicht geladen werden: ${code} ${description} ${url||""}`);ensureVisible();});
    this.window.webContents.on("render-process-gone",(_event,details)=>this.onDiagnostic(`Renderer-Prozess beendet: ${details?.reason||"unbekannt"} (${details?.exitCode??"?"})`));
    this.window.webContents.on("preload-error",(_event,preloadPath,error)=>this.onDiagnostic(`Preload-Fehler ${preloadPath}: ${error?.stack||error?.message||error}`));
    this.window.loadFile(this.rendererPath).catch(error=>{this.onDiagnostic(`loadFile fehlgeschlagen: ${error?.stack||error?.message||error}`);ensureVisible();});
    setTimeout(ensureVisible,2500);
    const capture=()=>{if(!this.window||this.window.isDestroyed())return;const b=this.window.getBounds();this.settings={...this.settings,x:b.x,y:b.y,width:b.width,height:b.height};void this.save()};
    this.window.on("move",capture);this.window.on("resize",capture);
    this.window.on("closed",()=>{this.window=null;this.onClosed()});
    return this.window;
  }
  toggleAlwaysOnTop(){this.settings.alwaysOnTop=!this.settings.alwaysOnTop;this.window?.setAlwaysOnTop(this.settings.alwaysOnTop);void this.save();return this.settings.alwaysOnTop}
}
module.exports={ChatWindowManager,visibleOnAnyDisplay};
