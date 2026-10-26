import {describe,it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto,mapWinner,sidesForRound} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {validateRound} from '../src/domain/invariants';
import {seriesStats} from '../src/domain/statistics';
import {validateNarration} from '../src/domain/narrative';
import {MAPS,shortestPath} from '../src/domain/maps';
import {applyTimeout,timeoutAdvice} from '../src/domain/coach';
describe('比赛领域层',()=>{
 it.each([1,3,5] as const)('BO%i 独立合法图池',bo=>{const s=createSeries(newWorld(),'team-3','team-7',bo,42);autoVeto(s);expect(s.maps).toHaveLength(bo);expect(new Set(s.maps).size).toBe(bo);expect(s.veto).toHaveLength(6);});
 it('MR12 和多次 MR3 加时',()=>{expect(mapWinner([13,11])).toBe(0);expect(mapWinner([12,12])).toBeNull();expect(mapWinner([15,15])).toBeNull();expect(mapWinner([16,14])).toBe(0);expect(mapWinner([18,18])).toBeNull();expect(mapWinner([19,17])).toBe(0);expect(sidesForRound('T',12)).toEqual(['CT','T']);expect(sidesForRound('T',24)).toEqual(['T','CT']);expect(sidesForRound('T',27)).toEqual(['CT','T']);});
 it.each(MAPS)('$name 所有区域可达且不能瞬移',m=>{for(const a of m.zones)for(const b of m.zones){const route=shortestPath(m,a.id,b.id);expect(route.zones[0]).toBe(a.id);expect(route.zones.at(-1)).toBe(b.id);if(a.id!==b.id)expect(route.seconds).toBeGreaterThan(0);}});
 it.each(Array.from({length:25},(_,i)=>i+1))('seed %i 全图事件、经济、统计守恒',seed=>{const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);expect(s.winner).not.toBeNull();for(const r of s.mapStates[0].rounds){expect(validateRound(r),`seed=${seed},round=${r.number}`).toEqual([]);expect(validateNarration(r)).toEqual([]);}const stats=seriesStats(s);expect(stats.reduce((v,p)=>v+p.kills,0)).toBe(stats.reduce((v,p)=>v+p.deaths,0));for(const p of stats){expect(p.kast).toBeLessThanOrEqual(100);expect(p.adr).toBe(p.damage/p.rounds);}});
 it('序列化恢复与逐回合/整场完全一致',()=>{const a=createSeries(newWorld(),'team-3','team-7',3,123);autoVeto(a);resolveRound(a);const b=JSON.parse(JSON.stringify(a));simulateSeries(a);while(b.status==='playing')resolveRound(b);expect(b).toEqual(a);});
 it('暂停三个不同机制且不能重复扣次数',()=>{const s=createSeries(newWorld(),'team-3','team-7',1,20);autoVeto(s);const m=s.mapStates[0];expect(timeoutAdvice(m,0)).toHaveLength(3);applyTimeout(m,0,'belief');expect(m.effects[0]?.kind).toBe('belief');expect(m.timeoutsUsed[0]).toBe(1);expect(()=>applyTimeout(m,0,'economy')).toThrow();resolveRound(s);expect(m.timeoutHistory).toHaveLength(1);});
});
