import React, {useEffect,useState} from 'react';
import {Box,Text,useInput,useApp,useStdout} from 'ink';
import {Customer,Address,NearbyStores} from '../../index.js';
import {loadMenu} from './model.js';
import {Explorer} from './ui.js';
import {ResponsePanel} from './responses.js';
const h=React.createElement;
const fields=[['firstName','First name'],['lastName','Last name'],['phone','Phone'],['email','Email'],['street','Street'],['city','City'],['region','State / region'],['postalCode','Postal code'],['unitType','Unit type'],['unitNumber','Unit number'],['deliveryInstructions','Delivery instructions']];
const steps=['Customer/address','Store','Menu','Items','Local Order','Validate','Price','Payment','Place','Track'];
const lessons=[
    'Customer and Address are local objects. No request is sent by their constructors.',
    'NearbyStores searches your address. Select a store open for online delivery.',
    'Menu is store-specific. Products describe families; variants supply orderable codes.',
    'Item holds one variant code, quantity and options. Construction is local.',
    'Order(customer) copies contact fields. addItem changes its local products array.',
    'validate() POSTs the draft and applies the returned Order. This can affect DSS.',
    'price() POSTs the updated draft and applies totals. Edit items and repeat the loop.',
    'Payment is attached after reviewing a fresh price. It does not place the order.',
    'place() submits the order. Inspect the response; do not retry an ambiguous submission.',
    'Tracking is separate from the basket. It retrieves the submitted order’s progress.'
];
export function customerFrom(values){
    return new Customer({firstName:values.firstName||'',lastName:values.lastName||'',phone:values.phone||'',email:values.email||'',address:new Address(Object.fromEntries(fields.slice(4).map(([key])=>[key,values[key]||''])))});
}
export function LearningApp({terminal,initialStoreID='2801',services={NearbyStores,loadMenu}}){
    const [step,setStep]=useState(0),[values,setValues]=useState({}),[field,setField]=useState(0);
    const [editing,setEditing]=useState(false),[buffer,setBuffer]=useState('');
    const [advanced,setAdvanced]=useState(terminal?.advanced||false),[inspect,setInspect]=useState(false);
    const [records,setRecords]=useState([]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
    const [stores,setStores]=useState(null),[storeIndex,setStoreIndex]=useState(0),[storeID,setStoreID]=useState(initialStoreID),[menu,setMenu]=useState(null);
    const {exit}=useApp(),{stdout}=useStdout();
    const [size,setSize]=useState({columns:stdout.columns||80,rows:stdout.rows||30});
    useEffect(()=>{
        const onAdvanced=enabled=>{setAdvanced(enabled);if(!enabled)setInspect(false);};
        const resize=()=>setSize({columns:stdout.columns||80,rows:stdout.rows||30});
        terminal?.events.on('advanced',onAdvanced);stdout.on?.('resize',resize);
        return()=>{terminal?.events.off('advanced',onAdvanced);stdout.off?.('resize',resize);};
    },[terminal,stdout]);
    const record=(label,data)=>setRecords(old=>[...old,{label,data}].slice(-10));
    const customer=customerFrom(values);
    const eligible=(stores?.stores||[]).filter(s=>s.IsOnlineCapable&&s.IsDeliveryStore&&s.IsOpen&&s.ServiceIsOpen?.Delivery);
    const request=async fn=>{setBusy(true);setStatus('Requesting…');try{await fn();}catch(error){setStatus(error.message);}finally{setBusy(false);}};
    useInput((input,key)=>{
        if(key.tab&&advanced&&!editing){setInspect(old=>!old);return;}
        if(inspect){if(input==='q')exit();return;}
        if(editing){
            if(key.escape){setEditing(false);return;}
            if(key.return){setValues(old=>({...old,[fields[field][0]]:buffer.trim()}));setEditing(false);return;}
            if(key.backspace||key.delete){setBuffer(old=>old.slice(0,-1));return;}
            if(input&&!key.ctrl&&!key.meta)setBuffer(old=>old+input.replace(/[\x00-\x1f\x7f]/g,''));return;
        }
        if(step===2&&menu)return; // The browser owns filtering and navigation.
        if(input==='q'){exit();return;}if(busy)return;
        if(input==='n'){setStep(old=>Math.min(9,old+1));setStatus('');return;}
        if(input==='b'){setStep(old=>Math.max(0,old-1));setStatus('');return;}
        if(step===0){
            if(key.upArrow)setField(old=>Math.max(0,old-1));
            if(key.downArrow)setField(old=>Math.min(fields.length-1,old+1));
            if(key.return){setBuffer(values[fields[field][0]]||'');setEditing(true);}
        }
        if(step===1){
            if(key.upArrow)setStoreIndex(old=>Math.max(0,old-1));
            if(key.downArrow)setStoreIndex(old=>Math.min(eligible.length-1,old+1));
            if(input==='s'){
                if(!customer.address.street||!customer.address.postalCode){setStatus('Enter street and postal code in Customer/address first.');return;}
                request(async()=>{const result=await new services.NearbyStores(customer.address);record('GET store-locator',result.dominosAPIResponse);setStores(result);setStoreIndex(0);setStatus('Search complete. Enter selects an eligible store.');});
            }
            if(key.return&&eligible[storeIndex]){setStoreID(String(eligible[storeIndex].StoreID));setMenu(null);setStep(2);setStatus('');}
        }
        if(step===2&&input==='l')request(async()=>{const result=await services.loadMenu(storeID);record(`GET store/${storeID}/menu`,result);setMenu(result);setStatus('');});
    });
    const panelHeight=advanced?Math.min(9,Math.max(4,Math.floor(size.rows/3))):0;
    const height=Math.max(5,size.rows-1),mainHeight=Math.max(3,height-panelHeight);
    const body=[];
    if(step===0){
        body.push(h(Text,{key:'title',bold:true},'Who and where · Customer + Address'));
        const visible=Math.max(2,mainHeight-10),start=Math.floor(field/visible)*visible;
        body.push(...fields.slice(start,start+visible).map(([key,label],i)=>h(Text,{key,inverse:start+i===field,wrap:'truncate'},`${start+i===field?'›':' '} ${label}: ${editing&&start+i===field?buffer+'▌':values[key]||'—'}`)));
        body.push(h(Text,{key:'object',dimColor:true,wrap:'truncate'},`Local Customer: ${customer.firstName} ${customer.lastName} · phone ${customer.phone||'—'}`));
        body.push(h(Text,{key:'address',dimColor:true,wrap:'truncate'},`Address lines: ${customer.address.addressLines.line1} / ${customer.address.addressLines.line2}`));
        body.push(h(Text,{key:'help'},editing?'Type value · Enter save · Esc cancel':'↑↓ field · Enter edit · n next'));
    }else if(step===1){
        body.push(h(Text,{key:'store',bold:true},'Choose an open delivery store'));
        body.push(h(Text,{key:'hint'},'s search with customer address · ↑↓ select · Enter choose'));
        body.push(h(Text,{key:'target',dimColor:true},`Menu exploration target: ${storeID} (not verified for delivery until selected from a search)`));
        const visible=Math.max(1,mainHeight-10),start=Math.floor(storeIndex/visible)*visible;
        body.push(...eligible.slice(start,start+visible).map((store,i)=>h(Text,{key:store.StoreID,inverse:start+i===storeIndex,wrap:'truncate'},`${store.StoreID} · ${store.AddressDescription.replace(/\n/g,', ')}`)));
        if(stores&&!eligible.length)body.push(h(Text,{key:'none'},'No returned stores are currently open for online delivery.'));
    }else if(step===2){
        if(menu)body.push(h(Explorer,{key:'browser',menu,storeID,fetchedAt:'this session',active:!inspect,embedded:true,height:mainHeight-5,onBack:()=>setStep(1),onNext:()=>setStep(3)}));
        else body.push(h(Text,{key:'load'},`l load live menu for store ${storeID} · n lesson: items`));
    }else{
        body.push(h(Text,{key:'phase',bold:true},steps[step]));
        body.push(h(Text,{key:'loop'},step>=3&&step<=6?'Basket loop: Items → Local Order → Validate → Price → Items':''));
        body.push(h(Text,{key:'scope'},'Learning page · execution of this step is not connected yet.'));
        body.push(h(Text,{key:'help'},'n next lesson · b previous lesson'));
    }
    return h(Box,{flexDirection:'column',height,width:size.columns},
        h(Box,{height:mainHeight,flexDirection:'column',overflow:'hidden'},
            h(Text,{bold:true,wrap:'truncate'},`domexplore · ${step+1}/10 ${steps[step]}${advanced?' · ADVANCED':''}`),
            h(Text,{dimColor:true,wrap:'truncate'},steps.map((s,i)=>i===step?'['+s+']':s).join(' → ')),
            h(Text,{wrap:'wrap'},lessons[step]),
            h(Box,{marginTop:1,flexDirection:'column',flexGrow:1,overflow:'hidden'},...body),
            h(Text,{color:status?'yellow':undefined,wrap:'truncate'},status||'Local session · q quit · b previous · n next'+(advanced?' · Tab API responses':''))),
        advanced?h(ResponsePanel,{records,active:inspect,height:panelHeight}):null
    );
}
