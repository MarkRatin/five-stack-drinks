import assert from 'node:assert/strict';
import test from 'node:test';
import {availableCards, drawRound, eligibleCards, rerollPool, settle} from '../rules.mjs';

const ids = ['teamfight-opener','hit-and-run','all-five-pass','human-punching-bag'];
const [opener, hitAndRun, allFive, punchingBag] = ids;
const rows = [
  {damage:40,taken:10,control:20,heal:0,tower:30,assists:20},
  {damage:20,taken:30,control:20,heal:0,tower:10,assists:35},
  {damage:19,taken:20,control:0,heal:0,tower:20,assists:5},
  {damage:11,taken:20,control:30,heal:0,tower:20,assists:20},
  {damage:10,taken:20,control:30,heal:0,tower:20,assists:20}
].map((stats,index) => ({id:String(index),name:String(index),...stats}));
const match = {rows};
const score = (match,id) => settle(match,id).map(({id,value,base}) => [id,value,base]);

test('團戰開路加總控制與助攻占比，並列平分名次分數', () => {
  assert.deepEqual(score(match,opener), [['1',55,5],['3',50,3.5],['4',50,3.5],['0',40,2],['2',5,1]]);
});

test('打完就走和人形沙包以相反的百分點差排名', () => {
  assert.deepEqual(score(match,hitAndRun), [['0',30,5],['2',-1,4],['3',-9,3],['1',-10,1.5],['4',-10,1.5]]);
  assert.deepEqual(score(match,punchingBag), [['1',10,4.5],['4',10,4.5],['3',9,3],['2',1,2],['0',-30,1]]);
});

test('五科都過線以未四捨五入的 20% 為門檻，全隊零治療不過線', () => {
  const nearRows = rows.map((row,index) => ({...row, damage: [40001,20000,19999,10000,10000][index]}));
  assert.deepEqual(score({rows:nearRows},allFive), [['0',3,3.5],['1',3,3.5],['3',3,3.5],['4',3,3.5],['2',2,1]]);
  const even = rows.map(row=>({...row,damage:20,taken:20,control:20,heal:20,tower:20}));
  assert.deepEqual(score({rows:even},allFive), rows.map(row=>[row.id,5,3]));
});

test('四人計分沿用五人分母，只有參與者分配四人場分數', () => {
  const four = {...match,scoringIds:['0','1','2','3']};
  assert.deepEqual(score(four,opener), [['1',55,4],['3',50,3],['0',40,2],['2',5,1]]);
  assert.deepEqual(score(four,allFive), [['0',3,3],['1',3,3],['3',3,3],['2',2,1]]);
});

test('四張牌加入可抽牌池及重骰，缺少所需欄位時排除', () => {
  const eligible = eligibleCards(match);
  for (const id of ids) {
    const available = availableCards(eligible,[]).available;
    const index = available.findIndex(card=>card.id===id && card.category==='fun');
    assert.ok(index>=0,id);
    assert.equal(drawRound(eligible,[],()=> (index+0.5)/available.length).cardId,id);
  }
  assert.ok(!eligibleCards(match,true).some(card=>ids.includes(card.id)));
  const incomplete = {...match,scoringIds:['0','1','2','3'],rows:rows.map((row,i)=> i===4 ? {...row,heal:null} : row)};
  assert.deepEqual(eligibleCards(incomplete).filter(card=>ids.includes(card.id)).map(card=>card.id).sort(),[opener,hitAndRun,punchingBag].sort());
  assert.deepEqual(settle(incomplete,allFive),[]);
  assert.ok(rerollPool(eligible,[opener],[opener],opener).some(card=>card.id===hitAndRun));
});
