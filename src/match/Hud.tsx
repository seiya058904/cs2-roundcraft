import {useMemo,useRef,useState,type ReactNode} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import type {RoundEvent,RoundResult,Series,Side,TeamIndex} from '../domain/types';
import {SIDE_LABELS} from '../labels';
import {WeaponIcon,GearIcon} from '../EquipmentIcon';
import {useMotionEnabled,usePop,useBurst,useTweenNumber} from '../motion';
import {winCurve,biggestSwing,economyOutlook,roundMvp,roundHighlights,BUY_LABELS} from '../domain/insights';
import {killFeed,timelineCells} from './feed';

export const REASON_LABELS:Record<RoundResult['reason'],string>={elimination:'全歼对手',defuse:'拆包成功',explode:'炸弹爆炸',time:'时间耗尽'};
const sideClass=(side?:Side)=>side==='CT'?'side-ct':'side-t';

/** Small inline glyphs for the timeline; geometry is original and drawn on a 16px grid. */
export function ReasonIcon({reason}:{reason:RoundResult['reason']}){
 const d={elimination:'M8 2.5a5 5 0 0 0-5 5c0 1.8.9 3 2 3.8V13h6v-1.7c1.1-.8 2-2 2-3.8a5 5 0 0 0-5-5zM6 7.5h.01M10 7.5h.01M7 13v-1.5M9 13v-1.5',defuse:'M3 13l5-5M8 8l2-5 3 3-5 2M10.5 5.5l1-1',explode:'M8 1.5l1.3 3.6 3.7-1.3-1.9 3.4 3.4 1.9-3.8.6.6 3.8-3.3-2.1L5.9 14.6l.3-3.9-3.9-.2 3.1-2.3L3 5.4l3.6 1.1z',time:'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3.2l2.2 1.3'}[reason];
 return <svg className="reason-icon" viewBox="0 0 16 16" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function HeadshotIcon(){return <svg className="hs-icon" viewBox="0 0 16 16" role="img" aria-label="爆头"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1v4M8 11v4M1 8h4M11 8h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;}

type Banner={key:string;text:string;side:Side;detail?:string};
export type LiveState={alive:[number,number];at:number;complete:boolean;bomb?:{zone:string;state:'planted'|'defusing'|'defused'|'exploded';left:number}};
const BOMB_LABELS={planted:'已下包',defusing:'正在拆包',defused:'已拆除',exploded:'已爆炸'} as const;
/** Live strip under the score: who is still standing and where the bomb is, at the revealed moment. */
function LiveStrip({live,own,sides}:{live:LiveState;own:TeamIndex;sides:readonly Side[]}){
 const enemy=(1-own) as TeamIndex;
 const pips=(team:TeamIndex)=><span className={`live-pips ${sideClass(sides[team])}`} aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i} className={i<live.alive[team]?'on':''}/>)}</span>;
 const bombRef=usePop<HTMLSpanElement>(live.bomb?.state);
 // A pip that just went dark flares before it settles, so each death reads at a glance.
 const strip=useRef<HTMLDivElement>(null);const motion=useMotionEnabled();const before=useRef(live.alive);
 useGSAP(()=>{const was=before.current;before.current=live.alive;if(!motion||!strip.current)return;
  ([own,enemy] as TeamIndex[]).forEach((team,slot)=>{if(live.alive[team]>=was[team])return;
   const pips=strip.current!.querySelectorAll('.live-pips')[slot]?.querySelectorAll('i');
   for(let i=live.alive[team];i<was[team];i++){const pip=pips?.[i];if(pip)gsap.fromTo(pip,{scale:2.1,backgroundColor:'#ef9188',boxShadow:'0 0 12px #ef9188'},{scale:1,backgroundColor:'',boxShadow:'0 0 0 transparent',duration:.7,ease:'power3.out',clearProps:'transform,backgroundColor,boxShadow'});}
  });
 },{dependencies:[live.alive[0],live.alive[1],motion]});
 return <div ref={strip} className="live-strip" aria-label={`存活 ${live.alive[own]} 对 ${live.alive[enemy]}${live.bomb?` · ${BOMB_LABELS[live.bomb.state]} ${live.bomb.zone}`:''}`}>
  {pips(own)}<b className="live-count">{live.alive[own]}<i>v</i>{live.alive[enemy]}</b>{pips(enemy)}
  {live.bomb?<span ref={bombRef} className={`bomb-chip ${live.bomb.state}`}><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="5" width="11" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5V3.5h6V5M6 8.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>{BOMB_LABELS[live.bomb.state]} · {live.bomb.zone}{(live.bomb.state==='planted'||live.bomb.state==='defusing')&&!live.complete&&<small>剩 {live.bomb.left} 秒</small>}</span>:<span className="live-clock">{live.complete?'回合结束':`${live.at} 秒`}</span>}
 </div>;
}
export function ScoreHud({match,own,score,sides,series,status,pendingNote,started,banner,live,children}:{match:Series;own:TeamIndex;score:readonly number[];sides:readonly Side[];series:readonly number[];status:string;pendingNote?:string;started:boolean;banner?:Banner;live?:LiveState;children?:ReactNode}){
 const need=Math.ceil(match.bestOf/2);
 const ownRef=useBurst<HTMLSpanElement>(score[own]),enemyRef=useBurst<HTMLSpanElement>(score[1-own]);
 // The ring only marks score changes seen on this screen, never the initial render.
 const total=score[0]+score[1];const [firstTotal]=useState(total);
 const bannerRef=useRef<HTMLDivElement>(null);const motion=useMotionEnabled();
 useGSAP(()=>{if(!motion||!banner||!bannerRef.current)return;const tl=gsap.timeline();tl.from(bannerRef.current,{clipPath:'inset(0 50% 0 50%)',duration:.5,ease:'power3.out',clearProps:'clipPath'}).from(bannerRef.current.children,{y:8,opacity:0,stagger:.06,duration:.3,ease:'power2.out',clearProps:'transform,opacity'},'-=.2');},{dependencies:[banner?.key,motion]});
 const team=(index:TeamIndex,mirrored:boolean)=><div className={`hud-team ${mirrored?'enemy':'own'} ${started?sideClass(sides[index]):'side-none'}`}>
  <span className="hud-side-bar" aria-hidden="true"/>
  <div className="hud-team-text"><h1>{match.teams[index].name}</h1><span className={sides[index]==='T'?'orange':'cyan'}>{started?SIDE_LABELS[sides[index]]:'待选边'} · 系列 {series[index]} 胜</span></div>
  {match.bestOf>1&&<div className="series-pips" aria-hidden="true">{Array.from({length:need},(_,i)=><i key={i} className={i<series[index]?'on':''}/>)}</div>}
 </div>;
 return <header className="broadcast-hud scoreboard">
  <div className="hud-main">
   {team(own,false)}
   <div className="score-center"><small>{status}</small>{pendingNote&&<small className="pending-note">{pendingNote}</small>}{total!==firstTotal&&<span key={total} className="score-ring" aria-hidden="true"/>}<strong><span ref={ownRef}>{score[own]}</span><i>:</i><span ref={enemyRef}>{score[1-own]}</span></strong>{live&&<LiveStrip live={live} own={own} sides={sides}/>}</div>
   {team((1-own) as TeamIndex,true)}
  </div>
  {children}
  {banner&&<div ref={bannerRef} className={`round-banner ${sideClass(banner.side)}`} aria-hidden="true"><b>{banner.text}</b>{banner.detail&&<span>{banner.detail}</span>}</div>}
 </header>;
}

export function RoundTimeline({rounds,allRounds,own,shown,pending,onSelect,sideOf}:{rounds:readonly RoundResult[];allRounds:readonly RoundResult[];own:TeamIndex;shown?:RoundResult;pending:boolean;onSelect:(index:number)=>void;sideOf:(r:RoundResult)=>Side}){
 const cells=timelineCells(rounds,allRounds,own,shown,pending);
 return <div className="round-timeline" role="group" aria-label="本图回合进程，点选回放">
  {cells.map(c=>{
   const r=c.index!==undefined?allRounds[c.index]:undefined;
   const cls=`tl-cell ${c.state} ${c.halfBreak?'half':''} ${c.selected?'selected':''} ${r&&c.state!=='pending'?sideClass(sideOf(r)):''}`;
   if(c.state==='future'||c.state==='pending'||c.index===undefined)return <span key={c.key} className={cls} aria-hidden="true"><small>{c.number}</small></span>;
   return <button key={c.key} type="button" className={cls} aria-pressed={c.selected} aria-label={`第 ${c.number} 回合 · ${c.state==='won'?'己方':'对方'}获胜 · ${REASON_LABELS[c.reason!]}`} title={`R${c.number} · ${REASON_LABELS[c.reason!]}`} onClick={()=>onSelect(c.index!)}><ReasonIcon reason={c.reason!}/></button>;
  })}
 </div>;
}

const pct=(p:number)=>Math.round(p*100);
export function WinCard({round,own,revealed,complete,names}:{round:RoundResult;own:TeamIndex;revealed:readonly RoundEvent[];complete:boolean;names:[string,string]}){
 const curve=useMemo(()=>winCurve(round,own),[round,own]);
 const shownIds=useMemo(()=>new Set(revealed.map(e=>e.id)),[revealed]);
 const visible=curve.filter(p=>p.kind==='start'||(p.eventId&&shownIds.has(p.eventId)));
 const current=complete?curve.at(-1)!.p:visible.at(-1)!.p;
 const shown=useTweenNumber(pct(current),.6);
 const end=Math.max(1,curve.at(-1)!.at),W=300,H=84,x=(at:number)=>at/end*W,y=(p:number)=>H-4-p*(H-8);
 const pts=(complete?curve:visible);
 const line=pts.map((p,i)=>`${i?'H':'M'}${x(p.at).toFixed(1)}${i?` V${y(p.p).toFixed(1)}`:` ${y(p.p).toFixed(1)}`}`).join(' ');
 const lastX=x(complete?end:Math.max(pts.at(-1)!.at,revealed.at(-1)?.at??0));
 const path=`${line} H${lastX.toFixed(1)}`;
 const swing=complete?biggestSwing(round,own):null;const swingPoint=swing?curve.find(p=>p.eventId===swing.eventId):undefined;
 const ownSide=round.sides[own],outlook=complete?economyOutlook(round):null;
 return <section className={`hud-card win-card ${sideClass(ownSide)}`} aria-label="胜率走势">
  <header className="hud-card-head"><h3>实时胜率</h3><span>按模拟回合拟合 · 仅作参考</span></header>
  {complete?<div className="win-figure settled"><b>{pct(curve[0].p)}<small>%</small></b><span>开局预测 · {names[own]}</span><span className={`win-result ${round.winner===own?"won":"lost"}`}>{round.winner===own?"实际：赢下":"实际：失利"}</span></div>:<div className="win-figure"><b>{Math.round(shown)}<small>%</small></b><span>{names[own]}</span><span className="win-other">{100-Math.round(shown)}% · {names[1-own]}</span></div>}
  <div className="win-bar" aria-hidden="true"><span style={{transform:`scaleX(${(complete?pct(curve[0].p):shown)/100})`}}/></div>
  <svg className="win-curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`本回合 ${names[own]} 胜率从 ${pct(curve[0].p)}% 变化到 ${pct(current)}%`}>
   <line x1="0" x2={W} y1={y(.5)} y2={y(.5)} className="mid"/>
   <path d={`${path} V${y(.5)} H0 Z`} className="area"/>
   <path d={path} className="line" vectorEffect="non-scaling-stroke"/>
   {swingPoint&&<circle cx={x(swingPoint.at)} cy={y(swingPoint.p)} r="3.5" className="swing"/>}
  </svg>
  <div className="win-axis" aria-hidden="true"><span>开局 {pct(curve[0].p)}%</span>{swing&&<span>最大波动 {swing.delta>0?'+':''}{pct(swing.delta)}%</span>}<span>{complete?'回合结束':`${revealed.at(-1)?.at??0} 秒`}</span></div>
  {outlook&&<div className="outlook" aria-label="下回合经济预测">{([own,1-own] as TeamIndex[]).map(t=>{const o=outlook[t];return <div key={t} className={`outlook-chip buy-${o.kind}`}><span>{names[t]}</span><b>{o.label}</b><small>{o.reset?BUY_LABELS[o.kind]:`队伍现金 $${o.cash.toLocaleString('en-US')}`}</small></div>;})}</div>}
 </section>;
}

export function KillCard({round,own,revealed,complete,nick}:{round:RoundResult;own:TeamIndex;revealed:readonly RoundEvent[];complete:boolean;nick:(id?:string)=>string}){
 const items=useMemo(()=>killFeed(round,revealed),[round,revealed]);
 const mvp=complete?roundMvp(round):null,highlights=complete?roundHighlights(round).filter(h=>h.kind!=='entry'):[];
 const listRef=useRef<HTMLOListElement>(null);const motion=useMotionEnabled();
 useGSAP(()=>{if(!motion||!listRef.current?.firstElementChild)return;gsap.from(listRef.current.firstElementChild,{x:-16,opacity:0,duration:.35,ease:'power3.out',clearProps:'transform,opacity'});},{dependencies:[items.length,motion]});
 const side=(id:string)=>round.initial.find(f=>f.id===id)?.side;
 return <section className="hud-card kill-card" aria-label="击杀信息">
  <header className="hud-card-head"><h3>击杀信息</h3><span>{items.length} 次击杀</span></header>
  {items.length?<ol className="kill-feed" ref={listRef}>{items.map(k=><li key={k.id} className={`kf-row ${k.actorTeam===own?'by-own':'by-enemy'}`}>
   <span className={`kf-name ${sideClass(side(k.actor))}`}>{nick(k.actor)}</span>
   <span className="kf-weapon">{k.utility?<GearIcon kind={k.weapon==='HE'?'he':'fire'} label={k.weapon==='HE'?'手雷':'燃烧'} side={side(k.actor)}/>:<WeaponIcon weapon={k.weapon}/>}{k.headshot&&<HeadshotIcon/>}{k.throughSmoke&&<em className="kf-tag">穿烟</em>}</span>
   <span className={`kf-name victim ${sideClass(side(k.target))}`}>{nick(k.target)}</span>
   {k.trade&&<em className="kf-tag trade">补枪</em>}<time>{k.at}s</time>
  </li>)}</ol>:<p className="kf-empty">还没有交火。双方正在部署。</p>}
  {complete&&(mvp||highlights.length>0)&&<footer className="round-mvp">
   {mvp&&<div><span>回合 MVP</span><b>{nick(mvp.playerId)}</b><small>{mvp.kills} 杀 · {Math.round(mvp.damage)} 伤害</small></div>}
   {highlights.length>0&&<ul className="highlight-chips">{highlights.slice(0,4).map((h,i)=><li key={i} className={`hl-${h.kind}`}>{h.label}{h.playerId?` · ${nick(h.playerId)}`:''}</li>)}</ul>}
  </footer>}
 </section>;
}
