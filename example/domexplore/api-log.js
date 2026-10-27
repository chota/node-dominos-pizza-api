import {readdirSync,lstatSync,unlinkSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
const owned=/^domexplore-api-\d{6,}-(?:send|receive)-[a-zA-Z0-9_-]+\.txt$/;
const secret=key=>/password|secret|authorization|cookie|access.?token|refresh.?token|security.?code|cvv|cvc|card.?number|account.?number|^pan$|^expiration$|^expiry$/i.test(key)||/token/i.test(key)&&!/tokenmissing/i.test(key);
function redact(value,path=[]){
    if(Array.isArray(value))return value.map(item=>redact(item,path));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,secret(key)||key.toLowerCase()==='number'&&path.some(part=>/payment|card/i.test(part))?'[REDACTED]':redact(item,[...path,key])]));
    if(typeof value==='string')return value.replace(/\b(?:\d[ -]?){13,19}\b/g,'[REDACTED NUMBER]');
    return value;
}
function body(value){
    if(value==null||value==='')return null;
    if(typeof value!=='string')return '[Non-text body omitted]';
    try{return redact(JSON.parse(value));}catch{return '[Non-JSON body omitted to avoid storing unstructured secrets]';}
}
function safeURL(value){
    const url=new URL(String(value));url.username='';url.password='';url.hash='';
    for(const [key] of url.searchParams)if(secret(key))url.searchParams.set(key,'[REDACTED]');
    return url.href;
}
function headers(value){return redact(value?.entries?Object.fromEntries(value.entries()):value||{});}
export function createAPILog(directory=process.cwd(),{onError=message=>process.stderr.write(`${message}\n`)}={}){
    // Only delete this logger's regular files. Never follow symlinks or remove unrelated files.
    for(const name of readdirSync(directory))if(owned.test(name)&&lstatSync(join(directory,name)).isFile())unlinkSync(join(directory,name));
    let sequence=0,reported=false;
    const write=(direction,url,data)=>{
        const number=++sequence;
        try{
            const endpoint=new URL(String(url));
            const slug=`${endpoint.hostname}${endpoint.pathname}`.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,160);
            const filename=`domexplore-api-${String(number).padStart(6,'0')}-${direction}-${slug}.txt`;
            const fd=openSync(join(directory,filename),'wx',0o600);
            try{writeFileSync(fd,JSON.stringify({sequence:number,direction,time:new Date().toISOString(),endpoint:safeURL(url),...data},null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
        }catch{if(!reported){reported=true;onError('domexplore could not write API logs in the launch directory.');}}
        return number;
    };
    return {
        send(url,options){return write('send',url,{method:options.method||'GET',headers:headers(options.headers),body:body(options.body)});},
        async receive(url,response,request,text){
            write('receive',url,{requestSequence:request,status:response.status,statusText:response.statusText,headers:headers(response.headers),body:text===null?'[Response body could not be read]':body(text)});
        },
        failure(url,error,request){write('receive',url,{requestSequence:request,networkError:true,errorType:String(error?.name||'Error'),errorCode:typeof error?.code==='string'?error.code:undefined});}
    };
}
