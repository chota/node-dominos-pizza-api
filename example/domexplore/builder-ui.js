import React,{useState,useRef} from 'react';
import {Box,useInput,useApp} from 'ink';
import {Text,palette,foodEmoji} from './style.js';
import {initialSelection,reconcileSelection,usedSlots,validateSelection,amountLabel} from './catalog.js';
import {LocalOrderBuilder} from './order-builder.js';
import {Checkout} from './checkout.js';
import {CheckoutPanel} from './checkout-ui.js';
const h=React.createElement;
export function OrderBuilder({order,catalog,height=16,onBack,onStage,onChange,initialNotice='',storeInfo={},pendingOrder=null,onPending,onPlaced}){
    const model=useRef(null);if(!model.current||model.current.order!==order||model.current.catalog!==catalog)model.current=new LocalOrderBuilder(order,catalog);
    const builder=model.current;
    const checkoutRef=useRef(null);if(!checkoutRef.current||checkoutRef.current.builder!==builder)checkoutRef.current=new Checkout(builder,{storeInfo,pendingOrder,onPending,onPlaced});
    const checkout=checkoutRef.current;const [working,setWorking]=useState(false),[trackingOnly,setTrackingOnly]=useState(false);const alive=useRef(true);
    React.useEffect(()=>()=>{alive.current=false;},[]);
    const [view,setView]=useState(order.products.length||checkout.pendingOrder||checkout.placed?'review':'catalog'),[cursor,setCursor]=useState(0),[expanded,setExpanded]=useState(()=>new Set(order.products.length?[]:catalog.sections.filter(s=>['Pizza','Pizzas','BuildYourOwnDomino'].includes(s.id)).map(s=>s.id)));
    const [familyMode,setFamilyMode]=useState(false),[selection,setSelection]=useState(null),[editIndex,setEditIndex]=useState(null),[status,setStatus]=useState(initialNotice),[popup,setPopup]=useState(null),[quantity,setQuantity]=useState('1');
    const [,redraw]=useState(0);const {exit}=useApp();
    const transition=(next,index=0)=>{setView(next);setCursor(index);setStatus('');onStage?.(next==='review'?'order':'items');};
    const variant=selection?catalog.byVariant.get(selection.code):null;
    const group=variant?catalog.groups.find(group=>group.id===variant.productCode):null;
    const specialty=catalog.sections.flatMap(section=>section.groups).find(group=>group.id==='specialty');
    let rows=[];
    if(view==='catalog'){
        for(const section of catalog.sections){rows.push({id:section.id,kind:'section',label:`${expanded.has(section.id)?'▾':'▸'} ${foodEmoji(section.id,{Name:section.name})} ${section.name}`});if(expanded.has(section.id))for(const group of section.groups)rows.push({id:group.id,kind:'product',label:`  ${group.name}`,group});}
        rows.push({id:'done',label:'Done',kind:'done'});
    }else if(view==='configure'&&variant){
        if(familyMode&&specialty)rows.push({id:'family',label:group.name,kind:'family'});
        const sizes=[...new Set(group.variants.map(v=>v.size))];
        const crusts=[...new Set(group.variants.filter(v=>v.size===variant.size).map(v=>v.crust))];
        if(sizes.length>1)rows.push({id:'size',label:variant.size,kind:'size'});
        if(crusts.length>1&&crusts.some(Boolean))rows.push({id:'crust',label:variant.crust,kind:'crust'});
        rows.push({id:'quantity',label:`Quantity: ${selection.qty}`,kind:'quantity'});
        for(const choice of variant.rules.choices){
            if(Number(variant.rules.defaults[choice.code]||0)>0||Number(selection.amounts[choice.code]||0)>0)rows.push({id:choice.code,kind:'amount',choice,label:`${choice.name}: ${amountLabel(selection.amounts[choice.code]??choice.initial)}`});
        }
        if(variant.rules.choices.some(c=>!c.fixed&&!rows.some(row=>row.id===c.code)))rows.push({id:'topping',label:'+ Topping / side',kind:'topping'});
        rows.push({id:'add',label:editIndex===null?'Add item →':'Save item →',kind:'add'});
    }else if(view==='review'){
        rows=order.products.map((item,index)=>({id:String(item.iD),kind:'item',index,label:`${item.qty} × ${catalog.byVariant.get(item.code)?.name||item.code}`}));
        if(!checkout.pendingOrder&&!checkout.placed)rows.push({id:'add',kind:'new',label:'+ Add Item'},{id:'continue',kind:'continue',label:'Checkout →'});
    }
    if(view==='review'&&(checkout.pendingOrder||checkout.placed))rows.push({id:'tracking',kind:'tracking',label:'Check order status'});
    const activeRows=popup?.choices||rows;
    const index=Math.min(cursor,Math.max(0,activeRows.length-1));
    const open=(title,choices,action)=>{setPopup({title,choices,action,returnCursor:index});setCursor(0);setStatus('');};
    const closePopup=()=>{const old=popup;setPopup(null);setCursor(old?.returnCursor||0);};
    const chooseProduct=group=>{setFamilyMode(Boolean(group.families));setSelection(initialSelection(group.preferred));setEditIndex(null);transition('configure');};
    const selectVariant=code=>{const result=reconcileSelection(catalog,selection,code);setSelection(result.selection);if(result.changed)setStatus('Options unavailable for this size or crust were adjusted.');};
    const changed=()=>{redraw(old=>old+1);onChange?.(builder.snapshot());};
    const saveItem=()=>{
        try{builder.commit(selection,editIndex);changed();setSelection(null);setEditIndex(null);transition('review');}
        catch(error){setStatus(error.message);}
    };
    const returnToReview=()=>transition('review');
    const back=()=>{
        if(popup){closePopup();return;}
        if(view==='quantity'){transition('configure');return;}
        if(view==='configure'){transition(editIndex===null?'catalog':'review');return;}
        if(view==='catalog'){if(order.products.length)returnToReview();else onBack?.();return;}
        onBack?.();
    };
    useInput((input,key)=>{
        if(view==='checkout')return;
        if(working){if(input==='q')exit();return;}
        if(input==='q'){exit();return;}
        if(key.leftArrow||key.escape){back();return;}
        if(view==='quantity'){
            if(key.return){const qty=Number(quantity);if(!/^\d+$/.test(quantity)||!Number.isInteger(qty)||qty<1||qty>99){setStatus('Choose a whole quantity from 1 to 99.');return;}setSelection(old=>({...old,qty}));transition('configure');return;}
            if(key.backspace||key.delete)setQuantity(old=>old.slice(0,-1));else if(/^\d+$/.test(input))setQuantity(old=>(old+input).slice(0,3));return;
        }
        if(key.upArrow){setCursor(Math.max(0,index-1));return;}
        if(key.downArrow){setCursor(Math.min(activeRows.length-1,index+1));return;}
        if(popup){if(key.return){const row=activeRows[index];if(row){popup.action(row.value);closePopup();}}return;}
        if(key.backspace||key.delete){back();return;}
        if(view==='configure'&&input==='+'){setCursor(rows.length-1);saveItem();return;}
        if(view==='review'&&!checkout.pendingOrder&&!checkout.placed&&input==='a'){setExpanded(new Set(order.products.length?[]:catalog.sections.filter(s=>['Pizza','Pizzas','BuildYourOwnDomino'].includes(s.id)).map(s=>s.id)));transition('catalog');return;}
        if(view==='review'&&!checkout.pendingOrder&&!checkout.placed&&input==='d'&&rows[index]?.kind==='item'){builder.remove(rows[index].index);changed();setCursor(Math.max(0,index-1));return;}
        if(!key.return&&!(key.rightArrow&&rows[index]?.kind==='section'))return;
        const row=rows[index];if(!row)return;
        if(row.kind==='section'){setExpanded(old=>{const next=new Set(old);if(next.has(row.id))next.delete(row.id);else next.add(row.id);return next;});}
        if(row.kind==='product')chooseProduct(row.group);
        if(row.kind==='done')returnToReview();
        if(row.kind==='family')open('Specialty pizza',specialty.families.map(family=>({label:family.name,value:family.id})),id=>{const family=specialty.families.find(f=>f.id===id);const preferred=family.variants.find(v=>v.size===variant.size&&v.crust===variant.crust)||family.preferred;setSelection({...initialSelection(preferred),qty:selection.qty});});
        if(row.kind==='size')open('Size', [...new Set(group.variants.map(v=>v.size))].map(size=>({label:size,value:size})),size=>{const options=group.variants.filter(v=>v.size===size);selectVariant((options.find(v=>v.crust===variant.crust)||options[0]).code);});
        if(row.kind==='crust')open('Crust',[...new Set(group.variants.filter(v=>v.size===variant.size).map(v=>v.crust))].map(crust=>({label:crust,value:crust})),crust=>selectVariant(group.variants.find(v=>v.size===variant.size&&v.crust===crust).code));
        if(row.kind==='quantity'){setQuantity('');transition('quantity');}
        if(row.kind==='amount'){
            if(row.choice.fixed){setStatus('This option is fixed by the menu.');return;}
            open(row.choice.name,row.choice.amounts.map(amount=>({label:amountLabel(amount),value:amount})),amount=>setSelection(old=>({...old,amounts:{...old.amounts,[row.id]:amount}})));
        }
        if(row.kind==='topping')open('Topping / side',variant.rules.choices.filter(choice=>!choice.fixed&&!rows.some(row=>row.id===choice.code)).map(choice=>({label:choice.name,value:choice.code})),code=>{
            const choice=variant.rules.choices.find(choice=>choice.code===code);const amount=choice.amounts.includes('1')?'1':choice.amounts.find(amount=>Number(amount)>0);
            if(amount)setSelection(old=>({...old,amounts:{...old.amounts,[code]:amount}}));
        });
        if(row.kind==='add')saveItem();
        if(row.kind==='new'){setExpanded(new Set(order.products.length?[]:catalog.sections.filter(s=>['Pizza','Pizzas','BuildYourOwnDomino'].includes(s.id)).map(s=>s.id)));transition('catalog');}
        if(row.kind==='item'&&!checkout.pendingOrder&&!checkout.placed){try{setFamilyMode(Boolean(specialty?.variants.some(v=>v.code===order.products[row.index].code)));setSelection(builder.selection(row.index));setEditIndex(row.index);transition('configure');}catch(error){setStatus(error.message);}}
        if(row.kind==='tracking'){setTrackingOnly(true);transition('checkout');}
        if(row.kind==='continue'){if(!order.products.length){setStatus('Add an item first.');return;}setWorking(true);setStatus('Calculating total…');void checkout.quote().then(()=>{if(alive.current){setTrackingOnly(false);transition('checkout');}}).catch(error=>{if(alive.current)setStatus(error.message);}).finally(()=>{if(alive.current)setWorking(false);});}
    });
    const capacity=Math.max(1,height-5),start=Math.floor(index/capacity)*capacity;
    let body,title;
    if(view==='checkout')return h(CheckoutPanel,{checkout,height,onBack:()=>{checkout.order.payments=[];transition('review');},trackingOnly});
    if(view==='quantity'){title='Quantity';body=h(Text,null,`${quantity}▏`);}
    else{
        title=popup?.title||(view==='catalog'?'Add Item':view==='configure'?`${foodEmoji(variant.productCode,{Name:variant.name,ProductType:variant.product.productType})} ${group.name}`:'Order');
        body=h(Box,{flexDirection:'column'},
            view==='configure'&&!popup?h(Text,null,`${variant.size} ${variant.crust}${variant.price!==''&&variant.price!=null&&Number.isFinite(Number(variant.price))?` · Menu $${Number(variant.price).toFixed(2)}`:''}`.trim()):null,
            view==='configure'&&variant.rules.pizza&&variant.rules.limit!==null&&!popup?h(Text,null,`Toppings ${usedSlots(variant,selection.amounts)}/${variant.rules.limit}`):null,
            view==='review'?h(Text,null,`${order.products.length} item${order.products.length===1?'':'s'}`):null,
            ...activeRows.slice(start,start+capacity).map((row,i)=>h(Text,{key:row.id||String(i),color:start+i===index?palette.red:palette.text,wrap:'truncate'},`${start+i===index?'›':' '} ${row.label}`)));
    }
    return h(Box,{height,flexDirection:'column',overflow:'hidden'},h(Text,{bold:true},title),
        h(Box,{flexDirection:'column',flexGrow:1,overflow:'hidden'},body),
        h(Text,{color:status?palette.red:palette.text,wrap:'truncate'},status||''),
        h(Text,{wrap:'truncate'},view==='review'?(checkout.pendingOrder||checkout.placed?'Enter status · ← back':'Enter edit · a Add Item · d remove · ← back'):view==='configure'?'Enter choose · + add/save · ← cancel':'↑↓ select · Enter choose · ← back'));
}
