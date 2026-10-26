import type {Player} from './domain/types';
export function PlayerEvidence({player}:{player:Player}){
 const profile=player.profile;
 if(!profile)return <p className="muted">此对局使用旧版能力估值；新对局使用更新后的资料。</p>;
 return <section className="player-evidence" aria-label="选手资料依据">
  <h3>资料依据与能力估值</h3>
  <p>{profile.ranking?<><a href={profile.ranking.url} target="_blank" rel="noreferrer">HLTV {profile.ranking.year} 年度第 {profile.ranking.rank} 名</a> · </>:null}核查日期 {profile.checkedAt}</p>
  <p className="muted fine">{['ranked','sampled'].includes(profile.basis)?'能力参考可用的年度排名、下列已核实统计及职责，换算为游戏数值。':'尚无统一口径的个人表现样本，能力采用保守职责基线，不能视为真实实力排名。'}排名与统计是来源事实；十二项能力仍是游戏估值，未量化的维度不冒充实测。年度数据与过去三个月滚动窗口分别标明；来源画像分数不直接等于游戏能力。</p>
  {profile.roles.length?<div className="evidence-links">{profile.roles.map((r,i)=><a key={i} href={r.url} target="_blank" rel="noreferrer">职责来源 {i+1} · {r.asOf}</a>)}</div>:<p className="muted">具体职责待核实，暂按通用步枪手处理。</p>}
  {profile.awards.map(a=><p className="fine" key={a.label}><a href={a.url} target="_blank" rel="noreferrer">{a.label}</a></p>)}
  {profile.metrics.length>0&&<div className="table-scroll" tabIndex={0}><table><thead><tr><th>来源统计</th><th>数值</th><th>样本范围</th><th>时期</th></tr></thead><tbody>{profile.metrics.map((m,i)=><tr key={i}><td><a href={m.url} target="_blank" rel="noreferrer">{m.label}</a></td><td>{m.value}</td><td>{m.scope}</td><td>{m.period}</td></tr>)}</tbody></table></div>}
 </section>;
}
