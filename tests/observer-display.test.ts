import {expect,it} from 'vitest';
import {newWorld} from '../src/data';
import {autoVeto,createSeries} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {commentarySnapshot,visibleMapStats} from '../src/domain/replay';
it('观战击杀死亡只累计本图已显示事件，回看旧回合不计入后续结果',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',3,732);autoVeto(s);simulateSeries(s);
 const all=s.mapStates.flatMap(m=>m.rounds),r=all[1],previous=all[0];const before=JSON.stringify(s);
 const start=commentarySnapshot(r,1),stats=visibleMapStats(all,r,start.events);
 expect(Object.values(stats).reduce((n,p)=>n+p.kills,0)).toBe(previous.events.filter(e=>e.kind==='kill').length);
 const full=visibleMapStats(all,r,commentarySnapshot(r,Infinity).events);
 expect(Object.values(full).reduce((n,p)=>n+p.deaths,0)).toBe([previous,r].flatMap(x=>x.events).filter(e=>e.kind==='kill').length);
 const map2=s.mapStates[1].rounds[0];expect(Object.values(visibleMapStats(all,map2,[]))).toHaveLength(0);
 expect(JSON.stringify(s)).toBe(before);
});
it('武器道具和炸弹按事件推进，现金护甲使用明确的开局和结算快照',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,21);autoVeto(s);resolveRound(s);const r=resolveRound(s);const original=JSON.stringify(s);
 // Isolate a replay prefix with real fighter identities; deliberately different final money.
 const actor=r.initial[0],target=r.initial[5];actor.equipment.utility=['smoke','flash','flash'];actor.hasBomb=true;
 r.events=[
  {id:'start',at:0,kind:'position',actor:actor.id,zone:actor.zone,causes:[],detail:{}},
  {id:'throw',at:1,kind:'flash',actor:actor.id,causes:[],detail:{}},
  {id:'pickup',at:2,kind:'pickup',actor:actor.id,weapon:'AWP',causes:[],detail:{}},
  {id:'hit',at:3,kind:'damage',actor:actor.id,target:target.id,hpBefore:100,hpAfter:42,damage:58,causes:[],detail:{}},
  {id:'plant',at:4,kind:'plant',actor:actor.id,causes:[],detail:{}},
  {id:'death',at:5,kind:'kill',actor:actor.id,target:target.id,causes:[],detail:{}},
  {id:'end',at:6,kind:'roundEnd',causes:[],detail:{}}
 ];
 r.commentary=r.events.map(e=>({...r.commentary[0],at:e.at,eventIds:[e.id]}));
 const snap=commentarySnapshot(r,4);expect(snap.fighters[0].equipment.utility).toEqual(['smoke','flash']);expect(snap.fighters[0].equipment.weapon).toBe('AWP');expect(snap.fighters[5].hp).toBe(42);expect(snap.fighters[5].alive).toBe(true);
 expect(snap.fighters[0].cash).toBe(actor.cash);expect(snap.fighters[5].equipment.armor).toBe(target.equipment.armor);
 expect(commentarySnapshot(r,5).fighters[0].hasBomb).toBe(false);expect(commentarySnapshot(r,6).fighters[5].alive).toBe(false);
 expect(commentarySnapshot(r,7).fighters).toEqual(r.final);
 const frozen=JSON.stringify(s);commentarySnapshot(r,3);expect(JSON.stringify(s)).toBe(frozen);expect(original).not.toBe(frozen);
});
