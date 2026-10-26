import{readFileSync,writeFileSync}from'node:fs';
import type{World,Role}from'../src/domain/types.ts';
type Identity={player_id:string;identity:{handle:string;country?:string};team_history:{name:string;as_of:string;source_ids:string[]}[];roles:{name:string;as_of:string;source_ids:string[]}[];sources:{source_id:string;url:string;retrieved_at:string;notes:string}[]};
const rows=readFileSync('data/source/identity.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l) as Identity);
const world=JSON.parse(readFileSync('data/normalized/world.json','utf8')) as World;
const aliases:Record<string,string[]>={'FaZe':['FaZe Clan'],'Vitality':['Team Vitality'],'Natus Vincere':['Natus Vincere','NAVI'],'Ninjas in Pyjamas':['Ninjas in Pyjamas','NIP'],'BETBOOM':['BetBoom Team'],'Falcons':['Team Falcons'],'Liquid':['Team Liquid'],'Spirit':['Team Spirit'],'The MongolZ':['The MongolZ']};
const normalize=(s:string)=>s.toLowerCase().replace(/^team\s+/,'').replace(/\s+(esports|gaming|team|cs)$/,'').replace(/[^a-z0-9]/g,'');let verified=0;const retained=[];
for(const p of world.players){const team=world.teams.find(t=>t.id===p.initialTeamId)!;const names=[team.name,...(aliases[team.name]??[])].map(normalize);const candidates=rows.filter(r=>r.identity.handle.toLowerCase()===p.nickname.toLowerCase()&&r.team_history.some(h=>names.includes(normalize(h.name))));
 if(candidates.length!==1)continue;const r=candidates[0];if(!r.sources.length)continue;p.nationality=r.identity.country??null;p.source.identityUrl=r.sources[0].url;
 // A single current-team observation is not a complete transfer history. Keep only different teams.
 p.history=[...new Set(r.team_history.filter(h=>!names.includes(normalize(h.name))).map(h=>h.name))];p.historyCompleteness=p.history.length?'partial':'unknown';
 const observed=[...r.roles].sort((a,b)=>b.as_of.localeCompare(a.as_of))[0];
 const tokens=observed?.name.toLowerCase().split(/[,/]/).map(x=>x.trim()).filter(Boolean)??[];
 const roleMap:Record<string,Role>={igl:'IGL',awp:'AWPer',awper:'AWPer',entry:'Entry',entryfragger:'Entry',support:'Support',lurk:'Lurker',lurker:'Lurker',rifle:'Rifler',rifler:'Rifler',anchor:'Anchor'};
 // Rifle + secondary AWP is not automatically a primary AWPer. Prefer IGL, otherwise the first listed playing role.
 const role=tokens.includes('igl')?'IGL':tokens.map(t=>roleMap[t]).find(Boolean);
 if(role){p.role=role;p.roleConfidence='verified';}
 const source=r.sources.find(s=>observed?.source_ids.includes(s.source_id))??r.sources[0];
 p.profile={checkedAt:'2026-10-26',basis:role?'role-only':'baseline',roles:observed?[{label:observed.name,asOf:observed.as_of,url:source.url}]:[],metrics:[],awards:[]};

 retained.push({playerId:p.id,sourcePlayerId:r.player_id,nickname:p.nickname,nationality:p.nationality,roles:r.roles,teamObservations:r.team_history,sources:r.sources,attribution:'Liquipedia contributors, CC BY-SA 3.0',identityMatch:'case-insensitive exact handle plus corroborating team; Team/Esports/Gaming/CS affixes normalized; unique candidate required'});verified++;
}
writeFileSync('data/normalized/identity-attribution.json',JSON.stringify(retained,null,2));
writeFileSync('data/normalized/world.json',JSON.stringify(world,null,2));writeFileSync('src/data/world.json',JSON.stringify(world));
// Keep a minimal licensed upstream subset only: no names, birth dates or platform identifiers.
writeFileSync('data/source/identity.jsonl',rows.map(r=>JSON.stringify({player_id:r.player_id,identity:{handle:r.identity.handle,country:r.identity.country},team_history:r.team_history,roles:r.roles,sources:r.sources})).join('\n')+'\n');
console.log(`昵称与队伍共同交叉确认 ${verified} 人；其余保留 unknown，不按昵称单独猜测。`);
