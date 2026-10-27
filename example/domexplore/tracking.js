import {apiFetch} from '../../utils/api-transport.js';
import {phoneNumber} from './checkout.js';
const root=new URL('https://tracker.dominos.com/tracker-presentation-service/');
export function trackerURL(path){
    if(typeof path!=='string')throw Error('Order tracking is unavailable.');
    const url=new URL(path.startsWith('/v2/')?path.slice(1):path,root);
    if(url.origin!==root.origin||url.username||url.password||url.hash||!url.pathname.startsWith(root.pathname))throw Error('Order tracking is unavailable.');
    return url;
}
export async function trackOrders(phone,fetcher=fetch){
    const number=phoneNumber(phone);if(!/^[2-9]\d{2}[2-9]\d{6}$/.test(number))throw Error('Enter a valid phone number to track the order.');
    const get=async url=>{const response=await apiFetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)},fetcher);if(!response.ok)throw Error('Order tracking is temporarily unavailable.');return response.json();};
    const url=new URL('v2/orders',root);url.searchParams.set('phonenumber',number);
    const list=await get(url);if(!Array.isArray(list))throw Error('Order tracking is unavailable.');
    const urls=[...new Set(list.map(entry=>trackerURL(entry.Actions?.Track).href))],orders=[];
    for(const url of urls){const order=await get(url);orders.push({id:String(order.OrderID||''),status:String(order.OrderStatus||'Status unavailable'),storeID:String(order.StoreID||'')});}
    return orders;
}
