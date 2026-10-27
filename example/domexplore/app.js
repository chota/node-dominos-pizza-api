import React,{useState,useRef,useEffect} from 'react';
import {Box,useInput,useApp,useStdout} from 'ink';
import {Customer,Address,NearbyStores,Store,Order} from '../../index.js';
import {contactError,phoneNumber} from './checkout.js';
import {prepareCatalog} from './catalog.js';
import {OrderBuilder} from './builder-ui.js';
import {LocalOrderBuilder} from './order-builder.js';
import {Text,palette} from './style.js';
import {locateAddress} from './location.js';
import {configWithValues} from './config.js';
import {deliveryPreferences,composeInstructions,eligibleStores,handoffs,checks,EXTRA_LIMIT,chars} from './delivery.js';
const h=React.createElement,empty=Object.freeze({});
const contact=['firstName','lastName','phone','email'];
const labels={firstName:'First name',lastName:'Family name',phone:'Phone',email:'Email',street:'Street',city:'City',region:'State / region',postalCode:'Postal code',unitNumber:'Apartment number',additionalInstructions:'Extra'};
export function customerFrom(values){
    return new Customer({firstName:values.firstName||'',lastName:values.lastName||'',phone:phoneNumber(values.phone),email:values.email||'',address:new Address({
        ...Object.fromEntries(['street','city','region','postalCode','unitNumber'].map(key=>[key,values[key]||''])),
        unitType:values.residenceType==='Apartment'?'APT':'',deliveryInstructions:composeInstructions(values)
    })});
}
export function App({initialConfig=empty,onPersist=()=>{},initialNotice='',services={}}){
    const api={NearbyStores,Store,locateAddress,...services};
    const seed={...initialConfig.customer,...initialConfig.address,...deliveryPreferences(initialConfig.address)};
    const [values,setValues]=useState(seed),[page,setPage]=useState('who');
    const [focus,setFocus]=useState('firstName'),[editing,setEditing]=useState(true),[replace,setReplace]=useState(true);
    const [attempted,setAttempted]=useState(false),[locationResolved,setLocationResolved]=useState(false),[method,setMethod]=useState(null),[methodChoice,setMethodChoice]=useState('Carryout');
    const [residenceChoice,setResidenceChoice]=useState(seed.residenceType||'House'),[handoffChoice,setHandoffChoice]=useState(seed.handoff||'hand');
    const [stores,setStores]=useState([]),[storeIndex,setStoreIndex]=useState(-1),[selectedID,setSelectedID]=useState(null),[selectedStore,setSelectedStore]=useState(null);
    const [activeBuilder,setActiveBuilder]=useState(null);
    const ledger=useRef({lastStoreID:initialConfig.lastStoreID||'',payment:initialConfig.payment||{},pendingOrder:initialConfig.pendingOrder||null,lastOrder:initialConfig.lastOrder||null});
    const draftCache=useRef(new Map()),draftSnapshot=useRef(initialConfig.draftOrder||null);
    const [status,setStatus]=useState(initialNotice),[busy,setBusy]=useState(false);
    const latest=useRef(seed),persist=useRef(onPersist),generation=useRef(0),controller=useRef(null),mounted=useRef(true);
    latest.current=values;persist.current=onPersist;
    const {exit}=useApp(),{stdout}=useStdout();
    const [size,setSize]=useState({columns:stdout.columns||80,rows:stdout.rows||30});
    useEffect(()=>{const resize=()=>setSize({columns:stdout.columns||80,rows:stdout.rows||30});stdout.on?.('resize',resize);return()=>stdout.off?.('resize',resize);},[stdout]);
    useEffect(()=>{const timer=setTimeout(()=>{try{persist.current(configWithValues({...initialConfig,...ledger.current,draftOrder:draftSnapshot.current},latest.current));}catch(error){setStatus(`Could not save settings: ${error.message}`);}},150);return()=>clearTimeout(timer);},[values,initialConfig]);
    useEffect(()=>()=>{mounted.current=false;generation.current++;controller.current?.abort();try{persist.current(configWithValues({...initialConfig,...ledger.current,draftOrder:draftSnapshot.current},latest.current));}catch{}},[initialConfig]);
    const put=next=>{latest.current=next;setValues(next);};
    const invalidate=()=>{generation.current++;setBusy(false);setStores([]);setSelectedID(null);setSelectedStore(null);};
    const focusField=key=>{setFocus(key);setEditing(Boolean(labels[key]));setReplace(true);};
    const change=value=>{let text=value.replace(/[\x00-\x1f\x7f]/g,'');if(focus==='additionalInstructions')text=chars(text).slice(0,EXTRA_LIMIT).join('');put({...latest.current,[focus]:text});setReplace(false);setStatus('');if(!contact.includes(focus))invalidate();};
    const addressSequence=()=>['street','city','region','postalCode','residence',...(latest.current.residenceType==='Apartment'?['unitNumber']:[]),'handoff',...checks.map(([key])=>key),'additionalInstructions','continue'];
    const sequence=()=>page==='who'?contact:page==='manual'?['city','region','postalCode','continue']:addressSequence();
    const move=delta=>{const keys=sequence(),index=keys.indexOf(focus);focusField(keys[Math.max(0,Math.min(keys.length-1,index+delta))]);};
    const completeAddress=()=>Boolean(latest.current.street?.trim()&&latest.current.postalCode?.trim());
    const cancel=()=>{generation.current++;controller.current?.abort();controller.current=null;setBusy(false);setStatus('');};
    const back=()=>{
        cancel();
        if(page==='builder'){setPage('profile');return;}
        if(page==='profile'){setPage('stores');setSelectedID(null);setSelectedStore(null);return;}
        if(page==='stores'){setSelectedID(null);setSelectedStore(null);setPage(method==='Delivery'?'address':'method');focusField(method==='Delivery'?'continue':'method');return;}
        if(page==='address'||page==='manual'){invalidate();setPage('method');focusField('method');return;}
        if(page==='location'||page==='after-location'){setPage('method');focusField('method');return;}
        if(page==='method'){setPage('who');focusField('firstName');return;}
    };
    const run=async(task,apply)=>{
        if(busy)return;
        const token=++generation.current;setBusy(true);setStatus('');
        try{const result=await task();if(mounted.current&&token===generation.current)apply(result);}
        catch(error){if(mounted.current&&token===generation.current)setStatus(error.message);}
        finally{if(mounted.current&&token===generation.current)setBusy(false);}
    };
    const useLocation=()=>{
        if(busy)return;
        controller.current=new AbortController();
        const signal=controller.current.signal;
        run(()=>api.locateAddress({signal}),address=>{
            const next={...latest.current};for(const key of ['street','city','region','postalCode'])if(typeof address[key]==='string')next[key]=address[key];
            put(next);setAttempted(true);setLocationResolved(true);setPage('after-location');controller.current=null;
        });
    };
    // Route after the request has settled so carryout discovery can start a new request.
    useEffect(()=>{if(page==='location'&&!busy&&status&&controller.current){controller.current=null;setAttempted(true);setLocationResolved(false);setPage('after-location');}},[page,busy,status]);
    const beginSearch=serviceMethod=>{
        if(serviceMethod==='Carryout'&&!latest.current.postalCode?.trim()&&!latest.current.city?.trim()){
            setPage('manual');focusField('city');return;
        }
        setPage('stores');setStoreIndex(-1);setStores([]);setSelectedID(null);setSelectedStore(null);
        run(()=>new api.NearbyStores(customerFrom(latest.current).address,serviceMethod),result=>{
            if(!Array.isArray(result.stores))throw Error('Store lookup returned no store list.');
            const choices=eligibleStores(result.stores,serviceMethod);setStores(choices);const previous=serviceMethod==='Carryout'?choices.findIndex(store=>String(store.StoreID)===ledger.current.lastStoreID):-1;setStoreIndex(choices.length?Math.max(0,previous):-1);
            if(!choices.length)setStatus(`No nearby stores are currently open for online ${serviceMethod.toLowerCase()}.`);
        });
    };
    const continueAddress=()=>{
        if(!completeAddress()){focusField('street');setStatus('Enter your street and postal code.');return;}
        if(!latest.current.residenceType){focusField('residence');return;}
        if(latest.current.residenceType==='Apartment'&&!latest.current.unitNumber?.trim()){focusField('unitNumber');setStatus('Enter an apartment number.');return;}
        if(!handoffs[latest.current.handoff]){focusField('handoff');return;}
        if(chars(latest.current.additionalInstructions).length>EXTRA_LIMIT){focusField('additionalInstructions');setStatus(`Keep extra instructions within ${EXTRA_LIMIT} characters.`);return;}
        beginSearch('Delivery');
    };
    const routeMethod=serviceMethod=>{
        if(serviceMethod==='Carryout'){
            if(!locationResolved){setPage('manual');focusField('city');}
            else beginSearch('Carryout');
        }else{setPage('address');focusField(completeAddress()?'continue':'street');}
    };
    useEffect(()=>{if(page==='after-location'&&!busy&&method)routeMethod(method);},[page,busy,method,locationResolved]);
    const acceptMethod=()=>{
        setMethod(methodChoice);invalidate();setStatus('');
        if(!attempted){setPage('location');focusField('location');}
        else routeMethod(methodChoice);
    };
    const chooseStore=()=>{
        const store=stores[storeIndex];if(!store||!method)return;
        const id=String(store.StoreID);setSelectedID(id);setSelectedStore(null);
        run(()=>new api.Store(id),result=>{
            if(!result?.info||String(result.info.StoreID)!==id)throw Error('The loaded store does not match the selected store.');
            if(result.info.Status===-1)throw Error('The store profile request failed.');
            setSelectedStore(result);setPage('profile');focusField('continue');
            try{saveLedger({...ledger.current,lastStoreID:id});}catch(error){setStatus(`Could not save store preference: ${error.message}`);}
        });
    };
    const openBuilder=()=>{
        const key=`${selectedID}:${method}`,catalog=prepareCatalog(selectedStore.menu.menu);
        let order=draftCache.current.get(key),notice='';
        if(!order){
            order=new Order(customerFrom(latest.current));order.storeID=selectedID;order.serviceMethod=method;
            const restored=new LocalOrderBuilder(order,catalog).restore(draftSnapshot.current||{});
            if(restored.skipped)notice=`${restored.skipped} saved item(s) no longer match this menu.`;
            draftCache.current.set(key,order);
        }else order.addCustomer(customerFrom(latest.current));
        setActiveBuilder({order,catalog,notice});setPage('builder');
    };
    const draftChanged=snapshot=>{
        draftSnapshot.current=snapshot;
        try{persist.current(configWithValues({...initialConfig,...ledger.current,draftOrder:snapshot},latest.current));}catch(error){setStatus(`Could not save settings: ${error.message}`);}
    };
    const saveLedger=next=>{persist.current(configWithValues({...initialConfig,...next,draftOrder:draftSnapshot.current},latest.current));ledger.current=next;};
    const pendingChanged=pendingOrder=>saveLedger({...ledger.current,pendingOrder});
    const orderPlaced=lastOrder=>{const old=draftSnapshot.current;draftSnapshot.current=null;try{saveLedger({...ledger.current,lastOrder,pendingOrder:null});}catch(error){draftSnapshot.current=old;throw error;}};
    useInput((input,key)=>{
        if(page==='builder')return;
        if(key.leftArrow){back();return;}
        if(busy){if(input==='q')exit();return;}
        if(page==='location'){if(key.return||input===' ')useLocation();else if(input==='q')exit();else if(key.backspace||key.delete)back();return;}
        if(page==='method'){
            if(key.upArrow)setMethodChoice('Carryout');else if(key.downArrow)setMethodChoice('Delivery');
            else if(input==='c')setMethodChoice('Carryout');else if(input==='d')setMethodChoice('Delivery');
            else if(key.return)acceptMethod();else if(input==='q')exit();else if(key.backspace||key.delete)back();return;
        }
        if(page==='address'&&focus==='residence'){
            if(key.rightArrow||input===' ')setResidenceChoice(old=>old==='House'?'Apartment':'House');
            else if(input==='h')setResidenceChoice('House');else if(input==='a')setResidenceChoice('Apartment');
            else if(key.return||(key.tab&&!key.shift)){
                put({...latest.current,residenceType:residenceChoice,unitType:residenceChoice==='Apartment'?'APT':'',unitNumber:residenceChoice==='House'?'':latest.current.unitNumber||''});invalidate();focusField(residenceChoice==='Apartment'?'unitNumber':'handoff');
            }else if(key.upArrow||(key.tab&&key.shift))move(-1);else if(key.downArrow)move(1);return;
        }
        if(page==='address'&&focus==='handoff'){
            if(key.rightArrow||input===' ')setHandoffChoice(old=>old==='hand'?'door':'hand');
            else if(input==='h')setHandoffChoice('hand');else if(input==='l')setHandoffChoice('door');
            else if(key.return||(key.tab&&!key.shift)){put({...latest.current,handoff:handoffChoice});invalidate();move(1);}
            else if(key.upArrow||(key.tab&&key.shift))move(-1);else if(key.downArrow)move(1);return;
        }
        if(page==='address'&&checks.some(([flag])=>flag===focus)){
            if(input===' '){put({...latest.current,[focus]:!latest.current[focus]});invalidate();}
            else if(key.return||key.downArrow||key.tab&&!key.shift)move(1);else if(key.upArrow||key.tab&&key.shift)move(-1);return;
        }
        if(editing&&(page==='who'||page==='address'||page==='manual')){
            if(key.escape){setEditing(false);return;}
            if(key.ctrl&&input==='u'){change('');return;}
            if(key.return||key.tab){
                put({...latest.current,[focus]:(latest.current[focus]||'').trim()});
                if(page==='who'&&focus==='email'&&!key.shift){const error=contactError(latest.current);if(error){setStatus(error.message);focusField(error.field);}else{setPage('method');focusField('method');}}
                else move(key.shift?-1:1);return;
            }
            if(key.upArrow){move(-1);return;}if(key.downArrow){move(1);return;}
            if(key.backspace||key.delete){change(chars(latest.current[focus]).slice(0,-1).join(''));return;}
            if(input&&!key.ctrl&&!key.meta)change((replace?'':latest.current[focus]||'')+input);return;
        }
        if(input==='q'){exit();return;}if(key.backspace||key.delete){back();return;}
        if(page==='who'||page==='address'||page==='manual'){
            if(key.upArrow){move(-1);return;}if(key.downArrow){move(1);return;}
            if(key.return||input==='n'){
                if(page==='address')continueAddress();else if(page==='manual')beginSearch('Carryout');else{setPage('method');focusField('method');}
            }return;
        }
        if(page==='stores'){
            if(key.upArrow)setStoreIndex(old=>Math.max(-1,old-1));if(key.downArrow)setStoreIndex(old=>Math.min(stores.length-1,old+1));
            if(input==='s'||key.return&&storeIndex===-1)beginSearch(method);else if(key.return)chooseStore();return;
        }
        if(page==='profile'){
            if(key.return)openBuilder();return;
        }

    });
    const width=Math.max(16,Math.min(68,size.columns-4)),height=Math.max(8,size.rows),bodyHeight=Math.max(3,height-7);
    const inputRow=keys=>h(Box,{key:keys.join('-'),flexDirection:width<44?'column':'row'},...keys.map(field=>{
        const label=`${labels[field]}${field==='additionalInstructions'?` ${chars(values[field]).length}/${EXTRA_LIMIT}`:''}: `;
        const available=Math.max(3,Math.floor(width/(width<44?1:keys.length))-label.length-4);
        const text=chars(values[field]);
        const displayed=text.length>available?(focus===field&&editing?'…'+text.slice(-available+1).join(''):text.slice(0,available-1).join('')+'…'):text.join('');
        return h(Box,{key:field,width:width<44?'100%':`${100/keys.length}%`},h(Text,{color:focus===field?palette.red:palette.text,wrap:'truncate'},`${focus===field?'›':' '} ${label}${displayed}${focus===field&&editing?'▏':''}`));
    }));
    const optionRow=(id,label,choices,chosen)=>h(Text,{key:id,color:focus===id?palette.red:palette.text,wrap:'wrap'},`${focus===id?'›':' '} ${label}${choices.map(([value,name])=>`${chosen===value?'[':''}${name}${chosen===value?']':''}`).join('  /  ')}`);
    let heading='Who…?',body=null;
    if(page==='who')body=h(Box,{flexDirection:'column'},inputRow(['firstName','lastName']),inputRow(['phone']),inputRow(['email']));
    else if(page==='location'){heading='Where…?';body=h(Text,{color:palette.red,bold:true},busy?'…':'› 📍 Use my location →  Enter');}
    else if(page==='method'){heading='Carryout or delivery?';body=h(Box,{flexDirection:'column'},...['Carryout','Delivery'].map(choice=>h(Text,{key:choice,color:methodChoice===choice?palette.red:palette.text,bold:methodChoice===choice},`${methodChoice===choice?'›':' '} ${choice==='Carryout'?'🥡':'🛵'} ${choice}`))); }
    else if(page==='manual'){heading='Near…?';body=h(Box,{flexDirection:'column'},inputRow(['city','region']),inputRow(['postalCode']));}
    else if(page==='address'){
        heading='Where…?';
        const rows=[{id:'street',keys:['street']},{id:'city',keys:['city','region']},{id:'postalCode',keys:['postalCode']},{id:'space'},
            {id:'residence'},...(values.residenceType==='Apartment'?[{id:'unitNumber',keys:['unitNumber']}]:[]),{id:'handoff'},{id:'checks'},{id:'additionalInstructions',keys:['additionalInstructions']}];
        const index=focus==='continue'?rows.length-1:rows.findIndex(row=>row.id===focus||row.keys?.includes(focus)||row.id==='checks'&&checks.some(([key])=>key===focus));
        const cost=row=>row.id==='checks'?(width<64?3:1):width<44&&row.keys?row.keys.length:1;
        const capacity=Math.max(3,bodyHeight-2);let start=0;
        while(start<index&&rows.slice(start,index+1).reduce((sum,row)=>sum+cost(row),0)>capacity)start++;
        let used=0;const visible=[];for(const row of rows.slice(start)){if(used+cost(row)>capacity)break;visible.push(row);used+=cost(row);}
        body=h(Box,{flexDirection:'column'},...visible.map(row=>{
            if(row.keys)return inputRow(row.keys);
            if(row.id==='space')return h(Text,{key:'space'},' ');
            if(row.id==='residence')return optionRow('residence','Home: ',[['House','House'],['Apartment','Apartment']],focus==='residence'?residenceChoice:values.residenceType);
            if(row.id==='handoff')return optionRow('handoff','* ',Object.entries(handoffs),focus==='handoff'?handoffChoice:values.handoff);
            return h(Box,{key:'checks',flexDirection:width<64?'column':'row',gap:1},...checks.map(([flag,label])=>h(Text,{key:flag,color:focus===flag?palette.red:palette.text},`${focus===flag?'›':' '}[${values[flag]?'x':' '}] ${label}`)));
        }));
    }else if(page==='stores'){
        heading=`${method} stores`;
        const capacity=Math.max(1,bodyHeight-3),start=Math.floor(Math.max(0,storeIndex)/capacity)*capacity;
        body=h(Box,{flexDirection:'column'},
            ...stores.slice(start,start+capacity).map((store,i)=>h(Text,{key:store.StoreID,color:start+i===storeIndex?palette.red:palette.text,wrap:'truncate'},`${start+i===storeIndex?'›':' '} 🏪 ${store.StoreID} · ${(store.AddressDescription||'').replace(/\n/g,', ')}`)),
            h(Box,{marginTop:1},h(Text,{color:storeIndex===-1?palette.red:palette.text},`${storeIndex===-1?'›':' '} Find ${method?.toLowerCase()} stores → Enter`)));
    }else if(page==='profile'){
        heading='Your store';const info=selectedStore?.info||{};
        body=h(Box,{flexDirection:'column'},
            h(Text,{bold:true},`🏪 ${info.StoreName||`Domino’s ${selectedID}`} · ${method}`),
            h(Text,null,info.AddressDescription||[info.StreetName,info.City,info.Region,info.PostalCode].filter(Boolean).join(', ')),
            info.Phone?h(Text,null,info.Phone):null,
            h(Text,null,`${info.IsOpen===true?'Open':info.IsOpen===false?'Closed':'Hours'} · ${info.ServiceHoursDescription?.[method]||info.HoursDescription||''}`),
            info.EstimatedWaitMinutes?h(Text,null,`Estimated wait: ${info.EstimatedWaitMinutes}`):null);
    }else if(page==='builder'&&activeBuilder){
        heading=null;body=h(OrderBuilder,{...activeBuilder,savedPayment:ledger.current.payment,onSavePayment:payment=>saveLedger({...ledger.current,payment}),storeInfo:selectedStore.info,pendingOrder:ledger.current.pendingOrder,onPending:pendingChanged,onPlaced:orderPlaced,height:bodyHeight,onBack:()=>setPage('profile'),onChange:draftChanged,initialNotice:activeBuilder.notice});
    }
    const primary=busy||page==='builder'?'':page==='location'?'':editing||['residence','handoff',...checks.map(([key])=>key)].includes(focus)?'Enter  Next →':page==='profile'?'› Continue →  Enter':page==='address'||page==='manual'?`${focus==='continue'?'› ':''}Continue →  Enter`:page==='method'?'Enter  Choose':page==='stores'?'Enter  Select':'Enter  Continue →';
    return h(Box,{flexDirection:'column',height,width:size.columns,backgroundColor:palette.background,alignItems:'center'},
        h(Box,{width,height:2,flexShrink:0,flexDirection:'column'},h(Text,{bold:true},'🍕 domexplore'),h(Text,null,method||'Order your way')),
        h(Box,{width,height:bodyHeight,justifyContent:page==='builder'?'flex-start':'center',flexDirection:'column',overflow:'hidden'},heading?h(Text,{bold:true,color:palette.red},heading):null,h(Box,{marginTop:heading?1:0,flexDirection:'column'},body)),
        h(Box,{width,height:5,flexShrink:0,flexDirection:'column'},h(Text,{color:status?palette.red:palette.text,wrap:'truncate'},status||''),
            h(Box,{marginTop:1,justifyContent:'space-between'},h(Text,null,page==='who'?'Ctrl+C  Quit':'←  Back'),h(Text,{color:palette.red,bold:true},primary))));
}
