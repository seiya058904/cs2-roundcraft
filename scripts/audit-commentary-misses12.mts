import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {MAPS} from '../src/domain/maps';
import {createSeries,autoVeto,vetoMap,sidesForRound} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {defaultDecision} from '../src/domain/tactics';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {quoteCandidates} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
import type {Decision,MapId,TeamIndex} from '../src/domain/types';
const world=newWorld(),counts={ordinary:{matches:0,rounds:0,eligible:0,shown:0,spoken:0},'awp-priority':{matches:0,rounds:0,eligible:0,shown:0,spoken:0}},samples:any[]=[];
const cases=[...Array.from({length:150},(_,i)=>({profile:'ordinary' as const,seed:i+1,map:undefined as MapId|undefined})),...(['dust2','mirage','inferno','nuke'] as MapId[]).flatMap(map=>Array.from({length:30},(_,i)=>({profile:'awp-priority' as const,seed:901+i,map})))];
for(const c of cases){
 const s=createSeries(world,'team-3','team-7',1,c.seed);if(c.map)for(const other of MAPS.filter(m=>m.id!==c.map))vetoMap(s,other.id);else autoVeto(s);
 while(s.status==='playing'){
  const ms=s.mapStates[0],sides=sidesForRound(ms.startSide,ms.rounds.length);
  const decisions=c.profile==='ordinary'?undefined:Object.fromEntries(([0,1] as TeamIndex[]).map(team=>{
   const side=sides[team],d:Decision={...defaultDecision(side),buy:'awpPriority',tactic:side==='T'?'midControl':'midContest',adaptive:false};
   if(side==='T')d.phases={execution:'regroup'};return [team,d];
  }));
  const r=resolveRound(s,decisions),rng=s.rngState,beats=deriveCommentaryBeats(r,s);assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  for(const b of beats.filter(b=>b.category==='awp-repeat-miss')){
   const refs=b.eventIds.map(id=>r.events.find(e=>e.id===id)!),shots=refs.filter(e=>e.kind==='duel'),phase=refs.find(e=>e.kind==='tactic')!;assert.equal(shots.length,2);assert.equal(shots[0].actor,shots[1].actor);assert.ok(shots.every(e=>e.weapon==='AWP'&&e.detail.hit===false));assert.ok(r.events.indexOf(shots[0])<r.events.indexOf(phase)&&r.events.indexOf(phase)<r.events.indexOf(shots[1]));assert.ok(quoteCandidates(b,r).includes('RD-12-3'));
   const row=counts[c.profile];row.eligible++;const line=r.commentary.find(l=>l.sourceBeatIds?.includes(b.id));if(line)row.shown++;if(line?.templateId==='RD-12-3'){row.spoken++;if(samples.length<6){const anchor=r.events.indexOf(shots[1]);samples.push({profile:c.profile,seed:c.seed,map:r.map,round:r.number,beat:b,prefix:r.events.slice(0,anchor+1),lines:r.commentary});}}
  }counts[c.profile].rounds++;
 }counts[c.profile].matches++;
}
const report={...reportMetadata(),scope:'150普通AI种子与120场独立AWP优先/合法中区站位配置分开统计；无事件注入、手工选句或重掷。',counts,samples};writeFileSync('docs/commentary-misses-iteration12.json',JSON.stringify(report,null,2));console.log({...report,samples:samples.length});
