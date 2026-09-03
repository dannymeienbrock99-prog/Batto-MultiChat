"use strict";
const fs=require("node:fs");const path=require("node:path");const {spawnSync}=require("node:child_process");
const roots=["src","scripts","test"];const files=[];
function walk(p){if(!fs.existsSync(p))return;for(const name of fs.readdirSync(p)){const full=path.join(p,name),st=fs.statSync(full);if(st.isDirectory())walk(full);else if(/\.(?:cjs|js)$/.test(name))files.push(full)}}
for(const r of roots)walk(r);let failed=0;for(const file of files){const result=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});if(result.status!==0){failed++;console.error(`\n[FEHLER] ${file}\n${result.stderr||result.stdout}`)}else console.log(`[OK] ${file}`)}if(failed){console.error(`\n${failed} Datei(en) mit Syntaxfehler.`);process.exit(1)}console.log(`\n${files.length} JavaScript-Dateien syntaktisch geprüft.`);
