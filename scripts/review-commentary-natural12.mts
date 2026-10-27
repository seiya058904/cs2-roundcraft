import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {realQuoteCatalog} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
const world=newWorld(),pairs=[['Vitality','FURIA'],['Falcons','Natus Vincere'],['G2','Spirit'],['FaZe','MOUZ'],['Aurora','The MongolZ']];
const cases=[...Array.from({length:30},(_,i)=>({pair:pairs[0],bestOf:1 as const,seed:501+i})),...pairs.flatMap(pair=>Array.from({length:10},(_,i)=>({pair,bestOf:3 as const,seed:601+i})))];
const unique=new Map<string,any>(),usage:Record<string,number>={},categories:Record<string,number>={};let rounds=0,maps=0,segments=0;
for(const c of cases){
 const ids=c.pair.map(name=>world.teams.find(t=>t.name===name)!.id),s=createSeries(world,ids[0],ids[1],c.bestOf,c.seed);autoVeto(s);simulateSeries(s);
 for(const ms of s.mapStates)for(const r of ms.rounds){
  assert.deepEqual(validateNarration(r),[]);const rng=s.rngState;assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  const beats=deriveCommentaryBeats(r,s);
  for(const line of r.commentary){
   segments++;const types=(line.sourceBeatIds??[]).map(id=>beats.find(b=>b.id===id)!.category);for(const type of types)categories[type]=(categories[type]??0)+1;
   const id=line.templateId;if(!id)continue;usage[id]=(usage[id]??0)+1;
   const key=id+'|'+(types[0]??''),prior=unique.get(key);
   if(!prior){
    const quote=realQuoteCatalog.get(id),anchor=Math.max(...line.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));
    unique.set(key,{id,type:line.sourceType,category:types,quote:quote?.text??null,source:quote?.source??null,pair:c.pair,bestOf:c.bestOf,seed:c.seed,map:r.map,round:r.number,text:line.text,brief:line.briefText,events:line.eventIds.map(id=>r.events.find(e=>e.id===id)),prefix:r.events.slice(0,anchor+1).filter(e=>['kill','trade','plant','defuseStart','defuseStop','defuse','smoke','flash','blind','tactic','coachTimeout'].includes(e.kind)),roundText:r.commentary.map(l=>l.text)});
   }
  }
  rounds++;
 }
 maps+=s.mapStates.length;
}
const rows=[...unique.values()].sort((a,b)=>a.category[0].localeCompare(b.category[0])||a.id.localeCompare(b.id));
const report={...reportMetadata(),scope:'30场普通BO1及五组真实阵容各10场普通BO3，固定种子501–530与601–610；每个实际播出素材/主节拍保留一个完整回合与有序事件前缀。',series:cases.length,maps,rounds,segments,categories,usage,rows};
writeFileSync('docs/commentary-natural-audit-iteration12.json',JSON.stringify(report,null,2));
console.log({...report,usage:undefined,categories:undefined,rows:rows.length});
