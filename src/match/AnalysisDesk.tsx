import {useMemo} from 'react';
import type {RoundResult,Series,TeamIndex} from '../domain/types';
import {aggregateStats} from '../domain/statistics';
import {playerForm,rivalries} from '../domain/insights';
import {deskSummary,type TeamDesk} from './analysis';

const ROWS:[string,(t:TeamDesk)=>number,(t:TeamDesk)=>string][]=[
 ['回合',t=>t.won,t=>`${t.won}`],
 ['首杀',t=>t.openings,t=>`${t.openings}`],
 ['下包转化',t=>t.plantWins,t=>t.plants?`${t.plantWins}/${t.plants}`:'0'],
 ['回防拆包',t=>t.retakes,t=>`${t.retakes}`],
 ['残局胜',t=>t.clutches,t=>`${t.clutches}`],
 ['多杀',t=>t.multiKills,t=>`${t.multiKills}`],
 ['以弱胜强',t=>t.ecoUpsets,t=>`${t.ecoUpsets}`],
 ['手枪局',t=>t.pistols,t=>`${t.pistols}`],
];

/** Momentum: one bar per settled round (up = own team) with the running score gap as a line. */
function Momentum({momentum,own,names}:{momentum:number[];own:TeamIndex;names:readonly string[]}){
 if(!momentum.length)return <p className="desk-empty">本图还没有结束的回合。</p>;
 // A regulation map (24 rounds) sets the scale, so early bars keep their width and the chart fills as rounds settle.
 const slots=Math.max(24,momentum.length),step=12,W=slots*step,H=96,mid=H/2,peak=Math.max(3,...momentum.map(Math.abs));
 const y=(v:number)=>mid-v/peak*(mid-8);
 const line=momentum.map((v,i)=>`${i?'L':'M'}${(i*step+step/2).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
 const last=momentum.at(-1)!;
 return <figure className="momentum">
  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`本图走势：${last>0?`${names[own]}领先 ${last} 分`:last<0?`${names[1-own]}领先 ${-last} 分`:'比分持平'}`}>
   <line x1="0" x2={W} y1={mid} y2={mid} className="axis"/>
   {momentum.map((v,i)=>{const up=i===0?v>0:v>momentum[i-1];return <rect key={i} className={up?'up':'down'} x={i*step+step*.2} width={step*.6} y={up?mid-10:mid} height="10" rx="1.5"/>;})}
   {momentum.some((_,i)=>i===11)&&<line className="half" x1={12*step} x2={12*step} y1="4" y2={H-4}/>}
   <path d={line} className="trend" vectorEffect="non-scaling-stroke"/>
  </svg>
  <figcaption><span className="own">{names[own]}</span><b>{last>0?`+${last}`:last}</b><span className="enemy">{names[1-own]}</span></figcaption>
 </figure>;
}

export function AnalysisDesk({match,own,mapRounds,seriesRounds,nick}:{match:Series;own:TeamIndex;mapRounds:readonly RoundResult[];seriesRounds:readonly RoundResult[];nick:(id?:string)=>string}){
 const enemy=(1-own) as TeamIndex,names=match.teams.map(t=>t.name);
 const desk=useMemo(()=>deskSummary(mapRounds,own),[mapRounds,own]);
 const leaders=useMemo(()=>aggregateStats([...mapRounds]).filter(p=>p.rounds).sort((a,b)=>b.rating-a.rating).slice(0,3),[mapRounds]);
 const hot=useMemo(()=>mapRounds.length?mapRounds.at(-1)!.initial.map(f=>({id:f.id,team:f.team,form:playerForm(mapRounds,f.id)})).filter(x=>x.form.form==='hot').sort((a,b)=>b.form.score-a.form.score).slice(0,2):[],[mapRounds]);
 const rivals=useMemo(()=>rivalries({rounds:[...mapRounds]}).slice(0,2),[mapRounds]);
 const series=useMemo(()=>aggregateStats([...seriesRounds]).sort((a,b)=>b.rating-a.rating),[seriesRounds]);
 const teamOf=(id:string)=>mapRounds.at(-1)?.initial.find(f=>f.id===id)?.team;
 return <div className="analysis-desk">
  <section className="desk-block"><h3>本图走势 <small>柱 = 单回合胜负 · 线 = 累计分差</small></h3><Momentum momentum={desk.momentum} own={own} names={names}/>
   {desk.longestRun&&desk.longestRun.length>=3&&<p className="desk-note">最长连胜：{names[desk.longestRun.team]} {desk.longestRun.length} 连</p>}</section>
  <section className="desk-block"><h3>攻防对比 <small>{names[own]} / {names[enemy]}</small></h3>
   <div className="desk-rows">{ROWS.map(([label,value,text])=>{const a=value(desk.teams[own]),b=value(desk.teams[enemy]),total=Math.max(1,a+b);
    return <div className="desk-row" key={label}><b>{text(desk.teams[own])}</b><span className="desk-bar" aria-hidden="true"><i className="own" style={{width:`${a/total*100}%`}}/><i className="enemy" style={{width:`${b/total*100}%`}}/></span><b>{text(desk.teams[enemy])}</b><small>{label}</small></div>;})}</div></section>
  <section className="desk-block"><h3>本图表现</h3>
   {leaders.length?<ol className="desk-leaders">{leaders.map((p,i)=><li key={p.id} className={teamOf(p.id)===own?'by-own':'by-enemy'}><span>{i+1}</span><b>{nick(p.id)}</b><small>{p.kills}-{p.deaths} · ADR {p.adr.toFixed(0)}</small><em className={`rating ${p.rating>=1.15?'high':p.rating<.9?'low':''}`}>{p.rating.toFixed(2)}</em></li>)}</ol>:<p className="desk-empty">打完第一回合后出现。</p>}
   {(hot.length>0||rivals.length>0)&&<ul className="desk-notes">{hot.map(h=><li key={h.id}><b>手感火热</b>{nick(h.id)} 近五回合 {h.form.kills} 杀</li>)}{rivals.map(r=><li key={r.killer+r.victim}><b>宿敌</b>{nick(r.killer)} 已经 {r.kills} 次带走 {nick(r.victim)}</li>)}</ul>}
  </section>
  <details className="desk-block statistics-disclosure"><summary>系列技术统计</summary><p className="fine muted">CTM Rating 2.0 为公开近似公式计算的游戏指标，非 HLTV 官方评分</p><div className="table-scroll" tabIndex={0}><table className="stats-table"><thead><tr><th>选手</th><th>击杀</th><th>死亡</th><th>助攻</th><th>场均回合伤害</th><th>回合贡献率</th><th>首杀</th><th>残局胜</th><th>Rating 2.0</th></tr></thead><tbody>{series.map((p,i)=><tr key={p.id} className={i===0&&p.rounds?'top-row':''}><th>{nick(p.id)}</th><td>{p.kills}</td><td>{p.deaths}</td><td>{p.assists}</td><td>{p.adr.toFixed(1)}</td><td>{p.kast.toFixed(0)}%</td><td>{p.openingKills}</td><td>{p.clutchWins}</td><td><span className={`rating ${p.rating>=1.15?'high':p.rating<.9?'low':''}`}>{p.rating.toFixed(2)}</span></td></tr>)}</tbody></table></div></details>
 </div>;
}
