/** Display/analyst calibration only. Never tune combat or overwrite the legacy model. */
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto,newMapState} from '../src/domain/series.ts';
import {simulateSeries} from '../src/domain/engine.ts';
import {teamValue,sigmoid,preRoundCtWin,liveCtWin} from '../src/domain/insights.ts';
import {MAPS} from '../src/domain/maps.ts';
import type {MapId} from '../src/domain/types.ts';
const pairs=[['team-3','team-7'],['team-1','team-12'],['team-5','team-20'],['team-2','team-9'],['team-8','team-30'],['team-14','team-15']];
type Row={map:MapId;gap:number;pistol:boolean;y:number;legacy:number};
function sample(firstSeed:number,count:number){
 const rows:Row[]=[],live:{p:number;y:number}[]=[];
 for(const map of MAPS)for(let i=0;i<count;i++)for(const mirror of [false,true]){
  const [a,b]=pairs[i%pairs.length],s=createSeries(newWorld(),mirror?b:a,mirror?a:b,1,firstSeed+i);
  assert.equal(s.engineVersion,'causal-plans-v6','Use a new model version when changing the combat engine');
  autoVeto(s);s.maps=[map.id];s.mapStates=[newMapState(s,map.id,mirror?'CT':'T')];simulateSeries(s);
  for(const r of s.mapStates[0].rounds){
   const ct=r.sides[0]==='CT'?0:1,t=ct===0?1:0,y=Number(r.winner===ct);
   rows.push({map:map.id,gap:(teamValue(r.initial,ct)-teamValue(r.initial,t))/1000,pistol:r.number===1||r.number===13,y,legacy:preRoundCtWin(r.initial,ct)});
   const fighters=structuredClone(r.initial);let planted=false;
   for(const e of r.events){if(e.kind==='kill')fighters.find(f=>f.id===e.target)!.alive=false;if(e.kind==='plant')planted=true;
    if(e.kind==='kill'||e.kind==='plant')live.push({p:liveCtWin(fighters,ct,planted),y});
   }
  }
 }
 return {rows,live};
}
// All maps and both team slots for a seed stay in the same partition.
const training=sample(100001,48),holdout=sample(910001,24),ordinary=training.rows.filter(r=>!r.pistol);
let intercept=0,slope=0;const offsets=Object.fromEntries(MAPS.map(m=>[m.id,0])) as Record<MapId,number>;
const mapCounts=Object.fromEntries(MAPS.map(m=>[m.id,ordinary.filter(r=>r.map===m.id).length]));
for(let iteration=0;iteration<2500;iteration++){
 let g0=0,g1=0;const gm=Object.fromEntries(MAPS.map(m=>[m.id,0]));
 for(const r of ordinary){const error=sigmoid(intercept+offsets[r.map]+slope*r.gap)-r.y;g0+=error;g1+=error*r.gap;gm[r.map]+=error;}
 intercept-=.3*g0/ordinary.length;slope-=.02*g1/ordinary.length;
 for(const m of MAPS)offsets[m.id]-=.2*(gm[m.id]/mapCounts[m.id]+.01*offsets[m.id]);
 const mean=MAPS.reduce((sum,m)=>sum+offsets[m.id],0)/MAPS.length;
 for(const m of MAPS)offsets[m.id]-=mean;intercept+=mean;
}
const rounded=(n:number)=>Number(n.toFixed(6));
const pistol=Object.fromEntries(MAPS.map(m=>{const rows=training.rows.filter(r=>r.pistol&&r.map===m.id);return [m.id,{p:rounded((rows.reduce((s,r)=>s+r.y,0)+1)/(rows.length+2)),samples:rows.length}];}));
const model={version:'wp-v6-1',engineVersion:'causal-plans-v6',training:{firstSeed:100001,seeds:48,matches:48*14},prior:{intercept:rounded(intercept),perThousand:rounded(slope),mapOffsets:Object.fromEntries(MAPS.map(m=>[m.id,rounded(offsets[m.id])]))},pistol,liveSource:'legacy-v5 (unchanged; checked on held-out v6 rounds)'};
const predict=(r:Row)=>r.pistol?model.pistol[r.map].p:sigmoid(model.prior.intercept+model.prior.mapOffsets[r.map]+model.prior.perThousand*r.gap);
function metrics(rows:Row[],pred:(r:Row)=>number){const n=rows.length;return {n,predicted:rows.reduce((s,r)=>s+pred(r),0)/n,actual:rows.reduce((s,r)=>s+r.y,0)/n,brier:rows.reduce((s,r)=>s+(pred(r)-r.y)**2,0)/n};}
const group=(rows:Row[])=>({before:metrics(rows,r=>r.legacy),after:metrics(rows,predict)});
const report={version:model.version,engineVersion:model.engineVersion,training:model.training,holdout:{firstSeed:910001,seeds:24,matches:24*14},pistol:group(holdout.rows.filter(r=>r.pistol)),ordinary:group(holdout.rows.filter(r=>!r.pistol)),byMap:MAPS.map(m=>({map:m.id,...group(holdout.rows.filter(r=>r.map===m.id))})),byEquipment:[[-Infinity,-5],[-5,5],[5,Infinity]].map(([min,max])=>({gap:[String(min),String(max)],...group(holdout.rows.filter(r=>!r.pistol&&r.gap>=min&&r.gap<max))})),live:{states:holdout.live.length,brier:holdout.live.reduce((s,r)=>s+(r.p-r.y)**2,0)/holdout.live.length}};
assert.ok(report.pistol.after.brier<report.pistol.before.brier*.7,'Pistol holdout must materially improve');
assert.ok(report.ordinary.after.brier<report.ordinary.before.brier,'Ordinary-round holdout must improve');
assert.ok(Math.abs(report.pistol.after.predicted-report.pistol.after.actual)<.08);
assert.ok(Math.abs(report.ordinary.after.predicted-report.ordinary.after.actual)<.05);
writeFileSync('src/data/win-probability-v6.json',JSON.stringify(model,null,2)+'\n');
const output=process.argv.find(a=>a.startsWith('--report='))?.slice(9);
if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
