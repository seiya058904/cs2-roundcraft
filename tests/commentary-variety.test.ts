import {it,expect} from 'vitest';
import templates from '../src/data/commentary.json';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {deriveCommentaryBeats,renderChineseCommentary,type CommentaryBeat} from '../src/domain/commentaryBeats';
import {quoteCandidates,realQuoteCatalog} from '../src/domain/realQuotes';
import type {RoundEvent} from '../src/domain/types';

function fixture(){const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);return {s,r:resolveRound(s)};}
function beat(category:string,refs:RoundEvent[],facts:CommentaryBeat['facts']={}):CommentaryBeat{return {id:category,category,at:refs.at(-1)?.at??0,priority:90,eventIds:refs.map(e=>e.id),candidates:[],facts,fallback:'事实',emphasis:'neutral'};}
it('24条短开头保留原创来源，不冒充真实语录，各情境至少六个变体',()=>{
 const rows=templates.filter(row=>row.sourceFile==='commentary-lines-context.jsonl');expect(rows).toHaveLength(24);
 for(const family of ['context-round','context-run','context-pressure','context-close'])expect(rows.filter(row=>row.family===family)).toHaveLength(6);
 for(const row of rows){expect(row.verifiedSpokenQuote).toBe(false);expect(row.provenance).toBe('assistant-authored-original-template');expect(realQuoteCatalog.has(row.id)).toBe(false);}
});
it('短开头只读已结束的本图连分，连丢分和接近比分分别取证，未来记录不改变当前开头',()=>{
 const {s,r}=fixture();r.number=4;r.score=[4,0];r.winner=0;
 s.mapStates[0].rounds=[1,2,3].map(number=>({...structuredClone(r),number,winner:0}));
 const setup=()=>deriveCommentaryBeats(r,s).find(b=>b.category==='setup')!;
 expect(setup().facts.STREAK).toBe(3);expect(setup().candidates).toHaveLength(12);expect(setup().candidates).toContain('CX-007');expect(setup().candidates).toContain('CX-013');
 const before=setup();s.mapStates[0].rounds.push({...structuredClone(r),number:10,winner:1});expect(setup()).toEqual(before);
 r.number=17;r.score=[9,8];s.mapStates[0].rounds=[];expect(setup().candidates).toEqual(['CX-019','CX-020','CX-021','CX-022','CX-023','CX-024']);
 r.score=[9,5];expect(setup().candidates).toContain('CX-001');delete r.plans;expect(setup().candidates).toEqual(['WJ-008','WJ-009']);
});
it('标准212与中路/分路计划只能由实际选择触发，普通开头不挤掉手枪局语录',()=>{
 const {r}=fixture(),t=r.sides[0]==='T'?0:1,ct=1-t;r.number=2;
 r.decisions[ct].tactic='standard';expect(quoteCandidates(beat('setup',[]),r)).toContain('RF-1-5');
 r.decisions[ct].positions={[r.initial.find(f=>f.team===ct)!.id]:'custom'};expect(quoteCandidates(beat('setup',[]),r)).not.toContain('RF-1-5');delete r.decisions[ct].positions;
 r.number=1;r.decisions[t].tactic='default';expect(quoteCandidates(beat('setup',[]),r)).not.toContain('RF-1-5');expect(quoteCandidates(beat('setup',[]),r)).not.toContain('RF-1-3');r.number=13;expect(quoteCandidates(beat('setup',[]),r)).not.toContain('RF-1-3');r.number=2;r.decisions[ct].tactic='stackA';expect(quoteCandidates(beat('setup',[]),r)).not.toContain('RF-1-5');
 r.map='mirage';r.decisions[t].tactic='midControl';expect(quoteCandidates(beat('plan',[]),r)).toContain('RD-9-6');
 r.map='nuke';for(const id of ['RD-9-6','RD-9-18','RB-10-16'])expect(quoteCandidates(beat('plan',[]),r)).not.toContain(id);
 r.decisions[t].tactic='slowA';expect(quoteCandidates(beat('plan',[]),r)).not.toContain('RD-9-8');r.decisions[t].tactic='default';expect(quoteCandidates(beat('plan',[]),r)).toContain('RD-9-8');
 r.decisions[t].tactic='fastA';expect(quoteCandidates(beat('plan',[]),r)).not.toContain('RD-9-6');
 r.decisions[t].tactic='splitB';r.plans![t].execution='regroup';expect(quoteCandidates(beat('plan',[]),r)).toContain('RF-9-2');r.plans![t].execution='direct';expect(quoteCandidates(beat('plan',[]),r)).not.toContain('RF-9-2');
});
it('钢枪与无道具语录看真实装备，不能只改一个购买标签就触发',()=>{
 const {r}=fixture(),t=r.sides[0]==='T'?0:1,gear=r.initial.filter(f=>f.team===t);r.number=3;r.plans![t].economy='force';
 for(const f of gear){f.equipment.weapon='Glock';f.equipment.utility=[];}gear[0].equipment.weapon='MAC-10';gear[1].equipment.weapon='MAC-10';
 const econ=beat('economy',[],{weakTeam:t});expect(quoteCandidates(econ,r)).toContain('RW-1-3');expect(quoteCandidates(econ,r)).toContain('RW-6-17');
 gear[1].equipment.weapon='Glock';expect(quoteCandidates(econ,r)).not.toContain('RW-1-3');gear[0].equipment.utility=['flash'];expect(quoteCandidates(econ,r)).not.toContain('RW-6-17');
});
it('两人一套道具和T道具优势要求对应阵营的实际数量，不能把CT的道具说成T',()=>{
 const {r}=fixture(),t=r.sides[0]==='T'?0:1,ct=1-t,ts=r.initial.filter(f=>f.team===t),cts=r.initial.filter(f=>f.team===ct);
 for(const f of r.initial)f.equipment.utility=[];for(const f of ts.slice(0,2))f.equipment.utility=['smoke','flash'];
 expect(quoteCandidates(beat('economy',[],{weakTeam:t}),r)).toContain('RB-6-44');ts[2].equipment.utility=['flash'];expect(quoteCandidates(beat('economy',[],{weakTeam:t}),r)).not.toContain('RB-6-44');
 for(const f of ts)f.equipment.utility=['smoke','flash'];expect(quoteCandidates(beat('economy',[],{weakTeam:ct}),r)).toContain('RF-6-8');
 for(const f of ts)f.equipment.utility=[];for(const f of cts)f.equipment.utility=['smoke','flash'];expect(quoteCandidates(beat('economy',[],{weakTeam:t}),r)).not.toContain('RF-6-8');
});
it('借用同次击杀的闪光语录保留独立事实门与出处，主句冷却不会遮掉合格的具体语录',()=>{
 const {s,r}=fixture(),actor=s.players.find(p=>p.nickname==='ropz')!,thrower=r.initial.find(f=>f.team===0&&f.id!==actor.id)!,target=r.initial.find(f=>f.team===1)!,zone=r.map+'-2';r.number=2;
 const victim=r.initial.find(f=>f.team===0&&f.id!==actor.id&&f.id!==thrower.id)!;
 const first:RoundEvent={id:'first',at:2,kind:'kill',actor:target.id,target:victim.id,team:1,weapon:'AK-47',zone,alive:[4,5],causes:[],detail:{}};
 const flash:RoundEvent={id:'blind',at:3,kind:'blind',actor:thrower.id,target:target.id,zone,causes:[],detail:{until:10}};
 const kill:RoundEvent={id:'kill',at:5,kind:'kill',actor:actor.id,target:target.id,team:0,weapon:'AK-47',zone,alive:[4,4],causes:[],detail:{}};
 const trade:RoundEvent={id:'trade',at:5,kind:'trade',actor:actor.id,team:0,causes:['first','kill'],detail:{}};
 r.events=[...r.events.filter(e=>e.kind==='tactic'&&e.at===0),first,flash,kill,trade,{id:'end',at:20,kind:'roundEnd',causes:[],detail:{}}];
 const beats=deriveCommentaryBeats(r,s),atomic=beats.filter(b=>['opening','trade','flash-conversion'].includes(b.category)),ids=new Set(atomic.flatMap(b=>quoteCandidates(b,r)));
 expect(ids).toContain('RF-2-14');
 const old=structuredClone(r);old.number=1;old.commentary=[...ids].filter(id=>id!=='RF-2-14').map(templateId=>({text:'已用',templateId,eventIds:['kill'],emphasis:'neutral'}));s.mapStates[0].rounds=[old];
 const line=renderChineseCommentary(beats,r,s).find(line=>line.templateId==='RF-2-14')!;
 expect(line).toBeDefined();expect(line.quoteSource).toBe(realQuoteCatalog.get('RF-2-14')!.source);expect(line.sourceBeatIds).toContain(beats.find(b=>b.category==='flash-conversion')!.id);expect(line.eventIds).toContain('blind');
 expect(quoteCandidates({...atomic.find(b=>b.category==='trade')!,facts:{actorName:'apEX'}},r)).not.toContain('RF-2-14');
});
it('补枪后捡枪只能在捡枪发生时说，同秒尚未发生的补枪不允许倒灌',()=>{
 const {r}=fixture(),actor=r.initial[0],zone=r.map+'-2';
 const first:RoundEvent={id:'first',at:4,kind:'kill',actor:r.initial[5].id,target:r.initial[1].id,team:1,causes:[],detail:{}};
 const kill:RoundEvent={id:'victim-kill',at:5,kind:'kill',actor:actor.id,target:r.initial[5].id,team:0,weapon:'AK-47',causes:[],detail:{}};
 const trade:RoundEvent={id:'trade',at:5,kind:'trade',actor:actor.id,team:0,causes:['first','victim-kill'],detail:{}};
 const pickup:RoundEvent={id:'pickup',at:5,kind:'pickup',actor:actor.id,team:0,weapon:'AK-47',zone,causes:['victim-kill'],detail:{}};
 r.events=[first,kill,trade,pickup];expect(quoteCandidates(beat('pickup',[pickup]),r)).toContain('RF-2-10');
 r.events=[first,kill,pickup,trade];expect(quoteCandidates(beat('pickup',[pickup]),r)).not.toContain('RF-2-10');
 r.events=[first,kill,trade,pickup];pickup.causes=['first'];expect(quoteCandidates(beat('pickup',[pickup]),r)).not.toContain('RF-2-10');
 pickup.causes=['victim-kill'];kill.weapon='fire';expect(quoteCandidates(beat('pickup',[pickup]),r)).not.toContain('RF-2-10');
});
it('回防路线受烟封堵需要CT、已下包、目标包点及烟因果，保枪不能冒充回防',()=>{
 const {r}=fixture(),ct=r.sides[0]==='CT'?0:1,actor=r.initial.find(f=>f.team===ct)!,zone=r.map+'-2';r.plans![ct].postPlant='retake';
 const plant:RoundEvent={id:'plant',at:2,kind:'plant',zone,causes:[],detail:{}};
 const smoke:RoundEvent={id:'smoke',at:3,kind:'smoke',zone,causes:[],detail:{}};
 const wait:RoundEvent={id:'wait',at:5,kind:'tactic',team:ct,actor:actor.id,zone,causes:['smoke'],detail:{rule:'smoke',status:'waiting'}};r.events=[plant,smoke,wait];
 expect(quoteCandidates(beat('phase-smoke',[wait]),r)).toContain('RD-9-22');r.plans![ct].postPlant='save';expect(quoteCandidates(beat('phase-smoke',[wait]),r)).not.toContain('RD-9-22');r.plans![ct].postPlant='retake';wait.zone=r.map+'-3';expect(quoteCandidates(beat('phase-smoke',[wait]),r)).not.toContain('RD-9-22');
});
it('阶段道具引句扣除已用数量，同秒后面的投掷不能倒灌',()=>{
 const {r}=fixture(),ct=r.sides[0]==='CT'?0:1,actor=r.initial.find(f=>f.team===ct)!;actor.equipment.utility=['smoke'];
 const rule:RoundEvent={id:'rule',at:5,kind:'tactic',team:ct,actor:actor.id,zone:r.map+'-2',causes:[],detail:{rule:'utility',status:'released'}};
 const smoke:RoundEvent={id:'smoke',at:5,kind:'smoke',team:ct,actor:actor.id,zone:r.map+'-2',causes:[],detail:{}};
 r.events=[rule,smoke];expect(quoteCandidates(beat('phase-utility',[rule]),r)).toContain('RF-6-11');r.events=[smoke,rule];expect(quoteCandidates(beat('phase-utility',[rule]),r)).not.toContain('RF-6-11');
 r.events=[rule];rule.detail.status='waiting';expect(quoteCandidates(beat('phase-utility',[rule]),r)).not.toContain('RF-6-5');actor.equipment.utility=['smoke','flash'];expect(quoteCandidates(beat('phase-utility',[rule]),r)).not.toContain('RF-6-5');
});
it('两名回防队员已丢完道具和留足道具分别看存活与实际消耗',()=>{
 const {r}=fixture(),ct=r.sides[0]==='CT'?0:1,defenders=r.initial.filter(f=>f.team===ct);for(const f of defenders)f.equipment.utility=['smoke'];
 const deaths:RoundEvent[]=defenders.slice(2).map((f,i)=>({id:`dead${i}`,at:1,kind:'kill',target:f.id,causes:[],detail:{}}));
 const thrown:RoundEvent[]=defenders.slice(0,2).map((f,i)=>({id:`smoke${i}`,at:2,kind:'smoke',actor:f.id,team:ct,causes:[],detail:{}}));
 const retake:RoundEvent={id:'retake',at:5,kind:'tactic',team:ct,actor:defenders[0].id,causes:[],detail:{rule:'retake',status:'executing'}};
 r.events=[...deaths,...thrown,retake];expect(quoteCandidates(beat('phase-retake',[retake]),r)).toContain('RD-6-8');r.events=[...deaths,thrown[0],retake];expect(quoteCandidates(beat('phase-retake',[retake]),r)).not.toContain('RD-6-8');
 r.events=[...deaths,retake];for(const f of defenders.slice(0,2))f.equipment.utility=['smoke','flash','fire','he'];expect(quoteCandidates(beat('phase-retake',[retake]),r)).toContain('RW-6-12');defenders[0].equipment.utility.pop();expect(quoteCandidates(beat('phase-retake',[retake]),r)).not.toContain('RW-6-12');
});
it('只要出手就是爆头至少要求当前前缀连续两枪均爆头，不能从未来的爆头倒推',()=>{
 const {r}=fixture(),actor=r.initial[0],target=r.initial[5],zone=r.map+'-2';
 const shots:RoundEvent[]=[1,2].map(i=>({id:`duel${i}`,at:i,kind:'duel',actor:actor.id,target:target.id,zone,weapon:'AK-47',causes:[],detail:{headshot:true}}));
 const damage:RoundEvent={id:'damage',at:2,kind:'damage',causes:['duel2'],detail:{}};
 const kill:RoundEvent={id:'kill',at:2,kind:'kill',actor:actor.id,target:target.id,weapon:'AK-47',zone,causes:['damage'],detail:{}};
 r.events=[...shots,damage,kill];const first=beat('opening',[kill],{actorName:'ZywOo'});expect(quoteCandidates(first,r)).toContain('RF-12-14');shots[0].detail.headshot=false;expect(quoteCandidates(first,r)).not.toContain('RF-12-14');
 shots[0].detail.headshot=true;r.events=[shots[1],damage,kill,shots[0]];expect(quoteCandidates(first,r)).not.toContain('RF-12-14');
});
