import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readFileSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
export const configPath=join(homedir(),'.domexplore.conf');
export const contactKeys=['firstName','lastName','phone','email'];
export const addressKeys=['street','city','region','postalCode','unitType','unitNumber','deliveryInstructions','residenceType'];
const strings=(value,keys)=>Object.fromEntries(keys.filter(key=>typeof value?.[key]==='string').map(key=>[key,value[key]]));
// Retain order history without retaining payment credentials or arbitrary responses.
export function orderSummary(order){
    if(!order||typeof order!=='object'||Array.isArray(order))return null;
    const products=order.Products||order.products;
    return {
        orderID:String(order.OrderID||order.orderID||''),
        storeID:String(order.StoreID||order.storeID||''),
        recordedAt:typeof order.recordedAt==='string'?order.recordedAt:new Date().toISOString(),
        serviceMethod:String(order.ServiceMethod||order.serviceMethod||''),
        total:order.total??order.Amounts?.Customer??order.amountsBreakdown?.customer??null,
        products:Array.isArray(products)?products.map(item=>({
            code:String(item.Code||item.code||''),
            name:String(item.Name||item.name||''),
            qty:Number(item.Qty??item.qty??1),
            options:item.Options||item.options||{}
        })):[]
    };
}
export function cleanConfig(config={}){
    return {version:1,customer:strings(config.customer,contactKeys),address:strings(config.address,addressKeys),lastOrder:orderSummary(config.lastOrder)};
}
export function loadConfig(path=configPath){
    try{
        if(lstatSync(path).isSymbolicLink())throw Error('The config path must be a regular file, not a symbolic link.');
        const value=JSON.parse(readFileSync(path,'utf8'));
        if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a JSON object.');
        if(value.version!==undefined&&value.version!==1)throw Error('Unsupported config version.');
        return cleanConfig(value);
    }catch(error){if(error.code==='ENOENT')return cleanConfig();throw new Error(`Cannot read ${path}: ${error.message}`);}
}
export function saveConfig(config,path=configPath){
    try{if(lstatSync(path).isSymbolicLink())throw Error('Refusing to replace a symbolic-link config.');}
    catch(error){if(error.code!=='ENOENT')throw error;}
    const temporary=join(dirname(path),`.domexplore-${randomUUID()}.tmp`);
    let fd;
    try{
        fd=openSync(temporary,'wx',0o600);
        writeFileSync(fd,JSON.stringify(cleanConfig(config),null,2)+'\n');fsyncSync(fd);closeSync(fd);fd=undefined;
        renameSync(temporary,path);
    }finally{
        if(fd!==undefined)closeSync(fd);
        try{unlinkSync(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}
    }
}
export function configWithValues(previous,values){
    return cleanConfig({...previous,customer:strings(values,contactKeys),address:strings(values,addressKeys)});
}
