import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {reportMetadata} from './report-metadata.mts';
import type {Series} from '../src/domain/types';
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1]??'3';
if(!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');

const baseline=JSON.parse(readFileSync('docs/commentary-review-baseline-iteration3.json','utf8')) as {rows:{seed:number;round:number;map:string;text:string;category:string}[]};
const explanations=[
 '包一落地，比赛的任务就变了：进攻方可以围绕时间组织，防守方必须在计时结束前完成拆除。',
 '血量被压低之后，下一次交火的容错就小了。道具造成的这部分伤害，也会影响后面的交换。',
 '这颗烟先改变的是视野，后续能不能转成空间，还要看队员是否跟进。现在不能提前说这个区域已经安全。',
 '火区解除和区域清空是两回事。烟处理掉了持续伤害，剩下的枪线还得靠人来确认。'
];
const cache=new Map<number,Series>();
const rows=baseline.rows.map(row=>{
 let s=cache.get(row.seed);if(!s){s=createSeries(newWorld(),'team-3','team-7',1,row.seed);autoVeto(s);simulateSeries(s);cache.set(row.seed,s);}
 const r=s.mapStates[0].rounds.find(r=>r.number===row.round)!;
 return {...row,beforeText:row.text,text:r.commentary.map(line=>line.text).join('\n\n')};
});
const issues=(field:'beforeText'|'text')=>rows.flatMap(row=>explanations.filter(text=>row[field].includes(text)&&rows.some(old=>old.seed===row.seed&&old.map===row.map&&old.round<row.round&&old.round>=row.round-5&&old[field].includes(text))).map(text=>({seed:row.seed,round:row.round,text})));
const before=issues('beforeText'),after=issues('text');
assert.ok(after.length<before.length);assert.equal(after.length,0);
const matrix=JSON.parse(readFileSync(`docs/commentary-matrix-iteration${iteration}.json`,'utf8'));
const oldMatrix=JSON.parse(readFileSync(`docs/commentary-matrix-baseline-iteration${iteration}.json`,'utf8'));
assert.equal(matrix.factDigest,oldMatrix.factDigest,'解说改动改变了比赛事实');
const report={...reportMetadata(),scope:'相同32回合样本中可比较的五回合内四类固定解释段复用；不声称全部口语重复清零。',sampleCount:rows.length,before:before.length,after:after.length,priorIssues:before,factDigest:matrix.factDigest,rows};
writeFileSync(`docs/commentary-review-comparison-iteration${iteration}.json`,JSON.stringify(report,null,2));
console.log({sampleCount:rows.length,repeatedExplanationsBefore:before.length,repeatedExplanationsAfter:after.length,factDigestUnchanged:true});
