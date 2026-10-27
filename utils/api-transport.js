import fetch from 'node-fetch';
// Optional transport instrumentation. The package remains silent by default.
let observer=null;
export function setAPIObserver(value){observer=value;}
export async function apiFetch(url,options={},fetcher=fetch){
    const current=observer;
    const request=current?.send(url,options);
    try{
        const response=await fetcher(url,options);
        if(!current)return response;
        // Buffer once: awaiting a node-fetch clone before consuming its original
        // can deadlock on large menus because the two streams share backpressure.
        const text=await response.text();
        await current.receive(url,response,request,text);
        return new response.constructor(text,{status:response.status,statusText:response.statusText,headers:response.headers,url:response.url});
    }catch(error){current?.failure(url,error,request);throw error;}
}
