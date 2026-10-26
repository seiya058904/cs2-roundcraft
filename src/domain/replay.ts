import type { RoundResult } from './types';
/** Read-only reconstruction. A commentary step reveals its cited event prefix only. */
export function commentarySnapshot(round: RoundResult, revealed: number) {
    const ids = new Set(round.commentary.slice(0, revealed).flatMap(segment => segment.eventIds));
    const cutoff = round.events.reduce((last, event, index) => ids.has(event.id) ? index : last, -1);
    const events = round.events.slice(0, cutoff + 1);
    const complete = events.some(event => event.kind === 'roundEnd');
    const fighters = structuredClone(complete ? round.final : round.initial);
    if (!complete)
        for (const event of events) {
            const actor = fighters.find(f => f.id === event.actor), target = fighters.find(f => f.id === event.target);
            if (event.kind === 'position' && actor && event.zone)
                actor.zone = event.zone;
            if (event.kind === 'damage' && target) {
                target.hp = event.hpAfter!;
                target.alive = target.hp > 0;
            }
            if (event.kind === 'kill' && target) {
                target.hp = 0;
                target.alive = false;
                target.hasBomb = false;
            }
            if (event.kind === 'blind' && target)
                target.blindedUntil = Number(event.detail.until);
            if (event.kind === 'plant' && actor)
                actor.hasBomb = false;
            if (event.kind === 'pickup' && actor) {
                if (event.weapon)
                    actor.equipment.weapon = event.weapon;
                if (event.detail.item === 'bomb')
                    actor.hasBomb = true;
            }
            if (['smoke', 'fire', 'flash', 'he'].includes(event.kind) && actor) {
                const index = actor.equipment.utility.indexOf(event.kind);
                if (index >= 0)
                    actor.equipment.utility.splice(index, 1);
            }
        }
    return { fighters, complete, cutoff, events, at: events.at(-1)?.at ?? 0, alive: [0, 1].map(team => fighters.filter(f => f.team === team && f.alive).length), score: round.score.map((score, index) => score - (!complete && index === round.winner ? 1 : 0)) };
}

/** Current-map totals at the visible event prefix, never the future round result. */
export function visibleMapStats(history: RoundResult[], round: RoundResult | undefined, visibleEvents: RoundResult['events']) {
    const stats: Record<string, {kills:number;deaths:number}> = {};
    const add = (id:string) => stats[id] ??= {kills:0,deaths:0};
    if (!round) return stats;
    const events = history.filter(r=>r.map===round.map && r.number<round.number).flatMap(r=>r.events);
    events.push(...visibleEvents);
    for (const e of events) if(e.kind==='kill') {
        if(e.actor) add(e.actor).kills++;
        if(e.target) add(e.target).deaths++;
    }
    return stats;
}
