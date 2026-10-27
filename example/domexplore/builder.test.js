import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {render} from 'ink-testing-library';
import {Order,Customer,Item} from '../../index.js';
import {prepareCatalog,initialSelection,reconcileSelection,validateSelection,usedSlots} from './catalog.js';
import {LocalOrderBuilder} from './order-builder.js';
import {OrderBuilder} from './builder-ui.js';
import {builderMenu} from './builder-fixture.js';
const catalog=prepareCatalog(builderMenu);
function order(){const result=new Order(new Customer({firstName:'Alex',address:{street:'Test',region:'IL',postalCode:'12345'}}));result.storeID='1234';result.serviceMethod='Carryout';return result;}
const tick=()=>new Promise(resolve=>setTimeout(resolve,60));
async function key(screen,input){screen.stdin.write(input);await tick();}
test('catalog groups variants by actual product family and collapses specialty pizzas',()=>{
 const pizza=catalog.sections.find(s=>s.id==='Pizza');assert.equal(pizza.groups[0].name,'BYO Pizza');assert.equal(pizza.groups.find(g=>g.id==='specialty').families.length,2);
 assert.equal(catalog.groups.find(g=>g.id==='F_COKE').variants.length,2);
 assert.equal(catalog.byVariant.get('LHT').size,'Large');assert.equal(catalog.byVariant.get('LHT').crust,'Hand Tossed');
 assert.equal(catalog.byVariant.get('BREAD').rules.choices[0].name,'Marinara dip');assert.deepEqual(catalog.byVariant.get('BREAD').rules.choices[0].amounts,['0','1']);
});
test('per-code amounts, seasoning flags, defaults and menu topping limits are enforced',()=>{
 const large=catalog.byVariant.get('LHT'),selection=initialSelection(large);
 selection.amounts.P='1.5';assert.equal(usedSlots(large,selection.amounts),2);validateSelection(catalog,selection);
 selection.amounts.M='1';assert.throws(()=>validateSelection(catalog,selection),/2-slot/);
 selection.amounts={...large.rules.defaults,X:'0.5'};assert.throws(()=>validateSelection(catalog,selection),/allowed amount/);
 const personal=catalog.byVariant.get('PERSONAL'),p=initialSelection(personal);
 assert.deepEqual(personal.rules.choices.find(c=>c.code==='GOB').amounts,['0','1']);
 assert.equal(usedSlots(personal,p.amounts),1);p.amounts.GOB='0.5';assert.throws(()=>validateSelection(catalog,p),/Garlic seasoning/);
});
test('variant changes retain legal choices and adjust or remove unavailable options',()=>{
 const selection=initialSelection(catalog.byVariant.get('LHT'));selection.qty=3;selection.amounts.P='1.5';selection.amounts.M='1';
 const result=reconcileSelection(catalog,selection,'STHIN');assert.equal(result.changed,true);assert.equal(result.selection.qty,3);assert.equal(result.selection.amounts.P,'1');assert.equal(result.selection.amounts.M,undefined);validateSelection(catalog,result.selection);
});
test('real Item objects serialize into the same Order, preserving identity through edits',()=>{
 const draft=order(),builder=new LocalOrderBuilder(draft,catalog);draft.orderID='server-order-id';draft.pulseOrderGuid='server-guid';
 draft.validate=()=>{throw Error('No network calls allowed');};draft.price=draft.validate;draft.place=draft.validate;
 const first=builder.commit(initialSelection(catalog.byVariant.get('LHT')));assert(first instanceof Item);assert.equal(draft.products[0],first);
 const id=first.iD;builder.validatedRevision=0;builder.pricedRevision=0;
 const edited=builder.selection(0);edited.qty=2;edited.amounts.P='1';builder.commit(edited,0);
 assert.equal(builder.order,draft);assert.equal(draft.orderID,'server-order-id');assert.equal(draft.pulseOrderGuid,'server-guid');assert.equal(draft.products.length,1);assert.equal(draft.products[0].iD,id);assert.equal(builder.pricedRevision,null);assert.equal(builder.validatedRevision,null);
 const wire=JSON.parse(draft.payload).Order;assert.equal(wire.StoreID,'1234');assert.equal(wire.ServiceMethod,'Carryout');assert.equal(wire.Products[0].Code,'LHT');assert.equal(wire.Products[0].Qty,2);assert.deepEqual(wire.Products[0].Options.P,{'1/1':'1'});assert.equal(wire.Products[0].product,undefined);
 builder.remove(0);assert.equal(draft.products.length,0);
});
test('draft restoration is tied to store and service and validates the current menu',()=>{
 const first=new LocalOrderBuilder(order(),catalog);first.commit(initialSelection(catalog.byVariant.get('BREAD')));
 const next=new LocalOrderBuilder(order(),catalog);assert.deepEqual(next.restore(first.snapshot()),{restored:1,skipped:0});assert.equal(next.order.products[0].code,'BREAD');
 assert.deepEqual(new LocalOrderBuilder(order(),catalog).restore({...first.snapshot(),StoreID:'other'}),{restored:0,skipped:0});
 const bad={...first.snapshot(),Products:[{Code:'gone',Qty:1,Options:{}}]};assert.equal(new LocalOrderBuilder(order(),catalog).restore(bad).skipped,1);
});
test('Add Item opens pizza for an empty draft, commits one item, then opens collapsed sections',async()=>{
 const draft=order(),snapshots=[],screen=render(React.createElement(OrderBuilder,{order:draft,catalog,height:20,onChange:s=>snapshots.push(s)}));
 try{
  await tick();assert.match(screen.lastFrame(),/BYO Pizza/);await key(screen,'\x1b[B');await key(screen,'\r');assert.match(screen.lastFrame(),/Hand Tossed/);
  await key(screen,'+');assert.equal(draft.products.length,1);assert.match(screen.lastFrame(),/1 item · Local draft/);
  await key(screen,'a');assert.doesNotMatch(screen.lastFrame(),/BYO Pizza/);assert.match(screen.lastFrame(),/▸.*Pizzas/);
  await key(screen,'\x1b');await key(screen,'\r');
  await key(screen,'\x1b[B');await key(screen,'\x1b[B');await key(screen,'\r');assert.match(screen.lastFrame(),/Quantity/);
  await key(screen,'3');await key(screen,'\r');await key(screen,'+');assert.equal(draft.products.length,1);assert.equal(draft.products[0].qty,3);
  await key(screen,'d');assert.equal(draft.products.length,0);assert.equal(snapshots.at(-1).Products.length,0);
 }finally{screen.unmount();screen.cleanup();}
});
test('single-choice size and crust controls are hidden for bread',async()=>{
 const screen=render(React.createElement(OrderBuilder,{order:order(),catalog,height:20}));
 try{
  await tick(); // Close Pizza, move to Bread, expand and choose its one family.
  await key(screen,'\r');await key(screen,'\x1b[B');await key(screen,'\r');await key(screen,'\x1b[B');await key(screen,'\r');
  assert.match(screen.lastFrame(),/Cheesy Bread/);assert.match(screen.lastFrame(),/Quantity: 1/);assert.doesNotMatch(screen.lastFrame(),/Size:|Crust:/);
 }finally{screen.unmount();screen.cleanup();}
});
