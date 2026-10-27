import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats} from '../src/domain/narrative';
import {quoteCandidates} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
const review=JSON.parse(readFileSync('docs/commentary-quote-review-iteration9.json','utf8'));
const wanted=new Set<string>(review.rows.filter((q:any)=>q.decision==='wired').map((q:any)=>q.id));
const samples=new Map<string,unknown>(),checks:Record<string,{checked:number;echoes:number}>={};
for(const id of ['RF-6-7','RD-2-17','RF-3-6','RW-12-13','RW-3-9','RD-3-7'])checks[id]={checked:0,echoes:0};
for(let seed=1;seed<=150;seed++){
 const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){
  const beats=deriveCommentaryBeats(r,s);
  for(const line of r.commentary){
   const id=line.templateId;if(!id)continue;
   if(checks[id]){
    checks[id].checked++;
    const echo=id==='RF-6-7'?/这一枪是隔着烟打的|隔着烟带走了对手|隔着烟，还打了个爆头/.test(line.text):id==='RD-2-17'?(line.text.match(/三打三|3打3/g)??[]).length>1:id==='RF-3-6'?(line.text.match(/一打一/g)??[]).length>1:['RW-3-9','RD-3-7'].includes(id)?(line.text.match(/一打二|一打2/g)??[]).length>1:line.text.includes('这一枪过后');
    if(echo)checks[id].echoes++;
   }
   if(wanted.has(id)&&!samples.has(id)){
    const own=beats.find(b=>line.sourceBeatIds?.includes(b.id)&&quoteCandidates(b,r).includes(id));assert.ok(own,id);
    const anchor=Math.max(...own.eventIds.map(eventId=>r.events.findIndex(e=>e.id===eventId)));
    samples.set(id,{id,queue:'ordinary-150',seed,map:r.map,round:r.number,text:line.text,roundText:r.commentary.map(x=>x.text).join('\n\n'),factGate:own,eventPrefix:r.events.slice(0,anchor+1)});
   }
  }
 }
}
const matrix=JSON.parse(readFileSync('docs/commentary-matrix-iteration9.json','utf8'));
for(const sample of matrix.samples)if(wanted.has(sample.id)&&!samples.has(sample.id))samples.set(sample.id,{...sample,queue:'matrix-210'});
for(const c of Object.values(checks))assert.equal(c.echoes,0);
const report={...reportMetadata(),scope:'普通150种子逐句检查六个指定语录的已知语义补句；0次检查不等于覆盖。附新增句首次播出，补充矩阵中已保存样本；不伪称所有101条都有自然正例。',checks,sampleCount:samples.size,samples:[...samples.values()]};
writeFileSync('docs/commentary-new-lines-samples-iteration9.json',JSON.stringify(report,null,2));
console.log({...report,samples:undefined});
