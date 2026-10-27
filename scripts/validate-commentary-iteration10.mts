import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {MAPS} from '../src/domain/maps';
import {createSeries,vetoMap} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {quoteCandidates} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';

// Fixed, disjoint seeds and ordinary AI decisions; no event injection or quote forcing.
const old=JSON.parse(readFileSync('docs/commentary-review-accountability-iteration9.json','utf8'));
const wired=[...new Set([...readFileSync('src/domain/realQuotes.ts','utf8').matchAll(/['"]((?:RD|RF|RW)-\d+-\d+)['"]/g)].map(m=>m[1]))];
const previouslySpoken=new Set<string>(old.newPack.allUsed);
const focus:string[]=wired.filter(id=>!previouslySpoken.has(id)&&id!=='RD-12-15'&&id!=='RW-12-5');
focus.push('RD-12-15','RW-12-5');
const counts=Object.fromEntries(focus.map(id=>[id,{eligible:0,spoken:0}]));
const samples:any[]=[];let rounds=0,matches=0;
for(const map of MAPS)for(let seed=201;seed<=230;seed++){
 const s=createSeries(newWorld(),'team-3','team-7',1,seed);
 for(const other of MAPS.filter(x=>x.id!==map.id))vetoMap(s,other.id);
 while(s.status==='playing'){
  const r=resolveRound(s),rng=s.rngState,beats=deriveCommentaryBeats(r,s);
  assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  for(const b of beats)for(const id of quoteCandidates(b,r))if(counts[id])counts[id].eligible++;
  for(const line of r.commentary){
   const id=line.templateId;if(!id||!counts[id])continue;counts[id].spoken++;
   const b=beats.find(b=>line.sourceBeatIds?.includes(b.id)&&quoteCandidates(b,r).includes(id));assert.ok(b,id+' missing eligible anchor');
   if(!samples.some(x=>x.id===id)){
    const end=Math.max(...b.eventIds.map(event=>r.events.findIndex(e=>e.id===event)));
    samples.push({id,map:map.id,seed,round:r.number,beat:b,eventPrefix:r.events.slice(0,end+1),lines:r.commentary});
   }
  }
  rounds++;
 }
 matches++;
}
const report={...reportMetadata(),scope:'七图各固定seed 201至230，普通AI，独立于第九轮150种子与定向队列；不插入事件或指定原句。',matches,rounds,counts,samples};
writeFileSync('docs/commentary-iteration10-validation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,samples:samples.map(x=>x.id)},null,2));
