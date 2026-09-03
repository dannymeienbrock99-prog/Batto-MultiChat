"use strict";
const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("batto",{
  chatHistory:o=>ipcRenderer.invoke("chat:history",o||{}),
  chatClear:p=>ipcRenderer.invoke("chat:clear",p||"all"),
  chatStatuses:()=>ipcRenderer.invoke("chat:statuses"),
  chatConnect:(p,c)=>ipcRenderer.invoke("chat:connect",p,c||{}),
  chatDisconnect:p=>ipcRenderer.invoke("chat:disconnect",p),
  onChatMessages:cb=>ipcRenderer.on("chat:messages",(_e,data)=>cb(data)),
  onChatStatus:cb=>ipcRenderer.on("chat:status",(_e,data)=>cb(data)),
  toggleAlwaysOnTop:()=>ipcRenderer.invoke("window:alwaysOnTop"),
  obsStatus:()=>ipcRenderer.invoke("obs:status"),
  obsConnect:c=>ipcRenderer.invoke("obs:connect",c||{}),
  obsDisconnect:()=>ipcRenderer.invoke("obs:disconnect")
});
