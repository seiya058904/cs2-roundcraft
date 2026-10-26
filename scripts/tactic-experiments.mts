import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto,newMapState} from '../src/domain/series.ts';
import {resolveRound} from '../src/domain/engine.ts';
import {emptyEquipment} from '../src/domain/economy.ts';
import {defaultDecision} from '../src/domain/tactics.ts';
import {getMap} from '../src/domain/maps.ts';
import {validateRound} from '../src/domain/invariants.ts';
import {ATTRIBUTE_KEYS,type Decision} from '../src/domain/types.ts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const cases=[
 {name:'快速 A / 重防 A',t:'fastA',ct:'stackA'},
 {name:'快速 A / 重防 B',t:'fastA',ct:'stackB'},
 {name:'快速 B / 重防 B',t:'fastB',ct:'stackB'},
 {name:'快速 B / 重防 A',t:'fastB',ct:'stackA'},
 {name:'双路夹 A / 重防 A',t:'splitA',ct:'stackA'},
 {name:'假 A 真 B / 快速轮转',t:'fakeA',ct:'fastRotate'},
 {name:'默认控图 / 前压中路',t:'default',ct:'midContest'},
 {name:'静步接触 / 近点埋伏',t:'contact',ct:'passive'},
 {name:'半起 B 点近角 / 满起快 B',t:'fastB',ct:'stackB',half:true,position:'lane'},
 {name:'半起远点 B 包点 / 满起快 B',t:'fastB',ct:'stackB',half:true,position:'site'},
 {name:'半起 A 平台近角 / 满起快 A',t:'fastA',ct:'stackA',half:true,position:'lane',site:'A'},
 {name:'半起 A 平台远枪线 / 满起快 A',t:'fastA',ct:'stackA',half:true,position:'site',site:'A'},
];
const sample=500,world=newWorld(),map=getMap('dust2');
for(const p of world.players){for(const key of ATTRIBUTE_KEYS)p.attributes[key]=75;for(const key of Object.keys(p.mapProficiency))p.mapProficiency[key as keyof typeof p.mapProficiency]=75;}
for(const t of world.teams){for(const key of ['chemistry','execution','communication','adaptability','economyDiscipline','belief']as const)t.dynamics[key]=75;for(const m of Object.keys(t.dynamics.mapPreparation))t.dynamics.mapPreparation[m as keyof typeof t.dynamics.mapPreparation]=75;t.dynamics.tacticFamiliarity={};}
const reports=cases.map(c=>({...c,samples:sample,ctWins:0,ctKills:0,plants:0,meanEndTime:0,ctUtilityDamage:0,trades:0}));
for(let seed=1;seed<=sample;seed++){
 const baseline=createSeries(world,'team-3','team-7',1,seed);autoVeto(baseline);baseline.maps=['dust2'];baseline.mapStates=[newMapState(baseline,'dust2','T')];resolveRound(baseline);
 for(const c of reports){
  const s=structuredClone(baseline),m=s.mapStates[0];for(const f of m.fighters){f.cash=f.team===1&&c.half?2000:6000;f.equipment=emptyEquipment(f.side);}
  const t:Decision={...defaultDecision('T'),tactic:c.t,buy:'fullBuy',adaptive:false};
  const ct:Decision={...defaultDecision('CT'),tactic:c.ct,buy:c.half?'forceBuy':'fullBuy',adaptive:!c.half};
  if(c.position)ct.positions=Object.fromEntries(s.teams[1].startingFive.map((id,i)=>[id,i<3?(c.site==='A'?map.siteA:map.siteB):(c.site==='A'?map.siteB:map.siteA)]));
  if(c.position==='lane')ct.stances=Object.fromEntries(s.teams[1].startingFive.slice(0,3).map(id=>[id,'close']));
  const r=resolveRound(s,{0:t,1:ct});assert.deepEqual(validateRound(r),[]);if(r.winner===1)c.ctWins++;c.ctKills+=r.events.filter(e=>e.kind==='kill'&&e.team===1).length;c.plants+=Number(r.events.some(e=>e.kind==='plant'));c.meanEndTime+=r.events.at(-1)!.at/sample;c.ctUtilityDamage+=r.events.filter(e=>e.kind==='damage'&&e.team===1&&['HE','fire'].includes(e.weapon??'')).reduce((sum,e)=>sum+e.damage!,0);c.trades+=r.events.filter(e=>e.kind==='trade').length;
 }
}
writeFileSync('docs/tactic-experiments.json',JSON.stringify({...metadata,method:'500 paired seeds, equalized ability 75, Dust II second-round controlled cash; CT reactions enabled except fixed half-buy positions. Descriptive simulation estimates, not real esports win probabilities.',reports},null,2));console.table(reports.map(r=>({name:r.name,ctWinRate:r.ctWins/sample,ctKills:r.ctKills/sample,plants:r.plants/sample,endSeconds:Math.round(r.meanEndTime),trades:r.trades/sample})));
