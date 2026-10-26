import type { GameMap, MapId, Zone } from './types';
// Each edge is a bidirectional abstract traversable route. Travel times are game estimates.
function map(id: MapId, name: string, labels: string[], edges: [
    number,
    number,
    number
][]): GameMap {
    const zones: Zone[] = labels.map((name, i) => ({ id: `${id}-${i}`, name, site: i === 2 || i === 4 || i === 7 ? 'A' : i === 3 || i === 5 || i === 8 ? 'B' : i === 6 ? 'mid' : 'neutral', cover: [0, 0, 0.65, 0.7, 0.35, 0.65, 0.2, 0.65, 0.55, 0.8, 0.5][i % 11], range: i === 6 || i === 4 ? 'long' : i === 5 || i === 8 ? 'close' : 'mid', paths: [], sightlines: [] }));
    const siteShapes: Record<MapId, [
        number,
        Zone['range'],
        number,
        Zone['range']
    ]> = { dust2: [.5, 'long', .75, 'close'], mirage: [.7, 'mid', .7, 'close'], inferno: [.75, 'close', .8, 'mid'], nuke: [.75, 'close', .7, 'mid'], ancient: [.65, 'mid', .65, 'long'], anubis: [.6, 'mid', .75, 'mid'], cache: [.55, 'long', .75, 'close'] };
    const [aCover, aRange, bCover, bRange] = siteShapes[id];
    Object.assign(zones[2], { cover: aCover, range: aRange });
    Object.assign(zones[3], { cover: bCover, range: bRange });
    for (const [a, b, seconds] of edges) {
        zones[a].paths.push({ to: zones[b].id, seconds });
        zones[b].paths.push({ to: zones[a].id, seconds });
    }
    const sightlines: [
        number,
        number,
        Zone['range']
    ][] = id === 'nuke' ? [[2, 4, 'close'], [2, 7, 'close'], [3, 5, 'long'], [3, 10, 'mid'], [6, 1, 'long']] : [[2, 4, 'long'], [2, 7, 'mid'], [3, 5, 'close'], [3, 8, 'mid'], [6, 7, 'mid'], [6, 8, 'mid']];
    if (id === 'dust2')
        sightlines.push([9, 2, 'long'], [6, 1, 'long']);
    if (id === 'mirage')
        sightlines.push([10, 6, 'long'], [9, 2, 'mid'], [11, 3, 'mid']);
    if (id === 'inferno') {
        sightlines.splice(0, sightlines.length, [2, 4, 'mid'], [2, 7, 'close'], [3, 5, 'long'], [3, 8, 'mid'], [6, 4, 'long'], [10, 4, 'mid'], [11, 2, 'mid']);
    }
    for (const [a, b, range] of sightlines) {
        zones[a].sightlines.push({ to: zones[b].id, range });
        zones[b].sightlines.push({ to: zones[a].id, range });
    }
    return { id, name, zones, tSpawn: zones[0].id, ctSpawn: zones[1].id, siteA: zones[2].id, siteB: zones[3].id, laneA: zones[4].id, laneB: zones[5].id, mid: zones[6].id, alternateA: zones[7].id, alternateB: zones[8].id };
}
export const MAPS: GameMap[] = [
    map('dust2', 'Dust II', ['T 出生点', 'CT 出生点', 'A 平台', 'B 包点', 'A 大道', 'B 洞', '中路', 'A 小道', 'B 门', 'A 坑', 'A 大门'], [[0, 10, 5], [10, 4, 4], [4, 2, 8], [4, 9, 2], [9, 2, 9], [0, 5, 9], [5, 3, 5], [0, 6, 6], [6, 7, 5], [7, 2, 5], [6, 8, 3], [8, 3, 3], [1, 2, 5], [1, 8, 4], [1, 6, 4]]),
    map('mirage', 'Mirage', ['T 出生点', 'CT 出生点', 'A 包点', 'B 包点', 'A 坡', 'B 公寓', '中路', '拱门', 'B 短', '宫殿', '窗口', '超市'], [[0, 4, 7], [4, 2, 5], [0, 5, 11], [5, 3, 6], [0, 6, 6], [6, 7, 4], [7, 2, 4], [6, 8, 6], [8, 3, 5], [0, 9, 9], [9, 2, 4], [6, 10, 4], [10, 1, 5], [1, 2, 4], [1, 11, 5], [11, 3, 3]]),
    map('inferno', 'Inferno', ['T 出生点', 'CT 出生点', 'A 包点', 'B 包点', '中路上段', '香蕉道', '中路', 'A 公寓', '教堂', '二楼侧道', '拱门', '书房'], [[0, 6, 7], [6, 4, 5], [4, 2, 5], [0, 5, 8], [5, 3, 9], [0, 9, 6], [9, 7, 6], [7, 2, 4], [6, 9, 3], [4, 10, 3], [10, 1, 6], [10, 11, 3], [11, 2, 3], [11, 1, 4], [1, 8, 4], [8, 3, 4]]),
    map('nuke', 'Nuke', ['T 出生点', 'CT 出生点', 'A 上层', 'B 下层', '小屋', '铁板坡道', '外场', '黄门', '秘密通道', '通风管', '控制室'], [[0, 4, 8], [4, 2, 4], [0, 5, 10], [5, 3, 8], [0, 6, 7], [6, 8, 7], [8, 3, 8], [0, 7, 9], [7, 2, 3], [1, 2, 5], [1, 6, 4], [1, 5, 6], [2, 9, 4], [9, 3, 4], [3, 10, 3], [5, 10, 5]]),
    map('ancient', 'Ancient', ['T 出生点', 'CT 出生点', 'A 包点', 'B 包点', 'A 大道', 'B 主道', '中路', '甜甜圈', '洞穴', '神庙'], [[0, 4, 9], [4, 2, 5], [0, 5, 10], [5, 3, 7], [0, 6, 7], [6, 7, 4], [7, 2, 4], [6, 8, 6], [8, 3, 5], [1, 9, 4], [9, 2, 3], [1, 3, 5]]),
    map('anubis', 'Anubis', ['T 出生点', 'CT 出生点', 'A 包点', 'B 包点', 'A 主道', 'B 主道', '中路', 'A 连接', '运河', '水道', 'B 连接'], [[0, 9, 6], [9, 4, 5], [4, 2, 5], [0, 5, 10], [5, 3, 6], [0, 6, 8], [6, 7, 5], [7, 2, 5], [6, 10, 4], [10, 3, 4], [9, 8, 4], [8, 5, 4], [8, 10, 5], [1, 2, 6], [1, 10, 5]]),
    map('cache', 'Cache', ['T 出生点', 'CT 出生点', 'A 包点', 'B 包点', 'A 大道', 'B 主道', '中路', '公路', '通风管', '车库', 'B 树房'], [[0, 4, 8], [4, 2, 6], [0, 5, 10], [5, 3, 5], [0, 9, 4], [9, 6, 4], [6, 7, 6], [7, 2, 4], [6, 8, 4], [8, 3, 5], [1, 2, 5], [1, 7, 4], [1, 10, 5], [10, 3, 3]])
];
export const getMap = (id: MapId) => { const result = MAPS.find(m => m.id === id); if (!result)
    throw new Error('未知地图'); return result; };
export const getZone = (map: GameMap, id: string) => { const zone = map.zones.find(z => z.id === id); if (!zone)
    throw new Error(`非法地图区域 ${id}`); return zone; };
export function sightRange(map: GameMap, from: string, to: string): Zone['range'] | null { return from === to ? getZone(map, from).range : getZone(map, from).sightlines.find(s => s.to === to)?.range ?? null; }
export function shortestPath(map: GameMap, from: string, to: string): {
    zones: string[];
    seconds: number;
} {
    getZone(map, from);
    getZone(map, to);
    const distances = new Map<string, number>([[from, 0]]);
    const prev = new Map<string, string>();
    const pending = new Set(map.zones.map(z => z.id));
    while (pending.size) {
        const u = [...pending].sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity))[0];
        pending.delete(u);
        if (u === to)
            break;
        for (const e of getZone(map, u).paths) {
            const d = (distances.get(u) ?? Infinity) + e.seconds;
            if (d < (distances.get(e.to) ?? Infinity)) {
                distances.set(e.to, d);
                prev.set(e.to, u);
            }
        }
    }
    if (!distances.has(to))
        throw new Error('地图区域不连通');
    const zones = [to];
    while (zones[0] !== from)
        zones.unshift(prev.get(zones[0])!);
    return { zones, seconds: distances.get(to)! };
}
