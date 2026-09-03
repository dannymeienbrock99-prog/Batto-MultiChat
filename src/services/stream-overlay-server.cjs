"use strict";
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");

class StreamOverlayServer{
  constructor({webRoot,port=48621}={}){this.webRoot=webRoot;this.port=port;this.server=null;this.clients=new Set();this.state={messages:[],events:[],startedAt:Date.now()};}
  status(){return{active:Boolean(this.server),port:this.port,overlayUrl:`http://127.0.0.1:${this.port}/overlay`,chatIngestUrl:`http://127.0.0.1:${this.port}/api/chat`,eventIngestUrl:`http://127.0.0.1:${this.port}/api/event`};}
  async start(){if(this.server)return this.status();this.server=http.createServer((req,res)=>this.handle(req,res));await new Promise((resolve,reject)=>{this.server.once("error",reject);this.server.listen(this.port,"127.0.0.1",()=>{this.server.off("error",reject);resolve();});});return this.status();}
  async stop(){if(!this.server)return;for(const c of this.clients){try{c.end();}catch{}}this.clients.clear();await new Promise(r=>this.server.close(()=>r()));this.server=null;}
  pushChat(message){const item={type:"chat",timestamp:Date.now(),...message};this.state.messages.push(item);if(this.state.messages.length>250)this.state.messages.splice(0,this.state.messages.length-250);this.broadcast(item);}
  pushEvent(event){const item={type:"event",timestamp:Date.now(),...event};this.state.events.push(item);if(this.state.events.length>100)this.state.events.splice(0,this.state.events.length-100);this.broadcast(item);}
  broadcast(payload){const line=`data: ${JSON.stringify(payload)}\n\n`;for(const c of [...this.clients]){try{c.write(line);}catch{this.clients.delete(c);}}}
  json(res,status,payload){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"});res.end(JSON.stringify(payload));}
  readBody(req){return new Promise((resolve,reject)=>{let body="";req.on("data",c=>{body+=c;if(body.length>1024*1024)req.destroy();});req.on("end",()=>{try{resolve(body?JSON.parse(body):{});}catch(e){reject(e);}});req.on("error",reject);});}
  serve(res,file,type){const full=path.join(this.webRoot,file);fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);res.end("Not found");return;}res.writeHead(200,{"content-type":type,"cache-control":"no-store"});res.end(data);});}
  async handle(req,res){const u=new URL(req.url,"http://127.0.0.1");if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"});res.end();return;}
    if(u.pathname==="/overlay"||u.pathname==="/")return this.serve(res,"overlay.html","text/html; charset=utf-8");
    if(u.pathname==="/overlay.css")return this.serve(res,"overlay.css","text/css; charset=utf-8");
    if(u.pathname==="/overlay.js")return this.serve(res,"overlay.js","text/javascript; charset=utf-8");
    if(u.pathname==="/events"){res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache","connection":"keep-alive","access-control-allow-origin":"*"});res.write("retry: 1500\n\n");this.clients.add(res);req.on("close",()=>this.clients.delete(res));return;}
    if(u.pathname==="/api/state"&&req.method==="GET")return this.json(res,200,{...this.status(),state:this.state});
    if(u.pathname==="/api/chat"&&req.method==="POST"){try{const body=await this.readBody(req);this.pushChat(body);return this.json(res,200,{ok:true});}catch{return this.json(res,400,{ok:false,error:"Invalid JSON"});}}
    if(u.pathname==="/api/event"&&req.method==="POST"){try{const body=await this.readBody(req);this.pushEvent(body);return this.json(res,200,{ok:true});}catch{return this.json(res,400,{ok:false,error:"Invalid JSON"});}}
    res.writeHead(404);res.end("Not found");
  }
}
module.exports={StreamOverlayServer};
