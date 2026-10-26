import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {aggregateStats,mergePlayerStats} from '../src/domain/statistics';
import {createCareer,startEvent,simulateCareerFixture,careerPlayerStats,nextSeason} from '../src/domain/career';

it('同一击杀的伤害助攻与闪光助攻不重复累加 A',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,2);autoVeto(s);const r=resolveRound(s),killer=r.initial.find(f=>f.team===0)!,helper=r.initial.filter(f=>f.team===0)[1],victim=r.initial.find(f=>f.team===1)!;
 r.events=[
  {id:'damage',at:1,kind:'damage',actor:helper.id,target:victim.id,damage:44,causes:[],detail:{}},
  {id:'blind',at:2,kind:'blind',actor:helper.id,target:victim.id,causes:[],detail:{until:5}},
  {id:'kill',at:3,kind:'kill',actor:killer.id,target:victim.id,causes:[],detail:{}}
 ];
 const row=aggregateStats([r]).find(p=>p.id===helper.id)!;expect(row.assists).toBe(1);expect(row.flashAssists).toBe(1);expect(row.kastRounds).toBe(1);
 r.events[0].damage=10;expect(aggregateStats([r]).find(p=>p.id===helper.id)!.assists).toBe(1);
});

it('跨图合计按回合加权，不能平均各图 ADR 或 Rating',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',3,23);autoVeto(s);simulateSeries(s);
 expect(mergePlayerStats(s.mapStates.map(m=>aggregateStats(m.rounds)))).toEqual(aggregateStats(s.mapStates.flatMap(m=>m.rounds)));
});

it('赛季切换归档已有统计，下一赛季从零开始',()=>{
 const c=createCareer(newWorld(),'team-3',2),e=startEvent(c,c.calendar[0].id);simulateCareerFixture(c,e.id);const old=careerPlayerStats(c);
 // This unit isolates the archive boundary; full calendar legality is exercised by sim:career.
 for(const event of c.calendar)event.status='finished';nextSeason(c);
 expect(careerPlayerStats(c)).toEqual([]);expect(careerPlayerStats(c,true)).toEqual(old);expect(c.archivedSeasons?.[0].season).toBe(1);
});
