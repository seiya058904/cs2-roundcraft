import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseQuotes,normalizeQuote} from './import-quotes.mts';
import {reportMetadata} from './report-metadata.mts';

const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const manifest=json('data/normalized/quotes-manifest.json');
const imported=json('src/data/quotes.json') as ReturnType<typeof parseQuotes>;
const source=readFileSync('src/domain/realQuotes.ts','utf8');
const wired=new Set([...source.matchAll(/['"]((?:RQ|RB|RD|RF|RW)-\d+-\d+)['"]/g)].map(m=>m[1]));
const ordinary=json('docs/commentary-validation-iteration8.json'),matrix=json('docs/commentary-matrix-iteration8.json');
const metadata=reportMetadata();
for(const report of [ordinary,matrix])assert.equal(report.simulationSourceSha256,metadata.simulationSourceSha256,'事实门已变更，须重新生成普通队列证据');
const used=new Set<string>([...ordinary.templateIds,...matrix.usedIds]);
const eligible=new Set<string>([...Object.values(ordinary.observedPools),...Object.values(matrix.pools)].flatMap((pool:any)=>pool.ids));
const exclusions=new Map<string,{id:string;reason:string;duplicateOf?:string}>(manifest.exclusions.map((row:any)=>[row.id,row]));
const catalog=new Map(imported.map(q=>[q.id,q]));
const exclusionReasons:Record<string,string>={
 'RB-2-22':'“我替这个补枪进行的”语法和指代不明，无法确认原话；项目保守排除，未听录认证。',
 'RB-2-39':'“结合A首杀”“报A”含义不明，无法确认是否为转点/爆A，不能自行改写。',
 'RB-6-24':'“连个道连道具”转写重复、断句不明，无法可靠恢复完整原句。',
 'RB-8-14':'“一波活甲下包”含义不明，无法从文本还原动作。',
 'RB-10-24':'归一化后与RQ-4-1相同；保留已有编号与原句，重复原件仍保存。',
 'RB-12-8':'“步枪正文mp9”语义不通，无法确认“正文”原词。',
 'RB-12-17':'“打屁打B想装”含义和断句不明，无法确认所述动作。',
 'RB-12-20':'“狙打狙攻速换位置”语义和动作关系不明，不猜测恢复。',
 'RB-12-21':'“顶级副狙包点火逼走位”主语、断句和因果不明，不能可靠触发。',
 'RB-12-33':'“重噶”“找爆点补枪”词义和主体不明，无法确认原句。',
 'RD-7-3':'“摆扑”含义未确认，不能擅自改为AWP、白给或其他词；不按赛点标签强播。'
};
const observedGateReasons:Record<string,string>={
 'RD-2-7':'TeSeS本人补枪击杀ropz，且被击杀者当时持AWP；普通矩阵未出现完整组合。',
 'RD-2-17':'下包前60秒内由T击杀形成3v3，目标在中区，仍有T在中区且无CT存活于中区；不能只凭3v3就说中路失控。',
 'RD-4-13':'ZywOo使用Tec-9且实际爆头；不是任意ZywOo击杀或任意Tec-9命中。',
 'RD-5-6':'装备落后方本回合实际购买无甲AWP，花费至少达到AWP价格；不是继承大狙或仅购买选项选了强起。',
 'RF-4-4':'同一人至少三杀，所有目标在中区且最后一杀不晚于25秒。',
 'RF-5-5':'装备落后方无长枪，恰好一人有甲无头盔沙鹰，且仅该人有甲。',
 'RF-5-8':'实际经济翻盘并有获胜方Five-SeveN击杀。',
 'RF-6-7':'Nuke外场AK-47击杀，关联duel事件实际烟雾系数小于1；不能把任意地图的混烟都叫外场。',
 'RF-12-15':'实际爆头、击杀者zont1x且目标ZywOo；普通矩阵没有Spirit对Vitality的配对。',
 'RW-1-3':'T方装备落后且真实经济分类为force，至少两把主武器；强起采购命令本身不等同于已形成强起装备。'
};
const rows=manifest.batches.flatMap((batch:any)=>{
 const raw=parseQuotes(readFileSync(`data/source/${batch.sourceFile}`,'utf8'),batch.sourceFile,batch.prefix);
 assert.equal(raw.length,batch.rawCount);
 return raw.map(q=>{
  const exclusion=exclusions.get(q.id),record=catalog.get(q.id);
  assert.equal(Boolean(record),!exclusion);
  if(record){assert.equal(q.text,record.text);assert.equal(q.source,record.source);}
  if(exclusion?.duplicateOf)assert.equal(normalizeQuote(q.text),normalizeQuote(catalog.get(exclusion.duplicateOf)!.text));
  const status=exclusion?'excluded':used.has(q.id)?'spoken':eligible.has(q.id)?'eligible-not-spoken':wired.has(q.id)?'wired-not-observed':'unwired';
  const reason=exclusion?exclusionReasons[q.id]:status==='spoken'?'普通150种子与210场矩阵的实际使用并集。':status==='eligible-not-spoken'?'原事实门已通过；现有汇总证据不区分节拍预算、素材冷却、强度限制与同池竞争，不能武断归因。':status==='wired-not-observed'?observedGateReasons[q.id]??'源码有明确候选引用，但这两组普通队列未观察到通过事实门。':'已保存原文与标签，但没有实现该句的运行时事实门；不能解释成仅仅场景未排上或条件太严。';
  assert.ok(reason);
  return {...q,beat:record?.beat??'',status,reason,...(exclusion?{exclusion:exclusion.reason,duplicateOf:exclusion.duplicateOf}:{})};
 });
});
assert.equal(rows.length,1294);assert.equal(imported.length,1283);assert.equal(exclusions.size,11);
for(const id of wired)assert.ok(catalog.has(id),id);
const newRows=rows.filter((q:any)=>/^(RD|RF|RW)-/.test(q.id));
const count=(group:typeof rows)=>Object.fromEntries(['excluded','spoken','eligible-not-spoken','wired-not-observed','unwired'].map(status=>[status,group.filter((q:any)=>q.status===status).length]));
const counts=count(newRows);assert.equal(newRows.length,472);assert.equal(Object.values(counts).reduce((a:any,b:any)=>a+b,0),472);
const newWired=newRows.filter((q:any)=>wired.has(q.id)).length;
assert.equal(newWired,counts.spoken+counts['eligible-not-spoken']+counts['wired-not-observed']);
const extra=existsSync('docs/commentary-rare-scenes-audit.json')?json('docs/commentary-rare-scenes-audit.json'):undefined;
if(extra)assert.equal(extra.simulationSourceSha256,metadata.simulationSourceSha256);
const report={...metadata,scope:'原始交付逐条对账；实际播出与候选统计仅以原150种子和210场普通矩阵并集为准，另列定向队列，不混换分母。',rawCount:rows.length,importedCount:imported.length,excludedCount:exclusions.size,newPack:{raw:472,imported:471,counts,staticallyReferenced:newWired,spokenShareOfImported:counts.spoken/471},staticReferences:wired.size,rareScenes:extra?{matches:extra.matches,rounds:extra.rounds,counts:extra.counts,evenConditions:extra.evenConditions}:undefined,rows};
writeFileSync('docs/commentary-integration-accountability.json',JSON.stringify(report,null,2));
const escape=(value:string)=>value.replaceAll('|','\\|').replaceAll('\n',' ');
const labels:Record<string,string>={excluded:'未入库',spoken:'实际播出','eligible-not-spoken':'通过门但未播','wired-not-observed':'已接线未过门',unwired:'未接线'};
let md='# 语料数量与接入状态逐条对账\n\n日期：2026-10-27。此报告补正上一里程碑的统计与未完成项；不宣称全部语料或全部场景已完成。\n\n';
md+='## 数量对账\n\n| 批次 | 原文 | 入库 | 排除 |\n| --- | ---: | ---: | ---: |\n';
for(const b of manifest.batches)md+=`| ${b.prefix} / ${b.sourceFile} | ${b.rawCount} | ${b.importedCount} | ${b.rawCount-b.importedCount} |\n`;
md+='| 合计 | 1294 | 1283 | 11 |\n\n1294 − 10条项目判断的转写存疑句 − 1条重复句 = 1283。新三包472 − RD-7-3这1条 = 471。原件均保留；“未入库”与“入库但未启用”是两种状态。这里的存疑是项目对所交文本的保守判断，未重新听录，不冒充原作者已经标记或确认的错误。\n\n';
md+='## 未入库11条的完整清单\n\n| 编号 | 原文 | 排除原因 | 出处 |\n| --- | --- | --- | --- |\n';
for(const q of rows.filter((q:any)=>q.status==='excluded'))md+=`| ${q.id} | ${escape(q.text)} | ${q.reason} | ${escape(q.source)} |\n`;
md+='\n## 新包472条的去向\n\n原150种子与210场矩阵并集：106条实际播出（106/471 = 22.51%）；10条过事实门但未播；10条已有门但没有观察到满足；345条没有逐句运行时接线；另1条未入库。已接线合计126/471 = 26.75%。因此剩余365条绝大部分确实是接入工作尚未做完，不是随机采样不足。\n\n这两个队列之间有重叠，实际使用取ID并集，不将使用条数相加。静态引用和事实候选不等于最终播出；“过门未播”的具体未选原因没有被旧报告逐次记录，不能将10条全部解释成冷却。\n\n';
md+='### 已接线但普通队列未播出的20条\n\n| 编号 | 状态 | 原文 | 已知原因/限制 |\n| --- | --- | --- | --- |\n';
for(const q of newRows.filter((q:any)=>['eligible-not-spoken','wired-not-observed'].includes(q.status)))md+=`| ${q.id} | ${labels[q.status]} | ${escape(q.text)} | ${q.reason} |\n`;
if(extra){md+='\n## even与smoke-kill的独立定向验证\n\n'+extra.scope+' 该队列不回填、不改称原普通队列已覆盖。运行时源码未修改，现有事实门未放宽。\n\n| 语录/节拍 | 生成节拍 | 过事实门 | 节拍入选 | 真实原句播出 |\n| --- | ---: | ---: | ---: | ---: |\n';for(const [id,c] of Object.entries(extra.counts) as [string,any][])md+=`| ${id} / ${id==='RD-2-17'?'even':'smoke-kill'} | ${c.generatedBeats} | ${c.eligibleBeats} | ${c.selectedBeats} | ${c.spoken} |\n`;
 const c=extra.evenConditions;
 md+=`\neven尚未闭环，不能用正例夹具冒充自然播出。本队列逐步筛选：${c.generated}次3v3节拍 → ${c.tKill}次由T击杀形成 → ${c.targetAtMid}次目标在中区 → ${c.tStillAtMid}次仍有T在中区 → ${c.noCtAtMid}次中区已无CT。最后${c.tStillAtMid}次全部仍有CT位于中区，故“中路失控”这半句缺乏证据，被拒绝。这里的区域按事件前缀已到达位置计算，移动尚未到达也不提前记成撤离。不能据本队列推断所有合法决策下都不可能触发；三人中区争夺等定向布置也未穷举站位。\n`;
 md+='\nsmoke-kill已证明能在完整合法模拟中自然播出；最先保存的三次均来自Nuke、三人中区争夺配置，而非原普通队列。完整原始事件前缀、预设决策见 `commentary-rare-scenes-audit.json`，可读全文见 [定向样本](COMMENTARY_RARE_SCENES_SAMPLES.md)。定向验证的成功不证明任意3v3或任意混烟都有足够真实语料深度。\n';
 let samples='# 稀有节拍定向验证：完整回合样本\n\n2026-10-27。以下是固定240场队列最先保存的三次RF-6-7实际播出；不筛换为普通队列，不改写播出文字。已逐段抽读，原句后保留实际动作；必要的“隔着烟”事实补充仍有同义复述，不宣称所有重复或语气问题已消除。\n';
 for(const [i,s] of (extra.samples as any[]).entries()){
  samples+=`\n## ${i+1}. ${s.map} / ${s.profile} / seed ${s.seed} / R${s.round}\n\n`;
  for(const line of s.lines)samples+=line.text+'\n\n';
  samples+='精简：\n\n'+s.brief+'\n';
 }
 writeFileSync('docs/COMMENTARY_RARE_SCENES_SAMPLES.md',samples);
}
md+='\n## 新包原始472条逐条状态\n\n“未接线”不等于原句无用或原文有错，只表示当前代码没有足以授权该原句的逐句事实门。标签只是来源注释，不能直接授权。下表不猜测未实现条件，不把模板替代算作原句播出。\n\n| 编号 | 状态 | 原文 | 来源标签 |\n| --- | --- | --- | --- |\n';
for(const q of newRows)md+=`| ${q.id} | ${labels[q.status]} | ${escape(q.text)} | ${escape(q.beat)} |\n`;
md+='\n## 当前结论\n\n保留前次已验证的结构和回归成果，作为已验收里程碑；全量接入仍未完成。未接线345条需要逐句审读并按可证明条件推进，涉及未建模操作或不明称呼的句子应另列阻碍；不能靠移除人物、地图、武器和时序限制来凑使用率。未有逐字听录认证，风格判断仍需完整回合的文本审读。源码摘要：`'+metadata.simulationSourceSha256+'`。\n';
writeFileSync('docs/COMMENTARY_CORPUS_ACCOUNTABILITY.md',md);
console.log({...report,rows:undefined});
