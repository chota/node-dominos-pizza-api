import React,{useState,useRef,useEffect} from 'react';
import {Box,useInput,useApp} from 'ink';
import {Text,palette} from './style.js';
import {trackOrders} from './tracking.js';
const h=React.createElement,money=amount=>`$${Number(amount).toFixed(2)}`;
export function CheckoutPanel({checkout,height=16,onBack,trackingOnly=false,tracking=trackOrders,savedPayment={},onSavePayment=()=>{}}){
    const [view,setView]=useState(trackingOnly?'tracking':'payment'),[cursor,setCursor]=useState(0),[fields,setFields]=useState({number:savedPayment.number||'',expiration:savedPayment.expiration||'',securityCode:'',postalCode:savedPayment.postalCode||''}),[confirmation,setConfirmation]=useState('');
    const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState(null),[orders,setOrders]=useState([]);
    const cachedPayment=useRef(savedPayment);
    const mounted=useRef(true);useEffect(()=>()=>{mounted.current=false;},[]);const {exit}=useApp();
    const keys=['number','expiration','securityCode','postalCode'],labels={number:'Card number',expiration:'Expiry (MM/YY)',securityCode:'Security code',postalCode:'Billing postal code'};
    const methods=checkout.paymentMethods();
    const back=()=>{
        if(busy)return;
        checkout.order.payments=[];setFields({number:'',expiration:'',securityCode:'',postalCode:''});
        if(view==='card'||view==='confirm'){setView('payment');setCursor(0);setStatus('');setConfirmation('');}else onBack();
    };
    const place=async()=>{
        setBusy(true);setStatus('Placing your order…');
        try{const result=await checkout.place(confirmation);if(mounted.current){setReceipt(result);setView('placed');setStatus('');}}
        catch(error){if(mounted.current){setStatus(error.message);setView(checkout.pendingOrder||checkout.placed?'tracking':'payment');setConfirmation('');}}
        finally{if(mounted.current){setBusy(false);setFields({number:'',expiration:'',securityCode:'',postalCode:''});}}
    };
    const refresh=async()=>{
        setBusy(true);setStatus('Checking your order…');
        try{const list=await tracking(checkout.order.phone);const id=receipt?.OrderID||checkout.pendingOrder?.orderID||checkout.order.orderID;const matching=id?list.filter(order=>order.id===id):[];if(mounted.current){setOrders(matching);setStatus(matching.length?'':'Tracking is not available yet.');}}
        catch{if(mounted.current)setStatus('Tracking is unavailable. Please check with the store.');}
        finally{if(mounted.current)setBusy(false);}
    };
    useInput((input,key)=>{
        if(busy){if(input==='q')exit();return;}
        if(key.escape||key.leftArrow){back();return;}
        if(view==='card'){
            if(key.return||key.tab){
                if(key.shift){setCursor(Math.max(0,cursor-1));return;}
                if(cursor<3){setCursor(cursor+1);return;}
                try{const payment=checkout.setPayment('CreditCard',fields);const reusable={number:payment.number,expiration:payment.expiration,postalCode:payment.postalCode};onSavePayment(reusable);cachedPayment.current=reusable;setView('confirm');setStatus('');}catch(error){setStatus(error.message);}return;
            }
            if(key.upArrow){setCursor(Math.max(0,cursor-1));return;}if(key.downArrow){setCursor(Math.min(3,cursor+1));return;}
            const name=keys[cursor];
            if(key.backspace||key.delete)setFields(old=>({...old,[name]:old[name].slice(0,-1)}));
            else if(key.ctrl&&input==='u')setFields(old=>({...old,[name]:''}));
            else if(input&&!key.ctrl&&!key.meta){const text=input.replace(name==='postalCode'?/[^A-Za-z0-9 -]/g:/[^0-9 /-]/g,'');const limit={number:23,expiration:5,securityCode:4,postalCode:10}[name];setFields(old=>({...old,[name]:(old[name]+text).slice(0,limit)}));}
            return;
        }
        if(view==='confirm'){
            if(key.return){void place();return;}if(key.backspace||key.delete)setConfirmation(old=>old.slice(0,-1));else if(input&&!key.ctrl&&!key.meta)setConfirmation(old=>(old+input.replace(/[^A-Za-z]/g,'')).slice(0,5));return;
        }
        if(input==='q'){exit();return;}if(key.backspace||key.delete){back();return;}
        if(view==='payment'){
            if(key.upArrow)setCursor(Math.max(0,cursor-1));if(key.downArrow)setCursor(Math.min(methods.length-1,cursor+1));
            if(key.return&&methods[cursor]){
                if(methods[cursor].type==='CreditCard'){const saved=cachedPayment.current;setFields({number:saved.number||'',expiration:saved.expiration||'',securityCode:'',postalCode:saved.postalCode||''});setView('card');setCursor(saved.number&&saved.expiration?2:0);}
                else try{checkout.setPayment('Cash');setView('confirm');setStatus('');}catch(error){setStatus(error.message);}
            }
        }else if((view==='placed'||view==='tracking')&&(key.return||input==='r')){setView('tracking');void refresh();}
    });
    const payment=checkout.order.payments[0];
    let title='Payment',body;
    if(view==='payment')body=h(Box,{flexDirection:'column'},h(Text,{bold:true},`Total ${money(checkout.total)}`),...methods.map((method,i)=>h(Text,{key:method.type,color:i===cursor?palette.red:palette.text},`${i===cursor?'›':' '} ${method.label}`)),!methods.length?h(Text,null,'No supported payment methods are available at this store.'):null);
    else if(view==='card')body=h(Box,{flexDirection:'column'},h(Text,{bold:true},`Total ${money(checkout.total)}`),...keys.map((name,i)=>{
        const value=name==='securityCode'?'•'.repeat(fields[name].length):name==='number'?'•'.repeat(Math.max(0,fields[name].length-4))+fields[name].slice(-4):fields[name];
        return h(Text,{key:name,color:i===cursor?palette.red:palette.text,wrap:'truncate'},`${i===cursor?'›':' '} ${labels[name]}: ${value}${i===cursor?'▏':''}`);
    }));
    else if(view==='confirm'){
        title='Confirm order';body=h(Box,{flexDirection:'column'},h(Text,null,`${checkout.order.serviceMethod} · Store ${checkout.order.storeID}`),h(Text,{bold:true},`Total ${money(checkout.total)}`),h(Text,null,payment?.type==='CreditCard'?`Card ending ${payment.number.slice(-4)}`:'Pay at store / on delivery'),h(Box,{marginTop:1},h(Text,{color:palette.red},`Type PLACE to order: ${confirmation}▏`)));
    }else{
        title=checkout.placed||receipt?'Order placed':'Order confirmation';body=h(Box,{flexDirection:'column'},receipt?h(Text,null,`Order ${receipt.OrderID}`):null,
            ...orders.map((order,i)=>h(Text,{key:String(i)},order.status)),
            checkout.pendingOrder&&!checkout.placed?h(Text,null,'Confirmation is pending. Check with the store before ordering again.'):null,
            h(Text,null,`Store ${checkout.pendingOrder?.storeID||checkout.order.storeID}`),
            (!checkout.pendingOrder||checkout.pendingOrder.storeID===String(checkout.order.storeID))&&checkout.storeInfo.Phone?h(Text,null,`Phone: ${checkout.storeInfo.Phone}`):null,
            h(Box,{marginTop:1},h(Text,{color:palette.red},'Enter  Refresh tracking')));
    }
    return h(Box,{height,flexDirection:'column'},h(Text,{bold:true},title),h(Box,{flexDirection:'column',flexGrow:1,overflow:'hidden'},body),h(Text,{color:status?palette.red:palette.text,wrap:'wrap'},status||''),h(Text,null,view==='card'?'Enter next · ← cancel':view==='confirm'?'← Cancel':'← Back · q Quit'));
}
