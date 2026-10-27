import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {render} from 'ink-testing-library';
import {Explorer} from './ui.js';
import {atPath, references, loadMenu} from './model.js';
const menu={Products:{PIZZA:{Name:'Pizza',Variants:['SMALL']}},Variants:{SMALL:{Name:'Small pizza',ProductCode:'PIZZA'}},Categorization:{},PreconfiguredProducts:{POPULAR:{ReferencedProductCode:'SMALL'}}};
test('references connect products, variants and preconfigured recipes',()=>{
 assert.deepEqual(references(menu,menu.Products.PIZZA,[])[0].path,['Variants','SMALL']);
 assert.deepEqual(references(menu,menu.Variants.SMALL,[])[0].path,['Products','PIZZA']);
 assert.deepEqual(references(menu,menu.PreconfiguredProducts.POPULAR,[])[0].path,['Variants','SMALL']);
 assert.equal(atPath(menu,['Variants','SMALL','Name']),'Small pizza');
});
test('menu loading checks status, JSON and expected catalogs',async()=>{
 await assert.rejects(loadMenu('bad'),/digits/);
 await assert.rejects(loadMenu('2801',async()=>({ok:false,status:403})),/403/);
 await assert.rejects(loadMenu('2801',async()=>({ok:true,json:async()=>{throw Error()}})),/non-JSON/);
 await assert.rejects(loadMenu('2801',async()=>({ok:true,json:async()=>({})})),/missing/);
 assert.equal(await loadMenu('2801',async()=>({ok:true,json:async()=>menu})),menu);
});
const tick=()=>new Promise(resolve=>setTimeout(resolve,70));
test('keyboard opens products, follows a variant, and returns home',async()=>{
 const screen=render(React.createElement(Explorer,{menu,storeID:'2801',fetchedAt:'test'}));
 try{
  await tick();assert.match(screen.lastFrame(),/Products/);
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/menu \/ Products/);
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/↗ Variant/);
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/menu \/ Variants \/ SMALL/);
  screen.stdin.write('h');await tick();assert.match(screen.lastFrame(),/Categorization/);
  screen.stdin.write('/');await tick();screen.stdin.write('variants');await tick();assert.match(screen.lastFrame(),/1 entries/);
 }finally{screen.unmount();screen.cleanup();}
});

import {LearningApp,customerFrom} from './learning.js';
import {eligibleStores,composeInstructions,EXTRA_LIMIT} from './delivery.js';
const address={street:'123 Example St',city:'Example',region:'IL',postalCode:'12345'};
const open={IsOnlineCapable:true,IsOpen:true,ServiceIsOpen:{Carryout:true,Delivery:true},AddressDescription:'Test address'};
const candidates=[{...open,StoreID:'1111',IsDeliveryStore:false,MinDistance:1},{...open,StoreID:'2222',IsDeliveryStore:true,MinDistance:2},{...open,StoreID:'3333',IsDeliveryStore:true,IsOpen:false,MinDistance:0}];
function harness(extra={}){
 const calls={location:0,search:[],profile:[],saved:[]};
 const services={locateAddress:async()=>{calls.location++;return address;},NearbyStores:class{constructor(a,method){calls.search.push({address:a,method});this.stores=candidates;}},Store:class{constructor(id){calls.profile.push(id);return {info:{StoreID:id,StoreName:'Selected store',AddressDescription:'Test address',Phone:'555-0100',IsOpen:true,HoursDescription:'Test hours',AcceptablePaymentTypes:['Cash']},menu:{dominosAPIResponse:menu,menu:{products:menu.Products,variants:menu.Variants}}};}},...extra.services};
 const screen=render(React.createElement(LearningApp,{initialConfig:extra.initialConfig,onPersist:config=>calls.saved.push(config),services}));
 return {screen,calls};
}
async function key(screen,text){screen.stdin.write(text);await tick();}
async function enter(screen,value){await key(screen,value);await key(screen,'\r');}
async function contact(screen){for(const value of ['Alex','Example','3145550123','alex@example.com'])await enter(screen,value);}
async function locate(screen,method='Carryout'){await contact(screen);assert.match(screen.lastFrame(),/Carryout or delivery/);assert.doesNotMatch(screen.lastFrame(),/Use my location|Street:/);if(method==='Delivery')await key(screen,'\x1b[B');await key(screen,'\r');assert.match(screen.lastFrame(),/Use my location/);await key(screen,'\r');}
function cleanup(screen){screen.unmount();screen.cleanup();}
test('service-specific eligibility excludes closed stores and sorts nearby carryout stores',()=>{
 assert.deepEqual(eligibleStores(candidates,'Carryout').map(s=>s.StoreID),['1111','2222']);
 assert.deepEqual(eligibleStores(candidates,'Delivery').map(s=>s.StoreID),['2222']);
 assert.deepEqual(eligibleStores(candidates,null),[]);
 assert.deepEqual(eligibleStores([{...open,StoreID:'x',AllowCarryoutOrders:false}],'Carryout'),[]);
});
test('vertical service selection precedes location and Left remains Back',async()=>{
 const {screen,calls}=harness();
 try{
  await tick();assert.match(screen.lastFrame(),/First name: ▏/);assert.doesNotMatch(screen.lastFrame(),/Enter next/);
  await contact(screen);assert.equal(calls.location,0);assert.match(screen.lastFrame(),/› 🥡 Carryout/);assert.doesNotMatch(screen.lastFrame(),/Use my location|Street:/);
  await key(screen,'\x1b[B');assert.match(screen.lastFrame(),/› 🛵 Delivery/);
  await key(screen,'\x1b[A');assert.match(screen.lastFrame(),/› 🥡 Carryout/);
  await key(screen,'\x1b[C');assert.match(screen.lastFrame(),/› 🥡 Carryout/);
  await key(screen,'\r');assert.match(screen.lastFrame(),/› 📍 Use my location/);assert.equal(calls.location,0);
  await key(screen,'\x1b[D');assert.match(screen.lastFrame(),/Carryout or delivery/);
  await key(screen,'\r');await key(screen,'\r');assert.equal(calls.location,1);assert.match(screen.lastFrame(),/Carryout stores/);
  assert.doesNotMatch(screen.lastFrame(),/Use my location|Street:|Location filled/);assert.equal(calls.profile.length,0);
 }finally{cleanup(screen);}
});
test('carryout skips address refinement, explicitly selects one store, and displays its Store object',async()=>{
 const {screen,calls}=harness();
 try{
  await tick();await locate(screen);
  assert.equal(calls.search[0].method,'Carryout');assert.match(screen.lastFrame(),/Carryout stores/);assert.doesNotMatch(screen.lastFrame(),/Home:|Hand it to me/);
  assert.equal(calls.profile.length,0);await key(screen,'\r');assert.deepEqual(calls.profile,['1111']);
  assert.match(screen.lastFrame(),/Your store/);assert.match(screen.lastFrame(),/Selected store · Carryout/);assert.match(screen.lastFrame(),/555-0100/);
  await key(screen,'i');assert.match(screen.lastFrame(),/AcceptablePaymentTypes/);await key(screen,'\x1b[D');
  await key(screen,'\r');assert.match(screen.lastFrame(),/What sounds good/);assert.match(screen.lastFrame(),/Products/);
  assert.equal(calls.profile.length,1);await key(screen,'n');assert.match(screen.lastFrame(),/4 of 10 · Items/);await key(screen,'\x1b[D');assert.match(screen.lastFrame(),/What sounds good/);
 }finally{cleanup(screen);}
});
test('delivery builds compact handoff instructions, finds the serving store, and retains local preferences',async()=>{
 const {screen,calls}=harness();
 try{
  await tick();await locate(screen,'Delivery');
  assert.match(screen.lastFrame(),/› Continue →  Enter/);assert.doesNotMatch(screen.lastFrame(),/Use my location/);
  assert.match(screen.lastFrame(),/Postal code: 12345\n\s*\n/);assert.match(screen.lastFrame(),/Don't Knock/);
  await key(screen,'\r');await key(screen,'\x1b[C');await key(screen,'\r');assert.match(screen.lastFrame(),/Apartment number: ▏/);
  await enter(screen,'4B');await key(screen,'\x1b[C');await key(screen,'\r');
  for(let i=0;i<3;i++){await key(screen,' ');await key(screen,'\r');}
  await enter(screen,'Behind the side gate');await key(screen,'\r');
  assert.equal(calls.search[0].method,'Delivery');assert.match(screen.lastFrame(),/2222/);assert.doesNotMatch(screen.lastFrame(),/1111/);
  const a=calls.search[0].address;
  assert.equal(a.unitType,'APT');assert.equal(a.unitNumber,'4B');
  assert.equal(a.deliveryInstructions,"Leave at door; Don't Knock; Don't Ring Doorbell; Call upon arrival; Behind the side gate");
  assert.equal(a.handoff,undefined);assert.equal(calls.profile.length,0);await key(screen,'\r');assert.deepEqual(calls.profile,['2222']);
 }finally{cleanup(screen);}
 const prefs=calls.saved.at(-1).address;assert.equal(prefs.handoff,'door');assert.equal(prefs.dontKnock,true);assert.equal(prefs.callUponArrival,true);assert.equal(prefs.additionalInstructions,'Behind the side gate');
});
test('handoff is mandatory even with a cached house address',async()=>{
 const {screen,calls}=harness({initialConfig:{address:{...address,residenceType:'House'}}});
 try{
  await tick();await locate(screen,'Delivery');await key(screen,'\r');
  assert.match(screen.lastFrame(),/› \* \[Hand it to me\]/);assert.equal(calls.search.length,0);
  await key(screen,'\r');for(let i=0;i<3;i++)await key(screen,'\r');
  await key(screen,'\r');await key(screen,'\r');assert.equal(calls.search[0].method,'Delivery');
  assert.equal(calls.search[0].address.deliveryInstructions,'Hand it to me');
 }finally{cleanup(screen);}
});
test('extra instructions are bounded and legacy instructions are preserved on migration',async()=>{
 const {screen,calls}=harness({initialConfig:{address:{...address,residenceType:'House',handoff:'hand',deliveryInstructions:'Old extra'}}});
 try{
  await tick();await locate(screen,'Delivery');await key(screen,'\x1b[A');
  await key(screen,'x'.repeat(180));assert.match(screen.lastFrame(),/Extra 120\/120:/);
 }finally{cleanup(screen);}
 assert.equal(calls.saved.at(-1).address.additionalInstructions.length,EXTRA_LIMIT);
 assert.equal(composeInstructions({handoff:'hand',deliveryInstructions:'Old extra'}),'Hand it to me; Old extra');
});
test('denied location permits a manual carryout search without delivery details',async()=>{
 const {screen,calls}=harness({services:{locateAddress:async()=>{throw Error('Location access denied.');}}});
 try{
  await tick();await locate(screen);assert.match(screen.lastFrame(),/Location access denied/);
  assert.match(screen.lastFrame(),/Near…/);assert.doesNotMatch(screen.lastFrame(),/Apartment|Don't Knock/);
  await enter(screen,'Example');await enter(screen,'IL');await enter(screen,'12345');await key(screen,'\r');
  assert.equal(calls.search[0].method,'Carryout');assert.equal(calls.search[0].address.postalCode,'12345');
 }finally{cleanup(screen);}
});
test('a mismatched Store response cannot advance to profile or menu',async()=>{
 const {screen}=harness({services:{Store:class{constructor(){return {info:{StoreID:'wrong'}};}}}});
 try{
  await tick();await locate(screen);await key(screen,'\r');assert.match(screen.lastFrame(),/does not match/);
  assert.doesNotMatch(screen.lastFrame(),/Your store|What sounds good/);
 }finally{cleanup(screen);}
});
test('back navigation discards a late Store result',async()=>{
 let resolve;
 const {screen}=harness({services:{Store:class{constructor(id){return new Promise(r=>resolve=()=>r({info:{StoreID:id},menu:{dominosAPIResponse:menu}}));}}}});
 try{
  await tick();await locate(screen);await key(screen,'\r');await key(screen,'\x1b[D');
  resolve();await tick();assert.match(screen.lastFrame(),/Carryout or delivery/);assert.doesNotMatch(screen.lastFrame(),/Your store/);
 }finally{cleanup(screen);}
});
