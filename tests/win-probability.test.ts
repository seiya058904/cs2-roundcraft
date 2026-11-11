import {expect,it} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto,newMapState} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {preRoundCtWin,winCurve} from '../src/domain/insights';
import {MAPS} from '../src/domain/maps';
import {validateSave,makeSave} from '../src/domain/save';

it('新模型只改变估计和分析解说，不影响事件、胜负、经济与随机流',()=>{
 const modern=createSeries(newWorld(),'team-3','team-7',1,422),legacy=structuredClone(modern);delete legacy.winProbabilityVersion;
 autoVeto(modern);autoVeto(legacy);simulateSeries(modern);simulateSeries(legacy);
 const simulation=(s:typeof modern)=>({
  ...s,winProbabilityVersion:undefined,
  mapStates:s.mapStates.map(m=>({...m,rounds:m.rounds.map(r=>({...r,commentary:undefined}))}))
 });
 expect(simulation(modern)).toEqual(simulation(legacy));
 expect(validateSave(makeSave(null,modern,null)).match?.winProbabilityVersion).toBe('wp-v6-1');
 expect(validateSave(makeSave(null,legacy,null)).match?.winProbabilityVersion).toBeUndefined();
 const invalid={...modern,winProbabilityVersion:'unknown'};expect(()=>validateSave(makeSave(null,invalid as typeof modern,null))).toThrow('未知胜率模型版本');
});

it('新局手枪局使用校准概率；旧局及旧引擎仍使用原公式',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,1);autoVeto(s);const r=resolveRound(s),ct=r.sides[0]==='CT'?0:1;
 const current=preRoundCtWin(r.initial,ct,s,r),legacy=preRoundCtWin(r.initial,ct);
 expect(current).toBeGreaterThan(.55);expect(legacy).toBeLessThan(.3);
 expect(winCurve(r,ct,s)[0].p).toBe(current);
 expect(preRoundCtWin(r.initial,ct,{engineVersion:'causal-plans-v6'},r)).toBe(legacy);
 expect(preRoundCtWin(r.initial,ct,{...s,engineVersion:'causal-plans-v5'},r)).toBe(legacy);
});

it('独立种子的七图手枪局校准优于旧模型',()=>{
 let before=0,after=0,n=0;
 for(const map of MAPS)for(let seed=920001;seed<920013;seed++){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);s.maps=[map.id];s.mapStates=[newMapState(s,map.id,seed%2?'T':'CT')];
  const r=resolveRound(s),ct=r.sides[0]==='CT'?0:1,y=Number(r.winner===ct);
  before+=(preRoundCtWin(r.initial,ct)-y)**2;after+=(preRoundCtWin(r.initial,ct,s,r)-y)**2;n++;
 }
 expect(n).toBe(84);expect(after).toBeLessThan(before*.75);
},20000);
