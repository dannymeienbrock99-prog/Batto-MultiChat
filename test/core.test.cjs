"use strict";
const test=require("node:test");const assert=require("node:assert/strict");
const {ChatCore}=require("../src/services/chat-core.cjs");
const {ELEMENT_TYPES,defaultConfig}=require("../src/services/stream-overlay-server.cjs");
test("ChatCore normalisiert Nachrichten in einen gemeinsamen Verlauf",()=>{const core=new ChatCore();const m=core.push({platform:"tiktok",username:"Test",message:"Hallo"});assert.equal(m.platform,"tiktok");assert.equal(m.username,"Test");assert.equal(core.history(10).length,1)});
test("Overlay enthält Streaming-Elemente, aber keine Hardware- oder Sensor-Elemente",()=>{assert.ok(ELEMENT_TYPES.includes("chat"));assert.ok(ELEMENT_TYPES.includes("giftFeed"));assert.ok(ELEMENT_TYPES.includes("coHost"));assert.equal(ELEMENT_TYPES.includes("heartRate"),false);assert.equal(ELEMENT_TYPES.includes("sensor"),false);const cfg=defaultConfig();assert.equal(cfg.width,2560);assert.equal(cfg.height,1440)});
