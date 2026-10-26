import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto,newMapState} from '../src/domain/series.ts';
import {resolveRound} from '../src/domain/engine.ts';
import {defaultDecision} from '../src/domain/tactics.ts';
import {emptyEquipment} from '../src/domain/economy.ts';
import {MAPS} from '../src/domain/maps.ts';
import {ATTRIBUTE_KEYS,type Decision,type Side} from '../src/domain/types.ts';
import {validateRound} from '../src/domain/invariants.ts';
import {validateNarration} from '../src/domain/narrative.ts';
import {reportMetadata} from './report-metadata.mts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const world=newWorld();
for(const p of world.players){for(const key of ATTRIBUTE_KEYS)p.attributes[key]=75;for(const m of MAPS)p.mapProficiency[m.id]=75;}
for(const t of world.teams){for(const key of ['chemistry','execution','communication','adaptability','economyDiscipline','belief']as const)t.dynamics[key]=75;t.dynamics.tacticFamiliarity={};for(const m of MAPS)t.dynamics.mapPreparation[m.id]=75;t.startingFive.forEach((id,i)=>world.players.find(p=>p.id===id)!.role=(['IGL','AWPer','Entry','Support','Lurker']as const)[i]);}
const rows:unknown[]=[],examples:unknown[]=[],reviews:unknown[]=[];
const changes:{id:string;t?:Decision['phases'];ct?:Decision['phases']}[]=[{id:'smoke',t:{smoke:'respect'},ct:{smoke:'respect'}},{id:'utility',t:{utility:'reserve'},ct:{utility:'reserve'}},{id:'regroup',t:{execution:'regroup'}},{id:'rotation',ct:{rotation:'hold'}},{id:'retake',ct:{postPlant:'retake'}},{id:'clear',ct:{postPlant:'clear'}}];
const substantive=(r:ReturnType<typeof resolveRound>)=>JSON.stringify(r.events.filter(e=>!['tactic','info','sight'].includes(e.kind)).map(({id,causes,...rest})=>rest));
for(const map of MAPS)for(const startSide of ['T','CT']as Side[])for(const buy of ['fullBuy','eco']as const){
 const stats=changes.map(c=>({map:map.id,startSide,buy,rule:c.id,samples:0,changed:0,tWinsBefore:0,tWinsAfter:0,triggers:0}));
 for(let seed=1;seed<=30;seed++){
  const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);s.maps=[map.id];s.mapStates=[newMapState(s,map.id,startSide)];resolveRound(s);
  for(const f of s.mapStates[0].fighters){f.cash=6000;f.equipment=emptyEquipment(f.side);}
  const tTeam=startSide==='T'?0:1,ctTeam=1-tTeam;
  const t:Decision={...defaultDecision('T'),tactic:'fastA',buy,adaptive:false,phases:{smoke:'cross',utility:'normal',execution:'direct'}};
  const ct:Decision={...defaultDecision('CT'),buy:'fullBuy',adaptive:true,phases:{smoke:'cross',utility:'normal',rotation:'anchor',postPlant:'save'}};
  const base=resolveRound(structuredClone(s),{[tTeam]:t,[ctTeam]:ct});
  for(const [i,c]of changes.entries()){
   const attack=c.id==='regroup'?{...t,tactic:'splitA',positions:{[s.teams[tTeam].startingFive[0]]:map.ctSpawn,[s.teams[tTeam].startingFive[1]]:map.siteB,[s.teams[tTeam].startingFive[2]]:map.siteB},phases:{...t.phases,smoke:'respect' as const}}:t;
   const before=c.id==='regroup'?resolveRound(structuredClone(s),{[tTeam]:attack,[ctTeam]:ct}):c.id==='clear'?resolveRound(structuredClone(s),{[tTeam]:t,[ctTeam]:{...ct,phases:{...ct.phases,postPlant:'retake'}}}):base;
   const run=structuredClone(s);const r=resolveRound(run,{[tTeam]:{...attack,phases:{...attack.phases,...c.t}},[ctTeam]:{...ct,phases:{...ct.phases,...c.ct}}});
   assert.deepEqual(validateRound(r),[]);assert.deepEqual(validateNarration(r),[]);
   const changed=substantive(before)!==substantive(r),row=stats[i];row.samples++;row.changed+=Number(changed);row.tWinsBefore+=Number(before.winner===tTeam);row.tWinsAfter+=Number(r.winner===tTeam);
   const triggers=r.events.filter(e=>e.detail.rule===c.id);row.triggers+=triggers.length;
   if(changed&&examples.filter((e:any)=>e.rule===c.id).length<4)examples.push({rule:c.id,map:map.id,startSide,buy,seed,before,after:r});
   if(changed&&reviews.filter((e:any)=>e.rule===c.id).length<5)reviews.push({rule:c.id,map:map.id,seed,round:r,commentary:r.commentary.map(x=>x.text).join('\n')});
  }
 }
 rows.push(...stats);console.log(map.id,startSide,buy,stats.map(s=>s.rule+':'+s.changed).join(' '));
}
writeFileSync('docs/esm-review/phase-experiments.json',JSON.stringify({...reportMetadata(),method:'Equal 75 attributes and team values, identical roles, 30 paired seeds per map/start-side/economy; second-round $6000; one named policy differs; regroup uses splitA with remote positions and smoke respect in BOTH arms; counts exclude tactic/info/sight logging changes.',rows},null,2));
writeFileSync('docs/esm-review/behavior-examples.json',JSON.stringify(examples,null,2));
writeFileSync('docs/esm-review/round-review-candidates.json',JSON.stringify(reviews,null,2));
console.log('examples',examples.length,'review candidates',reviews.length);
