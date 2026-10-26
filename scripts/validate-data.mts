import {initialWorld} from '../src/data/index.ts';
import {ATTRIBUTE_KEYS} from '../src/domain/types.ts';
import assert from 'node:assert/strict';
const{teams,players}=initialWorld;assert.equal(teams.length,50);assert.equal(players.length,250);assert.equal(new Set(players.map(p=>p.id)).size,250);
const slots=teams.flatMap(t=>{assert.equal(t.startingFive.length,5);return t.startingFive;});assert.equal(new Set(slots).size,250);
for(const p of players){assert.equal(p.source.snapshotDate,'2026-10-05');assert.ok(slots.includes(p.id));for(const key of ATTRIBUTE_KEYS)assert.ok(p.attributes[key]>=0&&p.attributes[key]<=100);}
console.log(JSON.stringify({teams:teams.length,players:players.length,verifiedRosterSeats:250,nationalityKnown:players.filter(p=>p.nationality).length,historyKnown:players.filter(p=>p.history.length).length,inferredRoles:players.filter(p=>p.roleConfidence==='inferred').length},null,2));
