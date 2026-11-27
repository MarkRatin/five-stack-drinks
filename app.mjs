import {players, fields, groups, groupNames, categoryNames, cards, reversals, dateInTaipei, fmt, eligibleCards,
  availableCards, drawRound, drawReversal, rerollPool, scoringRows, cardDetails, settle, recordedResults, dailyTotals, settleDay, blankMatch, sample, backfillKnownHeroes, participationRate, expectedKills, scoringVersion} from './rules.mjs?v=chaos-deck';
import {recognizeBatch} from './ocr.mjs?v=played-heroes';
import {tarotArt} from './tarot.mjs?v=chaos-deck';
import {animateScoreDraw, animateReversalDraw, closeDrawAnimation} from './draw/ritual.mjs?v=chaos-deck';

const icons = {
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  photo:'<rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="9" r="1.4"/><path d="m5 17 4-4 3 2 4-5 4 5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  cards:'<rect x="7" y="3" width="12" height="17" rx="2"/><path d="m16 20-9.3 1.3a2 2 0 0 1-2.3-1.7L2.8 8.4a2 2 0 0 1 1.6-2.3L7 5.7M13 7v8m-4-4h8"/>',
  cup:'<path d="M5 8h15l-2 12H8L5 8Zm8 0 2-5h4M7 13h11"/>',
  book:'<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 1 1 0-4h12V6M5 18V6a2 2 0 0 1 2-2m2 4h6m-6 4h5"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root = document.querySelector('#view');
const live = document.querySelector('#announce');
const key = 'five-stack-demo-v1';
const emptyStore = () => ({rounds:[],drawn:{},tiebreak:{},activeId:null});
let state = emptyStore();
let storageIssue = '';
try { const raw = localStorage.getItem(key); if(raw) state = {...state,...JSON.parse(raw)}; }
catch { storageIssue='瀏覽器儲存暫時無法讀取。請避免關閉頁面，以免試玩紀錄遺失。'; }
function persist() {
  try { localStorage.setItem(key,JSON.stringify(state)); }
  catch { storageIssue='瀏覽器無法保存這次試玩紀錄。本頁仍可使用，關閉後可能遺失。'; }
}
let heroMetadataMigrated=false;
for(const round of state.rounds) if(backfillKnownHeroes(round.match)) heroMetadataMigrated=true;
if(heroMetadataMigrated) persist();
const storedMatch = state.rounds.find(round=>round.id===state.activeId)?.match;
let match = storedMatch ? structuredClone(storedMatch) : null;
let activeId = state.activeId;
let historyDate = [...new Set(state.rounds.filter(round=>round.saved).map(round=>round.match.date))].sort().at(-1) || dateInTaipei();
let historyStatsGroup = 'overview';
let historyDraft = null;
let historyMessage = '';
const additionalScores = {play:null,history:null};
let deckFilter = 'all';
let matchStatsGroup = 'overview';
let uploads = [];
let status = '';
let tone = '';
let stage = '';
let busy = false;
let review = Boolean(activeId);
let edit = Boolean(activeId && !state.rounds.find(round=>round.id===activeId)?.saved);
let overviewOnly = false;
let sideOverride = null;
let rosterReview = false;
let uncertain = new Set();

const activeRound = () => state.rounds.find(item => item.id === activeId);
const savedOn = date => state.rounds.filter(round=>round.saved&&round.match.date===date);
const matchId = round => round?.matchId ?? round?.id;
const matchScores = round => state.rounds.filter(item=>item.saved&&matchId(item)===matchId(round));
const boardKey = (date,example) => example ? 'example-'+date : date;
const boardRounds = (date,example) => savedOn(date).filter(round=>round.match.example===example);
const signed = () => match && validMatch(match);
const route = () => {
  const view = location.hash.slice(1).split('?')[0];
  return ['history','deck'].includes(view) ? view : 'play';
};
const historyQuery = () => new URLSearchParams(location.hash.split('?')[1]);
const historyHref = (date, id) => {
  const params = new URLSearchParams({date});
  if(id) params.set('round',id);
  return `#history?${params}`;
};
const viewedRound = () => {
  if(route()!=='history') return null;
  const id=historyQuery().get('round');
  return savedOn(historyDate).find(round=>round.id===id);
};
const pendingInPlay = round => {
  const active=activeRound();
  return matchId(active)===matchId(round) && (edit || Boolean(active?.rerollId) || Boolean(additionalScores.play));
};
const announce = text => { live.textContent=text; };
const today = () => dateInTaipei();
const day = () => match?.date || today();
const show = value => String(value).replaceAll('-',' / ');
const panelHead = (title,body='') => `<div class="panel-head"><div><h2>${title}</h2>${body?`<p>${body}</p>`:''}</div></div>`;
const button = (text,act,style='secondary',extra='') => `<button type="button" class="btn ${style}" data-action="${act}" ${extra}>${text}</button>`;
const notice = () => status ? `<p class="notice ${tone}" role="status">${esc(status)}</p>` : '';
function updateStatus(text, good=false) { status=text; tone=good?'good':''; announce(text); }
function syncActive(id) { activeId=id; state.activeId=id; }
const roundCardId = round => round?.rerollId || round?.cardId;
const roundScoring=round=>round.rerollId ? round.rerollVersion ?? 1 : round.scoringVersion ?? 1;
const reversalRevealed=round=>round.rerollId ? (round.rerollRevealed ?? round.revealed) : round.revealed;
const roundReversal = round => round.reversalSnapshot ?? reversals.find(item=>item.id===round.reversalId);
function selectedReversal(round) {
  // A pending reroll saved before this feature still uses its original reversal.
  if(round.rerollId && Object.hasOwn(round,'rerollReversalId')) {
    return reversals.find(item=>item.id===round.rerollReversalId);
  }
  return roundReversal(round);
}
function activeCard() {
  const round=activeRound();
  if(!round) return null;
  return round.rerollId ? cardDetails(round.rerollId,roundScoring(round)) : round.cardSnapshot ?? cardDetails(round.cardId,roundScoring(round));
}
const selectedRollCallStart = round => round.rerollId ? round.rerollCallStart : round.rollCallStart;
function calculate(round,currentMatch) {
  const reversal=selectedReversal(round);
  return settle(currentMatch,roundCardId(round),reversal?.id,reversal,roundScoring(round),selectedRollCallStart(round));
}
const eligibleForRound = round => eligibleCards(match, round.overviewOnly ?? false);

function matchSignature(value) {
  if(value.example) return 'example-2026-11-25';
  if(value.date && value.time && Number.isInteger(value.teamKills)) return `${value.date}T${value.time}:${value.teamKills}`;
  return '';
}

function validMatch(value) {
  const base = groups.overview.every(key=>value.rows.every(row=>Number.isFinite(row[key])&&row[key]>=0));
  const selected = scoringRows(value);
  const completeRoster = [4,5].includes(selected.length) &&
    new Set(selected.map(row=>row.id)).size === selected.length;
  const teamKills = value.rows.reduce((sum,row)=>sum+(row.kills || 0),0);
  return base && completeRoster && /^\d{4}-\d\d-\d\d$/.test(value.date) &&
    Number.isInteger(value.teamKills) && value.teamKills===teamKills &&
    value.rows.every(row=>row.kills+row.assists<=teamKills && row.rating<=20);
}
function issues(current = match) {
  if(!current) return '';
  if(!current.date) return '請確認對局日期。';
  if(![4,5].includes(scoringRows(current).length)) return '請勾選本局參與計分的四位或五位玩家。';
  if(new Set(scoringRows(current).map(row=>row.id)).size!==scoringRows(current).length) return '參與計分的玩家不能重複。';
  if(!groups.overview.every(key=>current.rows.every(row=>Number.isFinite(row[key])&&row[key]>=0))) return '請補齊五位玩家的總覽數字。';
  const sum = current.rows.reduce((total,row)=>total+row.kills,0);
  if(!Number.isInteger(current.teamKills)||sum!==current.teamKills) return `五人擊殺合計 ${sum}，請與畫面上的全隊擊殺核對。`;
  if(current.rows.some(row=>row.kills+row.assists>sum||row.rating>20)) return '請核對評分和擊殺／助攻。';
  return '';
}

function scorePanel(date, example=Boolean(match?.example)) {
  const games=boardRounds(date,example);
  const matches=new Set(games.map(matchId)).size;
  const count=`${matches} 局${games.length>matches?` · ${games.length} 筆計分`:''}`;
  const ranking=dailyTotals(games,date);
  const scoreKey=boardKey(date,example);
  const last=ranking.length ? ranking.filter(p=>p.total===ranking.at(-1).total) : [];
  const agreed=last.find(row=>row.id===state.tiebreak[scoreKey]);
  const current=date===today();
  const summary=!ranking.length?'入帳後，這裡會更新當日成員的累積分。'
    : last.length>1 && !agreed ? '並列墊底 · 待加賽'
      : `${current?'目前飲料贊助商':'飲料贊助商'} · ${(agreed || last[0]).name}`;
  const rows=ranking.length?ranking:(match?.date===date ? scoringRows(match) : players);
  return `<section class="panel" aria-labelledby="score-heading">
    <div class="score-head"><div class="panel-head"><div><h2 id="score-heading">${example?'範例排行榜':current?'今日排行榜':'當日排行榜'}</h2><p>已入帳 ${count}${example?' · 試玩範例':''}</p></div><span class="score-date">${esc(show(date))}</span></div></div>
    <ol class="score-list">${rows.map((p,i)=>`<li><span class="rank">${ranking.length ? 1+rows.filter(row=>row.total>p.total).length : String(i+1).padStart(2,'0')}</span><span class="initial ${p.color}" aria-hidden="true">${esc(p.name[0])}</span><span class="score-label">${esc(p.name)}</span><span class="points">${ranking.length?fmt(p.total):'—'}</span></li>`).join('')}</ol>
    <div class="score-note">${icon('cup')}${esc(summary)}</div>
    ${last.length>1?`<div class="pad"><label class="field">加賽後請客的人<select data-tie-date="${esc(scoreKey)}"><option value="">待加賽</option>${last.map(row=>`<option value="${row.id}" ${agreed?.id===row.id?'selected':''}>${esc(row.name)}</option>`).join('')}</select></label></div>`:''}</section>`;
}
const statViews = {
  overview:[['K／D／A',row=>[row.kills,row.deaths,row.assists].every(Number.isFinite)?[row.kills,row.deaths,row.assists].join('/'):null],
    ['評分',row=>Number.isFinite(row.rating)?row.rating.toFixed(1):null],['經濟',row=>row.gold]],
  stats:[['輸出',row=>row.damage],['承傷',row=>row.taken],['參團率',(row,current)=>{
    const rate=participationRate(row,current);
    return rate===null ? null : `${fmt(Math.round(rate*10)/10)}%`;
  }]],
  team:[['控制',row=>row.control],['治療',row=>row.heal],['塔傷',row=>row.tower]]
};
const showStat = value => typeof value==='string' ? value : fmt(value);

function matchStatsPanel(current=match, group=matchStatsGroup, historical=false) {
  const title=`<div class="panel-head match-stats-head"><h2 id="match-stats-title">${historical?'五人戰績':'本局戰績'}</h2>`+
    (current?.time&&!historical?`<span class="score-date">${esc(current.time)}</span>`:'')+'</div>';
  if(!current) return `<section id="match-stats" class="panel match-stats" aria-labelledby="match-stats-title">${title}<p class="match-stats-empty">上傳截圖後可查看五人的本局數據。</p></section>`;
  const metrics=statViews[group];
  const readouts=current.rows.map(row=>({row,values:metrics.map(([,measure])=>measure(row,current))}));
  const hasValues=readouts.some(({values})=>values.some(value=>typeof value==='string'||Number.isFinite(value)));
  return `<section id="match-stats" class="panel match-stats" aria-labelledby="match-stats-title">
    ${title}
    <div class="filter match-stats-tabs" role="group" aria-label="戰績資料分類">
      ${Object.entries(groupNames).map(([id,label])=>button(label,'match-stats-view',id===group?'secondary selected':'secondary',`data-stats-group="${id}" aria-pressed="${id===group}"`)).join('')}
    </div>
    ${hasValues ? `<table aria-label="${groupNames[group]}戰績">
      <thead><tr><th scope="col">玩家</th>${metrics.map(([label])=>`<th scope="col">${label}</th>`).join('')}</tr></thead>
      <tbody>${readouts.map(({row,values})=>`<tr><th scope="row"><span class="match-stats-name">${esc(current.scoringIds && !current.scoringIds.includes(row.id) ? '非計分玩家' : row.name)}</span>${row.hero?`<span class="played-hero">${esc(row.hero)}</span>`:''}</th>${values.map(value=>`<td>${esc(showStat(value))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>` : `<p class="match-stats-empty">這局尚未記錄${groupNames[group]}資料。</p>`}
  </section>`;
}
function header(title,subtitle,meta='') {
  return `<div class="hero"><div><h1 id="view-title" tabindex="-1">${title}</h1><p>${subtitle}</p></div>${meta}</div>`;
}
function getSlot(group) {
  return uploads.find(file=>file.kind===group && file.read) || uploads.find(file=>file.kind===group);
}
function uploadPanel() {
  const sampleMode=match?.example;
  return `<section class="panel pad" aria-labelledby="upload-h">
    <div class="panel-head"><div><h2 id="upload-h">上傳本局戰績</h2><p>從相簿或檔案一次選取同一局的三張截圖。</p></div></div>
    <div id="drop" class="drop"><span class="drop-pict">${icon('upload')}</span>
      <div class="drop-copy"><strong>放入戰績截圖</strong><p>支援多選或拖曳 PNG、JPG、WebP</p></div>
      ${button('選擇截圖','pick','primary', busy?'disabled':'')}
      <input id="photos" aria-label="選擇戰績截圖" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" multiple hidden>
    </div>
    <div class="slots">${Object.entries(groupNames).map(([group,name])=>{
      const file=getSlot(group);
      const ready=sampleMode || file?.read;
      return `<div class="slot ${ready?'done':''}">${icon(ready?'check':'photo')}<span><strong>${name}</strong><small>${sampleMode?'範例已載入':file?.read?'已讀取':file?'等候辨識':'待上傳'}</small></span></div>`;
    }).join('')}</div>
    ${busy?`<div class="progress" role="status"><span>${esc(stage)}</span><progress aria-label="辨識截圖中"></progress></div>`:''}
    ${uploads.filter(file=>file.manual).map(item=>`<label class="field" style="margin-top:10px">指定圖別 · ${esc(item.file.name)}<select data-kind="${esc(item.file.name)}"><option value="">選擇畫面</option>${Object.entries(groupNames).map(([id,label])=>`<option value="${id}" ${item.override===id?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}
    ${notice()}
    <div class="actions tail">${button(`${icon('cards')} 載入試玩範例`,'sample','soft',busy?'disabled':'')}
    ${!busy&&uploads.length ? button('重新辨識','retry') : ''}
    ${!busy&&!match&&!uploads.length ? button('手動輸入','manual','soft') : ''}
    </div>
  </section>`;
}
function modeCount() { return match ? eligibleCards(match,overviewOnly).length : 0; }
function lastHitMetric(result,player,current) {
  if(!player || !Number.isFinite(result.value)) return '零擊殺';
  const baseline=expectedKills(player,current.rows,current);
  const difference=`${result.value>0?'+':''}${fmt(result.value)} 顆`;
  return baseline===null ? difference : `${difference}<small class="metric-baseline">${fmt(player.kills)} 殺 · 預估 ${fmt(baseline)}</small>`;
}
function reversalText(reversal, currentMatch) {
  if (!reversal || scoringRows(currentMatch).length !== 4) return reversal?.description;
  const descriptions = {
    chosen:'當局原始第 3 名拿下當局最高分，其餘依序得 1／3／2 分。',
    reverse:'當局四人的積分順序倒過來，依序得 1／2／3／4 分。',
    swap:'當局第 1 名與第 4 名交換分數，其餘照原分。',
    'team-double':'四人的當局基本分都乘以 2。',
    'small-comeback':'當局最後一名加 2 分，倒數第二名加 1 分。',
    'big-comeback':'當日總榜最後一名加 3 分，倒數第二名加 2 分。',
    'empty-promise':'這次計分四人都得 0 分。'
  };
  return descriptions[reversal.id] ?? reversal.description;
}
function reversalNotice(round,reversal,results,currentMatch,preview) {
  if(!reversalRevealed(round)) return '<p class="subtle result-no-reversal">當局基本分已算好，按「抽取反轉卡」揭曉命運。</p>';
  if(!reversal) return `<p class="subtle result-no-reversal">${round.rerollId?'這次重骰':'這次計分'}未觸發反轉。</p>`;

  let bonuses = '';
  if(reversal.dailyBonuses && results.length) {
    const roundIndex = state.rounds.findIndex(item=>item.id===round.id);
    const prior = state.rounds.slice(0,roundIndex===-1?state.rounds.length:roundIndex)
      .filter(item=>item.match.example===Boolean(currentMatch.example));
    const current = {...round, match:currentMatch, results, saved:true, reversalId:reversal.id, reversalSnapshot:reversal};
    const awards = settleDay([...prior,current],currentMatch.date).bonusesByRound.get(round.id) ?? [];
    const label = preview ? '確認入帳時的當日總榜調整' : '當日總榜調整';
    if(awards.length) bonuses = `<p class="reversal-bonuses">${label} · ${awards.map(({name,bonus})=>`${esc(name)} ${bonus>0?'+':''}${fmt(bonus)} 分`).join('、')}</p>`;
  }

  const scope = reversal.dailyBonuses ? '影響當日總榜' : '影響當局積分';
  return `<div class="reversal tarot-reversal tarot-reversal-note">${tarotArt(reversal.id)}<div><p>反轉牌 · <strong>${esc(reversal.name)}</strong><br><strong>${scope}</strong><br>${esc(reversalText(reversal,currentMatch))}</p>${bonuses}</div></div>`;
}
function resultPanel(round,card,currentMatch,results,actions,preview,scoreLabel='') {
    const reversal=selectedReversal(round);
    const displayReversal=reversalRevealed(round)&&reversal;
    const playersById = new Map(currentMatch.rows.map(row=>[row.id,row]));
    const displayCardMetric = row => card.id==='last-hit-share' ? lastHitMetric(row,playersById.get(row.id),currentMatch) : esc(Number.isFinite(row.value)?fmt(row.value)+card.unit:'零擊殺');
    const isReroll=Boolean(round.rerollId);

    return `<section class="panel pad" id="result" aria-labelledby="result-h">
      <div class="result-intro">
        <div class="tarot-frame tarot-${esc(card.category)} result-tarot" data-card-id="${esc(card.id)}">${tarotArt(card.id)}</div>
        <div class="result-intro-copy">
          <span class="subtle">${scoreLabel||(isReroll?'重骰待確認':round.saved?'已入帳':'本局結果')}</span>
          <h2 id="result-h" tabindex="-1">${esc(card.name)}</h2>
          <p class="result-rule">${esc(categoryNames[card.category])} · ${esc(card.rule)}</p>
          ${card.punch?`<p class="subtle">${esc(card.punch)}</p>`:''}
        </div>
      </div>
      ${isReroll&&round.saved?'<p class="notice">確認更新後才會替換已入帳的分數。</p>':''}
      ${currentMatch.rows.some(row=>!row.hero)&&!preview?'<p class="subtle result-no-reversal">這局有未記錄的英雄，可在「更正戰績」補填。</p>':''}
      ${reversalNotice(round,reversal,results,currentMatch,preview)}
      ${results.length ? `<div class="score-result">${results.map(row=>`<div class="result-row"><span class="rank">${row.rank}</span><span class="result-player"><span class="score-label">${esc(row.name)}</span><span class="played-hero">${esc(playersById.get(row.id)?.hero||'未記錄英雄')}</span></span><span class="detail">${displayCardMetric(row)}</span><span class="points">${displayReversal&&row.base!==row.final?`<span class="detail"><del>${fmt(row.base)}</del></span>`:''}${fmt(displayReversal?row.final:row.base)} 分</span></div>`).join('')}</div>`:'<p class="notice">原本抽中的卡需要完整數字，請先更正戰績。</p>'}
      ${actions}
    </section>`;
}
function drawPanel() {
  if(additionalScores.play) return additionalScorePanel(additionalScores.play);
  const round=activeRound();
  const card=activeCard();
  if(card) {
    const isReroll=Boolean(round.rerollId);
    const preview=!round.saved||edit||isReroll;
    const results=preview ? calculate(round,match) : recordedResults(round);
    const canReroll=signed()&&eligibleForRound(round).some(item=>item.id!==card.id);
    const saveLabel=round.saved?(isReroll?'以這張更新本局':'儲存更正'):'確認入帳';
    const saveAction=!reversalRevealed(round) ? button('抽取反轉卡','reveal','primary')
      : (!round.saved||edit||isReroll ? button(saveLabel,'save','primary',!results.length||!signed()?'disabled':'') : '');
    const scoreIndex=round.saved ? matchScores(round).findIndex(item=>item.id===round.id)+1 : 0;
    const actions=`<div class="actions">${saveAction}
      ${round.saved&&!edit&&!isReroll?button('再計分一次','additional-start','primary',busy?'disabled':''):''}
      ${button('再骰一張','reroll','secondary',!canReroll||busy?'disabled':'')}
      ${isReroll?button('回到原本那張','cancel-reroll','soft'):''}
      ${round.saved&&!isReroll?button('登記下一局','next','secondary'):''}
      ${!edit?button('更正戰績','edit','soft'):''}</div>
      <p class="subtle">重骰可替換這筆計分，反轉機率每次都是 20%。</p>`;
    return resultPanel(round,card,match,results,actions,preview,scoreIndex&&!preview?`第 ${scoreIndex} 次計分 · 已入帳`:'');
  }
  const count=modeCount();
  const drawn=state.drawn[boardKey(day(),Boolean(match?.example))] || [];
  const countLeft=signed()?availableCards(eligibleCards(match,overviewOnly),drawn).available.length:0;
  return `<section class="panel draw-panel" aria-labelledby="draw-h">
    <div><h2 id="draw-h">翻開命運牌</h2><p>${signed() && review ? `本局可用 ${count} 張計分卡，當前可抽 ${countLeft} 張。`:'確認本局戰績後，讓牌決定這場比什麼。'}</p>
    <div class="actions">${button(`${icon('cards')} ${signed()&&review?'翻開本局計分卡':'等待戰績確認'}`,'draw','primary',(!signed()||!review||busy||!count)?'disabled':'')}</div>
    <p class="subtle">五人 5／4／3／2／1 · 四人 4／3／2／1 · 反轉機率 20%</p></div>
    <div class="cardback" aria-hidden="true">${tarotArt('back','back-emblem')}</div>
  </section>`;
}
function additionalScorePanel(round) {
  const cardId=roundCardId(round);
  const card=cardDetails(cardId,roundScoring(round));
  const results=calculate(round,round.match);
  const canReroll=eligibleCards(round.match,round.overviewOnly).some(item=>item.id!==cardId);
  const num=matchScores(round).length+1;
  const actions=`<div class="actions">
    ${!reversalRevealed(round)?button('抽取反轉卡','additional-reveal','primary'):button('確認新增積分','additional-save','primary',results.length?'':'disabled')}
    ${button('再骰一張','additional-reroll','secondary',canReroll?'':'disabled')}
    ${button('取消新增計分','additional-cancel','soft')}
  </div><p class="subtle">確認後，這筆積分會和前面的計分一起算入排行榜。</p>`;
  return resultPanel(round,card,round.match,results,actions,true,`第 ${num} 次計分 · 待確認`);
}
function numberField(label,key,value,bad=false) {
  return `<label class="field">${esc(label)}<input data-field="${esc(key)}" type="number" min="0" step="${key.endsWith('rating')?'0.1':'1'}" inputmode="${key.endsWith('rating')?'decimal':'numeric'}" value="${esc(value??'')}" ${bad?'aria-invalid="true"':''}></label>`;
}
function editor(current=match,historical=false) {
  if(!current || (!historical&&!edit&&review)) return '';
  const okOverview = groups.overview.every(key=>current.rows.every(row=>Number.isFinite(row[key])));
  const groupsToShow = historical || current.showAll || current.example || uploads.some(file=>['stats','team'].includes(file.kind))
    ? Object.keys(fields) : groups.overview;
  const errorText=issues(current);
  const currentCard=historical||activeCard();
  const needsReview=key=>!historical&&uncertain.has(key);
  return `<section class="panel pad" id="review" tabindex="-1">
    ${historical?panelHead('更正這局戰績','儲存後會重新計算這局的積分和當日排行榜。'):panelHead('核對五人戰績', current.example?'試玩範例 · 勾選本局計分成員後確認。':rosterReview?'請確認隊伍、五列玩家順序及本局計分成員，再檢查標出的欄位。':'勾選本局參與計分的四位或五位玩家，並核對全隊數據。')}
    <p class="subtle">未勾選者不參與本局排名；五列數據仍用於全隊占比計算。</p>
    <div class="fixgrid fields-top">
      <label class="field">對局日期<input type="date" data-field="date" value="${esc(current.date)}"></label>
      <label class="field">對局時間<input type="time" data-field="time" value="${esc(current.time)}"></label>
      ${numberField('全隊擊殺','teamKills',current.teamKills,needsReview('teamKills'))}
      ${!historical&&!current.example&&uploads.length?`<label class="field">隊伍<select id="side"><option value="left" ${current.side==='left'?'selected':''}>左隊</option><option value="right" ${current.side==='right'?'selected':''}>右隊</option></select></label>`:''}
    </div>
    ${current.rows.map((row,i)=>{
      const bad=groupsToShow.some(key=>needsReview(`${i}.${key}`)||(!Number.isFinite(row[key])&&groups.overview.includes(key)));
      return `<div><label class="participant-check"><input type="checkbox" data-participant="${i}" ${!current.scoringIds||current.scoringIds.includes(row.id)?'checked':''}> ${esc(row.name)}參與本局計分</label><details class="person" data-player="${i}" ${bad?'open':''}><summary>${esc(row.name)} <span class="played-hero">${esc(row.hero||'未記錄英雄')}</span> <span>${[row.kills,row.deaths,row.assists].every(Number.isFinite)?`${row.kills}／${row.deaths}／${row.assists}`:''}</span></summary>
      ${!historical && rosterReview && current.detectedNames?.[i] ? `<p class="subtle">截圖辨識名稱 · ${esc(current.detectedNames[i])}</p>` : ''}
    <div class="fixgrid"><label class="field">對應玩家<select data-field="${i}.id">${players.map(p=>`<option value="${p.id}" ${row.id===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label class="field">使用英雄<input type="text" data-field="${i}.hero" value="${esc(row.hero||'')}" maxlength="24" placeholder="輸入英雄名稱"></label>${groupsToShow.map(key=>numberField(fields[key],`${i}.${key}`,row[key],needsReview(`${i}.${key}`))).join('')}</div></details></div>`;
    }).join('')}
    <p id="review-error" class="notice" ${errorText?'':'hidden'}>${esc(errorText)}</p>
    <div class="actions">
    ${historical?button('儲存更正','history-save','primary')+button('取消更正','history-cancel','soft'):button(currentCard?'套用更正':'確認戰績','confirm','primary',busy?'disabled':'')}
    ${!currentCard?button('僅用總覽開始','overview-only','secondary',okOverview&&!busy?'':'disabled'):''}
    ${!current.showAll&&groupsToShow.length<10?button('顯示進階數字','extra','soft'):''}
    </div>
  </section>`;
}
function play() {
  const round=activeRound();
  const matchIds=[...new Set(boardRounds(day(),Boolean(match?.example)).map(matchId))];
  const number=matchIds.indexOf(matchId(round))+1 || matchIds.length+1;
  const step=round?.saved&&!edit&&!round.rerollId&&!additionalScores.play?'這局已入帳，可再計分或登記下一局。':'在這裡處理目前這局的戰績和積分。';
  return `${header('本局計分',step,`<div class="hero-meta"><strong>第 ${number} 局</strong>${esc(show(day()))}</div>`)}
    <div class="grid"><div class="stack">
    ${activeRound()?.saved&&!edit ? '' : uploadPanel()}
    ${editor()}
    ${drawPanel()}
    </div><aside class="stack">${scorePanel(day())}
    ${matchStatsPanel()}
    <section class="panel pad rules-inline"><details><summary>計分規則</summary><ul>
    <li>三張圖開完整牌池，也可選擇只用總覽。</li><li>五人依序得 5／4／3／2／1 分，四人依序得 4／3／2／1 分；同分者平分名次積分。</li><li>每次抽牌都有 20% 機率抽到一張反轉卡。影響當日總榜的反轉卡在這筆基本分入帳後生效。</li>
    </ul></details><a class="quick" href="#deck">${icon('book')} 查看 ${cards.length+reversals.length} 張牌的規則</a></section>
    </aside></div>`;
}
function history() {
  const round=viewedRound();
  if(round) return historyDetail(round);
  const dates=[...new Set(state.rounds.filter(item=>item.saved).map(item=>item.match.date))].sort().reverse();
  const rounds=savedOn(historyDate);
  const matches=rounds.filter(item=>!item.matchId);
  return `${header('歷史戰績','按日期查看當日總分、抽到的卡和反轉結果。')}
  <div class="grid"><section class="panel pad">
    ${panelHead('當日對局')}
    <div class="filter">
      <label class="field history-date">日期<input class="filter-date" id="history-date" type="date" value="${esc(historyDate)}"></label>
      ${dates.length? `<label class="field history-date">有紀錄的日期<select id="history-recent"><option value="">選擇已記錄日期</option>${dates.map(date=>`<option value="${date}" ${date===historyDate?'selected':''}>${show(date)}</option>`).join('')}</select></label>`:''}
    </div>
    ${historyQuery().has('round')?'<p class="notice" role="status">找不到這場對局，可從下方重新選擇。</p>':''}
    <div class="history-list">${matches.length?matches.map((round,i)=>{
      const count=matchScores(round).length;
      const card=round.cardSnapshot ?? cardDetails(round.cardId,round.scoringVersion ?? 1);
      const reversal=roundReversal(round);
      return `<div class="history-row"><div><strong>第 ${i+1} 局 · ${count>1?`${count} 筆計分`:esc(card?.name)}</strong><p class="subtle">${esc(round.match.time||'未記時間')}${round.match.example?' · 試玩範例':''}${count===1&&reversal?` · 反轉 ${esc(reversal.name)}`:''}</p></div><a class="btn secondary" href="${historyHref(historyDate,round.id)}" aria-label="查看戰報，第 ${i+1} 局">查看戰報</a></div>`;
    }).join(''):'<p class="empty">這天還沒有已入帳的對局。</p>'}</div>
  </section><aside>${scorePanel(historyDate,rounds.length>0&&rounds.every(round=>round.match.example))}</aside></div>`;
}
function historyDetail(round) {
  const index=[...new Set(savedOn(historyDate).map(matchId))].indexOf(matchId(round))+1;
  const scores=matchScores(round);
  const scoreTabs=scores.length>1?`<div class="filter history-score-tabs" role="group" aria-label="這場的計分紀錄">
    ${scores.map((item,i)=>`<a class="btn secondary${item.id===round.id?' selected':''}" href="${historyHref(historyDate,item.id)}" ${item.id===round.id?'aria-current="page"':''}>第 ${i+1} 次計分</a>`).join('')}
    </div>`:'';
  const draft=historyDraft;
  const isReroll=Boolean(draft?.rerollId);
  const canEdit=!pendingInPlay(round);
  const results=isReroll ? calculate(draft,round.match) : recordedResults(round);
  const card=isReroll ? cardDetails(draft.rerollId,roundScoring(draft)) : round.cardSnapshot ?? cardDetails(round.cardId,round.scoringVersion ?? 1);
  const canReroll=validMatch(round.match)&&eligibleCards(round.match,round.overviewOnly).some(item=>item.id!==card?.id);
  let actions='';
  if(isReroll){
    actions=`<div class="actions">${!reversalRevealed(draft)?button('抽取反轉卡','history-reveal','primary'):button('以這張更新紀錄','history-save','primary',results.length?'':'disabled')}
      ${button('再骰一張','history-reroll','secondary',canReroll?'':'disabled')}${button('取消重骰','history-cancel','soft')}</div>`;
  } else if(!draft&&canEdit){
    actions=`<div class="actions">${button('再計分一次','additional-start','primary',busy?'disabled':'')}${button('再骰一張','history-reroll','secondary',canReroll?'':'disabled')}${button('更正戰績','history-edit','soft')}</div>`;
  } else if(!canEdit){
    actions='<p class="notice">這局在本局有尚未確認的變更。<a href="#play">回本局繼續編修</a></p>';
  }
  if(canEdit&&(!draft||isReroll)) actions+='<p class="subtle">每次重骰都重新判定反轉，機率為 20%。</p>';
  const displayRound={...(isReroll?draft:round),revealed:isReroll?draft.revealed:true,rerollId:isReroll?draft.rerollId:null};
  return `<div class="history-detail-head">
    <a class="btn soft" href="${historyHref(historyDate)}">${icon('back')} 返回當日對局</a>
    ${header(`第 ${index} 局戰報`,`<time datetime="${esc(historyDate)}">${esc(show(historyDate))}</time>${round.match.time?` · ${esc(round.match.time)}`:''}${round.match.example?' · 試玩範例':''}`)}
    </div>
    <div class="grid"><div class="stack">
    ${scoreTabs}
    ${historyMessage?`<p class="notice good" role="status">${esc(historyMessage)}</p>`:''}
    ${draft?.editing?editor(draft.match,true):''}
    ${additionalScores.history?additionalScorePanel(additionalScores.history):card?resultPanel(displayRound,card,round.match,results,actions,isReroll):`<section class="panel pad">${panelHead('計分結果','這場紀錄的計分卡已無法讀取。')}${actions}</section>`}
    </div><aside>${matchStatsPanel(round.match,historyStatsGroup,true)}</aside></div>`;
}
function tarotEntry(item, category) {
  const type=categoryNames[category] ?? '反轉卡';
  const name=esc(item.name);
  const backId=`deck-rule-${esc(item.id)}`;
  const rule = item.rule ?? item.description;
  const fourPoints = {chosen:'1／3／4／2',reverse:'1／2／3／4',swap:'1／3／2／4',
    'team-double':'8／6／4／2','empty-promise':'0／0／0／0','small-comeback':'4／3／3／3'};
  const fourPlayerDailyNote = item.id === 'big-comeback' ? '四人場大翻盤由當日總榜最後兩名獲得加分。' : '';
  const points = item.dailyBonuses
    ? '總榜並列者平分占用名次的加分或扣分。' + fourPlayerDailyNote
    : `${category==='reversal'?'當局原始第 ':'第 '}1 到第 5 名依序得 ${item.points?.join('／') ?? '5／4／3／2／1'} 分。${category==='reversal'&&fourPoints[item.id]?`四人時依序得 ${fourPoints[item.id]} 分。`:category==='reversal'?'':'四人時依序得 4／3／2／1 分。'}並列者平分占用名次的分數。`;
  return `<article class="tarot-entry" aria-label="${esc(type)}">
    <div class="deck-flipper">
      <div class="deck-faces">
        <div class="tarot-frame tarot-${esc(category)} deck-front" data-card-id="${esc(item.id)}">
          ${tarotArt(item.id)}
          <div class="tarot-caption"><h2>${name}</h2></div>
        </div>
        <div class="tarot-frame deck-back tarot-${esc(category)}" id="${backId}" aria-hidden="true">
          <strong class="deck-back-title">${name}</strong>
          ${category==='reversal'?`<span class="reversal-scope">${item.dailyBonuses?'影響當日總榜':'影響當局積分'}</span>`:''}
          ${item.punch?`<p class="deck-back-punch">${esc(item.punch)}</p>`:''}
          <span class="deck-back-label">評分標準</span>
          <p class="deck-back-rule">${esc(rule)}</p>
          <p class="deck-back-points">${points}</p>
        </div>
      </div>
      <button type="button" class="deck-flip-toggle" data-action="flip-card" data-card-name="${name}" aria-expanded="false" aria-controls="${backId}" aria-label="查看${name}的評分標準"></button>
    </div>
  </article>`;
}
function flipDeckCard(button) {
  const flipper=button.closest('.deck-flipper');
  const isFlipped=flipper.classList.toggle('is-flipped');
  flipper.querySelector('.deck-front').setAttribute('aria-hidden',String(isFlipped));
  flipper.querySelector('.deck-back').setAttribute('aria-hidden',String(!isFlipped));
  button.setAttribute('aria-expanded',String(isFlipped));
  button.setAttribute('aria-label',isFlipped?`翻回${button.dataset.cardName}的牌面`:`查看${button.dataset.cardName}的評分標準`);
}
function deck() {
  const options = {all:'全部',...categoryNames, reversal:'反轉卡'};
  const descriptions = {
    skill:'直接比單項表現，像是輸出、承傷或助攻。',
    fun:'把幾項戰績放進公式，算出這場誰最符合卡名。',
    chaos:'看一個戰績數字，比一個好笑的條件。像是誰的經濟末兩碼最接近 88。',
    reversal:'計分後生效，可能改變這局的分數，或調整當日總榜積分。'
  };
  const which=cards.filter(item=>deckFilter==='all'||deckFilter===item.category);
  const possible=deckFilter==='all'||deckFilter==='reversal'?reversals:[];
  const subtitle=descriptions[deckFilter] ?? `${cards.length} 張計分卡，另有 ${reversals.length} 張賽後反轉卡。點牌看梗和評分標準。`;
  return `${header('牌庫',subtitle)}
  <div class="filter" aria-label="牌庫分類">${Object.entries(options).map(([id,label])=>button(label,'filter',deckFilter===id?'secondary selected':'secondary',`data-filter="${id}" aria-pressed="${deckFilter===id}"`)).join('')}</div>
  <section class="deck-grid" aria-label="卡片規則">
  ${which.map(item=>tarotEntry(item,item.category)).join('')}
  ${possible.map(item=>tarotEntry(item,'reversal')).join('')}
  </section>`;
}
function render(focus) {
  const view=route();
  if(view==='history'){
    const date=historyQuery().get('date');
    if(date&&/^\d{4}-\d\d-\d\d$/.test(date)) historyDate=date;
  }
  for(const link of document.querySelectorAll('nav [data-view]')) {
    if(link.dataset.view==='history') link.setAttribute('href',historyHref(historyDate));
    if(link.dataset.view===view) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  }
  root.innerHTML=(storageIssue?`<p class="notice" role="status">${esc(storageIssue)}</p>`:'')+({play,history,deck}[view]());
  if(focus) requestAnimationFrame(()=>document.querySelector(focus)?.focus());
}
function localId() { return typeof crypto.randomUUID==='function' ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint32Array(4))].map(i=>i.toString(16)).join('-'); }

function startNew(renderNow = true) {
  syncActive(null);
  additionalScores.play=null;
  match=null; uploads=[]; status=''; tone=''; uncertain.clear(); overallReset();
  persist();
  if(renderNow) render();
}
function overallReset(){matchStatsGroup='overview';edit=false; review=false; overviewOnly=false; sideOverride=null; rosterReview=false;}
function resumeRound(id) {
  const round=state.rounds.find(item=>item.id===id);
  if(!round) return;
  syncActive(id); persist();
  match=structuredClone(round.match); uploads=[]; uncertain.clear(); status=''; overallReset(); review=true;
  edit=!round.saved;
  render('#result-h');
}
async function runRecognition() {
  if(busy||!uploads.length) return;
  busy=true; stage='準備辨識截圖…'; edit=true; review=false; uncertain.clear(); status=''; rosterReview=false;
  render();
  try {
    const files=uploads.map(item=>item.file);
    const overrides=Object.fromEntries(uploads.filter(item=>item.override).map(item=>[item.file.name,item.override]));
    const data=await recognizeBatch(files,sideOverride,text=>{
      stage=text; const label=document.querySelector('.progress span'); if(label) label.textContent=text; announce(text);
    },overrides);
    const blank=blankMatch();
    blank.date=''; blank.time='';
    blank.side=data.side||'left';
    const reused=activeRound()?.match;
    const next=reused ? structuredClone(reused) : blank;
    next.side=blank.side;
    const anchor=data.readings.find(item=>item.kind==='overview') || data.readings[0];
    if(anchor&&!reused) next.rows=anchor.ordered.map(id=>({...players.find(p=>p.id===id)}));
    const seen=new Set();
    const mismatches=[];
    for(const inspection of data.inspected) {
      const item=uploads.find(slot=>slot.file===inspection.file);
      item.kind=inspection.kind;
      item.manual=!Object.hasOwn(groups,inspection.kind);
      item.read=false;
      if(seen.has(inspection.kind)&&Object.hasOwn(groups,inspection.kind)) item.manual=true;
      seen.add(inspection.kind);
    }
    for(const report of data.readings) {
      const item=uploads.find(slot=>slot.file===report.file);
      if(anchor&&report!==anchor&&report.rows.filter((r,i)=>Number.isFinite(r.rating)&&Number.isFinite(anchor.rows[i].rating)&&r.rating!==anchor.rows[i].rating).length>=2) {
        mismatches.push(groupNames[report.kind]);
        item.manual=true;
        continue;
      }
      if(report.kind==='overview') {
        next.date=report.date||next.date;
        next.time=report.time||next.time;
        next.teamKills=report.teamKills??next.teamKills;
        if(next.teamKills===null && report.rows.every(row=>Number.isInteger(row.kills))) {
          next.teamKills=report.rows.reduce((total,row)=>total+row.kills,0);
          uncertain.add('teamKills');
        }
      }
      for(const [index,numbers] of report.rows.entries()) {
        const id=report.ordered[index];
        const target=next.rows.find(row=>row.id===id);
        if(!target) continue;
        if(report.kind!=='overview'&&Number.isFinite(target.rating)) delete numbers.rating;
        Object.assign(target,numbers);
      }
      for(const [i,field] of report.uncertain) uncertain.add(`${i}.${field}`);
      item.read=true;
    }
    match=next; match.example=false;
    match.detectedNames=data.found || [];
    rosterReview=Boolean(data.sideReview);
    if(mismatches.length) updateStatus(`${mismatches.join('、')}的評分和總覽對不上，請重新選同一局的截圖。`);
    else if(uploads.some(item=>item.manual)) updateStatus('有重複的圖別或辨識不到的頁面。可指定正確圖別後重新辨識。');
    else if(!data.readings.some(item=>item.kind==='overview')) updateStatus('請補傳總覽，或手動填入總覽資料。');
    else if(rosterReview||uncertain.size||issues()) updateStatus('已帶入辨識結果，請核對標示的欄位和五人順序。');
    else if(match.rows.some(row=>!row.hero)) updateStatus('已讀取戰績。未辨識到的英雄，可以展開玩家欄位補填。',true);
    else updateStatus('已讀取戰績，請確認後翻牌。',true);
  } catch(error) {
    console.error(error);
    match ||= blankMatch();
    updateStatus('辨識沒有完成。可重新辨識，或在下方核對區手動補上數字。');
  } finally { busy=false; stage=''; render(); }
}
function receiveFiles(incoming) {
  if(busy||!incoming?.length) return;
  if(match?.example || activeRound()?.saved) startNew(false);
  const incomingImages=[...incoming].filter(file=>/\.(png|jpe?g|webp)$/i.test(file.name)||/^image\/(png|jpeg|webp)$/.test(file.type));
  if(!incomingImages.length) { updateStatus('請選 PNG、JPG 或 WebP 格式的戰績圖。'); render(); return; }
  const incomingKeys=new Set(incomingImages.map(file=>file.name));
  uploads=uploads.filter(item=>!incomingKeys.has(item.file.name));
  for(const file of incomingImages) uploads.push({file});
  if(uploads.length>3) uploads=uploads.slice(-3);
  runRecognition();
}
function confirm(baseOnly) {
  if(!signed()){updateStatus(issues()||'請完成戰績核對。');render();return;}
  const round=activeRound();
  if(round) {
    if(!calculate(round,match).length) {
      updateStatus('請補齊原本抽中這張卡所需的數字。'); render(); return;
    }
    edit=true; review=true;
    updateStatus('已套用更正，請在下方確認入帳。',true);
    render('#result-h'); return;
  }
  const signature=matchSignature(match);
  const existing=signature&&state.rounds.find(item=>item.signature===signature || matchSignature(item.match)===signature);
  if(existing){
    const importedHeroes=new Map(match.rows.map(row=>[row.id,row.hero]));
    for(const row of existing.match.rows) {
      const hero=importedHeroes.get(row.id);
      if(!row.hero&&hero) row.hero=hero;
    }
    resumeRound(existing.id);announce('已開啟同一局的原紀錄。');return;
  }
  overviewOnly=baseOnly; review=true; edit=false;
  updateStatus(baseOnly?'總覽核對完成，可從基本牌池翻牌。':'戰績核對完成，可以翻牌。',true);
  render('[data-action="draw"]');
}
const pickRollCallStart = (cardId, current) => cardId==='roll-call' ? Math.floor(Math.random()*scoringRows(current).length) : undefined;
function draw() {
  if(!review||busy||activeRound()||!signed()) return;
  const date=boardKey(match.date,Boolean(match.example));
  const eligible=eligibleCards(match,overviewOnly);
  const drawn=state.drawn[date]||[];
  const {available}=availableCards(eligible,drawn);
  let result;
  animateScoreDraw(available,()=>{
    result=drawRound(eligible,drawn);
    return available.find(card=>card.id===result.cardId);
  },card=>{
    const id=localId();
    state.drawn[date]=result.drawn;
    state.rounds.push({id,signature:matchSignature(match),match:structuredClone(match),cardId:card.id,rollCallStart:pickRollCallStart(card.id,match),
      reversalId:null,reversalSnapshot:null,scoringVersion,overviewOnly,tried:[card.id],revealed:false,saved:false});
    syncActive(id); persist(); render('#result-h');
  });
}
const pickCard=pool=>pool[Math.floor(Math.random()*pool.length)];
function animateReroll(round,current,complete) {
  const dayKey=boardKey(current.date,Boolean(current.example));
  const tried=round.tried ?? [round.cardId];
  const pool=rerollPool(eligibleCards(current,round.overviewOnly),state.drawn[dayKey]||[],tried,roundCardId(round));
  animateScoreDraw(pool,()=>pickCard(pool),next=>{
    round.rerollId=next.id;
    round.rerollCallStart=pickRollCallStart(next.id,current);
    round.rerollVersion=scoringVersion;
    round.rerollReversalId=null;
    round.rerollRevealed=false;
    round.tried=[...new Set([...tried,next.id])];
    complete();
  });
}
function revealReversal(round,saveDraft=false) {
  if(!round || reversalRevealed(round)) return;
  animateReversalDraw(()=>{
    const id=drawReversal();
    const card=reversals.find(item=>item.id===id) ?? null;
    if(round.rerollId) {
      round.rerollReversalId=id;
      round.rerollRevealed=true;
    } else {
      round.reversalId=id;
      round.reversalSnapshot=card;
      round.revealed=true;
    }
    if(saveDraft) persist();
    return card ? {...card,description:reversalText(card,round.match)} : null;
  },card=>{
    render('#result-h');
    announce(card?'反轉卡已抽出。':'這次沒有觸發反轉卡。');
  });
}
function reroll() {
  const round=activeRound();
  if(!round||busy||!signed()) return;
  animateReroll(round,match,()=>{
    persist(); render('#result-h');
    announce('已重骰計分卡，請按抽取反轉卡。');
  });
}
function clearReroll(round) {
  delete round.rerollId;
  delete round.rerollCallStart;
  delete round.rerollVersion;
  delete round.rerollReversalId;
  delete round.rerollRevealed;
}
const storedResults = results => results.map(row=>({...row,value:Number.isFinite(row.value)?row.value:null}));
function recordDraw(before,after,oldCardId,cardId) {
  if(before!==after) {
    const index=(state.drawn[before]||[]).lastIndexOf(oldCardId);
    if(index>=0) state.drawn[before].splice(index,1);
  }
  state.drawn[after]=[...new Set([...(state.drawn[after]||[]),cardId])];
}
function commitRound(round,current,selection=round) {
  if(!reversalRevealed(selection)) return false;
  const results=calculate(selection,current);
  if(!results.length) return false;
  const matchChanged=round.saved&&JSON.stringify(round.match)!==JSON.stringify(current);
  const linkedScores=matchChanged ? matchScores(round).filter(item=>item.id!==round.id) : [];
  const linkedResults=linkedScores.map(item=>settle(current,item.cardId,item.reversalId,roundReversal(item),item.scoringVersion ?? 1,item.rollCallStart));
  if(linkedResults.some(result=>!result.length)) return false;

  const before=boardKey(round.match.date,Boolean(round.match.example));
  const after=boardKey(current.date,Boolean(current.example));
  const cardId=roundCardId(selection);
  const reversal=selectedReversal(selection);
  recordDraw(before,after,round.cardId,cardId);
  delete state.tiebreak[after];
  if(round.saved) delete state.tiebreak[before];
  for(const [index,item] of linkedScores.entries()) {
    recordDraw(before,after,item.cardId,item.cardId);
    item.match=structuredClone(current);
    item.results=storedResults(linkedResults[index]);
  }
  round.signature ||= matchSignature(current);
  round.match=structuredClone(current);
  round.cardId=cardId;
  round.rollCallStart=selectedRollCallStart(selection);
  round.scoringVersion=roundScoring(selection);
  round.cardSnapshot=cardDetails(cardId,round.scoringVersion);
  round.reversalId=reversal?.id ?? null;
  round.reversalSnapshot=reversal;
  round.results=storedResults(results);
  round.tried=selection.tried;
  clearReroll(round);
  round.revealed=true;
  round.saved=true;
  return true;
}
function save() {
  const round=activeRound();
  if(!round||!reversalRevealed(round)||!signed()) return;
  const updated=round.saved;
  if(!commitRound(round,match)){
    const message=document.querySelector('#review-error');
    if(message){
      message.textContent='請補齊這場各筆計分使用的戰績數字。';
      message.hidden=false;
      message.scrollIntoView({block:'nearest'});
    }
    announce('請補齊這場各筆計分使用的戰績數字。');
    return;
  }
  historyDate=match.date;
  edit=false; review=true;
  persist(); render('#result-h'); announce(updated?'本局分數已更新。':'本局已入帳。');
}
function sourceOfAdditionalScore() {
  const view=route();
  if(view==='history') return viewedRound();
  if(view==='play') return activeRound();
}
function startAdditionalScore() {
  const view=route();
  const source=sourceOfAdditionalScore();
  if(!source?.saved||busy||additionalScores[view]||pendingInPlay(source)||historyDraft||!validMatch(source.match)) return;
  const tried=matchScores(source).map(item=>item.cardId);
  const key=boardKey(source.match.date,Boolean(source.match.example));
  const eligible=eligibleCards(source.match,source.overviewOnly);
  const alternatives=rerollPool(eligible,state.drawn[key]||[],tried,source.cardId);
  const pool=alternatives.length?alternatives:eligible;
  animateScoreDraw(pool,()=>pickCard(pool),card=>{
    additionalScores[view]={
      id:localId(),matchId:matchId(source),match:structuredClone(source.match),cardId:card.id,
      rollCallStart:pickRollCallStart(card.id,source.match),
      reversalId:null,reversalSnapshot:null,scoringVersion,
      overviewOnly:source.overviewOnly,tried:[...new Set([...tried,card.id])],revealed:false,saved:false
    };
    historyMessage='';
    render('#result-h');
    announce('已抽出本次計分的卡片，確認後會新增一筆積分。');
  });
}
function saveAdditionalScore() {
  const view=route();
  const round=additionalScores[view];
  const source=sourceOfAdditionalScore();
  if(!round||!source?.saved||round.matchId!==matchId(source)||!commitRound(round,round.match)) return;
  state.rounds.push(round);
  additionalScores[view]=null;
  historyDate=round.match.date;
  if(view==='history'){
    window.history.replaceState(null,'',historyHref(historyDate,round.id));
    historyMessage='新增的計分已入帳。';
  } else {
    syncActive(round.id);
    match=structuredClone(round.match);
    edit=false; review=true;
  }
  persist(); render('#result-h'); announce('新增的計分已入帳。');
}
function editHistoryRound(rerolling) {
  const round=viewedRound();
  if(!round||pendingInPlay(round)) return;
  const draft=historyDraft ?? {...round,match:structuredClone(round.match),rerollId:null};
  if(rerolling){
    if(!validMatch(draft.match)) return;
    animateReroll(draft,draft.match,()=>{
      draft.editing=false;
      historyDraft=draft;
      historyMessage='';
      render('#result-h');
      announce('已重骰計分卡，請按抽取反轉卡。');
    });
    return;
  }
  draft.editing=true;
  historyDraft=draft;
  historyMessage='';
  render('#review');
}
function saveHistoryRound() {
  const round=viewedRound();
  const draft=historyDraft;
  if(!round||!draft||pendingInPlay(round)) return;
  if(!validMatch(draft.match)||!commitRound(round,draft.match,draft)){
    const message=document.querySelector('#review-error');
    if(message){
      message.textContent=issues(draft.match)||'請補齊這場各筆計分使用的戰績數字。';
      message.hidden=false;
      announce(message.textContent);
    }
    return;
  }
  if(matchId(activeRound())===matchId(round)) match=structuredClone(round.match);
  if(historyDate!==round.match.date) window.history.replaceState(null,'',historyHref(round.match.date,round.id));
  historyDraft=null;
  historyMessage=draft.rerollId?'已更新這局的計分卡、反轉和積分。':'已儲存這局的戰績更正。';
  persist(); render('#result-h');
}
root.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');
  if(!target||target.disabled) return;
  const actions = {
    pick:()=>document.querySelector('#photos').click(),
    retry:runRecognition,
    manual:()=>{match=blankMatch(); edit=true; render();},
    sample:()=>{startNew(false);match=sample();edit=true;updateStatus('已載入試玩範例。',true);render();},
    extra:()=>{match.showAll=true;render();},
    confirm:()=>confirm(false),
    'overview-only':()=>confirm(true),
    draw,
    reroll,
    'cancel-reroll':()=>{clearReroll(activeRound());persist();render('#result-h');},
    reveal:()=>revealReversal(activeRound(),true),
    save,
    'additional-start':startAdditionalScore,
    'additional-reveal':()=>revealReversal(additionalScores[route()]),
    'additional-reroll':()=>{
      const round=additionalScores[route()];
      if(round) animateReroll(round,round.match,()=>render('#result-h'));
    },
    'additional-save':saveAdditionalScore,
    'additional-cancel':()=>{additionalScores[route()]=null;render('[data-action="additional-start"]');},
    next:()=>startNew(),
    edit:()=>{edit=true;render();document.querySelector('#review')?.scrollIntoView({block:'start'});},
    filter:()=>{deckFilter=target.dataset.filter;render(`[data-filter="${deckFilter}"]`);},
    'flip-card':()=>flipDeckCard(target),
    'match-stats-view':()=>{
      const group=target.dataset.statsGroup;
      const round=viewedRound();
      if(round) historyStatsGroup=group;
      else matchStatsGroup=group;
      document.querySelector('#match-stats').outerHTML=round ? matchStatsPanel(round.match,group,true) : matchStatsPanel();
      document.querySelector(`[data-stats-group="${group}"]`)?.focus({preventScroll:true});
    },
    'history-edit':()=>editHistoryRound(false),
    'history-reroll':()=>editHistoryRound(true),
    'history-reveal':()=>revealReversal(historyDraft),
    'history-save':saveHistoryRound,
    'history-cancel':()=>{
      const action=historyDraft?.rerollId?'history-reroll':'history-edit';
      historyDraft=null;
      render(`[data-action="${action}"]`);
    }
  };
  actions[target.dataset.action]?.();
});
function applyField(input) {
  const field=input.dataset.field;
  const historical=route()==='history';
  const current=historical?historyDraft?.match:match;
  if(!current||!field) return;
  const parts=field.split('.');
  let value=input.type==='number' ? (input.value===''?null:input.valueAsNumber) : input.value;
  if(input.type==='number'&&value!==null&&(!Number.isFinite(value)||value<0||(!field.endsWith('rating')&&!Number.isInteger(value)))) {
    value=null;
    input.setAttribute('aria-invalid','true');
  } else { input.removeAttribute('aria-invalid'); if(!historical) uncertain.delete(field); }
  if(parts[1]==='hero') value=value.trim();
  if(parts.length===1) current[field]=value;
  else {
    const row=current.rows[Number(parts[0])];
    if(parts[1]==='id' && current.scoringIds?.includes(row.id)) {
      current.scoringIds = current.scoringIds.map(id=>id===row.id?value:id);
    }
    row[parts[1]]=value;
    if(parts[1]==='id') Object.assign(row,players.find(player=>player.id===value));
  }
  const message=document.querySelector('#review-error');
  if(message){const text=issues(current); message.hidden=!text; message.textContent=text;}
  const overview=document.querySelector('[data-action="overview-only"]');
  if(overview) overview.disabled=busy||!signed();
}
root.addEventListener('input',event=>applyField(event.target));
root.addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='photos'){receiveFiles(target.files);return;}
  if(target.dataset.participant!==undefined){
    const current=route()==='history'?historyDraft?.match:match;
    if(!current) return;
    const id=current.rows[Number(target.dataset.participant)].id;
    const selected=new Set(current.scoringIds ?? current.rows.map(row=>row.id));
    if(target.checked) selected.add(id); else selected.delete(id);
    current.scoringIds=[...selected];
    const message=document.querySelector('#review-error');
    if(message){const text=issues(current);message.hidden=!text;message.textContent=text;}
    const overview=document.querySelector('[data-action="overview-only"]');
    if(overview) overview.disabled=busy||!signed();
    return;
  }
  if(target.id==='history-date'||target.id==='history-recent'){
    if(target.value){
      window.history.replaceState(null,'',historyHref(target.value));
      render(`#${target.id}`);
    }
    return;
  }
  if(target.id==='side'){sideOverride=target.value;runRecognition();return;}
  if(target.dataset.kind){const item=uploads.find(item=>item.file.name===target.dataset.kind);if(item)item.override=target.value;return;}
  if(target.dataset.tieDate){state.tiebreak[target.dataset.tieDate]=target.value;persist();render();}
  if(target.dataset.field?.endsWith('.id')){applyField(target);render();}
});
for(const name of ['dragenter','dragover','dragleave','drop']) {
  root.addEventListener(name,event=>{
    const zone=event.target.closest('#drop');
    if(!zone) return;
    event.preventDefault();
    zone.classList.toggle('over',name==='dragenter'||name==='dragover');
    if(name==='drop') receiveFiles(event.dataTransfer.files);
  });
}
let backfilled=false;
for(const round of state.rounds.filter(item=>item.saved&&!item.results)) {
  const results=recordedResults(round);
  if(!results.length) continue;
  round.results=storedResults(results);
  round.cardSnapshot=cardDetails(round.cardId,round.scoringVersion ?? 1);
  round.reversalSnapshot=roundReversal(round);
  backfilled=true;
}
if(backfilled) persist();
window.addEventListener('hashchange',()=>{
  closeDrawAnimation();
  historyDraft=null;
  additionalScores.history=null;
  historyMessage='';
  historyStatsGroup='overview';
  window.scrollTo({top:0});
  render('#view-title');
});
render();
