"use strict";
const {app,ipcMain,safeStorage,shell,clipboard}=require("electron");
const {AppRuntime}=require("./runtime/app-runtime.cjs");
const {applyReleaseHardening}=require("./runtime/release-hardening.cjs");
let runtime;
app.whenReady().then(async()=>{try{runtime=new AppRuntime({app,ipcMain,safeStorage,shell,clipboard});await runtime.start();applyReleaseHardening(runtime,{ipcMain,shell,clipboard});}catch(error){console.error("BATTO MULTI-CHAT Startfehler:",error);app.quit();}});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
app.on("before-quit",()=>{void runtime?.stop?.();});
