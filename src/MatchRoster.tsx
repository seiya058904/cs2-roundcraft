import {memo} from 'react';
import type {Fighter,GameMap,Series,TeamIndex} from './domain/types';
import {equipmentLabel,SIDE_LABELS} from './labels';
import {WeaponIcon,GearIcon,type GearKind} from './EquipmentIcon';
import {useRosterMotion,useTweenNumber} from './motion';

type Stats=Record<string,{kills:number;deaths:number}>;
export type RosterMode='prepare'|'playing'|'complete';
export type PlayerExtras={delta?:number;badges?:string[];form?:'hot'|'cold'|null};
const money=(cash:number)=>Number.isFinite(cash)?`$${Math.round(cash).toLocaleString('en-US')}`:'未知';
export const ROSTER_MODE_LABELS:Record<RosterMode,string>={prepare:'准备现金 / 当前护甲',playing:'购买后现金 / 开局护甲',complete:'结算现金 / 最终护甲'};

export function TeamRoster({match,team,mirrored,fighters,map,stats,anchor,extras}:{match:Series;team:TeamIndex;mirrored:boolean;fighters:Fighter[];map:GameMap|null;stats:Stats;anchor:string;extras:Record<string,PlayerExtras>}){
 const lookup=new Map(fighters.map(f=>[f.id,f]));
 const members=match.teams[team].startingFive.map(id=>lookup.get(id)).filter((f):f is Fighter=>Boolean(f));
 const side=members[0]?.side,total=members.reduce((sum,f)=>sum+f.cash,0),alive=members.filter(f=>f.alive).length;
 const shownTotal=useTweenNumber(total,.6);
 return <section className={`match-roster ${side==='CT'?'defenders':'attackers'} ${mirrored?'enemy-roster':'own-roster'}`} aria-label={`${mirrored?'对方':'己方'}选手 · ${match.teams[team].name}`}>
  <header className="roster-heading">
   <div className="roster-title"><h3>{match.teams[team].name}</h3><small>{mirrored?'对方':'己方'} / {side?SIDE_LABELS[side]:'准备'}</small></div>
   <div className="team-economy"><b><span className="alive-count">{alive}</span> <small>/ 5 存活</small></b><span>{money(shownTotal)}</span></div>
   <div className="alive-pips" aria-hidden="true">{members.map(f=><i key={f.id} className={f.alive?'on':''}/>)}</div>
  </header>
  <div className="match-player-list">{members.map(f=><ObserverPlayer key={f.id} fighter={f} name={match.players.find(p=>p.id===f.id)?.nickname??f.id} zone={map?.zones.find(z=>z.id===f.zone)?.name??'出生点'} kills={stats[f.id]?.kills??0} deaths={stats[f.id]?.deaths??0} anchor={anchor} extras={extras[f.id]}/>)}</div>
 </section>;
}
const ObserverPlayer=memo(function ObserverPlayer({fighter:f,name,zone,kills,deaths,anchor,extras}:{fighter:Fighter;name:string;zone:string;kills:number;deaths:number;anchor:string;extras?:PlayerExtras}){
 const ref=useRosterMotion(anchor,f.hp,f.alive,f.cash,[f.equipment.weapon,f.equipment.armor,f.equipment.helmet,f.equipment.kit,f.hasBomb,...f.equipment.utility].join(','));
 const cash=useTweenNumber(f.cash,.5);
 const utility=Object.entries(f.equipment.utility.reduce<Record<string,number>>((counts,item)=>{counts[item]=(counts[item]??0)+1;return counts;},{}));
 const hp=f.alive?f.hp:0;
 return <article ref={ref} className={`match-player ${f.alive?'':'is-dead'} ${extras?.form==='hot'?'is-hot':''}`} data-testid="match-player" data-player-id={f.id}>
 <div className="player-identity"><strong title={name}>{name}</strong><span className="player-kd" aria-label={`击杀 ${kills} 死亡 ${deaths}`}><span>击杀 {kills}</span><span>死亡 {deaths}</span></span><span className="cash-line"><b className="player-cash">{money(cash)}</b>{extras?.delta?<em className={`cash-delta ${extras.delta>0?'up':'down'}`}>{extras.delta>0?'+':'−'}${Math.abs(extras.delta).toLocaleString('en-US')}</em>:null}</span></div>
 <div className="player-loadout">{f.alive?<><div className="player-weapon"><WeaponIcon weapon={f.equipment.weapon}/><span>{equipmentLabel(f.equipment.weapon)}</span></div><div className="player-gear">{f.equipment.armor>0&&<GearIcon kind="armor" label={`护甲 ${f.equipment.armor}`}/>} {f.equipment.helmet&&<GearIcon kind="helmet" label="头盔"/>}{utility.map(([kind,count])=><GearIcon key={kind} kind={kind as GearKind} label={`${kind==='fire'?(f.side==='T'?'燃烧瓶':'燃烧弹'):equipmentLabel(kind)} × ${count}`} count={count} side={f.side}/>)}{f.equipment.kit&&<GearIcon kind="kit" label="拆弹器"/>}{f.hasBomb&&<GearIcon kind="bomb" label="携带炸弹"/>}{!utility.length&&<span className="no-utility">无投掷物</span>}</div></>:<div className="dead-status"><GearIcon kind="dead" label="阵亡"/><span>本回合阵亡</span></div>}</div>
 <div className="player-vitals"><b className="player-hp" aria-label={`${name} 生命 ${hp}`}>{hp}</b><span title={zone}>{f.alive?zone:'阵亡'}</span></div>
 {extras?.badges?.length?<div className="player-badges" aria-label={`本回合高光：${extras.badges.join('、')}`}>{extras.badges.map(b=><span key={b}>{b}</span>)}</div>:null}
 {extras?.form==='hot'&&<span className="form-flame" title="近五回合手感火热" aria-label="手感火热"/>}
 <div className="player-health" role="meter" aria-label={`${name} 生命值`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={hp}><span className="trail" style={{transform:`scaleX(${hp/100})`}}/><span className="fill" style={{transform:`scaleX(${hp/100})`}}/></div>
 </article>;
});
