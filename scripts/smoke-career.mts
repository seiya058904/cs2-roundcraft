import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
import {createCareer,startEvent,simulateCareerFixture,nextSeason} from '../src/domain/career.ts';
import {newWorld} from '../src/data/index.ts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {makeSave,validateSave} from '../src/domain/save.ts';
import {careerPlayerStats} from '../src/domain/career.ts';
const career=createCareer(newWorld(),'team-3',20261005),start=performance.now();let matches=0;
for(let season=0;season<2;season++){
 for(const e of career.calendar){startEvent(career,e.id);while(e.status==='active'){simulateCareerFixture(career,e.id);matches++;}if(!e.tournament?.champion)throw new Error('缺失冠军');assert.equal(e.tournament.fixtures.at(-1)!.bestOf,e.finalBestOf);validateSave(makeSave(career,null,null));console.log(`S${career.season} ${e.name}: ${e.tournament.champion} (${e.tournament.fixtures.length} 场)`);}
 if(season===0)nextSeason(career);
}
const stats=careerPlayerStats(career,true);assert.equal(stats.reduce((sum,p)=>sum+p.kills,0),stats.reduce((sum,p)=>sum+p.deaths,0));assert.equal(career.archivedSeasons?.length,1);
const report={...metadata,seasons:2,events:career.history.length,matches,archivedSeasons:career.archivedSeasons?.length,playersWithStats:stats.length,durationSeconds:(performance.now()-start)/1000,saveBytes:Buffer.byteLength(JSON.stringify(career)),champions:career.history};writeFileSync('docs/career-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,champions:undefined},null,2));
