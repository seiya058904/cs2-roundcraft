import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseQuotes,duplicateQuote} from '../scripts/import-quotes.mts';
import manifest from '../data/normalized/quotes-manifest.json';
import {realQuoteCatalog,quoteCandidates} from '../src/domain/realQuotes';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderChineseCommentary,type CommentaryBeat} from '../src/domain/commentaryBeats';
import type {RoundEvent} from '../src/domain/types';

function fixture(){const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);return {s,r:resolveRound(s)};}
function beat(category:string,refs:RoundEvent[],facts:CommentaryBeat['facts']={}):CommentaryBeat{return {id:`test-${category}`,at:refs.at(-1)?.at??0,category,priority:90,eventIds:refs.map(e=>e.id),candidates:[],facts,fallback:'事实',emphasis:'neutral'};}
it('三份精选包逐条保留原文、出处、标签，跨五批无新增重复且排除编号不重排',()=>{
 const prior=[...realQuoteCatalog.values()].filter(q=>/^(RQ|RB)-/.test(q.id));
 for(const batch of manifest.batches.slice(2)){
  const raw=parseQuotes(readFileSync(`data/source/${batch.sourceFile}`,'utf8'),batch.sourceFile,batch.prefix);
  const imported=[...realQuoteCatalog.values()].filter(q=>q.id.startsWith(batch.prefix+'-'));
  const tags=JSON.parse(readFileSync(`data/source/${batch.sourceFile.replace('.md','_beats.json')}`,'utf8')) as {section:number;index:number;beat:string}[];
  expect(raw.length).toBe(batch.expected);expect(imported.length+manifest.exclusions.filter(row=>row.id.startsWith(batch.prefix+'-')).length).toBe(raw.length);
  for(const row of imported){const original=raw.find(q=>q.id===row.id)!;expect(row.text).toBe(original.text);expect(row.source).toBe(original.source);expect(row.provenance).toBe('user-supplied-transcript-quote');expect('beat' in row&&row.beat).toBe(tags.find(tag=>tag.section===row.section&&tag.index===row.index)!.beat);expect(prior.some(q=>duplicateQuote(q.text,row.text))).toBe(false);prior.push(row);}
 }
 expect(realQuoteCatalog.has('RD-7-3')).toBe(false);expect(realQuoteCatalog.has('RD-7-4')).toBe(true);
});
it('自动购买形成的真实 ECO 能使用无甲语录，购买标签不能覆盖实际全起装备',()=>{
 const {r}=fixture(),weak=0;r.number=3;r.decisions[weak].buy='auto';r.plans![weak].economy='eco';
 for(const f of r.initial.filter(f=>f.team===weak)){f.equipment.armor=0;f.equipment.utility=[];f.equipment.weapon=f.side==='T'?'Glock':'USP-S';}
 expect(quoteCandidates(beat('economy',[],{weakTeam:weak}),r)).toContain('RB-5-24');
 r.decisions[weak].buy='eco';r.plans![weak].economy='full';
 for(const f of r.initial.filter(f=>f.team===weak)){f.equipment.weapon=f.side==='T'?'AK-47':'M4A1-S';f.equipment.armor=100;}
 expect(quoteCandidates(beat('economy',[],{weakTeam:weak}),r)).not.toContain('RB-5-24');
});
it('无朝向证据不能说正面，头部击杀必须有实际爆头记录',()=>{
 const {r}=fixture(),actor=r.initial[0],target=r.initial[5];target.equipment.weapon='AWP';
 const duel:RoundEvent={id:'duel',at:5,kind:'duel',actor:actor.id,target:target.id,weapon:'AK-47',causes:[],detail:{headshot:true}};
 const damage:RoundEvent={id:'damage',at:5,kind:'damage',actor:actor.id,target:target.id,causes:['duel'],detail:{}};
 const kill:RoundEvent={id:'kill',at:5,kind:'kill',actor:actor.id,target:target.id,weapon:'AK-47',zone:r.map+'-2',causes:['damage'],detail:{}};r.events=[duel,damage,kill];
 expect(quoteCandidates(beat('rifle-v-awp',[kill],{actorName:'ropz'}),r)).not.toContain('RD-12-10');
 expect(quoteCandidates(beat('rifle-v-awp',[kill],{actorName:'apEX'}),r)).not.toContain('RD-12-10');
 expect(quoteCandidates(beat('rifle-v-awp',[kill]),r)).toContain('RB-12-42');
 duel.detail.headshot=false;expect(quoteCandidates(beat('rifle-v-awp',[kill]),r)).not.toContain('RB-12-42');
 target.equipment.weapon='USP-S';expect(quoteCandidates(beat('rifle-v-awp',[kill],{actorName:'apEX'}),r)).not.toContain('RD-12-10');
});
it('三打三的中路失控语录要求真实中路击杀与防守方离开，不泛投给均势',()=>{
 const {r}=fixture(),t=r.sides[0]==='T'?0:1,ct=1-t;
 const ts=r.initial.filter(f=>f.team===t),cts=r.initial.filter(f=>f.team===ct),mid=r.map+'-6';
 const deaths:RoundEvent[]=[...ts.slice(3),...cts.slice(4)].map((f,i)=>({id:`old${i}`,at:i,kind:'kill',target:f.id,causes:[],detail:{}}));
 const kill:RoundEvent={id:'midkill',at:20,kind:'kill',team:t,actor:ts[0].id,target:cts[3].id,zone:mid,alive:[3,3],causes:[],detail:{}};
 ts[0].zone=mid;for(const f of cts)f.zone=r.map+'-2';cts[3].zone=mid;r.events=[...deaths,kill];
 expect(quoteCandidates(beat('even',[kill]),r)).toContain('RD-2-17');
 cts[0].zone=mid;expect(quoteCandidates(beat('even',[kill]),r)).not.toContain('RD-2-17');
});
it('回防缺烟只查看已经使用的道具，同秒尚未扔出的烟仍然在手',()=>{
 const {r}=fixture(),ct=r.sides[0]==='CT'?0:1,defenders=r.initial.filter(f=>f.team===ct);
 for(const f of defenders)f.equipment.utility=[];defenders[0].equipment.utility=['smoke'];
 const rule:RoundEvent={id:'retake',at:20,kind:'tactic',team:ct,causes:[],detail:{rule:'retake',status:'executing'}};
 const plant:RoundEvent={id:'plant',at:10,kind:'plant',zone:r.map+'-2',causes:[],detail:{}};
 const smoke:RoundEvent={id:'smoke',at:20,kind:'smoke',team:ct,actor:defenders[0].id,zone:r.map+'-3',causes:[],detail:{}};
 r.events=[plant,rule,smoke];expect(quoteCandidates(beat('phase-retake',[rule]),r)).not.toContain('RF-8-4');
 r.events=[plant,smoke,rule];expect(quoteCandidates(beat('phase-retake',[rule]),r)).toContain('RF-8-4');
});
it('新的高光候选分支不允许单杀或未结束的残局使用强烈呐喊',()=>{
 const {r}=fixture(),actor=r.initial[0];
 const kills:RoundEvent[]=r.initial.slice(5,8).map((f,i)=>({id:`k${i}`,at:10+i,kind:'kill',actor:actor.id,target:f.id,weapon:'AK-47',zone:f.zone,causes:[],detail:{}}));
 r.events=kills;expect(quoteCandidates(beat('highlight-shout',kills,{highlightKind:'multikill'}),r)).toContain('RD-10-1');
 expect(quoteCandidates(beat('highlight-shout',kills.slice(0,1),{highlightKind:'multikill'}),r)).toEqual([]);
 expect(quoteCandidates(beat('highlight-shout',kills,{highlightKind:'clutch-win',clutchSize:3,clutchId:actor.id}),r)).toEqual([]);
});
it('外场 AK 混烟语录要求 Nuke 外场、AK 击杀与真实烟雾压制同时成立',()=>{
 const {r}=fixture(),actor=r.initial[0],target=r.initial[5];r.map='nuke';
 const duel:RoundEvent={id:'duel',at:10,kind:'duel',actor:actor.id,target:target.id,weapon:'AK-47',zone:'nuke-6',causes:[],detail:{smoke:.48}};
 const damage:RoundEvent={id:'damage',at:10,kind:'damage',actor:actor.id,target:target.id,causes:['duel'],detail:{}};
 const kill:RoundEvent={id:'kill',at:10,kind:'kill',actor:actor.id,target:target.id,weapon:'AK-47',zone:'nuke-6',causes:['damage'],detail:{}};r.events=[duel,damage,kill];
 expect(quoteCandidates(beat('smoke-kill',r.events),r)).toContain('RF-6-7');
 duel.detail.smoke=1;expect(quoteCandidates(beat('smoke-kill',r.events),r)).not.toContain('RF-6-7');
 duel.detail.smoke=.48;kill.weapon='AWP';expect(quoteCandidates(beat('smoke-kill',r.events),r)).not.toContain('RF-6-7');
 kill.weapon='AK-47';r.map='mirage';expect(quoteCandidates(beat('smoke-kill',r.events),r)).not.toContain('RF-6-7');
});
it('近五回合的原创解释不反复填充，事实句和语录出处仍保留',()=>{
 const {s,r}=fixture();const events=r.events.filter(e=>e.kind==='tactic'&&e.at===0);
 const plant=beat('plant',events);plant.fallback='包已下。';
 const explanation='包一落地，比赛的任务就变了：进攻方可以围绕时间组织，防守方必须在计时结束前完成拆除。';
 const old=structuredClone(r);old.number=1;old.commentary=[{text:explanation,eventIds:events.map(e=>e.id),emphasis:'neutral'}];r.number=2;s.mapStates[0].rounds=[old];
 // Cool all original quotation candidates to exercise the factual layer.
 old.commentary.push(...quoteCandidates(plant,r).map(templateId=>({text:'旧语录',eventIds:events.map(e=>e.id),templateId,emphasis:'neutral' as const})));
 const lines=renderChineseCommentary([plant],r,s);expect(lines[0].text).toBe('包已下。');
});
it('三份新包可在实际模拟中播出，语录带出处且原来固定样本的拆包三次复述不回归',()=>{
 const used=new Set<string>();
 for(const seed of [1,5,11,76]){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
  for(const r of s.mapStates[0].rounds){
   for(const line of r.commentary)if(line.templateId&&/^(RD|RF|RW)-/.test(line.templateId)){used.add(line.templateId.split('-')[0]);expect(line.quoteSource).toBe(realQuoteCatalog.get(line.templateId)!.source);}
   const emitted=new Set(r.commentary.flatMap(line=>line.sourceBeatIds??[])),beats=deriveCommentaryBeats(r,s);
   if(beats.some(b=>b.category==='defuse-timing'&&emitted.has(b.id))&&beats.some(b=>b.category==='clutch-win'&&emitted.has(b.id))){const close=r.commentary.find(line=>line.sourceBeatIds?.some(id=>beats.some(b=>b.id===id&&b.category==='close')))!;expect(close.text).not.toMatch(/拆掉了，回防成功/);expect(close.briefText).not.toMatch(/拆掉了，回防成功/);}
  }
 }
 expect([...used].sort()).toEqual(['RD','RF','RW']);
},20000);
