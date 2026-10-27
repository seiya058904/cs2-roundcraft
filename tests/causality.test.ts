import legacyTerminalPlayers from './fixtures/legacy-terminal-players.json';
import {describe,it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto,newMapState,chooseVetoOrder,vetoStep,chooseStartingSide,sideChooser} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {ATTRIBUTE_KEYS,type World} from '../src/domain/types';
import {validateRound} from '../src/domain/invariants';
import {seriesStats} from '../src/domain/statistics';
import {defaultDecision} from '../src/domain/tactics';

function events(world:World,seed:number){const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);return s.mapStates.flatMap(m=>m.rounds.flatMap(r=>r.events));}
describe('能力通过事件参与模拟',()=>{
 it.each(ATTRIBUTE_KEYS)('%s 改变实际事件而非只改变 UI',attribute=>{let changed=false;for(let seed=1;seed<=10&&!changed;seed++){const a=newWorld(),b=newWorld();for(const p of a.players)p.attributes[attribute]=20;for(const p of b.players)p.attributes[attribute]=95;changed=JSON.stringify(events(a,seed))!==JSON.stringify(events(b,seed));}expect(changed).toBe(true);});
 it.each(['chemistry','execution','communication','adaptability','economyDiscipline','belief','mapPreparation','tacticFamiliarity']as const)('团队 %s 改变实际事件',dimension=>{let changed=false;for(let seed=1;seed<=10&&!changed;seed++){const a=newWorld(),b=newWorld();for(const [world,value]of [[a,20],[b,95]]as const)for(const t of world.teams){if(dimension==='mapPreparation')for(const map of Object.keys(t.dynamics.mapPreparation))t.dynamics.mapPreparation[map as keyof typeof t.dynamics.mapPreparation]=value;else if(dimension==='tacticFamiliarity'){for(const key of Object.keys(t.dynamics.tacticFamiliarity))t.dynamics.tacticFamiliarity[key]=value;}else t.dynamics[dimension]=value;}changed=JSON.stringify(events(a,seed))!==JSON.stringify(events(b,seed));}expect(changed).toBe(true);});
});
describe('地图顺序与选边权',()=>{
 it.each([1,3,5]as const)('BO%i 高种子可选择 B 方，低种子不可越权',bo=>{const s=createSeries(newWorld(),'team-3','team-7',bo,5);expect(()=>chooseVetoOrder(s,1,'A')).toThrow();chooseVetoOrder(s,0,'B');expect(vetoStep(s)?.team).toBe(1);autoVeto(s);for(const map of s.maps){const chooser=sideChooser(s,map);chooseStartingSide(s,map,chooser,'T');expect(s.startingSides?.[map]).toBe(chooser===0?'T':'CT');expect(()=>chooseStartingSide(s,map,(1-chooser)as 0|1,'CT')).toThrow();}resolveRound(s);expect(()=>chooseStartingSide(s,s.maps[0],sideChooser(s,s.maps[0]),'CT')).toThrow();});
});
it('火焰伤害、灭火与队友发枪均出现在合法账本中',()=>{
 let burning=0,extinguished=0,donations=0;
 for(let seed=1;seed<=30;seed++){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);s.maps=['dust2'];s.mapStates=[newMapState(s,'dust2')];simulateSeries(s);
  for(const r of s.mapStates[0].rounds){expect(validateRound(r)).toEqual([]);for(const e of r.events){if(e.kind==='damage'&&e.weapon==='fire'){burning++;expect(r.events.find(x=>x.id===e.causes[0])?.kind).toBe('fire');}if(e.kind==='extinguish'){extinguished++;expect(e.causes.map(id=>r.events.find(x=>x.id===id)?.kind)).toEqual(['smoke','fire']);}if(e.kind==='donation'){donations++;expect(Number(e.detail.price)).toBeGreaterThan(0);expect(r.economy.find(b=>b.playerId===e.actor)!.spend).toBeGreaterThanOrEqual(Number(e.detail.price));}}}
  expect(seriesStats(s).reduce((sum,p)=>sum+p.utilityDamage,0)).toBe(s.mapStates[0].rounds.flatMap(r=>r.events).filter(e=>e.kind==='damage'&&['HE','fire'].includes(e.weapon??'')).reduce((sum,e)=>sum+e.damage!,0));
 }expect(burning).toBeGreaterThan(0);expect(extinguished).toBeGreaterThan(0);expect(donations).toBeGreaterThan(0);
},20000);

it('双方补枪反应遵守已记录时延，默契影响防守方反应',()=>{
 const means:number[]=[];
 for(const chemistry of [35,95]){
  let seconds=0,count=0;
  for(let seed=1;seed<=20;seed++){
   const world=newWorld();world.teams.find(t=>t.id==='team-7')!.dynamics.chemistry=chemistry;
   const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
   for(const round of s.mapStates[0].rounds){
    const responses=new Map<string,{target:string;ready:number}>();
    for(const event of round.events){
     if(event.kind==='info'&&event.detail.reactionSeconds!==undefined){responses.set(event.actor!,{target:event.target!,ready:Number(event.detail.readyAt)});if(event.team===1&&round.sides[1]==='CT'){seconds+=Number(event.detail.reactionSeconds);count++;}}
     if(event.kind==='duel'){const response=responses.get(event.actor!);if(response&&response.target===event.target)expect(event.at).toBeGreaterThanOrEqual(response.ready);}
    }
   }
  }
  expect(count).toBeGreaterThan(0);means.push(seconds/count);
 }
 expect(means[1]).toBeLessThan(means[0]);
},20000);

it('seed 224 灭队手雷之后不再追加同秒火焰伤亡',()=>{
 const world=newWorld();for(const row of legacyTerminalPlayers)Object.assign(world.players.find(p=>p.id===row.id)!,structuredClone(row));const s=createSeries(world,'team-3','team-7',1,224);delete s.engineVersion;autoVeto(s);for(let i=0;i<5;i++)resolveRound(s);
 const r=s.mapStates[0].rounds[4];expect(r.reason).toBe('elimination');const terminal=r.events.findIndex(e=>e.kind==='kill'&&e.alive?.some(n=>n===0));expect(terminal).toBeGreaterThanOrEqual(0);
 expect(r.events.slice(terminal+1).some(e=>['damage','kill','duel'].includes(e.kind))).toBe(false);expect(validateRound(r)).toEqual([]);
});

it('CT 关闭临场调整后不会按接触情报提前轮转',()=>{
 let enabledRotations=0;
 for(let seed=1;seed<=30;seed++)for(const adaptive of [false,true]){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);s.maps=['dust2'];s.mapStates=[newMapState(s,'dust2','T')];
  const round=resolveRound(s,{0:{...defaultDecision('T'),tactic:'fastB'},1:{...defaultDecision('CT'),adaptive}});
  const rotations=round.events.filter(e=>e.kind==='info'&&e.team===1&&e.detail.delay!==undefined);
  if(adaptive)enabledRotations+=rotations.length;else expect(rotations).toEqual([]);
 }
 expect(enabledRotations).toBeGreaterThan(0);
});
