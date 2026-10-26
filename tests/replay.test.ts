import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {commentarySnapshot} from '../src/domain/replay';

it('播报开始不泄漏未来伤亡，完整播放与最终账本一致',()=>{
 for(let seed=1;seed<=30;seed++){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);const round=resolveRound(s),before=JSON.stringify(round);
  const start=commentarySnapshot(round,1);expect(start.alive).toEqual([5,5]);expect(start.score).toEqual([0,0]);expect(start.complete).toBe(false);
  for(let step=1;step<=round.commentary.length;step++){
   const snapshot=commentarySnapshot(round,step);
   expect(snapshot.fighters.every(f=>f.hp>=0&&f.hp<=100)).toBe(true);
   if(snapshot.complete){expect(snapshot.fighters).toEqual(round.final);expect(snapshot.score).toEqual(round.score);}
  }
  expect(commentarySnapshot(round,99).complete).toBe(true);expect(JSON.stringify(round)).toBe(before);
 }
});
