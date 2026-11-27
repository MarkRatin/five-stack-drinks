const logo = new URL('./astrolabe-logo.png', import.meta.url).href;
const pointer = new URL('./astrolabe-pointer.png', import.meta.url).href;
const colors={skill:'#88453d', fun:'#355777', chaos:'#252630'};

export function renderAstrolabe() {
  return `<div class="astrolabe">
    <div class="astro-rim" aria-hidden="true"></div>
    <div class="astro-dial" aria-hidden="true">
      <div class="astro-band"></div>
      <div class="astro-chart"><i></i><i></i><i></i><i></i></div>
    </div>
    <img class="astro-index" src="${pointer}" alt="" draggable="false">
    <button type="button" class="astro-hub" aria-label="按下盤心轉動占星盤">
      <img class="astro-logo" src="${logo}" alt="" draggable="false">
    </button>
  </div>`;
}

export function paintAstrolabe(wheel, cards, selectedIndex=-1) {
  const step=360/cards.length;
  const slices=cards.map((card,i)=>{
    const end=(i+1)*step;
    const color=i===selectedIndex?'#f6d690':colors[card.category];
    return `${color} ${i*step}deg ${end-.27}deg, #c69f6f55 ${end-.27}deg ${end}deg`;
  });
  wheel.querySelector('.astro-band').style.setProperty('--slices',`conic-gradient(${slices.join(',')})`);
}

export function spinAstrolabe(wheel, index, count, duration) {
  const angle=(index+.5)*360/count;
  return wheel.querySelector('.astro-dial').animate([
    {transform:'rotate(0deg)'},
    {transform:`rotate(${3600-angle}deg)`},
  ],{duration,fill:'forwards',easing:'cubic-bezier(.11,.62,.12,1)'});
}
