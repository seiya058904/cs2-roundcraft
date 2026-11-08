import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index.ts';
import {autoVeto,createSeries,newMapState} from '../src/domain/series.ts';
import {resolveRound} from '../src/domain/engine.ts';
import {BATTLE_ENGINE} from '../src/domain/battlePlan.ts';
import {MAPS} from '../src/domain/maps.ts';
import {emptyEquipment} from '../src/domain/economy.ts';
import {defaultDecision} from '../src/domain/tactics.ts';
import {ATTRIBUTE_KEYS,type MapId,type Side,type TeamIndex} from '../src/domain/types.ts';
import {hash} from '../src/domain/random.ts';
import {validateRound} from '../src/domain/invariants.ts';
import {reportMetadata} from './report-metadata.mts';

const samples=Number(process.argv.find(a=>a.startsWith('--samples='))?.split('=')[1]??300);
assert.ok(Number.isInteger(samples)&&samples>=100);
const world=newWorld();
for(const p of world.players){for(const key of ATTRIBUTE_KEYS)p.attributes[key]=75;for(const map of MAPS)p.mapProficiency[map.id]=75;}
const teamKeys=['chemistry','execution','communication','adaptability','economyDiscipline','belief'] as const;
for(const t of world.teams){for(const key of teamKeys)t.dynamics[key]=75;for(const map of MAPS)t.dynamics.mapPreparation[map.id]=75;t.dynamics.tacticFamiliarity={};t.startingFive.forEach((id,i)=>{world.players.find(p=>p.id===id)!.role=(['IGL','AWPer','Entry','Support','Lurker'] as const)[i];});}
function sample(map:MapId,seed:number,start:Side,version:string,ctCash:number,ctTactic:string){
 const s=createSeries(world,'team-3','team-7',1,seed);s.engineVersion=version;autoVeto(s);s.maps=[map];s.mapStates=[newMapState(s,map,start)];
 resolveRound(s);s.rngState=hash('order-validation-'+seed);
 const m=s.mapStates[0];m.effects=[null,null];
 for(const t of s.teams){for(const key of teamKeys)t.dynamics[key]=75;t.dynamics.tacticFamiliarity={};}
 for(const f of m.fighters){f.cash=f.side==='CT'?ctCash:6000;f.equipment=emptyEquipment(f.side);}
 const ct:TeamIndex=start==='CT'?0:1,t=(1-ct) as TeamIndex;
 const r=resolveRound(s,{[t]:{...defaultDecision('T'),tactic:'fastA',buy:'fullBuy',adaptive:false},[ct]:{...defaultDecision('CT'),tactic:ctTactic,buy:ctCash===6000?'fullBuy':'forceBuy',adaptive:true}});
 assert.deepEqual(validateRound(r),[]);
 return Number(r.winner===ct);
}
type OrderReport={map:MapId;version:string;ctCash:number;samples:number;ctWinsBySlot:number[];gap:number};
const reports:OrderReport[]=[];
for(const map of MAPS)for(const version of ['causal-plans-v5',BATTLE_ENGINE])for(const ctCash of [6000,2000]){
 const wins=[0,0];for(let seed=1;seed<=samples;seed++)for(const ct of [0,1] as const)wins[ct]+=sample(map.id,seed,ct===0?'CT':'T',version,ctCash,'stackA');
 reports.push({map:map.id,version,ctCash,samples,ctWinsBySlot:wins,gap:(wins[0]-wins[1])/samples});
}
// A useful tactic must still matter after the order fix: compare defending the attacked vs opposite site.
const tactics=[];
for(const ctTactic of ['stackA','stackB']){let wins=0;for(let seed=1;seed<=samples;seed++)wins+=sample('dust2',seed,'T',BATTLE_ENGINE,6000,ctTactic);tactics.push({ctTactic,samples,ctWins:wins});}
const current=reports.filter(r=>r.version===BATTLE_ENGINE),legacy=reports.filter(r=>r.version==='causal-plans-v5');
const meanAbsoluteGap=(rows:typeof reports)=>rows.reduce((sum,r)=>sum+Math.abs(r.gap),0)/rows.length;
const summary={legacyMeanAbsoluteSlotGap:meanAbsoluteGap(legacy),currentMeanAbsoluteSlotGap:meanAbsoluteGap(current),maxCurrentAbsoluteSlotGap:Math.max(...current.map(r=>Math.abs(r.gap)))};
assert.ok(summary.currentMeanAbsoluteSlotGap<.08,'Average slot gap remains too large');
assert.ok(summary.maxCurrentAbsoluteSlotGap<.16,'A map/budget cell needs further investigation');
assert.ok(tactics[0].ctWins>tactics[1].ctWins+samples*.15,'Defending the attacked site lost its modeled advantage');
writeFileSync('docs/order-validation.json',JSON.stringify({...reportMetadata(),method:'Paired seeds; equal abilities/roles/map/team values; controlled second-round T $6000, CT $6000/$2000; fast A vs stack A; seven maps and both team slots; prior round stays valid, RNG reset for comparison. Diagnostic game estimates, not live career or professional win probabilities.',summary,reports,tactics},null,2)+'\n');
console.log(summary);console.table(tactics);
