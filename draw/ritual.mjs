import {categoryNames} from '../rules.mjs?v=reversal-20';
import {tarotArt} from '../tarot.mjs?v=empty-promise';
import {renderAstrolabe, paintAstrolabe, spinAstrolabe} from './astrolabe.mjs';
import {shuffleMoves, shuffleDeck, dealCard, dealDuration} from './dealer.mjs';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pick = items => items[Math.floor(Math.random() * items.length)];

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

let closeCurrentDraw;
let leaveCurrentDraw;
export function closeDrawAnimation() {
  leaveCurrentDraw?.();
}

function openDraw() {
  const dialog = document.createElement('dialog');
  dialog.className = 'draw-ritual';
  dialog.setAttribute('aria-labelledby', 'draw-ritual-title');
  dialog.innerHTML = `<div class="draw-ritual-header">
    <span class="draw-ritual-step"></span>
    <button type="button" class="draw-ritual-close">關閉抽牌桌</button>
  </div>
  <div class="theater"><div class="ambient" aria-hidden="true"></div><div class="draw-ritual-display"></div></div>
  <div class="draw-ritual-copy" aria-live="polite">
    <h2 id="draw-ritual-title"></h2><p></p>
  </div>
  <div class="draw-ritual-actions"><button type="button" class="draw-ritual-next" autofocus></button></div>`;
  const display = dialog.querySelector('.draw-ritual-display');
  const step = dialog.querySelector('.draw-ritual-step');
  const title = dialog.querySelector('h2');
  const description = dialog.querySelector('p');
  const action = dialog.querySelector('.draw-ritual-next');
  let timer;
  const close = () => {
    clearTimeout(timer);
    dialog.close();
    dialog.remove();
    closeCurrentDraw = null;
    leaveCurrentDraw = null;
  };
  function update(heading, copy, label, activate) {
    title.textContent = heading;
    description.textContent = copy;
    action.textContent = label;
    action.disabled = !activate;
    action.onclick = activate ?? null;
    if (activate && dialog.open) action.focus({preventScroll:true});
  }
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeCurrentDraw?.();
  });
  dialog.querySelector('.draw-ritual-close').onclick = () => closeCurrentDraw?.();
  document.body.append(dialog);
  closeCurrentDraw = close;
  leaveCurrentDraw = close;
  return {dialog, display, step, update, close, wait: (callback, delay) => { timer = setTimeout(callback, delay); }};
}

export function animateScoreDraw(pool, select, complete) {
  if (!pool.length) return;
  const {dialog, display, step, update, close, wait} = openDraw();
  const wheel = shuffled(pool);
  const legend = Object.entries(categoryNames).map(([category, name]) => {
    const count = wheel.filter(card => card.category === category).length;
    return count ? `<span data-wheel-category="${category}"><i class="legend-dot ${category}" aria-hidden="true"></i>${name} <b>${count}</b> 張</span>` : '';
  }).join('');
  display.innerHTML = `<div class="wheel-group">${renderAstrolabe()}<div class="wheel-legend">${legend}</div></div>`;
  paintAstrolabe(display, wheel);
  step.textContent = '第一幕 · 牌系';
  const hub = display.querySelector('.astro-hub');

  function spin() {
    const selected = select();
    const index = wheel.findIndex(card => card.id === selected.id);
    hub.disabled = true;
    update('占星盤正在旋轉', '等黃銅指針指向牌系。', '轉動中…');
    const duration = reducedMotion.matches ? 0 : 4800;
    spinAstrolabe(display, index, wheel.length, duration);
    wait(() => {
      paintAstrolabe(display, wheel, index);
      display.querySelector(`[data-wheel-category="${selected.category}"]`).classList.add('wheel-selected');
      update(`抽中${categoryNames[selected.category]}`, '準備好後，前往第二幕抽計分卡。', '前往計分卡', () => {
        step.textContent = '第二幕 · 計分卡';
        const finish = () => {
          close();
          complete(selected);
        };
        prepareSlot(display, selected, wheel, update, wait, () => {
          closeCurrentDraw = finish;
          dialog.querySelector('.draw-ritual-close').textContent = '查看結果';
        }, finish);
      });
    }, duration);
  }

  hub.onclick = spin;
  update('占星盤會停在哪一格？', '按下盤心封蠟，轉動占星盤。', '轉動占星盤', spin);
  dialog.showModal();
}

const slotDurations = [3480, 4260, 5000];

function prepareSlot(display, selected, wheel, update, wait, onReveal, complete) {
  const decoys = wheel.filter(card => card.category === selected.category && card.id !== selected.id);
  const pool = decoys.length ? decoys : [selected];
  const reels = slotDurations.map((duration, column) => {
    const travel = 18 + column * 3;
    const symbols = [...Array.from({length:travel}, () => pick(pool)), selected, pick(pool)];
    return `<div class="slot-window" style="--spin-time:${duration}ms;--stop-row:${travel}">
      <div class="slot-strip">${symbols.map((item, index) => `<div class="tarot-frame tarot-${item.category} slot-symbol"${index === travel ? ' data-match' : ''}>${tarotArt(item.id)}<span class="slot-name">${item.name}</span></div>`).join('')}</div>
    </div>`;
  }).join('');
  display.innerHTML = `<div class="slot-layout">
    <div class="slot-table" aria-hidden="true">
      <div class="slot-label">${categoryNames[selected.category]}</div>
      <div class="slot-reels">${reels}</div>
    </div>
    <button class="slot-lever" type="button" aria-label="往下拉封蠟拉繩，啟動拉霸">
      <span class="slot-lever-anchor"></span><span class="slot-lever-cord"></span>
      <span class="slot-lever-handle"></span><span class="slot-lever-arrow"></span>
    </button>
  </div>`;
  const layout = display.firstElementChild;
  const table = layout.querySelector('.slot-table');
  const lever = layout.querySelector('.slot-lever');
  function reveal() {
    layout.classList.remove('slot-pulling');
    lever.style.removeProperty('--lever-pull');
    table.classList.add('slot-won');
    table.querySelector('.slot-label').textContent = '三張同牌';
    onReveal();
    update(selected.name, selected.rule, '查看本局積分', complete);
  }
  function spin() {
    if (lever.disabled) return;
    lever.disabled = true;
    layout.classList.add('slot-pulling');
    update('哪張牌會三張連線？', '三列依序停下，看中線上的牌。', '滾動中…');
    if (reducedMotion.matches) {
      reveal();
      return;
    }
    table.classList.add('slot-spinning');
    for (const strip of table.querySelectorAll('.slot-strip')) {
      strip.addEventListener('animationend', () => {
        strip.closest('.slot-window').classList.add('slot-stopped');
      }, {once:true});
    }
    wait(reveal, Math.max(...slotDurations) + 120);
  }
  bindSlotLever(lever, spin);
  update(`這次抽中${categoryNames[selected.category]}`, '往下拉右側封蠟，等中線三張同牌揭曉結果。', '啟動拉霸', spin);
}

function bindSlotLever(lever, spin) {
  let pointer = null;
  let startY = 0;
  let moved = false;
  let suppressClick = false;

  lever.addEventListener('pointerdown', event => {
    if (lever.disabled || !event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId;
    startY = event.clientY;
    moved = false;
    suppressClick = false;
    lever.setPointerCapture(pointer);
  });
  lever.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    const distance = event.clientY - startY;
    moved ||= Math.abs(distance) > 7;
    if (!moved) return;
    lever.classList.add('slot-lever-dragging');
    lever.style.setProperty('--lever-pull', `${Math.max(0, Math.min(58, distance))}px`);
  });
  function endPull(event) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    const distance = event.clientY - startY;
    suppressClick = moved || Math.abs(distance) > 7 || event.type !== 'pointerup';
    lever.classList.remove('slot-lever-dragging');
    if (event.type === 'pointerup' && distance >= 40) spin();
    else lever.style.removeProperty('--lever-pull');
  }
  lever.addEventListener('pointerup', endPull);
  lever.addEventListener('pointercancel', endPull);
  lever.addEventListener('lostpointercapture', endPull);
  lever.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      return;
    }
    spin();
  });
}

export function animateReversalDraw(draw, complete) {
  const {dialog, display, step, update, close, wait} = openDraw();
  step.textContent = '第三幕 · 反轉';
  dialog.querySelector('.draw-ritual-close').textContent = '查看結果';
  const reversal = draw();
  const finish = () => {
    close();
    complete(reversal);
  };
  closeCurrentDraw = finish;
  const face = reversal
    ? `<div class="tarot-frame tarot-reversal draw-ritual-card">${tarotArt(reversal.id)}<div class="tarot-caption"><strong>${reversal.name}</strong></div></div>`
    : '<div class="draw-ritual-card reversal-blank"><strong>命運平靜</strong><span>這次沒有反轉</span></div>';
  function reveal() {
    display.innerHTML = face;
    update(reversal?.name ?? '這次沒有觸發反轉', reversal?.description ?? '保留計分卡的當局結果。', '返回結算', finish);
  }
  dialog.showModal();
  if (reducedMotion.matches) {
    reveal();
    return;
  }
  const moves = shuffled(shuffleMoves).slice(0, 2);
  const packets = Array.from({length:10}, (_, i) => `<div class="poker-back riffle-card" style="--layer:${i}"></div>`).join('');
  display.innerHTML = `<div class="reversal-dealer" style="--deal-time:${dealDuration}ms" aria-hidden="true">
    ${packets}
    <div class="dealer-hand dealer-left"><div class="dealer-pose"></div></div>
    <div class="dealer-hand dealer-right"><div class="dealer-pose"></div></div>
    <div class="riffle-deal"><div class="riffle-flip">
      <div class="poker-back riffle-back"></div><div class="riffle-front">${face}</div>
    </div></div>
  </div>`;
  const scene = display.firstElementChild;
  function playMove(index) {
    const move = moves[index];
    update(move.name, index === 0 ? `第一種洗法，接著是${moves[1].name}。` : '第二種洗法，接著發出一張牌。', '洗牌中…');
    shuffleDeck(scene, move, index === 0);
    wait(() => {
      if (index === 0) {
        playMove(1);
      } else {
        update('發出一張牌', '翻面揭曉這次的反轉結果。', '翻牌中…');
        dealCard(scene);
        wait(reveal, dealDuration);
      }
    }, move.duration);
  }
  playMove(0);
  dialog.querySelector('.draw-ritual-close').focus({preventScroll:true});
}
