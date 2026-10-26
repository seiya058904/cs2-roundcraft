import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto} from '../src/domain/series.ts';
import {simulateSeries} from '../src/domain/engine.ts';
import {renderCommentary,validateNarration,deriveCommentaryBeats} from '../src/domain/narrative.ts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
let rounds=0,segments=0,totalLength=0;const used=new Set<string>();const examples:unknown[]=[];const lengths:number[]=[];
for(let seed=1;seed<=150;seed++){
 const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);const rng=s.rngState;
 for(const r of s.mapStates[0].rounds){assert.deepEqual(validateNarration(r),[],`seed ${seed} R${r.number}`);assert.deepEqual(renderCommentary(r,s),r.commentary,`回放差异 seed ${seed} R${r.number}`);const beats=deriveCommentaryBeats(r,s);for(const b of beats)for(const id of b.eventIds){const e=r.events.find(e=>e.id===id);assert.ok(e&&e.at<=b.at,'引用未来事实');}rounds++;segments+=r.commentary.length;const length=r.commentary.map(x=>x.text).join('').length;lengths.push(length);totalLength+=length;for(const x of r.commentary)if(x.templateId)used.add(x.templateId);if(examples.length<15&&(r.events.some(e=>e.kind==='trade')||r.reason==='defuse'))examples.push({seed,map:r.map,round:r.number,score:r.score,lines:r.commentary});}
 assert.equal(s.rngState,rng,'解说消耗比赛随机流');
}
lengths.sort((a,b)=>a-b);const report={...metadata,rounds,segments,averageChars:totalLength/rounds,p95Chars:lengths[Math.floor(lengths.length*.95)],activatedTemplates:used.size,templateIds:[...used].sort(),examples};writeFileSync('docs/commentary-validation.json',JSON.stringify(report,null,2));console.log({...report,examples:undefined});
