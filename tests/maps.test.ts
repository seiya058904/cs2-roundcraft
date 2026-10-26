import {it,expect} from 'vitest';
import {MAPS,getMap,shortestPath,sightRange} from '../src/domain/maps';

it('每图所有区域互通，但不把通路自动当成可见枪线',()=>{
 for(const map of MAPS)for(const a of map.zones)for(const b of map.zones){const path=shortestPath(map,a.id,b.id);expect(path.zones[0]).toBe(a.id);expect(path.zones.at(-1)).toBe(b.id);expect(path.seconds).toBeGreaterThanOrEqual(0);}
 const nuke=getMap('nuke');expect(sightRange(nuke,nuke.siteA,nuke.siteB)).toBeNull();expect(shortestPath(nuke,nuke.siteA,nuke.siteB).zones.length).toBeGreaterThan(2);
 const inferno=getMap('inferno');expect(sightRange(inferno,inferno.mid,inferno.alternateB)).toBeNull();
});

it('七图具有独立路线，不只是给同一个图换区域名',()=>{
 const signatures=MAPS.map(map=>map.zones.map(zone=>zone.paths.map(p=>`${map.zones.findIndex(z=>z.id===p.to)}:${p.seconds}`).sort().join(',')).join(';'));
 expect(new Set(signatures).size).toBe(7);
 const dust=getMap('dust2'),mirage=getMap('mirage');expect(shortestPath(dust,dust.tSpawn,dust.siteA).seconds).not.toBe(shortestPath(mirage,mirage.tSpawn,mirage.siteA).seconds);
});
