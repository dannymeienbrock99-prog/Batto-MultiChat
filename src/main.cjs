"use strict";
const {app,ipcMain,safeStorage,shell,clipboard}=require("electron");
const {AppRuntime}=require("./runtime/app-runtime.cjs");
let runtime;
app.whenReady().then(async()=>{runtime=new AppRuntime({app,ipcMain,safeStorage,shell,clipboard});await runtime.start();});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
app.on("before-quit",()=>{void runtime?.stop?.();});
