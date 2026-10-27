#!/usr/bin/env node
import React from 'react';

if(process.argv.length>2){
    console.error('Usage: domexplore (choose a store inside the app)');
    process.exitCode=1;
}else if(!process.stdin.isTTY || !process.stdout.isTTY){
    console.error('Run domexplore in an interactive terminal.');
    process.exitCode=1;
}else{
    // The requested fixed light appearance must not inherit a dark terminal theme.
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR='3';
    const [{render},{LearningApp}]=await Promise.all([import('ink'),import('./learning.js')]);
    let app;
    const stop=()=>app?.unmount();
    try{
        process.once('SIGTERM',stop);process.once('SIGINT',stop);
        app=render(React.createElement(LearningApp),{alternateScreen:true});
        await app.waitUntilExit();
    }catch(error){console.error(error.message);process.exitCode=1;}
    finally{
        process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
    }
}
