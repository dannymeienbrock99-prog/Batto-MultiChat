"use strict";
const path=require("node:path");
const {app,ipcMain,shell,clipboard}=require("electron");
const {ChatWindowManager}=require("./services/chat-window-manager.cjs");
const {ChatCore}=require("./services/chat-core.cjs");
const {PlatformManager}=require("./services/platform-manager.cjs");
const {TikTokAdapter}=require("./platforms/tiktok/tiktok-adapter.cjs");
const {BaseAdapter}=require("./platforms/base-adapter.cjs");
const {ObsWebSocketService}=require("./services/obs-websocket.cjs");
const {StreamOverlayServer}=require("./services/stream-overlay-server.cjs");

const core=new ChatCore();
const platforms=new PlatformManager(core);
platforms.register("tiktok",new TikTokAdapter());
for(const name of ["twitch","cng","youtube"])platforms.register(name,new BaseAdapter(name));
const obs=new ObsWebSocketService();
const streamOverlay=new StreamOverlayServer({webRoot:path.join(__dirname,"stream-overlay"),port:48621});
let manager;

app.whenReady().then(async()=>{
  try{await streamOverlay.start();}catch(error){console.error("Stream-Overlay konnte nicht gestartet werden:",error);}
  manager=new ChatWindowManager({
    userDataFile:path.join(app.getPath("userData"),"multichat-window.json"),
    preloadPath:path.join(__dirname,"preload.cjs"),
    rendererPath:path.join(__dirname,"renderer","multi-chat.html"),
    onClosed:()=>{if(process.platform!=="darwin")app.quit();}
  });
  await manager.load();
  manager.create();
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
app.on("before-quit",()=>{void streamOverlay.stop();});

ipcMain.handle("chat:history",(_e,o={})=>core.history(o.limit));
ipcMain.handle("chat:clear",(_e,p="all")=>core.clear(p));
ipcMain.handle("chat:statuses",()=>platforms.statuses());
ipcMain.handle("chat:connect",(_e,p,c)=>platforms.connect(p,c||{}));
ipcMain.handle("chat:disconnect",(_e,p)=>platforms.disconnect(p));
ipcMain.handle("window:alwaysOnTop",()=>manager.toggleAlwaysOnTop());
ipcMain.handle("obs:status",()=>obs.status());
ipcMain.handle("obs:connect",(_e,c)=>obs.connect(c||{}));
ipcMain.handle("obs:disconnect",()=>obs.disconnect());
ipcMain.handle("overlay:status",()=>streamOverlay.status());
ipcMain.handle("overlay:open",()=>shell.openExternal(streamOverlay.status().overlayUrl));
ipcMain.handle("overlay:copyUrl",()=>{const url=streamOverlay.status().overlayUrl;clipboard.writeText(url);return url;});
ipcMain.handle("overlay:testChat",()=>{streamOverlay.pushChat({platform:"tiktok",username:"Crazy_Batto",displayName:"Crazy_Batto",message:"BATTO MULTI-CHAT Overlay-Test",role:"moderator"});return true;});
ipcMain.handle("overlay:testEvent",()=>{streamOverlay.pushEvent({eventType:"gift",title:"Geschenk-Test · BATTO MULTI-CHAT"});return true;});

core.on("messages",batch=>{
  manager?.window?.webContents.send("chat:messages",batch);
  for(const message of batch||[])streamOverlay.pushChat(message);
});
core.on("status",status=>manager?.window?.webContents.send("chat:status",status));
