import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {realQuoteCatalog} from '../src/domain/realQuotes';
import {formatCommentaryNames} from '../src/domain/names';
import {deriveCommentaryBeats,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';
const rules:{name:string;quote:RegExp;tail:RegExp}[]=[
 {name:'headshot',quote:/爆头|头皮被秒/,tail:/爆头/},
 {name:'smoke',quote:/混烟|隔着烟|隔烟/,tail:/隔着烟|混烟/},
 {name:'no-kit',quote:/没有钳子|没钳子/,tail:/没有钳子|没钳/},
 {name:'two-v-two',quote:/二打二|2打2/,tail:/二打二|2打2/},
 {name:'one-v-two',quote:/一打二|一打2/,tail:/一打二|一打2/},
 {name:'one-v-four',quote:/一打四|一打4/,tail:/一打四|一打4/},
 {name:'three-kills',quote:/三杀|3杀|三个人头/,tail:/三杀|3杀|三个击杀/},
 {name:'four-kills',quote:/四杀|4杀|四个人头/,tail:/四杀|4杀|四个击杀/},
 {name:'timeout',quote:/暂停/,tail:/暂停/},
 {name:'explosion',quote:/炸弹爆炸|包炸了/,tail:/炸弹爆炸|包炸了/}
];
const world=newWorld(),counts:Record<string,number>=Object.fromEntries(rules.map(r=>[r.name,0])),examples=new Map<string,any>();let rounds=0,checked=0;
for(let seed=1;seed<=150;seed++){
 const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){assert.deepEqual(validateNarration(r),[]);const beats=deriveCommentaryBeats(r,s);
  for(const line of r.commentary){const q=line.templateId&&realQuoteCatalog.get(line.templateId);if(!q)continue;const original=formatCommentaryNames(q.text,s.players,s.teams);assert.ok(line.text.startsWith(original));const tail=line.text.slice(original.length);checked++;
   for(const rule of rules)if(rule.quote.test(original)&&rule.tail.test(tail)){counts[rule.name]++;const key=rule.name+'|'+q.id;if(!examples.has(key))examples.set(key,{rule:rule.name,id:q.id,seed,map:r.map,round:r.number,category:(line.sourceBeatIds??[]).map(id=>beats.find(b=>b.id===id)!.category),text:line.text,brief:line.briefText,events:line.eventIds.map(id=>r.events.find(e=>e.id===id)),roundText:r.commentary.map(l=>l.text)});}
  }rounds++;
 }
}
const report={...reportMetadata(),scope:'150种子普通队列；只按列出的字面模式标记待人工抽读的可能重复，不把命中直接等同错误。',rounds,checked,counts,examples:[...examples.values()]};
writeFileSync('docs/commentary-semantic-audit-iteration12.json',JSON.stringify(report,null,2));console.log({...report,examples:report.examples.length});
