import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderChineseCommentary,commentaryCatalog} from '../src/domain/commentaryBeats';
import {quoteCandidates} from '../src/domain/realQuotes';
import {validateRound} from '../src/domain/invariants';
import {commentarySnapshot} from '../src/domain/replay';
import type {RoundEvent} from '../src/domain/types';

it('拆包开始只读当时事件：不预报完成，中断和后来换人须等待后续事件',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);const r=resolveRound(s),ct=r.initial.find(f=>f.side==='CT')!,t=r.initial.find(f=>f.side==='T')!,zone=r.map+'-2';
 const plant:RoundEvent={id:'plant',kind:'plant',at:20,actor:t.id,team:t.team,zone,causes:[],detail:{explodeAt:60}},start:RoundEvent={id:'start',kind:'defuseStart',at:30,actor:ct.id,team:ct.team,zone,causes:['plant'],detail:{kit:false,duration:10}},stop:RoundEvent={id:'stop',kind:'defuseStop',at:33,actor:ct.id,team:ct.team,zone,causes:['start'],detail:{}},end:RoundEvent={id:'end',kind:'roundEnd',at:60,causes:[],detail:{}};
 r.events=[plant,start,stop,end];r.number=6;const old=structuredClone(r);old.number=5;old.commentary=[...commentaryCatalog.keys()].filter(id=>id!=='RF-8-5').map(templateId=>({templateId,text:'已用',eventIds:[],emphasis:'neutral'}));s.mapStates[0].rounds=[old];
 const beats=deriveCommentaryBeats(r,s),b=beats.find(b=>b.category==='defuse-start')!;
 expect(b.eventIds).toEqual(['plant','start']);expect(quoteCandidates(b,r)).toContain('RF-8-5');
 const line=renderChineseCommentary([b],r,s)[0];expect(line.templateId).toBe('RF-8-5');expect(line.text).toContain('还剩30秒');expect(line.text).toContain('需要10秒');expect(line.text).not.toMatch(/拆掉|成功|中断/);
 r.commentary=[line];const snapshot=commentarySnapshot(r,1);expect(snapshot.events.map(e=>e.id)).toEqual(['plant','start']);expect(snapshot.complete).toBe(false);
 expect(beats.find(b=>b.category==='defuse-stop')?.eventIds).toEqual(['plant','start','stop']);
 start.at=50;stop.at=51;expect(deriveCommentaryBeats(r,s).find(b=>b.category==='defuse-start')!.fallback).toContain('已经不够读满');
 start.at=49;expect(deriveCommentaryBeats(r,s).find(b=>b.category==='defuse-start')!.fallback).toContain('只剩1秒余量');
 r.events=[plant,end];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='defuse-start')).toBe(false);
});
it('真实比赛中开始与中断或完成关联同一拆包者，并可通过账本校验',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,1);autoVeto(s);simulateSeries(s);
 const rounds=s.mapStates[0].rounds;let starts=0,stops=0;
 for(const r of rounds){expect(validateRound(r)).toEqual([]);for(const e of r.events){
  if(e.kind==='defuseStart'){starts++;expect(r.events.some(p=>p.kind==='plant'&&e.causes.includes(p.id))).toBe(true);}
  if(e.kind==='defuseStop'){stops++;expect(r.events.some(p=>p.kind==='defuseStart'&&p.id===e.causes[0]&&p.actor===e.actor)).toBe(true);}
  if(e.kind==='defuse'&&e.causes.length)expect(r.events.some(p=>p.kind==='defuseStart'&&p.id===e.causes[0]&&p.actor===e.actor)).toBe(true);
 }}
 expect(starts).toBeGreaterThan(0);expect(stops).toBeGreaterThan(0);
 const r=structuredClone(rounds.find(r=>r.events.some(e=>e.kind==='defuseStart'))!),index=r.events.findIndex(e=>e.kind==='defuseStart'),start=r.events[index];
 r.events.splice(index+1,0,{...structuredClone(start),id:'duplicate-start'});expect(validateRound(r)).toContain('已有拆包未中断或完成');
});
it('击杀拆包者与误杀其他CT按事件顺序区分，极限语录只在最后一秒',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);const r=resolveRound(s),ct=r.initial.filter(f=>f.side==='CT'),t=r.initial.find(f=>f.side==='T')!,zone=r.map+'-2';
 const plant:RoundEvent={id:'p',kind:'plant',at:20,actor:t.id,team:t.team,zone,causes:[],detail:{explodeAt:60}},start:RoundEvent={id:'s',kind:'defuseStart',at:50,actor:ct[0].id,team:ct[0].team,zone,causes:['p'],detail:{kit:false,duration:10}},kill:RoundEvent={id:'k',kind:'kill',at:59,actor:t.id,target:ct[0].id,team:t.team,zone,weapon:'AK-47',alive:[4,3],causes:[],detail:{}},end:RoundEvent={id:'end',kind:'roundEnd',at:60,causes:[],detail:{}};
 r.events=[plant,start,kill,end];let b=deriveCommentaryBeats(r,s).find(b=>b.category==='defuse-killed')!;expect(quoteCandidates(b,r)).toContain('RD-8-4');
 const stopAfter:RoundEvent={id:'stop-after',kind:'defuseStop',at:59,actor:ct[0].id,team:ct[0].team,zone,causes:['s','k'],detail:{}};
 r.events=[plant,start,kill,stopAfter,end];r.number=6;const old=structuredClone(r);old.number=5;old.commentary=[...commentaryCatalog.keys()].filter(id=>id!=='RD-8-4').map(templateId=>({templateId,text:'已用',eventIds:[],emphasis:'neutral'}));s.mapStates[0].rounds=[old];
 const beats=deriveCommentaryBeats(r,s).filter(b=>['opening','defuse-killed','defuse-stop'].includes(b.category));const lines=renderChineseCommentary(beats,r,s),spoken=lines.find(l=>l.templateId==='RD-8-4')!;
 expect(spoken.sourceBeatIds).toHaveLength(2);expect(spoken.eventIds).toEqual(expect.arrayContaining(['p','s','k']));expect(spoken.text.match(/拆包/g)).toHaveLength(1);expect(lines.some(l=>l.sourceBeatIds?.some(id=>beats.find(b=>b.id===id)?.category==='defuse-stop'))).toBe(false);
 r.events=[plant,start,kill,end];
 kill.at=58;b=deriveCommentaryBeats(r,s).find(b=>b.category==='defuse-killed')!;expect(quoteCandidates(b,r)).not.toContain('RD-8-4');
 kill.target=ct[1].id;r.events=[plant,start,kill,end];b=deriveCommentaryBeats(r,s).find(b=>b.category==='defuse-cover-kill')!;expect(quoteCandidates(b,r)).toContain('RD-8-9');
 const stop:RoundEvent={id:'stop',kind:'defuseStop',at:57,actor:ct[0].id,team:ct[0].team,zone,causes:['s'],detail:{}};r.events=[plant,start,stop,kill,end];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='defuse-cover-kill')).toBe(false);
});
