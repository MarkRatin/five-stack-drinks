let templates;
export function loadHeroPortraits() {
  templates ??= fetch(new URL('./vendor/hero-portraits.json',import.meta.url))
    .then(response=>{if(!response.ok) throw new Error('無法讀取英雄比對資料');return response.json();})
    .catch(()=>null);
  return templates;
}

function describe({width,height,data}) {
  const columns=10, rows=8;
  const result=[];
  for(let row=0;row<rows;row++) for(let column=0;column<columns;column++) {
    const top=Math.floor(row*height/rows), bottom=Math.floor((row+1)*height/rows);
    const left=Math.floor(column*width/columns), right=Math.floor((column+1)*width/columns);
    const channels=[0,0,0];
    for(let y=top;y<bottom;y++) for(let x=left;x<right;x++) {
      const start=(y*width+x)*4;
      for(let channel=0;channel<3;channel++) channels[channel]+=data[start+channel];
    }
    result.push(...channels.map(total=>Math.round(total/((bottom-top)*(right-left)))));
  }
  return result;
}

export function identifyHero(image, references) {
  if(!references) return '';
  const features=describe(image);
  const candidates=Object.entries(references).map(([name,reference])=>({
    name,
    distance:reference.reduce((total,value,index)=>total+Math.abs(value-features[index]),0)/features.length
  })).sort((a,b)=>a.distance-b.distance);
  const [best,next]=candidates;
  return best?.distance<10&&(!next||next.distance-best.distance>7) ? best.name : '';
}
