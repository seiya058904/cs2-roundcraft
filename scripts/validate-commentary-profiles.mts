import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {MAPS} from '../src/domain/maps';
import {createSeries,vetoMap,sidesForRound} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {defaultDecision} from '../src/domain/tactics';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {quoteCandidates} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
import type {TeamIndex,Decision} from '../src/domain/types';

const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1]??'8';
if(!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const world=newWorld(),generated:Record<string,number>={},emitted:Record<string,number>={},economies:Record<string,number>={};
const focus=['RW-1-3','RF-6-5','RD-6-8'],eligible=new Set<string>(),used=new Set<string>(),samples:unknown[]=[],sampleCounts=new Map<string,number>();
let matches=0,rounds=0,rawLogs=0;
for(const map of MAPS)for(const profile of ['force-T','force-CT','reserve','clear'] as const)for(const seed of [31,76,224]){
 const s=createSeries(world,'team-2','team-4',1,seed);for(const other of MAPS.filter(other=>other.id!==map.id))vetoMap(s,other.id);
 while(s.status==='playing'){
  const ms=s.mapStates[0],sides=sidesForRound(ms.startSide,ms.rounds.length);
  const decisions=Object.fromEntries(([0,1] as TeamIndex[]).map(team=>{
   const side=sides[team],d:Decision={...defaultDecision(side),buy:profile===`force-${side}`?'forceBuy':'fullBuy'};
   if(profile==='reserve'){d.tactic=side==='T'?'contact':'retake';d.phases={utility:'reserve',smoke:'respect',...(side==='CT'?{postPlant:'retake' as const}:{execution:'regroup' as const})};}
   if(profile==='clear'){d.tactic=side==='T'?'fastB':'standard';d.phases={utility:'normal',smoke:side==='T'?'cross':'respect',...(side==='CT'?{postPlant:'clear' as const}:{execution:'direct' as const})};}
   return [team,d];
  }));
  const r=resolveRound(s,decisions),rng=s.rngState;assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  for(const [team,plan] of r.plans!.entries()){const key=`${r.sides[team]}/${plan.economy}`;economies[key]=(economies[key]??0)+1;}
  const beats=deriveCommentaryBeats(r,s),shown=new Set(r.commentary.flatMap(line=>line.sourceBeatIds??[]));
  for(const b of beats){const rule=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='tactic'&&e.detail.rule),key=rule?`${rule.detail.rule}:${rule.detail.status}`:b.category;
   generated[key]=(generated[key]??0)+1;if(shown.has(b.id))emitted[key]=(emitted[key]??0)+1;for(const id of quoteCandidates(b,r))if(focus.includes(id))eligible.add(id);
  }
  const recent=new Set(ms.rounds.filter(old=>old.number<r.number&&old.number>=r.number-5).flatMap(old=>old.commentary.flatMap(line=>[line.templateId,line.supportTemplateId]))),current=new Set<string>();let anchor=-1;
  for(const line of r.commentary){
   const next=Math.max(...line.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));assert.ok(next>=anchor);anchor=next;
   for(const id of [line.templateId,line.supportTemplateId])if(id){assert.ok(!recent.has(id));assert.ok(!current.has(id));current.add(id);}
   if(line.templateId&&focus.includes(line.templateId))used.add(line.templateId);
   const phase=beats.find(b=>line.sourceBeatIds?.includes(b.id)&&b.category.startsWith('phase-'));
   if(phase&&phase.eventIds.some(id=>{const e=r.events.find(e=>e.id===id)!;return typeof e.detail.reason==='string'&&(line.text.includes(e.detail.reason)||line.briefText?.includes(e.detail.reason));}))rawLogs++;
  }
  const key=`${profile}/${map.id}`;if((sampleCounts.get(key)??0)<1&&r.number>2){samples.push({profile,seed,map:map.id,round:r.number,plans:r.plans,text:r.commentary.map(line=>line.text).join('\n\n'),lines:r.commentary});sampleCounts.set(key,1);}
  rounds++;
 }
 matches++;
}
assert.equal(rawLogs,0);
const report={...reportMetadata(),matches,rounds,economies,generated,emitted,rawLogs,focusedEligibleIds:[...eligible].sort(),focusedUsedIds:[...used].sort(),samples};
writeFileSync(`docs/commentary-profiles-iteration${iteration}.json`,JSON.stringify(report,null,2));console.log({...report,samples:samples.length,generated:undefined,emitted:undefined});
