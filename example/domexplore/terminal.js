import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';

// SGR mouse reports use one-based terminal-cell coordinates (DECSET 1006).
export class CornerGesture {
    count=0;
    last=0;
    pressed=false;
    reset(){this.count=0;this.last=0;this.pressed=false;}
    accept({button,x,y,release},columns,rows,now=Date.now()){
        if(button!==0 || x!==columns || y!==rows){this.reset();return false;}
        if(!release){
            if(now-this.last>1000)this.count=0;
            this.pressed=true;
            return false;
        }
        if(!this.pressed)return false;
        this.pressed=false;
        this.count=now-this.last>1000?1:this.count+1;
        this.last=now;
        if(this.count!==5)return false;
        this.reset();return true;
    }
}

// Strip mouse reports before Ink sees them, including reports split across reads.
export class MouseDecoder {
    pending='';
    constructor(onMouse,onKeys){this.onMouse=onMouse;this.onKeys=onKeys;}
    push(text){
        this.pending+=text;
        while(this.pending){
            const start=this.pending.indexOf('\x1b[<');
            if(start===-1){
                const tail=this.pending.endsWith('\x1b[')?2:this.pending.endsWith('\x1b')?1:0;
                const ready=this.pending.slice(0,this.pending.length-tail);
                if(ready)this.onKeys(ready);
                this.pending=this.pending.slice(this.pending.length-tail);return;
            }
            if(start){this.onKeys(this.pending.slice(0,start));this.pending=this.pending.slice(start);}
            const match=/^\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(this.pending);
            if(match){
                this.onMouse({button:Number(match[1]),x:Number(match[2]),y:Number(match[3]),release:match[4]==='m'});
                this.pending=this.pending.slice(match[0].length);continue;
            }
            if(/^\x1b\[<[\d;]*$/.test(this.pending)&&this.pending.length<64)return;
            // Discard malformed mouse reports, never let their digits enter a form.
            this.pending=this.pending.slice(3).replace(/^[\d;]+[Mm]?/,'');
        }
    }
    flush(){
        if(this.pending==='\x1b'||this.pending==='\x1b[')this.onKeys(this.pending);
        this.pending='';
    }
}

export function terminalControls(stdin,stdout){
    const events=new EventEmitter();
    const input=new PassThrough();
    input.isTTY=stdin.isTTY;
    input.setRawMode=value=>stdin.setRawMode(value);
    input.ref=()=>stdin.ref?.();input.unref=()=>stdin.unref?.();
    const gesture=new CornerGesture();
    let advanced=false,timer,closed=false;
    const paint=()=>{
        if(!closed&&stdout.isTTY)stdout.write(`\x1b7\x1b[${stdout.rows};${stdout.columns}H\x1b[${advanced?'42':'100'}m \x1b[0m\x1b8`);
    };
    const decoder=new MouseDecoder(event=>{
        if(gesture.accept(event,stdout.columns,stdout.rows)){
            advanced=!advanced;events.emit('advanced',advanced);paint();
        }
    },keys=>{gesture.reset();input.write(keys);});
    const receive=chunk=>{
        clearTimeout(timer);decoder.push(chunk);
        // Allow Escape to remain a keyboard key without leaking partial reports.
        timer=setTimeout(()=>decoder.flush(),40);
    };
    const resize=()=>{gesture.reset();paint();};
    stdin.setEncoding('utf8');stdin.on('data',receive);stdout.on('resize',resize);
    stdout.write('\x1b[?1000h\x1b[?1006h');
    return {input,events,paint,get advanced(){return advanced;},close(){
        if(closed)return;closed=true;clearTimeout(timer);
        stdin.off('data',receive);stdout.off('resize',resize);
        stdout.write('\x1b[?1000l\x1b[?1006l\x1b[0m');input.destroy();
    }};
}
