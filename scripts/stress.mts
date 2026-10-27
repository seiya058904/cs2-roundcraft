import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto,newMapState} from '../src/domain/series.ts';
import {simulateSeries} from '../src/domain/engine.ts';
import {validateRound} from '../src/domain/invariants.ts';
import {validateNarration} from '../src/domain/narrative.ts';
import {seriesStats} from '../src/domain/statistics.ts';
import {makeSave,validateSave} from '../src/domain/save.ts';
import {MAPS} from '../src/domain/maps.ts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const samples=Number(process.argv.find(x=>x.startsWith('--samples='))?.split('=')[1]??10000);
const iteration=process.argv.find(x=>x.startsWith('--iteration='))?.split('=')[1];
if(iteration&&!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const started=performance.now(),world=newWorld();
const maps=Object.fromEntries(MAPS.map(m=>[m.id,{maps:0,rounds:0,ctWins:0,plants:0,defuses:0,overtime:0}]));
let rounds=0,fireDamage=0,extinguishes=0,donations=0,posthumousFireKills=0;
for(let index=0;index<samples;index++){
 const seed=100000+index,map=MAPS[index%MAPS.length];
 const a=index%50,b=(index*7+1)%50===a?(a+1)%50:(index*7+1)%50;
 const s=createSeries(world,world.teams[a].id,world.teams[b].id,1,seed);autoVeto(s);
 // A controlled map harness intentionally bypasses AI veto to exercise every topology and starting side.
 s.maps=[map.id];s.mapStates=[newMapState(s,map.id,index%2?'CT':'T')];
 try{
  simulateSeries(s);assert.ok(s.winner!==null);const m=s.mapStates[0],report=maps[map.id];report.maps++;if(m.rounds.length>24)report.overtime++;
  for(const r of m.rounds){
   assert.deepEqual(validateRound(r),[]);assert.deepEqual(validateNarration(r),[]);rounds++;report.rounds++;if(r.sides[r.winner]==='CT')report.ctWins++;
   if(r.events.some(e=>e.kind==='plant'))report.plants++;if(r.reason==='defuse')report.defuses++;
   const dead=new Set<string>();for(const e of r.events){if(e.kind==='kill'){if(e.weapon==='fire'&&dead.has(e.actor!))posthumousFireKills++;dead.add(e.target!);}if(e.kind==='damage'&&e.weapon==='fire')fireDamage+=e.damage!;if(e.kind==='extinguish')extinguishes++;if(e.kind==='donation')donations++;}
  }
  const stats=seriesStats(s);assert.equal(stats.reduce((sum,p)=>sum+p.kills,0),stats.reduce((sum,p)=>sum+p.deaths,0));assert.ok(stats.every(p=>p.kast>=0&&p.kast<=100));
  if(index%100===0)validateSave(makeSave(null,s,null));
 }catch(error){writeFileSync(iteration?`docs/stress-failure-iteration${iteration}.json`:'docs/stress-failure.json',JSON.stringify({index,seed,map:map.id,series:s,error:String(error)},null,2));throw error;}
 if((index+1)%500===0)console.log(`已验证 ${index+1}/${samples} 地图 · ${rounds} 回合`);
}
const report={...metadata,samples,rounds,fireDamage,extinguishes,donations,posthumousFireKills,maps,durationSeconds:(performance.now()-started)/1000};writeFileSync(iteration?`docs/stress-report-iteration${iteration}.json`:'docs/stress-report.json',JSON.stringify(report,null,2));console.log(report);
