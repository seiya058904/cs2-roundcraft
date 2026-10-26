import {readFileSync,writeFileSync} from 'node:fs';
import type {World,Team} from '../src/domain/types.ts';
const world=JSON.parse(readFileSync('data/normalized/world.json','utf8')) as World;
const index=new Map<string,{region:Team['region'];url:string}[]>();
for(const[region,code]of [['europe','EU'],['americas','AMERICAS'],['asia','ASIA']]as const){const text=readFileSync(`data/source/valve-${region}-2026-10-05.md`,'utf8');for(const line of text.split('\n').filter(l=>/^\|\s*\d+\s*\|/.test(l))){const cells=line.split('|').map(s=>s.trim());const key=cells[4].split(',').map(s=>s.trim()).sort().join('|');index.set(key,[...(index.get(key)??[]),{region:code,url:`https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/invitation/2026/standings_${region}_2026_10_05.md`}]);}}
for(const team of world.teams){const key=team.startingFive.map(id=>world.players.find(p=>p.id===id)!.nickname).sort().join('|');const matches=index.get(key);if(matches?.length===1){team.region=matches[0].region;team.regionSource=matches[0].url;}}
writeFileSync('data/normalized/world.json',JSON.stringify(world,null,2));writeFileSync('src/data/world.json',JSON.stringify(world));console.log(Object.fromEntries(['EU','AMERICAS','ASIA','UNKNOWN'].map(region=>[region,world.teams.filter(t=>t.region===region).length])));
