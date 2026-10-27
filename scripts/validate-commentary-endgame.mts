import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto,mapWinner} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';
import type {TeamIndex} from '../src/domain/types';

const baseline=process.argv.includes('--baseline');
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1]??'6';
if(!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const output=`docs/commentary-endgame-${baseline?'baseline-':''}iteration${iteration}.json`;
if(baseline&&existsSync(output))throw new Error('决胜阶段基线已冻结');
const world=newWorld(),digest=createHash('sha256'),expected:Record<string,number>={},emitted:Record<string,number>={},missing:Record<string,number>={};
const samples:unknown[]=[],counts=new Map<string,number>();
let maps=0,rounds=0,segments=0;
const cases=[...Array.from({length:150},(_,i)=>({a:'Vitality',b:'FURIA',bestOf:1 as const,seed:i+1})),...['Vitality/FURIA','Falcons/Natus Vincere','G2/Spirit'].flatMap(pair=>Array.from({length:20},(_,i)=>({a:pair.split('/')[0],b:pair.split('/')[1],bestOf:3 as const,seed:201+i}))),...Array.from({length:10},(_,i)=>({a:'FaZe',b:'MOUZ',bestOf:5 as const,seed:401+i}))];
for(const config of cases){
 const s=createSeries(world,world.teams.find(t=>t.name===config.a)!.id,world.teams.find(t=>t.name===config.b)!.id,config.bestOf,config.seed);autoVeto(s);simulateSeries(s);
 for(const ms of s.mapStates)for(const r of ms.rounds){
  assert.deepEqual(validateNarration(r),[]);const rng=s.rngState;assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  const beats=deriveCommentaryBeats(r,s),shown=new Set(r.commentary.flatMap(line=>line.sourceBeatIds??[]));
  const categories=new Set(beats.filter(b=>shown.has(b.id)).map(b=>b.category));
  const finished=mapWinner(r.score)!==null,start:[number,number]=[...r.score];start[r.winner]--;
  const point=(score:[number,number],team:TeamIndex)=>{const next:[number,number]=[...score];next[team]++;return mapWinner(next)===team;};
  const expectedKinds=[...(finished?['map-win']:[]),...(!finished&&r.number>24&&point(r.score,r.winner)&&!point(start,r.winner)?['overtime-match-point']:[]),...(!finished&&r.number>24&&r.score[0]===r.score[1]&&r.score[0]%3===0?['overtime-repeat']:[]),...(!finished&&r.number>24&&(r.number-24)%6===3?['overtime-half']:[]),...(!finished&&point(start,(1-r.winner) as TeamIndex)&&r.score[0]!==r.score[1]?['match-point-saved']:[])];
  for(const kind of expectedKinds){expected[kind]=(expected[kind]??0)+1;const exists=categories.has(kind);if(!exists)missing[kind]=(missing[kind]??0)+1;}
  for(const b of beats.filter(b=>shown.has(b.id)))emitted[b.category]=(emitted[b.category]??0)+1;
  const close=r.commentary.findIndex(line=>line.sourceBeatIds?.some(id=>beats.find(b=>b.id===id)!.category==='close'));
  if(!baseline)for(const kind of expectedKinds){const index=r.commentary.findIndex(line=>line.sourceBeatIds?.some(id=>beats.find(b=>b.id===id)!.category===kind));assert.ok(index>close,`${kind} 不在比分结果之后`);assert.ok(r.commentary[index].briefText);}
  const lastTimeout=beats.some(b=>b.category==='timeout'&&shown.has(b.id)&&b.facts.remainingTimeouts===0);
  for(const kind of [...expectedKinds,...(categories.has('clutch-loss')?['clutch-loss']:[]),...(lastTimeout?['last-timeout']:[])]){const key=`${kind}/BO${config.bestOf}`;if((counts.get(key)??0)<2){samples.push({kind,pair:[config.a,config.b],bestOf:config.bestOf,seed:config.seed,map:r.map,round:r.number,score:r.score,text:r.commentary.map(line=>line.text).join('\n\n'),lines:r.commentary,events:r.events});counts.set(key,(counts.get(key)??0)+1);}}
  assert.ok(r.commentary.filter(line=>line.briefText).length<=5);
  const recent=new Set(ms.rounds.filter(old=>old.number<r.number&&old.number>=r.number-5).flatMap(old=>old.commentary.flatMap(line=>[line.templateId,line.supportTemplateId]))),current=new Set<string>();let anchor=-1;
  for(const line of r.commentary){const next=Math.max(...line.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));assert.ok(next>=anchor);anchor=next;for(const id of [line.templateId,line.supportTemplateId])if(id){assert.ok(!current.has(id));assert.ok(!recent.has(id));current.add(id);}}
  rounds++;segments+=r.commentary.length;
 }
 maps+=s.mapStates.length;const copy=structuredClone(s);for(const ms of copy.mapStates)for(const r of ms.rounds)r.commentary=[];digest.update(JSON.stringify(copy));
}
const report={...reportMetadata(),series:cases.length,maps,rounds,segments,expected,missing,emitted,factDigest:digest.digest('hex'),samples};
if(!baseline){assert.equal(report.factDigest,JSON.parse(readFileSync(`docs/commentary-endgame-baseline-iteration${iteration}.json`,'utf8')).factDigest);assert.equal(Object.values(missing).reduce((a,b)=>a+b,0),0);}
writeFileSync(output,JSON.stringify(report,null,2));console.log({...report,samples:samples.length,emitted:undefined});
