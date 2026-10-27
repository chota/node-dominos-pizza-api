import React, {useEffect,useState} from 'react';
import {Box,useInput,useApp,useStdout} from 'ink';
import {Customer,Address,NearbyStores} from '../../index.js';
import {loadMenu} from './model.js';
import {Explorer} from './ui.js';
import {Text,palette} from './style.js';
const h=React.createElement;
const fields=[['firstName','First name'],['lastName','Family name'],['phone','Phone'],['email','Email'],['street','Street'],['city','City'],['region','State / region'],['postalCode','Postal code'],['unitType','Unit type'],['unitNumber','Unit number'],['deliveryInstructions','Delivery instructions']];
const steps=['Customer/address','Store','Menu','Items','Local Order','Validate','Price','Payment','Place','Track'];
const headings=['Who…?','Where from…?','What sounds good…?','Add an item','Review your order','Validate your order','Price your order','How will you pay…?','Place your order','Follow your order'];
const lessons=[
    'Customer + Address · Created locally. Nothing is sent yet.',
    'NearbyStores · Find a store open for online delivery.',
    'Menu · Choose a product, then its orderable variant.',
    'Item · A variant code, quantity, and your chosen options.',
    'Order · Contact details and items, held in one local draft.',
    'Validate · Send the draft and retain the returned order identity.',
    'Price · Obtain fresh totals. Edit items to repeat the basket loop.',
    'Payment · Attach payment after reviewing the latest price.',
    'Place · Submit once, then inspect the placement result.',
    'Tracking · Retrieve progress separately from the order basket.'
];
export function customerFrom(values){
    return new Customer({firstName:values.firstName||'',lastName:values.lastName||'',phone:values.phone||'',email:values.email||'',address:new Address(Object.fromEntries(fields.slice(4).map(([key])=>[key,values[key]||''])))});
}
export function LearningApp({services={NearbyStores,loadMenu}}){
    const [step,setStep]=useState(0),[values,setValues]=useState({}),[field,setField]=useState(0);
    const [editing,setEditing]=useState(false),[buffer,setBuffer]=useState(''),[details,setDetails]=useState(false);
    const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
    const [stores,setStores]=useState(null),[storeIndex,setStoreIndex]=useState(0),[storeID,setStoreID]=useState(null),[menu,setMenu]=useState(null);
    const {exit}=useApp(),{stdout}=useStdout();
    const [size,setSize]=useState({columns:stdout.columns||80,rows:stdout.rows||30});
    useEffect(()=>{
        const resize=()=>setSize({columns:stdout.columns||80,rows:stdout.rows||30});
        stdout.on?.('resize',resize);return()=>stdout.off?.('resize',resize);
    },[stdout]);
    const customer=customerFrom(values);
    const eligible=(stores?.stores||[]).filter(s=>s.IsOnlineCapable&&s.IsDeliveryStore&&s.IsOpen&&s.ServiceIsOpen?.Delivery);
    const request=async fn=>{setBusy(true);setStatus('Loading…');try{await fn();}catch(error){setStatus(error.message);}finally{setBusy(false);}};
    useInput((input,key)=>{
        if(editing){
            if(key.escape){setEditing(false);return;}
            if(key.return){setValues(old=>({...old,[fields[field][0]]:buffer.trim()}));if(field>=4){setStores(null);setStoreID(null);setMenu(null);}setEditing(false);return;}
            if(key.backspace||key.delete){setBuffer(old=>old.slice(0,-1));return;}
            if(input&&!key.ctrl&&!key.meta)setBuffer(old=>old+input.replace(/[\x00-\x1f\x7f]/g,''));return;
        }
        if(step===2&&menu)return;
        if(input==='q'){exit();return;}if(busy)return;
        if(input==='n'&&step===1&&!storeID){setStatus('Search and select a store before continuing.');return;}
        if(input==='n'){setStep(old=>Math.min(9,old+1));setStatus('');return;}
        if(input==='b'){setStep(old=>Math.max(0,old-1));setStatus('');return;}
        if(step===0){
            const last=details?fields.length-1:7;
            if(key.upArrow)setField(old=>Math.max(0,old-1));
            if(key.downArrow)setField(old=>Math.min(last,old+1));
            if(key.leftArrow&&field===1)setField(0);
            if(key.rightArrow&&field===0)setField(1);
            if(input==='d'){setDetails(old=>!old);if(details&&field>7)setField(7);}
            if(key.return){setBuffer(values[fields[field][0]]||'');setEditing(true);}
        }
        if(step===1){
            if(key.upArrow)setStoreIndex(old=>Math.max(0,old-1));
            if(key.downArrow)setStoreIndex(old=>Math.min(eligible.length-1,old+1));
            if(input==='s'){
                if(!customer.address.street||!customer.address.postalCode){setStatus('Enter your street and postal code first.');return;}
                request(async()=>{const result=await new services.NearbyStores(customer.address);setStores(result);setStoreIndex(0);setStatus('Choose a store with Enter.');});
            }
            if(key.return&&eligible[storeIndex]){setStoreID(String(eligible[storeIndex].StoreID));setMenu(null);setStep(2);setStatus('');}
        }
        if(step===2&&input==='l'&&!storeID){setStatus('Go back and select a store first.');return;}
        if(step===2&&input==='l')request(async()=>{setMenu(await services.loadMenu(storeID));setStatus('');});
    });
    const width=Math.max(16,Math.min(68,size.columns-4));
    const height=Math.max(8,size.rows),contentHeight=Math.max(4,height-6);
    const row=(indexes)=>h(Box,{key:indexes.join('-'),flexDirection:width>=44?'row':'column'},...indexes.map(i=>{
        const [key,label]=fields[i],selected=field===i;
        return h(Box,{key,width:width>=44?`${100/indexes.length}%`:'100%'},
            h(Text,{color:selected?palette.red:palette.text,wrap:'truncate'},`${selected?'›':' '} ${label}: ${editing&&selected?buffer+'▏':values[key]||'________'}`));
    }));
    let body;
    if(step===0){
        const rows=[{indexes:[0,1]},{indexes:[2]},{indexes:[3]},{heading:'Where…?'},{indexes:[4]},{indexes:[5,6]},{indexes:[7]}];
        if(details)rows.push({indexes:[8,9]},{indexes:[10]});
        const focused=rows.findIndex(r=>r.indexes?.includes(field));
        const capacity=Math.max(2,contentHeight-5);
        const cost=r=>width<44&&r.indexes?r.indexes.length:1;
        let start=0;
        while(start<focused&&rows.slice(start,focused+1).reduce((sum,r)=>sum+cost(r),0)>capacity)start++;
        let used=0;
        const visible=[];
        for(const r of rows.slice(start)){if(used+cost(r)>capacity)break;visible.push(r);used+=cost(r);}
        body=h(Box,{flexDirection:'column'},
            ...visible.map(r=>r.heading?h(Text,{key:'where',bold:true,color:palette.red},r.heading):row(r.indexes)),
            h(Box,{marginTop:1},h(Text,null,editing?'Type your value · Enter save · Esc cancel':`↑↓ select · Enter edit · d ${details?'fewer':'address'} details`)));
    }else if(step===1){
        const capacity=Math.max(1,contentHeight-5),start=Math.floor(storeIndex/capacity)*capacity;
        body=h(Box,{flexDirection:'column'},
            h(Text,null,storeID?`Selected store ${storeID}`:'No store selected'),
            h(Text,null,'Delivery coverage is confirmed by an address search.'),
            h(Box,{marginTop:1,flexDirection:'column'},
                ...eligible.slice(start,start+capacity).map((store,i)=>h(Text,{key:store.StoreID,color:start+i===storeIndex?palette.red:palette.text,wrap:'truncate'},`${start+i===storeIndex?'›':' '} 🏪 ${store.StoreID} · ${store.AddressDescription.replace(/\n/g,', ')}`)),
                stores&&!eligible.length?h(Text,null,'No nearby stores are open for online delivery.'):null),
            h(Box,{marginTop:1},h(Text,{color:palette.red},'s  Find delivery stores →')));
    }else if(step===2){
        body=menu?h(Explorer,{menu,storeID,embedded:true,height:contentHeight,onBack:()=>setStep(1),onNext:()=>setStep(3)}):h(Box,{flexDirection:'column'},h(Text,null,storeID?`Browse the live menu from store ${storeID}.`:'Select a store before loading its menu.'),storeID?h(Box,{marginTop:1},h(Text,{color:palette.red},'l  Load menu →')):null);
    }else{
        const icons=['','','','🍕','🧾','','','💳','🍕','🛵'];
        body=h(Box,{flexDirection:'column'},
            icons[step]?h(Text,null,icons[step]):null,
            step>=3&&step<=6?h(Text,null,'Items → Local Order → Validate → Price → Items'):null,
            h(Box,{marginTop:1},h(Text,null,'Learning step · execution will be connected as we go.')));
    }
    return h(Box,{flexDirection:'column',height,width:size.columns,backgroundColor:palette.background,alignItems:'center'},
        h(Box,{width,flexDirection:'column',height:2,flexShrink:0},
            h(Text,{bold:true},'🍕 domexplore'),
            h(Text,null,`${step+1} of 10 · ${steps[step]}`)),
        h(Box,{width,flexDirection:'column',height:contentHeight,justifyContent:step===2?'flex-start':'center',overflow:'hidden'},
            h(Text,{bold:true,color:palette.red},headings[step]),
            h(Box,{marginTop:1,flexDirection:'column'},body)),
        h(Box,{width,flexDirection:'column',height:4,flexShrink:0},
            h(Text,{color:status?palette.red:palette.text,wrap:'truncate'},status||lessons[step]),
            h(Box,{marginTop:1,justifyContent:'space-between'},
                h(Text,null,step?'b  Back':'q  Quit'),
                h(Text,{color:palette.red,bold:true},step<9?'n  Continue →':'q  Done'))));
}
