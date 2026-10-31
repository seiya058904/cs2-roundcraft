import {usePanelMotion} from './motion';
import {PlayerEvidence} from './PlayerEvidence';
import {ROLE_LABELS,nationalityLabel} from './labels';
import type {ReactNode} from 'react';
import {ATTRIBUTE_KEYS,type Player,type Team,type Attribute} from './domain/types';
export const ATTR_NAMES:Record<Attribute,string>={aim:'枪法',entry:'突破',awp:'狙击',defense:'防守',utility:'道具',gameSense:'战术意识',positioning:'站位',teamwork:'团队协作',clutch:'残局',consistency:'稳定性',composure:'关键局抗压',peakPotential:'爆发潜质'};
export function Panel({title,children,extra,className=""}:{title:string;children:ReactNode;extra?:ReactNode;className?:string}){const ref=usePanelMotion();return <section ref={ref} className={`panel ${className}`}><header className="panel-heading"><h2>{title}</h2>{extra}</header><div className="panel-content">{children}</div></section>;}
export function TeamSelect({teams,value,onChange,label}:{teams:Team[];value:string;onChange:(id:string)=>void;label:string}){return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}>{teams.map(t=><option key={t.id} value={t.id}>#{t.initialRank} {t.name}</option>)}</select></label>;}
export function PlayerCard({player}:{player:Player}){return <div className="player-detail"><h3>{player.nickname} <span className="muted">{nationalityLabel(player.nationality)}</span></h3><p>{ROLE_LABELS[player.role]} · {player.roleConfidence==='verified'?'有来源角色':player.roleConfidence==='user-assigned'?'玩家指定职责':'具体职责待核实'} · 能力为游戏平衡估值，非官方职业测评</p><div className="player-overview"><Radar players={[player]}/><div className="player-summary"><span>能力均值</span><b>{(Object.values(player.attributes).reduce((a,b)=>a+b,0)/12).toFixed(1)}</b><small>最强：{ATTR_NAMES[(Object.entries(player.attributes).sort((a,b)=>b[1]-a[1])[0][0]) as Attribute]}</small></div></div><h4 className="attribute-heading">全部 12 项游戏能力</h4><div className="attribute-grid">{Object.entries(player.attributes).map(([key,value])=><div key={key} className={value>=85?"elite":value<60?"weak":""}><span>{ATTR_NAMES[key as Attribute]}</span><strong>{value}</strong><meter min={0} max={100} value={value}/></div>)}</div><PlayerEvidence player={player}/><p>已核实历史：{player.history.length?player.history.join(' → '):'资料暂缺，不推测真实转会履历'}</p><a href={player.source.identityUrl??player.source.url} target="_blank" rel="noreferrer">查看资料来源 ↗</a></div>;}

/** Twelve-axis radar on a 0–100 scale; one or two players (overlay for comparison). */
export function Radar({players,size=220}:{players:Player[];size?:number}){
 const c=size/2,R=size/2-30,n=ATTRIBUTE_KEYS.length;
 const pt=(i:number,v:number)=>{const a=-Math.PI/2+i*2*Math.PI/n,r=R*v/100;return [c+r*Math.cos(a),c+r*Math.sin(a)] as const;};
 const poly=(p:Player)=>ATTRIBUTE_KEYS.map((k,i)=>pt(i,p.attributes[k]).map(x=>x.toFixed(1)).join(',')).join(' ');
 return <svg className={`radar ${players.length>1?'radar-compare':''}`} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={players.map(p=>`${p.nickname} 十二项能力雷达图`).join('，')}>
  {[25,50,75,100].map(v=><polygon key={v} className="radar-ring" points={ATTRIBUTE_KEYS.map((_,i)=>pt(i,v).join(',')).join(' ')}/>)}
  {ATTRIBUTE_KEYS.map((k,i)=>{const [x,y]=pt(i,100),[lx,ly]=pt(i,118);return <g key={k}><line className="radar-axis" x1={c} y1={c} x2={x} y2={y}/><text x={lx} y={ly} textAnchor={Math.abs(lx-c)<4?'middle':lx>c?'start':'end'} dominantBaseline="middle">{ATTR_NAMES[k]}</text></g>;})}
  {players.map((p,i)=><polygon key={p.id} className={`radar-shape shape-${i}`} points={poly(p)}/>)}
 </svg>;
}
export function RadarCompare({players}:{players:Player[]}){return <div className="radar-compare-wrap"><Radar players={players} size={300}/><div className="radar-legend">{players.map((p,i)=><span key={p.id} className={`legend-${i}`}>{p.nickname}</span>)}</div></div>;}
