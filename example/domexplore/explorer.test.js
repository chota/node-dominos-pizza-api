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
