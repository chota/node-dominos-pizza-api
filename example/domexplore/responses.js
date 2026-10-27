import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {entries} from './model.js';
const h=React.createElement;
export function treeRows(records,expanded){
    const rows=[];
    const walk=(label,value,path,depth)=>{
        const children=entries(value),id=JSON.stringify(path);
        rows.push({label,value,id,depth,branch:children.length>0,open:expanded.has(id)});
        if(expanded.has(id))for(const [key,child] of children)walk(key,child,[...path,key],depth+1);
    };
    records.forEach((record,i)=>walk(record.label,record.data,[i],0));
    return rows;
}
export function ResponsePanel({records,active,height=8}){
    const [expanded,setExpanded]=useState(new Set());
    const [selected,setSelected]=useState(0);
    const rows=treeRows(records,expanded);
    const index=Math.min(selected,Math.max(0,rows.length-1));
    useInput((input,key)=>{
        if(key.upArrow)setSelected(Math.max(0,index-1));
        if(key.downArrow)setSelected(Math.min(rows.length-1,index+1));
        const row=rows[index];if(!row)return;
        if(key.return||key.rightArrow||key.leftArrow){
            setExpanded(old=>{const next=new Set(old);if(key.leftArrow||(!key.rightArrow&&next.has(row.id)))next.delete(row.id);else next.add(row.id);return next;});
        }
    },{isActive:active});
    const capacity=Math.max(1,height-2),start=Math.floor(index/capacity)*capacity;
    return h(Box,{flexDirection:'column',height},
        h(Text,{bold:true,color:active?'cyan':undefined},`API responses · ${records.length} · ${active?'↑↓ select · Enter expand/collapse':'Tab to inspect'}`),
        ...rows.slice(start,start+capacity).map((row,i)=>h(Text,{key:row.id,inverse:active&&start+i===index,wrap:'truncate'},
            `${' '.repeat(Math.min(12,row.depth)*2)}${row.branch?(row.open?'▾':'▸'):'·'} ${row.label}${row.branch?'':': '+JSON.stringify(row.value)}`)),
        ...(!rows.length?[h(Text,{key:'empty',dimColor:true},'No API requests yet. Customer/address is local.')]:[])
    );
}
