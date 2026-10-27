import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {getMap} from '../src/domain/maps';
import {deriveCommentaryBeats,renderChineseCommentary,commentaryCatalog,type CommentaryBeat} from '../src/domain/commentaryBeats';
import {quoteCandidates,realQuoteCatalog} from '../src/domain/realQuotes';
import type {RoundEvent,RoundResult} from '../src/domain/types';

function fixture(){const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);const r=resolveRound(s);r.sides=['T','CT'];for(const f of r.initial)f.side=f.team===0?'T':'CT';r.events=[];return {s,r};}
function event(id:string,kind:RoundEvent['kind'],at=20,data:Partial<RoundEvent>={}):RoundEvent{return {id,kind,at,causes:[],detail:{},...data};}
function beat(category:string,refs:RoundEvent[],facts:CommentaryBeat['facts']={}):CommentaryBeat{return {id:'test-'+category,category,eventIds:refs.map(e=>e.id),at:refs.at(-1)?.at??0,priority:90,candidates:[],facts,fallback:'已发生事实',emphasis:'neutral'};}
function names(r:RoundResult,name:string,id=r.initial[0].id){return {['name:'+id]:name};}
function coldExcept(s:ReturnType<typeof fixture>['s'],r:RoundResult,id:string){r.number=6;const old=structuredClone(r);old.number=5;old.commentary=[...commentaryCatalog.keys()].filter(key=>key!==id).map(templateId=>({templateId,text:'已用',eventIds:[],emphasis:'neutral'}));s.mapStates[0].map=r.map;s.mapStates[0].rounds=[old];}

it('选手专属三杀识别实际名单中的小写名字，其他选手不能借用',()=>{
 const {r}=fixture(),a=r.initial[0];const ks=r.initial.filter(f=>f.team!==a.team).slice(0,3).map((f,i)=>event('k'+i,'kill',10+i,{actor:a.id,target:f.id,team:a.team,weapon:'AK-47',zone:a.zone}));r.events=ks;
 expect(quoteCandidates(beat('multikill',ks,{actorName:'makazze'}),r)).toContain('RB-4-24');
 expect(quoteCandidates(beat('multikill',ks,{actorName:'其他选手'}),r)).not.toContain('RB-4-24');
});
it('沙鹰突破A需要亲自进入A点并在此击杀，加时首回合专属句只在第25回合',()=>{
 const {r}=fixture();r.map='mirage';r.number=25;const actor=r.initial.find(f=>f.team===0)!,foes=r.initial.filter(f=>f.team===1);actor.hp=100;actor.zone='mirage-2';
 const arrival=event('arrival','position',9,{actor:actor.id,team:0,zone:'mirage-2',detail:{from:'mirage-5'}});
 const ks=foes.slice(0,3).map((f,i)=>event('k'+i,'kill',10+i,{actor:actor.id,target:f.id,team:0,zone:'mirage-2',weapon:'Deagle'}));r.events=[arrival,...ks];
 const b=beat('multikill',ks,{actorName:'ZywOo'});expect(quoteCandidates(b,r)).toEqual(expect.arrayContaining(['RQ-5-9','RQ-4-36']));
 r.events=ks;expect(quoteCandidates(b,r)).not.toContain('RQ-5-9');r.events=[arrival,...ks];r.number=26;expect(quoteCandidates(b,r)).not.toContain('RQ-4-36');
});
it('警家方向再狙一人要求同一人的第二次AWP击杀和目标确实在警家',()=>{
 const {s,r}=fixture(),a=r.initial[0],foes=r.initial.filter(f=>f.team!==a.team),spawn=getMap(r.map).ctSpawn;
 const k1=event('first-awp','kill',12,{actor:a.id,target:foes[0].id,team:a.team,zone:r.map+'-2',weapon:'AWP',alive:[5,4]});
 const k2=event('second-awp','kill',20,{actor:a.id,target:foes[1].id,team:a.team,zone:spawn,weapon:'AWP',alive:[5,3]});r.events=[k1,k2,event('end','roundEnd',30)];
 const b=deriveCommentaryBeats(r,s).find(x=>x.category==='awp-followup')!;expect(quoteCandidates(b,r)).toContain('RF-12-6');
 coldExcept(s,r,'RF-12-6');const line=renderChineseCommentary([b],r,s)[0];expect(line.templateId).toBe('RF-12-6');expect(line.eventIds).toEqual(expect.arrayContaining(['first-awp','second-awp']));expect(line.text).toContain('相隔8秒');
 k2.zone=r.map+'-2';expect(deriveCommentaryBeats(r,s).some(x=>x.category==='awp-followup')).toBe(false);k2.zone=spawn;k1.weapon='AK-47';expect(deriveCommentaryBeats(r,s).some(x=>x.category==='awp-followup')).toBe(false);
});
it('燃烧弹致死不再把零血说成仍能逃离，击杀与道具事件保留依据',()=>{
 const {s,r}=fixture(),a=r.initial[0],v=r.initial[5],zone=r.map+'-2';
 const fire=event('fire','fire',10,{actor:a.id,team:a.team,zone});const hurt=event('hurt','damage',11,{actor:a.id,target:v.id,weapon:'fire',zone,hpBefore:20,hpAfter:0,damage:20,causes:[fire.id]});const kill=event('kill','kill',11,{actor:a.id,target:v.id,team:a.team,weapon:'fire',zone,alive:[5,4],causes:[hurt.id]});r.events=[fire,hurt,kill,event('end','roundEnd',12)];
 const beats=deriveCommentaryBeats(r,s);expect(beats.some(b=>b.category==='fire-damage')).toBe(false);const burn=beats.find(b=>b.category==='fire-kill')!;expect(burn.eventIds).toEqual(expect.arrayContaining(['fire','hurt','kill']));
 const lines=renderChineseCommentary(beats,r,s);expect(lines.map(l=>l.text).join(' ')).not.toMatch(/0血|再不离开火区/);expect(lines.find(l=>l.sourceBeatIds?.includes(burn.id))?.text).toContain('燃烧弹');
});
it('燃烧弹换人不借用枪械补枪原句',()=>{
 const {s,r}=fixture(),a=r.initial[0],ally=r.initial[1],enemy=r.initial[5],zone=r.map+'-2';
 const first=event('first','kill',10,{actor:enemy.id,target:ally.id,team:enemy.team,weapon:'AK-47',zone,alive:[4,5]});const fire=event('fire','fire',11,{actor:a.id,team:a.team,zone});const hit=event('hit','damage',12,{actor:a.id,target:enemy.id,weapon:'fire',zone,hpBefore:10,hpAfter:0,damage:10,causes:[fire.id]});const kill=event('kill','kill',12,{actor:a.id,target:enemy.id,team:a.team,weapon:'fire',zone,alive:[4,4],causes:[hit.id]});const trade=event('trade','trade',12,{actor:a.id,team:a.team,causes:[first.id,kill.id]});r.events=[first,fire,hit,kill,trade,event('end','roundEnd',20)];
 const beats=deriveCommentaryBeats(r,s),b=beats.find(x=>x.category==='utility-trade')!;expect(b).toBeDefined();expect(beats.some(x=>x.category==='trade')).toBe(false);
 const line=renderChineseCommentary(beats,r,s).find(l=>l.sourceBeatIds?.includes(b.id))!;expect(line.text).toContain('燃烧弹');expect(line.text).not.toContain('补枪');expect(line.eventIds).toEqual(expect.arrayContaining(['first','kill','trade']));
});

it('下包后CT向包点投烟不足以证明拆包烟用途',()=>{
 const {r}=fixture(),p=event('plant','plant',10,{zone:r.map+'-2'}),smoke=event('smoke','smoke',15,{team:1,actor:r.initial[5].id,zone:p.zone});r.events=[p,smoke];
 expect(quoteCandidates(beat('smoke',[smoke]),r)).not.toEqual(expect.arrayContaining(['RW-8-1']));
 expect(quoteCandidates(beat('smoke',[smoke]),r)).not.toEqual(expect.arrayContaining(['RD-8-8']));
});
it('小孩灭火原句后补地点，不再重复烟灭火',()=>{
 const s=createSeries(newWorld(),'team-6','team-34',1,76);autoVeto(s);const r=resolveRound(s),f=r.initial.find(f=>s.players.find(p=>p.id===f.id)?.nickname==='m0NESY')!;
 const kill=event('kill','kill',10,{actor:f.id,weapon:'AWP'}),e=event('ext','extinguish',20,{actor:f.id,zone:f.zone});r.events=[kill,e];
 const b=beat('extinguish',[e],{actorName:'m0NESY'});b.fallback='烟灭火！';coldExcept(s,r,'RF-6-14');
 const line=renderChineseCommentary([b],r,s)[0];expect(line.templateId).toBe('RF-6-14');expect(line.text.match(/灭火/g)).toHaveLength(1);
});

it('大狙首枪空枪只用已闭合的明确结果，不能把命中、未知结果或第二枪当首枪',()=>{
 const {s,r}=fixture(),a=r.initial[0],v=r.initial[5];
 const shot=event('shot','duel',20,{actor:a.id,target:v.id,team:a.team,weapon:'AWP',detail:{hit:false}});r.events=[shot];
 let b=deriveCommentaryBeats(r,s).find(b=>b.category==='awp-first-miss')!;
 expect(quoteCandidates(b,r)).toEqual(expect.arrayContaining(['RD-12-15','RW-12-5']));
 for(const id of ['RD-12-15','RW-12-5']){coldExcept(s,r,id);const line=renderChineseCommentary([b],r,s)[0];expect(line.templateId).toBe(id);expect(line.text.match(/空枪|没狙到人|没有命中/g)).toHaveLength(1);}
 shot.detail.hit=true;expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-first-miss')).toBe(false);
 delete shot.detail.hit;expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-first-miss')).toBe(false);
 shot.detail.hit=false;r.events=[event('prior','duel',19,{actor:a.id,weapon:'AWP',detail:{hit:true}}),shot];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-first-miss')).toBe(false);
});
it('第二时间再空枪须有两次明确落空和中间已执行的本队阶段',()=>{
 const {s,r}=fixture(),a=r.initial[0],v=r.initial[5],first=event('first','duel',10,{actor:a.id,target:v.id,team:a.team,weapon:'AWP',detail:{hit:false}}),phase=event('phase','tactic',15,{team:a.team,detail:{rule:'execution',status:'executing'}}),second=event('second','duel',20,{actor:a.id,target:v.id,team:a.team,weapon:'AWP',detail:{hit:false}});
 r.events=[first,phase,second];let b=deriveCommentaryBeats(r,s).find(b=>b.category==='awp-repeat-miss')!;expect(b.eventIds).toEqual(['first','phase','second']);expect(quoteCandidates(b,r)).toContain('RD-12-3');coldExcept(s,r,'RD-12-3');const line=renderChineseCommentary([b],r,s)[0];expect(line.templateId).toBe('RD-12-3');expect(line.text).toContain('相隔10秒');expect(line.text.match(/空/g)).toHaveLength(1);
 r.events=[first,second,phase];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-repeat-miss')).toBe(false);
 r.events=[first,phase,second];second.detail.hit=true;expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-repeat-miss')).toBe(false);second.detail.hit=false;phase.actor=v.id;expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-repeat-miss')).toBe(false);
 delete phase.actor;second.at=21;expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-repeat-miss')).toBe(false);second.at=20;r.events=[first,phase,event('plant','plant',19,{zone:r.map+'-2',detail:{}}),second];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-repeat-miss')).toBe(false);
});

it('冻结的345条都有唯一逐句审读，且未用改写原文或不可用枪型充接线',()=>{
 const review=JSON.parse(readFileSync('docs/commentary-quote-review-iteration9.json','utf8'));
 expect(review.rows).toHaveLength(345);expect(new Set(review.rows.map((q:any)=>q.id)).size).toBe(345);
 for(const row of review.rows)expect(row.text).toBe(realQuoteCatalog.get(row.id)!.text);
 for(const id of ['RD-6-19','RF-12-12'])expect(review.rows.find((q:any)=>q.id===id).decision).toBe('deferred');
 expect(review.rows.find((q:any)=>q.id==='RW-4-3').reason).toContain('frozen');
});
it('真实2v2只给仍存活的frozen寒王句，不把尸体或另一个玩家套成寒王',()=>{
 const {r}=fixture(),f=r.initial[0],k=event('k','kill',20,{target:r.initial[5].id,alive:[2,2]});r.events=[k];
 const fFacts={...names(r,'frozen'),['prior2v2:'+f.id]:1};
 expect(quoteCandidates(beat('two-v-two',[k],fFacts),r)).toContain('RW-3-2');
 expect(quoteCandidates(beat('two-v-two',[k],names(r,'frozen')),r)).not.toContain('RW-3-2');
 expect(quoteCandidates(beat('two-v-two',[k],names(r,'other')),r)).not.toContain('RW-3-2');
 r.events=[event('death','kill',10,{target:f.id}),k];expect(quoteCandidates(beat('two-v-two',[k],names(r,'frozen')),r)).not.toContain('RW-3-2');
});
it('有历史依据的寒王二打二与同一击杀合段，保留来源且不重复人数',()=>{
 const s=createSeries(newWorld(),'team-26','team-4',1,76);autoVeto(s);const r=resolveRound(s),f=r.initial.find(f=>s.players.find(p=>p.id===f.id)?.nickname==='frozen')!;
 const k=event('k','kill',20,{actor:f.id,target:r.initial.find(x=>x.team!==f.team)!.id,team:f.team,alive:[2,2],weapon:'AK-47'});r.events=[k];
 const trade={...beat('trade',[k]),id:'trade',priority:96,fallback:'frozen把枪补上，场上是2打2。'},two={...beat('two-v-two',[k],{['name:'+f.id]:'frozen',['prior2v2:'+f.id]:1}),id:'two',priority:65,fallback:'双方剩下二打二。'};
 coldExcept(s,r,'RW-3-2');const line=renderChineseCommentary([trade,two],r,s)[0];expect(line.templateId).toBe('RW-3-2');expect(line.sourceBeatIds).toEqual(['trade','two']);expect(line.text.match(/二打二|2打2/g)).toHaveLength(1);
 two.facts['prior2v2:'+f.id]=0;expect(quoteCandidates(two,r)).not.toContain('RW-3-2');
});
it('利用烟攻包点必须真在包点，香蕉道虽然属于B侧也不能套成B包点',()=>{
 const {r}=fixture();r.map='inferno';const a=r.initial[0],v=r.initial[5];
 const smoke=event('smoke','smoke',10,{actor:a.id,team:0,zone:'inferno-3'}),d=event('duel','duel',12,{actor:a.id,target:v.id,weapon:'AK-47',zone:'inferno-3',detail:{smoke:.48}}),hit=event('hit','damage',12,{causes:[d.id]}),k=event('k','kill',12,{actor:a.id,target:v.id,team:0,zone:'inferno-3',weapon:'AK-47',causes:[hit.id]});r.events=[smoke,d,hit,k];
 expect(quoteCandidates(beat('smoke-kill',[d,hit,k]),r)).toContain('RW-6-7');
 for(const e of [smoke,d,k])e.zone='inferno-5';expect(quoteCandidates(beat('smoke-kill',[d,hit,k]),r)).not.toContain('RW-6-7');
});
it('闪光补枪原句需要真实补枪和队友闪白，侧路不冒充包点',()=>{
 const {r}=fixture();r.map='inferno';const a=r.initial[0],ally=r.initial[1],opponent=r.initial[5],victim=r.initial[2];
 const first=event('first','kill',10,{actor:opponent.id,target:victim.id,team:opponent.team,zone:'inferno-3'}),blind=event('blind','blind',11,{actor:ally.id,target:opponent.id,detail:{until:15}}),kill=event('kill','kill',12,{actor:a.id,target:opponent.id,team:a.team,zone:'inferno-3'}),trade=event('trade','trade',12,{actor:a.id,team:a.team,causes:['first','kill']});
 r.events=[first,blind,kill,trade];const facts={actorName:'ropz'};
 expect(quoteCandidates(beat('flash-conversion',[blind,kill],facts),r)).not.toContain('RB-2-8');expect(quoteCandidates(beat('flash-conversion',[blind,kill],facts),r)).not.toContain('RF-2-14');
 expect(quoteCandidates(beat('trade',[first,kill,trade],facts),r)).toEqual(expect.arrayContaining(['RB-2-8','RF-2-14']));
 kill.zone='inferno-5';expect(quoteCandidates(beat('trade',[first,kill,trade],facts),r)).not.toContain('RB-2-8');
 blind.detail.until=11;expect(quoteCandidates(beat('trade',[first,kill,trade],facts),r)).not.toContain('RF-2-14');
});
it('存活CT无烟不代表包点没有正在生效的烟',()=>{
 const {r}=fixture();r.sides=['T','CT'];for(const f of r.initial.filter(f=>f.team===1))f.equipment.utility=[];
 const plant=event('plant','plant',10,{zone:r.map+'-2'}),smoke=event('smoke','smoke',15,{team:0,zone:plant.zone}),retake=event('retake','tactic',25,{team:1,zone:plant.zone,detail:{rule:'retake',status:'executing'}});
 r.events=[plant,retake];expect(quoteCandidates(beat('phase-retake',[retake]),r)).toContain('RF-8-4');
 r.events=[plant,smoke,retake];for(const id of ['RF-8-4','RW-8-3','RW-8-4'])expect(quoteCandidates(beat('phase-retake',[retake]),r)).not.toContain(id);
});
it('没有移动惩罚不能证明直架；包点三杀不得拿香蕉道冒充',()=>{
 const {r}=fixture();r.map='inferno';const a=r.initial[0],targets=r.initial.filter(f=>f.team!==a.team).slice(0,3);
 const duel=event('duel','duel',10,{actor:a.id,weapon:'AWP',detail:{movingPenalty:0}}),damage=event('damage','damage',10,{causes:['duel']}),kills=targets.map((f,i)=>event('kill'+i,'kill',10+i,{actor:a.id,target:f.id,team:a.team,zone:'inferno-5',weapon:'AWP',causes:i===0?['damage']:[]}));r.events=[duel,damage,...kills];
 for(const id of ['RD-12-7','RW-12-3'])expect(quoteCandidates(beat('awp-opening',[kills[0]]),r)).not.toContain(id);
 expect(quoteCandidates(beat('awp-opening',[kills[0]],{targetName:'KSCERATO'}),r)).not.toContain('RF-12-9');
 expect(quoteCandidates(beat('multikill',kills),r)).not.toContain('RD-4-3');for(const k of kills)k.zone='inferno-3';expect(quoteCandidates(beat('multikill',kills),r)).toContain('RD-4-3');
});
it('A点融化、全员进点与满血突破各自需要真实存活与位置证据',()=>{
 const {r}=fixture();r.sides=['T','CT'];r.map='inferno';const ts=r.initial.filter(f=>f.team===0),cts=r.initial.filter(f=>f.team===1);
 for(const f of ts)f.zone='inferno-2';for(const f of cts)f.zone='inferno-3';
 const kills=cts.slice(0,3).map((f,i)=>event('k'+i,'kill',10+i,{actor:ts[0].id,target:f.id,team:0,zone:'inferno-2',weapon:'AK-47'}));r.events=kills;const b=beat('multikill',kills);
 expect(quoteCandidates(b,r)).toEqual(expect.arrayContaining(['RQ-4-15','RW-4-4','RD-4-2']));
 ts[1].zone='inferno-3';expect(quoteCandidates(b,r)).not.toContain('RW-4-4');ts[1].zone='inferno-2';
 cts[4].zone='inferno-2';expect(quoteCandidates(b,r)).not.toContain('RQ-4-15');cts[4].zone='inferno-3';
 ts[0].zone='inferno-4';expect(quoteCandidates(b,r)).not.toContain('RD-4-2');
});
it('连杀语义与补枪语录需要相应时序和真实补枪事件',()=>{
 const {s,r}=fixture(),a=r.initial.find(f=>s.players.find(p=>p.id===f.id)?.nickname==='ZywOo')!,targets=r.initial.filter(f=>f.team!==a.team).slice(0,4),zone=r.map+'-2';r.number=1;
 const kills=targets.map((f,i)=>event('k'+i,'kill',10+i*4,{actor:a.id,target:f.id,team:a.team,zone,weapon:'Glock',alive:[5,4-i]})),end=event('end','roundEnd',40);
 r.events=[...kills,end];let b=deriveCommentaryBeats(r,s).find(b=>b.category==='multikill')!;
 for(const id of ['RQ-4-5','RB-4-18','RQ-4-33','RQ-5-15','RW-1-2'])expect(quoteCandidates(b,r)).not.toContain(id);
 kills[3].at=18;const death=event('death','kill',17,{actor:targets[3].id,target:r.initial.find(f=>f.team===a.team&&f.id!==a.id)!.id,team:targets[3].team,zone,weapon:'USP-S',alive:[4,2]}),trade=event('trade','trade',18,{actor:a.id,team:a.team,causes:['death','k3']});r.events=[kills[0],kills[1],death,kills[2],kills[3],trade,end];b=deriveCommentaryBeats(r,s).find(b=>b.category==='multikill')!;
 expect(b.eventIds).toContain('trade');expect(quoteCandidates(b,r)).toEqual(expect.arrayContaining(['RQ-4-5','RW-1-2']));
 kills[3].weapon='HE';b=deriveCommentaryBeats(r,s).find(b=>b.category==='multikill')!;expect(quoteCandidates(b,r)).not.toContain('RQ-4-5');
});
it('一打二原句后改补具名焦点或炸弹状态，精简仍保留完整人数',()=>{
 const {s,r}=fixture(),f=r.initial.find(f=>s.players.find(p=>p.id===f.id)?.nickname==='flameZ')!,entry=event('entry','kill',20,{target:r.initial.find(other=>other.team===f.team&&other.id!==f.id)!.id});r.events=[entry];
 const facts={clutchId:f.id,clutchSize:2,...names(r,'flameZ')};
 const b={...beat('clutch-start',[entry],facts),fallback:'只剩选手，一打2。'};
 for(const id of ['RW-3-9','RD-3-7']){
  const test=structuredClone(b);test.facts.actorName='flameZ';coldExcept(s,r,id);const line=renderChineseCommentary([test],r,s)[0];expect(line.templateId).toBe(id);expect(line.text.match(/一打二|一打2/g)).toHaveLength(1);expect(line.briefText).toContain('一打2');
 }
});
it('一打四与无钳原句不重复已说事实，精简仍包含人数和工具',()=>{
 const {s,r}=fixture(),f=r.initial[0],entry=event('entry','kill',20,{target:r.initial[1].id}),b={...beat('clutch-start',[entry],{clutchId:f.id,clutchSize:4}),fallback:`${s.players.find(p=>p.id===f.id)!.nickname}一打4。`};r.events=[entry];
 coldExcept(s,r,'RB-3-37');let line=renderChineseCommentary([b],r,s)[0];expect(line.templateId).toBe('RB-3-37');expect(line.text.match(/一打四|一打4/g)).toHaveLength(1);expect(line.briefText).toContain('一打4');
 const plant=event('plant','plant',30,{zone:r.map+'-2',detail:{explodeAt:70}}),d=event('defuse','defuse',65,{actor:f.id,detail:{kit:false,duration:10}});r.events=[plant,d];
 const db={...beat('defuse-timing',[plant,d]),fallback:'拆掉了，没钳拆了10秒，离爆炸还剩5秒。'};coldExcept(s,r,'RW-8-7');line=renderChineseCommentary([db],r,s)[0];expect(line.templateId).toBe('RW-8-7');expect(line.text.match(/没有钳子|没钳/g)).toHaveLength(1);expect(line.text).toContain('还剩5秒');expect(line.briefText).toContain('没钳');
});
it('一滴血必须恰为1，之后同秒伤害不能提前把2血说成1血',()=>{
 const {r}=fixture(),f=r.initial[0],start=event('start','kill',20,{target:r.initial[1].id}),hit=event('hp','damage',19,{target:f.id,hpAfter:1});
 r.events=[hit,start];expect(quoteCandidates(beat('clutch-start',[start],{clutchId:f.id}),r)).toContain('RW-3-3');
 hit.hpAfter=2;r.events=[hit,start,event('later','damage',20,{target:f.id,hpAfter:1})];expect(quoteCandidates(beat('clutch-start',[start],{clutchId:f.id}),r)).not.toContain('RW-3-3');
});
it('AWP残血保留真正枪械伤害与此前持枪，不能偷看未来拾AWP',()=>{
 const {s,r}=fixture(),f=r.initial[0];f.equipment.weapon='AWP';
 const d=event('damage','damage',20,{actor:r.initial[5].id,target:f.id,weapon:'AK-47',hpAfter:28});r.events=[d];
 let b=deriveCommentaryBeats(r,s).find(b=>b.category==='awp-hurt')!;expect(b).toBeDefined();expect(quoteCandidates(b,r)).toContain('RW-12-13');
 coldExcept(s,r,'RW-12-13');const lines=renderChineseCommentary([b],r,s);expect(lines[0].templateId).toBe('RW-12-13');expect(lines[0].text).toContain('28血');expect(lines[0].text).not.toContain('这一枪过后');
 f.equipment.weapon='AK-47';r.events=[d,event('future','pickup',20,{actor:f.id,weapon:'AWP',zone:r.map+'-2'})];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-hurt')).toBe(false);
 d.weapon='HE';f.equipment.weapon='AWP';r.events=[d];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-hurt')).toBe(false);
});
it('普通枪械残血只报道已发生的非致命伤害，不把未来拾枪或道具伤害套进去',()=>{
 const {s,r}=fixture(),a=r.initial[0],v=r.initial[5];v.equipment.weapon='Glock';
 const shot=event('shot','duel',20,{actor:a.id,target:v.id,weapon:'AK-47'}),hit=event('hit','damage',20,{actor:a.id,target:v.id,weapon:'AK-47',hpAfter:18,causes:['shot']}),pickup=event('pickup','pickup',20,{actor:v.id,weapon:'AWP',zone:r.map+'-2'});
 r.events=[shot,hit,pickup];let b=deriveCommentaryBeats(r,s).find(b=>b.category==='gun-hurt')!;expect(b.eventIds).toEqual(['shot','hit']);expect(b.fallback).toContain('18血');expect(b.fallback).toContain('AK-47');
 r.events=[pickup,shot,hit];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='gun-hurt')).toBe(false);expect(deriveCommentaryBeats(r,s).some(b=>b.category==='awp-hurt')).toBe(true);
 r.events=[shot,hit];hit.weapon='HE';expect(deriveCommentaryBeats(r,s).some(b=>b.category==='gun-hurt')).toBe(false);
 hit.weapon='AK-47';hit.hpAfter=0;expect(deriveCommentaryBeats(r,s).some(b=>b.category==='gun-hurt')).toBe(false);
});
it('炸弹已下后杀初始携包者不能称截包，中路截包也不得泛投其他区域',()=>{
 const {r}=fixture(),f=r.initial[5];f.hasBomb=true;r.map='mirage';
 const k=event('k','kill',20,{actor:r.initial[0].id,target:f.id,zone:'mirage-6',alive:[5,4]});r.events=[k];
 expect(quoteCandidates(beat('opening',[k]),r)).toEqual(expect.arrayContaining(['RD-8-11','RD-8-12']));
 r.events=[event('plant','plant',10),k];expect(quoteCandidates(beat('opening',[k]),r)).not.toContain('RD-8-12');
 r.events=[k];k.zone='mirage-2';expect(quoteCandidates(beat('opening',[k]),r)).not.toContain('RD-8-11');
});
it('先两杀再下包的五秒窗口不包含下包中或下包后的击杀',()=>{
 const {r}=fixture(),id=r.initial[0].id,k1=event('k1','kill',14,{actor:id}),k2=event('k2','kill',16,{actor:id}),p=event('p','plant',20,{actor:id,detail:{startAt:17}});r.events=[k1,k2,p];
 expect(quoteCandidates(beat('plant',[p]),r)).toContain('RD-8-2');k2.at=18;expect(quoteCandidates(beat('plant',[p]),r)).not.toContain('RD-8-2');
});
it('先杀再埋只看下包开始之前，狙击手须是包点最后防守者且紧接着下包',()=>{
 const {r}=fixture();r.sides=['T','CT'];r.map='mirage';const a=r.initial[0],cts=r.initial.filter(f=>f.team===1),victim=cts[0];
 for(const f of cts)f.zone='mirage-3';victim.zone='mirage-2';victim.equipment.weapon='AWP';
 const kill=event('kill','kill',18,{actor:a.id,target:victim.id,team:0,zone:'mirage-2',weapon:'AK-47'}),plant=event('plant','plant',20,{actor:a.id,team:0,zone:'mirage-2',detail:{startAt:17}});r.events=[kill,plant];
 expect(quoteCandidates(beat('plant',[plant]),r)).not.toContain('RB-8-33');expect(quoteCandidates(beat('plant',[plant]),r)).not.toContain('RF-8-2');
 kill.at=16;expect(quoteCandidates(beat('plant',[plant]),r)).toEqual(expect.arrayContaining(['RB-8-33','RF-8-2']));
 cts[1].zone='mirage-2';expect(quoteCandidates(beat('plant',[plant]),r)).not.toContain('RF-8-2');cts[1].zone='mirage-3';
 kill.at=11;expect(quoteCandidates(beat('plant',[plant]),r)).not.toContain('RF-8-2');
});
it('火仔捡狙占包点必须实际位于包点且没有存活对手同区',()=>{
 const {s,r}=fixture();r.map='inferno';const actor=r.initial.find(f=>s.players.find(p=>p.id===f.id)?.nickname==='flameZ')!,foes=r.initial.filter(f=>f.team!==actor.team);for(const f of foes)f.zone='inferno-3';actor.zone='inferno-2';
 const pickup=event('pickup','pickup',20,{actor:actor.id,team:actor.team,zone:'inferno-2',weapon:'AWP'});r.events=[pickup];const b=beat('pickup',[pickup],{actorName:'flameZ'});
 expect(quoteCandidates(b,r)).toContain('RF-12-5');foes[0].zone='inferno-2';expect(quoteCandidates(b,r)).not.toContain('RF-12-5');foes[0].zone='inferno-3';pickup.zone='inferno-5';expect(quoteCandidates(b,r)).not.toContain('RF-12-5');
});
it('裸甲/无道具条件不把死亡遗留道具说成已经全部利用',()=>{
 const {r}=fixture();for(const f of r.initial)f.equipment.utility=f.team===1?['smoke']:[];
 const rule=event('retake','tactic',30,{team:1,detail:{rule:'retake',status:'executing'}});
 const thrown=r.initial.filter(f=>f.team===1).map((f,i)=>event('s'+i,'smoke',10+i,{actor:f.id,team:1}));r.events=[...thrown,rule];
 expect(quoteCandidates(beat('phase-retake',[rule]),r)).toContain('RW-6-16');r.events=[...thrown.slice(0,4),event('dead','kill',20,{target:r.initial[9].id}),rule];expect(quoteCandidates(beat('phase-retake',[rule]),r)).not.toContain('RW-6-16');
});
it('三次强起翻盘计数必须由此前两次真实force翻盘与本回合已获胜构成',()=>{
 const {r}=fixture(),end=event('end','roundEnd');r.events=[end];r.plans![r.winner].economy='force';
 for(const f of r.initial.filter(f=>f.team===r.winner).slice(0,2))f.equipment.weapon='AK-47';
 expect(quoteCandidates(beat('eco-win',[end],{['priorForceUpsets:'+r.winner]:2}),r)).toContain('RW-1-4');
 r.plans![r.winner].economy='semi';expect(quoteCandidates(beat('eco-win',[end],{['priorForceUpsets:'+r.winner]:2}),r)).not.toContain('RW-1-4');
});
it('钢枪与全队保枪必须有各自证据，普通装备翻盘不推断拆分或配合失误',()=>{
 const {r}=fixture();r.sides=['T','CT'];r.winner=0;const end=event('end','roundEnd',60);r.events=[end];
 r.plans![0].economy='eco';for(const f of r.initial.filter(f=>f.team===0))f.equipment.weapon='Glock';
 let ids=quoteCandidates(beat('eco-win',[end]),r);for(const id of ['RB-5-1','RB-5-4','RQ-5-2','RQ-5-27'])expect(ids).not.toContain(id);
 r.plans![0].economy='force';for(const f of r.initial.filter(f=>f.team===0).slice(0,2))f.equipment.weapon='AK-47';
 const ct=r.initial.filter(f=>f.team===1),saves=ct.map((f,i)=>event('save'+i,'save',30+i,{actor:f.id,team:1,detail:{decision:true}}));r.events=[...saves.slice(0,1),end];
 ids=quoteCandidates(beat('eco-win',[end]),r);expect(ids).toEqual(expect.arrayContaining(['RB-5-1','RB-5-4']));expect(ids).not.toContain('RQ-5-2');
 r.events=[...saves,end];expect(quoteCandidates(beat('eco-win',[end]),r)).toContain('RQ-5-2');
 expect(quoteCandidates(beat('clutch-win',[end],{clutchSize:2}),r)).not.toContain('RQ-9-35');
});
it('还有一个暂停指剩余额度1，不能把已用完额度0说成还有',()=>{
 const {r}=fixture(),e=event('timeout','coachTimeout',0,{team:0});r.events=[e];
 expect(quoteCandidates(beat('timeout',[e],{暂停队:'FURIA',remainingTimeouts:1}),r)).toContain('RF-11-4');
 expect(quoteCandidates(beat('timeout',[e],{暂停队:'FURIA',remainingTimeouts:0}),r)).not.toContain('RF-11-4');
});
it('一名CT保枪不能替仍在争夺的全队放赛点，全部存活者已保才允许',()=>{
 const {r}=fixture(),cts=r.initial.filter(f=>f.team===1),plant=event('p','plant',10,{zone:r.map+'-2'}),save=event('save','save',30,{actor:cts[3].id,team:1,detail:{decision:true}});
 const deaths=cts.slice(0,3).map((f,i)=>event('dead'+i,'kill',11+i,{target:f.id}));r.events=[plant,...deaths,save];
 const b=beat('save-decision',[save],{pointLeader:0});expect(quoteCandidates(b,r)).not.toContain('RF-7-1');expect(quoteCandidates(b,r)).not.toContain('RW-7-1');
 expect(quoteCandidates(b,r)).not.toContain('RD-5-5');
 r.events=[plant,...deaths,event('last-dead','kill',29,{target:cts[4].id}),save];expect(quoteCandidates(b,r)).toEqual(expect.arrayContaining(['RF-7-1','RW-7-1']));
 expect(quoteCandidates(b,r)).toContain('RD-5-5');
});
it('稳了与残局AWP自保只在已结束的实际胜利后，且前期击杀不顶替残局击杀',()=>{
 const {r}=fixture(),id=r.initial[0].id,entry=event('entry','kill',20,{target:r.initial[1].id}),end=event('end','roundEnd',50);
 const own=[event('own1','kill',10,{actor:id,weapon:'AWP'}),event('own2','kill',12,{actor:id,weapon:'AWP'})];r.events=[...own,entry,end];
 expect(quoteCandidates(beat('clutch-win',[entry,end],{clutchId:id}),r)).toContain('RF-10-10');expect(quoteCandidates(beat('clutch-win',[entry,end],{clutchId:id}),r)).not.toContain('RD-12-14');
 own[0].at=30;own[1].at=40;r.events=[entry,...own,end];expect(quoteCandidates(beat('clutch-win',[entry,end],{clutchId:id}),r)).toContain('RD-12-14');
 expect(quoteCandidates(beat('clutch-win',[entry],{clutchId:id}),r)).not.toContain('RF-10-10');
});
it('fake转真必须有本方改点事件并在改点后的真实位置开始执行',()=>{
 const {r}=fixture();r.map='mirage';r.decisions[0].tactic='fakeA';
 const x=event('exec','tactic',45,{team:0,zone:'mirage-2',detail:{rule:'execution',status:'executing'}}),info=event('redirect','info',40,{team:0,detail:{fromSite:'B',toSite:'A'}});r.events=[info,x];
 expect(quoteCandidates(beat('phase-execution',[x]),r)).toContain('RW-9-1');r.events=[x,info];expect(quoteCandidates(beat('phase-execution',[x]),r)).not.toContain('RW-9-1');
 r.events=[info,x];x.zone='mirage-3';expect(quoteCandidates(beat('phase-execution',[x]),r)).not.toContain('RW-9-1');
});
it('普通手枪开局不能误报NAVI已经赢手枪局，只有实际NAVI获胜的结算能用',()=>{
 const {r}=fixture(),end=event('end','roundEnd');r.number=1;r.events=[end];const f={['teamName:'+r.winner]:'Natus Vincere'};
 expect(quoteCandidates(beat('setup',[],f),r)).not.toContain('RD-1-3');expect(quoteCandidates(beat('close',[end],f),r)).toContain('RD-1-3');r.number=2;expect(quoteCandidates(beat('close',[end],f),r)).not.toContain('RD-1-3');
});
it('只有真实击杀后双方各一人才能生成一打一，原句后保留名字而不再重复一打一',()=>{
 const {s,r}=fixture(),k=event('k','kill',20,{actor:r.initial[0].id,target:r.initial[5].id,team:0,weapon:'AK-47',zone:r.map+'-2',alive:[1,1]});
 const deaths=r.initial.filter(f=>![r.initial[0].id,r.initial[9].id,r.initial[5].id].includes(f.id)).map((f,i)=>event('dead'+i,'kill',i+1,{actor:f.team===0?r.initial[9].id:r.initial[0].id,target:f.id,team:f.team===0?1:0,zone:r.map+'-2',weapon:'AK-47',alive:[5,5]}));r.events=[...deaths,k];
 const b=deriveCommentaryBeats(r,s).find(b=>b.category==='one-v-one')!;expect(b).toBeDefined();coldExcept(s,r,'RF-3-6');const line=renderChineseCommentary([b],r,s)[0];expect(line.templateId).toBe('RF-3-6');expect(line.text.match(/一打一/g)).toHaveLength(1);expect(line.briefText).toContain('一打一');
 k.alive=[2,1];expect(deriveCommentaryBeats(r,s).some(b=>b.category==='one-v-one')).toBe(false);
});
it('混烟原句后只补具名击杀，头部命中与精简事实仍保留',()=>{
 const {s,r}=fixture();r.map='nuke';const actor=r.initial[0],target=r.initial[5],d=event('duel','duel',20,{actor:actor.id,target:target.id,zone:'nuke-6',weapon:'AK-47',detail:{smoke:.48,headshot:true}}),hit=event('damage','damage',20,{actor:actor.id,target:target.id,causes:[d.id]}),k=event('kill','kill',20,{actor:actor.id,target:target.id,team:0,weapon:'AK-47',zone:'nuke-6',alive:[5,4],causes:[hit.id]});r.events=[d,hit,k];
 const bs=deriveCommentaryBeats(r,s).filter(b=>['headshot','smoke-kill'].includes(b.category));coldExcept(s,r,'RF-6-7');const line=renderChineseCommentary(bs,r,s)[0];
 expect(line.templateId).toBe('RF-6-7');expect(line.text).not.toContain('隔着烟');expect(line.text).toContain('爆头');expect(line.briefText).toContain('隔着烟');expect(line.sourceBeatIds).toHaveLength(2);expect(line.eventIds).toContain(k.id);
});
it('爆头原句不再重复爆头，混烟和精简事实仍保留',()=>{
 const {s,r}=fixture();r.map='mirage';const a=r.initial[0],v=r.initial[5],d=event('d','duel',20,{actor:a.id,target:v.id,zone:'mirage-2',weapon:'AK-47',detail:{smoke:.48,headshot:true}}),damage=event('damage','damage',20,{actor:a.id,target:v.id,causes:['d']}),k=event('kill','kill',20,{actor:a.id,target:v.id,team:a.team,weapon:'AK-47',zone:'mirage-2',alive:[5,4],causes:['damage']});r.events=[d,damage,k];
 const bs=deriveCommentaryBeats(r,s).filter(b=>['opening','headshot','smoke-kill'].includes(b.category));coldExcept(s,r,'RD-4-10');const line=renderChineseCommentary(bs,r,s)[0];
 expect(line.templateId).toBe('RD-4-10');expect(line.text.match(/爆头/g)).toHaveLength(1);expect(line.text).toContain('隔着烟');expect(line.briefText).toContain('爆头');expect(line.briefText).toContain('隔着烟');
});
it('严格even合段后原句、中路与3v3依据保留，精简也不能丢人数',()=>{
 const {s,r}=fixture();r.map='mirage';const a=r.initial[0],ct=r.initial[5];a.zone='mirage-6';r.initial[3].zone='mirage-6';for(const f of r.initial.filter(f=>f.team===1))f.zone='mirage-2';ct.zone='mirage-6';
 const positions=r.initial.map(f=>event('pos'+f.id,'position',0,{actor:f.id,team:f.team,zone:f.zone}));
 const old=[event('k0','kill',1,{actor:ct.id,target:r.initial[1].id,team:1,weapon:'USP-S',zone:'mirage-2',alive:[4,5]}),event('k1','kill',2,{actor:a.id,target:r.initial[7].id,team:0,weapon:'AK-47',zone:'mirage-2',alive:[4,4]}),event('k2','kill',3,{actor:r.initial[6].id,target:r.initial[2].id,team:1,weapon:'USP-S',zone:'mirage-2',alive:[3,4]})];
 const d=event('d','duel',20,{actor:a.id,target:ct.id,weapon:'AK-47',detail:{headshot:true}}),hit=event('hit','damage',20,{causes:[d.id]}),k=event('last','kill',20,{actor:a.id,target:ct.id,team:0,zone:'mirage-6',weapon:'AK-47',alive:[3,3],causes:[hit.id]});r.events=[...positions,...old,d,hit,k];
 const bs=deriveCommentaryBeats(r,s).filter(b=>['headshot','even'].includes(b.category)),even=bs.find(b=>b.category==='even')!;expect(quoteCandidates(even,r)).toContain('RD-2-17');coldExcept(s,r,'RD-2-17');
 const line=renderChineseCommentary(bs,r,s)[0];expect(line.templateId).toBe('RD-2-17');expect(line.sourceBeatIds).toHaveLength(2);expect(line.briefText).toContain('三打三');expect(line.text.match(/三打三|3打3/g)).toHaveLength(1);expect(line.text).not.toContain('中路这边已经');
 r.initial[6].zone='mirage-6';positions.find(e=>e.actor===r.initial[6].id)!.zone='mirage-6';expect(quoteCandidates(even,r)).not.toContain('RD-2-17');
});
it('同图后面的比分与暂停历史不改变早先回合的历史事实门及解说',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);simulateSeries(s);const state=s.mapStates[0],r=state.rounds[5],before=deriveCommentaryBeats(r,s),lines=renderChineseCommentary(before,r,s);
 for(const future of state.rounds.filter(old=>old.number>r.number)){future.score=[0,100];future.winner=1;}
 state.timeoutHistory.push({round:r.number+1,team:0,kind:'belief',reason:'未来暂停'});
 expect(deriveCommentaryBeats(r,s)).toEqual(before);expect(renderChineseCommentary(deriveCommentaryBeats(r,s),r,s)).toEqual(lines);
});
it('Nuke外场虽是抽象mid节点，也不能被叫作中路失控',()=>{
 const {r}=fixture();r.map='nuke';const ts=r.initial.filter(f=>f.team===0),cts=r.initial.filter(f=>f.team===1);
 for(const f of ts)f.zone='nuke-6';for(const f of cts)f.zone='nuke-2';cts[0].zone='nuke-6';
 const dead=[...ts.slice(3),cts[1]].map((f,i)=>event('old'+i,'kill',i+1,{target:f.id})),k=event('k','kill',20,{actor:ts[0].id,target:cts[0].id,team:0,zone:'nuke-6',alive:[3,3]});r.events=[...dead,k];
 expect(quoteCandidates(beat('even',[k]),r)).not.toContain('RD-2-17');
});
it('Nuke外场多杀不能叫中路多杀，Mirage中路仍允许',()=>{
 const {r}=fixture(),a=r.initial[0];r.map='nuke';
 const kills=r.initial.filter(f=>f.team!==a.team).slice(0,3).map((f,i)=>event('k'+i,'kill',10+i,{actor:a.id,target:f.id,team:a.team,zone:'nuke-6',weapon:'AK-47'}));r.events=kills;
 expect(quoteCandidates(beat('multikill',kills),r)).not.toContain('RF-4-4');
 expect(quoteCandidates(beat('multikill',kills),r)).not.toContain('RQ-4-13');
 r.map='mirage';for(const k of kills)k.zone='mirage-6';expect(quoteCandidates(beat('multikill',kills),r)).toEqual(expect.arrayContaining(['RF-4-4','RQ-4-13']));
});
