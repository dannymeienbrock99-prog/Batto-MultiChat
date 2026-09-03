"use strict";
class EulerClient{
  constructor({baseUrl="https://www.eulerstream.com",tokenProvider}={}){this.baseUrl=baseUrl.replace(/\/$/,"");this.tokenProvider=tokenProvider;}
  async request(path,{method="GET",body,headers={}}={}){
    const token=await this.tokenProvider?.();
    const response=await fetch(`${this.baseUrl}${path}`,{method,headers:{"content-type":"application/json",...(token?{"x-oauth-token":token}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await response.text();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}
    if(!response.ok)throw new Error(`Euler API ${response.status}: ${typeof data==="string"?data:JSON.stringify(data)}`);
    return data;
  }
}
module.exports={EulerClient};
