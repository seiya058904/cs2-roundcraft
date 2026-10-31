import type {RoundEvent, RoundResult, TeamIndex} from '../domain/types';

export interface KillItem {id: string; at: number; actor: string; target: string; actorTeam: TeamIndex; weapon: string; headshot: boolean; throughSmoke: boolean; trade: boolean; utility: boolean}
/** Kill feed rows for the events revealed so far (newest first). Headshot comes from the duel behind the killing damage. */
export function killFeed(round: RoundResult, revealed: readonly RoundEvent[]): KillItem[] {
  const byId = new Map(round.events.map(e => [e.id, e]));
  const teamOf = new Map(round.initial.map(f => [f.id, f.team]));
  const shown = new Set(revealed.map(e => e.id));
  const trades = round.events.filter(e => e.kind === 'trade');
  return round.events.filter(e => e.kind === 'kill' && shown.has(e.id) && e.actor && e.target).map(kill => {
    const damage = kill.causes.map(id => byId.get(id)).find(e => e?.kind === 'damage');
    const duel = damage?.causes.map(id => byId.get(id)).find(e => e?.kind === 'duel');
    const weapon = kill.weapon ?? '';
    return {
      id: kill.id, at: kill.at, actor: kill.actor!, target: kill.target!, actorTeam: teamOf.get(kill.actor!) ?? 0, weapon,
      headshot: duel?.detail.headshot === true, throughSmoke: typeof duel?.detail.smoke === 'number' && duel.detail.smoke < 1,
      trade: trades.some(t => t.actor === kill.actor && Math.abs(t.at - kill.at) <= 1 && (t.causes.includes(kill.id) || t.at === kill.at)),
      utility: weapon === 'HE' || weapon === 'fire',
    };
  }).reverse();
}

export type TimelineCell = {key: string; number: number; state: 'won' | 'lost' | 'pending' | 'future'; reason?: RoundResult['reason']; index?: number; selected?: boolean; halfBreak?: boolean};
/**
 * One cell per round of the shown map. Rounds after the one being replayed (and an unrevealed live
 * round) stay hidden so the strip never spoils a result.
 */
export function timelineCells(rounds: readonly RoundResult[], allRounds: readonly RoundResult[], own: TeamIndex, shown: RoundResult | undefined, pending: boolean): TimelineCell[] {
  const shownNumber = shown?.number ?? 0;
  const played = rounds.length;
  const total = played > 24 ? 24 + Math.ceil((played - 24) / 6) * 6 : 24;
  const cells: TimelineCell[] = [];
  for (let n = 1; n <= total; n++) {
    const r = rounds[n - 1];
    const halfBreak = n === 13 || (n > 24 && (n - 25) % 3 === 0);
    if (!r || n > shownNumber) { cells.push({key: `f${n}`, number: n, state: 'future', halfBreak}); continue; }
    const hidden = n === shownNumber && pending;
    cells.push({key: `r${n}`, number: n, state: hidden ? 'pending' : r.winner === own ? 'won' : 'lost', reason: hidden ? undefined : r.reason, index: allRounds.indexOf(r), selected: r === shown, halfBreak});
  }
  return cells;
}
