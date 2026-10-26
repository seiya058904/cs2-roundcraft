import {describe,it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {validateSeries} from '../src/domain/saveValidation';
import {renderCommentary,validateNarration} from '../src/domain/narrative';
import {commentarySnapshot} from '../src/domain/replay';

describe('CS2 presentation and causal upgrade',()=>{
 it('records current engine, accepts a legacy series and rejects an unknown engine',()=>{
  const s=createSeries(newWorld(),'team-3','team-7',1,424);expect(s.engineVersion).toBe('causal-plans-v4');
  delete s.engineVersion;expect(()=>validateSeries(s)).not.toThrow();s.engineVersion='future';expect(()=>validateSeries(s)).toThrow('未知比赛引擎版本');
 });
 it('brief and full readings share monotonic event anchors and never mutate match entropy',()=>{
  const s=createSeries(newWorld(),'team-3','team-7',1,732);autoVeto(s);simulateSeries(s);const before=JSON.stringify(s);
  for(const r of s.mapStates[0].rounds){
   expect(validateNarration(r)).toEqual([]);expect(renderCommentary(r,s)).toEqual(r.commentary);
   let previous=0;for(let i=1;i<=r.commentary.length;i++){const snap=commentarySnapshot(r,i);expect(snap.at).toBeGreaterThanOrEqual(previous);previous=snap.at;}
   expect(commentarySnapshot(r,1).complete).toBe(false);expect(commentarySnapshot(r,r.commentary.length).complete).toBe(true);
   const templateIds=r.commentary.map(x=>x.templateId).filter(Boolean);expect(new Set(templateIds).size).toBe(templateIds.length);
   expect(r.commentary.every(x=>typeof x.briefText==='string'&&x.stage&&x.sourceType)).toBe(true);
   expect(r.commentary.filter(x=>x.briefText).length).toBeLessThanOrEqual(5);
  }
  expect(JSON.stringify(s)).toBe(before);
 });
 it('new rotations cannot act on expired reports; direct gunfights require sight',()=>{
  let reports=0,duels=0;
  for(let seed=10;seed<16;seed++){
   const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
   for(const r of s.mapStates[0].rounds)for(const e of r.events){
    if(e.kind==='info'&&e.detail.informationAge!==undefined){reports++;expect(Number(e.detail.informationAge)).toBeLessThanOrEqual(12);}
    if(e.kind==='duel'){duels++;expect(e.detail.blindness).toBe(1);}
   }
  }
  expect(reports).toBeGreaterThan(0);expect(duels).toBeGreaterThan(0);
 });
 it('manual event rendering does not change deterministic continuation',()=>{
  const a=createSeries(newWorld(),'team-3','team-7',1,93);autoVeto(a);const b=structuredClone(a);
  for(let i=0;i<4;i++){const r=resolveRound(a);renderCommentary(r,a);commentarySnapshot(r,2);resolveRound(b);}
  expect(a).toEqual(b);
 });
 it('sourced HEROIC roles and recent samples replace unsupported assumptions',()=>{
  const w=newWorld();const martinez=w.players.find(p=>p.nickname==='MartinezSa')!;
  expect(martinez.role).toBe('AWPer');expect(martinez.roleConfidence).toBe('verified');
  expect(w.players.find(p=>p.nickname==='Brollan')!.role).toBe('Rifler');
  expect(martinez.profile?.metrics.find(m=>m.key==='recentRating')).toMatchObject({value:1.13,scope:'个人页面过去三个月 / 77 张地图'});
  expect(w.players.filter(p=>p.profile?.metrics.some(m=>m.key==='recentRating'))).toHaveLength(7);
 });
});
