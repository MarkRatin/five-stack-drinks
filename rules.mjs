export const players = [
  { id: 'duck', name: '南山鴨霸天王', color: 'brick' },
  { id: 'trade', name: '內線交易大師', color: 'ochre' },
  { id: 'protein', name: '補充蛋白質', color: 'olive' },
  { id: 'bun', name: '踩包子', color: 'plum' },
  { id: 'granny', name: '你阿嬤卡好', color: 'slate' }
];

export const fields = {
  rating: '遊戲評分', kills: '擊殺', deaths: '死亡', assists: '助攻',
  gold: '總經濟', damage: '對英雄傷害', taken: '承受英雄傷害',
  control: '控制效果', heal: '治療量', tower: '對塔傷害'
};

export const groups = {
  overview: ['rating', 'kills', 'deaths', 'assists', 'gold'],
  stats: ['damage', 'taken'],
  team: ['control', 'heal', 'tower']
};

export const groupNames = { overview: '總覽', stats: '數據', team: '團隊' };
export const categoryNames = { skill: '實力卡', fun: '趣味卡', chaos: '混亂卡' };
export const dateInTaipei = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Taipei'}).format(new Date());
const number = new Intl.NumberFormat('zh-TW', {maximumFractionDigits: 2});
export const fmt = value => Number.isFinite(value) ? number.format(value) : '—';
export const scoringVersion = 5;

function card(id, category, name, rule, fields, unit, measure, direction = 1, punch = '', tieBreak) {
  return {id, category, name, rule, fields: fields.split(' '), unit, measure, direction, punch, tieBreak};
}
const rank = (rows, value, field) => {
  const above = rows.filter(row => row[field] > value).length;
  const equal = rows.filter(row => row[field] === value).length;
  return 1 + above + (equal - 1) / 2;
};
const share = (row, rows, field) => {
  const total = rows.reduce((sum, item) => sum + item[field], 0);
  return total > 0 ? 100 * row[field] / total : 0;
};
export function participationRate(row,match) {
  if(![row.kills,row.assists,match.teamKills].every(Number.isFinite)) return null;
  return match.teamKills>0 ? 100*(row.kills+row.assists)/match.teamKills : 0;
}
export function expectedKills(row,rows,match) {
  if(!Number.isFinite(match.teamKills)||!rows.every(item=>Number.isFinite(item.damage))) return null;
  const teamDamage=rows.reduce((sum,item)=>sum+item.damage,0);
  return teamDamage>0 && match.teamKills>0 ? match.teamKills*row.damage/teamDamage : null;
}
const legacyLastHit=card('last-hit','fun','尾刀小王子','對英雄傷害 ÷ 擊殺，越低越前。零擊殺排在最後。','damage kills','',p=>p.kills ? p.damage/p.kills : Infinity,-1,'每顆頭各自花了多少輸出？');
const roundedShare=(row,rows,field)=>{
  const total=rows.reduce((sum,item)=>sum+item[field],0);
  return total>0 ? Math.round(1000*row[field]/total)/10 : 0;
};
const balancedShare=(row,rows)=>{
  const output=share(row,rows,'damage');
  const taken=share(row,rows,'taken');
  return output+taken>0 ? (2*output*taken)/(output+taken) : 0;
};
const retiredBoth=card('both','fun','文武雙全','2 × 輸出占比 × 承傷占比 ÷（輸出占比＋承傷占比）。數值越高越前。兩項合計為 0 時以 0 計。','damage taken','%',balancedShare,1,'能打也能扛，兩邊都要有。');

export const cards = [
  card('star','skill','真正的大腿','遊戲評分最高者優先。','rating','',p=>p.rating,1,'這場誰扛著全隊走？讓結算評分來認證。'),
  card('kills','skill','殺戮機器','擊殺越多越前。','kills',' 殺',p=>p.kills,1,'擊殺播報響了一整場，怎麼又是你的名字？'),
  card('damage','skill','人形砲台','對英雄傷害越高越前。','damage','',p=>p.damage,1,'對面一露頭，你就開始刷傷害數字。'),
  card('tank','skill','血肉長城','承受英雄傷害越高越前。','taken','',p=>p.taken,1,'對面的技能特效，你用血條看完了。'),
  card('assists','skill','最佳工具人','助攻越多越前。','assists',' 助攻',p=>p.assists,1,'隊友的擊殺精華裡，最常出現的配角是你。'),
  card('gold','skill','資本主義','總經濟越高越前。','gold','',p=>p.gold,1,'隊友在看戰績，你在看存款。'),
  card('tower','skill','拆遷大隊','對塔傷害越高越前。','tower','',p=>p.tower,1,'對面的塔還在，拆遷大隊就還沒下班。'),
  card('attendance','skill','無所不在','參團率最高者優先。參團率＝（擊殺＋助攻）÷ 全隊擊殺。','kills assists','%', (p,r,m)=>participationRate(p,m) ?? 0,1,'哪裡有人頭，哪裡就有你的出勤紀錄。'),
  card('live','skill','死神不要我','死亡最少者優先。','deaths',' 次',p=>p.deaths,-1,'死神一整場都在點名，你最少被叫回泉水。'),
  card('last-hit-share','fun','尾刀小王子','實際擊殺 −（全隊擊殺 × 對英雄傷害占比），差值越高越前。有擊殺者優先。','damage kills',' 顆',(p,r,m)=>{
    const expected=expectedKills(p,r,m);
    if(expected===null) return 0;
    return p.kills>0 ? p.kills-expected : -Infinity;
  },1,'按你打的傷害，這場多收了幾顆頭？'),
  card('miracle','fun','經濟奇蹟','輸出占比 − 經濟占比，差值越高越前。','damage gold',' 個百分點',(p,r)=>share(p,r,'damage')-share(p,r,'gold'),1,'領的是小資預算，打出來的是大哥傷害。'),
  card('broke','fun','沒錢也能扛','承傷占比 − 經濟占比，差值越高越前。','taken gold',' 個百分點',(p,r)=>share(p,r,'taken')-share(p,r,'gold'),1,'隊上沒給多少預算，對面倒是給足了傷害。'),
  card('budget-clinic','fun','平價診所','治療占比 − 經濟占比，差值越高越前。全隊治療量為 0 時，治療占比以 0 計。','heal gold',' 個百分點',(p,r)=>share(p,r,'heal')-share(p,r,'gold'),1,'診所預算不多，補血服務卻沒有在打折。'),
  card('vampire','fun','吸血鬼','對英雄傷害占比 × 治療占比，再開平方根。數值越高越前。','damage heal','%',(p,r)=>Math.sqrt(share(p,r,'damage')*share(p,r,'heal')),1,'一邊打人，一邊補血，戰績表上兩邊都要有。'),
  card('one-cut','fun','廉價勞工','助攻減擊殺，差值越大越前。','assists kills','',p=>p.assists-p.kills,1,'團戰出勤全勤，人頭獎金都發給別人。'),
  card('survival','fun','極限求生','（擊殺＋助攻）÷（死亡＋1），數值越高越前。','kills assists deaths',' 次',p=>(p.kills+p.assists)/(p.deaths+1),1,'團戰要有你的份，陣亡名單能少一筆是一筆。'),
  card('all-damage','fun','傷害都我打','對英雄傷害 ÷（擊殺＋1），數值越高越前。','kills damage','',p=>p.damage/(p.kills+1),1,'傷害打滿，頭都沒了。'),
  card('charity','chaos','慈善事業家','死亡最多者優先。','deaths',' 次',p=>p.deaths,1,'對面的經濟，有一部分是你贊助的。'),
  card('poor','fun','窮得只剩技術','（輸出占比＋承傷占比＋治療占比）÷ 3 − 經濟占比，差值越高越前。全隊某項數值為 0 時，該項占比以 0 計。','damage taken heal gold',' 個百分點',(p,r)=>(share(p,r,'damage')+share(p,r,'taken')+share(p,r,'heal'))/3-share(p,r,'gold'),1,'經濟不多，輸出、承傷和治療還是努力貢獻。'),
  card('destiny','chaos','命中注定','死亡次數最接近 3 的人優先。','deaths',' 次差距',p=>Math.abs(p.deaths-3),-1,'死神的幸運數字是 3，少死或多死都差一點。'),
  card('mean','chaos','中庸之道','輸出占比最接近 20% 的人優先。','damage',' 個百分點差距',(p,r)=>Math.abs(share(p,r,'damage')-20),-1,'全隊輸出切五份，誰打得最剛好？'),
  card('balance','fun','陰陽平衡','輸出占比與承傷占比差距最小者優先。','damage taken',' 個百分點差距',(p,r)=>Math.abs(share(p,r,'damage')-share(p,r,'taken')),-1,'把輸出和挨打的占比放上天平，誰最不偏心？'),
  card('one-for-zero','fun','一換零公司','死亡 − 擊殺，差值越大越前。','deaths kills',' 次',p=>p.deaths-p.kills,1,'每次說要換一個，回泉水的都是你。'),
  card('tourist','chaos','觀光客','戰績上的參團率越低越前。','kills assists','%',(p,r,m)=>participationRate(p,m) ?? 0,-1,'「有啊，我有到。」相簿裡全是風景照。'),
  card('gear-display','fun','裝備展示間','經濟占比 − 對塔傷害占比，差值越大越前。','gold tower',' 個百分點',(p,r)=>share(p,r,'gold')-share(p,r,'tower'),1,'裝備出了一整套，對面的塔還在原地。'),
  card('leaky-health','fun','血條漏水','死亡占比 − 承傷占比，差值越大越前。全隊零死亡時同分。','deaths taken',' 個百分點',(p,r)=>r.some(row=>row.deaths>0)?share(p,r,'deaths')-share(p,r,'taken'):0,1,'全隊挨打有份，回泉水怎麼特別有你的份？'),
  card('receipt-lottery','chaos','發票對獎','總經濟末兩碼越接近 88 越前。','gold',' 點差距',p=>Math.abs(p.gold%100-88),-1,'你最接近中獎的一次'),
  card('clock-out','fun','誰最接近30歲？','擊殺、死亡和助攻的總和越接近 30 越前。','kills deaths assists',' 次差距',p=>Math.abs(p.kills+p.deaths+p.assists-30),-1,'生日不用填，這場的 KDA 幫你報年齡。'),
  card('two-for-one','fun','傷敵1000自損1000','擊殺和死亡差距越小越前。差距相同時，擊殺較多者優先。','kills deaths',' 次差距',p=>Math.abs(p.kills-p.deaths),-1,'拿一顆頭，還一顆頭。',p=>p.kills),
  card('perfect-ten','chaos','十全十美','結算評分最接近 10.0 的人優先。','rating',' 分差距',p=>Math.abs(p.rating-10),-1,'評分太高也會考過頭。'),
  card('full-kda','fun','三元及第','取擊殺、死亡、助攻的最小值，這個值越高越前。','kills deaths assists','',p=>Math.min(p.kills,p.deaths,p.assists),1,'三科都得交卷，連陣亡那科都不能空白。'),
  card('overtime','fun','無薪加班','每一萬經濟換到的擊殺加助攻越多越前。','gold kills assists',' 次／萬經濟',p=>p.gold ? 10000*(p.kills+p.assists)/p.gold : 0,1,'薪水還沒發，團戰已經打完了。'),
  card('quiet','fun','默默上班','評分名次減參團率名次，差值越大越前。','rating kills assists',' 名',(p,r)=>rank(r,p.rating,'rating')-rank(r.map(o=>({joined:o.kills+o.assists})),p.kills+p.assists,'joined'),1,'團戰幾乎都有你，結算評分記得你嗎？'),
  card('freeze','skill','禁止走動','控制效果越高越前。','control','',p=>p.control,1,'你們在玩傳說，對面在等角色解凍。'),
  card('doctor','skill','急診室主任','治療量越高越前。','heal','',p=>p.heal,1,'打一場，順便開了一間醫院。'),
  card('tower-main','fun','塔才是本體','對塔傷害占比 − 對英雄傷害占比，差值越高越前。','tower damage',' 個百分點',(p,r)=>share(p,r,'tower')-share(p,r,'damage'),1,'隊友在打團，就你在打塔'),
  card('borrowed','fun','血條是借來的','承受英雄傷害 ÷（死亡＋1），越高越前。','taken deaths','',p=>p.taken/(p.deaths+1),1,'對面灌了那麼多傷害，你怎麼還活著？'),
  card('field-er','fun','戰地急診','隊內治療占比 − 隊內死亡占比 × 30%，結果越高越前。全隊零死亡時，死亡占比算 0%。','heal deaths',' 個百分點',(p,r)=>share(p,r,'heal')-share(p,r,'deaths')*0.3,1,'你是南丁格爾？')
];

// Unversioned records were drawn using these rules, including pending draws.
const previousRules = {
  miracle:{measure:(p,r)=>roundedShare(p,r,'damage')-roundedShare(p,r,'gold')},
  broke:{measure:(p,r)=>roundedShare(p,r,'taken')-roundedShare(p,r,'gold')},
  vampire:{rule:'經濟占比減輸出占比，差距越大越前。',fields:['gold','damage'],
    measure:(p,r)=>roundedShare(p,r,'gold')-roundedShare(p,r,'damage'),punch:''},
  both:{rule:'輸出占比加承傷占比，加總越高越前。',
    measure:(p,r)=>roundedShare(p,r,'damage')+roundedShare(p,r,'taken'),punch:''},
  survival:{rule:'擊殺加助攻減死亡，數值越高越前。',unit:'',measure:p=>p.kills+p.assists-p.deaths},
  'all-damage':{rule:'擊殺名次減輸出名次，差距越大越前。',unit:' 名',
    measure:(p,r)=>rank(r,p.kills,'kills')-rank(r,p.damage,'damage')},
  mean:{measure:(p,r)=>Math.abs(roundedShare(p,r,'damage')-20)},
  balance:{measure:(p,r)=>Math.abs(roundedShare(p,r,'damage')-roundedShare(p,r,'taken'))},
  'two-for-one':{rule:'擊殺和死亡的差距越小越前。',tieBreak:null},
  'tower-main':{measure:(p,r)=>roundedShare(p,r,'tower')-roundedShare(p,r,'damage')},
  'field-er':{measure:(p,r)=>Math.min(roundedShare(p,r,'heal'),roundedShare(p,r,'taken'))}
};

const version2Rules = {
  vampire:{rule:'經濟占比 −（輸出占比＋承傷占比）÷ 2。數值越高越前。',fields:['gold','damage','taken'],
    unit:' 個百分點',measure:(p,r)=>share(p,r,'gold')-(share(p,r,'damage')+share(p,r,'taken'))/2,punch:'資源都吃了，輸出和承傷交給隊友。'},
  'leaky-health':{category:'chaos',rule:'承傷占比 − 輸出占比，差值越大越前。',fields:['taken','damage'],
    measure:(p,r)=>share(p,r,'taken')-share(p,r,'damage'),punch:'血條一直扣，退回去的傷害倒是很客氣。'},
  balance:{category:'chaos'},
  'one-for-zero':{category:'chaos'},
  'gear-display':{category:'chaos'},
  'clock-out':{category:'chaos'},
  'perfect-ten':{category:'fun'},
  freeze:{category:'fun'},
  doctor:{category:'fun'}
};

const version3Rules = {
  'field-er':{rule:'治療占比和承傷占比取較低的一項。例：治療 30%、承傷 10%，得 10%。數字越高越前。',
    fields:['heal','taken'],unit:'%',measure:(p,r)=>Math.min(share(p,r,'heal'),share(p,r,'taken')),punch:'比誰一邊扛得住，一邊還有餘力救人。'}
};

const version4Rules = {
  poor:{category:'chaos',rule:'總經濟最低者優先。',fields:['gold'],unit:'',measure:p=>p.gold,direction:-1,punch:'打開裝備商店，最富有的東西是願望清單。'}
};

function findCard(id,version) {
  if(id===legacyLastHit.id) return legacyLastHit;
  const current=id===retiredBoth.id ? retiredBoth : cards.find(item=>item.id===id);
  if(!current || version>=scoringVersion) return current;
  return {...current,...version4Rules[id],...(version<=3?version3Rules[id]:null),...(version<=2?version2Rules[id]:null),...(version===1?previousRules[id]:null)};
}

const basePoints = [5,4,3,2,1];

export const reversals = [
  {id:'chosen',name:'天選之人',points:[2,4,5,3,1], description:'當局原始第 3 名拿下當局最高分。', punch:'前兩名還在比誰強，第三名已經被叫去領獎。'},
  {id:'reverse',name:'命運逆轉',points:[1,2,3,4,5], description:'當局的積分順序整張翻過來。', punch:'排行榜倒著念，原本墊底的人突然站上第一。'},
  {id:'swap',name:'首尾互換',points:[1,4,3,2,5], description:'當局第 1 名和第 5 名交換分數，其他名次照原分。', punch:'第一名跟最後一名換座位，中間三位請坐好。'},
  {id:'team-double',name:'全隊加倍',points:basePoints.map(points=>points*2), description:'五人的當局基本分都乘以 2。', punch:'全隊都抽中雙倍券，這場每個人都領兩份。'},
  {id:'big-comeback',name:'大翻盤',dailyBonuses:[0,0,0,2,3], description:'當局基本分入帳後，當日累積總榜第 5 名加 3 分，第 4 名加 2 分。', punch:'總榜後段收到追分券，前排先別急著慶祝。'},
  {id:'first-loser',name:'第二名是頭號輸家',dailyBonuses:[0,-3,0,0,0], description:'當局基本分入帳後，當日累積總榜第 2 名扣 3 分。', punch:'差一點就是第一名，結果先收到扣分通知。'},
  {id:'empty-promise',name:'你懂我意思？',points:[0,0,0,0,0],description:'這次計分五人都得 0 分。',punch:'分數開得天花亂墜，兌現的時候，支票竟然是空白的。'},
  {id:'small-comeback',name:'小翻盤',points:[5,4,3,3,3], description:'當局第 5 名加 2 分，第 4 名加 1 分。', punch:'這局後兩名有安慰獎，越後面補得越多。'}
];

const hasCardData = (item,match,overviewOnly=false) => item.fields.every(field =>
  (!overviewOnly || groups.overview.includes(field)) && match.rows.every(row=>Number.isFinite(row[field])));
export const eligibleCards = (match, overviewOnly = false) => cards.filter(item=>hasCardData(item,match,overviewOnly));

export function availableCards(eligible, drawn) {
  const available = eligible.filter(item => !drawn.includes(item.id));
  if (available.length) return {available, reset: false};
  // If only a subset is playable, the unused cards stay in the current deck.
  return drawn.length >= cards.length || eligible.length < cards.length
    ? {available: eligible, reset: true}
    : {available: [], reset: false};
}

const choose = (array, random) => array[Math.floor(random() * array.length)];
export const drawReversal = (random = Math.random) => random() < 0.1 ? choose(reversals, random).id : null;

export function drawRound(eligible, drawn, random = Math.random) {
  const {available, reset} = availableCards(eligible, drawn);
  if (!available.length) return null;
  const id = choose(available, random).id;
  return {
    cardId: id,
    drawn: [...(reset ? drawn.filter(id => !eligible.some(item => item.id === id)) : drawn), id]
  };
}

export function rerollPool(eligible, drawn, tried, currentId) {
  const alternatives = eligible.filter(card => card.id !== currentId);
  const unseen = alternatives.filter(card => !tried.includes(card.id));
  const candidates = unseen.length ? unseen : alternatives;
  const freshToday = candidates.filter(card => !drawn.includes(card.id));
  return freshToday.length ? freshToday : candidates;
}

export function cardDetails(id,version=scoringVersion) {
  const card = findCard(id,version);
  if (!card) return null;
  const {name, category, rule, unit, punch} = card;
  return {id, name, category, rule, unit, punch};
}

const rounded = value => Number.isFinite(value) ? Math.round(value * 1e8) / 1e8 : value;
const average = (points, start, end) => points.slice(start,end).reduce((sum, value) => sum + value, 0) / (end-start);
export function settle(match, cardId, reversalId, reversalSnapshot,version=scoringVersion) {
  const item = findCard(cardId,version);
  const reversal = reversalSnapshot ?? reversals.find(card => card.id === reversalId);
  if (!item || !hasCardData(item,match)) return [];
  const results = match.rows.map(row=>({id:row.id,name:row.name,value:rounded(item.measure(row,match.rows,match)),tie:item.tieBreak?.(row) ?? 0}))
    .sort((a,b)=>a.value===b.value ? b.tie-a.tie : (b.value-a.value)*item.direction);
  let start = 0;
  while (start < results.length) {
    let end = start + 1;
    while (end < results.length && results[end].value===results[start].value && results[end].tie===results[start].tie) end++;
    const base = average(basePoints, start, end);
    const final = reversal?.points ? average(reversal.points, start, end) : base;
    for (const entry of results.slice(start,end)) Object.assign(entry, {rank:start+1,base,final});
    start = end;
  }
  return results.map(({tie,...result})=>result);
}

export function recordedResults(round) {
  return round.results ?? settle(round.match, round.cardId, round.reversalId, round.reversalSnapshot, round.scoringVersion ?? 1);
}

const rankTotals = totals => Object.values(totals)
  .map(player=>({...player,total:rounded(player.total)}))
  .sort((a,b)=>b.total-a.total);

export function settleDay(rounds, date) {
  const games = rounds.filter(round=>round.saved && round.match.date===date);
  const bonusesByRound = new Map();
  if (!games.length) return {totals:[],bonusesByRound};

  const totals = Object.fromEntries(players.map(player => [player.id, {...player, total:0}]));
  for (const round of games) {
    const results = recordedResults(round);
    for (const result of results) {
      if (totals[result.id]) totals[result.id].total += result.final;
    }

    const reversal = round.reversalSnapshot ?? reversals.find(card=>card.id===round.reversalId);
    if (!reversal?.dailyBonuses || !results.length) continue;

    const ranking = rankTotals(totals);
    const awards = [];
    let start = 0;
    while (start < ranking.length) {
      let end = start + 1;
      while (end < ranking.length && ranking[end].total===ranking[start].total) end++;
      const bonus = average(reversal.dailyBonuses,start,end);
      if (bonus !== 0) {
        for (const {id,name} of ranking.slice(start,end)) {
          totals[id].total += bonus;
          awards.push({id,name,bonus});
        }
      }
      start = end;
    }
    bonusesByRound.set(round.id,awards);
  }
  return {totals:rankTotals(totals),bonusesByRound};
}

export const dailyTotals = (rounds,date) => settleDay(rounds,date).totals;

const sampleHeroes = {duck:'瑟斐斯',trade:'馬洛斯',protein:'提米',bun:'蘇',granny:'伊耿士'};
export function backfillKnownHeroes(match) {
  const missing=match.rows.filter(row=>row.hero===undefined || row.hero===null);
  if(!missing.length) return false;

  const reference=sample();
  if(!match.example) {
    const sameMatch=match.date===reference.date && match.time===reference.time &&
      match.teamKills===reference.teamKills && match.rows.length===reference.rows.length &&
      reference.rows.every(expected=>{
        const row=match.rows.find(item=>item.id===expected.id);
        return row && groups.overview.every(field=>row[field]===expected[field]);
      });
    if(!sameMatch) return false;
  }

  let changed=false;
  for(const row of missing) {
    if(!Object.hasOwn(sampleHeroes,row.id)) continue;
    row.hero=sampleHeroes[row.id];
    changed=true;
  }
  return changed;
}

export function sample() {
  const stats = [
    [7.1,5,9,17,26306,148906,194144,22968,47617,235],
    [12.4,10,5,14,24322,394667,334377,4752,215413,2971],
    [8.0,4,9,25,20823,135047,233778,43230,119217,0],
    [8.9,10,6,14,29150,283305,109215,0,26875,5247],
    [4.6,8,16,12,20003,198771,210026,23496,31539,2343]
  ];
  return {date:'2026-11-25',time:'13:35',teamKills:37,side:'left',example:true,
    rows: players.map((p,i) => ({...p, hero:sampleHeroes[p.id], ...Object.fromEntries(Object.keys(fields).map((key,j)=>[key,stats[i][j]]))}))};
}

export function blankMatch() {
  return {date:dateInTaipei(),time:'',teamKills:null,side:'left',example:false,rows:players.map(p=>({...p}))};
}
