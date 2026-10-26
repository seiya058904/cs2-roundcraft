import {readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto} from '../src/domain/series.ts';
import {simulateSeries} from '../src/domain/engine.ts';
import {deriveCommentaryBeats} from '../src/domain/narrative.ts';
const rows=JSON.parse(readFileSync('docs/esm-review/round-review-candidates.json','utf8'));
const wanted=new Set(['eco-win','clutch-win','overtime','defuse-timing']);
for(let seed=1;seed<=200&&wanted.size;seed++){
 const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){
  const key=deriveCommentaryBeats(r,s).find(b=>wanted.has(b.category))?.category;
  if(!key)continue;
  rows.push({rule:key,map:r.map,seed,round:r,commentary:r.commentary.map(x=>x.text).join('\n')});wanted.delete(key);
 }
}
writeFileSync('docs/esm-review/round-review.json',JSON.stringify({unfound:[...wanted],rows},null,2));
console.log('Review rounds',rows.length,'missing',Array.from(wanted));
