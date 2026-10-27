import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderCommentary,validateNarration} from '../src/domain/narrative';
import {reportMetadata} from './report-metadata.mts';
const world=newWorld(),samples:any[]=[];let rounds=0,eliminations=0,alreadyAnchored=0,newlyExplained=0,posthumous=0;const scoreMoments={equalized:0,lead:0,oneBehind:0};
for(let seed=1;seed<=150;seed++){
 const s=createSeries(world,'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){
  assert.deepEqual(validateNarration(r),[]);assert.deepEqual(renderCommentary(r,s),r.commentary);rounds++;
  const beats=deriveCommentaryBeats(r,s),close=r.commentary.findIndex(l=>l.sourceBeatIds?.some(id=>beats.find(b=>b.id===id)?.category==='close'));assert.ok(close>=0);
  const before=[...r.score];before[r.winner]--;const opponent=1-r.winner,closeText=r.commentary[close].text;
  if(closeText.includes('双方比分扳平')){scoreMoments.equalized++;assert.ok(before[r.winner]<before[opponent]&&r.score[0]===r.score[1]);}
  if(closeText.includes('这一分打破平局')){scoreMoments.lead++;assert.equal(before[0],before[1]);assert.ok(r.score[r.winner]>r.score[opponent]);}
  if(closeText.includes('分差追到只剩一分')){scoreMoments.oneBehind++;assert.equal(before[opponent]-before[r.winner],2);assert.equal(r.score[opponent]-r.score[r.winner],1);}
  if(r.reason!=='elimination')continue;eliminations++;
  const kill=r.events.filter(e=>e.kind==='kill').at(-1)!;
  const seen=r.commentary.slice(0,close).some(l=>l.eventIds.includes(kill.id)),line=r.commentary[close];
  if(seen){alreadyAnchored++;assert.ok(!line.text.includes('最后倒下的是'));}
  else{newlyExplained++;assert.ok(line.eventIds.includes(kill.id));assert.ok(line.text.includes('最后倒下的是'));assert.ok(line.briefText?.includes('最后倒下的是'));if(r.events.slice(0,r.events.indexOf(kill)).some(e=>e.kind==='kill'&&e.target===kill.actor))posthumous++;
   if(samples.length<8)samples.push({seed,map:r.map,round:r.number,kill,lines:r.commentary});
  }
 }
}
const report={...reportMetadata(),seeds:150,rounds,eliminations,alreadyAnchored,newlyExplained,posthumous,scoreMoments,samples};writeFileSync('docs/commentary-close-iteration12.json',JSON.stringify(report,null,2));console.log({...report,samples:samples.length});
