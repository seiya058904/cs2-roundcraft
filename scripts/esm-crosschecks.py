from pathlib import Path
import csv,io,json,hashlib,collections,re,sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else 'esm2026-extract');OUT=Path('docs/esm-review')
def load(p):return json.loads((ROOT/p).read_text(encoding='utf-8-sig'))
def write(name,d):(OUT/name).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
rules={r['rule'] for r in load('02_tactics/rules.json')}
tactics=load('02_tactics/tactics.json')['tactics'];strategies=load('03_strategies/strategies.json')['strategies']
issues=[]
for name,rows in [('tactics',tactics),('strategies',strategies)]:
 ids=[r['id'] for r in rows]
 if len(set(ids))!=len(ids):issues.append(name+' duplicate IDs')
for t in tactics:
 if any(b not in range(5) for b in t['buyTypes']):issues.append(t['id']+' bad buy type')
 if t['teamSide'] not in (0,1):issues.append(t['id']+' bad side')
maps=collections.Counter(t['map'] for t in tactics)
tc=load('08_import_ready/teamcalls.json')
mapping={'unknownRules':sorted(set(tc['ruleToPrimitive'])-rules),'unmappedRules':sorted(rules-set(tc['ruleToPrimitive'])-set(tc['booleanModifiers'])),'unknownPrimitives':sorted(set(tc['ruleToPrimitive'].values())-set(tc['primitives'])),'warning':'ReturnToTakeBomb -> alwaysRetake and site-neutral rules -> only A are unverified/lossy mappings; not executed'}
tables=[json.loads(p.read_text(encoding='utf-8-sig')) for p in (ROOT/'01_localization/tables').glob('*.json')]
by={(d['locale'],d['table']):d for d in tables};missing=[];duplicates=[]
for d in tables:
 ids=[str(x['id']) for x in d['entries']]
 if len(set(ids))!=len(ids):duplicates.append([d['locale'],d['table']])
 en=by.get(('en',d['table']))
 if en:
  absent={str(x['id']) for x in en['entries']}-set(ids)
  if absent:missing.append({'locale':d['locale'],'table':d['table'],'missing':sorted(absent)})
classes=load('06_vocab/classes.json');snapshot=load('_snapshots/cs2-project-before.json')
memberIssues=[t['index'] for t in classes['types'] if len(t['fields'])!=t['fieldCount'] or len(t['methods'])!=t['methodCount']]
graphs=[json.loads(p.read_text(encoding='utf-8-sig')) for p in (ROOT/'04_events/graphs').glob('*.json')]
graphDuplicates=[g['subject'] for g in graphs if len({b['id'] for b in g['blocks']})!=len(g['blocks'])]
baseline=json.loads((OUT/'files.json').read_text(encoding='utf-8'));changed=[]
for row in baseline:
 if hashlib.sha256((ROOT/row['path']).read_bytes()).hexdigest()!=row['sha256']:changed.append(row['path'])
assert not changed,'Reference pack changed'
write('crosschecks.json',dict(issues=issues,tacticsByMap=maps,teamCallMapping=mapping,missingTranslations=missing,duplicateLocalizationIds=duplicates,memberCountMismatches=memberIssues,fieldCount=sum(len(t['fields']) for t in classes['types']),methodCount=sum(len(t['methods']) for t in classes['types']),metadataWarning='Count totals match but member ownership is unverified; no signatures, bodies or dependency edges.',graphCount=len(graphs),graphBlocks=sum(len(g['blocks']) for g in graphs),duplicateGraphIds=graphDuplicates,snapshotDeclared=snapshot['count'],snapshotActual=len(snapshot['files']),snapshotWarning='Historical project snapshot, not the implementation baseline; source binary hashes cannot be verified from the extraction pack alone.',referenceFiles=len(baseline),referenceChanged=changed))
# Give every symbol an explicit evidence-limited disposition, including non-keyword matches.
symbols=json.loads((OUT/'symbol-index.json').read_text(encoding='utf-8'))
for t in symbols:
 t['disposition']='只作参考' if t['category']=='match-candidate' else '本轮不采用'
 t['reason']={'library':'系统库/工具链命名；不移植其声明','generated':'编译器生成状态机/闭包；无函数体','match-candidate':'名称用于候选检查；所有权及依赖边未确认，不当作机制','other/unclassified':'尚未确认用途；无可靠比赛实现证据，不凭关键词判为经营代码'}[t['category']]
write('symbol-index.json',symbols)
print('Reference unchanged:',len(baseline),'files; rules not in original catalogue:',mapping['unknownRules'])
