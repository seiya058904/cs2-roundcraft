import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1];
if(iteration&&!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto} from '../src/domain/series.ts';
import {simulateSeries} from '../src/domain/engine.ts';
import {renderCommentary,validateNarration,deriveCommentaryBeats} from '../src/domain/narrative.ts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {quoteCandidates,realQuoteCatalog} from '../src/domain/realQuotes.ts';
const pools=new Map<string,Set<string>>(),realUsed=new Set<string>(),originalUsed=new Set<string>();
const categories=['setup','plan','timeout','economy','opening','disadvantage','even','two-v-two','four-v-three','five-v-three','rifle-v-awp','awp-opening','headshot','flash-conversion','smoke-kill','clutch-start','trade','flash','smoke','extinguish','grenade','fire-damage','rotation','pickup','plant','defuse-timing','save-decision','multikill','clutch-win','eco-win','close','half-time','overtime','overtime-threat','match-point','phase','awp-duel'];
for(const category of categories)pools.set(category,new Set());
let realSegments=0,sameRoundQuoteDuplicates=0,quoteCooldownViolations=0;
let rounds=0,segments=0,totalLength=0;const used=new Set<string>();const examples:unknown[]=[];const lengths:number[]=[];
for(let seed=1;seed<=150;seed++){
 const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);const rng=s.rngState;
 for(const r of s.mapStates[0].rounds){assert.deepEqual(validateNarration(r),[],`seed ${seed} R${r.number}`);assert.deepEqual(renderCommentary(r,s),r.commentary,`回放差异 seed ${seed} R${r.number}`);const beats=deriveCommentaryBeats(r,s);for(const b of beats){const category=b.category.startsWith('phase-')?'phase':b.category;if(!pools.has(category))pools.set(category,new Set());const pool=pools.get(category)!;for(const id of quoteCandidates(b,r)){assert.ok(realQuoteCatalog.has(id),`Missing quote ${id}`);pool.add(id);}for(const id of b.eventIds){const e=r.events.find(e=>e.id===id);assert.ok(e&&e.at<=b.at,'引用未来事实');}}
 const current=new Set<string>();const recent=new Set(s.mapStates[0].rounds.filter(previous=>previous.number<r.number&&previous.number>=r.number-5).flatMap(previous=>previous.commentary.flatMap(x=>[x.templateId,x.supportTemplateId])));
 for(const x of r.commentary)for(const id of [x.templateId,x.supportTemplateId].filter((id):id is string=>Boolean(id))){used.add(id);assert.ok(!current.has(id),'同回合素材重复');assert.ok(!recent.has(id),'五回合素材冷却失效');current.add(id);if(realQuoteCatalog.has(id)){realUsed.add(id);realSegments++;}else originalUsed.add(id);}
 rounds++;segments+=r.commentary.length;const length=r.commentary.map(x=>x.text).join('').length;lengths.push(length);totalLength+=length;if(examples.length<15&&(r.events.some(e=>e.kind==='trade')||r.reason==='defuse'))examples.push({seed,map:r.map,round:r.number,score:r.score,lines:r.commentary});}
 assert.equal(s.rngState,rng,'解说消耗比赛随机流');
}
assert.equal(sameRoundQuoteDuplicates,0);assert.equal(quoteCooldownViolations,0);
const eligible=new Set([...pools.values()].flatMap(pool=>[...pool]));
lengths.sort((a,b)=>a-b);const report={...metadata,seeds:150,rounds,segments,averageChars:totalLength/rounds,p95Chars:lengths[Math.floor(lengths.length*.95)],activatedTemplates:used.size,templateIds:[...used].sort(),realQuoteCount:realQuoteCatalog.size,eligibleRealQuotes:eligible.size,activatedRealQuotes:realUsed.size,actualQuoteUtilization:realUsed.size/realQuoteCatalog.size,realSegments,realSegmentShare:realSegments/segments,activatedOriginalTemplates:originalUsed.size,beatCoverage:categories.filter(category=>pools.get(category)!.size).length,beatCount:categories.length,additionalBeatCoverage:[...pools].filter(([category,pool])=>!categories.includes(category)&&pool.size).length,additionalBeatCount:pools.size-categories.length,observedPools:Object.fromEntries([...pools].map(([category,pool])=>[category,{count:pool.size,ids:[...pool].sort()}])),issues:{sameRoundQuoteDuplicates,quoteCooldownViolations,futureEventReferences:0,replayDifferences:0,randomStreamChanges:0},examples};writeFileSync(iteration?`docs/commentary-validation-iteration${iteration}.json`:'docs/commentary-validation.json',JSON.stringify(report,null,2));console.log({...report,examples:undefined,observedPools:undefined,templateIds:undefined});
