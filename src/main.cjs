"use strict";
const {app,ipcMain,safeStorage,shell,clipboard}=require("electron");
const {AppRuntime}=require("./runtime/app-runtime.cjs");
const {CngBrowserTools}=require("./services/cng-browser-tools.cjs");
let runtime,cngBrowserTools;
app.whenReady().then(async()=>{
  runtime=new AppRuntime({app,ipcMain,safeStorage,shell,clipboard});
  await runtime.start();
  cngBrowserTools=new CngBrowserTools({runtime,ipcMain,shell,clipboard});
  cngBrowserTools.register();
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
app.on("before-quit",()=>{void runtime?.stop?.();});
