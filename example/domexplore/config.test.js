import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,writeFileSync,readFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadConfig,saveConfig,configWithValues} from './config.js';
test('config round-trip retains contact, address and last order, excludes payment credentials, and uses 0600',()=>{
 const dir=mkdtempSync(join(tmpdir(),'domexplore-config-')),path=join(dir,'.domexplore.conf');
 try{
  assert.equal(loadConfig(path).lastOrder,null);
  saveConfig({customer:{firstName:'Alex',password:'secret'},address:{street:'123 Example St'},lastOrder:{OrderID:'order-1',StoreID:'1234',Products:[{Code:'TEST',Qty:2}],Payments:[{Number:'private-card'}],accessToken:'private-token'}},path);
  let config=loadConfig(path);assert.equal(config.lastOrder.orderID,'order-1');assert.equal(config.lastOrder.products[0].qty,2);
  assert.equal(statSync(path).mode&0o777,0o600);assert.doesNotMatch(readFileSync(path,'utf8'),/secret|private-card|private-token/);
  saveConfig(configWithValues(config,{firstName:'Updated',postalCode:'12345'}),path);
  config=loadConfig(path);assert.equal(config.customer.firstName,'Updated');assert.equal(config.address.postalCode,'12345');assert.equal(config.lastOrder.orderID,'order-1');
  writeFileSync(path,'invalid JSON');assert.throws(()=>loadConfig(path),/Cannot read/);assert.equal(readFileSync(path,'utf8'),'invalid JSON');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('config rejects symbolic links without modifying their target',()=>{
 const dir=mkdtempSync(join(tmpdir(),'domexplore-config-')),target=join(dir,'target'),path=join(dir,'config');
 try{writeFileSync(target,'untouched');symlinkSync(target,path);assert.throws(()=>saveConfig({},path),/symbolic/);assert.throws(()=>loadConfig(path),/symbolic/);assert.equal(readFileSync(target,'utf8'),'untouched');}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('structured delivery choices survive cache round-trips without duplicating the composed text',()=>{
 const dir=mkdtempSync(join(tmpdir(),'domexplore-config-')),path=join(dir,'config');
 try{
  const config=configWithValues({}, {handoff:'door',dontKnock:true,dontRingDoorbell:false,callUponArrival:true,additionalInstructions:'Side entrance',residenceType:'Apartment',unitNumber:'4B'});
  saveConfig(config,path);const loaded=loadConfig(path);saveConfig(loaded,path);
  const again=loadConfig(path);
  assert.equal(again.address.handoff,'door');assert.equal(again.address.dontRingDoorbell,false);
  assert.equal(again.address.deliveryInstructions,"Leave at door; Don't Knock; Call upon arrival; Side entrance");
  assert.equal(again.address.unitNumber,'4B');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
