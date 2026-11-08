import {expect,it} from 'vitest';
import {newWorld} from '../src/data';
import {autoVeto,createSeries,newMapState} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {MAPS} from '../src/domain/maps';
import {validateRound} from '../src/domain/invariants';
import {validateSeries} from '../src/domain/saveValidation';
import {ATTRIBUTE_KEYS,type TeamIndex} from '../src/domain/types';
import {defaultDecision} from '../src/domain/tactics';
import {emptyEquipment} from '../src/domain/economy';
import {hash} from '../src/domain/random';

it.each(MAPS)('$name: serialized fighter order cannot change current-engine events or continuation',map=>{
 for(const seed of [1,224,732]){
  const a=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(a);
  a.maps=[map.id];a.mapStates=[newMapState(a,map.id,seed%2?'T':'CT')];
  const b=structuredClone(a);b.mapStates[0].fighters.reverse();
  const first=resolveRound(a);expect(resolveRound(b)).toEqual(first);
  expect(validateRound(first)).toEqual([]);
  const restored=JSON.parse(JSON.stringify(b));
  restored.mapStates[0].fighters.sort((x:{id:string},y:{id:string})=>y.id.localeCompare(x.id));
  expect(resolveRound(restored)).toEqual(resolveRound(a));
  expect(()=>validateSeries(restored)).not.toThrow();
 }
});

it('paired equal-budget rounds do not grant a persistent advantage to the first team slot',()=>{
 const world=newWorld(),keys=['chemistry','execution','communication','adaptability','economyDiscipline','belief'] as const;
 for(const p of world.players){for(const k of ATTRIBUTE_KEYS)p.attributes[k]=75;for(const m of MAPS)p.mapProficiency[m.id]=75;}
 for(const t of world.teams){for(const k of keys)t.dynamics[k]=75;for(const m of MAPS)t.dynamics.mapPreparation[m.id]=75;t.dynamics.tacticFamiliarity={};t.startingFive.forEach((id,i)=>{world.players.find(p=>p.id===id)!.role=(['IGL','AWPer','Entry','Support','Lurker'] as const)[i];});}
 const wins=[0,0];
 for(let seed=1;seed<=200;seed++)for(const ct of [0,1] as const){
  const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);s.maps=['dust2'];s.mapStates=[newMapState(s,'dust2',ct===0?'CT':'T')];
  resolveRound(s);s.rngState=hash('order-validation-'+seed);s.mapStates[0].effects=[null,null];
  for(const team of s.teams){for(const k of keys)team.dynamics[k]=75;team.dynamics.tacticFamiliarity={};}
  for(const f of s.mapStates[0].fighters){f.cash=6000;f.equipment=emptyEquipment(f.side);}
  const t=(1-ct) as TeamIndex;
  const r=resolveRound(s,{[t]:{...defaultDecision('T'),tactic:'fastA',buy:'fullBuy',adaptive:false},[ct]:{...defaultDecision('CT'),tactic:'stackA',buy:'fullBuy',adaptive:true}});
  wins[ct]+=Number(r.winner===ct);
 }
 // Fixed seeds make this repeatable; the broad bound catches the former ~30-point gap.
 expect(Math.abs(wins[0]-wins[1]),JSON.stringify(wins)).toBeLessThan(25);
},20000); // 800 simulated rounds; allow slower CI CPUs without reducing sample coverage.
