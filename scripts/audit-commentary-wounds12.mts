import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';
const world=newWorld(),samples:any[]=[],fireSamples:any[]=[];let rounds=0,generated=0,shown=0,fireKills=0,fireShown=0;
for(let seed=1;seed<=150;seed++){
 const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){
  assert.deepEqual(validateNarration(r),[]);const rng=s.rngState;assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  const all=deriveCommentaryBeats(r,s),beats=all.filter(b=>b.category==='gun-hurt');generated+=beats.length;
  for(const b of beats){const hit=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='damage')!,shot=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='duel')!;assert.ok(hit.hpAfter!>0&&hit.hpAfter!<=25);assert.ok(hit.causes.includes(shot.id));assert.ok(!['HE','fire'].includes(hit.weapon!));
   const line=r.commentary.find(l=>l.sourceBeatIds?.includes(b.id));if(!line)continue;shown++;assert.ok(line.text.includes(`${hit.hpAfter}血`));assert.ok(line.text.includes(hit.weapon!));
   if(samples.length<12)samples.push({seed,map:r.map,round:r.number,hit,shot,lines:r.commentary});
  }
  for(const b of all.filter(b=>b.category==='fire-damage')){const hit=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='damage')!;assert.ok(hit.hpAfter!>0);}
  for(const b of all.filter(b=>b.category==='fire-kill')){fireKills++;const hit=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='damage')!,kill=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='kill')!;assert.equal(hit.hpAfter,0);assert.equal(kill.weapon,'fire');assert.ok(kill.causes.includes(hit.id));const line=r.commentary.find(l=>l.sourceBeatIds?.includes(b.id));if(line){fireShown++;if(fireSamples.length<6)fireSamples.push({seed,map:r.map,round:r.number,hit,kill,lines:r.commentary});}}
  rounds++;
 }
}
const report={...reportMetadata(),seeds:150,rounds,generated,shown,fireKills,fireShown,samples,fireSamples};writeFileSync('docs/commentary-wounds-iteration12.json',JSON.stringify(report,null,2));console.log({...report,samples:samples.length,fireSamples:fireSamples.length});
