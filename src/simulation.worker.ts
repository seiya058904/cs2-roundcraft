import {startEvent,simulateCareerFixture,type Career} from './domain/career';
import {resolveRound} from './domain/engine';
import type {Series} from './domain/types';
let cancelled=false;
onmessage=async(event:MessageEvent<{type:'cancel'}|{type:'career';career:Career;limit:'event'|'season'|'untilManagedMatch';eventId?:string}|{type:'match';match:Series;limit:'map'|'series'}>)=>{
 if(event.data.type==='cancel'){cancelled=true;return;}cancelled=false;const task=event.data;
 let checkpoint=structuredClone(task);
 try{
 if(task.type==='career'){
  const c=task.career;let count=0;const requested=task.eventId?c.calendar.find(e=>e.id===task.eventId):undefined;let active=c.calendar.find(e=>e.status==='active')??c.calendar.find(e=>e.status==='upcoming'&&(!requested||e.week<=requested.week));const first=requested?.id??active?.id;
  while(active&&!cancelled){if(active.status==='upcoming')startEvent(c,active.id);
   if(task.limit==='untilManagedMatch'&&active.id===first&&active.tournament?.fixtures.some(f=>!f.winner&&(f.a===c.managedTeamId||f.b===c.managedTeamId)))break;
   checkpoint=structuredClone(task);simulateCareerFixture(c,active.id);count++;postMessage({type:'progress',message:`${active.name} · 已完成 ${count} 场`,career:c});await new Promise(r=>setTimeout(r,0));if(active.status==='finished'){if(task.limit!=='season'&&active.id===first)break;active=c.calendar.find(e=>e.status==='upcoming');}}
  postMessage({type:'done',career:c,cancelled});
 }else{
  const s=task.match,mapCount=s.mapStates.length;let count=0;while(s.status==='playing'&&!cancelled){resolveRound(s);count++;if(count%3===0){checkpoint=structuredClone(task);postMessage({type:'progress',message:`已模拟 ${count} 回合`});await new Promise(r=>setTimeout(r,0));}if(task.limit==='map'&&s.mapStates.length!==mapCount)break;}
  postMessage({type:'done',match:s,cancelled});
 }
 }catch(error){postMessage({type:'error',message:`${error instanceof Error?error.message:String(error)}；已回退到最近完整模拟边界`,...(checkpoint.type==='career'?{career:checkpoint.career}:{match:checkpoint.match})});}
};
