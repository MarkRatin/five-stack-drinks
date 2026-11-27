import test from 'node:test';
import assert from 'node:assert/strict';
import {sample, settle, settleDay, reversals, drawReversal, players} from '../rules.mjs';

const ids = players.map(player=>player.id);
const date = '2026-11-25';
const reversal = id => reversals.find(card=>card.id===id);
function match({ratings=[10,9,8,7,6], assists=[0,0,0,0,0], count=5}={}) {
  const game = sample();
  game.rows = game.rows.map((row,index)=>({...row,rating:ratings[index],assists:assists[index]}));
  if (count===4) game.scoringIds=ids.slice(0,4);
  return game;
}
const settleCard = (game,id) => settle(game,'star',id,reversal(id));
function savedRound(id, scores, card=null) {
  return {id,saved:true,match:{date},results:scores.map((final,index)=>({id:ids[index],final})),
    reversalId:card?.id ?? null,reversalSnapshot:card};
}
const totals = result => Object.fromEntries(result.totals.map(({id,total})=>[id,total]));

test('雙號取餐：五人及四人的原始名次配分',()=>{
  assert.deepEqual(settleCard(match(),'even-number-pickup').map(row=>row.final),[5,5,3,3,1]);
  assert.deepEqual(settleCard(match({count:4}),'even-number-pickup').map(row=>row.final),[4,4,2,2]);
});

test('雙號取餐：並列者平分佔用名次的反轉後配分',()=>{
  const five=settleCard(match({ratings:[10,9,9,7,7]}),'even-number-pickup');
  assert.deepEqual(five.map(row=>row.final),[5,4,4,2,2]);
  const four=settleCard(match({ratings:[10,10,8,7,6],count:4}),'even-number-pickup');
  assert.deepEqual(four.map(row=>row.final),[4,4,2,2]);
});

test('好人有好報：助攻最多者加 2，未參與計分者不列入',()=>{
  const five=settleCard(match({assists:[1,2,12,4,0]}),'good-deeds');
  assert.deepEqual(five.map(row=>row.final),[5,4,5,2,1]);
  const four=settleCard(match({assists:[1,10,2,3,99],count:4}),'good-deeds');
  assert.deepEqual(four.map(row=>row.final),[4,5,2,1]);
});

test('好人有好報：並列最多平分 2 分，全員零助攻不加分',()=>{
  const tied=settleCard(match({assists:[10,10,10,0,0]}),'good-deeds');
  for (const [index,row] of tied.entries()) {
    assert.ok(Math.abs(row.final-([5,4,3,2,1][index]+(index<3?2/3:0)))<1e-7);
  }
  assert.deepEqual(settleCard(match(),'good-deeds').map(row=>row.final),[5,4,3,2,1]);
  const incomplete=match({assists:[1,2,3,4,5]});
  delete incomplete.rows[2].assists;
  assert.deepEqual(settleCard(incomplete,'good-deeds'),[]);
});

test('領先要繳稅：先入帳，再把超過 3 分的差距扣除',()=>{
  const before=savedRound('before',[10,8,5,4,2]);
  const current=savedRound('current',[5,2,3,1,4],reversal('leader-tax'));
  const result=settleDay([before,current],date);
  assert.deepEqual(totals(result),{[ids[0]]:13,[ids[1]]:10,[ids[2]]:8,[ids[4]]:6,[ids[3]]:5});
  assert.deepEqual(result.bonusesByRound.get('current'),[{id:ids[0],name:players[0].name,bonus:-2}]);
});

test('領先要繳稅：剛好 3 分、榜首並列及小數差距',()=>{
  for (const scores of [[10,7,5,4,3],[10,10,5,4,3]]) {
    const result=settleDay([savedRound('current',scores,reversal('leader-tax'))],date);
    assert.deepEqual(result.bonusesByRound.get('current'),[]);
    assert.equal(totals(result)[ids[0]],10);
  }
  const result=settleDay([savedRound('current',[10.5,7,5,4,3],reversal('leader-tax'))],date);
  assert.equal(totals(result)[ids[0]],10);
  assert.equal(result.bonusesByRound.get('current')[0].bonus,-0.5);
});

test('領先要繳稅：四人場也檢查不在本局計分的當日榜首',()=>{
  const before=savedRound('before',[0,0,0,0,12]);
  const current=savedRound('current',[4,3,2,1],reversal('leader-tax'));
  const result=settleDay([before,current],date);
  assert.equal(totals(result)[ids[4]],7);
  assert.deepEqual(result.bonusesByRound.get('current'),[{id:ids[4],name:players[4].name,bonus:-5}]);
});

test('反轉快照經序列化後仍可重算，舊反轉牌的配分不變',()=>{
  const game=match({assists:[1,2,3,9,0]});
  const snapshot=JSON.parse(JSON.stringify(reversal('good-deeds')));
  assert.deepEqual(settle(game,'star','good-deeds',snapshot).map(row=>row.final),[5,4,3,4,1]);
  const tax=JSON.parse(JSON.stringify(reversal('leader-tax')));
  assert.equal(totals(settleDay([savedRound('saved',[10,4,3,2,1],tax)],date))[ids[0]],7);
  assert.deepEqual(settleCard(match({count:4}),'small-comeback').map(row=>row.final),[4,3,3,3]);
});

test('反轉卡觸發機率維持 20%，新卡都可被抽中',()=>{
  assert.equal(drawReversal(()=>0.2),null);
  for (const id of ['leader-tax','good-deeds','even-number-pickup']) {
    const index=reversals.findIndex(card=>card.id===id);
    let count=0;
    assert.equal(drawReversal(()=>count++===0 ? 0 : (index+0.1)/reversals.length),id);
  }
});
