import {BATTLE_ENGINE} from './battlePlan';
import type { Series, World, MapId, TeamIndex, Side, MapState, TimeoutRules } from './types';
import { DEFAULT_TIMEOUT_RULES } from './rules';
import { MAPS } from './maps';
import { ECONOMY, emptyEquipment } from './economy';
export function sidesForRound(start: Side, roundIndex: number): [
    Side,
    Side
] { const flipped = roundIndex < 24 ? Math.floor(roundIndex / 12) % 2 : Math.floor((roundIndex - 24) / 3) % 2; const first = flipped ? (start === 'T' ? 'CT' : 'T') : start; return [first, first === 'T' ? 'CT' : 'T']; }
export function mapWinner(score: [
    number,
    number
]): TeamIndex | null {
    const sum = score[0] + score[1];
    if (sum <= 24) {
        if (score[0] >= 13)
            return 0;
        if (score[1] >= 13)
            return 1;
        return null;
    }
    const block = Math.floor((sum - 25) / 6);
    const target = 16 + block * 3;
    if (score[0] >= target)
        return 0;
    if (score[1] >= target)
        return 1;
    return null;
}
export function createSeries(world: World, a: string, b: string, bestOf: 1 | 3 | 5, seed: number, timeoutRules: TimeoutRules = { ...DEFAULT_TIMEOUT_RULES }): Series {
    if (a === b)
        throw new Error('请选择两支不同的队伍');
    const ta = world.teams.find(t => t.id === a), tb = world.teams.find(t => t.id === b);
    if (!ta || !tb)
        throw new Error('队伍不存在');
    const ids = [...ta.startingFive, ...tb.startingFive];
    if (ids.length !== 10 || new Set(ids).size !== 10 || ids.some(id => !world.players.some(p => p.id === id)))
        throw new Error('双方必须拥有不重复的五人阵容');
    return { engineVersion: BATTLE_ENGINE, higherSeed: ta.initialRank <= tb.initialRank ? 0 : 1, timeoutRules: { ...timeoutRules }, id: `match-${seed}-${a}-${b}`, seed: seed >>> 0, rngState: seed >>> 0, bestOf, teams: structuredClone([ta, tb]), players: structuredClone(world.players.filter(p => ids.includes(p.id))), veto: [], vetoA: ta.initialRank <= tb.initialRank ? 0 : 1, startingSides: {}, maps: [], mapStates: [], score: [0, 0], winner: null, status: 'veto' };
}
export function vetoStep(series: Series): {
    team: TeamIndex;
    kind: 'ban' | 'pick';
} | null {
    if (series.status !== 'veto')
        return null;
    const n = series.veto.length;
    const kinds = series.bestOf === 1 ? ['ban', 'ban', 'ban', 'ban', 'ban', 'ban'] : series.bestOf === 3 ? ['ban', 'ban', 'pick', 'pick', 'ban', 'ban'] : ['ban', 'ban', 'pick', 'pick', 'pick', 'pick'];
    const order: TeamIndex[] = series.bestOf === 1 ? [0, 0, 1, 1, 1, 0] : series.bestOf === 3 ? [0, 1, 0, 1, 1, 0] : [0, 1, 0, 1, 0, 1];
    return n < kinds.length ? { team: ((sidesA(series) === 0 ? order[n] : 1 - order[n]) as TeamIndex), kind: kinds[n] as 'ban' | 'pick' } : null;
}
export const availableMaps = (s: Series) => MAPS.filter(m => !s.veto.some(a => a.map === m.id));
export function vetoMap(s: Series, map: MapId) {
    const step = vetoStep(s);
    if (!step || !availableMaps(s).some(m => m.id === map))
        throw new Error('非法禁选图');
    s.veto.push({ ...step, map });
    if (step.kind === 'pick')
        s.maps.push(map);
    if (s.veto.length === 6) {
        s.maps.push(availableMaps(s)[0].id);
        if (s.maps.length !== s.bestOf)
            throw new Error('选图数量不符合系列赛');
        s.startingSides ??= {};
        for (const id of s.maps)
            s.startingSides[id] = sideChooser(s, id) === 0 ? 'CT' : 'T';
        s.status = 'playing';
        s.mapStates.push(newMapState(s, s.maps[0]));
    }
}
export function autoVeto(s: Series, stopAtTeam?: TeamIndex) { while (s.status === 'veto') {
    const step = vetoStep(s)!;
    if (step.team === stopAtTeam)
        break;
    const mine = s.teams[step.team], other = s.teams[step.team === 0 ? 1 : 0];
    const maps = availableMaps(s).sort((a, b) => { const value = (m: MapId) => mine.dynamics.mapPreparation[m] - other.dynamics.mapPreparation[m] * .6; return step.kind === 'pick' ? value(b.id) - value(a.id) : value(a.id) - value(b.id); });
    vetoMap(s, maps[0].id);
} }
export function newMapState(s: Series, map: MapId, startSide: Side = s.startingSides?.[map] ?? 'T'): MapState {
    const sides = sidesForRound(startSide, 0);
    return { timeoutRules: { ...(s.timeoutRules ?? DEFAULT_TIMEOUT_RULES) }, map, score: [0, 0], startSide, rounds: [], fighters: s.teams.flatMap((t, i) => t.startingFive.map(id => ({ id, team: i as TeamIndex, side: sides[i], hp: 100, alive: true, cash: ECONOMY.startCash, equipment: emptyEquipment(sides[i]), zone: '', blindedUntil: 0, hasBomb: false }))), lossTiers: [1, 1], timeoutsUsed: [0, 0], effects: [null, null], timeoutHistory: [], winner: null };
}
export function completeMap(s: Series) { const map = s.mapStates.at(-1)!; if (map.winner === null)
    return; s.score[map.winner]++; if (s.score[map.winner] > s.bestOf / 2) {
    s.winner = map.winner;
    s.status = 'finished';
}
else {
    s.mapStates.push(newMapState(s, s.maps[s.mapStates.length]));
} }
const sidesA = (s: Series): TeamIndex => s.vetoA ?? 0;
export function chooseVetoOrder(s: Series, chooser: TeamIndex, as: 'A' | 'B') {
    if (s.status !== 'veto' || s.veto.length)
        throw new Error('禁选已经开始，不能更换顺序');
    const higher: TeamIndex = s.higherSeed ?? (s.teams[0].initialRank <= s.teams[1].initialRank ? 0 : 1);
    if (chooser !== higher)
        throw new Error('仅高种子队伍可选择 A/B 顺序');
    s.vetoA = as === 'A' ? chooser : (1 - chooser) as TeamIndex;
}
export function sideChooser(s: Series, map: MapId): TeamIndex {
    const picked = s.veto.find(v => v.kind === 'pick' && v.map === map);
    return picked ? (1 - picked.team) as TeamIndex : (1 - sidesA(s)) as TeamIndex;
}
export function chooseStartingSide(s: Series, map: MapId, chooser: TeamIndex, side: Side) {
    if (!s.maps.includes(map) || sideChooser(s, map) !== chooser || !['T', 'CT'].includes(side))
        throw new Error('没有本图选边权');
    const state = s.mapStates.find(m => m.map === map);
    if (state?.rounds.length)
        throw new Error('地图已经开打，不能改选边');
    const first = chooser === 0 ? side : side === 'T' ? 'CT' : 'T';
    s.startingSides ??= {};
    s.startingSides[map] = first;
    if (state) {
        state.startSide = first;
        for (const f of state.fighters) {
            f.side = sidesForRound(first, 0)[f.team];
            f.equipment = emptyEquipment(f.side);
        }
    }
}
