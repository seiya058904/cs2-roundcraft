import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto,mapWinner} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderChineseCommentary} from '../src/domain/commentaryBeats';
import {quoteCandidates} from '../src/domain/realQuotes';
import type {CommentaryBeat} from '../src/domain/commentaryBeats';
import type {RoundEvent} from '../src/domain/types';

function fixture(){const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);return {s,r:resolveRound(s)};}
it('加时赛点沿用当前地图胜负条件，15平和18平分别进入下一轮而不是误报只差一分',()=>{
 const cases:[number,number,string[]][]=[[15,14,['overtime-match-point']],[15,15,['overtime-repeat']],[18,17,['overtime-match-point']],[18,18,['overtime-repeat']],[21,20,['overtime-match-point']],[16,14,['map-win']],[19,17,['map-win']]];
 for(const [a,b,expected] of cases){const {s,r}=fixture();r.score=[a,b];r.number=a+b;r.winner=0;
  const categories=deriveCommentaryBeats(r,s).map(b=>b.category);
  expect(categories.filter(c=>['overtime-match-point','overtime-repeat','map-win'].includes(c))).toEqual(expected);
 }
});
it('加时前半场结束按三回合边界播报，胜负已分时不再预告换边',()=>{
 for(const [score,wanted] of [[[15,12],true],[[14,13],true],[[16,14],false],[[18,15],true],[[19,14],false]] as [[number,number],boolean][]){
  const {s,r}=fixture();r.score=score;r.number=score[0]+score[1];r.winner=0;
  expect(deriveCommentaryBeats(r,s).some(b=>b.category==='overtime-half')).toBe(wanted);
 }
});
it('开局压力只看回合开始比分，不提前宣布本回合刚拿到的赛点或地图胜利',()=>{
 const {s,r}=fixture();r.score=[12,6];r.winner=0;r.number=18;
 expect(deriveCommentaryBeats(r,s).find(b=>b.category==='setup')!.fallback).not.toContain('地图赛点');
 r.score=[13,6];r.number=19;expect(deriveCommentaryBeats(r,s).find(b=>b.category==='setup')!.fallback).toContain('地图赛点');
 r.score=[16,15];r.number=31;const setup=deriveCommentaryBeats(r,s).find(b=>b.category==='setup')!;
 expect(setup.fallback).toContain('第2轮加时，第1回合');expect(setup.fallback).not.toContain('地图赛点');
});
it('开局压力在真实语录、原创模板和事实回退三条路径都只说一次',()=>{
 const {s,r}=fixture();r.score=[16,15];r.number=31;r.winner=0;
 const setup=deriveCommentaryBeats(r,s).find(b=>b.category==='setup')!;
 for(const tactic of ['default','fastA'] as const){r.decisions[r.sides[0]==='T'?0:1].tactic=tactic;
  for(const candidates of [[],['WJ-008']]){const [line]=renderChineseCommentary([{...setup,candidates}],r,s);expect(line.text.split('第2轮加时，第1回合').length-1).toBe(1);}
 }
});
it('BO3单图胜利与系列赛胜利分开取证，回放不读取后面地图的结果',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',3,201);autoVeto(s);simulateSeries(s);
 let finished=0;
 for(const [index,ms] of s.mapStates.entries()){
  const r=ms.rounds.at(-1)!,beat=deriveCommentaryBeats(r,s).find(b=>b.category==='map-win')!;
  expect(beat).toBeDefined();expect(mapWinner(r.score)).toBe(r.winner);
  const before=s.mapStates.slice(0,index).filter(old=>old.winner===r.winner).length,seriesEnd=before+1>s.bestOf/2;
  expect(beat.facts.seriesFinished).toBe(seriesEnd?1:0);
  expect(quoteCandidates(beat,r).includes('RF-7-3')).toBe(seriesEnd);if(seriesEnd)finished++;
 }
 expect(finished).toBe(1);
 const first=s.mapStates[0].rounds.at(-1)!,before=deriveCommentaryBeats(first,s);s.mapStates.at(-1)!.winner=s.mapStates.at(-1)!.winner===0?1:0;
 expect(deriveCommentaryBeats(first,s)).toEqual(before);
});
it('守住赛点的引句只在真实赛点失败且回合结束后使用，具名猎鹰仍须握有赛点',()=>{
 const {s,r}=fixture();r.score=[6,12];r.number=18;r.winner=0;
 const beat=deriveCommentaryBeats(r,s).find(b=>b.category==='match-point-saved')!;
 expect(quoteCandidates(beat,r)).toContain('RB-7-2');expect(quoteCandidates({...beat,facts:{...beat.facts,pointLeaderName:'Falcons'}},r)).toContain('RD-7-1');
 r.score=[6,10];expect(quoteCandidates(beat,r)).not.toContain('RB-7-2');
 r.score=[12,12];expect(quoteCandidates({...beat,facts:{...beat.facts,pointLeaderName:'Falcons'}},r)).not.toContain('RD-7-1');
});
it('最后暂停的事实使用历史前缀和当前额度，不能把后面用掉的暂停倒灌到回放',()=>{
 const {s,r}=fixture(),ms=s.mapStates[0];r.number=7;ms.timeoutRules={...ms.timeoutRules!,perMap:3};
 const event:RoundEvent={id:'timeout',at:0,kind:'coachTimeout',team:0,causes:[],detail:{kind:'position'}};r.events.unshift(event);
 ms.timeoutHistory=[1,4,7].map(round=>({round,team:0,kind:'position',reason:'测试'}));
 const timeout=()=>deriveCommentaryBeats(r,s).find(b=>b.category==='timeout')!;
 expect(timeout().facts.remainingTimeouts).toBe(0);expect(quoteCandidates(timeout(),r)).toContain('RD-11-6');
 ms.timeoutHistory=ms.timeoutHistory.filter(record=>record.round!==4);ms.timeoutHistory.push({round:10,team:0,kind:'position',reason:'后面才发生'});
 expect(timeout().facts.remainingTimeouts).toBe(1);expect(quoteCandidates(timeout(),r)).not.toContain('RD-11-6');
});
it('败方尽力语录要求已结束的真实败方残局及残局后的击杀，不泛投给所有失败',()=>{
 const {r}=fixture(),player=r.initial[0];r.winner=1;
 const kill:RoundEvent={id:'effort',at:5,kind:'kill',actor:player.id,target:r.initial[5].id,weapon:'AK-47',causes:[],detail:{}};
 const end:RoundEvent={id:'end',at:20,kind:'roundEnd',causes:[],detail:{}};r.events=[kill,end];
 const beat:CommentaryBeat={id:'loss',category:'clutch-loss',at:20,priority:93,eventIds:['effort','end'],candidates:[],fallback:'',facts:{clutchId:player.id,clutchSize:3},emphasis:'neutral'};
 expect(quoteCandidates(beat,r)).toContain('RD-3-11');expect(quoteCandidates({...beat,eventIds:['end']},r)).not.toContain('RD-3-11');
 r.winner=0;expect(quoteCandidates(beat,r)).not.toContain('RD-3-11');
 r.winner=1;r.events=[kill];expect(quoteCandidates(beat,r)).not.toContain('RD-3-11');
});
it('决胜阶段提示在真实结果之后，精简仍最多五段，所有主句与辅助句保持确定',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,5);autoVeto(s);simulateSeries(s);const seen=new Set<string>();
 for(const r of s.mapStates[0].rounds){const beats=deriveCommentaryBeats(r,s),categories=r.commentary.map(line=>line.sourceBeatIds?.map(id=>beats.find(b=>b.id===id)!.category)??[]),close=categories.findIndex(row=>row.includes('close'));
  for(const kind of ['map-win','overtime-match-point','overtime-half','match-point-saved'])if(beats.some(b=>b.category===kind)){const index=categories.findIndex(row=>row.includes(kind));expect(index).toBeGreaterThan(close);expect(r.commentary[index].briefText).toBeTruthy();seen.add(kind);}
  expect(r.commentary.filter(line=>line.briefText).length).toBeLessThanOrEqual(5);expect(renderChineseCommentary(beats,r,s)).toEqual(r.commentary);
 }
 expect(seen).toContain('map-win');expect(seen).toContain('overtime-match-point');
});
