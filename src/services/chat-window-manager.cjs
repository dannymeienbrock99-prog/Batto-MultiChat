"use strict";
const path=require("node:path");
const fs=require("node:fs/promises");
const {pathToFileURL}=require("node:url");
const {BrowserWindow,screen}=require("electron");

const RENDERER_MARKER="BATTO-R20260903-2";
function intersects(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function overlapArea(a,b){const left=Math.max(a.x,b.x),top=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);return Math.max(0,right-left)*Math.max(0,bottom-top);}
function visibleOnAnyDisplay(bounds,displays){return displays.some(d=>intersects(bounds,d.workArea)&&overlapArea(bounds,d.workArea)>=Math.min(120,bounds.width)*Math.min(80,bounds.height));}
function centeredBounds(work,width,height){width=Math.min(Math.max(420,width),work.width);height=Math.min(Math.max(520,height),work.height);return{x:work.x+Math.max(0,Math.round((work.width-width)/2)),y:work.y+Math.max(0,Math.round((work.height-height)/2)),width,height};}

class ChatWindowManager{
  constructor({userDataFile,preloadPath,rendererPath,iconPath,onClosed,onDiagnostic}={}){
    this.userDataFile=userDataFile;this.preloadPath=preloadPath;this.rendererPath=path.resolve(rendererPath);this.iconPath=iconPath||path.join(__dirname,"..","..","resources","batto-icon.png");this.onClosed=onClosed||(()=>{});this.onDiagnostic=onDiagnostic||((message)=>console.error(`[BATTO Renderer] ${message}`));this.window=null;this.settings={x:null,y:null,width:560,height:760,alwaysOnTop:false};
  }
  async load(){try{this.settings={...this.settings,...JSON.parse(await fs.readFile(this.userDataFile,"utf8"))}}catch{}return this.settings}
  async save(){await fs.mkdir(path.dirname(this.userDataFile),{recursive:true});await fs.writeFile(this.userDataFile,JSON.stringify(this.settings,null,2),"utf8")}
  create(){
    if(this.window&&!this.window.isDestroyed()){this.window.restore();this.window.show();this.window.focus();this.window.moveTop();return this.window}
    const displays=screen.getAllDisplays(),primary=screen.getPrimaryDisplay(),work=primary.workArea;
    let width=Number(this.settings.width)||560,height=Number(this.settings.height)||760;
    width=Math.min(Math.max(420,width),work.width);height=Math.min(Math.max(520,height),work.height);
    let x=Number.isFinite(this.settings.x)?this.settings.x:work.x+Math.max(0,Math.round((work.width-width)/2));
    let y=Number.isFinite(this.settings.y)?this.settings.y:work.y+Math.max(0,Math.round((work.height-height)/2));
    if(!visibleOnAnyDisplay({x,y,width,height},displays)){
      const reset=centeredBounds(work,width,height);({x,y,width,height}=reset);
      this.settings={...this.settings,x,y,width,height};void this.save();
      this.onDiagnostic("Gespeicherte Fensterposition war nicht ausreichend sichtbar; BATTO wurde auf den Hauptmonitor zurückgesetzt.");
    }
    this.window=new BrowserWindow({title:`Batto Multi-Chat [${RENDERER_MARKER}]`,icon:this.iconPath,width,height,minWidth:420,minHeight:520,x,y,show:false,backgroundColor:"#070b12",autoHideMenuBar:true,webPreferences:{preload:this.preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false}});
    this.window.setAlwaysOnTop(Boolean(this.settings.alwaysOnTop));
    let shown=false;
    const ensureVisible=()=>{
      if(!this.window||this.window.isDestroyed())return;
      if(!shown){shown=true;this.window.restore();this.window.show();}
      const current=this.window.getBounds();
      if(!visibleOnAnyDisplay(current,screen.getAllDisplays()))this.window.setBounds(centeredBounds(screen.getPrimaryDisplay().workArea,current.width,current.height));
      this.window.focus();this.window.moveTop();
    };
    this.window.once("ready-to-show",ensureVisible);
    this.window.webContents.once("did-finish-load",async()=>{
      const loaded=this.window?.webContents?.getURL?.()||"";
      this.onDiagnostic(`Renderer geladen: ${loaded}`);
      if(this.window&&!this.window.isDestroyed())this.window.setTitle(`Batto Multi-Chat [${RENDERER_MARKER}]`);
      try{
        const state=await this.window.webContents.executeJavaScript(`(()=>({href:location.href,title:document.title,bodyLength:(document.body?.innerHTML||'').length,rootExists:!!document.getElementById('multi-chat-root'),rootLength:(document.getElementById('multi-chat-root')?.innerHTML||'').length,batto:!!window.batto}))()`);
        this.onDiagnostic(`Renderer-Status: ${JSON.stringify(state)}`);
        if(!state.rootExists||state.rootLength<20){
          await this.window.webContents.executeJavaScript(`(()=>{document.body.innerHTML='<div style="height:100vh;display:grid;place-items:center;background:#090d14;color:#fff;font:16px Segoe UI,sans-serif"><div style="max-width:620px;padding:28px;border:1px solid #33445b;border-radius:12px;background:#0c121c"><b>BATTO MULTI-CHAT – Renderer leer</b><p>Die HTML-Datei wurde geladen, aber die Oberfläche wurde nicht aufgebaut.</p><p style="color:#9fb0c8">Pfad: '+location.href+'</p><p style="color:#ff9ca2">Preload/API: '+(window.batto?'vorhanden':'FEHLT')+'</p></div></div>';return true})()`);
        }
      }catch(error){this.onDiagnostic(`Renderer-Inspektion fehlgeschlagen: ${error?.stack||error?.message||error}`)}
      ensureVisible();
    });
    this.window.webContents.on("did-fail-load",(_event,code,description,url)=>{this.onDiagnostic(`Renderer konnte nicht geladen werden: ${code} ${description} ${url||""}`);ensureVisible();});
    this.window.webContents.on("render-process-gone",(_event,details)=>this.onDiagnostic(`Renderer-Prozess beendet: ${details?.reason||"unbekannt"} (${details?.exitCode??"?"})`));
    this.window.webContents.on("preload-error",(_event,preloadPath,error)=>this.onDiagnostic(`Preload-Fehler ${preloadPath}: ${error?.stack||error?.message||error}`));
    this.window.webContents.on("console-message",(_event,level,message,line,sourceId)=>this.onDiagnostic(`Console L${level}: ${message} (${sourceId||"renderer"}:${line||0})`));
    const rendererUrl=pathToFileURL(this.rendererPath);rendererUrl.searchParams.set("batto",`${RENDERER_MARKER}-${Date.now()}`);
    this.onDiagnostic(`Renderer-Ziel: ${rendererUrl.toString()}`);
    void this.window.webContents.session.clearCache().catch(error=>this.onDiagnostic(`Cache konnte nicht geleert werden: ${error?.message||error}`)).finally(()=>{
      if(!this.window||this.window.isDestroyed())return;
      this.window.loadURL(rendererUrl.toString()).catch(error=>{this.onDiagnostic(`loadURL fehlgeschlagen: ${error?.stack||error?.message||error}`);ensureVisible();});
    });
    setTimeout(ensureVisible,1500);
    setTimeout(ensureVisible,4000);
    const capture=()=>{if(!this.window||this.window.isDestroyed())return;const b=this.window.getBounds();this.settings={...this.settings,x:b.x,y:b.y,width:b.width,height:b.height};void this.save()};
    this.window.on("move",capture);this.window.on("resize",capture);
    this.window.on("closed",()=>{this.window=null;this.onClosed()});
    return this.window;
  }
  toggleAlwaysOnTop(){this.settings.alwaysOnTop=!this.settings.alwaysOnTop;this.window?.setAlwaysOnTop(this.settings.alwaysOnTop);void this.save();return this.settings.alwaysOnTop}
}
module.exports={ChatWindowManager,visibleOnAnyDisplay,centeredBounds,RENDERER_MARKER};
