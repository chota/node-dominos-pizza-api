import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {mkdir,copyFile,stat,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
const exec=promisify(execFile);
const base=fileURLToPath(new URL('.',import.meta.url));
export const nativeCache=join(homedir(),'Library','Caches','domexplore','native');
export async function buildLocationHelper(){
    if(process.platform!=='darwin')throw Error('Automatic location currently requires macOS. Enter your address manually.');
    const app=join(nativeCache,'DomexploreLocation.app');
    const stamp=join(nativeCache,'source.hash');
    const contents=join(app,'Contents'),binary=join(contents,'MacOS','domexplore-location');
    const source=join(base,'native','LocationHelper.swift'),plist=join(base,'native','Info.plist');
    const hash=createHash('sha256').update(await readFile(source)).update(await readFile(plist)).digest('hex');
    try{if(await readFile(stamp,'utf8')===hash){await stat(binary);return binary;}}catch{}
    await mkdir(join(contents,'MacOS'),{recursive:true});await copyFile(plist,join(contents,'Info.plist'));
    await exec('/usr/bin/swiftc',[source,'-o',binary,'-framework','AppKit','-framework','CoreLocation','-module-cache-path',join(nativeCache,'module-cache')],{timeout:120000});
    await exec('/usr/bin/xattr',['-cr',app],{timeout:15000});
    await exec('/usr/bin/codesign',['--force','--sign','-',app],{timeout:15000});
    await writeFile(stamp,hash);return binary;
}
export async function locateAddress({signal}={}){
    const binary=await buildLocationHelper();
    signal?.throwIfAborted();
    return new Promise((resolve,reject)=>{
        const child=spawn(binary,[],{signal,stdio:['ignore','pipe','pipe']});
        let output='';const timer=setTimeout(()=>child.kill('SIGTERM'),45000);
        child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>output+=chunk);
        child.on('error',error=>{clearTimeout(timer);reject(error);});
        child.on('close',code=>{
            clearTimeout(timer);
            try{const value=JSON.parse(output);if(code!==0||value.error)throw Error(value.error||'Location helper failed.');if(!value.address)throw Error('No address returned.');resolve(value.address);}
            catch(error){reject(Error(output?error.message:'Location was interrupted or unavailable. Enter your address manually.'));}
        });
    });
}
