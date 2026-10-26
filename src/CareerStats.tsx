import {useState} from 'react';
import {careerPlayerStats,type Career} from './domain/career';
import {Panel} from './ui';

export function CareerStats({career}:{career:Career}){
 const[scope,setScope]=useState('season');const[onlyMine,setOnlyMine]=useState(false);
 const roster=career.world.teams.find(t=>t.id===career.managedTeamId)!.startingFive;
 const stats=careerPlayerStats(career,scope==='career').filter(p=>!onlyMine||roster.includes(p.id)).sort((a,b)=>b.rating-a.rating);
 const included=[...(scope==='career'?(career.archivedSeasons??[]).map(s=>s.season):[]),career.season];
 return <Panel title="选手赛季统计" extra={<select aria-label="统计范围" value={scope} onChange={e=>setScope(e.target.value)}><option value="season">当前赛季</option><option value="career">生涯累计</option></select>}>
  <label className="checkbox"><input type="checkbox" checked={onlyMine} onChange={e=>setOnlyMine(e.target.checked)}/>仅查看当前首发</label>
  <p className="muted fine">已记录赛季：{included.map(s=>`第 ${s} 赛季`).join('、')}。仅统计已结算赛事对局；沙盒不计入。旧存档未保留的历史统计不会补造。</p>
  {stats.length?<div className="table-scroll career-stats"><table><thead><tr><th>选手</th><th>回合</th><th>击杀</th><th>死亡</th><th>助攻</th><th>场均回合伤害</th><th>回合贡献率</th><th>闪助</th><th>道具伤害</th><th>残局胜</th><th>综合评分</th></tr></thead><tbody>{stats.map(p=><tr key={p.id}><th>{career.world.players.find(player=>player.id===p.id)?.nickname??p.id}</th><td>{p.rounds}</td><td>{p.kills}</td><td>{p.deaths}</td><td>{p.assists}</td><td>{p.adr.toFixed(1)}</td><td>{p.kast.toFixed(0)}%</td><td>{p.flashAssists}</td><td>{p.utilityDamage}</td><td>{p.clutchWins}</td><td>{p.rating.toFixed(2)}</td></tr>)}</tbody></table></div>:<p className="muted">完成赛事对局后，统计会出现在这里。</p>}
 </Panel>;
}
