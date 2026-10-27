import test from 'node:test';
import assert from 'node:assert/strict';
import {Order,Customer} from '../../index.js';
import {Checkout,cardValid} from './checkout.js';
import {LocalOrderBuilder} from './order-builder.js';
import {prepareCatalog,initialSelection} from './catalog.js';
import {builderMenu} from './builder-fixture.js';
import {cleanConfig} from './config.js';
import {trackerURL,trackOrders} from './tracking.js';
const catalog=prepareCatalog(builderMenu),ok=()=>({Status:0,Order:{Status:0,OrderID:'confirmed',Amounts:{Customer:12.34},Products:[]}});
function setup(options={}){
 const order=new Order(new Customer({firstName:'Alex',lastName:'Example',phone:'3145550123',email:'alex@example.com',address:{street:'Test',city:'Test',region:'IL',postalCode:'12345'}}));order.storeID='1234';order.serviceMethod='Carryout';
 const builder=new LocalOrderBuilder(order,catalog);builder.commit(initialSelection(catalog.byVariant.get('LHT')));
 const calls=[];order.validate=async()=>{calls.push('validate');order.validationResponse=ok();};order.price=async()=>{calls.push('price');order.priceResponse=ok();};order.place=async()=>{calls.push('place');order.placeResponse=ok();};
 const checkout=new Checkout(builder,{storeInfo:{AcceptablePaymentTypes:['Cash','CreditCard'],AcceptableCreditCards:['Visa']},onPending:value=>calls.push(value?'persist pending':'clear pending'),onPlaced:()=>calls.push('persist receipt'),...options});
 return {order,builder,checkout,calls};
}
test('checkout follows validate, price, payment and explicit single placement on the same Order',async()=>{
 const {order,checkout,calls}=setup();assert.equal(await checkout.quote(),12.34);checkout.setPayment('Cash');assert.equal(order.payments[0].formatted.Type,'Cash');
 await assert.rejects(checkout.place(''),/Type PLACE/);assert.equal(calls.includes('place'),false);
 const receipt=await checkout.place('PLACE');assert.equal(receipt.OrderID,'confirmed');assert.equal(checkout.order,order);assert.deepEqual(calls,['validate','price','persist pending','place','persist receipt']);assert.equal(order.payments.length,0);
 await assert.rejects(checkout.place('PLACE'),/already/);await assert.rejects(new Checkout(checkout.builder).quote(),/already/);
});
test('validation, pricing and product failures stop checkout',async()=>{
 for(const stage of ['validate','price'])for(const level of ['top','nested']){
  const {checkout,order}=setup();order[stage]=async()=>{const response=ok();if(level==='top')response.Status=-1;else response.Order.Status=-1;order[stage==='price'?'priceResponse':'validationResponse']=response;};await assert.rejects(checkout.quote(),/Unable/);assert.equal(checkout.fresh(),false);
 }
 const {checkout,order}=setup();order.price=async()=>{order.priceResponse=ok();order.priceResponse.Order.Products=[{Status:-1}];};await assert.rejects(checkout.quote(),/item is unavailable/);
});
test('item changes and elapsed time require a fresh quote and clear payment',async()=>{
 let now=Date.UTC(2026,9,26);const {checkout,builder,order}=setup({now:()=>now});await checkout.quote();checkout.setPayment('Cash');builder.commit(initialSelection(catalog.byVariant.get('BREAD')));assert.equal(order.payments.length,0);assert.equal(checkout.fresh(),false);await assert.rejects(checkout.place('PLACE'),/refresh/);
 await checkout.quote();now+=300001;assert.throws(()=>checkout.setPayment('Cash'),/refresh/);
});
test('card validation and cache whitelist keep credentials out of persisted data',async()=>{
 const {checkout,order}=setup({now:()=>Date.UTC(2026,9,26)});await checkout.quote();assert.equal(cardValid('4111111111111111'),true);assert.equal(cardValid('4111111111111112'),false);
 assert.throws(()=>checkout.setPayment('CreditCard',{number:'4111111111111111',expiration:'0120',securityCode:'123',postalCode:'12345'}),/expired/);
 checkout.setPayment('CreditCard',{number:'4111111111111111',expiration:'1230',securityCode:'123',postalCode:'12345'});assert.equal(order.payments[0].amount,12.34);
 const saved=JSON.stringify(cleanConfig({draftOrder:order,pendingOrder:{id:'safe',number:'4111111111111111',securityCode:'123'}}));assert.doesNotMatch(saved,/4111111111111111|securityCode|payments/i);assert.equal(cleanConfig({pendingOrder:{id:'safe'}}).pendingOrder.id,'safe');
});
test('failure to persist the pending marker prevents any placement request',async()=>{
 const {checkout,calls}=setup({onPending:()=>{throw Error('disk full');}});await checkout.quote();checkout.setPayment('Cash');await assert.rejects(checkout.place('PLACE'),/disk full/);assert.equal(calls.includes('place'),false);
});
test('interrupted placement retains pending protection, including across restart',async()=>{
 let marker;const {checkout,order}=setup({onPending:value=>marker=value});await checkout.quote();checkout.setPayment('Cash');order.place=async()=>{throw Error('connection lost');};await assert.rejects(checkout.place('PLACE'),/interrupted/);assert.ok(marker);await assert.rejects(checkout.place('PLACE'),/already/);
 const restored=new Checkout(checkout.builder,{pendingOrder:cleanConfig({pendingOrder:marker}).pendingOrder});await assert.rejects(restored.quote(),/pending/);
});
test('both placement statuses are required; verification failure cannot be retried',async()=>{
 const {checkout,order}=setup();await checkout.quote();checkout.setPayment('Cash');order.place=async()=>{order.placeResponse={Status:-1,Order:{Status:0,OrderID:'not-proof'},StatusItems:[{Code:'recaptchaVerificationRequired'}]};};await assert.rejects(checkout.place('PLACE'),/verification/);assert.equal(checkout.placed,false);assert.equal(checkout.pendingOrder,null);await assert.rejects(checkout.place('PLACE'),/verification/);
});
test('accepted response remains accepted even if SDK throws while parsing; failed receipt save blocks retries',async()=>{
 const {checkout,order}=setup({onPlaced:()=>{throw Error('disk full');}});await checkout.quote();checkout.setPayment('Cash');order.place=async()=>{order.placeResponse=ok();throw Error('SDK parse error');};await assert.rejects(checkout.place('PLACE'),/Order accepted/);assert.equal(checkout.placed,true);assert.ok(checkout.pendingOrder);await assert.rejects(checkout.place('PLACE'),/already/);
});
test('concurrent placement cannot submit twice',async()=>{
 const {checkout,order}=setup();await checkout.quote();checkout.setPayment('Cash');let finish;order.place=()=>new Promise(resolve=>finish=()=>{order.placeResponse=ok();resolve();});const first=checkout.place('PLACE');await assert.rejects(checkout.place('PLACE'),/already/);finish();await first;
});
test('tracking resolves service-relative links safely and returns readable status only',async()=>{
 assert.equal(trackerURL('/v2/orders/abc').pathname,'/tracker-presentation-service/v2/orders/abc');for(const path of ['https://example.com','//example.com','/other','../../other'])assert.throws(()=>trackerURL(path),/unavailable/);
 const calls=[];const result=await trackOrders('3145550123',async(url,options)=>{calls.push(String(url));assert.equal(options.redirect,'error');return {ok:true,json:async()=>calls.length===1?[{Actions:{Track:'/v2/orders/abc'}}]:{OrderID:'abc',OrderStatus:'Baking',secret:'excluded'}};});assert.deepEqual(result,[{id:'abc',status:'Baking',storeID:''}]);assert.equal(calls.length,2);
});

import React from 'react';
import {render} from 'ink-testing-library';
import {CheckoutPanel} from './checkout-ui.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,70));
test('checkout screen requires PLACE and shows confirmation without JSON or diagnostic controls',async()=>{
 const {checkout,calls}=setup();await checkout.quote();const screen=render(React.createElement(CheckoutPanel,{checkout,height:16,onBack:()=>{}}));
 try{
  await tick();assert.match(screen.lastFrame(),/Total \$12.34/);screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/Type PLACE/);assert.doesNotMatch(screen.lastFrame(),/JSON|API|inspect/);
  screen.stdin.write('PLACE');await tick();screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/Order placed/);assert.equal(calls.filter(call=>call==='place').length,1);
 }finally{screen.unmount();screen.cleanup();}
});
test('saved card prefills masked fields, focuses security code and persists only reusable payment fields',async()=>{
 const {checkout}=setup({now:()=>Date.UTC(2026,9,26)});await checkout.quote();const saved=[];
 const screen=render(React.createElement(CheckoutPanel,{checkout,height:16,onBack:()=>{},savedPayment:{number:'4111111111111111',expiration:'1230',postalCode:'12345'},onSavePayment:value=>saved.push(value)}));
 try{
  await tick();screen.stdin.write('\x1b[B');await tick();screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/› Security code:/);assert.doesNotMatch(screen.lastFrame(),/4111111111111111/);screen.stdin.write('123');await tick();screen.stdin.write('\r');await tick();screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/Type PLACE/);assert.deepEqual(saved,[{number:'4111111111111111',expiration:'1230',postalCode:'12345'}]);
 }finally{screen.unmount();screen.cleanup();}
});
