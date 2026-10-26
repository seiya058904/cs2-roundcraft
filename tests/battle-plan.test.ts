import {expect,it} from 'vitest';
import {defaultDecision} from '../src/domain/tactics';
import {resolveBattlePlan,validatePlanInput,regroupReady,shouldWaitForSmoke,shouldReserveUtility,shouldSave} from '../src/domain/battlePlan';

it('规则条件以时间和实际局势为准，紧急条件覆盖等待与保留',()=>{
 expect(shouldWaitForSmoke(35,20,90,12)).toBe(true);
 expect(shouldWaitForSmoke(35,20,20,12)).toBe(false);
 expect(shouldWaitForSmoke(20,20,90,12)).toBe(false);
 expect(regroupReady(5,2,30,30,80,15)).toBe(false);
 expect(regroupReady(5,3,30,30,80,15)).toBe(true);
 expect(regroupReady(5,2,38,30,72,15)).toBe(true);
 expect(regroupReady(5,2,30,30,15,15)).toBe(true);
 expect(shouldReserveUtility('reserve','T',false,false,false)).toBe(true);
 expect(shouldReserveUtility('reserve','T',false,false,true)).toBe(false);
 expect(shouldReserveUtility('reserve','CT',false,true,false)).toBe(false);
 expect(shouldSave('retake',30,15,true)).toBe(false);
 expect(shouldSave('retake',15,15,false)).toBe(true);
 expect(shouldSave('save',30,15,true)).toBe(true);
});
it('显式阶段调整覆盖预设，暂停站位覆盖策略轮换',()=>{
 const d={...defaultDecision('T'),strategy:'patient' as const,phases:{execution:'direct' as const}};
 const p=resolveBattlePlan(d,'T','full',[],0,false);
 expect(p.tactic).toBe('slowA');expect(p.execution).toBe('direct');
 d.tactic='splitB';const paused=resolveBattlePlan(d,'T','full',[],0,true);
 expect(paused.tactic).toBe('splitB');expect(paused.strategy).toBeUndefined();
});
it('拒绝不支持的条件与跨阵营拆包设置',()=>{
 expect(()=>validatePlanInput({...defaultDecision('T'),phases:{postPlant:'retake'}},'T')).toThrow();
 expect(()=>validatePlanInput({...defaultDecision('CT'),phases:{postPlant:'hold'}},'CT')).toThrow();
});
