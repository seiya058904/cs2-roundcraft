import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
import{newWorld}from'../src/data/index.ts';
import{createSeries,autoVeto,newMapState}from'../src/domain/series.ts';
import{simulateSeries,resolveRound}from'../src/domain/engine.ts';
import{validateRound}from'../src/domain/invariants.ts';
import{writeFileSync}from'node:fs';
const sample=Number(process.argv.find(x=>x.startsWith('--samples='))?.split('=')[1]??500);const start=performance.now();
let wins=0,ctRounds=0,totalRounds=0,plants=0,defuses=0,explodes=0,ots=0;const reasons:Record<string,number>={};
for(let seed=1;seed<=sample;seed++){const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);if(s.winner===0)wins++;for(const m of s.mapStates){if(m.rounds.length>24)ots++;for(const r of m.rounds){const issues=validateRound(r);if(issues.length)throw new Error(`seed=${seed} round=${r.number}: ${issues.join(',')}`);totalRounds++;if(r.sides[r.winner]==='CT')ctRounds++;if(r.events.some(e=>e.kind==='plant'))plants++;if(r.reason==='defuse')defuses++;if(r.reason==='explode')explodes++;reasons[r.reason]=(reasons[r.reason]??0)+1;}}}
const report={...metadata,sample,wins,firstTeamWinRate:wins/sample,totalRounds,ctWinRate:ctRounds/totalRounds,plants,defuses,explodes,ots,reasons,durationSeconds:(performance.now()-start)/1000};writeFileSync('docs/calibration.json',JSON.stringify(report,null,2));console.log(report);
