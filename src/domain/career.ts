import { DEFAULT_TIMEOUT_RULES } from './rules';
import type { World, Series, Team, TeamIndex, TimeoutRules } from './types';
import { createSeries, autoVeto } from './series';
import { simulateSeries } from './engine';
import { mvp, seriesStats, mergePlayerStats, type PlayerStats } from './statistics';
import { hash, clamp } from './random';
export type EventTemplate = 'major' | 'masters' | 'premier' | 'open' | 'cup';
export interface Standing {
    teamId: string;
    wins: number;
    losses: number;
    opponents: string[];
    seed: number;
}
export interface Fixture {
    id: string;
    a: string;
    b: string;
    bestOf: 1 | 3 | 5;
    winner: string | null;
    score: [
        number,
        number
    ] | null;
    seed: number;
    stage: number;
    wave: number;
}
export interface Tournament {
    timeoutRules?: TimeoutRules;
    id: string;
    name: string;
    template: EventTemplate;
    finalBestOf?: 3 | 5;
    rulesVersion?: string;
    participants: string[];
    stage: number;
    phase: 'swiss' | 'playoffs' | 'finished';
    wave: number;
    standings: Standing[];
    fixtures: Fixture[];
    champion: string | null;
    lockedRosters: Record<string, string[]>;
    mvpId: string | null;
    playerStats: PlayerStats[];
}
export interface CalendarEvent {
    id: string;
    name: string;
    week: number;
    template: EventTemplate;
    finalBestOf?: 3 | 5;
    status: 'upcoming' | 'active' | 'finished';
    tournament: Tournament | null;
}
export interface Career {
    archivedSeasons?: {
        season: number;
        playerStats: PlayerStats[];
    }[];
    world: World;
    managedTeamId: string;
    seed: number;
    season: number;
    week: number;
    ratings: Record<string, number>;
    calendar: CalendarEvent[];
    history: {
        season: number;
        name: string;
        champion: string;
        mvpId: string | null;
    }[];
    transfers: {
        season: number;
        week: number;
        from: string;
        to: string;
        out: string;
        incoming: string;
    }[];
}
const templates: EventTemplate[] = ['cup', 'open', 'masters', 'premier', 'open', 'major', 'cup', 'masters', 'open', 'premier', 'cup', 'major'];
export const calendarFor = (season: number): CalendarEvent[] => templates.map((template, i) => ({ id: `s${season}-event-${i + 1}`, name: `${({ cup: '地区挑战杯', open: '公开巡回赛', masters: 'Masters 大师赛', premier: 'Premier 精英赛', major: 'Major 世界锦标赛' })[template]} ${i + 1}`, week: i * 4 + 1, template, finalBestOf: template === 'masters' || (template === 'major' && i === 11) ? 5 : 3, status: 'upcoming', tournament: null }));
export function createCareer(world: World, managedTeamId: string, seed: number): Career { if (!world.teams.some(t => t.id === managedTeamId))
    throw new Error('队伍不存在'); return { world: structuredClone(world), managedTeamId, seed, season: 1, week: 1, ratings: Object.fromEntries(world.teams.map(t => [t.id, t.initialVrsPoints])), calendar: calendarFor(1), history: [], transfers: [] }; }
export const rankedTeams = (c: Career) => [...c.world.teams].sort((a, b) => c.ratings[b.id] - c.ratings[a.id] || a.initialRank - b.initialRank);
export function invitationList(c: Career, event: CalendarEvent): string[] {
    const ranked = rankedTeams(c);
    let selection: Team[];
    if (event.template === 'major') {
        // Game allocation, deliberately not presented as Valve's live regional slot formula.
        const quotas: {
            region: Team['region'];
            slots: number;
        }[] = [{ region: 'EU', slots: 21 }, { region: 'AMERICAS', slots: 8 }, { region: 'ASIA', slots: 3 }];
        selection = quotas.flatMap(q => ranked.filter(t => t.region === q.region).slice(0, q.slots));
        for (const team of ranked)
            if (selection.length < 32 && !selection.some(t => t.id === team.id))
                selection.push(team);
        selection.sort((a, b) => c.ratings[b.id] - c.ratings[a.id] || a.initialRank - b.initialRank);
    }
    else if (event.template === 'masters')
        selection = ranked.slice(0, 16);
    else if (event.template === 'premier')
        selection = ranked.slice(0, 8);
    else if (event.template === 'open') {
        selection = ranked.slice(16, 32);
        if (!selection.some(t => t.id === c.managedTeamId)) {
            selection[15] = c.world.teams.find(t => t.id === c.managedTeamId)!;
        }
    }
    else {
        selection = ranked.slice(32, 40);
        if (!selection.some(t => t.id === c.managedTeamId))
            selection[7] = c.world.teams.find(t => t.id === c.managedTeamId)!;
    }
    return selection.map(t => t.id);
}
const standing = (ids: string[]): Standing[] => ids.map((teamId, seed) => ({ teamId, wins: 0, losses: 0, opponents: [], seed }));
export function pairSwissRound(table: Standing[]): [
    string,
    string
][] {
    const active = table.filter(t => t.wins < 3 && t.losses < 3);
    const groups = new Map<string, Standing[]>();
    for (const t of active) {
        const key = `${t.wins}-${t.losses}`;
        groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    const output: [
        string,
        string
    ][] = [];
    for (const group of groups.values()) {
        if (group.length % 2)
            throw new Error('瑞士轮同战绩组人数为奇数');
        const sorted = [...group].sort((a, b) => a.seed - b.seed);
        function match(rest: Standing[]): [
            string,
            string
        ][] | null { if (!rest.length)
            return []; const a = rest[0]; const candidates = rest.slice(1).sort((x, y) => Math.abs(x.seed - a.seed) - Math.abs(y.seed - a.seed)); for (const b of candidates) {
            if (a.opponents.includes(b.teamId))
                continue;
            const tail = match(rest.filter(t => t !== a && t !== b));
            if (tail)
                return [[a.teamId, b.teamId], ...tail];
        } return null; }
        const pairs = match(sorted);
        if (!pairs)
            throw new Error('找不到无重复对手的合法瑞士轮配对');
        output.push(...pairs);
    }
    return output;
}
function addFixtures(t: Tournament, pairs: [
    string,
    string
][], seed: number) { for (const [a, b] of pairs) {
    const record = t.standings.find(s => s.teamId === a);
    const bestOf = t.phase === 'swiss' ? (record && (record.wins === 2 || record.losses === 2) ? 3 : 1) : pairs.length === 1 ? (t.finalBestOf ?? (t.template === 'masters' ? 5 : 3)) : 3;
    t.fixtures.push({ id: `${t.id}-${t.stage}-${t.wave}-${t.fixtures.length}`, a, b, bestOf, winner: null, score: null, seed: hash(`${seed}-${t.id}-${t.stage}-${t.wave}-${a}-${b}`), stage: t.stage, wave: t.wave });
} }
export function createTournament(world: World, ids: string[], template: EventTemplate, id: string, name: string, seed: number, finalBestOf: 3 | 5 = template === 'masters' ? 5 : 3): Tournament {
    const expected = template === 'major' ? 32 : template === 'premier' || template === 'cup' ? 8 : 16;
    if (ids.length !== expected || new Set(ids).size !== expected)
        throw new Error('赛事参赛数量不合法');
    const swiss = template === 'major' || template === 'masters' || template === 'open';
    const initial = template === 'major' ? ids.slice(16, 32) : ids;
    const t: Tournament = { timeoutRules: { ...DEFAULT_TIMEOUT_RULES }, id, name, template, finalBestOf, rulesVersion: template === 'major' ? (finalBestOf === 5 ? 'budapest-2025-final-bo5-inspired' : 'valve-supplemental-bo3') : 'ctm-tournaments-1', participants: [...ids], stage: 1, phase: swiss ? 'swiss' : 'playoffs', wave: 1, standings: standing(initial), fixtures: [], champion: null, lockedRosters: Object.fromEntries(ids.map(id => { const team = world.teams.find(t => t.id === id); if (!team || team.startingFive.length !== 5)
            throw new Error('阵容不完整'); return [id, [...team.startingFive]]; })), mvpId: null, playerStats: [] };
    addFixtures(t, swiss ? pairSwissRound(t.standings) : initial.slice(0, initial.length / 2).map((a, i) => [a, initial[initial.length - 1 - i]]), seed);
    return t;
}
export function nextFixture(t: Tournament, preferredTeam?: string) { return t.fixtures.find(f => !f.winner && (f.a === preferredTeam || f.b === preferredTeam)) ?? t.fixtures.find(f => !f.winner); }
export function fixtureSeries(world: World, t: Tournament, f: Fixture): Series {
    if (f.winner)
        throw new Error('该比赛已经结算');
    const copy = structuredClone(world);
    for (const team of copy.teams)
        if (t.lockedRosters[team.id])
            team.startingFive = [...t.lockedRosters[team.id]];
    const series = createSeries(copy, f.a, f.b, f.bestOf, f.seed, t.timeoutRules);
    series.higherSeed = t.participants.indexOf(f.a) < t.participants.indexOf(f.b) ? 0 : 1;
    series.vetoA = series.higherSeed;
    return series;
}
export function recordFixture(t: Tournament, fid: string, s: Series, seed: number) {
    const f = t.fixtures.find(f => f.id === fid);
    if (!f || f.winner)
        throw new Error('比赛已结算或不存在');
    if (s.winner === null || s.status !== 'finished' || s.bestOf !== f.bestOf || s.teams[0].id !== f.a || s.teams[1].id !== f.b || s.teams.some(team => team.startingFive.some((id, i) => id !== t.lockedRosters[team.id]?.[i])))
        throw new Error('比赛结果与赛程或锁定阵容不匹配');
    f.winner = s.teams[s.winner].id;
    f.score = [...s.score];
    t.playerStats = mergePlayerStats([t.playerStats, seriesStats(s)]);
    t.mvpId = [...t.playerStats].sort((a, b) => b.rating - a.rating)[0]?.id ?? mvp(s)?.id ?? null;
    if (t.phase === 'swiss') {
        const a = t.standings.find(x => x.teamId === f.a)!, b = t.standings.find(x => x.teamId === f.b)!;
        a.opponents.push(b.teamId);
        b.opponents.push(a.teamId);
        (f.winner === a.teamId ? a : b).wins++;
        (f.winner === a.teamId ? b : a).losses++;
    }
    if (t.fixtures.some(f => !f.winner))
        return;
    if (t.phase === 'swiss') {
        const active = t.standings.filter(x => x.wins < 3 && x.losses < 3);
        if (active.length) {
            t.wave++;
            addFixtures(t, pairSwissRound(t.standings), seed);
            return;
        }
        const qualified = t.standings.filter(x => x.wins === 3).sort((a, b) => a.losses - b.losses || a.seed - b.seed).map(x => x.teamId);
        if (qualified.length !== 8)
            throw new Error('瑞士轮晋级人数错误');
        if (t.template === 'major' && t.stage < 3) {
            const newcomers = t.stage === 1 ? t.participants.slice(8, 16) : t.participants.slice(0, 8);
            t.stage++;
            t.wave = 1;
            t.standings = standing([...newcomers, ...qualified]);
            addFixtures(t, pairSwissRound(t.standings), seed);
            return;
        }
        t.phase = 'playoffs';
        t.stage++;
        t.wave = 1;
        addFixtures(t, qualified.slice(0, 4).map((a, i) => [a, qualified[7 - i]]), seed);
        return;
    }
    const winners = t.fixtures.filter(f => f.stage === t.stage && f.wave === t.wave).map(f => f.winner!);
    if (winners.length === 1) {
        t.phase = 'finished';
        t.champion = winners[0];
        return;
    }
    t.wave++;
    addFixtures(t, winners.filter((_, i) => i % 2 === 0).map((a, i) => [a, winners[i * 2 + 1]]), seed);
}
export function startEvent(c: Career, id: string) { const e = c.calendar.find(e => e.id === id); if (!e || e.status !== 'upcoming')
    throw new Error('赛事不可开启'); if (c.calendar.some(e => e.status === 'active'))
    throw new Error('请先完成进行中的赛事'); if (c.calendar.some(previous => previous.week < e.week && previous.status !== 'finished'))
    throw new Error('请先推进此前赛事，赛历不能倒退'); e.tournament = createTournament(c.world, invitationList(c, e), e.template, e.id, e.name, c.seed, e.finalBestOf); e.status = 'active'; c.week = e.week; return e; }
export function applyCareerResult(c: Career, eventId: string, fixtureId: string, s: Series) {
    const e = c.calendar.find(e => e.id === eventId);
    if (!e?.tournament || e.status !== 'active')
        throw new Error('赛事未开启');
    const t = e.tournament;
    recordFixture(t, fixtureId, s, c.seed);
    const a = s.teams[0].id, b = s.teams[1].id, expected = 1 / (1 + 10 ** ((c.ratings[b] - c.ratings[a]) / 400)), k = e.template === 'major' ? 28 : e.template === 'cup' ? 12 : 20;
    const delta = k * ((s.winner === 0 ? 1 : 0) - expected);
    c.ratings[a] += delta;
    c.ratings[b] -= delta;
    for (const team of s.teams) {
        const target = c.world.teams.find(t => t.id === team.id)!;
        target.dynamics = structuredClone(team.dynamics);
    }
    if (t.phase === 'finished') {
        e.status = 'finished';
        c.history.push({ season: c.season, name: e.name, champion: t.champion!, mvpId: t.mvpId });
    }
}
export function simulateCareerFixture(c: Career, eventId: string) { const e = c.calendar.find(x => x.id === eventId); if (!e?.tournament)
    throw new Error('赛事未开启'); const f = nextFixture(e.tournament); if (!f)
    return; const s = fixtureSeries(c.world, e.tournament, f); autoVeto(s); simulateSeries(s); applyCareerResult(c, eventId, f.id, s); }
export function nextSeason(c: Career) { if (c.calendar.some(e => e.status !== 'finished'))
    throw new Error('本赛季尚未全部完成'); c.archivedSeasons ??= []; c.archivedSeasons.push({ season: c.season, playerStats: careerPlayerStats(c) }); c.season++; c.week = 1; c.calendar = calendarFor(c.season); }
export function exchangePlayers(c: Career, otherTeamId: string, outgoing: string, incoming: string) {
    if (c.calendar.some(e => e.status === 'active'))
        throw new Error('赛事期间名单锁定，请在赛事结束后的转会窗口操作');
    const mine = c.world.teams.find(t => t.id === c.managedTeamId)!, other = c.world.teams.find(t => t.id === otherTeamId);
    if (!other || other.id === mine.id || !mine.startingFive.includes(outgoing) || !other.startingFive.includes(incoming))
        throw new Error('转会对象无效');
    const a = c.world.players.find(p => p.id === outgoing)!, b = c.world.players.find(p => p.id === incoming)!;
    if (b.role === 'AWPer' && a.role !== 'AWPer' && other.startingFive.filter(id => c.world.players.find(p => p.id === id)!.role === 'AWPer').length === 1)
        throw new Error('对方唯一主狙无法直接换走；请用主狙交换，保留对方角色完整性');
    if (c.ratings[other.id] - c.ratings[mine.id] > 300)
        throw new Error('模拟转会判定：队伍地位差距过大，先通过公开赛提升排名');
    mine.startingFive[mine.startingFive.indexOf(outgoing)] = incoming;
    other.startingFive[other.startingFive.indexOf(incoming)] = outgoing;
    for (const t of [mine, other]) {
        t.dynamics.chemistry = clamp(t.dynamics.chemistry - 12, 30, 100);
        for (const key of Object.keys(t.dynamics.tacticFamiliarity))
            t.dynamics.tacticFamiliarity[key] = clamp(t.dynamics.tacticFamiliarity[key] - 6);
    }
    c.transfers.push({ season: c.season, week: c.week, from: other.id, to: mine.id, out: outgoing, incoming });
}
export function careerPlayerStats(c: Career, allSeasons = false): PlayerStats[] { return mergePlayerStats([...(allSeasons ? (c.archivedSeasons ?? []).map(s => s.playerStats) : []), ...c.calendar.flatMap(e => e.tournament ? [e.tournament.playerStats] : [])]); }
