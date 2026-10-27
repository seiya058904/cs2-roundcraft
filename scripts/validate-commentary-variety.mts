import assert from 'node:assert/strict';
import {existsSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';
const baseline=process.argv.includes('--baseline');
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1]??'7';
if(!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const output=`docs/commentary-variety-${baseline?'baseline-':''}iteration${iteration}.json`;
if(baseline&&existsSync(output))throw new Error('口语变化基线已冻结');
let rounds=0,genericLongOpeners=0,chars=0;const contextIds=new Set<string>(),samples:unknown[]=[],counts=new Map<string,number>();
const world=newWorld();
for(let seed=1;seed<=150;seed++){
 const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){
  assert.deepEqual(validateNarration(r),[]);const rng=s.rngState;assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  const setup=deriveCommentaryBeats(r,s).find(b=>b.category==='setup')!,line=r.commentary.find(line=>line.sourceBeatIds?.includes(setup.id))!;
  if(['WJ-008','WJ-009'].includes(line.templateId??''))genericLongOpeners++;
  if(line.templateId?.startsWith('CX-')){
   contextIds.add(line.templateId);const family=Number(line.templateId.slice(3))<=6?'ordinary':Number(line.templateId.slice(3))<=18?'streak':'close';
   if(family==='streak'){const previous=s.mapStates[0].rounds.filter(old=>old.number<r.number),winner=previous.at(-1)!.winner;let streak=0;for(const old of previous.slice().reverse()){if(old.winner!==winner)break;streak++;}assert.equal(setup.facts.STREAK,streak);assert.ok(streak>=3);}
   if(family==='close'){const start=[...r.score];start[r.winner]--;assert.ok(Math.min(...start)>=8&&Math.abs(start[0]-start[1])<=1);}
   if((counts.get(family)??0)<4){samples.push({family,seed,map:r.map,round:r.number,text:line.text,id:line.templateId,roundText:r.commentary.map(line=>line.text).join('\n\n')});counts.set(family,(counts.get(family)??0)+1);}
  }
  const recent=new Set(s.mapStates[0].rounds.filter(old=>old.number<r.number&&old.number>=r.number-5).flatMap(old=>old.commentary.flatMap(line=>[line.templateId,line.supportTemplateId])));for(const line of r.commentary)for(const id of [line.templateId,line.supportTemplateId])if(id)assert.ok(!recent.has(id));
  rounds++;chars+=r.commentary.reduce((sum,line)=>sum+line.text.length,0);
 }
}
if(!baseline)assert.equal(genericLongOpeners,0);
const report={...reportMetadata(),matches:150,rounds,genericLongOpeners,activatedContextTemplates:contextIds.size,contextTemplateIds:[...contextIds].sort(),averageChars:chars/rounds,samples};
writeFileSync(output,JSON.stringify(report,null,2));console.log({...report,samples:samples.length,contextTemplateIds:undefined});
