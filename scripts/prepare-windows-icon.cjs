"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const png=fs.readFileSync(path.join(root,"resources","batto-icon.png"));
if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error("BATTO-Icon ist keine PNG-Datei.");
const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
if(width!==height||width<16||width>256)throw new Error("Das Windows-Icon benötigt eine quadratische PNG-Datei mit 16–256 Pixeln.");
// ICO supports an unchanged PNG payload. Preserve the original brand pixels.
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);
header[6]=width===256?0:width;header[7]=height===256?0:height;
header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
fs.mkdirSync(path.join(root,"build"),{recursive:true});
fs.writeFileSync(path.join(root,"build","batto-icon.ico"),Buffer.concat([header,png]));
console.log(`Windows-Icon aus dem vorhandenen BATTO-Logo erstellt (${width} × ${height}).`);
