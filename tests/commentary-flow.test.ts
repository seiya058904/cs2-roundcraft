import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderChineseCommentary} from '../src/domain/commentaryBeats';
import {validateNarration} from '../src/domain/narrative';
import type {RoundEvent} from '../src/domain/types';

const actions=new Set(['opening','awp-opening','headshot','flash-conversion','smoke-kill','rifle-v-awp','awp-duel','grenade','trade']);
function fixture(){const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);return {s,r:resolveRound(s)};}
it('首杀的混烟、闪光和打掉大狙事实合进一段，保留所有依据而不再播一次击杀',()=>{
 const {s,r}=fixture(),actor=r.initial[0],target=r.initial[5],thrower=r.initial[1],zone=r.map+'-2';
 r.economy.find(b=>b.playerId===target.id)!.loadout.weapon='AWP';target.equipment.weapon='AWP';
 const blind:RoundEvent={id:'blind',at:2,kind:'blind',actor:thrower.id,target:target.id,zone,causes:[],detail:{until:10}};
 const duel:RoundEvent={id:'duel',at:4,kind:'duel',actor:actor.id,target:target.id,zone,weapon:'AK-47',causes:[],detail:{headshot:true,smoke:.5}};
 const damage:RoundEvent={id:'damage',at:4,kind:'damage',actor:actor.id,target:target.id,causes:['duel'],detail:{}};
 const kill:RoundEvent={id:'kill',at:4,kind:'kill',actor:actor.id,target:target.id,team:0,weapon:'AK-47',zone,alive:[5,4],causes:['damage'],detail:{}};
 r.events=[...r.events.filter(e=>e.kind==='tactic'&&e.at===0),blind,duel,damage,kill,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const beats=deriveCommentaryBeats(r,s),lines=renderChineseCommentary(beats,r,s);r.commentary=lines;
 const descriptions=lines.filter(line=>line.sourceBeatIds?.some(id=>{const b=beats.find(b=>b.id===id)!;return actions.has(b.category)&&b.eventIds.includes(kill.id);}));
 expect(descriptions).toHaveLength(1);const line=descriptions[0];
 expect(line.text).toMatch(/爆头|头皮被秒/);expect(line.briefText).toContain('爆头');expect(line.text).toContain('隔着烟');expect(line.text).toContain('这颗闪');expect(line.text).toContain('大狙');
 expect(line.eventIds).toEqual(expect.arrayContaining(['blind','duel','damage','kill']));expect(line.eventIds).not.toContain('end');expect(validateNarration(r)).toEqual([]);
});
it('同一次补枪合并闪光、爆头与混烟，但不吞掉先前那一次首杀',()=>{
 const {s,r}=fixture(),zone=r.map+'-2',actor=r.initial[0],victim=r.initial[5],thrower=r.initial[1];
 const first:RoundEvent={id:'first',at:3,kind:'kill',actor:victim.id,target:r.initial[2].id,team:1,weapon:'USP-S',zone,alive:[4,5],causes:[],detail:{}};
 const blind:RoundEvent={id:'blind',at:4,kind:'blind',actor:thrower.id,target:victim.id,zone,causes:[],detail:{until:10}};
 const duel:RoundEvent={id:'duel',at:5,kind:'duel',actor:actor.id,target:victim.id,zone,weapon:'AK-47',causes:[],detail:{headshot:true,smoke:.5}};
 const damage:RoundEvent={id:'damage',at:5,kind:'damage',actor:actor.id,target:victim.id,causes:['duel'],detail:{}};
 const kill:RoundEvent={id:'kill',at:5,kind:'kill',actor:actor.id,target:victim.id,team:0,weapon:'AK-47',zone,alive:[4,4],causes:['damage'],detail:{}};
 const trade:RoundEvent={id:'trade',at:5,kind:'trade',actor:actor.id,team:0,causes:['first','kill'],detail:{}};
 r.events=[first,blind,duel,damage,kill,trade,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const beats=deriveCommentaryBeats(r,s),lines=renderChineseCommentary(beats,r,s),byId=new Map(beats.map(b=>[b.id,b]));
 const tradeLine=lines.find(line=>line.sourceBeatIds?.some(id=>byId.get(id)!.category==='trade'))!;
 expect(tradeLine.text).toContain('这颗闪');expect(tradeLine.text).toContain('爆头');expect(tradeLine.text).toContain('隔着烟');
 expect(tradeLine.sourceBeatIds?.map(id=>byId.get(id)!.category)).toEqual(expect.arrayContaining(['trade','flash-conversion','headshot','smoke-kill']));
 expect(lines.some(line=>line!==tradeLine&&line.sourceBeatIds?.some(id=>byId.get(id)!.category==='opening'))).toBe(true);
 expect(tradeLine.eventIds).toContain('trade');
});
it('同秒不同目标的两次击杀仍是两个动作，不能按时间戳一并吞掉',()=>{
 const {s,r}=fixture(),zone=r.map+'-2',actor=r.initial[0];
 const first:RoundEvent={id:'first',at:5,kind:'kill',actor:actor.id,target:r.initial[5].id,team:0,weapon:'AK-47',zone,alive:[5,4],causes:[],detail:{}};
 const duel:RoundEvent={id:'duel',at:5,kind:'duel',actor:actor.id,target:r.initial[6].id,zone,weapon:'AK-47',causes:[],detail:{headshot:true}};
 const damage:RoundEvent={id:'damage',at:5,kind:'damage',causes:['duel'],detail:{}};
 const second:RoundEvent={...first,id:'second',target:r.initial[6].id,alive:[5,3],causes:['damage']};
 r.events=[first,duel,damage,second,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const beats=deriveCommentaryBeats(r,s),lines=renderChineseCommentary(beats,r,s),byId=new Map(beats.map(b=>[b.id,b]));
 expect(lines.filter(line=>line.sourceBeatIds?.some(id=>actions.has(byId.get(id)!.category)))).toHaveLength(2);
});
it('灭队结算只在最后击杀未被讲到时补上具名依据',()=>{
 const {s,r}=fixture(),actor=r.initial[0],target=r.initial[5],zone=r.map+'-2';r.reason='elimination';r.number=6;
 const kill:RoundEvent={id:'last-kill',at:20,kind:'kill',actor:actor.id,target:target.id,team:actor.team,weapon:'AK-47',zone,alive:[5,0],causes:[],detail:{}},end:RoundEvent={id:'end',at:20,kind:'roundEnd',causes:[],detail:{}};r.events=[kill,end];
 const beats=deriveCommentaryBeats(r,s),close=beats.find(b=>b.category==='close')!,opening=beats.find(b=>b.category==='opening')!;
 let lines=renderChineseCommentary([close],r,s);expect(lines[0].text).toContain('最后倒下的是');expect(lines[0].eventIds).toContain('last-kill');expect(lines[0].briefText).toContain('最后倒下的是');
 lines=renderChineseCommentary([opening,close],r,s);expect(lines.find(l=>l.sourceBeatIds?.includes(close.id))!.text).not.toContain('最后倒下的是');
});
it('比分叙事只用这一分前后的已结算比分',()=>{
 const {s,r}=fixture(),end:RoundEvent={id:'end',at:90,kind:'roundEnd',causes:[],detail:{}};r.events=[end];r.winner=0;
 const close=()=>deriveCommentaryBeats(r,s).find(b=>b.category==='close')!;
 r.score=[4,4];expect(close().fallback).toContain('双方比分扳平');
 r.score=[5,4];expect(close().fallback).toContain('打破平局');
 r.score=[4,5];expect(close().fallback).toContain('追到只剩一分');
 r.score=[1,0];expect(close().fallback).not.toContain('打破平局');
 r.score=[4,8];expect(close().fallback).not.toMatch(/扳平|打破平局|只剩一分/);
});
it('主句落到原创模板时也保留合并的附加事实，不给原创模板套真人出处',()=>{
 const {s,r}=fixture(),zone=r.map+'-2',actor=r.initial[0],target=r.initial[5];r.map='inferno';
 r.economy.find(b=>b.playerId===target.id)!.loadout.weapon='AWP';
 const duel:RoundEvent={id:'duel',at:5,kind:'duel',actor:actor.id,target:target.id,zone,weapon:'AK-47',causes:[],detail:{smoke:.5}};
 const damage:RoundEvent={id:'damage',at:5,kind:'damage',causes:['duel'],detail:{}};
 const kill:RoundEvent={id:'kill',at:5,kind:'kill',actor:actor.id,target:target.id,team:0,weapon:'AK-47',zone,alive:[5,4],causes:['damage'],detail:{}};
 r.events=[duel,damage,kill,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const beats=deriveCommentaryBeats(r,s).filter(b=>['smoke-kill','rifle-v-awp'].includes(b.category)),lines=renderChineseCommentary(beats,r,s);
 expect(lines).toHaveLength(1);expect(lines[0].templateId).toBe('WJ-116');expect(lines[0].text).toContain('大狙也掉了');expect(lines[0].text).toContain(s.players.find(p=>p.id===target.id)!.nickname);expect(lines[0].text).toContain('AK-47');expect(lines[0].quoteSource).toBeUndefined();expect(lines[0].sourceType).toBe('template');expect(lines[0].sourceBeatIds).toHaveLength(2);
});
it('步枪打掉狙击手的原创模板保留目标与具体枪型',()=>{
 const {s,r}=fixture(),a=r.initial[0],v=r.initial[5],zone=r.map+'-2';v.equipment.weapon='AWP';r.economy.find(e=>e.playerId===v.id)!.loadout.weapon='AWP';
 const k:RoundEvent={id:'k',at:10,kind:'kill',actor:a.id,target:v.id,team:a.team,weapon:'AK-47',zone,alive:[5,4],causes:[],detail:{}};r.events=[k,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const b=deriveCommentaryBeats(r,s).find(b=>b.category==='rifle-v-awp')!,line=renderChineseCommentary([b],r,s)[0];expect(line.templateId).toBe('C122');expect(line.text).toContain(s.players.find(p=>p.id===v.id)!.nickname);expect(line.text).toContain('AK-47');expect(line.quoteSource).toBeUndefined();
});
it('赛点、换边、加时在详细与精简都接在比分结果后，仍保留五段精简上限',()=>{
 const seen=new Set<string>(),transitions=new Set(['match-point','overtime-threat','half-time','overtime']);
 for(let seed=1;seed<=40;seed++){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
  for(const r of s.mapStates[0].rounds){
   const beats=deriveCommentaryBeats(r,s),category=(id:string)=>beats.find(b=>b.id===id)!.category;
   const close=r.commentary.findIndex(line=>line.sourceBeatIds?.some(id=>category(id)==='close'));
   for(const b of beats.filter(b=>transitions.has(b.category))){const index=r.commentary.findIndex(line=>line.sourceBeatIds?.includes(b.id));expect(index).toBeGreaterThan(close);expect(r.commentary[index].briefText).toBeTruthy();seen.add(b.category);}
   expect(r.commentary.filter(line=>line.briefText).length).toBeLessThanOrEqual(5);
  }
 }
 expect([...seen].sort()).toEqual([...transitions].sort());
},15000);
it('拆包完成后还可以称赞残局，但详细与精简不再复述一次拆包完成',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,11);autoVeto(s);simulateSeries(s);
 const r=s.mapStates[0].rounds.find(r=>r.number===13)!,beats=deriveCommentaryBeats(r,s);
 const defuse=r.commentary.find(line=>line.sourceBeatIds?.some(id=>beats.find(b=>b.id===id)!.category==='defuse-timing'));
 const clutch=r.commentary.find(line=>line.sourceBeatIds?.some(id=>beats.find(b=>b.id===id)!.category==='clutch-win'));
 expect(defuse).toBeDefined();expect(clutch).toBeDefined();expect(clutch!.text).toContain('一打2');expect(clutch!.text).not.toContain('最后完成拆包');expect(clutch!.briefText).not.toContain('最后完成拆包');
});
