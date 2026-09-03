"use strict";
const test=require("node:test");const assert=require("node:assert/strict");
const {ChatCore}=require("../src/services/chat-core.cjs");
const {ELEMENT_TYPES,defaultConfig}=require("../src/services/stream-overlay-server.cjs");
const {giftFrom,userFrom,battleSummary,armySummary}=require("../src/platforms/tiktok/tiktok-adapter.cjs");
const {GIFT_TEST_FALLBACKS,normalizeCatalogGift}=require("../src/runtime/app-runtime.cjs");

test("ChatCore normalisiert Nachrichten in einen gemeinsamen Verlauf",()=>{const core=new ChatCore();const m=core.push({platform:"tiktok",username:"Test",message:"Hallo"});assert.equal(m.platform,"tiktok");assert.equal(m.username,"Test");assert.equal(core.history(10).length,1)});
test("Overlay enthält Streaming-Elemente, aber keine Hardware- oder Sensor-Elemente",()=>{assert.ok(ELEMENT_TYPES.includes("chat"));assert.ok(ELEMENT_TYPES.includes("giftFeed"));assert.ok(ELEMENT_TYPES.includes("coHost"));assert.equal(ELEMENT_TYPES.includes("heartRate"),false);assert.equal(ELEMENT_TYPES.includes("sensor"),false);const cfg=defaultConfig();assert.equal(cfg.width,2560);assert.equal(cfg.height,1440)});
test("TikTok moderne User-Struktur wird normalisiert",()=>{const user=userFrom({user:{uniqueId:"batto_test",nickname:"Batto Test",userId:"123",profilePictureUrl:"https://example.test/a.webp",isModerator:true}});assert.equal(user.username,"batto_test");assert.equal(user.displayName,"Batto Test");assert.equal(user.userId,"123");assert.equal(user.role,"moderator")});
test("TikTok Gift-Event liefert Bild, Combo und Gesamt-Diamanten",()=>{const gift=giftFrom({giftId:6369,giftName:"Löwe",repeatCount:2,diamondCount:29999,extendedGiftInfo:{imageUrl:"https://example.test/lion.webp"}});assert.equal(gift.giftId,6369);assert.equal(gift.repeatCount,2);assert.equal(gift.totalDiamonds,59998);assert.equal(gift.imageUrl,"https://example.test/lion.webp")});
test("PK-Battle und Armee-Updates werden lesbar normalisiert",()=>{assert.equal(battleSummary({battleUsers:[{nickname:"A"},{uniqueId:"B"}]}),"A vs B");assert.match(armySummary({battleArmies:[{hostUserId:"1",points:33}]}),/33/)});
test("Gift-Test-Fallbacks sind ausdrücklich nur definierte Testdaten",()=>{assert.equal(GIFT_TEST_FALLBACKS["rosennebel"].giftId,8912);assert.equal(GIFT_TEST_FALLBACKS["löwe"].giftId,6369);assert.equal(GIFT_TEST_FALLBACKS["tiktok universe"].giftId,9072)});
test("Euler-Kataloggift wird in das Overlay-Giftmodell normalisiert",()=>{const gift=normalizeCatalogGift({id:8912,name:"Rosennebel",diamond_count:15000,image_url:"https://example.test/rose.webp"});assert.deepEqual(gift,{giftId:8912,giftName:"Rosennebel",diamondCount:15000,imageUrl:"https://example.test/rose.webp"})});
