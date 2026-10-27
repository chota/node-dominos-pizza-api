import {Payment} from '../../index.js';
import DominosFormat from '../../modules/DominosFormat.js';
import {randomUUID} from 'node:crypto';
const placedOrders=new WeakSet();
const clean=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,160);
const successful=response=>Number.isFinite(response?.Status)&&response.Status>=0&&Number.isFinite(response?.Order?.Status)&&response.Order.Status>=0;
export function responseMessage(response,stage){
    const items=[...(Array.isArray(response?.StatusItems)?response.StatusItems:[]),...(Array.isArray(response?.Order?.StatusItems)?response.Order.StatusItems:[])];
    const codes=items.map(item=>clean(item.Code)).filter(code=>/^[A-Za-z0-9_.:-]+$/.test(code));
    if(codes.some(code=>/recaptcha|verification/i.test(code)))return 'Domino’s requires verification this app cannot complete.';
    return codes.length?`Domino’s could not ${stage}: ${[...new Set(codes)].join(', ')}.`:`Unable to ${stage}. Check your connection and try again.`;
}
export function phoneNumber(value){const digits=String(value||'').replace(/\D/g,'');return digits.length===11&&digits[0]==='1'?digits.slice(1):digits;}
export function contactError(customer){
    if(!customer.firstName?.trim())return {field:'firstName',message:'Enter your first name.'};
    if(!customer.lastName?.trim())return {field:'lastName',message:'Enter your family name.'};
    if(!/^[2-9]\d{2}[2-9]\d{6}$/.test(phoneNumber(customer.phone)))return {field:'phone',message:'Enter a valid ten-digit phone number.'};
    if(!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(customer.email||''))return {field:'email',message:'Enter a valid email address.'};
    return null;
}
export function cardValid(number){
    const digits=String(number).replace(/[ -]/g,'');if(!/^\d{13,19}$/.test(digits))return false;
    let sum=0,double=false;for(const ch of [...digits].reverse()){let n=Number(ch);if(double){n*=2;if(n>9)n-=9;}sum+=n;double=!double;}return sum%10===0;
}
export class Checkout {
    busy=false;total=null;pricedRevision=null;pricedAt=null;placed=false;verificationBlocked=false;
    constructor(builder,{storeInfo={},pendingOrder=null,onPending=()=>{},onPlaced=()=>{},now=()=>Date.now()}={}){this.builder=builder;this.order=builder.order;this.placed=placedOrders.has(this.order);this.storeInfo=storeInfo;this.pendingOrder=pendingOrder;this.onPending=onPending;this.onPlaced=onPlaced;this.now=now;}
    fresh(){return this.total!==null&&this.pricedRevision===this.builder.revision&&this.now()-this.pricedAt<5*60*1000;}
    async quote(){
        if(this.busy)throw Error('Please wait for the current request.');if(this.pendingOrder)throw Error('An order confirmation is pending. Check its status before ordering again.');if(this.placed)throw Error('This order has already been placed.');
        if(!this.order.products.length)throw Error('Add an item first.');
        const error=contactError(this.order);if(error)throw Error(error.message);
        if(!this.order.address.region?.trim())throw Error('Add a state or region to your address before checkout.');
        this.busy=true;this.total=null;this.order.payments=[];
        try{
            const revision=this.builder.revision;
            try{await this.order.validate();}catch{throw Error(responseMessage(this.order.validationResponse,'validate the order'));}
            if(!successful(this.order.validationResponse))throw Error(responseMessage(this.order.validationResponse,'validate the order'));
            this.builder.validatedRevision=revision;
            try{await this.order.price();}catch{throw Error(responseMessage(this.order.priceResponse,'price the order'));}
            if(!successful(this.order.priceResponse))throw Error(responseMessage(this.order.priceResponse,'price the order'));
            const response=this.order.priceResponse.Order;
            if((response.Products||[]).some(item=>Number(item.Status)<0))throw Error('An item is unavailable. Edit your order and try again.');
            const value=response.AmountsBreakdown?.Customer??response.Amounts?.Customer??this.order.amountsBreakdown?.customer;
            if(value===''||value==null||!Number.isFinite(Number(value))||Number(value)<0)throw Error('Domino’s did not return a valid total.');
            if(this.builder.revision!==revision)throw Error('The order changed. Review it and continue again.');
            this.total=Number(value);this.pricedRevision=revision;this.pricedAt=this.now();this.builder.pricedRevision=revision;return this.total;
        }finally{this.busy=false;}
    }
    paymentMethods(){
        const accepted=this.storeInfo.AcceptablePaymentTypes||[];
        return [{type:'Cash',label:this.order.serviceMethod==='Carryout'?'Pay at store':'Cash on delivery'}, {type:'CreditCard',label:'Credit card'}].filter(method=>accepted.includes(method.type));
    }
    setPayment(type,fields={}){
        if(!this.fresh())throw Error('Your price needs refreshing. Return to the order and continue again.');
        if(!this.paymentMethods().some(method=>method.type===type))throw Error('This payment method is not available at the selected store.');
        let payment;
        if(type==='Cash'){
            const limit=Number(this.storeInfo.CashLimit);if(limit>0&&this.total>limit)throw Error('This order exceeds the store’s cash limit. Choose another payment method.');
            payment=new DominosFormat();payment.init={type:'Cash',amount:this.total};
        }else{
            const number=String(fields.number||'').replace(/[ -]/g,''),expiration=String(fields.expiration||'').replace(/\D/g,''),securityCode=String(fields.securityCode||'');
            if(!cardValid(number))throw Error('Enter a valid card number.');
            if(!/^\d{4}$/.test(expiration)||Number(expiration.slice(0,2))<1||Number(expiration.slice(0,2))>12)throw Error('Enter the expiry as MM/YY.');
            const month=Number(expiration.slice(0,2)),year=2000+Number(expiration.slice(2));
            if(new Date(year,month,1).getTime()<=this.now())throw Error('This card has expired.');
            if(!/^\d{3,4}$/.test(securityCode))throw Error('Enter the card’s security code.');
            if(!/^[A-Za-z0-9 -]{3,10}$/.test(fields.postalCode||''))throw Error('Enter the billing postal code.');
            payment=new Payment({number,expiration,securityCode,postalCode:fields.postalCode,amount:this.total});
            if(!payment.cardType)throw Error('This card type is not supported by the ordering package.');
            if((payment.cardType==='AMEX'?4:3)!==securityCode.length)throw Error('Check the security code length.');
            const accepted=this.storeInfo.AcceptableCreditCards;
            const names={VISA:'Visa',MASTERCARD:'Mastercard',AMEX:'American Express',DISCOVER:'Discover Card'};
            if(!names[payment.cardType]||Array.isArray(accepted)&&!accepted.includes(names[payment.cardType]))throw Error('The store does not accept this card type.');
        }
        this.order.payments=[payment];return payment;
    }
    async place(confirmation){
        if(confirmation!=='PLACE')throw Error('Type PLACE to confirm the order.');
        if(this.busy||this.placed||this.pendingOrder)throw Error('An order is already submitted or awaiting confirmation. Check its status before ordering again.');
        if(this.verificationBlocked)throw Error('Domino’s requires verification this app cannot complete.');
        if(!this.fresh())throw Error('Your price needs refreshing. Return to the order and continue again.');
        if(this.order.payments.length!==1)throw Error('Choose a payment method first.');
        const marker={id:randomUUID(),storeID:String(this.order.storeID),serviceMethod:this.order.serviceMethod,createdAt:new Date(this.now()).toISOString(),orderID:this.order.orderID||''};
        // Persistence must succeed before submitting. Payment data is never included.
        this.onPending(marker);this.pendingOrder=marker;this.busy=true;
        try{
            this.order.placeResponse={};let failed=false;
            try{await this.order.place();}catch{failed=true;}
            const response=this.order.placeResponse;
            if(successful(response)&&response.Order.OrderID){
                this.placed=true;placedOrders.add(this.order);this.order.orderID=String(response.Order.OrderID);
                const receipt={...this.builder.snapshot(),OrderID:response.Order.OrderID,total:this.total,recordedAt:new Date(this.now()).toISOString()};
                try{this.onPlaced(receipt);this.pendingOrder=null;}
                catch{throw Error('Order accepted, but saving confirmation failed. Do not submit it again.');}
                return receipt;
            }
            if(response?.Status<0||response?.Order?.Status<0){
                const message=responseMessage(response,'place the order');
                this.verificationBlocked=/verification/.test(message);
                this.onPending(null);this.pendingOrder=null;this.order.payments=[];
                throw Error(message);
            }
            throw Error(failed?'Order confirmation was interrupted. Check with the store before ordering again.':'The order result is unclear. Check with the store before ordering again.');
        }finally{this.busy=false;this.order.payments=[];}
    }
}
