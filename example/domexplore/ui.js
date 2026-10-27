import React, {useState} from 'react';
import {Box, useInput, useApp, useStdout} from 'ink';
import {entries, atPath, references} from './model.js';
import {Text,palette,foodEmoji} from './style.js';
const h = React.createElement;
const describe = value => Array.isArray(value) ? `[${value.length} entries]`
    : value !== null && typeof value === 'object' ? `{${Object.keys(value).length} fields}${value.Name ? ' '+value.Name : ''}`
    : JSON.stringify(value);

export function Explorer({menu, storeID, fetchedAt, active=true, embedded=false, height, onBack, onNext}) {
    const [path, setPath] = useState([]);
    const [selected, setSelected] = useState(0);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const {exit} = useApp();
    const {stdout} = useStdout();
    const value = atPath(menu, path);
    const rows = [
        ...references(menu, value, path).map(link=>({key:'↗ '+link.label, value:link.path.join('.'), path:link.path})),
        ...entries(value).map(([key, child])=>({key, value:child, path:[...path,key]}))
    ].filter(row=>(row.key+' '+describe(row.value)).toLowerCase().includes(query.toLowerCase()));
    const index = Math.min(selected, Math.max(0,rows.length-1));
    const capacity = Math.max(1, (height || stdout.rows || 30)-(embedded?7:12));
    const start = Math.floor(index/capacity)*capacity;
    const navigate = next => {setPath(next);setSelected(0);setQuery('');setSearching(false);};
    useInput((input,key)=>{
        if(key.escape){if(searching){setSearching(false);setQuery('');}else if(path.length)navigate(path.slice(0,-1));else onBack?.();return;}
        if(searching){
            if(key.return){setSearching(false);return;}
            if(key.backspace||key.delete){setQuery(q=>q.slice(0,-1));setSelected(0);return;}
            if(input&&!key.ctrl&&!key.meta){setQuery(q=>q+input);setSelected(0);}return;
        }
        if(input==='q'){exit();return;}
        if(input==='n'&&embedded){onNext?.();return;}
        if(input==='/'){setSearching(true);return;}
        if(input==='h'){navigate([]);return;}
        if(key.leftArrow||key.backspace){if(path.length)navigate(path.slice(0,-1));else onBack?.();return;}
        if(key.upArrow)setSelected(Math.max(0,index-1));
        if(key.downArrow)setSelected(Math.min(rows.length-1,index+1));
        if((key.return||key.rightArrow)&&rows[index])navigate(rows[index].path);
    },{isActive:active});
    return h(Box,{flexDirection:'column',padding:embedded?0:1,backgroundColor:palette.background},
        !embedded&&h(Text,{bold:true},`domexplore · Store ${storeID}`),
        !embedded&&h(Text,{color:palette.text},`Customer/address → store → [menu] → items → local Order ↔ validate ↔ price`),
        !embedded&&h(Text,{color:palette.text},`Live snapshot ${fetchedAt} · raw Domino’s response · read-only`),
        h(Box,{marginTop:1},h(Text,{color:palette.text,wrap:'truncate'},'menu / '+path.join(' / '))),
        h(Text,null,`${Array.isArray(value)?'Array':value===null?'null':typeof value} · ${rows.length} entries${query?' · filter: '+query:''}${searching?' ▌':''}`),
        h(Box,{flexDirection:'column',marginTop:1},
            ...rows.slice(start,start+capacity).map((row,i)=>h(Text,{key:row.key,color:start+i===index?palette.red:palette.text,wrap:'truncate'},`${start+i===index?'›':' '} ${foodEmoji(row.key,row.value)}${foodEmoji(row.key,row.value)?' ':''}${row.key}  ${describe(row.value)}`)),
            ...(!entries(value).length?[h(Text,{key:'value',wrap:'wrap'},describe(value))]:[])),
        h(Box,{marginTop:1},h(Text,{color:palette.text},`↑↓ select · Enter/→ open · ← back · / filter · Esc cancel/back · h home · ${embedded?'n next lesson':'q quit'}`)),
        h(Text,{color:palette.text},rows.length?`${index+1}/${rows.length} · ↗ follows a product/variant reference`:'No matching entries')
    );
}
