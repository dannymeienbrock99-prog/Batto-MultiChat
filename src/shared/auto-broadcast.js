"use strict";
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.BattoAutoBroadcast=api;
})(typeof globalThis!=="undefined"?globalThis:this,()=>{
  const platforms=Object.freeze({twitch:"Twitch",tiktok:"TikTok",youtube:"YouTube"});
  const defaults=()=>({intervalMinutes:10,platforms:[],messages:[]});
  function validate(value){
    if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Auto-Broadcast-Einstellungen fehlen.");
    const intervalMinutes=Number(value.intervalMinutes);
    if(!Number.isInteger(intervalMinutes)||intervalMinutes<1||intervalMinutes>1440)throw new Error("Das Intervall muss zwischen 1 und 1440 ganzen Minuten liegen.");
    if(!Array.isArray(value.platforms)||value.platforms.some(p=>!Object.hasOwn(platforms,p)))throw new Error("Auto-Broadcast unterstützt Twitch, TikTok und YouTube. Für CNG fehlt eine bestätigte Sende-Anbindung.");
    const selected=Object.keys(platforms).filter(p=>value.platforms.includes(p));
    if(!Array.isArray(value.messages)||value.messages.length>20)throw new Error("Es sind höchstens 20 Nachrichtenvorlagen möglich.");
    const messages=value.messages.map((text,index)=>{
      if(typeof text!=="string")throw new Error(`Nachricht ${index+1} ist ungültig.`);
      text=text.replace(/[\r\n]+/g," ").trim();
      if(!text||text.length>200)throw new Error(`Nachricht ${index+1} muss 1 bis 200 Zeichen enthalten.`);
      if(/[\u0000-\u001f\u007f]/.test(text))throw new Error(`Nachricht ${index+1} enthält ungültige Steuerzeichen.`);
      if(selected.includes("twitch")&&new TextEncoder().encode(text).length>450)throw new Error(`Nachricht ${index+1} ist für Twitch zu lang. Bitte Text oder Emojis kürzen.`);
      return text;
    });
    return{intervalMinutes,platforms:selected,messages};
  }
  function requireReady(config){
    if(!config.messages.length)throw new Error("Bitte mindestens eine Nachricht speichern.");
    if(!config.platforms.length)throw new Error("Bitte mindestens eine Plattform auswählen.");
  }
  return{platforms,defaults,validate,requireReady};
});
