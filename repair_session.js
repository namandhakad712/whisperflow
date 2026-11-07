const fs=require('fs');
const path=require('path');
const zstd=require('C:/Users/naman/.dsh/dsh-session-rescue-src/lib/zstd.js');
const m=require('C:/Users/naman/.dsh/profiles/web/node_modules/@deepseek-ai/dsh-session-format-v3-to-v4/lib/index.js');

const arg=process.argv[2];
if(!arg){ console.error('usage'); process.exit(1); }
const src = fs.statSync(arg).isDirectory() ? path.join(arg,'session.v4.jsonl.zstd') : arg;
if(!fs.existsSync(src)){ console.error('not found', src); process.exit(1); }

const backup=src+'.bak-'+Date.now();
fs.copyFileSync(src, backup);
console.log('backup', backup);

const buf=fs.readFileSync(src);
const scan=zstd.scanFrames(buf);
const texts=zstd.decodeFrames(buf, scan.frames);
const full=texts.join('');
const lines=full.split('\n').filter(l=>l.trim().length>0).map(l=>JSON.parse(l));
const header=lines[0];
let events=lines.slice(1).map(e=>JSON.parse(JSON.stringify(e)));
console.log('events', events.length);

const SURFACE=new Set(['system/message','user/message','developer/message','assistant/message','tool/result']);

let surface=[];
const removedBySeq=new Map();
for(const e of events){
  if(!SURFACE.has(e.type)) continue;
  const op=e.surfaceOp;
  if(op==='append' || (typeof op==='object' && op && op.op==='append')){ surface.push(e.seq); continue; }
  if(typeof op==='object' && op && op.op==='replace'){
    const first=surface.indexOf(op.startSeq);
    const last=surface.indexOf(op.endSeq);
    const removed = (first>=0 && last>=first) ? surface.slice(first,last+1) : null;
    removedBySeq.set(e.seq, removed);
    if(first>=0 && last>=first) surface.splice(first, last-first+1, e.seq);
  }
}
let fixedSurf=0;
for(const e of events){
  if(e.surfaceOp && typeof e.surfaceOp==='object' && e.surfaceOp.op==='replace'){
    const removed=removedBySeq.get(e.seq);
    if(removed){ e.sourceEventSeqs=removed.slice(); fixedSurf++; }
  }
}
console.log('surface normalized:', fixedSurf);

function assertAll(evts){
  const art={header, events: evts, inheritedEventCount:0};
  m.assertReleasedV4Relationships(art, new Set(evts.map(e=>e.type)));
}
function firstFail(evts){
  let lo=1, hi=evts.length, ff=evts.length+1;
  while(lo<=hi){
    const mid=Math.floor((lo+hi)/2);
    const art={header, events: evts.slice(0,mid), inheritedEventCount:0};
    try { m.assertReleasedV4Relationships(art, new Set(evts.map(e=>e.type))); lo=mid+1; }
    catch(e){ ff=mid; hi=mid-1; }
  }
  return ff;
}
let iterations=0;
while(true){
  try { assertAll(events); console.log('ALL VALID after', iterations, 'neutralizations'); break; }
  catch(err){}
  const ff=firstFail(events);
  if(ff>events.length){ console.log('no failing prefix'); break; }
  const idx=ff-1;
  const e=events[idx];
  if(e.type==='step/start'){
    e.type='rescue/dropped-step-start'; e.ignorable=true; iterations++;
  } else if(e.type==='turn/end'){
    let j=idx-1;
    while(j>=0 && events[j].type!=='step/start') j--;
    if(j>=0){ events[j].type='rescue/dropped-step-start'; events[j].ignorable=true; iterations++; }
    else { console.log('no preceding step/start'); break; }
  } else {
    console.log('unhandled failing type:', e.type); break;
  }
  if(iterations>1000000){ console.log('too many'); break; }
}

const decPath=path.join(path.dirname(src), path.basename(src,'.zstd')+'.repaired.dec.txt');
fs.writeFileSync(decPath, [JSON.stringify(header), ...events.map(e=>JSON.stringify(e))].join('\n')+'\n');

const headerLine=JSON.stringify(header);
const eventLines=events.map(e=>JSON.stringify(e));
const outbuf=zstd.encodeArtifact(headerLine, eventLines);
fs.writeFileSync(src, outbuf);
console.log('written bytes', outbuf.length, 'events', events.length);
// END