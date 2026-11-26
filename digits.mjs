let models;
const gridWidth=13;
const gridHeight=23;
const paint=(data,x,y,width)=>Boolean(data[y*width+x]);
const distance=(a,b)=>{
  let diff=0;
  for(let i=0;i<gridHeight;i++){
    let bits=a[1][i]^b[1][i];
    while(bits){bits&=bits-1;diff++;}
  }
  return diff/(gridWidth*gridHeight)+Math.min(.3,Math.abs(a[0]-b[0])*.34);
};

export function loadDigits() {
  models ??= fetch(new URL('./vendor/digits.json',import.meta.url))
    .then(response=>{if(!response.ok) throw new Error('無法讀取數字模型');return response.json();})
    .catch(error=>{models=null;throw error;});
  return models;
}
function shapeFrom(mask,width,start,end,rows,height) {
  let top=height;
  let bottom=0;
  for(let y=0;y<height;y++) {
    let found=false;
    for(let x=start;x<end;x++) if(paint(mask,x,y,width)){found=true;break;}
    if(found){top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
  }
  if(bottom-top<3) return null;
  for(let y=0;y<gridHeight;y++) {
    const sy=Math.min(bottom-1,Math.floor(top+(y+.5)*(bottom-top)/gridHeight));
    let bits=0;
    for(let x=0;x<gridWidth;x++) {
      const sx=Math.min(end-1,Math.floor(start+(x+.5)*(end-start)/gridWidth));
      if(paint(mask,sx,sy,width)) bits|=1<<x;
    }
    rows.push(bits);
  }
  return [(end-start)/(bottom-top),rows];
}
function glyphs(data,threshold,width,height) {
  const mask=new Uint8Array(data.length);
  const columns=new Uint16Array(width);
  for(let i=0;i<data.length;i++) if(data[i]>=threshold){mask[i]=1;columns[i%width]++;}
  const found=[];
  let start=-1;
  for(let x=0;x<=width;x++){
    if(columns[x]>=2 && start<0) start=x;
    if(!(columns[x]>=2) && start>=0) {
      if(x-start>=2) {
        const shape=shapeFrom(mask,width,start,x,[],height);
        if(shape) found.push({shape,width:x-start});
      }
      start=-1;
    }
  }
  return found;
}
const profiles={
  rating:{thresholds:[160,169,175,181,190,150],pattern:/^\d{1,2}\.\d$/},
  regular:{thresholds:[143,149,155,160,166,172,177,182,191,135,125],pattern:/^\d{1,7}$/},
  scoreBlue:{thresholds:[75,85,95,106,65],pattern:/^\d{1,3}$/},
  scoreRed:{thresholds:[70,83,95,104,55],pattern:/^\d{1,3}$/},
  date:{thresholds:[76,79,82,85,88],pattern:/^\d\d:\d\d20\d\d\/\d\d\/\d\d\d\d:\d\d$/}
};
const brightness=(r,g,b,profile)=>profile==='scoreBlue'?b-r:profile==='scoreRed'?r-g:.299*r+.587*g+.114*b;

export function readGlyphLine(imageData,templates,profile='regular') {
  const {width,height,data}=imageData;
  const pixels=Float32Array.from({length:width*height},(_,index)=>brightness(data[4*index],data[4*index+1],data[4*index+2],profile));
  const candidates=new Map();
  const {thresholds,pattern}=profiles[profile];
  const model=profile==='date'?templates.time:profile==='scoreBlue'||profile==='scoreRed'
    ? {...templates.gray,...templates.blue,...templates.red} : templates.gray;
  for(const threshold of thresholds) {
    const parts=glyphs(pixels,threshold,width,height);
    if(!parts.length||parts.length>(profile==='date'?24:8)) continue;
    let cost=0;
    let maxCost=0;
    let nearestGap=1;
    const text=parts.map(({shape,width})=>{
      const options=Object.entries(profile==='date'?{...templates.gray,...model}:model)
        .filter(([digit])=>digit!=='.'||profile==='rating')
        .map(([digit,forms])=>[digit,Math.min(...forms.map(form=>distance(shape,form))),
          profile==='date'&&!model[digit]?.length ? 0.015 : 0])
        .map(([digit,score,penalty])=>[digit,score+penalty])
        .sort((a,b)=>a[1]-b[1]);
      const [digit,score]=options[0];
      const gap=options[1][1]-score;
      cost+=score;
      maxCost=Math.max(maxCost,score);
      nearestGap=Math.min(nearestGap,gap);
      if(profile!=='date'&&width>30&&profile!=='scoreBlue'&&profile!=='scoreRed') cost+=.12;
      return digit;
    }).join('');
    if(!pattern.test(text)) continue;
    const quality=.64*cost/parts.length+.36*maxCost;
    const existing=candidates.get(text);
    if(!existing || quality<existing.quality) candidates.set(text,{text,quality,count:(existing?.count||0)+1,nearestGap});
    else existing.count++;
  }
  const ranked=[...candidates.values()].sort((a,b)=>(a.quality-Math.min(a.count,4)*.009)-(b.quality-Math.min(b.count,4)*.009));
  return ranked[0] || null;
}
