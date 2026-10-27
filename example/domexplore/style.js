import React from 'react';
import {Text as InkText} from 'ink';
export const palette={background:'#FFFFFF',text:'#000000',red:'#CC2129'};
export function Text(props){
    return React.createElement(InkText,{color:palette.text,backgroundColor:palette.background,...props});
}
export function foodEmoji(key,value){
    const label=`${key} ${value?.ProductType||''} ${value?.Name||''}`.toLowerCase();
    if(/pizza/.test(label))return '🍕';
    if(/sandwich/.test(label))return '🥪';
    if(/drink|beverage/.test(label))return '🥤';
    if(/bread/.test(label))return '🥖';
    if(/dessert|cookie|brownie/.test(label))return '🍪';
    if(/chicken|wing/.test(label))return '🍗';
    return '';
}
