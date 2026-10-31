import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {validateNarration,renderCommentary} from '../src/domain/narrative';
import {roundMvp} from '../src/domain/insights';
import {commentaryPlayerName} from '../src/domain/names';
import {DUO_FAMILIES} from '../src/domain/duo';

const played=(seed:number,version?:string)=>{const s=createSeries(newWorld(),'team-3','team-7',1,seed);if(version)s.engineVersion=version;autoVeto(s);simulateSeries(s);return s;};
it('v5 解说席：每段都有声音，嘉宾句只引用已揭示事件，锚点单调且无未填变量',()=>{
 let analyst=0,caster=0;
 for(const seed of [3,21,57]){const s=played(seed);
  for(const r of s.mapStates[0].rounds){expect(validateNarration(r)).toEqual([]);expect(renderCommentary(r,s)).toEqual(r.commentary);
   let reach=-1;for(const line of r.commentary){expect(['caster','analyst']).toContain(line.voice);
    const next=Math.max(...line.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));expect(next).toBeGreaterThanOrEqual(reach);reach=next;
    if(line.templateId?.startsWith('DA-')){analyst++;expect(line.voice).toBe('analyst');expect(line.briefText).toBe('');}
    if(line.templateId?.startsWith('DC-')){caster++;expect(line.voice).toBe('caster');}}
   expect(r.commentary.filter(l=>l.templateId?.startsWith('DA-')).length).toBeLessThanOrEqual(3);}}
 expect(analyst).toBeGreaterThan(20);expect(caster).toBeGreaterThan(0);
});
it('回合 MVP 的击杀数与账本一致',()=>{
 const s=played(21);let checked=0;
 for(const r of s.mapStates[0].rounds)for(const line of r.commentary)if(line.templateId?.startsWith('DA-mvp')){const mvp=roundMvp(r)!;
  expect(line.text).toContain(commentaryPlayerName(s.players.find(p=>p.id===mvp.playerId)!));expect(line.text).toContain(`${mvp.kills}`);checked++;}
 expect(checked).toBeGreaterThan(0);
});
it('旧引擎比赛保持原解说，不出现解说席字段',()=>{
 const s=played(21,'causal-plans-v4');
 for(const r of s.mapStates[0].rounds)expect(r.commentary.every(l=>l.voice===undefined&&!/^D[AC]-/.test(l.templateId??''))).toBe(true);
 expect(DUO_FAMILIES.length).toBeGreaterThanOrEqual(12);
});
