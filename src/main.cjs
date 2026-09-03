"use strict";
const path=require("node:path");
const {app,ipcMain}=require("electron");
const {ChatWindowManager}=require("./services/chat-window-manager.cjs");
const {ChatCore}=require("./services/chat-core.cjs");
const {PlatformManager}=require("./services/platform-manager.cjs");
const {TikTokAdapter}=require("./platforms/tiktok/tiktok-adapter.cjs");
const {BaseAdapter}=require("./platforms/base-adapter.cjs");
const {ObsWebSocketService}=require("./services/obs-websocket.cjs");

const core=new ChatCore();
const platforms=new PlatformManager(core);
platforms.register("tiktok",new TikTokAdapter());
for(const name of ["twitch","cng","youtube"])platforms.register(name,new BaseAdapter(name));
const obs=new ObsWebSocketService();
let manager;

app.whenReady().then(async()=>{
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

ipcMain.handle("chat:history",(_e,o={})=>core.history(o.limit));
ipcMain.handle("chat:clear",(_e,p="all")=>core.clear(p));
ipcMain.handle("chat:statuses",()=>platforms.statuses());
ipcMain.handle("chat:connect",(_e,p,c)=>platforms.connect(p,c||{}));
ipcMain.handle("chat:disconnect",(_e,p)=>platforms.disconnect(p));
ipcMain.handle("window:alwaysOnTop",()=>manager.toggleAlwaysOnTop());
ipcMain.handle("obs:status",()=>obs.status());
ipcMain.handle("obs:connect",(_e,c)=>obs.connect(c||{}));
ipcMain.handle("obs:disconnect",()=>obs.disconnect());
core.on("messages",batch=>manager?.window?.webContents.send("chat:messages",batch));
core.on("status",status=>manager?.window?.webContents.send("chat:status",status));
