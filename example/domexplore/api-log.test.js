import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,writeFileSync,statSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Response} from 'node-fetch';
import {createAPILog} from './api-log.js';
import {apiFetch,setAPIObserver} from '../../utils/api-transport.js';
const files=dir=>readdirSync(dir).filter(name=>name.startsWith('domexplore-api-')).sort();
test('logs one send/receive per file, redacts secrets, and leaves the response consumable',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'domexplore-log-'));
 try{
  setAPIObserver(createAPILog(dir));
  const url='https://order.dominos.com/power/place-order?accessToken=private';
  const response=await apiFetch(url,{method:'POST',headers:{Authorization:'Bearer private'},body:JSON.stringify({Order:{Payments:[{Number:'4111111111111111',SecurityCode:'123',Expiration:'1230',Amount:12}],Address:{Street:'Example'},Products:[{Code:'PIZZA'}]}})},async()=>new Response(JSON.stringify({Status:-1,Order:{Status:-1},StatusItems:[{Code:'recaptchaVerificationRequired'}],googleRecaptchaScore:'TokenMissing',accessToken:'private'}),{status:200,headers:{'set-cookie':'secret'}}));
  assert.equal((await response.json()).Status,-1);
  const names=files(dir);assert.equal(names.length,2);assert.match(names[0],/^domexplore-api-000001-send-.*power-place-order\.txt$/);assert.match(names[1],/^domexplore-api-000002-receive-/);
  const sent=JSON.parse(readFileSync(join(dir,names[0]),'utf8')),received=JSON.parse(readFileSync(join(dir,names[1]),'utf8'));assert.equal(received.requestSequence,1);assert.equal(received.status,200);assert.equal(received.body.googleRecaptchaScore,'TokenMissing');assert.equal(received.body.StatusItems[0].Code,'recaptchaVerificationRequired');assert.equal(sent.body.Order.Address.Street,'Example');
  const all=names.map(name=>readFileSync(join(dir,name),'utf8')).join('');assert.doesNotMatch(all,/4111111111111111|Bearer private|1230|"123"|"private"|"secret"/);for(const name of names)assert.equal(statSync(join(dir,name)).mode&0o777,0o600);
 }finally{setAPIObserver(null);rmSync(dir,{recursive:true,force:true});}
});
test('large menu responses are captured without clone stream deadlock',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'domexplore-log-'));
 try{setAPIObserver(createAPILog(dir));const payload=JSON.stringify({menu:'x'.repeat(1000000)});const {Readable}=await import('node:stream');const response=await apiFetch('https://example.com/menu',{},async()=>new Response(Readable.from([Buffer.from(payload)])));assert.equal((await response.json()).menu.length,1000000);assert.equal(JSON.parse(readFileSync(join(dir,files(dir)[1]),'utf8')).body.menu.length,1000000);}
 finally{setAPIObserver(null);rmSync(dir,{recursive:true,force:true});}
});
test('launch clears only owned regular log files and restarts numbering',()=>{
 const dir=mkdtempSync(join(tmpdir(),'domexplore-log-'));
 try{
  const old='domexplore-api-000001-send-example-com-power-menu.txt';writeFileSync(join(dir,old),'old');writeFileSync(join(dir,'notes.txt'),'keep');writeFileSync(join(dir,'domexplore-api-not-a-log.txt'),'keep');
  symlinkSync(join(dir,'notes.txt'),join(dir,'domexplore-api-999999-send-example.txt'));
  const logger=createAPILog(dir);assert.equal(existsSync(join(dir,old)),false);assert.equal(readFileSync(join(dir,'notes.txt'),'utf8'),'keep');assert.equal(existsSync(join(dir,'domexplore-api-not-a-log.txt')),true);assert.equal(existsSync(join(dir,'domexplore-api-999999-send-example.txt')),true);
  assert.equal(logger.send('https://example.com/menu',{}),1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('concurrent requests are numbered in event order and network failures get a receive file',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'domexplore-log-'));
 try{
  setAPIObserver(createAPILog(dir));let finish;
  const first=apiFetch('https://example.com/first',{},()=>new Promise(resolve=>finish=()=>resolve(new Response('{}'))));
  await assert.rejects(apiFetch('https://example.com/second',{},async()=>{throw new TypeError('secret body');}),TypeError);
  finish();await first;
  const events=files(dir).map(name=>JSON.parse(readFileSync(join(dir,name),'utf8')));assert.deepEqual(events.map(e=>[e.sequence,e.direction,e.requestSequence]),[[1,'send',undefined],[2,'send',undefined],[3,'receive',2],[4,'receive',1]]);assert.equal(events[2].networkError,true);assert.doesNotMatch(JSON.stringify(events),/secret body/);
 }finally{setAPIObserver(null);rmSync(dir,{recursive:true,force:true});}
});
test('non-JSON response is logged safely without changing parse behavior; log failures do not hide results',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'domexplore-log-'));const errors=[];
 try{
  const logger=createAPILog(dir,{onError:message=>errors.push(message)});setAPIObserver(logger);
  const response=await apiFetch('https://example.com/menu',{},async()=>new Response('<html>private</html>',{status:403}));assert.equal(await response.text(),'<html>private</html>');assert.doesNotMatch(readFileSync(join(dir,files(dir)[1]),'utf8'),/private/);
  rmSync(dir,{recursive:true,force:true});assert.equal(await (await apiFetch('https://example.com/menu',{},async()=>new Response('{}'))).text(),'{}');assert.equal(errors.length,1);
 }finally{setAPIObserver(null);rmSync(dir,{recursive:true,force:true});}
});
