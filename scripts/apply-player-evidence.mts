import {readFileSync,writeFileSync} from 'node:fs';
import {ATTRIBUTE_KEYS,type World,type Role,type PlayerProfile} from '../src/domain/types';
import {clamp} from '../src/domain/random';
const evidence=JSON.parse(readFileSync('data/source/player-evidence-2026-10-26.json','utf8'));
const recentEvidence=JSON.parse(readFileSync('data/source/player-recent-evidence-2026-10-26.json','utf8'));
const world=JSON.parse(readFileSync('data/normalized/world.json','utf8')) as World;
const report:{nickname:string;role:Role;basis:string;rank?:number}[]=[];
for(const p of world.players){
 const fact=evidence.players.find((r:{nickname:string})=>r.nickname.toLowerCase()===p.nickname.toLowerCase());
 const recent=recentEvidence.players.find((r:{nickname:string})=>r.nickname===p.nickname);
 const roleUpdate=recentEvidence.roles.find((r:{nickname:string})=>r.nickname===p.nickname);
 const awards=evidence.awards.filter((r:{nickname:string})=>r.nickname.toLowerCase()===p.nickname.toLowerCase());
 const profile:PlayerProfile=p.profile??{checkedAt:evidence.checkedAt,basis:'baseline',roles:[],metrics:[],awards:[]};
 const override=evidence.roleOverrides.find((r:{nickname:string})=>r.nickname.toLowerCase()===p.nickname.toLowerCase());
 if(override&&['Rifler','Support','Entry','Anchor'].includes(p.role)){p.role=override.role;p.roleConfidence='verified';profile.roles.push({label:override.role,asOf:override.asOf,url:override.url});}
 for(const row of evidence.roleCorroboration.filter((r:{nickname:string})=>r.nickname.toLowerCase()===p.nickname.toLowerCase()))profile.roles.push({label:row.note,asOf:row.asOf,url:row.url});
 if(fact?.nationality&&!p.nationality){p.nationality=fact.nationality;p.source.identityUrl=fact.ranking.url;}
 if(roleUpdate){p.role=roleUpdate.role;p.roleConfidence='verified';profile.roles.push({label:roleUpdate.role,asOf:roleUpdate.asOf,url:roleUpdate.url});}
 profile.ranking=fact?.ranking;profile.metrics=[...(fact?.metrics??[]),...(recent?.metrics??[])];profile.awards=awards.map((a:{label:string;url:string})=>({label:a.label,url:a.url}));
 profile.basis=fact?'ranked':recent?'sampled':p.roleConfidence==='verified'?'role-only':'baseline';p.profile=profile;
 // Transparent game calibration, not an official 0-100 assessment. No roster order, team rank or RNG.
 const recentRating=recent?.metrics.find((m:{key:string;value:number})=>m.key==='recentRating')?.value;
 const base=fact?Math.round(94-(fact.ranking.rank-1)*.45):recentRating!==undefined?Math.round(clamp(75+(recentRating-1)*25,65,90)):75;
 const a=Object.fromEntries(ATTRIBUTE_KEYS.map(key=>[key,75])) as typeof p.attributes;
 a.aim=base;a.awp=p.role==='AWPer'?base+3:55;a.entry=p.role==='Entry'?base+5:base-6;
 a.defense=p.role==='Anchor'?base+5:base-2;a.positioning=p.role==='Anchor'||p.role==='Lurker'?base+2:78;
 a.gameSense=p.role==='IGL'?88:78;a.teamwork=['IGL','Support'].includes(p.role)?85:75;
 a.utility=['IGL','Support'].includes(p.role)?85:75;a.clutch=p.role==='Lurker'?base+3:75;
 a.consistency=fact?82:75;a.peakPotential=base;
 const metric=(key:string)=>profile.metrics.find(m=>m.key===key&&m.scope==='年度文章总体样本')?.value;
 const adr=metric('adr'),kpr=metric('kpr');
 if(adr!==undefined)a.aim=Math.round(.6*base+.4*clamp(70+(adr-70)*1.1,60,99));
 if(kpr!==undefined)a.aim=Math.round(.7*a.aim+.3*clamp(75+(kpr-.65)*100,60,99));
 const overall=metric('overallRating');if(overall!==undefined)a.consistency=Math.round(clamp(75+(overall-1)*50,65,92));
 for(const award of awards){const bonus=award.place===1?5:3;if(award.category==='指挥'){a.gameSense=90+bonus;a.teamwork=87+bonus;}if(award.category==='狙击手')a.awp+=bonus;if(award.category==='守点选手')a.defense+=bonus;if(award.category==='收尾选手')a.clutch=Math.max(a.clutch,base+bonus);if(award.category==='突破选手')a.entry+=bonus;}
 // Samples are bounded evidence, not a direct conversion of profile percentiles to skill.
 if(recent){const weight=Math.min(.6,recent.maps/(recent.maps+40));const value=(key:string)=>recent.metrics.find((m:{key:string;value:number})=>m.key===key)?.value;
  if(value('firepower')!==undefined)a.aim=Math.round(a.aim*(1-weight)+(60+value('firepower')*.4)*weight);
  if(p.role==='AWPer'&&value('sniping')!==undefined)a.awp=Math.round(a.awp*(1-weight)+(60+value('sniping')*.4)*weight);
 }
 for(const key of ATTRIBUTE_KEYS)a[key]=Math.round(clamp(a[key],40,99));
 p.attributes=a;for(const key of Object.keys(p.mapProficiency))p.mapProficiency[key as keyof typeof p.mapProficiency]=75;p.modelVersion='evidence-2026-10-26-v3';
 report.push({nickname:p.nickname,role:p.role,basis:profile.basis,rank:profile.ranking?.rank});
}
writeFileSync('data/normalized/world.json',JSON.stringify(world,null,2));writeFileSync('src/data/world.json',JSON.stringify(world));
writeFileSync('data/normalized/player-evidence-audit.json',JSON.stringify({checkedAt:evidence.checkedAt,ranked:report.filter(r=>r.rank).length,roleVerified:world.players.filter(p=>p.roleConfidence==='verified').length,unverified:world.players.filter(p=>p.roleConfidence!=='verified').length,players:report},null,2));
console.log('Evidence profiles:',report.filter(r=>r.rank).length,'ranked;',world.players.filter(p=>p.roleConfidence==='verified').length,'sourced roles');
