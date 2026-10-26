import {readFileSync,writeFileSync} from 'node:fs';
import {hash,Random,clamp} from '../src/domain/random.ts';
import {ATTRIBUTE_KEYS,type Player,type Team,type Role,type MapId,type World} from '../src/domain/types.ts';
const url='https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/invitation/2026/standings_global_2026_10_05.md';
if(process.argv.includes('--fetch')) {const response=await fetch(url);if(!response.ok)throw new Error(`VRS HTTP ${response.status}`);writeFileSync('data/source/valve-vrs-2026-10-05.md',await response.text());}
const rows=readFileSync('data/source/valve-vrs-2026-10-05.md','utf8').split('\n').filter(l=>/^\|\s*\d+\s*\|/.test(l)).slice(0,50);
if(rows.length!==50)throw new Error('需要恰好 50 队');
const maps:MapId[]=['dust2','mirage','inferno','nuke','ancient','anubis','cache'];

const players:Player[]=[];const teams:Team[]=[];
for(const row of rows){
 const [,rank,points,name,roster]=row.split('|').map(s=>s.trim());const id=`team-${rank}`; const rng=new Random(hash(id));
 const base=81-(Number(rank)-1)*0.22;const values=()=>Object.fromEntries(maps.map(m=>[m,Math.round(clamp(base+rng.next()*20-10,50,95))])) as Record<MapId,number>;
 const nicks=roster.split(',').map(s=>s.trim());if(nicks.length!==5)throw new Error(name+'阵容不完整');
 const five=nicks.map((nickname,index)=>{const pid=`${id}-p${index+1}`;const role:Role='Rifler';

 players.push({id:pid,nickname,initialTeamId:id,nationality:null,history:[],historyCompleteness:'unknown',role,roleConfidence:'inferred',attributes:Object.fromEntries(ATTRIBUTE_KEYS.map(a=>[a,a==='awp'?55:75])) as Player['attributes'],mapProficiency:values(),source:{url,snapshotDate:'2026-10-05',confidence:'verified'},modelVersion:'ctm-balance-1'});return pid;});
 teams.push({id,name,region:'UNKNOWN',startingFive:five,initialRank:Number(rank),initialVrsPoints:Number(points),dynamics:{chemistry:Math.round(base),execution:Math.round(base+rng.next()*10-5),communication:Math.round(base+rng.next()*10-5),adaptability:Math.round(base+rng.next()*10-5),economyDiscipline:Math.round(base+rng.next()*10-5),belief:70,mapPreparation:values(),tacticFamiliarity:Object.fromEntries(maps.map(m=>[m+':default',65]))},coach:{name:`${name} · 模拟教练`,style:(['stopLoss','momentum','reactive','economist','highLeverage','opportunist'] as const)[(Number(rank)-1)%6]}});
}
const world:World={teams,players};writeFileSync('data/normalized/world.json',JSON.stringify(world,null,2)+'\n');writeFileSync('src/data/world.json',JSON.stringify(world)+'\n');
writeFileSync('data/source/import-manifest.json',JSON.stringify({url,snapshotDate:'2026-10-05',processedAt:new Date().toISOString(),teams:teams.length,players:players.length},null,2));
console.log(`导入 ${teams.length} 队 / ${players.length} 席位；国籍与履历暂缺，角色为游戏估值。`);
