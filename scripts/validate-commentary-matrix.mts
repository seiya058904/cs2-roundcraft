import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {MAPS} from '../src/domain/maps';
import {createSeries,vetoMap,chooseStartingSide,sideChooser,sidesForRound} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {defaultDecision} from '../src/domain/tactics';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {quoteCandidates,realQuoteCatalog} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
import type {BuyPolicy,TeamIndex} from '../src/domain/types';

const baseline=process.argv.includes('--baseline');
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1]??'3';
if(!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const output=`docs/commentary-matrix-${baseline?'baseline-iteration':'iteration'}${iteration}.json`;
if(baseline&&existsSync(output))throw new Error('本轮基线已经冻结，请使用新一轮文件名保存新的基线');
const pairs=[['Vitality','FURIA'],['Falcons','Natus Vincere'],['G2','Spirit'],['FaZe','MOUZ'],['Aurora','The MongolZ']];
const profiles:[BuyPolicy,BuyPolicy][]=[['auto','auto'],['halfBuy','fullBuy'],['eco','forceBuy']];
const world=newWorld(),digest=createHash('sha256'),used=new Set<string>(),pools=new Map<string,Set<string>>();
const samples:unknown[]=[],sampleCounts=new Map<string,number>();
let matches=0,rounds=0,segments=0,quoteSegments=0;
for(const pair of pairs)for(const map of MAPS)for(const [profile,policies] of profiles.entries())for(const seed of [31,76]){
 const ids=pair.map(name=>world.teams.find(team=>team.name===name)!.id);
 const s=createSeries(world,ids[0],ids[1],1,seed);
 for(const other of MAPS.filter(other=>other.id!==map.id))vetoMap(s,other.id);
 const chooser=sideChooser(s,map.id),teamZeroSide=seed===31?'T':'CT';
 chooseStartingSide(s,map.id,chooser,chooser===0?teamZeroSide:teamZeroSide==='T'?'CT':'T');
 while(s.status==='playing'){
  const ms=s.mapStates[0];
  // Use sides for the upcoming round; stored fighters still have the previous round's sides.
  const sides=sidesForRound(ms.startSide,ms.rounds.length);
  const manual=profile===0?undefined:Object.fromEntries(([0,1] as TeamIndex[]).map(team=>[team,{...defaultDecision(sides[team]),buy:policies[team]}]));
  const r=resolveRound(s,manual),rng=s.rngState;
  assert.deepEqual(validateNarration(r),[]);
  assert.deepEqual(renderCommentary(r,s),r.commentary);
  assert.equal(s.rngState,rng);
  const beats=deriveCommentaryBeats(r,s);
  for(const b of beats){
   const category=b.category.startsWith('phase-')?'phase':b.category;
   if(!pools.has(category))pools.set(category,new Set());
   for(const id of quoteCandidates(b,r)){assert.ok(realQuoteCatalog.has(id),id);pools.get(category)!.add(id);}
   for(const id of b.eventIds)assert.ok(r.events.find(e=>e.id===id)!.at<=b.at);
  }
  const recent=new Set(ms.rounds.filter(old=>old.number<r.number&&old.number>=r.number-5).flatMap(old=>old.commentary.flatMap(line=>[line.templateId,line.supportTemplateId])));
  const current=new Set<string>();
  let previous=-1;
  for(const line of r.commentary){
   const anchor=Math.max(...line.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));
   assert.ok(anchor>=previous,'同秒事件顺序错误');previous=anchor;
   if(line.supportTemplateId){assert.ok(!current.has(line.supportTemplateId));assert.ok(!recent.has(line.supportTemplateId));current.add(line.supportTemplateId);}
   if(!line.templateId)continue;
   assert.ok(!current.has(line.templateId));current.add(line.templateId);
   assert.ok(!recent.has(line.templateId),'五回合素材冷却失效');
   if(!realQuoteCatalog.has(line.templateId))continue;
   used.add(line.templateId);quoteSegments++;
   const prefix=line.templateId.split('-')[0],category=beats.find(b=>line.sourceBeatIds?.includes(b.id))?.category??'';
   const key=`${prefix}/${category}`;
   if((sampleCounts.get(key)??0)<2&&/^(RD|RF|RW)$/.test(prefix)){
    samples.push({pair,map:map.id,profile,seed,round:r.number,category,id:line.templateId,text:line.text,events:r.events.filter(e=>line.eventIds.includes(e.id))});
    sampleCounts.set(key,(sampleCounts.get(key)??0)+1);
   }
  }
  rounds++;segments+=r.commentary.length;
 }
 const facts=structuredClone(s);for(const r of facts.mapStates[0].rounds)r.commentary=[];
 digest.update(JSON.stringify(facts));matches++;
}
const report={...reportMetadata(),matches,rounds,segments,quoteSegments,quoteShare:quoteSegments/segments,realQuoteCount:realQuoteCatalog.size,activatedRealQuotes:used.size,actualQuoteUtilization:used.size/realQuoteCatalog.size,usedIds:[...used].sort(),byBatch:Object.fromEntries(['RQ','RB','RD','RF','RW'].map(prefix=>[prefix,[...used].filter(id=>id.startsWith(prefix+'-')).length])),factDigest:digest.digest('hex'),pools:Object.fromEntries([...pools].map(([category,ids])=>[category,{count:ids.size,ids:[...ids].sort()}])),samples};
writeFileSync(output,JSON.stringify(report,null,2));
console.log({...report,usedIds:undefined,pools:undefined,samples:report.samples.length});
