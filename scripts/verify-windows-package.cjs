"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const asar=require("@electron/asar");
const root=path.resolve(__dirname,".."),dist=path.join(root,"dist");
const pkg=require("../package.json");
const name=`Batto-MultiChat-Setup-${pkg.version}-x64.exe`;
const installer=path.join(dist,name),app=path.join(dist,"win-unpacked","Batto-MultiChat.exe");
for(const file of [installer,app]){
  assert.ok(fs.statSync(file).size>10*1024*1024,`${path.basename(file)} ist ungewöhnlich klein.`);
  const fd=fs.openSync(file,"r"),header=Buffer.alloc(2);try{fs.readSync(fd,header,0,2,0)}finally{fs.closeSync(fd)}
  assert.equal(header.toString(),"MZ",`${path.basename(file)} ist keine Windows-EXE.`);
}
const archive=path.join(dist,"win-unpacked","resources","app.asar");
const entries=asar.listPackage(archive).map(file=>file.replaceAll("\\","/").replace(/^\//,""));
for(const file of ["src/main.cjs","src/preload.cjs","src/runtime/app-runtime.cjs","src/services/auto-broadcast.cjs","src/shared/auto-broadcast.js","src/renderer/auto-broadcast-controls.js","src/renderer/multi-chat.html","src/renderer/renderer-loader.js","src/stream-overlay/overlay.html","src/stream-overlay/editor.html","resources/batto-icon.png",...Object.keys(pkg.dependencies).map(name=>`node_modules/${name}/package.json`)])assert.ok(entries.includes(file),`Im Installationspaket fehlt ${file}.`);
const packed=JSON.parse(asar.extractFile(archive,"package.json").toString());
assert.equal(packed.version,pkg.version);assert.equal(packed.main,pkg.main);
assert.ok(!entries.some(file=>file.startsWith("node_modules/electron-builder/")),"Build-Werkzeuge dürfen nicht mit installiert werden.");
assert.ok(!entries.some(file=>/(^|\/)(settings\.json|secrets\.dat|\.env|\.git)(\/|$)/.test(file)),"Benutzerprofile dürfen nicht im Installer liegen.");
const hash=crypto.createHash("sha256").update(fs.readFileSync(installer)).digest("hex");
fs.writeFileSync(path.join(dist,"SHA256SUMS.txt"),`${hash}  ${name}\n`);
fs.copyFileSync(path.join(root,"docs","INSTALLATION-WINDOWS.txt"),path.join(dist,"INSTALLATION.txt"));
console.log(`Setup geprüft: ${name} · ${fs.statSync(installer).size} Bytes · SHA256 ${hash}`);
console.log("Programm, Oberfläche, Plattform-Module und benötigte Bibliotheken sind im Paket enthalten.");
