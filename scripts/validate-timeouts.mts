import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto} from '../src/domain/series.ts';
import {resolveRound} from '../src/domain/engine.ts';
import {applyTimeout,canTimeout,timeoutAdvice} from '../src/domain/coach.ts';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const report:Record<string,{used:number;rounds:number;wins:number;cash:number}>={};
for(const kind of ['position','belief','economy']as const){report[kind]={used:0,rounds:0,wins:0,cash:0};for(let seed=1;seed<=100;seed++){const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);const m=s.mapStates[0];assert.equal(timeoutAdvice(m,0).length,3);applyTimeout(m,0,kind);assert.equal(canTimeout(m,0),false);const r=resolveRound(s);assert.equal(m.timeoutsUsed[0],1);assert.ok(r.events.some(e=>e.kind==='coachTimeout'));if(kind==='position')assert.ok(['splitA','splitB'].includes(r.decisions[0].tactic));report[kind].used++;report[kind].rounds++;report[kind].wins+=r.winner===0?1:0;report[kind].cash+=r.economy.filter(e=>e.playerId.startsWith('team-3-')).reduce((sum,e)=>sum+e.cashAtEnd,0);}}
writeFileSync('docs/timeout-validation.json',JSON.stringify({...metadata,note:'相同 seeds，三种实际机制；单局胜率仅描述，不能单独推断暂停因果收益。',sample:100,report},null,2));console.log(report);
