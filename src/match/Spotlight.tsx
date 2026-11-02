import {useMemo,useRef} from 'react';
import type {RoundEvent,RoundResult,Side} from '../domain/types';
import {getMap} from '../domain/maps';
import {BEAT_KINDS} from './usePlayhead';

export interface Moment {key:string;title:string;sub?:string;side?:Side;size:'big'|'mid'}
const MULTI:Record<number,string>={3:'三杀',4:'四杀',5:'ACE'};

/**
 * The broadcast "moment" for the newest visible event: multi-kills, clutches, first blood and bomb beats.
 * Ordinary trades stay in the kill feed so the big cards keep their weight.
 */
export function momentFor(round:RoundResult,events:readonly RoundEvent[],nick:(id?:string)=>string):Moment|null{
 let index=events.length-1;
 while(index>=0&&!BEAT_KINDS.has(events[index].kind))index--;
 const e=events[index];if(!e)return null;
 const fighter=(id?:string)=>round.initial.find(f=>f.id===id);
 const zone=(id?:string)=>getMap(round.map).zones.find(z=>z.id===id)?.name;
 if(e.kind==='kill'&&e.actor&&e.target){
  const actor=fighter(e.actor),target=fighter(e.target);if(!actor||!target||actor.team===target.team)return null;
  const prefix=events.slice(0,index+1),kills=prefix.filter(k=>k.kind==='kill');
  const mine=kills.filter(k=>k.actor===e.actor&&fighter(k.target)?.team!==actor.team).length;
  if(MULTI[mine])return {key:e.id,title:MULTI[mine],sub:nick(e.actor),side:actor.side,size:'big'};
  const dead=new Set(kills.map(k=>k.target));
  const alive=[0,1].map(team=>round.initial.filter(f=>f.team===team&&!dead.has(f.id)));
  const lone=[0,1].find(team=>alive[team].length===1&&alive[1-team].length>=2);
  // Only the kill that creates the 1vN announces it.
  const before=[0,1].map(team=>alive[team].length+(target.team===team?1:0));
  if(lone!==undefined&&before[lone]>1)return {key:e.id,title:`1v${alive[1-lone].length}`,sub:`残局 · ${nick(alive[lone][0].id)}`,side:alive[lone][0].side,size:'mid'};
  if(kills[0]?.id===e.id)return {key:e.id,title:'首杀',sub:`${nick(e.actor)} → ${nick(e.target)}`,side:actor.side,size:'mid'};
  return null;
 }
 if(e.kind==='plant')return {key:e.id,title:'炸弹已安放',sub:zone(e.zone)??'',side:'T',size:'mid'};
 if(e.kind==='defuseStart')return {key:e.id,title:'开始拆包',sub:`${nick(e.actor)} · ${e.detail.kit?'有钳':'没钳'}`,side:'CT',size:'mid'};
 if(e.kind==='defuse')return {key:e.id,title:'拆包成功',sub:nick(e.actor),side:'CT',size:'big'};
 if(e.kind==='explode')return {key:e.id,title:'炸弹爆炸',side:'T',size:'big'};
 return null;
}

export function Spotlight({round,events,played,nick}:{round:RoundResult;events:readonly RoundEvent[];played:boolean;nick:(id?:string)=>string}){
 // eslint-disable-next-line react-hooks/exhaustive-deps
 const found=useMemo(()=>played?momentFor(round,events,nick):null,[round,events,played]);
 // Hold the last card through quiet beats (a smoke after a triple kill must not cut its animation short).
 const held=useRef<{round:RoundResult;moment:Moment}|null>(null);
 if(!played)held.current=null;else if(found)held.current={round,moment:found};
 const moment=held.current?.round===round?held.current.moment:null;
 if(!moment)return null;
 return <div key={moment.key} className={`spotlight ${moment.size} ${moment.side==='CT'?'side-ct':'side-t'}`} aria-hidden="true"><b>{moment.title}</b>{moment.sub&&<span>{moment.sub}</span>}</div>;
}
