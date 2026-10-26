import type {GameMap} from './domain/types';

export function MapGuide({map}:{map:GameMap}){
 const name=(id:string)=>map.zones.find(z=>z.id===id)!.name;
 return <details className="panel map-guide"><summary>{map.name} · 查看区域路线与枪线</summary>
  <p className="muted fine">耗时和掩体为游戏估值；通路可走不代表隔墙可见。近角架点会放弃相邻区域视野，等敌人进入同一区域。</p>
  <div className="table-scroll" tabIndex={0}><table><thead><tr><th>区域</th><th>可前往 · 估计秒数</th><th>常规可观察区域</th><th>区域交火距离</th></tr></thead><tbody>{map.zones.map(zone=><tr key={zone.id}><th>{zone.name}</th><td>{zone.paths.map(p=>`${name(p.to)} ${p.seconds} 秒`).join(' / ')}</td><td>{zone.sightlines.map(p=>name(p.to)).join(' / ')||'仅本区域'}</td><td>{({close:'近',mid:'中',long:'远'})[zone.range]}</td></tr>)}</tbody></table></div>
 </details>;
}
