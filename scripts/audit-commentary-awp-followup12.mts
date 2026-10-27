import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {MAPS,getMap} from '../src/domain/maps';
import {createSeries,autoVeto,vetoMap,sidesForRound} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {defaultDecision} from '../src/domain/tactics';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {quoteCandidates} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
import type {Decision,MapId,TeamIndex} from '../src/domain/types';
const world=newWorld(),counts={ordinary:{matches:0,rounds:0,eligible:0,shown:0,spoken:0},targeted:{matches:0,rounds:0,eligible:0,shown:0,spoken:0}},samples:any[]=[];
const cases=[...Array.from({length:150},(_,i)=>({profile:'ordinary' as const,seed:i+1,map:undefined as MapId|undefined})),...MAPS.flatMap(map=>Array.from({length:40},(_,i)=>({profile:'targeted' as const,seed:1001+i,map:map.id})))];
for(const c of cases){
 const s=createSeries(world,'team-3','team-7',1,c.seed);if(c.map)for(const other of MAPS.filter(m=>m.id!==c.map))vetoMap(s,other.id);else autoVeto(s);
 while(s.status==='playing'){
  const ms=s.mapStates[0],sides=sidesForRound(ms.startSide,ms.rounds.length);
  const decisions=c.profile==='ordinary'?undefined:Object.fromEntries(([0,1] as TeamIndex[]).map(team=>{
   const side=sides[team],d:Decision={...defaultDecision(side),buy:'awpPriority',tactic:side==='T'?'fastA':'retake',adaptive:false};return [team,d];
  }));
  const r=resolveRound(s,decisions),rng=s.rngState,beats=deriveCommentaryBeats(r,s);assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  for(const b of beats.filter(b=>b.category==='awp-followup')){
   const ks=r.events.filter(e=>b.eventIds.includes(e.id)&&e.kind==='kill');assert.equal(ks.length,2);assert.ok(ks.every(k=>k.weapon==='AWP'&&k.actor===ks[0].actor));assert.equal(ks[1].zone,getMap(r.map).ctSpawn);assert.ok(quoteCandidates(b,r).includes('RF-12-6'));
   const row=counts[c.profile];row.eligible++;const line=r.commentary.find(l=>l.sourceBeatIds?.includes(b.id));if(line)row.shown++;if(line?.templateId==='RF-12-6'){row.spoken++;if(samples.length<6){const anchor=r.events.indexOf(ks[1]);samples.push({profile:c.profile,seed:c.seed,map:r.map,round:r.number,beat:b,prefix:r.events.slice(0,anchor+1),lines:r.commentary});}}
  }counts[c.profile].rounds++;
 }counts[c.profile].matches++;
}
const report={...reportMetadata(),scope:'150场普通AI和七图各40场AWP优先、快A/回防配置分开统计；真实事件，不强制原句。',counts,samples};writeFileSync('docs/commentary-awp-followup-iteration12.json',JSON.stringify(report,null,2));console.log({...report,samples:samples.length});
