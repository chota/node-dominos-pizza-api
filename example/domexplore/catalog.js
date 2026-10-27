// Presentation/indexing over the original Menu.menu; wire codes are never renamed.
const own=(value,key)=>value!=null&&Object.prototype.hasOwnProperty.call(value,key);
const truth=value=>value===true||value==='true';
const unique=values=>[...new Set(values)];
const number=value=>Number.isFinite(Number(value))?Number(value):null;
export function recipe(raw=''){
    const result={};
    for(const token of String(raw).split(',')){const [code,value='1']=token.trim().split('=');if(code)result[code]=value;}
    return result;
}
function tokens(raw=''){
    return String(raw).split(',').filter(Boolean).map(token=>{const [code,amounts]=token.trim().split('=');return {code,amounts:amounts?.split(':')};});
}
function metadata(menu,type,code){
    const key=Object.keys(menu.toppings||{}).find(key=>key.toLowerCase()===type.toLowerCase());
    const sideKey=Object.keys(menu.sides||{}).find(key=>key.toLowerCase()===type.toLowerCase());
    return menu.toppings?.[key]?.[code]||menu.sides?.[sideKey]?.[code]||{};
}
export function configurationFor(menu,product,variant){
    const type=product.productType||'Other';
    const familyTokens=new Map(tokens(product.availableToppings).map(token=>[token.code,token]));
    const available=tokens(own(variant,'availableToppings')?variant.availableToppings:product.availableToppings);
    const defaults=recipe(variant.tags?.defaultToppings??variant.defaultToppings??product.defaultToppings??'');
    const fallback=variant.tags?.optionQtys||product.tags?.optionQtys||['0','1'];
    const choices=available.map(token=>{
        const info=metadata(menu,type,token.code);
        let amounts=token.amounts||familyTokens.get(token.code)?.amounts||fallback;
        amounts=unique(amounts.map(String).filter(value=>number(value)!==null&&Number(value)>=0)).sort((a,b)=>Number(a)-Number(b));
        if(truth(info.tags?.ignoreQty)||truth(info.tags?.side))amounts=amounts.filter(value=>['0','1'].includes(value));
        return {code:token.code,name:info.name||token.code,amounts,wholeOnly:truth(info.tags?.wholeOnly),ignoreQty:truth(info.tags?.ignoreQty),initial:defaults[token.code]??'0'};
    }).filter(choice=>choice.amounts.length);
    // Preserve defaults that cannot be edited; never invent unsupported amounts.
    for(const [code,amount] of Object.entries(defaults))if(!choices.some(choice=>choice.code===code))choices.push({code,name:metadata(menu,type,code).name||code,amounts:[amount],initial:amount,fixed:true});
    return {defaults,choices,limit:number(variant.tags?.maxOptionQty??product.tags?.maxOptionQty),personal:product.code==='P_DOMINO'||type==='BuildYourOwnDomino',byo:product.code==='S_PIZZA',pizza:['Pizza','Pizzas','BuildYourOwnDomino'].includes(type)};
}
export function prepareCatalog(menu={}){
    const products=menu.products||{},variants=menu.variants||{};
    const placement=new Map();
    const collect=(node,category)=>{for(const code of node.products||[])if(!placement.has(code))placement.set(code,category);for(const child of Object.values(node.subCategories||{}))collect(child,category);};
    const categoryNames=new Map();
    for(const [key,node] of Object.entries(menu.categories?.food||{})){const id=node.code||key;categoryNames.set(id,node.name||id);collect(node,id);}
    const groups=[],byVariant=new Map();
    for(const [key,source] of Object.entries(products)){
        const product={...source,code:source.code||key};
        const codes=unique(product.variants||Object.keys(variants).filter(code=>variants[code].productCode===product.code));
        const choices=codes.map(code=>{
            const raw=variants[code];if(!raw)return null;
            const variant={...raw,code:raw.code||code};
            const type=product.productType||'Other',category=placement.get(key)||type;
            const groupKey=Object.keys(menu.sizes||{}).find(k=>k.toLowerCase()===type.toLowerCase());
            const flavorKey=Object.keys(menu.flavors||{}).find(k=>k.toLowerCase()===type.toLowerCase());
            return {code:variant.code,name:variant.name||product.name||variant.code,productCode:product.code,category,
                size:menu.sizes?.[groupKey]?.[variant.sizeCode]?.name||variant.sizeCode||'',
                crust:menu.flavors?.[flavorKey]?.[variant.flavorCode]?.name||variant.flavorCode||'',
                price:variant.price,product,variant,rules:configurationFor(menu,product,variant)};
        }).filter(Boolean);
        if(!choices.length)continue;
        const category=choices[0].category;
        const group={id:product.code,name:product.code==='S_PIZZA'?'BYO Pizza':product.code==='P_DOMINO'?'Personal Domino':product.name||product.code,category,variants:choices,
            preferred:choices.find(v=>v.code===product.tags?.defaultVariant)||choices.find(v=>/large/i.test(v.size)&&/hand tossed/i.test(v.crust))||choices[0]};
        groups.push(group);for(const choice of choices)byVariant.set(choice.code,choice);
    }
    const sections=unique(groups.map(g=>g.category)).map(id=>{
        const families=groups.filter(g=>g.category===id).sort((a,b)=>a.name.localeCompare(b.name));
        const specialty=families.filter(group=>group.variants[0].rules.pizza&&!['S_PIZZA','P_DOMINO'].includes(group.id));
        const shown=specialty.length>1?[...families.filter(group=>!specialty.includes(group)),{id:'specialty',name:'Specialty Pizza',category:id,families:specialty,variants:specialty.flatMap(group=>group.variants),preferred:specialty[0].preferred}]:families;
        return {id,name:categoryNames.get(id)||id,groups:shown};
    });
    sections.sort((a,b)=>{const aPizza=['Pizza','Pizzas','BuildYourOwnDomino'].includes(a.id),bPizza=['Pizza','Pizzas','BuildYourOwnDomino'].includes(b.id);return aPizza!==bPizza?(aPizza?-1:1):a.name.localeCompare(b.name);});
    return {menu,sections,groups,byVariant};
}
export function initialSelection(variant){return {code:variant.code,qty:1,amounts:{...variant.rules.defaults}};}
export function reconcileSelection(catalog,selection,code){
    const variant=catalog.byVariant.get(code);if(!variant)throw Error('This variant is not on the selected store menu.');
    const next={code,qty:selection.qty,amounts:{...variant.rules.defaults}};let changed=false;
    for(const [key,value] of Object.entries(selection.amounts)){
        const choice=variant.rules.choices.find(choice=>choice.code===key);
        if(!choice){changed=true;continue;}
        next.amounts[key]=choice.amounts.includes(value)?value:choice.amounts.includes('1')?'1':choice.amounts[0];
        if(next.amounts[key]!==value)changed=true;
    }
    return {selection:next,changed};
}
export function usedSlots(variant,amounts){
    return Object.entries(amounts).reduce((total,[code,amount])=>{
        if(Number(amount)<=0)return total;
        const isDefault=Number(variant.rules.defaults[code]||0)>0;
        if(isDefault&&!(variant.rules.personal&&code==='Cp'))return total;
        return total+(variant.rules.byo&&Number(amount)>1?2:1);
    },0);
}
export function validateSelection(catalog,selection){
    const variant=catalog.byVariant.get(selection.code);if(!variant)throw Error('This variant is not on the selected store menu.');
    if(!Number.isInteger(selection.qty)||selection.qty<1||selection.qty>99)throw Error('Choose a whole quantity from 1 to 99.');
    for(const [code,amount] of Object.entries(selection.amounts)){
        const choice=variant.rules.choices.find(c=>c.code===code);
        if(!choice||!choice.amounts.includes(String(amount)))throw Error(`Choose an allowed amount for ${choice?.name||code}.`);
    }
    const slots=usedSlots(variant,selection.amounts);
    if(variant.rules.pizza&&variant.rules.limit!==null&&slots>variant.rules.limit)throw Error(`Reduce toppings to stay within the ${variant.rules.limit}-slot limit.`);
    return variant;
}
export const amountLabel=value=>({'0':'None','0.5':'Light','1':'Regular','1.5':'Extra','2':'Double'}[value]||value);
