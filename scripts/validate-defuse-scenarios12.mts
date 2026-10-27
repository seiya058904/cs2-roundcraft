import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {MAPS} from '../src/domain/maps';
import {createSeries,vetoMap,sidesForRound} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {defaultDecision} from '../src/domain/tactics';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {quoteCandidates} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
import type {Decision,TeamIndex} from '../src/domain/types';
const focus=['RF-8-5','RD-8-9','RD-8-4'],profiles=['ordinary','fast-retake'] as const;
const counts=Object.fromEntries(profiles.map(p=>[p,Object.fromEntries(focus.map(id=>[id,{eligible:0,shown:0,spoken:0}]))]));
const world=newWorld(),pairs=[['Vitality','FURIA'],['Falcons','Natus Vincere']],samples:any[]=[];let matches=0,rounds=0;
for(const pair of pairs)for(const map of MAPS)for(const profile of profiles)for(let seed=801;seed<=840;seed++){
 const ids=pair.map(name=>world.teams.find(t=>t.name===name)!.id),s=createSeries(world,ids[0],ids[1],1,seed);for(const other of MAPS.filter(x=>x.id!==map.id))vetoMap(s,other.id);
 while(s.status==='playing'){
  const ms=s.mapStates[0],sides=sidesForRound(ms.startSide,ms.rounds.length);
  const decisions=profile==='ordinary'?undefined:Object.fromEntries(([0,1] as TeamIndex[]).map(team=>{
   const side=sides[team],d:Decision={...defaultDecision(side),tactic:side==='T'?'fastA':'retake',buy:'auto',adaptive:false};
   d.phases=side==='T'?{execution:'direct',smoke:'cross'}:{postPlant:'retake',smoke:'respect'};return [team,d];
  }));
  const r=resolveRound(s,decisions),rng=s.rngState,beats=deriveCommentaryBeats(r,s);assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  for(const b of beats)for(const id of quoteCandidates(b,r))if(focus.includes(id)){
   const c=counts[profile][id];c.eligible++;const line=r.commentary.find(l=>l.sourceBeatIds?.includes(b.id));if(line)c.shown++;
   if(line?.templateId===id){c.spoken++;if(samples.filter(x=>x.id===id).length<3){const anchor=Math.max(...b.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));samples.push({id,pair,map:map.id,profile,seed,round:r.number,beat:b,prefix:r.events.slice(0,anchor+1),lines:r.commentary});}}
  }
  rounds++;
 }
 matches++;
}
const report={...reportMetadata(),scope:'两组真实阵容、七图、固定种子801–840，普通AI与合法快A/回防决策分开统计；不插入事件、改装备、重掷或指定原句。',matches,rounds,counts,samples};
writeFileSync('docs/commentary-defuse-targeted-iteration12.json',JSON.stringify(report,null,2));console.log({...report,samples:samples.map(x=>x.id)});
