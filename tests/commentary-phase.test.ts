import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import templates from '../src/data/commentary.json';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderChineseCommentary} from '../src/domain/commentaryBeats';
import {validateNarration} from '../src/domain/narrative';
import {realQuoteCatalog,quoteCandidates} from '../src/domain/realQuotes';
import type {RoundEvent} from '../src/domain/types';

function fixture(){const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);return {s,r:resolveRound(s)};}
function rule(id:string,name:string,status:string,at=5):RoundEvent{return {id,at,kind:'tactic',team:0,causes:[],detail:{rule:name,status,reason:'引擎内部状态说明'}};}
it('84条阶段表达单独标注原创，旧360条文本与来源保留，不混入真实语录库',()=>{
 const phase=templates.filter(row=>row.sourceFile==='commentary-lines-phase.jsonl');expect(phase).toHaveLength(84);
 expect(new Set(phase.map(row=>row.family)).size).toBe(14);
 for(const row of phase){expect(row.verifiedSpokenQuote).toBe(false);expect(row.provenance).toBe('assistant-authored-original-template');expect(realQuoteCatalog.has(row.id)).toBe(false);expect(row.text.match(/\{[^{}]+\}/g)?.every(token=>['{P}','{TEAM}','{ZONE}'].includes(token))).not.toBe(false);}
 for(const file of ['commentary-lines-v1.jsonl','commentary-lines-expanded.jsonl'])for(const line of readFileSync(`data/source/${file}`,'utf8').trim().split('\n')){const raw=JSON.parse(line),compiled=templates.find(row=>row.id===raw.id)!;expect(compiled.text).toBe(raw.text);expect(compiled.provenance).toBe('user-supplied-original-template');}
});
it('等烟与烟线恢复是两个已发生状态，不能被同一类别的去重吞掉',()=>{
 const {s,r}=fixture(),waiting=rule('wait','smoke','waiting',3),completed=rule('go','smoke','completed',10);
 for(const event of [waiting,completed]){event.actor=r.initial[0].id;event.zone=r.map+'-2';}
 r.events=[waiting,completed,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const beats=deriveCommentaryBeats(r,s).filter(b=>b.category.startsWith('phase-'));
 const lines=renderChineseCommentary(beats,r,s);expect(lines).toHaveLength(2);
 expect(lines.map(line=>line.at)).toEqual([3,10]);expect(lines.every(line=>line.templateId?.startsWith('PH-'))).toBe(true);
 expect(lines.every(line=>line.stage==='道具配合')).toBe(true);expect(lines.every(line=>!line.text.includes('引擎内部状态说明'))).toBe(true);
 expect(lines.every(line=>line.briefText===''||!line.briefText!.includes('引擎内部状态说明'))).toBe(true);
});
it('同秒集结结束和进攻启动只说一次启动，仍锚定到真实的启动事件',()=>{
 const {s,r}=fixture(),regroup=rule('regroup','regroup','executing'),execution=rule('execute','execution','executing');execution.zone=r.map+'-2';
 r.events=[regroup,execution,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const beats=deriveCommentaryBeats(r,s).filter(b=>b.category.startsWith('phase-')),lines=renderChineseCommentary(beats,r,s);
 expect(lines).toHaveLength(1);expect(lines[0].eventIds).toContain('execute');expect(lines[0].sourceBeatIds).toContain(beats.find(b=>b.category==='phase-execution')!.id);
 expect(lines[0].stage).toBe('局势变化');
});
it('真实语录后的原创事实衔接单独留源，精简模式也不念内部日志',()=>{
 const {s,r}=fixture(),execution=rule('execute','execution','executing');execution.team=r.sides[0]==='T'?0:1;execution.zone=r.map+'-3';
 r.events=[execution,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const phase=deriveCommentaryBeats(r,s).filter(b=>b.category==='phase-execution'),lines=renderChineseCommentary(phase,r,s);r.commentary=lines;
 expect(realQuoteCatalog.has(lines[0].templateId!)).toBe(true);
 if(lines[0].templateId==='RB-9-24'){expect(lines[0].supportTemplateId).toBeUndefined();expect(lines[0].text).toContain('目标是');expect(lines[0].text).toContain('还有5人');}
 else expect(lines[0].supportTemplateId).toMatch(/^PH-/);
 expect(lines[0].quoteSource).toBe(realQuoteCatalog.get(lines[0].templateId!)!.source);
 expect(lines[0].text).not.toContain('引擎内部状态说明');expect(lines[0].briefText).not.toContain('引擎内部状态说明');expect(validateNarration(r)).toEqual([]);
 lines[0].supportTemplateId='RQ-1-8';expect(validateNarration(r)).toContain('辅助事实句来源不是合法原创模板');
});
it('原创建议衔接也遵守五回合冷却，不靠藏在真实语录后绕开',()=>{
 const {s,r}=fixture();r.number=6;const event=rule('smoke','smoke','waiting');event.actor=r.initial[0].id;event.zone=r.map+'-2';
 r.events=[event,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 s.mapStates[0].rounds=Array.from({length:5},(_,index)=>{const old=structuredClone(r);old.number=index+1;old.commentary=[{text:'已播出',eventIds:['smoke'],emphasis:'neutral',templateId:'RQ-1-8',supportTemplateId:`PH-${String(index+1).padStart(3,'0')}`}];return old;});
 const lines=renderChineseCommentary(deriveCommentaryBeats(r,s).filter(b=>b.category==='phase-smoke'),r,s);
 expect(lines[0].templateId).toBe('PH-006');expect(lines[0].text).not.toContain('引擎内部状态说明');
});
it('回合结束的指令清理不当成一次新动作，真正等不起烟的状态仍可叙述',()=>{
 const {s,r}=fixture(),cleanup=rule('cleanup','utility','interrupted'),smoke:RoundEvent={id:'cloud',at:1,kind:'smoke',zone:r.map+'-2',causes:[],detail:{}},urgent=rule('urgent','smoke','interrupted',8);urgent.actor=r.initial[0].id;urgent.zone=r.map+'-2';urgent.causes=['cloud'];
 r.events=[smoke,urgent,cleanup,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const phase=deriveCommentaryBeats(r,s).filter(b=>b.category.startsWith('phase-'));expect(phase).toHaveLength(1);expect(phase[0].eventIds).toContain('urgent');
 expect(renderChineseCommentary(phase,r,s)[0].templateId).toMatch(/^PH-/);
});
it('自然模拟中的主素材与辅助素材均无同回合重复或五回合重用，旧回放保持确定',()=>{
 let supports=0;
 for(let seed=1;seed<=12;seed++){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
  for(const r of s.mapStates[0].rounds){const used=new Set<string>(),recent=new Set(s.mapStates[0].rounds.filter(old=>old.number<r.number&&old.number>=r.number-5).flatMap(old=>old.commentary.flatMap(line=>[line.templateId,line.supportTemplateId])));for(const line of r.commentary)for(const id of [line.templateId,line.supportTemplateId])if(id){expect(used.has(id)).toBe(false);expect(recent.has(id)).toBe(false);used.add(id);}supports+=r.commentary.filter(line=>line.supportTemplateId).length;expect(renderChineseCommentary(deriveCommentaryBeats(r,s),r,s)).toEqual(r.commentary);}
 }
 expect(supports).toBeGreaterThan(0);
},20000);
it('14种阶段在所有素材冷却耗尽时仍用口语事实，不照念日志或借假模板来源',()=>{
 const families=[...new Set(templates.filter(row=>row.sourceFile==='commentary-lines-phase.jsonl').map(row=>row.family))];
 for(const family of families){
  const {s,r}=fixture();r.number=6;const parts=family.split('-'),name=parts[1]==='interrupted'?'utility':parts[1],status=parts[1]==='interrupted'?'interrupted':parts[2];
  const event=rule('phase',name,status,5);event.actor=r.initial[0].id;event.zone=r.map+'-2';
  const smoke:RoundEvent={id:'smoke',at:2,kind:'smoke',zone:event.zone,causes:[],detail:{}};
  const death:RoundEvent={id:'death',at:2,kind:'kill',actor:r.initial[5].id,target:event.actor,team:1,zone:event.zone,weapon:'USP-S',alive:[4,5],causes:[],detail:{}};
  if(family==='phase-smoke-interrupted')event.causes=['smoke'];if(family==='phase-interrupted-death')event.causes=['death'];
  r.events=[...(family==='phase-smoke-interrupted'?[smoke]:family==='phase-interrupted-death'?[death]:[]),event,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
  const phase=deriveCommentaryBeats(r,s).filter(b=>b.category.startsWith('phase-'));
  const ids=[...templates.filter(row=>row.family===family).map(row=>row.id),...phase.flatMap(b=>quoteCandidates(b,r))];
  const old=structuredClone(r);old.number=5;old.commentary=ids.map(templateId=>({text:'先前已用',templateId,eventIds:[event.id],emphasis:'neutral'}));s.mapStates[0].rounds=[old];
  const [line]=renderChineseCommentary(phase,r,s);expect(line.text).not.toContain('引擎内部状态说明');expect(line.briefText).not.toContain('引擎内部状态说明');expect(line.templateId).toBeUndefined();expect(line.supportTemplateId).toBeUndefined();expect(line.sourceType).toBe('original');expect(line.eventIds).toContain(event.id);
 }
});
it('一个人的死亡同时中断两条规则时只补一段中断，不把同一次死亡说两遍',()=>{
 const {s,r}=fixture(),actor=r.initial[0],zone=r.map+'-2';
 const death:RoundEvent={id:'death',at:2,kind:'kill',actor:r.initial[5].id,target:actor.id,team:1,zone,weapon:'USP-S',alive:[4,5],causes:[],detail:{}};
 const smoke=rule('smoke-end','smoke','interrupted',2),utility=rule('utility-end','utility','interrupted',2);for(const event of [smoke,utility]){event.actor=actor.id;event.zone=zone;event.causes=['death'];}
 r.events=[death,smoke,utility,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const phase=deriveCommentaryBeats(r,s).filter(b=>b.category.startsWith('phase-'));expect(phase).toHaveLength(2);expect(renderChineseCommentary(phase,r,s)).toHaveLength(1);
});
it('当前引擎不把未知内部规则随机念出来，旧引擎的原始回放分支仍保持原文',()=>{
 const {s,r}=fixture();r.events=[rule('new','unknown-rule','waiting'),{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 expect(deriveCommentaryBeats(r,s).some(b=>b.category==='phase-unknown-rule')).toBe(false);
 delete r.plans;expect(deriveCommentaryBeats(r,s).find(b=>b.category==='phase-unknown-rule')!.fallback).toContain('引擎内部状态说明');
});
it('精简文本也不允许残留变量，避免有效详细文本掩盖坏的存档精简字段',()=>{
 const {r}=fixture();r.commentary[0].briefText='还在等{缺失变量}';expect(validateNarration(r)).toContain('解说仍有未填变量');
});
it('没钳没烟的残局语录不读取同秒后面才扔的烟，仍有第二颗烟时也不谎报耗尽',()=>{
 const {r}=fixture(),ct=r.sides[0]==='CT'?0:1,actor=r.initial.find(f=>f.team===ct)!;actor.equipment.kit=false;actor.equipment.utility=['smoke'];
 const start:RoundEvent={id:'clutch',at:10,kind:'kill',target:r.initial.find(f=>f.team===ct&&f.id!==actor.id)!.id,causes:[],detail:{}};
 const smoke:RoundEvent={id:'smoke',at:10,kind:'smoke',actor:actor.id,team:ct,causes:[],detail:{}};
 const beat={id:'clutch-start',category:'clutch-start',at:10,priority:76,eventIds:['clutch'],candidates:[],facts:{clutchId:actor.id,clutchSize:2},fallback:'事实',emphasis:'tense' as const};
 r.events=[start,smoke];expect(quoteCandidates(beat,r)).not.toContain('RQ-3-10');r.events=[smoke,start];expect(quoteCandidates(beat,r)).toContain('RQ-3-10');actor.equipment.utility=['smoke','smoke'];expect(quoteCandidates(beat,r)).not.toContain('RQ-3-10');
});
