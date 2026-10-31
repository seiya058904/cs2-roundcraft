/** Fits the display-only win-probability model in src/data/win-probability.json from simulated rounds. */
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto} from '../src/domain/series.ts';
import {simulateSeries} from '../src/domain/engine.ts';
import {BATTLE_ENGINE} from '../src/domain/battlePlan.ts';
import {teamValue,sigmoid,logit} from '../src/domain/insights.ts';
import type {TeamIndex} from '../src/domain/types.ts';
const samples=Number(process.argv.find(x=>x.startsWith('--samples='))?.split('=')[1]??400);
const pairs=[['team-3','team-7'],['team-1','team-12'],['team-5','team-20'],['team-2','team-9'],['team-8','team-30'],['team-14','team-15']];
const prior:[number,number][]=[];const live:{key:string;gap:number;y:number}[]=[];
for(let seed=1;seed<=samples;seed++){const [a,b]=pairs[seed%pairs.length];const s=createSeries(newWorld(),a,b,1,seed);autoVeto(s);simulateSeries(s);
 for(const m of s.mapStates)for(const r of m.rounds){const ct=(r.sides[0]==='CT'?0:1) as TeamIndex,t=(1-ct) as TeamIndex,y=r.winner===ct?1:0;
  if(r.number!==1&&r.number!==13)prior.push([(teamValue(r.initial,ct)-teamValue(r.initial,t))/1000,y]);
  const fighters=structuredClone(r.initial);let planted=false;
  for(const e of r.events){if(e.kind==='kill'){const f=fighters.find(f=>f.id===e.target);if(f)f.alive=false;}if(e.kind==='plant')planted=true;
   if(e.kind==='kill'||e.kind==='plant'){const tA=fighters.filter(f=>f.team===t&&f.alive).length,cA=fighters.filter(f=>f.team===ct&&f.alive).length;if(tA&&cA)live.push({key:`${tA}${cA}${planted?1:0}`,gap:(teamValue(fighters,ct,true)-teamValue(fighters,t,true))/1000,y});}
   if(e.kind==='roundEnd')break;}}}
// 1) Prior: logistic regression on the equipment gap (gradient descent, 2 parameters).
let b0=0,b1=0;for(let i=0;i<3000;i++){let g0=0,g1=0;for(const [x,y] of prior){const p=sigmoid(b0+b1*x);g0+=p-y;g1+=(p-y)*x;}b0-=.5*g0/prior.length;b1-=.5*g1/prior.length;}
// 2) Live table with Laplace smoothing, then one shared logit shift per $1000 of surviving equipment gap.
const counts=new Map<string,[number,number]>();for(const s of live){const c=counts.get(s.key)??[0,0];c[0]++;c[1]+=s.y;counts.set(s.key,c);}
const table:Record<string,number>={};for(const [k,[n,w]] of counts)if(n>=20)table[k]=Number(((w+1)/(n+2)).toFixed(4));
const fit=live.filter(s=>table[s.key]!==undefined);let k1=0;for(let i=0;i<1500;i++){let g=0;for(const s of fit){const p=sigmoid(logit(table[s.key])+k1*s.gap);g+=(p-s.y)*s.gap;}k1-=.5*g/fit.length;}
const brier=(rows:{p:number;y:number}[])=>rows.reduce((s,r)=>s+(r.p-r.y)**2,0)/rows.length;
const report={version:BATTLE_ENGINE,samples,priorRounds:prior.length,liveStates:live.length,prior:{intercept:Number(b0.toFixed(4)),perThousand:Number(b1.toFixed(4))},live:{table,perThousand:Number(k1.toFixed(4))},
 brier:{prior:Number(brier(prior.map(([x,y])=>({p:sigmoid(b0+b1*x),y}))).toFixed(4)),priorBaseline:Number(brier(prior.map(([,y])=>({p:prior.reduce((s,r)=>s+r[1],0)/prior.length,y}))).toFixed(4)),live:Number(brier(fit.map(s=>({p:sigmoid(logit(table[s.key])+k1*s.gap),y:s.y}))).toFixed(4))}};
writeFileSync('src/data/win-probability.json',JSON.stringify(report,null,1)+'\n');console.log({...report,live:{states:Object.keys(table).length,perThousand:report.live.perThousand}});
