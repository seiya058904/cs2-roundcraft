import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {rating2,aggregateStats} from '../src/domain/statistics';
import {winCurve,roundHighlights,roundMvp,economyOutlook,playerForm,liveCtWin,clutchOf,biggestSwing} from '../src/domain/insights';

const series=(seed:number)=>{const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);return s;};
it('Rating 2.0 近似：职业平均样本约 1.05，零回合为 0，更多击杀评分更高',()=>{
 const avg=rating2({rounds:100,kills:68,deaths:66,assists:13,damage:7600,kastRounds:72});
 expect(avg).toBeGreaterThan(1);expect(avg).toBeLessThan(1.12);
 expect(rating2({rounds:0,kills:0,deaths:0,assists:0,damage:0,kastRounds:0})).toBe(0);
 expect(rating2({rounds:100,kills:90,deaths:66,assists:13,damage:9000,kastRounds:72})).toBeGreaterThan(avg);
});
it('胜率曲线从赛前开始，以真实胜负收尾，所有点在 0–1 之间',()=>{
 const s=series(31);
 for(const r of s.mapStates[0].rounds){const c=winCurve(r,0);
  expect(c[0].kind).toBe('start');expect(c.at(-1)!.p).toBe(r.winner===0?1:0);
  for(const p of c)expect(p.p).toBeGreaterThanOrEqual(0),expect(p.p).toBeLessThanOrEqual(1);
  const swing=biggestSwing(r,0);if(swing)expect(r.events.some(e=>e.id===swing.eventId)).toBe(true);}
});
it('人数与下包状态让实时胜率单调：多一名防守方更有利，下包对防守方不利',()=>{
 const r=series(31).mapStates[0].rounds[3],ct=r.sides[0]==='CT'?0:1;const f=structuredClone(r.initial);
 const tIds=f.filter(x=>x.team!==ct).map(x=>x.id),ctIds=f.filter(x=>x.team===ct).map(x=>x.id);
 const kill=(id:string)=>{f.find(x=>x.id===id)!.alive=false;};
 kill(tIds[0]);kill(ctIds[0]);const even=liveCtWin(f,ct,false);
 kill(tIds[1]);const ahead=liveCtWin(f,ct,false);expect(ahead).toBeGreaterThan(even);
 expect(liveCtWin(f,ct,true)).toBeLessThan(ahead);
});
it('高光、MVP 与经济预测只引用账本中真实存在的事件和选手',()=>{
 const s=series(44);const rounds=s.mapStates[0].rounds;
 for(const r of rounds){const ids=new Set(r.events.map(e=>e.id)),players=new Set(r.initial.map(f=>f.id));
  for(const h of roundHighlights(r)){expect(h.eventIds.every(id=>ids.has(id))).toBe(true);if(h.playerId)expect(players.has(h.playerId)).toBe(true);}
  const mvp=roundMvp(r);if(mvp)expect(r.initial.find(f=>f.id===mvp.playerId)!.team).toBe(r.winner);
  const c=clutchOf(r);if(c?.won)expect(roundHighlights(r).some(h=>h.kind==='clutch'&&h.playerId===c.playerId)).toBe(true);
  const outlook=economyOutlook(r);expect(outlook).toHaveLength(2);
  if(r.number===12)expect(outlook.every(o=>o.kind==='pistol'&&o.side!==r.sides[o.team])).toBe(true);
  else if(r.number<24)expect(outlook.every(o=>o.side===r.sides[o.team]&&o.cash===r.economy.filter(e=>r.initial.find(f=>f.id===e.playerId)!.team===o.team).reduce((a,e)=>a+e.cashAtEnd,0))).toBe(true);
 }
 const stats=aggregateStats(rounds),top=stats.sort((a,b)=>b.kills-a.kills)[0];
 expect(playerForm(rounds,top.id,rounds.length).kills).toBe(top.kills);
});
