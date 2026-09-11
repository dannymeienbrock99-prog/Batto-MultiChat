"use strict";
// One color policy for the Electron renderer and both OBS browser sources.
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.BattoChatAppearance=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const platforms=Object.freeze({twitch:"#9146ff",tiktok:"#eeeeee",youtube:"#ff3030",cng:"#2f9cff"});
  function hex(value){
    if(typeof value!=="string")return "";
    const color=value.trim().toLowerCase();
    if(/^#[\da-f]{6}$/.test(color))return color;
    if(/^#[\da-f]{3}$/.test(color))return "#"+[...color.slice(1)].map(c=>c+c).join("");
    return "";
  }
  function normalize(value){
    const result={};
    for(const [platform,nameColor] of Object.entries(platforms)){
      const entry=value?.[platform];
      result[platform]={
        customName:entry?.customName===true,
        nameColor:hex(entry?.nameColor)||nameColor,
        customMessage:entry?.customMessage===true,
        messageColor:hex(entry?.messageColor)||"#dbe3ee"
      };
    }
    return result;
  }
  function resolve(value,message={}){
    const known=Object.hasOwn(platforms,message.platform);
    const entry=known?value?.[message.platform]:null;
    return {
      nameColor:(entry?.customName===true&&hex(entry.nameColor))||hex(message.color)||(known?platforms[message.platform]:"#5aa7ff"),
      // Empty means inherit the surface's existing text color.
      messageColor:entry?.customMessage===true?hex(entry.messageColor):""
    };
  }
  return {platforms,hex,normalize,resolve};
});
