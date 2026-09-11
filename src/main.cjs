"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {app,ipcMain,safeStorage,shell,clipboard,dialog}=require("electron");
const {AppRuntime}=require("./runtime/app-runtime.cjs");
const {applyReleaseHardening}=require("./runtime/release-hardening.cjs");
// Retain the existing profile when the installer adds a human-readable product name.
app.setName("batto-multichat");
app.setPath("userData",path.join(app.getPath("appData"),"batto-multichat"));
app.setAppUserModelId("de.crazybatto.multichat");
let runtime,logFile="";
function writeLog(message){try{if(!logFile)return;fs.appendFileSync(logFile,`[${new Date().toISOString()}] ${message}\n`,"utf8")}catch{}}
function describeError(error){return String(error?.stack||error?.message||error||"Unbekannter Fehler");}
process.on("uncaughtException",error=>{const text=describeError(error);writeLog(`uncaughtException: ${text}`);try{dialog.showErrorBox("BATTO MULTI-CHAT – Startfehler",`${text}\n\nLog: ${logFile}`)}catch{};});
process.on("unhandledRejection",error=>{const text=describeError(error);writeLog(`unhandledRejection: ${text}`);try{dialog.showErrorBox("BATTO MULTI-CHAT – Fehler",`${text}\n\nLog: ${logFile}`)}catch{};});
if(!app.requestSingleInstanceLock()){
  app.quit();
}else{
app.on("second-instance",()=>runtime?.windowManager?.create());
app.whenReady().then(async()=>{
  try{
    logFile=path.join(app.getPath("userData"),"batto-startup.log");writeLog("App ready – Runtime wird gestartet.");
    runtime=new AppRuntime({app,ipcMain,safeStorage,shell,clipboard,onDiagnostic:message=>writeLog(`Renderer: ${message}`)});
    applyReleaseHardening(runtime,{ipcMain,shell,clipboard});
    await runtime.start();writeLog("Runtime erfolgreich gestartet.");
  }catch(error){
    const text=describeError(error);writeLog(`Startfehler: ${text}`);console.error("BATTO MULTI-CHAT Startfehler:",error);
    try{dialog.showErrorBox("BATTO MULTI-CHAT konnte nicht starten",`${text}\n\nDiagnose-Datei:\n${logFile}`)}catch{}
    app.quit();
  }
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
app.on("before-quit",()=>{writeLog("App wird beendet.");void runtime?.stop?.();});
}
