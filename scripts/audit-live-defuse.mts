import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {validateRound} from '../src/domain/invariants';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';
const baseline=process.argv.includes('--baseline'),path=`docs/commentary-defuse-${baseline?'baseline':'iteration12'}.json`;
if(baseline&&existsSync(path))throw new Error('基线已存在，不覆盖');
const world=newWorld(),digest=createHash('sha256'),samples:any[]=[],killSamples:any[]=[];let rounds=0,starts=0,shown=0,stops=0,shownStops=0,quoteSpoken=0,completions=0,killed=0,killedShown=0,otherKill=0,otherShown=0;const newQuotes:Record<string,number>={'RD-8-4':0,'RD-8-9':0};
const margins:Record<string,{events:number;shown:number}>={insufficient:{events:0,shown:0},narrow:{events:0,shown:0},comfortable:{events:0,shown:0}},marginSamples:any[]=[];
for(let seed=1;seed<=150;seed++){
 const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const ms of s.mapStates)for(const r of ms.rounds){
  assert.deepEqual(validateRound(r),[]);assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);
  const events=r.events.filter(e=>e.kind==='defuseStart'),stopEvents=r.events.filter(e=>e.kind==='defuseStop'),beats=deriveCommentaryBeats(r,s);
  const visible=r.commentary.filter(l=>l.sourceBeatIds?.some(id=>beats.find(b=>b.id===id)?.category==='defuse-start'));
  const visibleStops=r.commentary.filter(l=>l.sourceBeatIds?.some(id=>beats.find(b=>b.id===id)?.category==='defuse-stop'));
  const killedBeats=beats.filter(b=>b.category==='defuse-killed'),otherBeats=beats.filter(b=>b.category==='defuse-cover-kill');
  const has=(b:typeof beats[number])=>r.commentary.some(l=>l.sourceBeatIds?.includes(b.id));
  killed+=killedBeats.length;killedShown+=killedBeats.filter(has).length;otherKill+=otherBeats.length;otherShown+=otherBeats.filter(has).length;
  for(const line of r.commentary)if(line.templateId&&line.templateId in newQuotes)newQuotes[line.templateId]++;
  for(const b of [...killedBeats,...otherBeats])if(has(b)&&killSamples.filter(x=>x.category===b.category).length<3)killSamples.push({seed,map:r.map,round:r.number,category:b.category,beat:b,events:r.events,lines:r.commentary});
  starts+=events.length;shown+=visible.length;stops+=stopEvents.length;shownStops+=visibleStops.length;quoteSpoken+=visible.filter(l=>l.templateId==='RF-8-5').length;completions+=r.events.filter(e=>e.kind==='defuse').length;
  for(const e of events){const plant=r.events.find(p=>p.kind==='plant')!;assert.ok(plant&&r.events.indexOf(plant)<r.events.indexOf(e));assert.ok(e.at<Number(plant.detail.explodeAt));
   const margin=Number(plant.detail.explodeAt)-e.at-Number(e.detail.duration),key=margin<=0?'insufficient':margin<=3?'narrow':'comfortable';margins[key].events++;
   const line=visible.find(l=>l.eventIds.includes(e.id));if(line){margins[key].shown++;if(!marginSamples.some(x=>x.key===key))marginSamples.push({key,seed,map:r.map,round:r.number,events:r.events,lines:r.commentary});}
  }
  for(const e of stopEvents){const start=r.events.find(p=>e.causes.includes(p.id)&&p.kind==='defuseStart');assert.ok(start&&start.actor===e.actor&&r.events.indexOf(start)<r.events.indexOf(e));}
  if(visible.length&&samples.length<6)samples.push({seed,map:r.map,round:r.number,events:r.events,lines:r.commentary});
  const projected=r.events.filter(e=>e.kind!=='defuseStart'&&e.kind!=='defuseStop').map(({id,causes,...event})=>event);
  digest.update(JSON.stringify({map:r.map,number:r.number,sides:r.sides,winner:r.winner,reason:r.reason,score:r.score,events:projected,initial:r.initial,final:r.final,economy:r.economy}));rounds++;
 }
 digest.update(JSON.stringify({seed,rng:s.rngState,score:s.score,winner:s.winner}));
}
const report={...reportMetadata(),seeds:150,rounds,starts,shown,stops,shownStops,quoteSpoken,completions,killed,killedShown,otherKill,otherShown,newQuotes,margins,gameplayDigest:digest.digest('hex'),samples,killSamples,marginSamples};
if(!baseline)assert.equal(report.gameplayDigest,JSON.parse(readFileSync('docs/commentary-defuse-baseline.json','utf8')).gameplayDigest,'拆包事件改变了比赛轨迹');
writeFileSync(path,JSON.stringify(report,null,2));console.log({...report,samples:samples.length,killSamples:killSamples.length,marginSamples:marginSamples.length});
