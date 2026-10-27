import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';

const baseline=process.argv.includes('--baseline');
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1]??'5';
if(!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const output=`docs/commentary-flow-${baseline?'baseline-':''}iteration${iteration}.json`;
if(baseline&&existsSync(output))throw new Error('整回合衔接基线已经冻结');
const actionKinds=new Set(['opening','awp-opening','headshot','flash-conversion','smoke-kill','rifle-v-awp','awp-duel','grenade','trade']);
const transitions=new Set(['match-point','overtime-threat','half-time','overtime']);
const world=newWorld(),facts=createHash('sha256');
let rounds=0,segments=0,duplicateKillGroups=0,transitionBeforeResult=0,missingTransitions=0,briefMissingTransitions=0,fixedClutchAdvice=0,duplicateDefuseResolution=0;
const samples:unknown[]=[];const sampleCounts=new Map<string,number>();
for(let seed=1;seed<=150;seed++){
 const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){
  const rng=s.rngState;assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  const beats=deriveCommentaryBeats(r,s),byId=new Map(beats.map(b=>[b.id,b]));
  assert.ok(r.commentary.filter(line=>line.briefText).length<=5,'精简模式超过五段');
  for(const line of r.commentary){for(const id of line.sourceBeatIds??[])assert.ok(byId.get(id)!.eventIds.every(eventId=>line.eventIds.includes(eventId)),'合段丢失事件依据');for(const id of line.eventIds)assert.ok(r.events.find(e=>e.id===id)!.at<=(line.at??0),'合段引用未来事件');}
  const narrated=new Map<string,number[]>(),categories=r.commentary.map(line=>(line.sourceBeatIds??[]).map(id=>byId.get(id)!.category));
  for(const [index,line] of r.commentary.entries())for(const id of line.sourceBeatIds??[]){const b=byId.get(id)!;if(!actionKinds.has(b.category))continue;const kill=r.events.filter(e=>b.eventIds.includes(e.id)&&e.kind==='kill').at(-1);if(kill)narrated.set(kill.id,[...(narrated.get(kill.id)??[]),index]);}
  const duplicates=[...narrated].filter(([,indexes])=>new Set(indexes).size>1);
  duplicateKillGroups+=duplicates.length;
  const close=categories.findIndex(c=>c.includes('close'));
  for(const b of beats.filter(b=>transitions.has(b.category))){const index=categories.findIndex(c=>c.includes(b.category));if(index<0)missingTransitions++;else{if(index<close)transitionBeforeResult++;if(!r.commentary[index].briefText)briefMissingTransitions++;}}
  fixedClutchAdvice+=r.commentary.filter(line=>line.text.includes('先拆成单独交锋，才有继续打下去的机会。')).length;
  if(categories.some(c=>c.includes('defuse-timing'))&&r.commentary.some((line,i)=>categories[i].includes('clutch-win')&&line.text.includes('最后完成拆包，回防成功。')))duplicateDefuseResolution++;
  const kinds=[...(duplicates.length?['duplicate-kill']:[]),...categories.flat().filter(c=>transitions.has(c)),...categories.flat().filter(c=>['clutch-win','eco-win'].includes(c))];
  for(const kind of new Set(kinds))if((sampleCounts.get(kind)??0)<3){samples.push({kind,seed,map:r.map,round:r.number,text:r.commentary.map(line=>line.text).join('\n\n'),brief:r.commentary.map(line=>line.briefText??'').filter(Boolean).join('\n'),lines:r.commentary,duplicates});sampleCounts.set(kind,(sampleCounts.get(kind)??0)+1);}
  const current=new Set<string>(),recent=new Set(s.mapStates[0].rounds.filter(old=>old.number<r.number&&old.number>=r.number-5).flatMap(old=>old.commentary.flatMap(line=>[line.templateId,line.supportTemplateId])));
  let anchor=-1;for(const line of r.commentary){const next=Math.max(...line.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));assert.ok(next>=anchor);anchor=next;for(const id of [line.templateId,line.supportTemplateId])if(id){assert.ok(!current.has(id));assert.ok(!recent.has(id));current.add(id);}}
  rounds++;segments+=r.commentary.length;
 }
 const copy=structuredClone(s);for(const r of copy.mapStates[0].rounds)r.commentary=[];facts.update(JSON.stringify(copy));
}
const report={...reportMetadata(),matches:150,rounds,segments,duplicateKillGroups,transitionBeforeResult,missingTransitions,briefMissingTransitions,fixedClutchAdvice,duplicateDefuseResolution,factDigest:facts.digest('hex'),samples};
if(!baseline){const old=JSON.parse(readFileSync(`docs/commentary-flow-baseline-iteration${iteration}.json`,'utf8'));assert.equal(report.factDigest,old.factDigest);for(const key of ['duplicateKillGroups','transitionBeforeResult','missingTransitions','briefMissingTransitions','fixedClutchAdvice','duplicateDefuseResolution'] as const)assert.equal(report[key],0,key);}
writeFileSync(output,JSON.stringify(report,null,2));console.log({...report,samples:samples.length});
