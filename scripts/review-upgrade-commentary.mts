import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1];
if(iteration&&!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');

const wanted=['ordinary','eco-win','flash-conversion','rotation','defuse-timing','save-decision','clutch-win','overtime'];
const buckets=new Map(wanted.map(k=>[k,[] as {seed:number;map:string;round:number;text:string;brief:string;quotes:string[]}[]]));
const seen=new Set<string>();
for(let seed=1;seed<=250;seed++){
 const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){assert.deepEqual(validateNarration(r),[]);const emitted=new Set(r.commentary.flatMap(s=>s.sourceBeatIds??[]));const categories=deriveCommentaryBeats(r,s).filter(b=>emitted.has(b.id)).map(b=>b.category);
  for(const kind of [...wanted.slice(1),'ordinary']){
   const list=buckets.get(kind)!;if(list.length>=4||seen.has(`${seed}-${r.number}`)||(kind!=='ordinary'&&!categories.includes(kind)))continue;
   list.push({seed,map:r.map,round:r.number,text:r.commentary.map(x=>x.text).join('\n\n'),brief:r.commentary.map(x=>x.briefText??'').filter(Boolean).join('\n'),quotes:r.commentary.map(x=>x.templateId??'').filter(x=>/^(RQ|RB|RD|RF|RW)-/.test(x))});seen.add(`${seed}-${r.number}`);break;
  }
 }
 if([...buckets.values()].every(b=>b.length>=4))break;
}
const rows=[...buckets].flatMap(([category,list])=>list.map(r=>({category,...r})));
assert.ok(rows.length>=30,'Need at least 30 representative rounds');
writeFileSync(`docs/commentary-review-samples${iteration?`-iteration${iteration}`:''}.json`,JSON.stringify({...reportMetadata(),rows},null,2));
writeFileSync(`docs/COMMENTARY_REVIEW_SAMPLES${iteration?`_ITERATION${iteration}`:''}.md`,'# 解说人工审读样本\n\n'+rows.map((r,i)=>`## ${i+1}. ${r.category} / seed ${r.seed} / ${r.map} R${r.round}\n\n${r.text}\n\n精简：\n${r.brief}\n\n语录：${r.quotes.join(', ')}`).join('\n\n'));
console.log('Review samples:',rows.length,Object.fromEntries([...buckets].map(([k,v])=>[k,v.length])));
