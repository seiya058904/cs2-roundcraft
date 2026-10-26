import type {BuyPolicy,Decision,EconomyEntry,Fighter,RoundResult,Side} from './types';
import {WEAPONS} from './economy';
import {getTactic} from './tactics';

export const BATTLE_ENGINE='causal-plans-v4';
export const ECONOMY_LABELS={pistol:'手枪局',full:'全起',semi:'半起',force:'强起',eco:'经济局'};
export type EconomyClass=keyof typeof ECONOMY_LABELS;
export type StrategyStyle='balanced'|'pressure'|'patient';
export const STRATEGY_LABELS={balanced:'均衡轮换',pressure:'主动施压',patient:'稳健控制'};
export interface PhaseOverrides {
 smoke?:'respect'|'cross';
 utility?:'normal'|'reserve';
 execution?:'direct'|'regroup';
 rotation?:'anchor'|'hold';
 postPlant?:'hold'|'retake'|'save'|'clear';
}
export interface BattlePlan {
 version:'plans-1';side:Side;economy:EconomyClass;tactic:string;strategy?:StrategyStyle;slot?:number;
 smoke:'respect'|'cross';utility:'normal'|'reserve';execution:'direct'|'regroup';rotation:'anchor'|'hold';
 postPlant:NonNullable<PhaseOverrides['postPlant']>;
}
export function validatePlanInput(d:Decision,side:Side){
 if(d.strategy!==undefined&&!Object.hasOwn(STRATEGY_LABELS,d.strategy))throw new Error('未知经济策略');
 const options:Record<string,string[]>={smoke:['respect','cross'],utility:['normal','reserve'],execution:['direct','regroup'],rotation:['anchor','hold'],postPlant:side==='T'?['hold']:['retake','save','clear']};
 if(d.phases!==undefined){
  if(!d.phases||typeof d.phases!=='object'||Array.isArray(d.phases))throw new Error('阶段配置错误');
  for(const [key,value] of Object.entries(d.phases))if(!options[key]?.includes(value as string)||(key==='execution'&&side!=='T')||(key==='rotation'&&side!=='CT'))throw new Error('阶段规则与阵营不兼容');
 }
}
/** Classify actual post-donation equipment, not the label of an unaffordable purchase. */
export function classifyEconomy(round:number,policy:BuyPolicy,fighters:Fighter[],book:EconomyEntry[]):EconomyClass{
 if(round===1||round===13)return 'pistol';
 if(fighters.filter(f=>['rifle','awp'].includes(WEAPONS[f.equipment.weapon].category)&&f.equipment.armor>=50).length>=4)return 'full';
 if(policy==='forceBuy')return 'force';
 if(policy==='eco')return 'eco';
 const spend=book.filter(b=>fighters.some(f=>f.id===b.playerId)).reduce((sum,b)=>sum+b.spend,0);
 return spend<=fighters.length*1000?'eco':'semi';
}
const pools:Record<Side,Record<EconomyClass,string[]>>={
 T:{pistol:['fastA','splitB'],full:['splitA','fakeB','slowB'],semi:['contact','splitB'],force:['fastB','fastA'],eco:['contact','lurk']},
 CT:{pistol:['standard','stackB'],full:['standard','earlyInfo','fastRotate'],semi:['passive','stackA'],force:['stackB','aggressionA'],eco:['passive','stackB']}
};
export function resolveBattlePlan(d:Decision,side:Side,economy:EconomyClass,history:RoundResult[],team:0|1,positionTimeout:boolean):BattlePlan{
 validatePlanInput(d,side);
 let slot:number|undefined;
 if(d.strategy&&!positionTimeout){
  const pool=[...pools[side][economy]];
  if(d.strategy==='pressure'&&economy==='full')pool.splice(0,pool.length,...(side==='T'?['fastA','fastB','splitA']:['earlyInfo','aggressionB','standard']));
  if(d.strategy==='patient'&&economy==='full')pool.splice(0,pool.length,...(side==='T'?['slowA','slowB','fakeA']:['passive','standard','retake']));
  slot=history.filter(r=>r.plans?.[team].strategy===d.strategy&&r.plans?.[team].economy===economy&&r.sides[team]===side).length%pool.length;
  d.tactic=pool[slot];
 }
 const t=getTactic(d.tactic);
 const plan:BattlePlan={version:'plans-1',side,economy,tactic:d.tactic,
  smoke:t.pace<=8&&side==='T'?'cross':'respect',utility:t.id==='contact'||t.id==='passive'?'reserve':'normal',
  execution:t.split?'regroup':'direct',rotation:t.id==='passive'?'hold':'anchor',postPlant:side==='T'?'hold':t.id==='retake'?'retake':'save',...d.phases};
 if(d.strategy&&!positionTimeout){plan.strategy=d.strategy;plan.slot=slot;}
 return plan;
}
export function validateStoredPlan(plan:BattlePlan,side:Side){
 if(!plan||plan.version!=='plans-1'||plan.side!==side||!Object.hasOwn(ECONOMY_LABELS,plan.economy)||getTactic(plan.tactic).side!==side)throw new Error('回合计划错误');
 validatePlanInput({tactic:plan.tactic,buy:'auto',risk:'balanced',adaptive:true,strategy:plan.strategy,phases:{smoke:plan.smoke,utility:plan.utility,...(side==='T'?{execution:plan.execution}:{rotation:plan.rotation}),postPlant:plan.postPlant}},side);
 if(!['direct','regroup'].includes(plan.execution)||!['anchor','hold'].includes(plan.rotation))throw new Error('阶段计划缺少默认值');
 if(plan.slot!==undefined&&(!Number.isInteger(plan.slot)||plan.slot<0||plan.slot>2))throw new Error('策略位置错误');
}

/** Project-owned semantics. The reference proves rule names, not these thresholds. */
export const REGROUP_GRACE_SECONDS=8;
export function shouldWaitForSmoke(expires:number,now:number,remaining:number,travel:number){
 return expires>now && remaining>expires-now+travel;
}
export function regroupReady(alive:number,staged:number,now:number,executeAt:number,remaining:number,travel:number){
 return staged>=Math.ceil(alive*.6)||now>=executeAt+REGROUP_GRACE_SECONDS||remaining<=travel;
}
export function shouldReserveUtility(mode:BattlePlan['utility'],side:Side,executing:boolean,planted:boolean,sameZoneThreat:boolean){
 return mode==='reserve'&&!sameZoneThreat&&(side==='T'?!executing:!planted);
}
export function shouldSave(plan:BattlePlan['postPlant'],remaining:number,required:number,hopeless:boolean){
 return remaining<=required||(plan==='save'&&hopeless);
}
