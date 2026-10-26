import type {Decision,Side,RoundResult} from './domain/types';
import {STRATEGY_LABELS,ECONOMY_LABELS,type PhaseOverrides} from './domain/battlePlan';
const labels:Record<keyof PhaseOverrides,string>={smoke:'烟雾处理',utility:'道具节奏',execution:'进攻集结',rotation:'防守轮转',postPlant:'回防取舍'};
const choices:Record<keyof PhaseOverrides,Record<string,string>>={
 smoke:{respect:'等待烟散 · 时间紧迫时推进',cross:'直接穿越 · 承担烟中风险'},
 utility:{normal:'接触后正常使用',reserve:'保留至执行、下包或近点交火'},
 execution:{direct:'按原定节奏推进',regroup:'等待多数队员就位 · 最多额外 8 秒'},
 rotation:{anchor:'依据信息支援 · 留守弱侧',hold:'下包前保持当前防区'},
 postPlant:{save:'人数悬殊时考虑保枪',retake:'尽力回防 · 时间不够仍保枪',clear:'先清人后拆包 · 可能错过拆包窗口'}
};
export function BattlePlanEditor({decision,side,disabled,onChange}:{decision:Decision;side:Side;disabled:boolean;onChange:(d:Partial<Decision>)=>void}){
 const fields:(keyof PhaseOverrides)[]=side==='T'?['smoke','utility','execution']:['smoke','utility','rotation','postPlant'];
 return <fieldset className="battle-plan-editor" disabled={disabled}><legend className="sr-only">阶段规则</legend>
 <details className="positions"><summary>阶段调整{decision.phases&&Object.keys(decision.phases).length?' · 已自定义':''}</summary>
 <div className="phase-fields">{fields.map(key=><label key={key}>{labels[key]}<select aria-label={labels[key]} value={decision.phases?.[key]??''} onChange={e=>{const phases={...decision.phases};if(e.target.value)Object.assign(phases,{[key]:e.target.value});else delete phases[key];onChange({phases});}}><option value="">跟随预设</option>{Object.entries(choices[key]).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>)}</div>
 <button type="button" onClick={()=>onChange({phases:undefined})}>恢复预设阶段规则</button><p className="fine muted">紧迫计时优先于等待；暂停重点部署优先于战术池。换边时清除阶段调整。</p>
 </details></fieldset>;
}
export function BattlePlanReview({round,names}:{round:RoundResult;names:string[]}){
 if(!round.plans)return null;
 return <details className="positions"><summary>本回合实际计划与执行记录</summary>{round.plans.map((plan,i)=><div key={i}><h4>{names[i]} · {ECONOMY_LABELS[plan.economy]}</h4><p className="fine muted">{plan.strategy?STRATEGY_LABELS[plan.strategy]:'单个预设'} · 规则版本 {plan.version}</p>{(['smoke','utility',...(plan.side==='T'?['execution']:['rotation','postPlant'])] as (keyof PhaseOverrides)[]).map(key=><p key={key}>{labels[key]}：{choices[key][plan[key]]}</p>)}</div>)}<ol>{round.events.filter(e=>e.kind==='tactic'&&e.detail.rule).map(e=><li key={e.id}>{e.at} 秒 · {names[e.team!]} · {String(e.detail.reason)}</li>)}</ol></details>;
}
