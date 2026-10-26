import {createHash} from 'node:crypto';
import {newWorld} from '../src/data/index.ts';
import {createSeries,autoVeto,newMapState} from '../src/domain/series.ts';
import {simulateSeries} from '../src/domain/engine.ts';
import {MAPS} from '../src/domain/maps.ts';
const signature=createHash('sha256');
for(let seed=1;seed<=42;seed++){
 const series=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(series);const map=MAPS[seed%MAPS.length];series.maps=[map.id];series.mapStates=[newMapState(series,map.id,seed%2?'T':'CT')];simulateSeries(series);signature.update(JSON.stringify(series));
}
console.log(signature.digest('hex'));
