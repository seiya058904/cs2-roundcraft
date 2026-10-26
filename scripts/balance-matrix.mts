import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto,newMapState} from '../src/domain/series.ts';
import {resolveRound} from '../src/domain/engine.ts';
import {emptyEquipment} from '../src/domain/economy.ts';
import {defaultDecision} from '../src/domain/tactics.ts';
import {validateRound} from '../src/domain/invariants.ts';
import {ATTRIBUTE_KEYS,type Decision,type MapId} from '../src/domain/types.ts';
import {reportMetadata} from './report-metadata.mts';
const metadata=reportMetadata();
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const samples=Number(process.argv.find(x=>x.startsWith('--samples='))?.split('=')[1]??300);
const world=newWorld();
for(const player of world.players){for(const key of ATTRIBUTE_KEYS)player.attributes[key]=75;for(const map of Object.keys(player.mapProficiency))player.mapProficiency[map as MapId]=75;}
for(const team of world.teams){for(const key of ['chemistry','execution','communication','adaptability','economyDiscipline','belief']as const)team.dynamics[key]=75;team.dynamics.tacticFamiliarity={};for(const map of Object.keys(team.dynamics.mapPreparation))team.dynamics.mapPreparation[map as MapId]=75;team.startingFive.forEach((id,index)=>world.players.find(p=>p.id===id)!.role=(['IGL','AWPer','Entry','Support','Lurker']as const)[index]);}
const cases=[
 {id:'equal-full',tBuy:'fullBuy',ctBuy:'fullBuy'},
 {id:'t-eco-ct-full',tBuy:'eco',ctBuy:'fullBuy'},
 {id:'t-full-ct-eco',tBuy:'fullBuy',ctBuy:'eco'},
 {id:'t-aim-95',tBuy:'fullBuy',ctBuy:'fullBuy',aim:95},
 {id:'t-aim-55',tBuy:'fullBuy',ctBuy:'fullBuy',aim:55},
 {id:'t-chemistry-95',tBuy:'fullBuy',ctBuy:'fullBuy',chemistry:95},
 {id:'t-chemistry-35',tBuy:'fullBuy',ctBuy:'fullBuy',chemistry:35},
] as const;
const reports=[];
for(const map of ['dust2','mirage','nuke']as const){
 const rows=cases.map(config=>({map,config:config.id,samples,tWins:0,tKills:0,tTrades:0,plants:0,tSpend:0,ctSpend:0}));
 for(let seed=1;seed<=samples;seed++){
  const baseline=createSeries(world,'team-3','team-7',1,seed);autoVeto(baseline);baseline.maps=[map];baseline.mapStates=[newMapState(baseline,map,'T')];resolveRound(baseline);
  for(const [index,config]of cases.entries()){
   const series=structuredClone(baseline),state=series.mapStates[0],row=rows[index];
   for(const fighter of state.fighters){fighter.cash=6000;fighter.equipment=emptyEquipment(fighter.side);}
   if('aim'in config)for(const id of series.teams[0].startingFive)series.players.find(p=>p.id===id)!.attributes.aim=config.aim;
   if('chemistry'in config)series.teams[0].dynamics.chemistry=config.chemistry;
   const attack:Decision={...defaultDecision('T'),tactic:'fastA',buy:config.tBuy,adaptive:false};
   const defense:Decision={...defaultDecision('CT'),tactic:'standard',buy:config.ctBuy,adaptive:true};
   const round=resolveRound(series,{0:attack,1:defense});assert.deepEqual(validateRound(round),[]);
   row.tWins+=Number(round.winner===0);row.tKills+=round.events.filter(e=>e.kind==='kill'&&e.team===0).length;row.tTrades+=round.events.filter(e=>e.kind==='trade'&&e.team===0).length;row.plants+=Number(round.events.some(e=>e.kind==='plant'));
   for(const book of round.economy)row[series.teams[0].startingFive.includes(book.playerId)?'tSpend':'ctSpend']+=book.spend;
  }
 }
 reports.push(...rows);console.table(rows.map(row=>({map,case:row.config,tWinRate:row.tWins/samples,kills:row.tKills/samples,trades:row.tTrades/samples})));
}
writeFileSync('docs/balance-matrix.json',JSON.stringify({...metadata,method:'Equal ability 75 and mirrored roles, controlled second-round $6000, fixed T route and reactive CT, paired seeds. Only named factor changes; descriptive game estimates.',reports},null,2));
