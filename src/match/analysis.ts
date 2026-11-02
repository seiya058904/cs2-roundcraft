import type {RoundEvent, RoundResult, TeamIndex} from '../domain/types';
import {clutchOf, roundHighlights} from '../domain/insights';

export interface TeamDesk {
  won: number;
  /** Rounds where this team drew first blood / rounds with any kill. */
  openings: number;
  /** Bomb plants and how many of those planted rounds this team (as T) converted. */
  plants: number; plantWins: number; tRounds: number;
  /** Defuses completed as CT. */
  retakes: number;
  clutches: number;
  ecoUpsets: number;
  pistols: number;
  multiKills: number;
}
export interface DeskSummary {teams: [TeamDesk, TeamDesk]; contested: number; momentum: number[]; longestRun: {team: TeamIndex; length: number} | null}

const empty = (): TeamDesk => ({won: 0, openings: 0, plants: 0, plantWins: 0, tRounds: 0, retakes: 0, clutches: 0, ecoUpsets: 0, pistols: 0, multiKills: 0});

/**
 * Off-the-ball analysis for the shown map, from settled rounds only. Callers pass the rounds the
 * viewer has already seen, so a replay never leaks a later result.
 */
export function deskSummary(rounds: readonly RoundResult[], own: TeamIndex): DeskSummary {
  const teams: [TeamDesk, TeamDesk] = [empty(), empty()];
  const momentum: number[] = [];
  let diff = 0, contested = 0, run = 0, runTeam: TeamIndex | null = null, longest: DeskSummary['longestRun'] = null;
  for (const r of rounds) {
    const winner = r.winner as TeamIndex;
    teams[winner].won++;
    diff += winner === own ? 1 : -1;
    momentum.push(diff);
    run = runTeam === winner ? run + 1 : 1;
    runTeam = winner;
    if (!longest || run > longest.length) longest = {team: winner, length: run};
    const teamOf = new Map(r.initial.map(f => [f.id, f.team]));
    const first = r.events.find((e: RoundEvent) => e.kind === 'kill' && e.actor && teamOf.get(e.actor) !== teamOf.get(e.target!));
    if (first?.actor) { contested++; teams[teamOf.get(first.actor)!].openings++; }
    const t = (r.sides[0] === 'T' ? 0 : 1) as TeamIndex;
    teams[t].tRounds++;
    if (r.events.some(e => e.kind === 'plant')) { teams[t].plants++; if (winner === t) teams[t].plantWins++; }
    if (r.events.some(e => e.kind === 'defuse')) teams[(1 - t) as TeamIndex].retakes++;
    const clutch = clutchOf(r);
    if (clutch?.won) teams[clutch.team].clutches++;
    const highlights = roundHighlights(r);
    if (highlights.some(h => h.kind === 'ecoUpset')) teams[winner].ecoUpsets++;
    for (const h of highlights) if (h.kind === 'ace' || h.kind === '4k' || h.kind === '3k') teams[h.team].multiKills++;
    if (r.number === 1 || r.number === 13) teams[winner].pistols++;
  }
  return {teams, contested, momentum, longestRun: longest};
}
