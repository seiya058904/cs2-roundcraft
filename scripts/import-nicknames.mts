import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync('data/source/nickname-map.md','utf8');
const players:{canonical:string;aliases:string[]}[]=[],teams:{canonical:string;aliases:string[]}[]=[];
let section:'players'|'teams'|null=null;
for(const line of source.split(/\r?\n/)){
 if(line==='## 选手绰号')section='players';
 else if(line==='## 队伍绰号')section='teams';
 else if(line.startsWith('## '))section=null;
 if(!section||!line.startsWith('|'))continue;
 const cells=line.split('|').slice(1,-1).map(x=>x.trim());
 if(cells.length<2||!cells[0]||!cells[1]||cells[0]==='绰号'||cells[0].startsWith('---')||cells.some(c=>c.includes('待核对')))continue;
 const row={canonical:cells[1],aliases:cells[0].split('、').map(x=>x.trim()).filter(Boolean)};
 (section==='players'?players:teams).push(row);
}
for(const rows of [players,teams])if(new Set(rows.map(r=>r.canonical.toLowerCase())).size!==rows.length)throw new Error('存在重复英文身份，需要核对');
const result={source:'nickname-map.md',format:'首选绰号（真实英文名）',players,teams};
writeFileSync('src/data/nicknames.json',JSON.stringify(result,null,2));
const world=JSON.parse(readFileSync('src/data/world.json','utf8'));
const matched=players.filter(row=>world.players.some((p:{nickname:string})=>p.nickname.toLowerCase()===row.canonical.toLowerCase()));
writeFileSync('data/normalized/nickname-manifest.json',JSON.stringify({players:players.length,teams:teams.length,matchedPlayers:matched.length,notInSnapshot:players.filter(p=>!matched.includes(p)).map(p=>p.canonical),policy:result.format,caseInsensitiveIdentity:true,unmappedNames:'保留原英文，不编绰号',excluded:'空白、待核对、小夫'},null,2));
console.log(`选手绰号 ${players.length} 条（快照匹配 ${matched.length}），队伍绰号 ${teams.length} 条`);
