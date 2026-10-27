import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats} from '../src/domain/narrative';
import {realQuoteCatalog} from '../src/domain/realQuotes';
import {formatCommentaryNames} from '../src/domain/names';
import {reportMetadata} from './report-metadata.mts';

const wanted=['setup','clutch-start','clutch-win','clutch-loss','multikill','eco-start','eco-win','semi-start','match-point','timeout','overtime','overtime-match-point','overtime-repeat','map-win'];
const iteration=process.argv.find(arg=>arg.startsWith('--iteration='))?.split('=')[1]??'8';
if(!/^\d+$/.test(iteration))throw new Error('迭代编号必须为数字');
const markers=['好吧','兄弟们','我去','你看','其实','但是','第一时间','第二时间'];
const markerCounts=Object.fromEntries(markers.map(marker=>[marker,0])),sceneCounts=Object.fromEntries(wanted.map(scene=>[scene,0])),sampleCounts=new Map<string,number>();
const emphatic=/卧槽|牛逼|无敌|太变态|太夸张/,metaphor=/高压锅|一键扫荡|歼灭模式|游龙|包饺子|空城计|变速齿轮|融化|凡人挑战神明|杀戮机器/;
const samples:unknown[]=[];let rounds=0,quoteFirstChecks=0,tradeTimingChecks=0,defuseTimingChecks=0,emphaticRounds=0,metaphorRounds=0;
for(let seed=1;seed<=150;seed++){
 const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);let lastEmphasis=-100,lastMetaphor=-100;
 for(const r of s.mapStates[0].rounds){
  const beats=deriveCommentaryBeats(r,s),shown=new Set(r.commentary.flatMap(line=>line.sourceBeatIds??[])),selected=beats.filter(b=>shown.has(b.id)),text=r.commentary.map(line=>line.text).join('\n\n');
  for(const marker of markers)markerCounts[marker]+=text.split(marker).length-1;
  const intense=r.commentary.filter(line=>emphatic.test(line.text)),metaphors=r.commentary.filter(line=>metaphor.test(line.text));assert.ok(intense.length<=1);assert.ok(metaphors.length<=1);
  if(intense.length){assert.ok(r.number-lastEmphasis>3);lastEmphasis=r.number;emphaticRounds++;}
  if(metaphors.length){assert.ok(r.number-lastMetaphor>10);lastMetaphor=r.number;metaphorRounds++;}
  for(const line of r.commentary){
   const quote=line.templateId&&realQuoteCatalog.get(line.templateId);if(quote){assert.ok(line.text.startsWith(formatCommentaryNames(quote.text,s.players,s.teams)));quoteFirstChecks++;}
   for(const id of line.sourceBeatIds??[]){const b=beats.find(b=>b.id===id)!;
    if(b.category==='trade'){const kills=r.events.filter(e=>b.eventIds.includes(e.id)&&e.kind==='kill');const delay=kills.at(-1)!.at-kills[0].at;assert.ok(line.text.includes(delay?`${delay}秒`:'马上'));tradeTimingChecks++;}
    if(b.category==='defuse-timing'){const defuse=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='defuse')!,plant=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='plant')!;assert.ok(line.text.includes(`${defuse.detail.duration}秒`));assert.ok(line.text.includes(`${Number(plant.detail.explodeAt)-defuse.at}秒`));defuseTimingChecks++;}
   }
  }
  const scenes=selected.flatMap(b=>[...(wanted.includes(b.category)?[b.category]:[]),...(b.category==='economy'&&typeof b.facts.weakTeam==='number'?[r.plans![b.facts.weakTeam].economy==='eco'?'eco-start':r.plans![b.facts.weakTeam].economy==='semi'?'semi-start':''].filter(Boolean):[])]).filter(scene=>scene!=='eco-win'||r.plans![r.winner].economy==='eco');
  for(const scene of new Set(scenes)){sceneCounts[scene]++;if((sampleCounts.get(scene)??0)<2){samples.push({scene,seed,map:r.map,round:r.number,score:r.score,text,brief:r.commentary.map(line=>line.briefText??'').filter(Boolean).join('\n'),lines:r.commentary});sampleCounts.set(scene,(sampleCounts.get(scene)??0)+1);}}
  rounds++;
 }
}
for(const scene of wanted)assert.ok(sceneCounts[scene]>0,scene);
assert.ok(sceneCounts['clutch-start']<=rounds*.4,'普通队列的残局开始播报过密');
const report={...reportMetadata(),matches:150,rounds,sceneCounts,markerCounts,quoteFirstChecks,tradeTimingChecks,defuseTimingChecks,emphaticRounds,metaphorRounds,scope:'情绪控制仅核对所列模式；口头禅为本次实际播报计数，不用用户原字幕词频作精确拟合；人工审读另记。',samples};
writeFileSync(`docs/commentary-style-iteration${iteration}.json`,JSON.stringify(report,null,2));console.log({...report,samples:samples.length});
