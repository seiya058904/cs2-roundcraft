import {BattlePlanReview} from './BattlePlanEditor';
import {MatchCommand} from './MatchCommand';
import {TeamRoster,ROSTER_MODE_LABELS,type PlayerExtras,type RosterMode} from './MatchRoster';
import {EVENT_LABELS,equipmentLabel} from './labels';
import {MapGuide} from './MapGuide';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {useEventMotion,useIndicator} from './motion';
import type {Series,Decision,TeamIndex,RoundResult,TimeoutEffect,Side} from './domain/types';
import {MAPS,getMap} from './domain/maps';
import {availableMaps,vetoStep,sidesForRound,sideChooser} from './domain/series';
import {TACTICS,defaultDecision} from './domain/tactics';
import {aggregateStats} from './domain/statistics';
import {roundHighlights,playerForm} from './domain/insights';
import {Panel} from './ui';
import {formatCommentaryNames} from './domain/names';
import {commentarySnapshot,visibleMapStats} from './domain/replay';
import {ScoreHud,RoundTimeline,WinCard,KillCard,REASON_LABELS} from './match/Hud';
type Props={match:Series;own:TeamIndex;busy:boolean;onVeto:(map:typeof MAPS[number]['id'])=>void;onAutoVeto:()=>void;onOpponentVeto:()=>void;onVetoOrder:(as:'A'|'B')=>void;onStartingSide:(side:Side)=>void;onRound:(d?:Decision,count?:number)=>void;onBatch:(limit:'map'|'series')=>void;onTimeout:(kind:TimeoutEffect['kind'])=>void;onFinish:()=>void;careerMatch:boolean};
const VOICE_LABELS={caster:'主解说',analyst:'分析嘉宾'} as const;
const BADGE_KINDS=new Set(['ace','4k','3k','clutch','ninja']);
export function MatchView({match,own,busy,onVeto,onAutoVeto,onOpponentVeto,onVetoOrder,onStartingSide,onRound,onBatch,onTimeout,onFinish,careerMatch}:Props){
 const current=match.mapStates.at(-1);const side=current?sidesForRound(current.startSide,current.rounds.length)[own]:'T';
 const [paused,setPaused]=useState(false);const[detail,setDetail]=useState<'full'|'brief'>(()=>{try{return localStorage.getItem('ctm-commentary')==='brief'?'brief':'full';}catch{return 'full';}});const[follow,setFollow]=useState(true);const feed=useRef<HTMLDivElement>(null);const skipBatch=useRef(false);
 const[decision,setDecision]=useState<Decision>(defaultDecision(side));const[view,setView]=useState<'live'|'review'|'ledger'>('live');const[selected,setSelected]=useState(-1);const[revealed,setRevealed]=useState(1);const[speed,setSpeed]=useState(()=>{try{const v=Number(localStorage.getItem('ctm-speed')??1000);return [1000,2500,0,-1].includes(v)?v:1000;}catch{return 1000;}});
 const allRounds=useMemo(()=>match.mapStates.flatMap(m=>m.rounds),[match]);
 const round=selected<0?allRounds.at(-1):allRounds[selected];
 const statistics=useMemo(()=>aggregateStats(allRounds.slice(0,selected<0?allRounds.length:selected+1)).sort((a,b)=>b.rating-a.rating),[allRounds,selected]);
 useEffect(()=>{setDecision(d=>({...d,tactic:defaultDecision(side).tactic,positions:undefined,stances:undefined,phases:undefined}));},[side,current?.map]);
 useEffect(()=>{setSelected(-1);},[allRounds.length]);
 useEffect(()=>{setRevealed(speed===0||skipBatch.current?999:1);setPaused(false);setFollow(true);if(!busy)skipBatch.current=false;},[round,speed,busy]);
 useEffect(()=>{try{localStorage.setItem('ctm-speed',String(speed));}catch{/* preference only */}},[speed]);
 useEffect(()=>{try{localStorage.setItem('ctm-commentary',detail);}catch{/* preference only */}},[detail]);
 useEffect(()=>{if(follow&&feed.current)feed.current.scrollTo({top:feed.current.scrollHeight,behavior:'instant'});},[revealed,follow,detail]);
 useEventMotion(feed,`${round?.map}-${round?.number}-${revealed}`);
 useEffect(()=>{if(paused||speed<=0||!round||revealed>=round.commentary.length)return;const id=setTimeoutFn(()=>setRevealed(n=>n+1),Math.max(speed,Math.min(8000,(round.commentary[revealed-1]?.text.length??30)*45)));return()=>clearTimeout(id);},[revealed,speed,round,paused]);
 const tabs=useIndicator<HTMLDivElement>('button[aria-pressed=true]',[view,Boolean(round)]);
 const nick=(id?:string)=>match.players.find(p=>p.id===id)?.nickname??id??'—';
 const snapshot=useMemo(()=>round?commentarySnapshot(round,view==='live'?revealed:Infinity):null,[round,view,revealed]);
 const hudStats=useMemo(()=>visibleMapStats(allRounds,round,snapshot?.events??[]),[allRounds,round,snapshot]);
 const eventIndex=useMemo(()=>new Map(round?.events.map(e=>[e.id,e])??[]),[round]);
 const roster=snapshot?.fighters??current?.fighters??[];const rosterMap=round?getMap(round.map):current?getMap(current.map):null;
 const livePending=view==='live'&&snapshot&&!snapshot.complete;
 const complete=Boolean(snapshot?.complete);
 const displaySides=round?.sides??(current?sidesForRound(current.startSide,current.rounds.length):['T','CT']);
 const displayScore=snapshot?.score??current?.score??[0,0];
 const replayMapIndex=round?match.maps.indexOf(round.map):-1;
 const displaySeries=round?[0,1].map(team=>match.mapStates.slice(0,replayMapIndex+Number(Boolean(snapshot?.complete&&round===match.mapStates[replayMapIndex]?.rounds.at(-1)))).filter(m=>m.winner===team).length):match.score;
 const orderedScore=(score:readonly number[]|undefined,separator=' : ')=>score?[score[own],score[1-own]].join(separator):'待开始';
 const mapScore=(index:number)=>round?(index>replayMapIndex?'待开始':index===replayMapIndex?orderedScore(snapshot!.score):orderedScore(match.mapStates[index]?.score)):orderedScore(match.mapStates[index]?.score);
 const map=current?getMap(current.map):null;const step=vetoStep(match);
 const update=(value:Partial<Decision>)=>setDecision(d=>({...d,...value}));
 const shownMapRounds=match.mapStates.find(m=>m.map===(round?.map??current?.map))?.rounds??[];
 const mode:RosterMode=!round?'prepare':complete?'complete':'playing';
 // Per-player extras: settled cash change, this round's highlights and recent form (prior rounds only).
 const extras=useMemo(()=>{
  const out:Record<string,PlayerExtras>={};if(!round)return out;
  const prior=shownMapRounds.filter(r=>r.number<round.number);
  const badges=complete?roundHighlights(round).filter(h=>BADGE_KINDS.has(h.kind)&&h.playerId):[];
  for(const f of round.initial){const entry=round.economy.find(e=>e.playerId===f.id);
   out[f.id]={delta:complete&&entry?entry.cashAtEnd-entry.cashAfterBuy:undefined,badges:badges.filter(b=>b.playerId===f.id).map(b=>b.label),form:playerForm(prior,f.id).form};}
  return out;
 },[round,complete,shownMapRounds]);
 const status=match.status==='finished'&&!livePending&&selected<0?'系列赛结束':round?`回放第 ${round.number} 回合${round.number>24?' / 加时':''}`:current?'等待首回合':'赛前准备';
 const topHighlight=round&&complete?roundHighlights(round).find(h=>h.kind!=='entry'):undefined;
 const banner=round&&complete?{key:`${round.map}-${round.number}`,side:round.sides[round.winner],text:`${match.teams[round.winner].name} 拿下第 ${round.number} 回合`,detail:[REASON_LABELS[round.reason],topHighlight?`${topHighlight.label}${topHighlight.playerId?` · ${nick(topHighlight.playerId)}`:''}`:''].filter(Boolean).join(' · ')}:undefined;
 return <>
 <div className="breadcrumb">{careerMatch?'职业生涯':'独立沙盒'} <span>/</span> BO{match.bestOf} <span>/</span> {rosterMap?.name??map?.name??'地图禁选'} <span className="right muted">随机种子 {match.seed} · 模拟比赛</span></div>
 <ScoreHud match={match} own={own} score={displayScore} sides={displaySides as Side[]} series={displaySeries} status={status} pendingNote={livePending?`正在回放 R${round!.number} · 结算比分尚未揭示`:undefined} started={Boolean(current)} banner={banner}>
  <div className="hud-sub">
   <div className="map-strip">{match.maps.length?match.maps.map((id,i)=><div className={i===(round?replayMapIndex:match.mapStates.length-1)?'active':''} key={id}><small>地图 {i+1}</small><b>{getMap(id).name}</b><span>{mapScore(i)}</span></div>):<p>七张地图 · 双方轮流禁选 · 地图强项为游戏准备度</p>}</div>
   {current&&<RoundTimeline rounds={shownMapRounds} allRounds={allRounds} own={own} shown={round} pending={Boolean(livePending)} onSelect={setSelected} sideOf={r=>r.sides[r.winner]}/>}
  </div>
 </ScoreHud>
 {match.status==='veto'&&match.veto.length===0&&((match.higherSeed??(match.teams[0].initialRank<=match.teams[1].initialRank?0:1))===own)&&<Panel title="高种子顺序选择"><p>你可以选择 A / B 禁选顺序。选图方的对手选边，剩余图由 B 方选边。</p><div className="button-row"><button aria-pressed={(match.vetoA??0)===own} onClick={()=>onVetoOrder('A')}>选择 A 方</button><button aria-pressed={(match.vetoA??0)!==own} onClick={()=>onVetoOrder('B')}>选择 B 方</button></div></Panel>}
 {match.status==='playing'&&current&&current.rounds.length===0&&sideChooser(match,current.map)===own&&<Panel title="本图由你选边"><div className="button-row side-choice"><button className="side-t" aria-pressed={side==='T'} onClick={()=>onStartingSide('T')}>先打进攻方</button><button className="side-ct" aria-pressed={side==='CT'} onClick={()=>onStartingSide('CT')}>先打防守方</button></div></Panel>}
 {match.status==='veto'&&careerMatch&&step?.team!==own&&<button onClick={onOpponentVeto}>对手执行本轮禁选</button>}
 {match.status==='veto'?<Panel className="veto-panel" title={`地图禁选 · ${match.teams[step!.team].name} ${step!.kind==='ban'?'禁图':'选图'}`} extra={<button onClick={onAutoVeto}>自动完成禁选</button>}>
  <div className="map-grid">{MAPS.map(m=>{const record=match.veto.find(v=>v.map===m.id),open=availableMaps(match).some(a=>a.id===m.id);const a=match.teams[own].dynamics.mapPreparation[m.id],b=match.teams[1-own].dynamics.mapPreparation[m.id];
   return <button key={m.id} className={`map-card ${record?(record.kind==='ban'?'banned':'picked'):''} ${open?'':'closed'} ${step?.kind==='ban'?'intent-ban':'intent-pick'}`} disabled={!open||(careerMatch&&step!.team!==own)} onClick={()=>onVeto(m.id)}>
    <strong>{m.name}</strong>
    <span className="prep-compare" aria-label={`准备度 ${match.teams[own].name} ${a} / ${match.teams[1-own].name} ${b}`}><i style={{width:`${a}%`}}/><i style={{width:`${b}%`}}/></span>
    <span>{a} / {b}</span>
    <small>{record?`${match.teams[record.team].name} ${record.kind==='ban'?'已禁用':'已选择'}`:open?(step!.kind==='ban'?'禁用这张地图':'选择这张地图'):'剩余地图'}</small>
   </button>;})}</div>
  <ol className="veto-history">{match.veto.map((v,i)=><li key={i} className={v.kind}>{match.teams[v.team].name} {v.kind==='ban'?'禁用':'选择'} {getMap(v.map).name}</li>)}</ol></Panel>:<>
 <MatchCommand match={match} side={side} own={own} map={map!} decision={decision} busy={busy} update={update} onRound={onRound} onBatch={limit=>{skipBatch.current=true;onBatch(limit);}} onTimeout={onTimeout}/>
 <section className={`observer-board arena ${round?'has-round':''}`} aria-label="双方选手对比">
  <div className="observer-caption"><h2>双方阵容</h2><span>{ROSTER_MODE_LABELS[mode]}</span></div>
  <TeamRoster match={match} team={own} mirrored={false} fighters={roster} map={rosterMap} stats={hudStats} anchor={`${round?.map}-${round?.number}-${snapshot?.cutoff}`} extras={extras}/>
  <div className="match-main">
   <Panel className="broadcast-panel" title="现场解说" extra={<select aria-label="播报速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={1000}>正常播报</option><option value={2500}>慢速阅读</option><option value={0}>直接显示</option><option value={-1}>手动逐段</option></select>}>
    <div className="tabs" ref={tabs}><span className="indicator" aria-hidden="true"/>{([['live','现场解说'],['review','战术复盘'],['ledger','精确账本']]as const).map(([id,name])=><button aria-pressed={view===id} className={view===id?'selected':''} key={id} onClick={()=>setView(id)}>{name}</button>)}</div>
    <div className="broadcast-controls"><div className="button-row segmented"><button aria-pressed={detail==='full'} onClick={()=>setDetail('full')}>详解</button><button aria-pressed={detail==='brief'} onClick={()=>setDetail('brief')}>精简</button></div><button className="ghost" disabled={!round||revealed>=round.commentary.length||speed<=0} onClick={()=>setPaused(p=>!p)}>{paused?'继续播报':'暂停播报'}</button>{allRounds.length>0&&<label className="round-picker">回合回放<select aria-label="回放回合" value={selected} onChange={e=>setSelected(Number(e.target.value))}><option value={-1}>最新回合</option>{allRounds.map((r,i)=><option key={i} value={i}>{getMap(r.map).name} · R{r.number}{(selected>=0&&i>selected)||(r===round&&!snapshot?.complete)?'':` · ${orderedScore(r.score,':')}`}</option>)}</select></label>}{round&&<label className="progress-label">事件进度<input aria-label="解说事件进度" type="range" min={1} max={round.commentary.length} value={Math.min(revealed,round.commentary.length)} style={{'--progress':`${(Math.min(revealed,round.commentary.length)-1)/Math.max(1,round.commentary.length-1)*100}%`} as CSSProperties} onChange={e=>{setPaused(true);setRevealed(Number(e.target.value));}}/></label>}</div>
    {!round?<div className="empty-state"><h3>第一回合，由你指挥。</h3><p>配置本回合的战术与经济，执行后主解说与分析嘉宾会随真实事件逐段展开。</p><p className="muted">敌方计划尚未暴露。首回合双方起始现金为每人 $800。</p></div>:view==='live'?<div className="commentary commentary-feed" ref={feed} tabIndex={0} aria-label="现场解说" onScroll={e=>{const el=e.currentTarget;setFollow(el.scrollHeight-el.clientHeight-el.scrollTop<45);}} aria-live="polite">
     <p className="round-label">{getMap(round.map).name} / 第 {round.number} 回合</p>
     <p className="live-state" data-testid="live-state">{snapshot!.at} 秒 · 存活 {orderedScore(snapshot!.alive)} · 比分 {orderedScore(snapshot!.score)}{snapshot!.complete?' · 回合结束':' · 播报进行中'}</p>
     {round.commentary.slice(0,revealed).map((segment,i)=>{if(detail==='brief'&&segment.briefText==='')return null;const voice=segment.voice??'caster';
      return <div key={i} className={`segment ${segment.emphasis} voice-${voice}`}>
       <div className="segment-meta"><span className="speaker"><i aria-hidden="true">{voice==='analyst'?'析':'说'}</i>{VOICE_LABELS[voice]}<em>{segment.stage??'现场播报'}</em></span><button className="text-button" onClick={()=>{setPaused(true);setRevealed(i+1);}}>{segment.at??0} 秒</button></div>
       <p>{formatCommentaryNames(detail==='brief'?(segment.briefText??segment.text):segment.text,match.players,match.teams)}</p>
       <details><summary>查看 {segment.eventIds.length} 条事实依据</summary>{segment.quoteSource&&<p className="evidence">语录出处：{segment.quoteSource} · 用户提供的字幕整理稿</p>}{segment.eventIds.map(id=>{const e=eventIndex.get(id)!;return <p className="evidence" key={id}>{e.id} · {e.at} 秒 · {EVENT_LABELS[e.kind]} · {nick(e.actor)} {e.target?`→ ${nick(e.target)}`:''} {e.damage?`${e.damage} 生命值`:''}</p>;})}</details>
      </div>;})}
     {revealed<round.commentary.length&&<div className="button-row feed-next"><button onClick={()=>setRevealed(n=>n+1)}>继续下一段</button><button className="ghost" onClick={()=>setRevealed(999)}>展开本回合全部解说</button></div>}
    </div>:view==='review'?<div className="review"><h3>{match.teams[round.winner].name}赢下回合</h3><p>胜利条件：{({elimination:'下包前消灭全部对手',defuse:'炸弹爆炸前完成拆除',explode:'炸弹计时结束',time:'下包前回合时间耗尽'})[round.reason]}</p><p>双方战术：{TACTICS.find(t=>t.id===round.decisions[0].tactic)?.name} / {TACTICS.find(t=>t.id===round.decisions[1].tactic)?.name}</p><p>实际交火 {round.events.filter(e=>e.kind==='duel').length} 次，轮转移动 {round.events.filter(e=>e.kind==='move').length} 次，击杀 {round.events.filter(e=>e.kind==='kill').length} 次。</p><p>这些结论来自本回合账本；单局胜败不能证明某战术一定有效。</p><BattlePlanReview round={round} names={match.teams.map(t=>t.name)}/></div>:<Ledger round={round} nick={nick}/>}
    {!follow&&view==='live'&&<button className="follow-latest" onClick={()=>setFollow(true)}>回到最新</button>}
   </Panel>
  </div>
  <TeamRoster match={match} team={(1-own) as TeamIndex} mirrored fighters={roster} map={rosterMap} stats={hudStats} anchor={`${round?.map}-${round?.number}-${snapshot?.cutoff}`} extras={extras}/>
  {round&&snapshot&&<WinCard round={round} own={own} revealed={snapshot.events} complete={complete} names={[match.teams[0].name,match.teams[1].name]}/>}
  {round&&snapshot&&<KillCard round={round} own={own} revealed={snapshot.events} complete={complete} nick={nick}/>}
 </section>
 {rosterMap&&<MapGuide map={rosterMap}/>}
 {match.status==='finished'&&!livePending&&round===allRounds.at(-1)&&<div className={`result ${match.winner===own?'won':'lost'}`}><div><small>{match.winner===own?'胜利':'系列赛结束'}</small><h3>{match.teams[match.winner!].name} 赢下系列赛</h3><span>{match.mapStates.map(m=>`${getMap(m.map).name} ${orderedScore(m.score,':')}`).join(' · ')}</span></div><button className="primary" onClick={onFinish}>{careerMatch?'结算并返回赛事':'返回沙盒配置'}</button></div>}
 {(!snapshot||snapshot.complete)&&<details className="statistics-disclosure"><summary>系列技术统计</summary><Panel title="系列技术统计" extra={<span className="fine muted">CTM Rating 2.0 为公开近似公式计算的游戏指标，非 HLTV 官方评分</span>}><div className="table-scroll" tabIndex={0}><table className="stats-table"><thead><tr><th>选手</th><th>击杀</th><th>死亡</th><th>助攻</th><th>场均回合伤害</th><th>回合贡献率</th><th>首杀</th><th>残局胜</th><th>Rating 2.0</th></tr></thead><tbody>{statistics.map((p,i)=><tr key={p.id} className={i===0&&p.rounds?'top-row':''}><th>{nick(p.id)}</th><td>{p.kills}</td><td>{p.deaths}</td><td>{p.assists}</td><td>{p.adr.toFixed(1)}</td><td>{p.kast.toFixed(0)}%</td><td>{p.openingKills}</td><td>{p.clutchWins}</td><td><span className={`rating ${p.rating>=1.15?'high':p.rating<.9?'low':''}`}>{p.rating.toFixed(2)}</span></td></tr>)}</tbody></table></div></Panel></details>}
 {round&&snapshot?.complete&&<details className="panel economy-ledger"><summary>逐人经济账本 · 第 {round.number} 回合</summary><div className="table-scroll" tabIndex={0}><table><thead><tr><th>选手</th><th>购买前</th><th>支出</th><th>击杀奖</th><th>目标奖</th><th>团队奖</th><th>结算</th><th>保枪</th></tr></thead><tbody>{round.economy.map(e=><tr key={e.playerId}><th>{nick(e.playerId)}</th><td>{e.cashBefore}</td><td>{e.spend}</td><td>{e.killRewards}</td><td>{e.objectiveRewards}</td><td>{e.teamRewards}</td><td>{e.cashAtEnd}</td><td>{e.carriedEquipment?.weapon??'无'}</td></tr>)}</tbody></table></div></details>}
 </>}
 </>;
}
const setTimeoutFn=globalThis.setTimeout;
function Ledger({round,nick}:{round:RoundResult;nick:(id?:string)=>string}){const map=getMap(round.map);return <div className="table-scroll ledger"><table><thead><tr><th>秒</th><th>事件</th><th>选手 / 对象</th><th>区域</th><th>明细</th></tr></thead><tbody>{round.events.map(e=><tr key={e.id}><td>{e.at}</td><td>{EVENT_LABELS[e.kind]}</td><td>{nick(e.actor)} {e.target?`→ ${nick(e.target)}`:''}</td><td>{map.zones.find(z=>z.id===e.zone)?.name??'—'}</td><td>{e.weapon?equipmentLabel(e.weapon):''} {e.damage?`${e.damage} 生命值 (${e.hpBefore} → ${e.hpAfter})`:''}<details><summary>原始技术记录 · {e.id}</summary><pre>{JSON.stringify(e.detail,null,2)}</pre></details></td></tr>)}</tbody></table></div>;}
