// This is a local UI bound, not a claim about Domino's server-side limit.
export const EXTRA_LIMIT=120;
export const handoffs={hand:'Hand it to me',door:'Leave at door'};
export const checks=[['dontKnock',"Don't Knock"],['dontRingDoorbell',"Don't Ring Doorbell"],['callUponArrival','Call upon arrival']];
export const chars=value=>Array.from(value||'');
export function deliveryPreferences(value={}){
    return {
        handoff:Object.hasOwn(handoffs,value.handoff)?value.handoff:'',
        ...Object.fromEntries(checks.map(([key])=>[key,value[key]===true])),
        // Preserve older free-form text, even if it exceeds the new input bound.
        additionalInstructions:typeof value.additionalInstructions==='string'?value.additionalInstructions:typeof value.deliveryInstructions==='string'?value.deliveryInstructions:''
    };
}
export function composeInstructions(value){
    const prefs=deliveryPreferences(value);
    return [handoffs[prefs.handoff],...checks.filter(([key])=>prefs[key]).map(([,label])=>label),prefs.additionalInstructions.trim()].filter(Boolean).join('; ');
}
export function eligibleStores(stores,serviceMethod){
    if(!['Carryout','Delivery'].includes(serviceMethod))return [];
    return stores.filter(s=>s.IsOnlineCapable&&s.IsOnlineNow!==false&&s.IsOpen&&s.ServiceIsOpen?.[serviceMethod]&&
        (serviceMethod==='Delivery'?s.IsDeliveryStore&&s.AllowDeliveryOrders!==false:s.AllowCarryoutOrders!==false))
        .sort((a,b)=>(Number.isFinite(Number(a.MinDistance))?Number(a.MinDistance):Infinity)-(Number.isFinite(Number(b.MinDistance))?Number(b.MinDistance):Infinity));
}
