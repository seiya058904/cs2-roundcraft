import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto,newMapState} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {applyTimeout,canTimeout,timeoutLimit,aiTimeout} from '../src/domain/coach';
import {Random} from '../src/domain/random';
import type {CoachStyle} from '../src/domain/types';
import {makeSave,validateSave} from '../src/domain/save';

it('赛事配置控制暂停总数、加时补充和新图复位',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',3,1,{perMap:3,durationSeconds:30,overtimeExtra:1,cooldownRounds:0});autoVeto(s);const m=s.mapStates[0];
 expect(timeoutLimit(m)).toBe(3);applyTimeout(m,0,'belief');expect(canTimeout(m,0)).toBe(false);
 resolveRound(s);expect(canTimeout(m,0)).toBe(true);expect(m.rounds[0].events.find(e=>e.kind==='coachTimeout')?.detail.durationSeconds).toBe(30);
 expect(()=>validateSave(makeSave(null,s,null))).not.toThrow();
 const fresh=newMapState(s,s.maps[1]);expect(fresh.timeoutsUsed).toEqual([0,0]);expect(fresh.effects).toEqual([null,null]);
 m.rounds=Array.from({length:24},()=>m.rounds[0]);expect(timeoutLimit(m)).toBe(4);m.rounds.push(...m.rounds.slice(0,6));expect(timeoutLimit(m)).toBe(5);
});

it('六种教练偏好受各自情境约束',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,42);autoVeto(s);resolveRound(s);resolveRound(s);const base=s.mapStates[0];
 function count(style:CoachStyle,scenario:'winning'|'losing'|'response'|'rifle'|'late'|'quiet'){
  let used=0;
  for(let seed=1;seed<=100;seed++){
   const map=structuredClone(base),team=structuredClone(s.teams[0]);team.coach.style=style;map.timeoutsUsed=[0,0];map.timeoutHistory=[];map.effects=[null,null];map.score=scenario==='late'?[11,10]:[1,1];
   map.rounds=Array.from({length:scenario==='late'?21:scenario==='quiet'?2:6},(_,i)=>({...base.rounds[0],number:i+1,winner:(scenario==='losing'?1:0)as 0|1}));
   for(const f of map.fighters)f.cash=scenario==='rifle'?4500:1000;
   if(scenario==='response')map.timeoutHistory.push({round:map.rounds.length,team:1,kind:'position',reason:'测试回应'});
   aiTimeout(team,0,map,new Random(seed));used+=map.timeoutsUsed[0];
  }return used;
 }
 expect(count('stopLoss','losing')).toBeGreaterThan(30);expect(count('stopLoss','winning')).toBe(0);
 expect(count('momentum','winning')).toBeGreaterThan(30);expect(count('momentum','losing')).toBe(0);
 expect(count('reactive','response')).toBeGreaterThan(30);expect(count('reactive','late')).toBe(0);
 expect(count('economist','rifle')).toBeGreaterThan(30);expect(count('economist','quiet')).toBe(0);
 expect(count('highLeverage','late')).toBeGreaterThan(30);expect(count('highLeverage','quiet')).toBe(0);
 expect(count('opportunist','quiet')).toBe(0);expect(count('opportunist','winning')).toBeGreaterThan(0);expect(count('opportunist','winning')).toBeLessThan(30);
});
