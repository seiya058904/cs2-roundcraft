import {memo} from 'react';
import type {Fighter,GameMap,Series,TeamIndex} from './domain/types';
import {equipmentLabel,SIDE_LABELS} from './labels';
import {WeaponIcon,GearIcon,type GearKind} from './EquipmentIcon';
import {useRosterMotion} from './motion';

type Stats=Record<string,{kills:number;deaths:number}>;
type Mode='prepare'|'playing'|'complete';
const money=(cash:number)=>Number.isFinite(cash)?`$${cash.toLocaleString()}`:'未知';
const modeLabels={prepare:'准备现金 / 当前护甲',playing:'购买后现金 / 开局护甲',complete:'结算现金 / 最终护甲'};
export function MatchRoster({match,own,fighters,map,mode,stats,anchor}:{match:Series;own:TeamIndex;fighters:Fighter[];map:GameMap|null;mode:Mode;stats:Stats;anchor:string}){
 const lookup=new Map(fighters.map(f=>[f.id,f]));
 return <section className="observer-board" aria-label="双方选手对比"><div className="observer-caption"><h2>双方阵容</h2><span>{modeLabels[mode]}</span></div><div className="match-rosters">
 {([own,1-own] as TeamIndex[]).map((team,index)=>{
  const members=match.teams[team].startingFive.map(id=>lookup.get(id)).filter((f):f is Fighter=>Boolean(f));
  const side=members[0]?.side,total=members.reduce((sum,f)=>sum+f.cash,0);
  return <section key={team} className={`match-roster ${side==='CT'?'defenders':'attackers'} ${index?'enemy-roster':'own-roster'}`} aria-label={`${index?'对方':'己方'}选手 · ${match.teams[team].name}`}>
   <header className="roster-heading"><div><h3>{match.teams[team].name}</h3><small>{index?'对方':'己方'} / {side?SIDE_LABELS[side]:'准备'}</small></div><div className="team-economy"><b>{members.filter(f=>f.alive).length} <small>/ 5 存活</small></b><span>{money(total)}</span></div></header>
   <div className="match-player-list">{members.map(f=><ObserverPlayer key={f.id} fighter={f} name={match.players.find(p=>p.id===f.id)?.nickname??f.id} zone={map?.zones.find(z=>z.id===f.zone)?.name??'出生点'} kills={stats[f.id]?.kills??0} deaths={stats[f.id]?.deaths??0} anchor={anchor}/>)}</div>
  </section>;
 })}</div></section>;
}
const ObserverPlayer=memo(function ObserverPlayer({fighter:f,name,zone,kills,deaths,anchor}:{fighter:Fighter;name:string;zone:string;kills:number;deaths:number;anchor:string}){
 const ref=useRosterMotion(anchor,f.hp,f.alive,f.cash,[f.equipment.weapon,f.equipment.armor,f.equipment.helmet,f.equipment.kit,f.hasBomb,...f.equipment.utility].join(','));
 const utility=Object.entries(f.equipment.utility.reduce<Record<string,number>>((counts,item)=>{counts[item]=(counts[item]??0)+1;return counts;},{}));
 return <article ref={ref} className={`match-player ${f.alive?'':'is-dead'}`} data-testid="match-player" data-player-id={f.id}>
 <div className="player-identity"><strong title={name}>{name}</strong><span className="player-kd" aria-label={`击杀 ${kills} 死亡 ${deaths}`}><span>击杀 {kills}</span><span>死亡 {deaths}</span></span><b className="player-cash">{money(f.cash)}</b></div>
 <div className="player-loadout">{f.alive?<><div className="player-weapon"><WeaponIcon weapon={f.equipment.weapon}/><span>{equipmentLabel(f.equipment.weapon)}</span></div><div className="player-gear">{f.equipment.armor>0&&<GearIcon kind="armor" label={`护甲 ${f.equipment.armor}`}/>} {f.equipment.helmet&&<GearIcon kind="helmet" label="头盔"/>}{utility.map(([kind,count])=><GearIcon key={kind} kind={kind as GearKind} label={`${kind==='fire'?(f.side==='T'?'燃烧瓶':'燃烧弹'):equipmentLabel(kind)} × ${count}`} count={count} side={f.side}/>)}{f.equipment.kit&&<GearIcon kind="kit" label="拆弹器"/>}{f.hasBomb&&<GearIcon kind="bomb" label="携带炸弹"/>}{!utility.length&&<span className="no-utility">无投掷物</span>}</div></>:<div className="dead-status"><GearIcon kind="dead" label="阵亡"/><span>本回合阵亡</span></div>}</div>
 <div className="player-vitals"><b className="player-hp" aria-label={`${name} 生命 ${f.alive?f.hp:0}`}>{f.alive?f.hp:0}</b><span title={zone}>{f.alive?zone:'阵亡'}</span></div>
 <div className="player-health" role="meter" aria-label={`${name} 生命值`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.alive?f.hp:0}><span style={{transform:`scaleX(${(f.alive?f.hp:0)/100})`}}/></div>
 </article>;
});
