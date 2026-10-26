"""Read-only reference analysis. Writes only project-local review artifacts."""
from pathlib import Path
import ast, collections, csv, hashlib, io, json, re, sys

ROOT = Path(sys.argv[1] if len(sys.argv)>1 else 'esm2026-extract')
OUT = Path('docs/esm-review')
OUT.mkdir(exist_ok=True)
def load(name): return json.loads((ROOT/name).read_text(encoding='utf-8-sig'))
def write(name, value): (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
inventory=[]; hashes=collections.defaultdict(list); parsed={}; anomalies=[]
for p in sorted(ROOT.rglob('*')):
 if not p.is_file(): continue
 raw=p.read_bytes(); rel=p.relative_to(ROOT).as_posix(); digest=hashlib.sha256(raw).hexdigest(); hashes[digest].append(rel)
 row=dict(path=rel,bytes=len(raw),sha256=digest,format=p.suffix,status='full text decoded; semantic review pending')
 try:
  text=raw.decode('utf-8-sig');row['lines']=len(text.splitlines())
  if p.suffix=='.json': parsed[rel]=json.loads(text);row['status']='full JSON parsed'
  elif p.suffix=='.jsonl': parsed[rel]=[json.loads(s) for s in text.splitlines() if s.strip()];row['status']='all JSONL rows parsed'
  elif p.suffix=='.csv': parsed[rel]=list(csv.DictReader(io.StringIO(text)));row['status']='all CSV rows parsed'
  elif p.suffix=='.py':
   tree=ast.parse(text);row['status']='full AST parsed; manual reading tracked separately in coverage.json'
   row['functions']=[dict(name=n.name,line=n.lineno,end=n.end_lineno) for n in ast.walk(tree) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))]
   row['calls']=sorted(set(ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n,ast.Call)))
   row['disposition']='reference only: extraction/build/diagnostic tooling, not match implementation'
 except Exception as error: row['error']=str(error);anomalies.append(dict(file=rel,error=str(error)))
 inventory.append(row)
for row in inventory: row['identicalFiles']=[p for p in hashes[row['sha256']] if p!=row['path']]
write('files.json',inventory)
phases={'basicRules':'basic','earlyTimingRules':'early','midTimingRules':'mid','lateTimingRules':'late','bombPlantedRules':'bomb'}
tactics=load('02_tactics/tactics.json')['tactics'];rules=load('02_tactics/rules.json');byid={t['id']:t for t in tactics};byrule={r['rule']:r for r in rules}
usage=collections.Counter();patterns=collections.defaultdict(list);tactic_checks=[]
for t in tactics:
 issues=[]
 for field,phase in phases.items():
  values=t[field]
  if len(values)!=len(set(values)):issues.append('duplicate rule '+field)
  for r in values:
   usage[r]+=1
   if r not in byrule:issues.append('unknown rule '+r)
   elif byrule[r]['phase']!=phase:issues.append('phase mismatch '+r)
   elif byrule[r]['side'] not in ('any','t' if t['teamSide']==0 else 'ct'):issues.append('side mismatch '+r)
 signature=json.dumps([t['teamSide'],t['startPoints'],*[t[k] for k in phases]],sort_keys=True)
 patterns[signature].append(t['id'])
 tactic_checks.append(dict(id=t['id'],map=t['map'],side=t['teamSide'],buyTypes=t['buyTypes'],rules={p:t[f] for f,p in phases.items()},issues=issues,disposition='adapt rule patterns; do not import heuristic pace or duplicate map data'))
write('tactics.json',tactic_checks)
write('rule-usage.json',[dict(**r,actualRefs=usage[r['rule']],countMatches=usage[r['rule']]==r['refs']) for r in rules])
slots=['pistolRoundSetup','fullBuyRoundSetup','semiBuyRoundSetup','forceRoundSetup','ecoRoundSetup'];strategy_checks=[]
for s in load('03_strategies/strategies.json')['strategies']:
 issues=[];refs=[]
 for i,key in enumerate(slots):
  for tid in s[key]:
   if not tid:continue
   refs.append(tid);t=byid.get(tid)
   if not t:issues.append('missing '+tid)
   elif t['map']!=s['mapId'] or t['teamSide']!=s['teamSide'] or i not in t['buyTypes']:issues.append('incompatible '+tid)
 strategy_checks.append(dict(id=s['id'],references=refs,empty=not refs,issues=issues,disposition='adapt economy-specific candidate pools; cyclic selection is our design, not verified original behavior'))
write('strategies.json',strategy_checks)
graphs=[]
for p in sorted((ROOT/'04_events/graphs').glob('*.json')):
 g=json.loads(p.read_text(encoding='utf-8'));nodes={b['id']:b for b in g['blocks']};edges={i:[x['EndBlockId'] for x in b.get('guides',[]) if x.get('EndBlockId')] for i,b in nodes.items()}
 missing=[(i,j) for i,targets in edges.items() for j in targets if j not in nodes]; incoming={j for targets in edges.values() for j in targets};entries=set(nodes)-incoming;visited=set();active=set();cycles=[]
 def visit(i):
  if i in active:cycles.append(i);return
  if i in visited or i not in nodes:return
  visited.add(i);active.add(i)
  for j in edges[i]:visit(j)
  active.remove(i)
 for i in entries:visit(i)
 unreachable=set(nodes)-visited
 for i in nodes:visit(i)
 graphs.append(dict(subject=g['subject'],nodes=len(nodes),entries=sorted(entries),terminals=[i for i in nodes if not edges[i]],missing=missing,cycles=cycles,unreachable=sorted(unreachable),locales=g['locales'],placeholders=sorted(set(re.findall(r'\{[^{}]+\}',json.dumps(g['texts'],ensure_ascii=False)))),disposition='structure reference only; management scope excluded; node types/effects unverified'))
write('event-graphs.json',graphs)
localizations={};locissues=[]
for rel,d in parsed.items():
 if rel.startswith('01_localization/tables/'):
  localizations[(d['locale'],d['table'])]={str(e['id']):e for e in d['entries']}
for (locale,table),entries in localizations.items():
 anchor=localizations.get(('en',table),{})
 for id,e in entries.items():
  base=anchor.get(id)
  tokens=lambda s:sorted(re.findall(r'\{\d+(?:[^{}]*)?\}',s))
  if not base or tokens(base['text'])!=tokens(e['text']):locissues.append(dict(locale=locale,table=table,id=id,reason='missing English key' if not base else 'numeric placeholder mismatch'))
write('localization-checks.json',dict(tables=len(localizations),rows=sum(map(len,localizations.values())),issues=locissues))
noise=('System','Microsoft','Mono','Unity','Newtonsoft','MessagePack','Steamworks','TMPro','DG','Cysharp','JetBrains','Ionic','SevenZip','Interop','AOT','Sentry','Firebase','NCalc','YamlDotNet','Package','Internal')
classrows=[]
for t in load('06_vocab/classes.json')['types']:
 ns=t['namespace'] or '';name=t['name'] or '';text=' '.join([name,*t['fields'],*t['methods']])
 category='library' if ns.startswith(noise) else 'generated' if name.startswith('<') else 'match-candidate' if re.search(r'Match|Tactic|Strateg|Simulation|Grenade|Weapon|TeamCall|Round|Defuse|Retake|Clutch',text) else 'other/unclassified'
 classrows.append(dict(index=t['index'],namespace=ns,name=name,category=category,fields=t['fields'],methods=t['methods'],evidence='names only; cumulative member grouping unverified; no signatures or implementation'))
write('symbol-index.json',classrows)
write('enum-index.json',[dict(**e,evidence='member names and declaration order only; numeric values unknown') for e in load('06_vocab/enums.json')])
defaults=parsed['06_vocab/field-defaults.csv'];write('constant-review.json',[dict(**r,disposition='reference only; original type and byte width not verified') for r in defaults])
summary=dict(files=len(inventory),bytes=sum(r['bytes'] for r in inventory),tools=sum(r['format']=='.py' for r in inventory),tactics=len(tactics),uniqueBehaviorPatterns=len(patterns),rules=len(rules),strategies=len(strategy_checks),emptyStrategies=sum(s['empty'] for s in strategy_checks),graphs=len(graphs),types=len(classrows),symbolCategories=dict(collections.Counter(c['category'] for c in classrows)),constants=len(defaults),parseErrors=anomalies,semanticReview='Tracked separately. Full structural scans are not full semantic comprehension.')
write('summary.json',summary);print(json.dumps(summary,ensure_ascii=False))
