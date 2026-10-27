export function entries(value) {
    return value !== null && typeof value === 'object' ? Object.entries(value) : [];
}

export function atPath(root, path) {
    return path.reduce((value, key) => value?.[key], root);
}

export function references(root, value, path) {
    const links = [];
    const add = (label, section, code) => {
        if(root[section]?.[code]) links.push({label, path:[section, code]});
    };
    if(value?.ProductCode) add('Parent product', 'Products', value.ProductCode);
    if(value?.ReferencedProductCode) add('Orderable variant', 'Variants', value.ReferencedProductCode);
    if(Array.isArray(value?.Variants)) {
        for(const code of value.Variants) add('Variant', 'Variants', code);
    }
    if(typeof value === 'string') {
        const section = path.includes('PreconfiguredProducts') ? 'PreconfiguredProducts'
            : path.includes('Variants') ? 'Variants' : 'Products';
        add('Referenced object', section, value);
    }
    return links;
}

export async function loadMenu(storeID, fetcher = fetch) {
    if(!/^\d+$/.test(storeID)) throw new Error('Store ID must contain digits only.');
    const response = await fetcher(`https://order.dominos.com/power/store/${storeID}/menu?lang=en&structured=true`, {signal:AbortSignal.timeout(20000)});
    if(!response.ok) throw new Error(`Menu request failed: HTTP ${response.status}`);
    let menu;
    try { menu = await response.json(); }
    catch { throw new Error('Domino’s returned a non-JSON menu response.'); }
    if(!menu?.Products || !menu?.Variants || !menu?.Categorization) throw new Error('Response is missing the expected menu catalogs.');
    return menu;
}
