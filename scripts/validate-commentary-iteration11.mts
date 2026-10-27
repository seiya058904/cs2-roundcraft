import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {getMap} from '../src/domain/maps';
import {createSeries,autoVeto,sidesForRound} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {defaultDecision} from '../src/domain/tactics';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {quoteCandidates,realQuoteCatalog} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
import type {Decision,TeamIndex} from '../src/domain/types';

const world=newWorld(),old=JSON.parse(readFileSync('docs/commentary-review-accountability-iteration9.json','utf8'));
const previous=JSON.parse(readFileSync('docs/commentary-iteration10-validation.json','utf8'));
const wired=[...new Set([...readFileSync('src/domain/realQuotes.ts','utf8').matchAll(/['"]((?:RD|RF|RW)-\d+-\d+)['"]/g)].map(m=>m[1]))];
const used=new Set([...old.newPack.allUsed,...Object.entries(previous.counts).filter(([,v]:any)=>v.spoken>0).map(([id])=>id)]);
const focus=wired.filter(id=>!used.has(id));
const stage=()=>({eligible:0,unselectedBeat:0,cooldown:0,intensity:0,alreadySpoken:0,competed:0,spoken:0});
const counts:Record<string,ReturnType<typeof stage>>=Object.fromEntries(focus.map(id=>[id,stage()]));
const pairs=[['Falcons','Natus Vincere'],['G2','Spirit'],['FaZe','MOUZ'],['Vitality','FURIA'],['Aurora','The MongolZ']];
const samples:any[]=[];let seriesCount=0,maps=0,rounds=0;
for(const pair of pairs)for(const profile of ['ordinary','mid-and-passive'] as const)for(let seed=301;seed<=310;seed++){
 const ids=pair.map(name=>world.teams.find(t=>t.name===name)!.id),s=createSeries(world,ids[0],ids[1],3,seed);autoVeto(s);
 while(s.status==='playing'){
  const ms=s.mapStates.at(-1)!,map=getMap(ms.map),sides=sidesForRound(ms.startSide,ms.rounds.length);
  const decisions=profile==='ordinary'?undefined:Object.fromEntries(([0,1] as TeamIndex[]).map(team=>{
   const side=sides[team],fighters=ms.fighters.filter(f=>f.team===team),d:Decision={...defaultDecision(side),tactic:side==='T'?'midControl':'passive',risk:'conservative',adaptive:false};
   if(side==='T')d.positions=Object.fromEntries(fighters.map((f,i)=>[f.id,i<4?map.mid:map.siteB]));
   return [team,d];
  }));
  const r=resolveRound(s,decisions),rng=s.rngState,beats=deriveCommentaryBeats(r,s);
  assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  const history=ms.rounds.filter(x=>x.number<r.number),recent=new Set(history.filter(x=>x.number>=r.number-5).flatMap(x=>x.commentary.flatMap(l=>[l.templateId,l.supportTemplateId])));
  const priorEmphasis=history.filter(x=>x.number>=r.number-3).some(x=>x.commentary.some(l=>/卧槽|牛逼|无敌|太变态|太夸张/.test(l.text)));
  const priorMetaphor=history.filter(x=>x.number>=r.number-10).some(x=>x.commentary.some(l=>/高压锅|一键扫荡|歼灭模式|游龙|包饺子|空城计|变速齿轮|融化|凡人挑战神明|杀戮机器/.test(l.text)));
  for(const b of beats)for(const id of quoteCandidates(b,r)){
   if(!counts[id])continue;const c=counts[id];c.eligible++;
   const index=r.commentary.findIndex(l=>l.sourceBeatIds?.includes(b.id)),line=r.commentary[index];
   if(index<0){c.unselectedBeat++;continue;}
   if(line.templateId===id){c.spoken++;if(!samples.some(x=>x.id===id))samples.push({id,pair,profile,seed,map:r.map,round:r.number,beat:b,events:r.events,lines:r.commentary});continue;}
   const before=r.commentary.slice(0,index),text=realQuoteCatalog.get(id)!.text,high=['multikill','clutch-win','eco-win'].includes(beats.find(x=>line.sourceBeatIds?.[0]===x.id)?.category??b.category);
   if(before.some(l=>l.templateId===id)){c.alreadySpoken++;continue;}
   if(recent.has(id)){c.cooldown++;continue;}
   if((/卧槽|牛逼|无敌|太变态|太夸张/.test(text)&&(!high||priorEmphasis||before.some(l=>/卧槽|牛逼|无敌|太变态|太夸张/.test(l.text))))||(/高压锅|一键扫荡|歼灭模式|游龙|包饺子|空城计|变速齿轮|融化|凡人挑战神明|杀戮机器/.test(text)&&(!high||priorMetaphor||before.some(l=>/高压锅|一键扫荡|歼灭模式|游龙|包饺子|空城计|变速齿轮|融化|凡人挑战神明|杀戮机器/.test(l.text))))){c.intensity++;continue;}
   c.competed++;
  }
  rounds++;
 }
 seriesCount++;maps+=s.mapStates.length;
}
for(const c of Object.values(counts))assert.equal(c.eligible,c.unselectedBeat+c.cooldown+c.intensity+c.alreadySpoken+c.competed+c.spoken);
const report={...reportMetadata(),scope:'五组真实阵容、BO3自动禁选，普通AI与合法中路/被动站位两组，固定种子301–310；不插入事件、换选手、指定原句或修改随机流。分类按候选节拍逐次计数，顺序为未选节拍、已播、五轮冷却、强度、候选竞争。',pairs,series:seriesCount,maps,rounds,counts,samples};
writeFileSync('docs/commentary-iteration11-validation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,counts:Object.fromEntries(Object.entries(counts).filter(([,v])=>v.eligible)),samples:samples.map(x=>x.id)},null,2));
