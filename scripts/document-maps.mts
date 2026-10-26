import {MAPS} from '../src/domain/maps.ts';
import {writeFileSync} from 'node:fs';
const lines=['# 地图区域与轮转路线','','本文件由 `scripts/document-maps.mts` 从当前实际配置生成。区域名称对应用户指定七图；路线、耗时、枪线与掩体是游戏近似，不是 BSP/导航网格的精确测量。','','**行走连通与可见枪线分开定义。** 同区域可交火；跨区域必须有显式枪线。近角架点落位后会放弃跨区域视野。所有路径边双向，移动耗时不得短于边权；火焰阻滞可能增加时间。','','Nuke 上下层只通过坡道、秘密通道、通风管等路线连接，不因名称相近就隔层对射。',''];
for(const map of MAPS){
 lines.push(`## ${map.name}`,'','| 区域 | 可步行相邻区域（秒） | 可见相邻枪线 |','| --- | --- | --- |');
 const name=(id:string)=>map.zones.find(z=>z.id===id)!.name;
 for(const zone of map.zones)lines.push(`| ${zone.name} | ${zone.paths.map(p=>`${name(p.to)} ${p.seconds}s`).join('、')} | ${zone.sightlines.map(p=>`${name(p.to)}（${({close:'近',mid:'中',long:'远'})[p.range]}）`).join('、')||'无跨区域枪线'} |`);
 lines.push('');
}
lines.push('## 边界','','地图不是完整的现实地图细节：没有精确视点、高度坐标、可穿透材质、可破坏物、烟雾体素、道具弹跳或真实投掷点位。不能用本表推断真实 CS2 中的精确跑图时间。配置改变后应重新生成本文件，并运行所有区域连通与无瞬移测试。','');
writeFileSync('docs/MAP_TOPOLOGY.md',lines.join('\n'));
console.log(`生成 ${MAPS.length} 张地图、${MAPS.reduce((n,m)=>n+m.zones.length,0)} 个区域的实际连接表`);
