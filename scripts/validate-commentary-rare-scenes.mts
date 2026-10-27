import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {getMap,MAPS} from '../src/domain/maps';
import {createSeries,vetoMap,sidesForRound} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {defaultDecision} from '../src/domain/tactics';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {quoteCandidates} from '../src/domain/realQuotes';
import {reportMetadata} from './report-metadata.mts';
import type {Decision,TeamIndex,MapId} from '../src/domain/types';

// Only public pre-round decisions change. Never insert events, alter equipment,
// replace generated commentary, relax quote gates or reroll a resolved round.
const world=newWorld(),focus=['RD-2-17','RF-6-7'];
const counts=Object.fromEntries(focus.map(id=>[id,{generatedBeats:0,eligibleBeats:0,selectedBeats:0,spoken:0}]));
const byProfile:Record<string,{matches:number;rounds:number;counts:Record<string,{generatedBeats:number;eligibleBeats:number;selectedBeats:number;spoken:number}>}>={};
const samples:unknown[]=[],sampleCounts=new Map<string,number>();
const evenConditions={generated:0,tKill:0,targetAtMid:0,tStillAtMid:0,noCtAtMid:0};
const evenNearMisses:unknown[]=[];
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1];
if(iteration&&!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const configurations: {map:MapId;profile:'ordinary'|'split-contest'|'smoke-contest'|'single-anchor'}[]=[
 ...MAPS.map(map=>({map:map.id,profile:'ordinary' as const})),
 ...(['mirage','ancient','dust2','nuke'] as MapId[]).map(map=>({map,profile:'split-contest' as const})),
 {map:'nuke',profile:'smoke-contest'},
 ...(['mirage','ancient','dust2','cache'] as MapId[]).map(map=>({map,profile:'single-anchor' as const}))
];
let matches=0,rounds=0;
const eligibleIds=new Set<string>(),usedIds=new Set<string>();
for(const config of configurations)for(let seed=1;seed<=(config.profile==='single-anchor'?400:20);seed++){
 if(!byProfile[config.profile])byProfile[config.profile]={matches:0,rounds:0,counts:Object.fromEntries(focus.map(id=>[id,{generatedBeats:0,eligibleBeats:0,selectedBeats:0,spoken:0}]))};
 const s=createSeries(world,'team-3','team-7',1,seed),map=getMap(config.map);
 for(const other of MAPS.filter(other=>other.id!==map.id))vetoMap(s,other.id);
 while(s.status==='playing'){
  const ms=s.mapStates[0],sides=sidesForRound(ms.startSide,ms.rounds.length);
  const decisions=config.profile==='ordinary'?undefined:Object.fromEntries(([0,1] as TeamIndex[]).map(team=>{
   const side=sides[team],fighters=ms.fighters.filter(f=>f.team===team);
   const d:Decision={...defaultDecision(side),tactic:side==='T'?'midControl':'midContest',buy:'fullBuy',adaptive:false,phases:{utility:'normal',smoke:'cross',...(side==='T'?{execution:'regroup' as const}:{postPlant:'retake' as const})}};
   const anchor=fighters.find(f=>s.players.find(p=>p.id===f.id)?.role==='AWPer')?.id??fighters[0].id;
   d.positions=Object.fromEntries(fighters.map((f,i)=>[f.id,config.profile==='single-anchor'&&side==='CT'?f.id===anchor?map.mid:i%2?map.siteA:map.siteB:config.profile==='smoke-contest'||i<3?map.mid:i===3?map.siteA:map.siteB]));
   return [team,d];
  }));
  const r=resolveRound(s,decisions),rng=s.rngState;
  assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);assert.equal(s.rngState,rng);
  const beats=deriveCommentaryBeats(r,s),shown=new Set(r.commentary.flatMap(line=>line.sourceBeatIds??[]));
  for(const b of beats){
   const candidates=quoteCandidates(b,r);for(const id of candidates)eligibleIds.add(id);
   if(b.category==='even'){
    evenConditions.generated++;
    const end=Math.max(...b.eventIds.map(id=>r.events.findIndex(e=>e.id===id))),past=r.events.slice(0,end+1),kill=past[end],t=r.sides[0]==='T'?0:1;
    const survivors=r.initial.filter(f=>!past.some(e=>e.kind==='kill'&&e.target===f.id)).map(f=>({id:f.id,team:f.team,zone:past.filter(e=>e.kind==='position'&&e.actor===f.id).at(-1)?.zone??f.zone}));
    if(kill.team===t){evenConditions.tKill++;if(kill.zone===map.mid){evenConditions.targetAtMid++;if(survivors.some(f=>f.team===t&&f.zone===map.mid)){evenConditions.tStillAtMid++;if(!survivors.some(f=>f.team!==t&&f.zone===map.mid))evenConditions.noCtAtMid++;}}}
    if(kill.team===t&&kill.zone===map.mid&&evenNearMisses.length<4)evenNearMisses.push({...config,seed,round:r.number,kill,survivors});
   }
   for(const id of focus){
    if(b.category!==(id==='RD-2-17'?'even':'smoke-kill'))continue;
    counts[id].generatedBeats++;byProfile[config.profile].counts[id].generatedBeats++;
    if(candidates.includes(id)){counts[id].eligibleBeats++;byProfile[config.profile].counts[id].eligibleBeats++;if(shown.has(b.id)){counts[id].selectedBeats++;byProfile[config.profile].counts[id].selectedBeats++;}}
   }
  }
  for(const line of r.commentary){
   if(line.templateId)usedIds.add(line.templateId);
   if(!line.templateId||!focus.includes(line.templateId))continue;
   const id=line.templateId;counts[id].spoken++;byProfile[config.profile].counts[id].spoken++;
   const ownBeat=beats.find(b=>line.sourceBeatIds?.includes(b.id)&&quoteCandidates(b,r).includes(id));
   assert.ok(ownBeat,'实际播出必须保留通过原门的节拍');
   if((sampleCounts.get(id)??0)<3){
    const anchor=Math.max(...ownBeat.eventIds.map(eventId=>r.events.findIndex(e=>e.id===eventId)));
    samples.push({id,...config,seed,round:r.number,score:r.score,decisions:r.decisions,initial:r.initial,beat:ownBeat,eventPrefix:r.events.slice(0,anchor+1),lines:r.commentary,brief:r.commentary.map(x=>x.briefText).filter(Boolean).join('\n')});
    sampleCounts.set(id,(sampleCounts.get(id)??0)+1);
   }
  }
  rounds++;byProfile[config.profile].rounds++;
 }
 matches++;byProfile[config.profile].matches++;
}
const report={...reportMetadata(),scope:'1840场预先固定队列：七图普通AI、四图三人中区争夺、Nuke全员外场争夺（各种子1至20），四图CT单人中区长枪锚点（各种子1至400）。定向站位是合法用户决策，不计入原150种子或210场普通矩阵覆盖。',matches,rounds,byProfile,counts,evenConditions,evenNearMisses,eligibleIds:[...eligibleIds].sort(),usedIds:[...usedIds].sort(),samples};
writeFileSync(iteration?`docs/commentary-rare-scenes-iteration${iteration}.json`:'docs/commentary-rare-scenes-audit.json',JSON.stringify(report,null,2));
console.log({...report,eligibleIds:undefined,usedIds:undefined,evenNearMisses:evenNearMisses.length,samples:samples.length});
