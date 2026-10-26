import {newWorld} from '../src/data/index';
import {createSeries,autoVeto,newMapState} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {ATTRIBUTE_KEYS} from '../src/domain/types';
import {defaultDecision} from '../src/domain/tactics';
import {emptyEquipment} from '../src/domain/economy';
import {validateRound} from '../src/domain/invariants';
import {reportMetadata} from './report-metadata.mts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const world=newWorld();
for(const p of world.players){for(const k of ATTRIBUTE_KEYS)p.attributes[k]=75;for(const m of Object.keys(p.mapProficiency))p.mapProficiency[m as keyof typeof p.mapProficiency]=75;}
for(const t of world.teams){for(const k of ['chemistry','execution','communication','adaptability','economyDiscipline','belief'] as const)t.dynamics[k]=75;t.dynamics.tacticFamiliarity={};for(const m of Object.keys(t.dynamics.mapPreparation))t.dynamics.mapPreparation[m as keyof typeof t.dynamics.mapPreparation]=75;t.startingFive.forEach((id,i)=>world.players.find(p=>p.id===id)!.role=(['IGL','Entry','AWPer','Support','Lurker'] as const)[i]);}
const rows=[];
for(const map of ['dust2','mirage','nuke'] as const)for(const side of ['T','CT'] as const){
 const result={map,side,samples:200,legacy:{ctWins:0,trades:0,plants:0},current:{ctWins:0,trades:0,plants:0}};
 for(let seed=1;seed<=200;seed++)for(const version of ['legacy','current'] as const){
  const s=createSeries(world,'team-3','team-7',1,seed);if(version==='legacy')delete s.engineVersion;
  autoVeto(s);s.maps=[map];s.mapStates=[newMapState(s,map,side)];resolveRound(s);
  for(const f of s.mapStates[0].fighters){f.cash=6000;f.equipment=emptyEquipment(f.side);}
  const t={...defaultDecision('T'),tactic:'fastA',buy:'fullBuy' as const},ct={...defaultDecision('CT'),tactic:'standard',buy:'fullBuy' as const};
  const r=resolveRound(s,{0:side==='T'?t:ct,1:side==='CT'?t:ct});assert.deepEqual(validateRound(r),[]);
  result[version].ctWins+=Number(r.sides[r.winner]==='CT');result[version].trades+=r.events.filter(e=>e.kind==='trade').length;result[version].plants+=Number(r.events.some(e=>e.kind==='plant'));
 }
 rows.push(result);
}
writeFileSync('docs/upgrade-causal-comparison.json',JSON.stringify({...reportMetadata(),method:'Equal attributes and mirrored roles, 200 paired seeds per map/side; same fixed full-buy tactics, second-round $6000. Legacy and current engine, same current player data.',rows},null,2));
console.table(rows.map(r=>({map:r.map,side:r.side,legacyCT:r.legacy.ctWins/r.samples,currentCT:r.current.ctWins/r.samples})));
