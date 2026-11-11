import {useEffect,useRef,useState} from 'react';
import {BattlePlanEditor} from './BattlePlanEditor';
import {PLANNED_ENGINES,STRATEGY_LABELS,type StrategyStyle} from './domain/battlePlan';
import {TACTICS,defaultDecision} from './domain/tactics';
import {canTimeout,timeoutAdvice,timeoutRemaining} from './domain/coach';
import {equipmentValue} from './domain/insights';
import {SIDE_LABELS} from './labels';
import {useIndicator} from './motion';
import type {Decision,Series,Side,TeamIndex,GameMap,TimeoutEffect,BuyPolicy} from './domain/types';

/** Command modes: hand the round to the coach AI, pick a style, or open the full manual controls. */
export type CommandMode='auto'|'patient'|'balanced'|'pressure'|'manual';
export const COMMAND_MODES:[CommandMode,string,string][]=[
 ['auto','托管','教练 AI 每回合自己选战术与购买'],
 ['patient','稳健','稳健控制：慢节奏、少冒险，经济自动'],
 ['balanced','均衡','均衡轮换：攻守节奏均衡，经济自动'],
 ['pressure','激进','主动施压：快节奏、抢先手，经济自动'],
 ['manual','手动','逐项设置战术、经济、阶段规则与站位'],
];
const STYLE_RISK:Record<StrategyStyle,Decision['risk']>={patient:'conservative',balanced:'balanced',pressure:'aggressive'};
/** The decision a mode sends to the engine; `undefined` lets the coach AI decide. Pure and explicit, so seeds stay reproducible. */
export function decisionForMode(mode:CommandMode,manual:Decision,side:Side,planned:boolean):Decision|undefined{
 if(mode==='manual')return manual;
 if(mode==='auto')return undefined;
 return {...defaultDecision(side),risk:STYLE_RISK[mode],...(planned?{strategy:mode}:{})};
}
export function loadCommandMode():CommandMode{try{const v=localStorage.getItem('ctm-command-mode');return COMMAND_MODES.some(([id])=>id===v)?v as CommandMode:'balanced';}catch{return 'balanced';}}

const BUYS:[BuyPolicy,string,string][]=[['auto','自动','自动计划：按经济纪律选择购买'],['eco','经济局','经济局 · 不购买'],['halfBuy','半起','半起 · 留 $2000'],['forceBuy','强起','强起：用尽现金'],['fullBuy','全起','尽量全起'],['awpPriority','主狙优先','优先主狙']];
type Props={match:Series;side:Side;own:TeamIndex;map:GameMap;decision:Decision;busy:boolean;conceal:boolean;mode:CommandMode;onMode:(mode:CommandMode)=>void;autoplay:boolean;onAutoplay:(on:boolean)=>void;autoplayNote?:string;update:(d:Partial<Decision>)=>void;onExecute:()=>void;onRound:(d?:Decision,count?:number)=>void;onBatch:(limit:'map'|'series')=>void;onTimeout:(kind:TimeoutEffect['kind'])=>void};
export function MatchCommand({match,side,own,map,decision,busy,conceal,mode,onMode,autoplay,onAutoplay,autoplayNote,update,onExecute,onRound,onBatch,onTimeout}:Props){
 const [timeout,setTimeoutOpen]=useState(false),[sticky,setSticky]=useState(false),[drawer,setDrawer]=useState(true);const root=useRef<HTMLElement>(null),issued=useRef(false);
 const current=match.mapStates.at(-1)!,disabled=busy||(!conceal&&match.status!=='playing');
 useEffect(()=>{if(!root.current)return;const observer=new IntersectionObserver(([entry])=>setSticky(!entry.isIntersecting&&entry.boundingClientRect.bottom<0));observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{issued.current=false;},[match]);
 const execute=()=>{if(disabled||issued.current)return;issued.current=true;setDrawer(false);onExecute();queueMicrotask(()=>{issued.current=false;});};
 const tactics=TACTICS.filter(t=>t.side===side),active=TACTICS.find(t=>t.id===decision.tactic);
 const planned=PLANNED_ENGINES.includes(match.engineVersion??'');
 const mine=current.fighters.filter(f=>f.team===own),cash=mine.reduce((s,f)=>s+f.cash,0);
 const modeLabel=COMMAND_MODES.find(([id])=>id===mode)!;
 const title=mode==='manual'?(decision.strategy?STRATEGY_LABELS[decision.strategy]:active?.name):modeLabel[1];
 // Cash plus carried gear per player, on the same thresholds as the post-round economy outlook.
 const nextRound=current.rounds.length+1,budget=mine.reduce((s,f)=>s+f.cash+equipmentValue(f),0)/Math.max(1,mine.length);
 const expected=nextRound===1||nextRound===13?'手枪局':budget>=4300?'可以全起':budget>=3000?'只够强起':budget>=2000?'半起或保存':'大概率经济局';
 const modeRef=useIndicator<HTMLDivElement>('button[aria-pressed=true]',[mode]);
 const tacticRef=useIndicator<HTMLDivElement>('button[aria-pressed=true]',[decision.tactic,side,Boolean(decision.strategy),mode]);
 const buyRef=useIndicator<HTMLDivElement>('button[aria-pressed=true]',[decision.buy,mode]);
 return <>
 <section className={`match-command ${side==='CT'?'side-ct':'side-t'} ${mode==='manual'?'is-manual':''}`} ref={root} aria-label="战术指令">
  <header className="command-heading">
   <h2>战术指令</h2><span className="side-badge">{conceal?'待揭示':SIDE_LABELS[side]}</span><span className="command-sub">{conceal?'回看期间不显示后续结算':match.status==='playing'?`下一回合 · 第 ${current.rounds.length+1} 回合`:'比赛已结束'}</span>
   <div className="batch-actions"><button disabled={disabled} onClick={()=>onRound(undefined,3)}>自动 3 回合</button><button disabled={disabled} onClick={()=>onBatch('map')}>模拟整图</button><button disabled={disabled} onClick={()=>onBatch('series')}>模拟 BO{match.bestOf}</button><button className={timeout?'open':''} disabled={conceal||busy||!canTimeout(current,own)||match.status!=='playing'} onClick={()=>{setTimeoutOpen(v=>!v);onAutoplay(false);}}>教练暂停 · {conceal?'待揭示':`${timeoutRemaining(current,own)} 次`}</button></div>
  </header>
  <div className="command-bar">
   <div className="mode-picker segmented" role="group" aria-label="指挥档位" ref={modeRef}><span className="indicator" aria-hidden="true"/>{COMMAND_MODES.map(([id,label,hint])=><button type="button" key={id} aria-pressed={mode===id} title={hint} disabled={disabled} onClick={()=>{onMode(id);if(id==='manual')setDrawer(true);}}>{label}</button>)}</div>
   <p className="command-hint" aria-live="polite">{mode==='manual'?<><b>{title}</b>{decision.strategy?' · 购买后按装备选取预设':active?.description?` · ${active.description}`:''}</>:<><b>{modeLabel[1]}</b> · {modeLabel[2]}{conceal?' · 经济在回合揭示后显示':` · 队伍现金 $${cash.toLocaleString('en-US')} · ${expected}`}</>}</p>
   {mode==='manual'&&<button type="button" className="ghost drawer-toggle" aria-expanded={drawer} onClick={()=>setDrawer(v=>!v)}>{drawer?'收起手动设置':'展开手动设置'}</button>}
   <label className={`autoplay-toggle ${autoplay?'on':''}`} title="解说播完后按当前档位自动开下一回合；需要你选边、叫暂停或比赛结束时自动停下"><input type="checkbox" role="switch" checked={autoplay} disabled={disabled} onChange={e=>onAutoplay(e.target.checked)}/><span aria-hidden="true"/>连播</label>
   <button className="primary execute-round" disabled={disabled} onClick={execute}>执行下一回合 <span>→</span></button>
  </div>
  {autoplay&&autoplayNote&&<p className="command-status autoplay-note" role="status">{autoplayNote}</p>}
  {mode==='manual'&&drawer&&<div className="command-manual">
   <fieldset disabled={disabled} className="command-primary"><legend className="sr-only">下一回合配置</legend>
    <div className="tactic-picker" role="group" aria-label="战术方案" ref={tacticRef}><span className="indicator" aria-hidden="true"/>{tactics.map(t=><button type="button" key={t.id} aria-pressed={!decision.strategy&&decision.tactic===t.id} disabled={Boolean(decision.strategy)} title={t.description||t.name} onClick={()=>update({tactic:t.id,strategy:undefined})}>{t.name}</button>)}</div>
    <div className="command-row">
     <div className="buy-control"><span className="control-label">经济策略 <small>{conceal?'经济在回合揭示后显示':`队伍现金 $${cash.toLocaleString('en-US')} · 人均 $${Math.round(cash/Math.max(1,mine.length)).toLocaleString('en-US')}`}</small></span><div className="segmented buy-segmented" role="group" aria-label="经济策略" ref={buyRef}><span className="indicator" aria-hidden="true"/>{BUYS.map(([id,label,hint])=><button type="button" key={id} aria-pressed={decision.buy===id} title={hint} onClick={()=>update({buy:id})}>{label}</button>)}</div></div>
     {planned&&<label className="pool-control">战术池<select aria-label="战术池" value={decision.strategy??''} onChange={e=>update({strategy:(e.target.value||undefined) as StrategyStyle|undefined})}><option value="">使用单个预设</option>{Object.entries(STRATEGY_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
    </div>
   </fieldset>
   <div className="command-advanced">
    {planned&&<BattlePlanEditor decision={decision} side={side} disabled={disabled} onChange={update}/>}
    <details className="command-preferences"><summary>指挥偏好</summary><fieldset disabled={disabled}><label>风险倾向<select value={decision.risk} onChange={e=>update({risk:e.target.value as Decision['risk']})}><option value="balanced">均衡</option><option value="conservative">保守</option><option value="aggressive">激进</option></select></label><label className="checkbox"><input type="checkbox" checked={decision.adaptive} onChange={e=>update({adaptive:e.target.checked})}/>授权指挥根据情报调整</label><p className="fine muted">自动模拟由 AI 接管。战术池按购买后的实际装备选择，同类经济局顺序轮换。</p></fieldset></details>
    <details className="positions command-positions"><summary>五人初始站位与路线</summary><p className="muted fine">近角架点放弃相邻区域视野，等待对手进入本区；不增加武器伤害。</p><fieldset disabled={disabled}>{match.teams[own].startingFive.map(id=><div key={id} className="position-pair"><label>{match.players.find(p=>p.id===id)?.nickname} · 区域<select value={decision.positions?.[id]??''} onChange={e=>update({positions:{...decision.positions,[id]:e.target.value}})}><option value="">战术自动分配</option>{map.zones.filter(z=>z.site!=='neutral').map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label><label>架点方式<select value={decision.stances?.[id]??''} onChange={e=>{const stances={...decision.stances};if(e.target.value)stances[id]=e.target.value as 'close'|'standard';else delete stances[id];update({stances});}}><option value="">由战术决定</option><option value="close">掩体近角 · 放弃远处视野</option><option value="standard">常规枪线 · 保持区域视野</option></select></label></div>)}</fieldset></details>
   </div>
  </div>}
  {!conceal&&timeout&&canTimeout(current,own)&&<div className="timeout-options"><h3>暂停建议 · 三选一</h3><div className="timeout-grid">{timeoutAdvice(current,own).map(advice=><button key={advice.kind} onClick={()=>{onTimeout(advice.kind);setTimeoutOpen(false);}}><b>{advice.title}</b><small>{advice.reason}</small><span>{advice.description}</span></button>)}</div></div>}
  {!conceal&&(disabled||!canTimeout(current,own))&&<p className="command-status" role="status">{busy?'后台模拟进行中，可使用上方“停止模拟”安全结束。':match.status!=='playing'?'本系列赛已结束，请结算或新开比赛。':'本回合已暂停或暂停次数已用完。'}</p>}
 </section>
 {sticky&&<div className={`sticky-command ${side==='CT'?'side-ct':'side-t'}`} aria-label="快捷指挥"><span><b>{conceal?'待揭示':SIDE_LABELS[side]}</b> / {title}</span><button className="primary" disabled={disabled} onClick={execute}>快捷执行下一回合 <span>→</span></button></div>}
 </>;
}
