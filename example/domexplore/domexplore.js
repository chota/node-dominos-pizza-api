#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {LearningApp} from './learning.js';
import {terminalControls} from './terminal.js';

if(!process.stdin.isTTY || !process.stdout.isTTY){
    console.error('Run domexplore in an interactive terminal.');
    process.exitCode=1;
}else{
    let terminal,app;
    const stop=()=>app?.unmount();
    try{
        terminal=terminalControls(process.stdin,process.stdout);
        process.once('SIGTERM',stop);process.once('SIGINT',stop);
        app=render(React.createElement(LearningApp,{terminal,initialStoreID:process.argv[2]||'2801'}),{
            stdin:terminal.input,alternateScreen:true,onRender:()=>setImmediate(()=>terminal.paint())
        });
        await app.waitUntilExit();
    }catch(error){console.error(error.message);process.exitCode=1;}
    finally{
        terminal?.close();
        process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
    }
}
