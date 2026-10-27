#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {loadMenu} from './model.js';
import {Explorer} from './ui.js';

const storeID = process.argv[2] || '2801';
if(!process.stdin.isTTY || !process.stdout.isTTY){
    console.error('Run this explorer in an interactive terminal: npm start -- 2801');
    process.exitCode=1;
}else{
    try{
        console.log(`Loading menu for store ${storeID}…`);
        const menu=await loadMenu(storeID);
        render(React.createElement(Explorer,{menu,storeID,fetchedAt:new Date().toLocaleString('en-US', {timeZone:'America/Chicago',timeZoneName:'short'})}));
    }catch(error){console.error(error.message);process.exitCode=1;}
}
