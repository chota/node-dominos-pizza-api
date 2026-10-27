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

// The mouse has one target only; all object browsing stays on the keyboard.
import {CornerGesture,MouseDecoder,terminalControls} from './terminal.js';
import {treeRows,ResponsePanel} from './responses.js';
import {LearningApp,customerFrom} from './learning.js';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
const click=(gesture,x=80,y=24,now=100)=>{
 gesture.accept({button:0,x,y,release:false},80,24,now);
 return gesture.accept({button:0,x,y,release:true},80,24,now+1);
};
test('only five consecutive corner clicks toggle; releases are not double-counted',()=>{
 const gesture=new CornerGesture();
 for(let i=0;i<4;i++)assert.equal(click(gesture,80,24,100+i*100),false);
 assert.equal(click(gesture,80,24,500),true);
 assert.equal(gesture.accept({button:0,x:80,y:24,release:true},80,24,501),false);
 for(let i=0;i<5;i++)assert.equal(click(gesture,79,24,600+i*100),false);
 for(let i=0;i<4;i++)click(gesture,80,24,1200+i*100);
 assert.equal(click(gesture,80,24,3000),false);
 gesture.accept({button:2,x:80,y:24,release:false},80,24,3010);
 assert.equal(gesture.count,0);
});
test('mouse decoder consumes fragmented/coalesced reports and preserves keyboard input',()=>{
 const events=[],keys=[];const decoder=new MouseDecoder(e=>events.push(e),s=>keys.push(s));
 decoder.push('Alex\x1b[<0;8');decoder.push('0;24M\x1b[<0;80;24m\x1b[A');
 assert.equal(events.length,2);assert.equal(events[0].x,80);assert.equal(events[1].release,true);
 assert.equal(keys.join(''),'Alex\x1b[A');
 decoder.push('\x1b');decoder.flush();assert.equal(keys.at(-1),'\x1b');
 decoder.push('\x1b[<0;80;');decoder.flush();assert.equal(keys.at(-1),'\x1b');
});
test('terminal wiring toggles twice, tracks resize, and disables reporting on close',()=>{
 const stdin=new PassThrough();stdin.isTTY=true;stdin.setRawMode=()=>{};
 const stdout=new PassThrough();stdout.isTTY=true;stdout.columns=80;stdout.rows=24;
 let output='';stdout.on('data',chunk=>output+=chunk.toString());
 const control=terminalControls(stdin,stdout);
 let changes=[];control.events.on('advanced',value=>changes.push(value));
 const report=(x,y)=>`\x1b[<0;${x};${y}M\x1b[<0;${x};${y}m`;
 stdin.write(report(80,24).repeat(5));assert.equal(control.advanced,true);
 assert.match(output,/\x1b\[42m/);
 stdin.write(report(80,24).repeat(4));stdout.columns=100;stdout.rows=30;stdout.emit('resize');
 stdin.write(report(80,24));assert.equal(control.advanced,true);
 stdin.write(report(100,30).repeat(5));assert.equal(control.advanced,false);
 assert.deepEqual(changes,[true,false]);
 control.close();assert.match(output,/\x1b\[\?1000l\x1b\[\?1006l/);
 assert.equal(stdin.listenerCount('data'),0);assert.equal(stdout.listenerCount('resize'),0);
 stdin.destroy();stdout.destroy();
});
test('response trees retain a parent row when collapsed and expose exact fields when expanded',()=>{
 const records=[{label:'GET menu',data:{Variants:{SMALL:{Code:'SMALL'}}}}];
 assert.equal(treeRows(records,new Set()).length,1);
 const expanded=new Set([JSON.stringify([0]),JSON.stringify([0,'Variants'])]);
 const rows=treeRows(records,expanded);assert.equal(rows.length,3);assert.equal(rows[2].label,'SMALL');
 expanded.delete(JSON.stringify([0]));assert.equal(treeRows(records,expanded).length,1);
});
test('customer first; corner advanced state shows empty responses without making requests',async()=>{
 const terminal={events:new EventEmitter(),advanced:false};
 const screen=render(React.createElement(LearningApp,{terminal}));
 try{
  await tick();assert.match(screen.lastFrame(),/1\/10 Customer\/address/);
  assert.doesNotMatch(screen.lastFrame(),/API responses/);
  screen.stdin.write('\r');await tick();screen.stdin.write('Alex');await tick();screen.stdin.write('\r');await tick();
  assert.match(screen.lastFrame(),/First name: Alex/);
  terminal.events.emit('advanced',true);await tick();assert.match(screen.lastFrame(),/ADVANCED/);assert.match(screen.lastFrame(),/No API requests yet/);
  terminal.events.emit('advanced',false);await tick();assert.doesNotMatch(screen.lastFrame(),/API responses/);
  screen.stdin.write('n');await tick();assert.match(screen.lastFrame(),/2\/10 Store/);
 }finally{screen.unmount();screen.cleanup();}
});
test('keyboard expands and collapses response panel',async()=>{
 const screen=render(React.createElement(ResponsePanel,{records:[{label:'GET menu',data:{Products:{}}}],active:true}));
 try{
  await tick();assert.doesNotMatch(screen.lastFrame(),/Products/);
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/Products/);
  screen.stdin.write('\r');await tick();assert.doesNotMatch(screen.lastFrame(),/Products/);
 }finally{screen.unmount();screen.cleanup();}
});
test('live-response presentation is gated by advanced mode and keyboard focus',async()=>{
 const terminal={events:new EventEmitter(),advanced:false};
 const screen=render(React.createElement(LearningApp,{terminal,services:{loadMenu:async()=>menu}}));
 try{
  await tick();screen.stdin.write('n');await tick();screen.stdin.write('n');await tick();
  screen.stdin.write('l');await tick();await tick();assert.match(screen.lastFrame(),/3\/10 Menu/);
  assert.doesNotMatch(screen.lastFrame(),/GET store\/2801\/menu/);
  terminal.events.emit('advanced',true);await tick();assert.match(screen.lastFrame(),/GET store\/2801\/menu/);
  screen.stdin.write('\t');await tick();screen.stdin.write('\r');await tick();
  assert.match(screen.lastFrame(),/▾ GET store\/2801\/menu/);
  screen.stdin.write('\r');await tick();assert.match(screen.lastFrame(),/▸ GET store\/2801\/menu/);
 }finally{screen.unmount();screen.cleanup();}
});
