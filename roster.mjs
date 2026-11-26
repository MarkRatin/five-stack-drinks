const columns=32;
const rows=10;
let model;

export function loadRoster() {
  model ??= fetch(new URL('./vendor/roster.json',import.meta.url))
    .then(response=>{if(!response.ok) throw new Error('隊伍比對載入失敗');return response.json();})
    .catch(()=>null);
  return model;
}

function describe({width,height,data}) {
  const light=Float32Array.from({length:width*height},(_,i)=>.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2]);
  const ordered=light.slice().sort();
  const background=ordered[Math.floor(light.length*.80)];
  const foreground=ordered[Math.floor(light.length*.98)];
  if(foreground-background<12) return [];
  const features=[];
  for(const strength of [.27,.4,.55]) {
    const cutoff=background+(foreground-background)*strength;
    const included=Uint8Array.from(light,value=>value>=cutoff);
    const counts=new Uint8Array(width);
    for(let i=0;i<included.length;i++) counts[i%width]+=included[i];
    const active=Array.from(counts.keys()).filter(x=>counts[x]>=3);
    if(!active.length) continue;
    const start=active[0];
    const gap=active.findIndex((x,i)=>i && x-active[i-1]>23);
    const end=(gap<0?active.at(-1):active[gap-1])+1;
    const visible=Array.from({length:height},(_,i)=>i).filter(y=>included.slice(y*width+start,y*width+end).reduce((a,b)=>a+b,0)>=3);
    if(!visible.length) continue;
    const top=visible[0];
    const bottom=visible.at(-1)+1;
    if(end-start<40 || bottom-top<10) continue;
    const cells=[];
    for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {
      const left=start+Math.floor(x*(end-start)/columns);
      const right=start+Math.floor((x+1)*(end-start)/columns);
      const upper=top+Math.floor(y*(bottom-top)/rows);
      const lower=top+Math.floor((y+1)*(bottom-top)/rows);
      let sum=0;
      for(let yy=upper;yy<lower;yy++) for(let xx=left;xx<right;xx++) sum+=included[yy*width+xx];
      cells.push(Math.round(9*sum/((right-left)*(lower-upper))));
    }
    features.push([(end-start)/(bottom-top),cells.join('')]);
  }
  return features;
}

function compare(a,b) {
  let distance=0;
  for(let i=0;i<a[1].length;i++) distance+=Math.abs(Number(a[1][i])-Number(b[1][i]));
  return distance/(columns*rows*9)+.15*Math.min(1,Math.abs(a[0]-b[0]));
}

export function identifyRoster(images,references) {
  if(!references) return [];
  const used=new Set();
  return images.map(image=>{
    const features=describe(image);
    const matches=Object.entries(references).map(([id,known])=>({id,score:Math.min(1,...known.flatMap(ref=>features.map(value=>compare(ref,value))))})).sort((a,b)=>a.score-b.score);
    const best=matches[0];
    if(best.score>.13 || matches[1].score-best.score<.055 || used.has(best.id)) return null;
    used.add(best.id);
    return best.id;
  });
}
