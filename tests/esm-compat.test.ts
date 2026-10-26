import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import frozen from '../docs/esm-review/legacy-fingerprints.json';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {validateSeries} from '../src/domain/saveValidation';
import {defaultDecision} from '../src/domain/tactics';
import {chooseAI} from '../src/domain/tactics';
import {Random} from '../src/domain/random';
it.each(frozen)('旧版本 $version seed=$seed 全部事件与存档字节保持一致',row=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,row.seed);
 if(row.version==='legacy')delete s.engineVersion;else s.engineVersion=row.version;
 autoVeto(s);simulateSeries(s);
 expect(createHash('sha256').update(JSON.stringify(s)).digest('hex')).toBe(row.hash);
});
it('新计划随回合冻结，存档恢复不改变后续策略轮换',()=>{
 const a=createSeries(newWorld(),'team-3','team-7',1,622);autoVeto(a);
 const side=a.mapStates[0].startSide;const d={...defaultDecision(side),strategy:'patient' as const};
 resolveRound(a,{0:d});const b=JSON.parse(JSON.stringify(a));
 expect(a.mapStates[0].rounds[0].plans?.[0].strategy).toBe('patient');
 expect(()=>validateSeries(b)).not.toThrow();
 expect(resolveRound(a,{0:d})).toEqual(resolveRound(b,{0:d}));
 b.mapStates[0].rounds[0].plans[0].smoke='unsafe';expect(()=>validateSeries(b)).toThrow();
});
it('非法阶段指令在购买前拒绝，不损坏状态',()=>{
 const a=createSeries(newWorld(),'team-3','team-7',1,111);autoVeto(a);const before=JSON.stringify(a);
 const side=a.mapStates[0].startSide;
 expect(()=>resolveRound(a,{0:{...defaultDecision(side),phases:{postPlant:side==='T'?'clear':'hold'}}})).toThrow();
 expect(JSON.stringify(a)).toBe(before);
});
it('AI 不读取未被观察到的对手预设',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,720);autoVeto(s);
 for(let i=0;i<5;i++)resolveRound(s);
 const a=structuredClone(s.mapStates[0]),b=structuredClone(a);
 for(const r of a.rounds){r.decisions[0].tactic='fastA';r.events=[];}
 for(const r of b.rounds){r.decisions[0].tactic='fastB';r.events=[];}
 for(let seed=1;seed<=20;seed++)expect(chooseAI(s.teams[1],1,a,'CT',new Random(seed),true)).toEqual(chooseAI(s.teams[1],1,b,'CT',new Random(seed),true));
});
it('新版本同秒解说按事实锚点顺序呈现',()=>{
 const s=createSeries(newWorld(),'team-3','team-7',1,732);autoVeto(s);simulateSeries(s);
 for(const r of s.mapStates[0].rounds){
  let previous=-1;
  for(const segment of r.commentary){
   const anchor=Math.max(...segment.eventIds.map(id=>r.events.findIndex(e=>e.id===id)));
   expect(anchor).toBeGreaterThanOrEqual(previous);previous=anchor;
  }
 }
});
