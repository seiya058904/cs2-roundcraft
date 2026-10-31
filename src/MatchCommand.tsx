import {useEffect,useRef,useState} from 'react';
import {BattlePlanEditor} from './BattlePlanEditor';
import {PLANNED_ENGINES,STRATEGY_LABELS,type StrategyStyle} from './domain/battlePlan';
import {TACTICS} from './domain/tactics';
import {canTimeout,timeoutAdvice,timeoutRemaining} from './domain/coach';
import {SIDE_LABELS} from './labels';
import {useIndicator} from './motion';
import type {Decision,Series,Side,TeamIndex,GameMap,TimeoutEffect,BuyPolicy} from './domain/types';
type Props={match:Series;side:Side;own:TeamIndex;map:GameMap;decision:Decision;busy:boolean;update:(d:Partial<Decision>)=>void;onRound:(d?:Decision,count?:number)=>void;onBatch:(limit:'map'|'series')=>void;onTimeout:(kind:TimeoutEffect['kind'])=>void};
const BUYS:[BuyPolicy,string,string][]=[['auto','自动','自动计划：按经济纪律选择购买'],['eco','经济局','经济局 · 不购买'],['halfBuy','半起','半起 · 留 $2000'],['forceBuy','强起','强起：用尽现金'],['fullBuy','全起','尽量全起'],['awpPriority','主狙优先','优先主狙']];
export function MatchCommand({match,side,own,map,decision,busy,update,onRound,onBatch,onTimeout}:Props){
 const [timeout,setTimeoutOpen]=useState(false),[sticky,setSticky]=useState(false);const root=useRef<HTMLElement>(null),issued=useRef(false);
 const current=match.mapStates.at(-1)!,disabled=busy||match.status!=='playing';
 useEffect(()=>{if(!root.current)return;const observer=new IntersectionObserver(([entry])=>setSticky(!entry.isIntersecting&&entry.boundingClientRect.bottom<0));observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{issued.current=false;},[match]);
 const execute=()=>{if(disabled||issued.current)return;issued.current=true;onRound(decision);queueMicrotask(()=>{issued.current=false;});};
 const tactics=TACTICS.filter(t=>t.side===side),active=TACTICS.find(t=>t.id===decision.tactic);
 const title=decision.strategy?STRATEGY_LABELS[decision.strategy]:active?.name;
 const planned=PLANNED_ENGINES.includes(match.engineVersion??'');
 const mine=current.fighters.filter(f=>f.team===own),cash=mine.reduce((s,f)=>s+f.cash,0);
 const tacticRef=useIndicator<HTMLDivElement>('button[aria-pressed=true]',[decision.tactic,side,Boolean(decision.strategy)]);
 const buyRef=useIndicator<HTMLDivElement>('button[aria-pressed=true]',[decision.buy]);
 return <>
 <section className={`match-command ${side==='CT'?'side-ct':'side-t'}`} ref={root} aria-label="战术指令">
  <header className="command-heading">
   <h2>战术指令</h2><span className="side-badge">{SIDE_LABELS[side]}</span><span className="command-sub">{match.status==='playing'?`下一回合计划 · 第 ${current.rounds.length+1} 回合`:'比赛已结束'}</span>
   <div className="batch-actions"><button disabled={disabled} onClick={()=>onRound(undefined,3)}>自动 3 回合</button><button disabled={disabled} onClick={()=>onBatch('map')}>模拟整图</button><button disabled={disabled} onClick={()=>onBatch('series')}>模拟 BO{match.bestOf}</button><button className={timeout?'open':''} disabled={busy||!canTimeout(current,own)||match.status!=='playing'} onClick={()=>setTimeoutOpen(v=>!v)}>教练暂停 · {timeoutRemaining(current,own)} 次</button></div>
  </header>
  <fieldset disabled={disabled} className="command-primary"><legend className="sr-only">下一回合配置</legend>
   <div className="tactic-picker" role="group" aria-label="战术方案" ref={tacticRef}><span className="indicator" aria-hidden="true"/>{tactics.map(t=><button type="button" key={t.id} aria-pressed={!decision.strategy&&decision.tactic===t.id} disabled={Boolean(decision.strategy)} title={t.description||t.name} onClick={()=>update({tactic:t.id,strategy:undefined})}>{t.name}</button>)}</div>
   <div className="command-row">
    <div className="buy-control"><span className="control-label">经济策略 <small>队伍现金 ${cash.toLocaleString('en-US')} · 人均 ${Math.round(cash/Math.max(1,mine.length)).toLocaleString('en-US')}</small></span><div className="segmented buy-segmented" role="group" aria-label="经济策略" ref={buyRef}><span className="indicator" aria-hidden="true"/>{BUYS.map(([id,label,hint])=><button type="button" key={id} aria-pressed={decision.buy===id} title={hint} onClick={()=>update({buy:id})}>{label}</button>)}</div></div>
    {planned&&<label className="pool-control">战术池<select aria-label="战术池" value={decision.strategy??''} onChange={e=>update({strategy:(e.target.value||undefined) as StrategyStyle|undefined})}><option value="">使用单个预设</option>{Object.entries(STRATEGY_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
    <button className="primary execute-round" onClick={execute}>执行下一回合 <span>→</span></button>
   </div>
  </fieldset>
  <div className="command-advanced">
   <p className="command-hint">{decision.strategy?`战术池「${STRATEGY_LABELS[decision.strategy]}」：购买后按实际装备选取预设`:<><b>{active?.name}</b>{active?.description?` · ${active.description}`:''}</>}</p>
   {planned&&<BattlePlanEditor decision={decision} side={side} disabled={disabled} onChange={update}/>}
   <details className="command-preferences"><summary>指挥偏好</summary><fieldset disabled={disabled}><label>风险倾向<select value={decision.risk} onChange={e=>update({risk:e.target.value as Decision['risk']})}><option value="balanced">均衡</option><option value="conservative">保守</option><option value="aggressive">激进</option></select></label><label className="checkbox"><input type="checkbox" checked={decision.adaptive} onChange={e=>update({adaptive:e.target.checked})}/>授权指挥根据情报调整</label><p className="fine muted">自动模拟由 AI 接管。战术池按购买后的实际装备选择，同类经济局顺序轮换。</p></fieldset></details>
   <details className="positions command-positions"><summary>五人初始站位与路线</summary><p className="muted fine">近角架点放弃相邻区域视野，等待对手进入本区；不增加武器伤害。</p><fieldset disabled={disabled}>{match.teams[own].startingFive.map(id=><div key={id} className="position-pair"><label>{match.players.find(p=>p.id===id)?.nickname} · 区域<select value={decision.positions?.[id]??''} onChange={e=>update({positions:{...decision.positions,[id]:e.target.value}})}><option value="">战术自动分配</option>{map.zones.filter(z=>z.site!=='neutral').map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label><label>架点方式<select value={decision.stances?.[id]??''} onChange={e=>{const stances={...decision.stances};if(e.target.value)stances[id]=e.target.value as 'close'|'standard';else delete stances[id];update({stances});}}><option value="">由战术决定</option><option value="close">掩体近角 · 放弃远处视野</option><option value="standard">常规枪线 · 保持区域视野</option></select></label></div>)}</fieldset></details>
  </div>
  {timeout&&canTimeout(current,own)&&<div className="timeout-options"><h3>暂停建议 · 三选一</h3><div className="timeout-grid">{timeoutAdvice(current,own).map(advice=><button key={advice.kind} onClick={()=>{onTimeout(advice.kind);setTimeoutOpen(false);}}><b>{advice.title}</b><small>{advice.reason}</small><span>{advice.description}</span></button>)}</div></div>}
  {(disabled||!canTimeout(current,own))&&<p className="command-status" role="status">{busy?'后台模拟进行中，可使用上方“停止模拟”安全结束。':match.status!=='playing'?'本系列赛已结束，请结算或新开比赛。':'本回合已暂停或暂停次数已用完。'}</p>}
 </section>
 {sticky&&<div className={`sticky-command ${side==='CT'?'side-ct':'side-t'}`} aria-label="快捷指挥"><span><b>{SIDE_LABELS[side]}</b> / {title}</span><button className="primary" disabled={disabled} onClick={execute}>快捷执行下一回合 <span>→</span></button></div>}
 </>;
}
