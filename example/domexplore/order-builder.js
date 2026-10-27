import {Item,Order} from '../../index.js';
import {initialSelection,validateSelection} from './catalog.js';
export class LocalOrderBuilder {
    revision=0;
    validatedRevision=null;
    pricedRevision=null;
    constructor(order,catalog){if(!(order instanceof Order))throw Error('An actual package Order is required.');this.order=order;this.catalog=catalog;}
    changed(){this.revision++;this.validatedRevision=null;this.pricedRevision=null;}
    selection(index){
        const item=this.order.products[index],variant=this.catalog.byVariant.get(item?.code);
        if(!variant)throw Error('This item is no longer available in the menu.');
        const result=initialSelection(variant);result.qty=item.qty;
        for(const [code,parts] of Object.entries(item.options)){
            if(Object.keys(parts).some(part=>part!=='1/1'))throw Error('This item uses portions that this whole-item editor cannot edit.');
            result.amounts[code]=String(parts['1/1']);
        }
        return result;
    }
    commit(selection,index=null){
        validateSelection(this.catalog,selection);
        const options=Object.fromEntries(Object.entries(selection.amounts).map(([code,amount])=>[code,{'1/1':String(amount)}]));
        const previous=index===null?null:this.order.products[index];
        if(index!==null&&!previous)throw Error('The item being edited no longer exists.');
        const item=new Item({code:selection.code,qty:selection.qty,options,...(previous?{iD:previous.iD}:{})});
        if(previous)this.order.products[index]=item;else this.order.addItem(item);
        this.changed();return item;
    }
    remove(index){const item=this.order.products[index];if(!item)throw Error('Item not found.');this.order.removeItem(item);this.changed();}
    snapshot(){return {StoreID:this.order.storeID,ServiceMethod:this.order.serviceMethod,Products:this.order.products.map(item=>item.formatted)};}
    restore(snapshot){
        if(String(snapshot?.storeID??snapshot?.StoreID)!==String(this.order.storeID)||(snapshot.serviceMethod??snapshot.ServiceMethod)!==this.order.serviceMethod)return {restored:0,skipped:0};
        let restored=0,skipped=0;
        for(const saved of snapshot.products||snapshot.Products||[]){
            try{
                const code=saved.code||saved.Code,variant=this.catalog.byVariant.get(code);if(!variant)throw Error();
                const selection=initialSelection(variant);selection.qty=saved.qty??saved.Qty;
                for(const [key,parts] of Object.entries(saved.options||saved.Options||{})){if(Object.keys(parts).some(part=>part!=='1/1'))throw Error();selection.amounts[key]=String(parts['1/1']);}
                this.commit(selection);restored++;
            }catch{skipped++;}
        }
        return {restored,skipped};
    }
}
