import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {commentaryPlayerName} from '../src/domain/names';
import {reportMetadata} from './report-metadata.mts';
import type {RoundResult,Series} from '../src/domain/types';
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1];
if(iteration&&!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');

// Compare the exact same rounds, rather than swapping out a failing sample.
const baseline=JSON.parse(readFileSync('docs/commentary-review-baseline-batch2.json','utf8')) as {rows:{seed:number;round:number;category:string;text:string}[]};
function inspect(text:string,r:RoundResult,s:Series){
 const blocks=text.split('\n\n'),issues:string[]=[];
 const nick=(id:string|undefined)=>commentaryPlayerName(s.players.find(p=>p.id===id)!);
 const first=r.events.find(e=>e.kind==='kill');
 const opening=blocks.find(b=>/先交火！|首杀出现在|首杀之后是|这边先掉人/.test(b));
 if(first&&opening){
  if(blocks.some(b=>b!==opening&&b.includes(`${nick(first.actor)}爆头带走${nick(first.target)}`)))issues.push('duplicate-opening-headshot');
  if(blocks.some(b=>b!==opening&&b.includes(nick(first.actor))&&/大狙先响|AWP\s*先响/.test(b)))issues.push('duplicate-awp-opening');
 }
 for(const block of blocks.filter(b=>b.includes('闪给到了！'))){
  const kill=r.events.find(e=>e.kind==='kill'&&block.includes(`把${nick(e.target)}闪白`)&&(block.includes(`${nick(e.actor)}第二时间接上击杀`)||block.includes(`${nick(e.actor)}第二时间用${e.weapon}完成击杀`)));
  if(kill&&['HE','fire'].includes(kill.weapon!))issues.push('utility-kill-described-as-flash-gun-conversion');
 }
 if(blocks.filter(b=>/拆掉了|最后完成拆包，回防成功/.test(b)).length>2)issues.push('triple-defuse-resolution');
 if(text.includes('这个雷太精髓了，T 没想到自己能被炸！')){
  if(r.events.some(e=>e.kind==='damage'&&e.weapon==='HE'&&r.initial.find(f=>f.id===e.target)?.side==='CT'&&blocks.some(b=>b.includes('这个雷太精髓了')&&b.includes(`炸到${e.hpAfter}血`))))issues.push('grenade-victim-side-mismatch');
 }
 return issues;
}
const cache=new Map<number,Series>();
const rows=baseline.rows.map(row=>{
 let s=cache.get(row.seed);
 if(!s){s=createSeries(newWorld(),'team-3','team-7',1,row.seed);autoVeto(s);simulateSeries(s);cache.set(row.seed,s);}
 const r=s.mapStates[0].rounds.find(r=>r.number===row.round)!;
 const text=r.commentary.map(line=>line.text).join('\n\n');
 return {seed:row.seed,round:row.round,category:row.category,before:inspect(row.text,r,s),after:inspect(text,r,s),text};
});
const before=rows.reduce((n,r)=>n+r.before.length,0),after=rows.reduce((n,r)=>n+r.after.length,0);
assert.ok(after<before,'固定样本的问题数没有下降');
assert.equal(after,0,JSON.stringify(rows.filter(row=>row.after.length).map(row=>({seed:row.seed,round:row.round,issues:row.after,text:row.text}))));
const report={...reportMetadata(),sampleCount:rows.length,before,after,scope:'仅检测所列五类结构性问题，不代表所有口语重复和事实问题已穷尽。人工审读另见迭代报告。',rows};
writeFileSync(`docs/commentary-review-comparison-batch2${iteration?`-iteration${iteration}`:''}.json`,JSON.stringify(report,null,2));
console.log({sampleCount:rows.length,before,after});
