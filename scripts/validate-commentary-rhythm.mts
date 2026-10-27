import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {MAPS} from '../src/domain/maps';
import {createSeries,autoVeto,vetoMap,sidesForRound} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {defaultDecision} from '../src/domain/tactics';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';
import type {Decision,MapId,TeamIndex} from '../src/domain/types';

const baseline=process.argv.includes('--baseline');
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1]??'4';
if(!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const baselinePath=`docs/commentary-rhythm-baseline-iteration${iteration}.json`;
const output=baseline?baselinePath:`docs/commentary-rhythm-iteration${iteration}.json`;
if(baseline&&existsSync(output))throw new Error('阶段语气基线已冻结');
const cases:{seed:number;map?:MapId;profile:'auto'|'patient'|'clear'}[]=[];
for(let seed=1;seed<=30;seed++)cases.push({seed,profile:'auto'});
for(const map of MAPS)for(const profile of ['patient','clear'] as const)for(const seed of [31,76,224])cases.push({seed,map:map.id,profile});
const world=newWorld(),digest=createHash('sha256'),generated:Record<string,number>={},emitted:Record<string,number>={};
const phraseIds=new Set<string>(),samples:unknown[]=[],sampleCounts=new Map<string,number>();
let rounds=0,segments=0,phaseSegments=0,rawLogSegments=0,briefRawLogSegments=0,redundantStartPairs=0,chars=0;
for(const config of cases){
 const s=createSeries(world,'team-3','team-7',1,config.seed);
 if(config.map)for(const map of MAPS.filter(map=>map.id!==config.map))vetoMap(s,map.id);else autoVeto(s);
 while(s.status==='playing'){
  const sides=sidesForRound(s.mapStates[0].startSide,s.mapStates[0].rounds.length);
  const manual=config.profile==='auto'?undefined:Object.fromEntries(([0,1] as TeamIndex[]).map(team=>{
   const side=sides[team];const d:Decision={...defaultDecision(side),buy:'fullBuy'};
   if(config.profile==='patient'){
    d.tactic=side==='T'?'default':'retake';d.phases={smoke:'respect',utility:'reserve',...(side==='T'?{execution:'regroup' as const,postPlant:'hold' as const}:{postPlant:'retake' as const})};
   }else{
    d.tactic=side==='T'?'fastA':'standard';d.phases={smoke:side==='T'?'cross':'respect',utility:'normal',...(side==='T'?{execution:'direct' as const,postPlant:'hold' as const}:{postPlant:'clear' as const})};
   }
   return [team,d];
  }));
  const r=resolveRound(s,manual),rng=s.rngState;
  assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  const beats=deriveCommentaryBeats(r,s),phase=beats.filter(b=>b.category.startsWith('phase-'));
  const event=(id:string)=>r.events.find(e=>e.id===id)!;
  const state=(b:typeof beats[number])=>{
   const e=b.eventIds.map(event).find(e=>e.kind==='tactic'&&e.detail.rule)!;
   if(e.detail.status==='interrupted')return e.causes.map(event).some(cause=>cause.kind==='kill'&&cause.target===e.actor)?'interrupted:death':e.causes.map(event).some(cause=>cause.kind==='smoke')?'smoke:interrupted':'interrupted:end';
   return `${e.detail.rule}:${e.detail.status}`;
  };
  for(const b of phase)generated[state(b)]=(generated[state(b)]??0)+1;
  const displayed=new Set(r.commentary.flatMap(line=>line.sourceBeatIds??[]));
  const selected=phase.filter(b=>displayed.has(b.id));
  for(const b of selected){const key=state(b);emitted[key]=(emitted[key]??0)+1;}
  if(selected.some(b=>state(b)==='regroup:executing'&&selected.some(other=>state(other)==='execution:executing'&&other.at===b.at)))redundantStartPairs++;
  for(const line of r.commentary){
   const refs=phase.filter(b=>line.sourceBeatIds?.includes(b.id));if(!refs.length)continue;
   phaseSegments++;
   for(const id of [line.templateId,line.supportTemplateId])if(id?.startsWith('PH-'))phraseIds.add(id);
   if(refs.some(b=>b.eventIds.map(event).some(e=>typeof e.detail.reason==='string'&&line.text.includes(e.detail.reason))))rawLogSegments++;
   if(refs.some(b=>b.eventIds.map(event).some(e=>typeof e.detail.reason==='string'&&line.briefText?.includes(e.detail.reason))))briefRawLogSegments++;
   const key=state(refs[0]);
   if((sampleCounts.get(key)??0)<2){samples.push({profile:config.profile,seed:config.seed,map:r.map,round:r.number,state:key,text:line.text,id:line.templateId,stage:line.stage,events:line.eventIds.map(event),roundText:r.commentary.map(x=>x.text).join('\n\n')});sampleCounts.set(key,(sampleCounts.get(key)??0)+1);}
  }
  const recent=new Set(s.mapStates[0].rounds.filter(old=>old.number<r.number&&old.number>=r.number-5).flatMap(old=>old.commentary.flatMap(line=>[line.templateId,line.supportTemplateId]))),current=new Set<string>();
  let anchor=-1;for(const line of r.commentary){const next=Math.max(...line.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));assert.ok(next>=anchor);anchor=next;for(const id of [line.templateId,line.supportTemplateId])if(id){assert.ok(!recent.has(id));assert.ok(!current.has(id));current.add(id);}}
  rounds++;segments+=r.commentary.length;chars+=r.commentary.reduce((sum,line)=>sum+line.text.length,0);
 }
 const facts=structuredClone(s);for(const r of facts.mapStates[0].rounds)r.commentary=[];digest.update(JSON.stringify(facts));
}
const report={...reportMetadata(),matches:cases.length,rounds,segments,phaseSegments,phaseShare:phaseSegments/segments,rawLogSegments,briefRawLogSegments,redundantStartPairs,averageChars:chars/rounds,generated,emitted,activatedPhaseTemplates:phraseIds.size,phaseTemplateIds:[...phraseIds].sort(),factDigest:digest.digest('hex'),samples};
if(!baseline&&existsSync(baselinePath))assert.equal(report.factDigest,JSON.parse(readFileSync(baselinePath,'utf8')).factDigest,'阶段解说改变了比赛事实');
if(!baseline){assert.equal(rawLogSegments,0);assert.equal(briefRawLogSegments,0);assert.equal(redundantStartPairs,0);}
writeFileSync(output,JSON.stringify(report,null,2));
console.log({...report,samples:report.samples.length,phaseTemplateIds:undefined});
