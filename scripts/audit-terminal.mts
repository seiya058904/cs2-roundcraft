import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto} from '../src/domain/series.ts';
import {simulateSeries} from '../src/domain/engine.ts';
import {writeFileSync} from 'node:fs';
import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
const findings:unknown[]=[];
let rounds=0;
for(let seed=1;seed<=3000;seed++){
 const series=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(series);simulateSeries(series);
 for(const round of series.mapStates[0].rounds){rounds++;if(round.events.some(e=>e.kind==='plant'))continue;const first=round.events.findIndex(e=>e.kind==='kill'&&e.alive?.some(n=>n===0));if(first<0)continue;
  const later=round.events.slice(first+1).filter(e=>['damage','kill','duel'].includes(e.kind));
  if(later.length&&findings.length<20)findings.push({seed,map:round.map,round:round.number,terminalKill:round.events[first],later});
 }
}
writeFileSync('docs/terminal-audit.json',JSON.stringify({...metadata,samples:3000,rounds,findings},null,2));console.log({rounds,findings:findings.length});
