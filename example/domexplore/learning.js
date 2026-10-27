import React, {useEffect,useState,useRef} from 'react';
import {Box,useInput,useApp,useStdout} from 'ink';
import {Customer,Address,NearbyStores} from '../../index.js';
import {loadMenu} from './model.js';
import {Explorer} from './ui.js';
import {Text,palette} from './style.js';
import {locateAddress} from './location.js';
import {configWithValues} from './config.js';
const emptyConfig=Object.freeze({});
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
export function LearningApp({initialConfig=emptyConfig,onPersist=()=>{},initialNotice='',services={NearbyStores,loadMenu,locateAddress}}){
    const initialValues={...initialConfig.customer,...initialConfig.address};
    const [step,setStep]=useState(0),[part,setPart]=useState('who'),[values,setValues]=useState(initialValues),[field,setField]=useState(0);
    const [editing,setEditing]=useState(true),[replace,setReplace]=useState(true),[details,setDetails]=useState(false);
    const [status,setStatus]=useState(initialNotice),[busy,setBusy]=useState(false),[locating,setLocating]=useState(false);
    const [stores,setStores]=useState(null),[storeIndex,setStoreIndex]=useState(-1),[storeID,setStoreID]=useState(null),[menu,setMenu]=useState(null);
    const locationRequest=useRef(null),didLocate=useRef(false),revisions=useRef({}),latest=useRef(initialValues),persist=useRef(onPersist);
    latest.current=values;persist.current=onPersist;
    const {exit}=useApp(),{stdout}=useStdout();
    const [size,setSize]=useState({columns:stdout.columns||80,rows:stdout.rows||30});
    const writeValues=(next)=>{
        latest.current=next;setValues(next);
    };
    const editValue=(value)=>{
        const key=fields[field][0];revisions.current[key]=(revisions.current[key]||0)+1;
        writeValues({...latest.current,[key]:value});setReplace(false);
        if(field>=4){setStores(null);setStoreID(null);setMenu(null);}
    };
    const focus=(index)=>{setField(index);setEditing(true);setReplace(true);};
    const where=()=>{setPart('where');focus(4);setStatus('');};
    const previous=()=>{
        setStatus('');
        if(step===0&&part==='where'){setPart('who');focus(0);}
        else if(step===1){setStep(0);setPart('where');focus(4);}
        else setStep(old=>Math.max(0,old-1));
    };
    const useLocation=async(force=false)=>{
        if(locationRequest.current)return;
        const controller=new AbortController();locationRequest.current=controller;
        const before={...revisions.current};setLocating(true);setStatus('Finding your address… Allow location access if macOS asks.');
        try{
            const address=await (services.locateAddress||locateAddress)({signal:controller.signal});
            if(controller.signal.aborted)return;
            const next={...latest.current};
            for(const key of ['street','city','region','postalCode']){
                if(typeof address[key]==='string'&&address[key]&&(revisions.current[key]||0)===(before[key]||0)&&(force||!next[key]))next[key]=address[key];
            }
            writeValues(next);setStores(null);setStoreID(null);setMenu(null);
            setStatus('Location filled. Review your delivery address.');
        }catch(error){if(!controller.signal.aborted)setStatus(error.message);}
        finally{if(!controller.signal.aborted)setLocating(false);locationRequest.current=null;}
    };
    useEffect(()=>{
        const resize=()=>setSize({columns:stdout.columns||80,rows:stdout.rows||30});
        stdout.on?.('resize',resize);return()=>stdout.off?.('resize',resize);
    },[stdout]);
    useEffect(()=>{
        const timer=setTimeout(()=>{try{persist.current(configWithValues(initialConfig,latest.current));}catch(error){setStatus(`Could not save settings: ${error.message}`);}},150);
        return()=>clearTimeout(timer);
    },[values,initialConfig]);
    useEffect(()=>()=>{
        locationRequest.current?.abort();
        try{persist.current(configWithValues(initialConfig,latest.current));}catch{}
    },[initialConfig]);
    useEffect(()=>{
        if(step===0&&part==='where'&&!didLocate.current){
            didLocate.current=true;
            if(!latest.current.street||!latest.current.postalCode)void useLocation();
        }
        if(step!==0||part!=='where'){locationRequest.current?.abort();setLocating(false);}
    },[step,part]);
    const customer=customerFrom(values);
    const eligible=(stores?.stores||[]).filter(s=>s.IsOnlineCapable&&s.IsDeliveryStore&&s.IsOpen&&s.ServiceIsOpen?.Delivery);
    const request=async fn=>{setBusy(true);setStatus('Loading…');try{await fn();}catch(error){setStatus(error.message);}finally{setBusy(false);}};
    useInput((input,key)=>{
        if(step===0&&part==='where'&&key.ctrl&&input==='l'){void useLocation(true);return;}
        if(key.leftArrow){if(!(step===2&&menu))previous();return;}
        if(step===0&&editing){
            if(key.escape){setEditing(false);return;}
            if(key.ctrl&&input==='u'){editValue('');return;}
            const first=part==='who'?0:4,last=part==='who'?3:details?10:7;
            if(key.return||key.tab){
                writeValues({...latest.current,[fields[field][0]]:(latest.current[fields[field][0]]||'').trim()});
                if(key.shift&&key.tab){focus(Math.max(first,field-1));return;}
                if(field<last)focus(field+1);
                else if(part==='who')where();
                else setEditing(false);
                return;
            }
            if(key.upArrow){focus(Math.max(first,field-1));return;}
            if(key.downArrow){focus(Math.min(last,field+1));return;}
            if(key.backspace||key.delete){editValue((latest.current[fields[field][0]]||'').slice(0,-1));return;}
            if(input&&!key.ctrl&&!key.meta)editValue((replace?'':latest.current[fields[field][0]]||'')+input.replace(/[\x00-\x1f\x7f]/g,''));
            return;
        }
        if(step===2&&menu)return;
        if(input==='q'){exit();return;}if(busy)return;
        if(key.backspace||key.delete){previous();return;}
        if((input==='n'||(key.return&&step===0))&&step===0){
            if(part==='who')where();else{setStoreIndex(-1);setStep(1);setStatus('');}return;
        }
        if(input==='n'&&step===1&&!storeID){setStatus('Search and select a store before continuing.');return;}
        if(input==='n'){setStep(old=>Math.min(9,old+1));setStatus('');return;}
        if(step===0){
            if(key.upArrow)focus(Math.max(part==='who'?0:4,field-1));
            if(key.downArrow)focus(Math.min(part==='who'?3:details?10:7,field+1));
            if(input==='d'&&part==='where'){setDetails(old=>!old);if(details&&field>7)setField(7);}
        }
        if(step===1){
            if(key.upArrow)setStoreIndex(old=>Math.max(-1,old-1));
            if(key.downArrow)setStoreIndex(old=>Math.min(eligible.length-1,old+1));
            if(input==='s'||(key.return&&storeIndex===-1)){
                if(!customer.address.street||!customer.address.postalCode){setStatus('Enter your street and postal code first.');return;}
                request(async()=>{const result=await new services.NearbyStores(customer.address);setStores(result);setStoreIndex(result.stores.some(s=>s.IsOnlineCapable&&s.IsDeliveryStore&&s.IsOpen&&s.ServiceIsOpen?.Delivery)?0:-1);setStatus('Choose a store with Enter.');});
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
            h(Text,{color:selected?palette.red:palette.text,wrap:'truncate'},`${selected?'›':' '} ${label}: ${editing&&selected?(values[key]||'')+'▏':values[key]||'________'}`));
    }));
    let body;
    if(step===0){
        const rows=part==='who'?[{indexes:[0,1]},{indexes:[2]},{indexes:[3]}]:[{indexes:[4]},{indexes:[5,6]},{indexes:[7]}];
        if(part==='where'&&details)rows.push({indexes:[8,9]},{indexes:[10]});
        const focused=rows.findIndex(r=>r.indexes?.includes(field));
        const capacity=Math.max(2,contentHeight-5);
        const cost=r=>width<44&&r.indexes?r.indexes.length:1;
        let start=0;
        while(start<focused&&rows.slice(start,focused+1).reduce((sum,r)=>sum+cost(r),0)>capacity)start++;
        let used=0;
        const visible=[];
        for(const r of rows.slice(start)){if(used+cost(r)>capacity)break;visible.push(r);used+=cost(r);}
        body=h(Box,{flexDirection:'column'},
            part==='where'?h(Text,{color:palette.red},locating?'📍 Finding location…':'📍 Ctrl+L · Use my location'):null,
            ...visible.map(r=>r.heading?h(Text,{key:'where',bold:true,color:palette.red},r.heading):row(r.indexes)),
            part==='where'?h(Box,{marginTop:1},h(Text,null,editing?'Enter next · ↑↓ move · Ctrl+U clear · Esc navigation':`Enter continue · ↑↓ edit · d ${details?'fewer':'address'} details`)):null);
    }else if(step===1){
        const capacity=Math.max(1,contentHeight-5),start=Math.floor(Math.max(0,storeIndex)/capacity)*capacity;
        body=h(Box,{flexDirection:'column'},
            h(Text,null,storeID?`Selected store ${storeID}`:'No store selected'),
            h(Text,null,'Delivery coverage is confirmed by an address search.'),
            h(Box,{marginTop:1,flexDirection:'column'},
                ...eligible.slice(start,start+capacity).map((store,i)=>h(Text,{key:store.StoreID,color:start+i===storeIndex?palette.red:palette.text,wrap:'truncate'},`${start+i===storeIndex?'›':' '} 🏪 ${store.StoreID} · ${store.AddressDescription.replace(/\n/g,', ')}`)),
                stores&&!eligible.length?h(Text,null,'No nearby stores are open for online delivery.'):null),
            h(Box,{marginTop:1},h(Text,{color:palette.red,bold:storeIndex===-1},`${storeIndex===-1?'›':' '} Find delivery stores →${storeIndex===-1?'  Enter':'  s'}`)));
    }else if(step===2){
        body=menu?h(Explorer,{menu,storeID,embedded:true,height:contentHeight,onBack:()=>setStep(1),onNext:()=>setStep(3)}):h(Box,{flexDirection:'column'},h(Text,null,storeID?`Browse the live menu from store ${storeID}.`:'Select a store before loading its menu.'),storeID?h(Box,{marginTop:1},h(Text,{color:palette.red},'l  Load menu →')):null);
    }else{
        const icons=['','','','🍕','🧾','','','💳','🍕','🛵'];
        body=h(Box,{flexDirection:'column'},
            icons[step]?h(Text,null,icons[step]):null,
            step>=3&&step<=6?h(Text,null,'Items → Local Order → Validate → Price → Items'):null,
            step===4&&initialConfig.lastOrder?h(Text,null,`Last order: ${initialConfig.lastOrder.orderID||'—'} · Store ${initialConfig.lastOrder.storeID||'—'} · ${initialConfig.lastOrder.products?.length||0} items`):null,
            h(Box,{marginTop:1},h(Text,null,'Learning step · execution will be connected as we go.')));
    }
    return h(Box,{flexDirection:'column',height,width:size.columns,backgroundColor:palette.background,alignItems:'center'},
        h(Box,{width,flexDirection:'column',height:2,flexShrink:0},
            h(Text,{bold:true},'🍕 domexplore'),
            h(Text,null,`${step+1} of 10 · ${steps[step]}${step===0?(part==='who'?' · Who':' · Where'):''}`)),
        h(Box,{width,flexDirection:'column',height:contentHeight,justifyContent:step===2?'flex-start':'center',overflow:'hidden'},
            h(Text,{bold:true,color:palette.red},step===0&&part==='where'?'Where…?':headings[step]),
            h(Box,{marginTop:1,flexDirection:'column'},body)),
        h(Box,{width,flexDirection:'column',height:4,flexShrink:0},
            h(Text,{color:status?palette.red:palette.text,wrap:'truncate'},status||(step===0?'Saved locally in ~/.domexplore.conf':lessons[step])),
            h(Box,{marginTop:1,justifyContent:'space-between'},
                h(Text,null,step||part==='where'?'←  Back':'Ctrl+C  Quit'),
                h(Text,{color:palette.red,bold:true},step===0&&editing?'Enter  Next →':step===0?'Enter  Continue →':step<9?'n  Continue →':'q  Done'))));
}
