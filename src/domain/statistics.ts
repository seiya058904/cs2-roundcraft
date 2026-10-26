import type { RoundResult, Series } from './types';
export interface PlayerStats {
    id: string;
    rounds: number;
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    kastRounds: number;
    openingKills: number;
    openingDeaths: number;
    clutchAttempts: number;
    clutchWins: number;
    multiKills: number;
    utilityDamage: number;
    flashAssists: number;
    ctRounds: number;
    tRounds: number;
    adr: number;
    kast: number;
    rating: number;
}
export const COUNT_STAT_KEYS = ['rounds', 'kills', 'deaths', 'assists', 'damage', 'kastRounds', 'openingKills', 'openingDeaths', 'clutchAttempts', 'clutchWins', 'multiKills', 'utilityDamage', 'flashAssists', 'ctRounds', 'tRounds'] as const;
export function mergePlayerStats(groups: PlayerStats[][]): PlayerStats[] {
    const combined = new Map<string, PlayerStats>();
    for (const group of groups)
        for (const row of group) {
            const existing = combined.get(row.id);
            if (!existing)
                combined.set(row.id, { ...row });
            else
                for (const key of COUNT_STAT_KEYS)
                    existing[key] += row[key];
        }
    return [...combined.values()].map(s => ({ ...s, adr: s.rounds ? s.damage / s.rounds : 0, kast: s.rounds ? 100 * s.kastRounds / s.rounds : 0, rating: s.rounds ? .35 * s.kills / s.rounds + .25 * (1 - s.deaths / s.rounds) + .25 * s.damage / s.rounds / 80 + .15 * s.kastRounds / s.rounds : 0 }));
}
export function aggregateStats(rounds: RoundResult[]): PlayerStats[] {
    const stats = new Map<string, PlayerStats>();
    for (const r of rounds) {
        for (const f of r.initial) {
            if (!stats.has(f.id))
                stats.set(f.id, { id: f.id, rounds: 0, kills: 0, deaths: 0, assists: 0, damage: 0, kastRounds: 0, openingKills: 0, openingDeaths: 0, clutchAttempts: 0, clutchWins: 0, multiKills: 0, utilityDamage: 0, flashAssists: 0, ctRounds: 0, tRounds: 0, adr: 0, kast: 0, rating: 0 });
            const s = stats.get(f.id)!;
            s.rounds++;
            s[f.side === 'CT' ? 'ctRounds' : 'tRounds']++;
        }
        const kills = r.events.filter(e => e.kind === 'kill'), first = kills[0];
        if (first) {
            stats.get(first.actor!)!.openingKills++;
            stats.get(first.target!)!.openingDeaths++;
        }
        const credited = new Set<string>();
        for (const e of r.events.filter(e => e.kind === 'damage')) {
            const s = stats.get(e.actor!)!;
            s.damage += e.damage!;
            if (e.weapon === 'HE' || e.weapon === 'fire')
                s.utilityDamage += e.damage!;
        }
        for (const k of kills) {
            stats.get(k.actor!)!.kills++;
            stats.get(k.target!)!.deaths++;
            credited.add(k.actor!);
            const helpers = new Set(r.events.filter(e => e.kind === 'damage' && e.target === k.target && e.actor !== k.actor && e.at <= k.at && e.damage! >= 1).map(e => e.actor!));
            const assisters = new Set<string>();
            for (const id of helpers) {
                const total = r.events.filter(e => e.kind === 'damage' && e.actor === id && e.target === k.target && e.at <= k.at).reduce((s, e) => s + e.damage!, 0);
                if (total >= 40)
                    assisters.add(id);
            }
            const flash = r.events.find(e => e.kind === 'blind' && e.target === k.target && e.actor !== k.actor && e.at <= k.at && Number(e.detail.until) >= k.at);
            if (flash) {
                stats.get(flash.actor!)!.flashAssists++;
                assisters.add(flash.actor!);
            }
            for (const id of assisters) {
                stats.get(id)!.assists++;
                credited.add(id);
            }
        }
        for (const e of r.events.filter(e => e.kind === 'trade'))
            credited.add(e.target!);
        for (const f of r.final)
            if (f.alive)
                credited.add(f.id);
        for (const id of credited)
            stats.get(id)!.kastRounds++;
        for (const f of r.initial) {
            const count = kills.filter(e => e.actor === f.id).length;
            if (count >= 2)
                stats.get(f.id)!.multiKills++;
        }
        const alive = new Set(r.initial.map(f => f.id));
        const attempts = new Set<string>();
        for (const k of kills) {
            alive.delete(k.target!);
            for (const team of [0, 1]) {
                const remaining = r.initial.filter(f => f.team === team && alive.has(f.id));
                const other = r.initial.filter(f => f.team !== team && alive.has(f.id));
                if (remaining.length === 1 && other.length >= 1)
                    attempts.add(remaining[0].id);
            }
        }
        for (const id of attempts) {
            stats.get(id)!.clutchAttempts++;
            if (r.initial.find(f => f.id === id)!.team === r.winner)
                stats.get(id)!.clutchWins++;
        }
    }
    return [...stats.values()].map(s => ({ ...s, adr: s.damage / s.rounds, kast: 100 * s.kastRounds / s.rounds, rating: .35 * s.kills / s.rounds + .25 * (1 - s.deaths / s.rounds) + .25 * s.damage / s.rounds / 80 + .15 * s.kastRounds / s.rounds }));
}
export const seriesStats = (s: Series) => aggregateStats(s.mapStates.flatMap(m => m.rounds));
export const mvp = (s: Series) => seriesStats(s).sort((a, b) => b.rating - a.rating)[0];
