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

import {LearningApp} from './learning.js';
const address={street:'123 Example St',city:'Example',region:'IL',postalCode:'12345'};
async function enter(screen,value){screen.stdin.write(value);await tick();screen.stdin.write('\r');await tick();}
async function contact(screen){for(const value of ['Alex','Example','3145550123','alex@example.com'])await enter(screen,value);}
test('autofocus, Return progression, separate address page, and persistence',async()=>{
 const writes=[];let requests=0;
 const screen=render(React.createElement(LearningApp,{onPersist:config=>writes.push(config),services:{locateAddress:async()=>{requests++;return address;}}}));
 try{
  await tick();assert.match(screen.lastFrame(),/First name: ▏/);assert.doesNotMatch(screen.lastFrame(),/Enter next/);assert.doesNotMatch(screen.lastFrame(),/Street:/);
  await contact(screen);await tick();
  assert.match(screen.lastFrame(),/Where…\?/);assert.doesNotMatch(screen.lastFrame(),/First name:/);
  assert.match(screen.lastFrame(),/Street: 123 Example St/);assert.equal(requests,1);
  for(let i=0;i<4;i++){screen.stdin.write('\r');await tick();}
  screen.stdin.write('d');await tick();assert.match(screen.lastFrame(),/Unit number:/);
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/2 of 10 · Store/);
  screen.stdin.write('\x7f');await tick();assert.match(screen.lastFrame(),/Where…\?/);
  screen.stdin.write('\x1b[D');await tick();assert.match(screen.lastFrame(),/Who…\?/);
  assert.match(screen.lastFrame(),/First name: Alex/);
 }finally{screen.unmount();screen.cleanup();}
 assert.equal(writes.at(-1).customer.email,'alex@example.com');assert.equal(writes.at(-1).address.street,address.street);
});
test('a late location result cannot overwrite an address the user is typing',async()=>{
 let resolve;
 const screen=render(React.createElement(LearningApp,{services:{locateAddress:()=>new Promise(r=>resolve=r)}}));
 try{
  await tick();await contact(screen);
  screen.stdin.write('My chosen address');await tick();resolve(address);await tick();
  assert.match(screen.lastFrame(),/Street: My chosen address/);assert.match(screen.lastFrame(),/Postal code: 12345/);
 }finally{screen.unmount();screen.cleanup();}
});
test('cached values restore without assuming a store; first typing replaces the focused value',async()=>{
 let locations=0;const writes=[];
 const initialConfig={customer:{firstName:'Remembered'},address,lastOrder:{orderID:'old-order',storeID:'9999',products:[]}};
 const screen=render(React.createElement(LearningApp,{initialConfig,onPersist:config=>writes.push(config),services:{locateAddress:async()=>{locations++;return address;}}}));
 try{
  await tick();assert.match(screen.lastFrame(),/Remembered▏/);
  screen.stdin.write('Alex');await tick();screen.stdin.write('\x7f');await tick();assert.match(screen.lastFrame(),/First name: Ale▏/);screen.stdin.write('x');await tick();screen.stdin.write('\x1b');await tick();screen.stdin.write('n');await tick();
  assert.match(screen.lastFrame(),/Where…\?/);assert.equal(locations,0);
  screen.stdin.write('\x1b');await tick();screen.stdin.write('n');await tick();assert.match(screen.lastFrame(),/No store selected/);
 }finally{screen.unmount();screen.cleanup();}
 assert.equal(writes.at(-1).customer.firstName,'Alex');assert.equal(writes.at(-1).lastOrder.orderID,'old-order');
});
test('customer-first journey discovers a store, loads its menu, then continues to Items',async()=>{
 let loadedStore;
 const screen=render(React.createElement(LearningApp,{initialConfig:{address},services:{
  NearbyStores:class {constructor(){this.stores=[{StoreID:'1234',IsOnlineCapable:true,IsDeliveryStore:true,IsOpen:true,ServiceIsOpen:{Delivery:true},AddressDescription:'Test store'}];}},
  loadMenu:async id=>{loadedStore=id;return menu;}
 }}));
 try{
  await tick();await contact(screen);
  for(let i=0;i<5;i++){screen.stdin.write('\r');await tick();}
  assert.match(screen.lastFrame(),/2 of 10 · Store/);
  screen.stdin.write('n');await tick();assert.match(screen.lastFrame(),/2 of 10/);
  assert.match(screen.lastFrame(),/› Find delivery stores →  Enter/);
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/› 🏪 1234/);screen.stdin.write('\r');await tick();
  screen.stdin.write('l');await tick();await tick();assert.match(screen.lastFrame(),/3 of 10 · Menu/);assert.equal(loadedStore,'1234');
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/menu \/ Products/);
  screen.stdin.write('n');await tick();assert.match(screen.lastFrame(),/4 of 10 · Items/);
  assert.match(screen.lastFrame(),/Items → Local Order → Validate → Price → Items/);
 }finally{screen.unmount();screen.cleanup();}
});
test('location denial leaves manual address entry usable',async()=>{
 const screen=render(React.createElement(LearningApp,{services:{locateAddress:async()=>{throw Error('Location access denied.');}}}));
 try{
  await tick();await contact(screen);await tick();assert.match(screen.lastFrame(),/Location access denied/);
  screen.stdin.write('123 Manual St');await tick();assert.match(screen.lastFrame(),/Street: 123 Manual St/);
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/City: ▏/);
 }finally{screen.unmount();screen.cleanup();}
});
