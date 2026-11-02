import {useEffect,useRef,useState} from 'react';
import type {RoundEvent,RoundResult} from '../domain/types';

/** Event kinds a viewer can see change on the board; silent bookkeeping (buy, move, sight…) rides along. */
export const BEAT_KINDS:ReadonlySet<RoundEvent['kind']>=new Set(['damage','kill','plant','defuseStart','defuseStop','defuse','explode','timerEnd','roundEnd','flash','blind','smoke','fire','he','pickup','save','extinguish']);

/**
 * Plays the board forward one visible event at a time toward `target` (an event index), spreading the
 * beats across `budget` ms. Anything that is not a natural one-line advance snaps: a seek, "expand all",
 * a round or view change, or motion turned off. Returns the shown index and whether it was reached by
 * playback (so one-shot effects fire only for events the viewer actually watched happen).
 */
export function usePlayhead(round:RoundResult|undefined,target:number,budget:number,animate:boolean){
 const [state,setState]=useState({head:target,played:false});
 const head=useRef(target),last=useRef<{round?:RoundResult;target:number}>({round,target});
 useEffect(()=>{
  const previous=last.current;last.current={round,target};
  const set=(value:number,played:boolean)=>{head.current=value;setState({head:value,played});};
  const from=head.current;
  if(!animate||!round||previous.round!==round||target<=from){set(target,false);return;}
  const beats:number[]=[];for(let i=from+1;i<=target;i++)if(BEAT_KINDS.has(round.events[i].kind))beats.push(i);
  if(!beats.length){set(target,false);return;}
  const step=Math.min(380,Math.max(120,budget/beats.length));
  const timers=beats.map((index,k)=>setTimeout(()=>set(k===beats.length-1?target:index,true),k*step));
  return()=>timers.forEach(clearTimeout);
 // `animate` and `budget` are read for the render that moved the target; later renders must not restart playback.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[round,target]);
 // A new round (or a seek backwards) shows its target at once instead of a frame of the old index.
 const stale=last.current.round!==round;
 const shown=stale?target:Math.min(state.head,target);
 return {head:shown,played:!stale&&state.played,settled:shown>=target};
}
