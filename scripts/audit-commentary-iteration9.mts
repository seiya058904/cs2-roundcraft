import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {reportMetadata} from './report-metadata.mts';
import {realQuoteCatalog} from '../src/domain/realQuotes';
const read=(name:string)=>JSON.parse(readFileSync('docs/'+name,'utf8'));
const review=read('commentary-quote-review-iteration9.json'),ordinary=read('commentary-validation-iteration9.json'),matrix=read('commentary-matrix-iteration9.json'),rare=read('commentary-rare-scenes-iteration9.json');
const metadata=reportMetadata();for(const r of [review,ordinary,matrix,rare])assert.equal(r.simulationSourceSha256,metadata.simulationSourceSha256);
const before=read('commentary-integration-accountability.json');
const originalNew=before.rows.filter((q:any)=>/^(RD|RF|RW)-/.test(q.id));
const baselineUnwired=new Set(before.rows.filter((q:any)=>q.status==='unwired'&&/^(RD|RF|RW)-/.test(q.id)).map((q:any)=>q.id));
assert.equal(review.rows.length,345);assert.deepEqual(new Set(review.rows.map((q:any)=>q.id)),baselineUnwired);
const usedOrdinary=new Set<string>([...ordinary.templateIds,...matrix.usedIds].filter(id=>realQuoteCatalog.has(id)));
const eligibleOrdinary=new Set<string>([...Object.values(ordinary.observedPools),...Object.values(matrix.pools)].flatMap((p:any)=>p.ids));
const usedAll=new Set<string>([...usedOrdinary,...rare.usedIds].filter(id=>realQuoteCatalog.has(id))),eligibleAll=new Set<string>([...eligibleOrdinary,...rare.eligibleIds]);
const rows=review.rows.map((q:any)=>({...q,ordinaryCandidate:eligibleOrdinary.has(q.id),ordinarySpoken:usedOrdinary.has(q.id),targetedCandidate:rare.eligibleIds.includes(q.id),targetedSpoken:rare.usedIds.includes(q.id)}));
for(const row of rows){if(row.decision==='deferred'){assert.equal(eligibleAll.has(row.id),false,row.id);assert.equal(usedAll.has(row.id),false,row.id);}assert.equal(row.text,realQuoteCatalog.get(row.id)!.text);}
const newPackIds=new Set<string>(originalNew.filter((q:any)=>q.status!=='excluded').map((q:any)=>q.id));
const wiredIds=new Set([...readFileSync('src/domain/realQuotes.ts','utf8').matchAll(/['"]((?:RD|RF|RW)-\d+-\d+)['"]/g)].map(m=>m[1]));
assert.equal(wiredIds.size,126+review.newlyWired);
for(const id of [...usedOrdinary].filter(id=>newPackIds.has(id)))assert.ok(eligibleOrdinary.has(id),id+'实际播出却不在事实候选并集');
const newly=rows.filter((q:any)=>q.decision==='wired');
const packUsed=[...usedOrdinary].filter(id=>newPackIds.has(id)),packEligible=[...eligibleOrdinary].filter(id=>newPackIds.has(id));
const oldMatrix=read('commentary-matrix-baseline-iteration9.json');assert.equal(matrix.factDigest,oldMatrix.factDigest);
const semantic={smokeSamplesChecked:0,smokeGenericEchoes:0,evenSamplesChecked:0,evenGenericEchoes:0};
for(const sample of rare.samples){
 for(const line of sample.lines){
  if(line.templateId==='RF-6-7'){semantic.smokeSamplesChecked++;if(/这一枪是隔着烟打的|隔着烟带走了对手|隔着烟，还打了个爆头/.test(line.text))semantic.smokeGenericEchoes++;}
  if(line.templateId==='RD-2-17'){semantic.evenSamplesChecked++;if((line.text.match(/三打三|3打3/g)??[]).length>1||line.text.includes('中路这边已经没有防守队员'))semantic.evenGenericEchoes++;}
 }
}
assert.equal(semantic.smokeGenericEchoes,0);assert.equal(semantic.evenGenericEchoes,0);
const report={...metadata,reviewed:345,newlyWired:review.newlyWired,deferred:review.deferred,newWiredOrdinaryEligible:newly.filter((q:any)=>q.ordinaryCandidate).length,newWiredOrdinarySpoken:newly.filter((q:any)=>q.ordinarySpoken).length,newWiredAllEligible:newly.filter((q:any)=>eligibleAll.has(q.id)).length,newWiredAllSpoken:newly.filter((q:any)=>usedAll.has(q.id)).length,newPack:{imported:471,staticallyWired:wiredIds.size,deferred:review.deferred,ordinaryEligible:packEligible.length,ordinaryUsed:packUsed.length,ordinaryEligibleNotSpoken:packEligible.filter(id=>!usedOrdinary.has(id)).length,ordinaryWiredNotObserved:[...wiredIds].filter(id=>!eligibleOrdinary.has(id)).length,ordinaryIds:packUsed.sort(),allUsed:[...usedAll].filter(id=>newPackIds.has(id)).sort()},rare:{matches:rare.matches,rounds:rare.rounds,counts:rare.counts},semantic,matrixFactDigest:matrix.factDigest,rows};
writeFileSync('docs/commentary-review-accountability-iteration9.json',JSON.stringify(report,null,2));
let samples='# 第九轮稀有节拍：完整实际播出样本\n\n自然比赛由合法预设决策产生；没有插入事件、修改装备、手动换句或放宽原RD-2-17/RF-6-7事实门。定向队列与普通队列分开统计。\n';
for(const sample of rare.samples){samples+=`\n## ${sample.id} / ${sample.map} / ${sample.profile} / seed ${sample.seed} / R${sample.round}\n\n`;for(const line of sample.lines)samples+=line.text+'\n\n';samples+='精简：\n\n'+sample.brief+'\n';}
writeFileSync('docs/COMMENTARY_RARE_SCENES_ITERATION9.md',samples);
console.log({...report,rows:undefined,newPack:{...report.newPack,ordinaryIds:undefined,allUsed:report.newPack.allUsed.length}});
