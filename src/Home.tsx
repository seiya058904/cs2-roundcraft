import {useEffect,useState} from 'react';
import type {World,Team} from './domain/types';
import type {Career} from './domain/career';
import {Panel,TeamSelect} from './ui';
import {useTweenNumber} from './motion';
import templates from './data/commentary.json';

/** Counts up from zero once on mount (instant when motion is off). */
export function CountUp({value,format=(n:number)=>Math.round(n).toLocaleString('en-US')}:{value:number;format?:(n:number)=>string}){
 const [target,setTarget]=useState(0);useEffect(()=>{setTarget(value);},[value]);
 return <>{format(useTweenNumber(target,1.1))}</>;
}
const DYNAMICS:[keyof Team['dynamics'],string][]=[['chemistry','阵容默契'],['execution','战术执行'],['communication','信息沟通'],['adaptability','临场调整'],['economyDiscipline','经济纪律']];
function Matchup({a,b}:{a:Team;b:Team}){
 return <div className="matchup" aria-label={`${a.name} 对 ${b.name} 团队能力对比`}>
  <div className="matchup-head"><div className="side-t"><small>#{a.initialRank} · VRS {a.initialVrsPoints}</small><b>{a.name}</b></div><span className="versus">VS</span><div className="side-ct"><small>#{b.initialRank} · VRS {b.initialVrsPoints}</small><b>{b.name}</b></div></div>
  <ul className="matchup-bars">{DYNAMICS.map(([key,label])=>{const x=Number(a.dynamics[key]),y=Number(b.dynamics[key]);return <li key={key}><span className={x>=y?'lead':''}>{x.toFixed(0)}</span><div className="duel-bar" aria-hidden="true"><i style={{transform:`scaleX(${x/100})`}}/><i style={{transform:`scaleX(${y/100})`}}/></div><span className={y>x?'lead':''}>{y.toFixed(0)}</span><small>{label}</small></li>;})}</ul>
 </div>;
}
export function Home({world,career,inMatch,busy,teamChoice,setTeamChoice,onQuickStart,onSandbox,onStartCareer,onEvents,onAbout}:{world:World;career:Career|null;inMatch:boolean;busy:boolean;teamChoice:string;setTeamChoice:(id:string)=>void;onQuickStart:()=>void;onSandbox:()=>void;onStartCareer:()=>void;onEvents:()=>void;onAbout:()=>void}){
 const a=world.teams.find(t=>t.id==='team-3')!,b=world.teams.find(t=>t.id==='team-7')!;
 const ladder=[...world.teams].sort((x,y)=>x.initialRank-y.initialRank).slice(0,8),top=ladder[0]?.initialVrsPoints||1;
 const managed=career?.world.teams.find(t=>t.id===career.managedTeamId);
 return <>
 <header className="page-heading hero">
  <div className="hero-copy">
   <p className="eyebrow">CS2 ROUNDCRAFT · 战术经理</p>
   <h1>每一回合，<br/><span className="accent">都值得一个好决策。</span></h1>
   <p className="intro">接管真实阵容，配置战术、经济与五人站位。<br/>主解说与分析嘉宾按真实事件逐段解说，事件账本复盘每一次选择。</p>
   <div className="button-row"><button className="primary hero-cta" disabled={busy} onClick={onQuickStart}>{inMatch?'返回正在进行的比赛':'快速开赛 · Vitality vs FURIA'} →</button><button onClick={onSandbox}>配置沙盒</button></div>
  </div>
  <div className="hero-card"><p className="hero-card-label">焦点对阵 · 快照数据</p><Matchup a={a} b={b}/></div>
 </header>
 <div className="home-grid">
  <Panel title={career?'继续职业生涯':'接管一支俱乐部'}>{career?<><h3 className="career-team">{managed?.name}</h3><p>赛季 {career.season} · 第 {career.week} 周 · 已完成 {career.calendar.filter(e=>e.status==='finished').length} / {career.calendar.length} 项赛事</p><div className="season-progress" aria-hidden="true"><i style={{transform:`scaleX(${career.calendar.filter(e=>e.status==='finished').length/Math.max(1,career.calendar.length)})`}}/></div><button onClick={onEvents}>进入赛事中心 →</button></>:<><TeamSelect teams={world.teams} value={teamChoice} onChange={setTeamChoice} label="选择起始战队"/><p className="muted">全部 50 支快照队伍可接管；赛事邀请由模拟排名决定。</p><button className="primary" onClick={onStartCareer}>开启职业生涯</button></>}</Panel>
  <Panel title="比赛之前"><div className="facts"><div><strong><CountUp value={50}/></strong><span>真实快照战队</span></div><div><strong><CountUp value={250}/></strong><span>初始选手席位</span></div><div><strong><CountUp value={7}/></strong><span>地图拓扑</span></div><div><strong><CountUp value={templates.length}/></strong><span>原创解说台词</span></div></div><p>能力、团队数值、教练画像与赛历均为游戏建模。历史资料缺口会明确标注，不生成虚构职业履历。</p><button onClick={onAbout}>查看来源与规则</button></Panel>
  <Panel className="ladder-panel" title="VRS 快照前八" extra={<span className="fine muted">2026-10-05 官方积分</span>}><ol className="ladder">{ladder.map(t=><li key={t.id}><span className="rank">{t.initialRank}</span><b>{t.name}</b><span className="ladder-bar" aria-hidden="true"><i style={{transform:`scaleX(${t.initialVrsPoints/top})`}}/></span><span className="points">{t.initialVrsPoints}</span></li>)}</ol></Panel>
 </div>
 </>;
}
