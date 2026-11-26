import {groups, players} from './rules.mjs';
import {loadDigits, readGlyphLine} from './digits.mjs';
import {identifyRoster, loadRoster} from './roster.mjs';
import {identifyHero, loadHeroPortraits} from './heroes.mjs';

const vendor = new URL('./vendor/', import.meta.url).href;
const source = {width:2622,height:1206};
const rowStep = 154;
const rowLayouts = {
  rating:[490,288,112,54],
  kills:[875,249,49,43], deaths:[949,249,49,43], assists:[1019,249,57,43], gold:[1093,249,115,43],
  damage:[630,300,172,41], taken:[844,300,170,41],
  control:[630,300,172,41], heal:[844,300,170,41], tower:[1058,300,174,41],
  name:[637,246,232,45]
};
const leftHeader = [968,12,108,83];
const rightHeader = [1550,13,124,90];
const timeRect = [2025,16,350,44];
const directions = {left:0,right:1070};
const tabs = [
  {kind:'stats',x:897}, {kind:'output',x:1066}, {kind:'survival',x:1235},
  {kind:'growth',x:1405}, {kind:'record',x:1574}, {kind:'team',x:1744}
];

let engineScript;
function loadEngine() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  engineScript ??= new Promise((resolve,reject)=>{
    const script = document.createElement('script');
    script.src = vendor + 'tesseract.min.js';
    script.onload = () => resolve(globalThis.Tesseract);
    script.onerror = () => { script.remove(); engineScript=null; reject(new Error('辨識元件載入失敗')); };
    document.head.append(script);
  });
  return engineScript;
}

function canvas(width,height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}
export function openImage(file) {
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('讀不到這個圖檔，請改用 PNG、JPG 或 WebP 戰績截圖。')); };
    img.src = url;
  });
}

function crop(img, rect, zoom=2, monochrome=true) {
  const [x,y,w,h] = rect;
  const target = canvas(w*zoom,h*zoom);
  const ctx = target.getContext('2d',{willReadFrequently:true});
  const sx=img.naturalWidth/source.width, sy=img.naturalHeight/source.height;
  ctx.drawImage(img,x*sx,y*sy,w*sx,h*sy,0,0,target.width,target.height);
  if (!monochrome) return target;
  const pixels=ctx.getImageData(0,0,target.width,target.height);
  for(let i=0;i<pixels.data.length;i+=4) {
    const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
    const light=.299*r+.587*g+.114*b;
    const gray=255-Math.max(0,Math.min(255,(light-112)*4.1));
    pixels.data[i]=gray; pixels.data[i+1]=gray; pixels.data[i+2]=gray; pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  return target;
}

export function classifyImage(img) {
  if (img.naturalWidth / img.naturalHeight < 1.7 || img.naturalWidth / img.naturalHeight > 2.6) return null;
  const measurements=tabs.map(tab=>{
    const patch=crop(img,[tab.x-38,1118,76,42],1,false);
    const pixels=patch.getContext('2d').getImageData(0,0,76,42).data;
    let amount=0;
    for(let i=0;i<pixels.length;i+=4) {
      const [r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]];
      if(r>145 && g>135 && r>g*.92 && b<g*.82) amount++;
    }
    return {...tab,amount};
  }).sort((a,b)=>b.amount-a.amount);
  return measurements[0].amount>55 && measurements[0].amount>measurements[1].amount*1.3
    ? measurements[0].kind : 'overview';
}

async function workerFor(languages, onProgress) {
  const engine=await loadEngine();
  return engine.createWorker(languages,1,{
    workerPath:vendor+'worker.min.js',
    corePath:vendor+'tesseract-core-lstm.wasm.js',
    langPath:vendor.slice(0,-1),
    workerBlobURL:false,
    cacheMethod:'none',
    logger:data=>{if(data.status==='recognizing text') onProgress?.(data.progress);}
  });
}

const tsvWords = tsv => (tsv || '').split('\n').slice(1).map(line=>line.split('\t')).filter(parts=>parts[0]==='5'&&parts[11]?.trim())
  .map(parts=>({x:Number(parts[6]),y:Number(parts[7]),w:Number(parts[8]),h:Number(parts[9]),confidence:Number(parts[10]),text:parts.slice(11).join(' ')}));
function makeGrid(img,cells,columns,{zoom=2,cellWidth=365,cellHeight=115}={}) {
  const sheet=canvas(columns*cellWidth,Math.ceil(cells.length / columns)*cellHeight);
  const ctx=sheet.getContext('2d');
  ctx.fillStyle='white';
  ctx.fillRect(0,0,sheet.width,sheet.height);
  cells.forEach((cell,index)=>{
    const image=crop(img,cell.rect,zoom);
    ctx.drawImage(image,(index%columns)*cellWidth+12,Math.floor(index/columns)*cellHeight+8);
  });
  return {sheet,cellWidth,cellHeight};
}

async function gridWords(worker,img,cells,columns,options) {
  const {sheet,cellWidth,cellHeight}=makeGrid(img,cells,columns,options);
  const {data}=await worker.recognize(sheet,{}, {text:true,tsv:true});
  const groups=cells.map(()=>[]);
  for(const word of tsvWords(data.tsv)) {
    const index=Math.floor((word.y+word.h/2)/cellHeight)*columns+Math.floor((word.x+word.w/2)/cellWidth);
    groups[index]?.push(word);
  }
  return groups.map(words=>({
    text:words.sort((a,b)=>a.x-b.x).map(word=>word.text).join(''),
    confidence:words.length ? Math.min(...words.map(word=>word.confidence)) : 0
  }));
}

function parseNumber(text,key) {
  const clean=text.replace(/[,\s]/g,'');
  if (!/^\d+(?:\.\d+)?$/.test(clean)) return null;
  const value=Number(clean);
  if (key==='rating') return /^\d{1,2}\.\d$/.test(clean) && value<=20 ? value : null;
  const max=key==='kills'||key==='deaths'||key==='assists'||key==='teamKills'?200:9999999;
  return Number.isSafeInteger(value)&&value<=max ? value : null;
}

function fromGlyphs(img,rect,model,profile) {
  if(!model) return null;
  const image=crop(img,rect,1,false);
  const found=readGlyphLine(image.getContext('2d').getImageData(0,0,image.width,image.height),model,profile);
  return found && found.quality<.13 && found.nearestGap>.028 ? found.text : null;
}

async function readNumbers(getWorker,img,kind,side,model) {
  const keys=[...new Set(['rating',...groups[kind]])];
  const rows=Array.from({length:5},()=>({}));
  const uncertain=[];
  const missing=[];
  for(let index=0;index<5;index++) {
    for(const key of keys) {
      const [x,y,w,h]=rowLayouts[key];
      const rect=[x+directions[side],y+index*rowStep,w,h];
      const value=parseNumber(fromGlyphs(img,rect,model,key==='rating'?'rating':'regular') || '',key);
      if(value!==null) rows[index][key]=value;
      else missing.push({key,index,rect});
    }
  }
  if(missing.length) {
    const worker=await getWorker();
    await worker.setParameters({tessedit_char_whitelist:'0123456789.',tessedit_pageseg_mode:'11'});
    const readings=await gridWords(worker,img,missing,Math.min(5,missing.length));
    await worker.setParameters({tessedit_pageseg_mode:'7'});
    for(const [i,cell] of missing.entries()) {
      let reading=parseNumber(readings[i].text,cell.key);
      if(reading===null || readings[i].confidence<70) {
        const {data}=await worker.recognize(crop(img,cell.rect,3));
        const single=parseNumber(data.text.trim(),cell.key);
        if(single!==null && (reading===null||data.confidence>readings[i].confidence)) reading=single;
      }
      rows[cell.index][cell.key]=reading;
      uncertain.push([cell.index,cell.key]);
    }
  }
  return {rows,uncertain};
}
async function readOverviewHeader(getWorker,img,side,model) {
  const scoreRect=side==='left'?leftHeader:rightHeader;
  const score=fromGlyphs(img,scoreRect,model,side==='left'?'scoreBlue':'scoreRed');
  let stamp=fromGlyphs(img,timeRect,model,'date');
  if(!stamp) {
    const worker=await getWorker();
    await worker.setParameters({tessedit_char_whitelist:'0123456789/:',tessedit_pageseg_mode:'7'});
    const reading=await worker.recognize(crop(img,timeRect,2));
    stamp=reading.data.text;
  }
  const text=stamp.replace(/\s/g,'');
  const match=text.match(/(20\d{2})[\/](\d{1,2})[\/](\d{1,2})(\d{2}):(\d{2})/);
  const pad=v=>v.padStart(2,'0');
  return {
    teamKills:parseNumber(score||'','teamKills'),
    date:match ? [match[1],pad(match[2]),pad(match[3])].join('-') : '',
    time:match ? [match[4],match[5]].join(':') : ''
  };
}

const sameCharacters=(a,b)=>{
  if(a===b) return 1;
  let last=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=0;i<a.length;i++) {
    const next=[i+1];
    for(let j=0;j<b.length;j++) next.push(Math.min(last[j]+(a[i]===b[j]?0:1),last[j+1]+1,next[j]+1));
    last=next;
  }
  return 1-last.at(-1)/Math.max(a.length,b.length,1);
};
const normalizeName=name=>name.normalize('NFKC').replace(/[^\p{Letter}\p{Number}]/gu,'');
export function matchNames(found) {
  const assigned=new Set();
  return found.map(value=>{
    const normalized=normalizeName(value);
    const candidates=players.map(player=>({...player,score:sameCharacters(normalized,normalizeName(player.name))})).sort((a,b)=>b.score-a.score);
    const candidate=candidates[0];
    if(candidate.score<.55 || candidate.score-candidates[1].score<.18 || assigned.has(candidate.id)) return null;
    assigned.add(candidate.id);
    return candidate.id;
  });
}

async function readNames(img,side,worker) {
  const cells=Array.from({length:5},(_,index)=>{
    const [x,y,w,h]=rowLayouts.name;
    return {rect:[x+directions[side],y+index*rowStep,w,h]};
  });
  await worker.setParameters({tessedit_pageseg_mode:'11'});
  return (await gridWords(worker,img,cells,1,{cellWidth:510,cellHeight:113})).map(item=>item.text);
}
function readHeroPortraits(img,side,references) {
  return Array.from({length:5},(_,index)=>{
    const patch=crop(img,[251+directions[side],245+index*rowStep,170,102],1,false);
    const pixels=patch.getContext('2d').getImageData(0,0,patch.width,patch.height);
    return identifyHero(pixels,references);
  });
}
async function readHeroText(img,side,worker,heroes) {
  const cells=heroes.flatMap((hero,index)=>hero ? [] : [{
    index, rect:[243+directions[side],344+index*rowStep,133,34]
  }]);
  if(!cells.length) return heroes;
  await worker.setParameters({tessedit_pageseg_mode:'11'});
  const matches=await gridWords(worker,img,cells,1,{zoom:3,cellWidth:430,cellHeight:127});
  for(const [i,{text,confidence}] of matches.entries()) {
    const hero=[...text.matchAll(/\p{Script=Han}/gu)].map(match=>match[0]).join('');
    if(confidence>=76&&hero.length>=1&&hero.length<=6) heroes[cells[i].index]=hero;
  }
  return heroes;
}
export async function recognizeBatch(files, preferredSide, onStage, overrides = {}) {
  const inspected=[];
  for (const file of files) {
    const image=await openImage(file);
    inspected.push({file,image,kind:overrides[file.name] || classifyImage(image)});
  }
  const usable=inspected.filter(item=>Object.hasOwn(groups,item.kind));
  if(!usable.length) return {inspected:inspected.map(({file,kind})=>({file,kind})),readings:[]};

  const overviewFile=usable.find(item=>item.kind==='overview');
  const overview=overviewFile || usable[0];
  const sides=preferredSide ? [preferredSide] : ['left','right'];
  const references=await loadRoster();
  onStage?.('辨認五人名單…');
  const candidates=sides.map(side=>{
    const images=Array.from({length:5},(_,row)=>{
      const cell=crop(overview.image,[637+directions[side],247+row*rowStep,225,42],1,false);
      return cell.getContext('2d').getImageData(0,0,cell.width,cell.height);
    });
    return {side,order:identifyRoster(images,references),found:[]};
  });
  const matches=candidate=>candidate.order.filter(Boolean).length;
  const best=()=>candidates.slice().sort((a,b)=>matches(b)-matches(a))[0];
  const heroReferences=overviewFile ? await loadHeroPortraits() : null;
  const findHeroes=()=>overviewFile ? readHeroPortraits(overviewFile.image,best().side,heroReferences) : [];
  let heroes=findHeroes();
  const needsRoster=matches(best())<5;
  if(needsRoster || heroes.some(hero=>!hero)) {
    let names;
    try {
      names=await workerFor(['chi_tra','eng']);
      for(const candidate of needsRoster ? candidates : []) {
        candidate.found=await readNames(overview.image,candidate.side,names);
        const textOrder=matchNames(candidate.found);
        const used=new Set(candidate.order.filter(Boolean));
        candidate.order=textOrder.map((id,index)=>{
          if(candidate.order[index]) return candidate.order[index];
          if(!id||used.has(id)) return null;
          used.add(id);
          return id;
        });
      }
      if(overviewFile) {
        onStage?.('辨認使用的英雄…');
        heroes=await readHeroText(overviewFile.image,best().side,names,findHeroes());
      }
    } catch(error) {
      console.warn('Name or hero OCR did not complete',error);
    } finally {
      await names?.terminate();
    }
  }
  const {side,order,found}=best();
  const sideReview=order.filter(Boolean).length<5;
  const available=players.map(player=>player.id).filter(id=>!order.includes(id));
  const ordered=Array.from({length:5},(_,index)=>order[index] || available.shift());
  const readings=[];
  let numbers;
  const getWorker=async()=>numbers ??= await workerFor('eng');
  const model=await loadDigits().catch(()=>null);
  onStage?.('載入數字辨識…');
  try {
    const handled=new Set();
    for(const {file,image,kind} of usable) {
      if(handled.has(kind)) continue;
      handled.add(kind);
      onStage?.(`讀取${{overview:'總覽',stats:'數據',team:'團隊'}[kind]}…`);
      const reading=await readNumbers(getWorker,image,kind,side,model);
      const header=kind==='overview' ? await readOverviewHeader(getWorker,image,side,model) : {};
      if(kind==='overview') for(const [index,hero] of heroes.entries()) if(hero) reading.rows[index].hero=hero;
      readings.push({...reading,...header,file,kind,ordered});
    }
  } finally {
    await numbers?.terminate();
  }
  return {inspected:inspected.map(({file,kind})=>({file,kind})),readings,side,sideReview,found};
}
