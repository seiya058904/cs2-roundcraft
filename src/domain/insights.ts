/**
 * Read-only insights derived from round ledgers. Nothing here feeds back into the engine
 * or the random stream: it only turns recorded events into numbers worth showing.
 */
import type {Fighter, MapState, RoundEvent, RoundResult, Side, TeamIndex} from './types';
import {ECONOMY, UTILITY_PRICES, WEAPONS} from './economy';
import {sidesForRound} from './series';
import model from '../data/win-probability.json';

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const logit = (p: number) => Math.log(p / (1 - p));

/** Price of what a fighter carries into the round (weapon, armor, helmet, kit, utility). */
export function equipmentValue(f: Pick<Fighter, 'equipment'>): number {
  const e = f.equipment;
  return (WEAPONS[e.weapon]?.price ?? 0) + (e.armor > 0 ? 650 : 0) + (e.helmet ? 350 : 0) + (e.kit ? 400 : 0)
    + e.utility.reduce((sum, item) => sum + (UTILITY_PRICES[item] ?? 0), 0);
}
export function teamValue(fighters: readonly Fighter[], team: TeamIndex, aliveOnly = false): number {
  return fighters.filter(f => f.team === team && (!aliveOnly || f.alive)).reduce((sum, f) => sum + equipmentValue(f), 0);
}

export type BuyKind = 'full' | 'force' | 'half' | 'eco' | 'pistol';
export const BUY_LABELS: Record<BuyKind, string> = {full: '全起', force: '强起', half: '半起', eco: '经济局', pistol: '手枪局'};
/** Classifies a team's loadout by average value per player. */
export function buyKind(fighters: readonly Fighter[], team: TeamIndex, roundNumber?: number): BuyKind {
  if (roundNumber === 1 || roundNumber === 13) return 'pistol';
  const members = fighters.filter(f => f.team === team);
  const avg = members.length ? teamValue(members, team) / members.length : 0;
  return avg >= 3900 ? 'full' : avg >= 2600 ? 'force' : avg >= 1500 ? 'half' : 'eco';
}

type Model = {version: string; prior: {intercept: number; perThousand: number}; live: {table: Record<string, number>; perThousand: number}};
const WP = model as Model;
/** Pre-round CT win chance from the CT − T equipment value gap (fitted on simulated rounds). */
export function preRoundCtWin(fighters: readonly Fighter[], ctTeam: TeamIndex): number {
  const gap = (teamValue(fighters, ctTeam) - teamValue(fighters, (1 - ctTeam) as TeamIndex)) / 1000;
  return sigmoid(WP.prior.intercept + WP.prior.perThousand * gap);
}
/** Live CT win chance from survivors, bomb state and the surviving equipment gap. */
export function liveCtWin(fighters: readonly Fighter[], ctTeam: TeamIndex, planted: boolean): number {
  const t = (1 - ctTeam) as TeamIndex;
  const tAlive = fighters.filter(f => f.team === t && f.alive).length, ctAlive = fighters.filter(f => f.team === ctTeam && f.alive).length;
  if (!ctAlive) return 0;
  if (!tAlive && !planted) return 1;
  const base = WP.live.table[`${tAlive}${ctAlive}${planted ? 1 : 0}`];
  if (base === undefined) return planted ? 0.15 : ctAlive / (ctAlive + tAlive);
  const gap = (teamValue(fighters, ctTeam, true) - teamValue(fighters, t, true)) / 1000;
  return Math.min(.99, Math.max(.01, sigmoid(logit(base) + WP.live.perThousand * gap)));
}

/** A round's win-probability curve, one point per kill/plant/defuse plus start and end (from team `own`'s view). */
export interface WinPoint {at: number; p: number; eventId?: string; kind: 'start' | RoundEvent['kind']}
export function winCurve(round: RoundResult, own: TeamIndex): WinPoint[] {
  const ct = (round.sides[0] === 'CT' ? 0 : 1) as TeamIndex;
  const view = (pCt: number) => own === ct ? pCt : 1 - pCt;
  const fighters = structuredClone(round.initial);
  let planted = false;
  const points: WinPoint[] = [{at: 0, p: view(preRoundCtWin(fighters, ct)), kind: 'start'}];
  for (const e of round.events) {
    if (e.kind === 'kill') { const target = fighters.find(f => f.id === e.target); if (target) target.alive = false; }
    if (e.kind === 'plant') planted = true;
    if (e.kind === 'kill' || e.kind === 'plant') points.push({at: e.at, p: view(liveCtWin(fighters, ct, planted)), eventId: e.id, kind: e.kind});
    if (e.kind === 'defuse' || e.kind === 'explode' || e.kind === 'roundEnd') {
      points.push({at: e.at, p: round.winner === own ? 1 : 0, eventId: e.id, kind: e.kind});
      break;
    }
  }
  return points;
}
/** The single event that moved the win chance the most, with the swing size. */
export function biggestSwing(round: RoundResult, own: TeamIndex) {
  const curve = winCurve(round, own).filter(p => p.kind !== 'roundEnd');
  let best: {eventId: string; delta: number; before: number; after: number} | null = null;
  for (let i = 1; i < curve.length; i++) {
    const delta = curve[i].p - curve[i - 1].p;
    if (curve[i].eventId && (!best || Math.abs(delta) > Math.abs(best.delta))) best = {eventId: curve[i].eventId!, delta, before: curve[i - 1].p, after: curve[i].p};
  }
  return best;
}

export type HighlightKind = 'ace' | '4k' | '3k' | 'clutch' | 'entry' | 'flawless' | 'ecoUpset' | 'defuse' | 'ninja';
export interface Highlight {kind: HighlightKind; playerId?: string; team: TeamIndex; label: string; detail?: number; eventIds: string[]}
const MULTI: Record<number, ['ace' | '4k' | '3k', string]> = {5: ['ace', 'ACE'], 4: ['4k', '四杀'], 3: ['3k', '三杀']};
/** Notable things that happened in a round, ordered by how much a viewer would care. */
export function roundHighlights(round: RoundResult): Highlight[] {
  const out: Highlight[] = [];
  const teamOf = new Map(round.initial.map(f => [f.id, f.team]));
  const kills = round.events.filter(e => e.kind === 'kill');
  const byActor = new Map<string, RoundEvent[]>();
  for (const k of kills) if (k.actor && teamOf.get(k.actor) !== teamOf.get(k.target!)) byActor.set(k.actor, [...(byActor.get(k.actor) ?? []), k]);
  for (const [id, list] of byActor) { const m = MULTI[Math.min(5, list.length)]; if (m) out.push({kind: m[0], playerId: id, team: teamOf.get(id)!, label: m[1], detail: list.length, eventIds: list.map(e => e.id)}); }
  const clutch = clutchOf(round);
  if (clutch && clutch.won) out.push({kind: 'clutch', playerId: clutch.playerId, team: clutch.team, label: `1v${clutch.versus} 残局`, detail: clutch.versus, eventIds: clutch.eventIds});
  const defuse = round.events.find(e => e.kind === 'defuse');
  if (defuse) {
    const tAlive = round.final.filter(f => f.side === 'T' && f.alive).length;
    out.push(tAlive ? {kind: 'ninja', playerId: defuse.actor, team: round.winner, label: '偷拆', eventIds: [defuse.id]} : {kind: 'defuse', playerId: defuse.actor, team: round.winner, label: '完成拆包', eventIds: [defuse.id]});
  }
  if (!round.final.some(f => f.team === round.winner && !f.alive)) out.push({kind: 'flawless', team: round.winner, label: '零伤亡', eventIds: kills.slice(-1).map(e => e.id)});
  const winnerValue = teamValue(round.initial, round.winner), loserValue = teamValue(round.initial, (1 - round.winner) as TeamIndex);
  if (round.number !== 1 && round.number !== 13 && loserValue - winnerValue > 6000 && winnerValue < loserValue * .55)
    out.push({kind: 'ecoUpset', team: round.winner, label: '以弱胜强', detail: loserValue - winnerValue, eventIds: kills.slice(-1).map(e => e.id)});
  if (kills[0]?.actor) out.push({kind: 'entry', playerId: kills[0].actor, team: teamOf.get(kills[0].actor)!, label: '首杀', eventIds: [kills[0].id]});
  const order: HighlightKind[] = ['ace', 'clutch', '4k', 'ninja', 'ecoUpset', '3k', 'flawless', 'defuse', 'entry'];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
/** The last surviving player of a team facing ≥1 opponent, if the round reached such a state. */
export function clutchOf(round: RoundResult) {
  const alive = new Set(round.initial.map(f => f.id));
  for (const k of round.events.filter(e => e.kind === 'kill')) {
    alive.delete(k.target!);
    for (const team of [0, 1] as TeamIndex[]) {
      const mine = round.initial.filter(f => f.team === team && alive.has(f.id));
      const theirs = round.initial.filter(f => f.team !== team && alive.has(f.id));
      if (mine.length === 1 && theirs.length >= 1) {
        const later = round.events.filter(e => e.kind === 'kill' && e.actor === mine[0].id && e.at >= k.at).map(e => e.id);
        return {playerId: mine[0].id, team, versus: theirs.length, won: round.winner === team, eventIds: [k.id, ...later]};
      }
    }
  }
  return null;
}

/** Round MVP: winning side, weighted by kills, damage, objective and clutch. */
export function roundMvp(round: RoundResult): {playerId: string; score: number; kills: number; damage: number} | null {
  const clutch = clutchOf(round);
  const rows = round.initial.filter(f => f.team === round.winner).map(f => {
    const kills = round.events.filter(e => e.kind === 'kill' && e.actor === f.id).length;
    const damage = round.events.filter(e => e.kind === 'damage' && e.actor === f.id).reduce((s, e) => s + (e.damage ?? 0), 0);
    const objective = round.events.some(e => (e.kind === 'plant' || e.kind === 'defuse') && e.actor === f.id) ? .6 : 0;
    const clutchBonus = clutch?.won && clutch.playerId === f.id ? clutch.versus * .5 : 0;
    return {playerId: f.id, kills, damage, score: kills + damage / 100 + objective + clutchBonus};
  }).sort((a, b) => b.score - a.score || b.damage - a.damage);
  return rows[0] && rows[0].score > 0 ? rows[0] : null;
}

export interface EconomyOutlook {team: TeamIndex; side: Side; cash: number; average: number; kind: BuyKind; label: string; lossTier: number; reset?: 'half' | 'overtime'}
/** What each team can afford next round, from the settled ledger. */
export function economyOutlook(round: RoundResult): EconomyOutlook[] {
  const start: Side = sidesForRound('T', round.number - 1)[0] === round.sides[0] ? 'T' : 'CT';
  const next = sidesForRound(start, round.number), half = round.number === 12;
  return ([0, 1] as TeamIndex[]).map(team => {
    const rows = round.economy.filter(e => round.initial.find(f => f.id === e.playerId)?.team === team);
    const nextSide = next[team];
    if (half) return {team, side: nextSide, cash: ECONOMY.startCash * 5, average: ECONOMY.startCash, kind: 'pistol', label: '换边手枪局', lossTier: ECONOMY.initialLossTier, reset: 'half'};
    if (round.number >= 24 && (round.number - 24) % 6 === 0) return {team, side: nextSide, cash: ECONOMY.otCash * 5, average: ECONOMY.otCash, kind: 'full', label: '加时全起', lossTier: 0, reset: 'overtime'};
    const carried = rows.filter(e => e.carriedEquipment && WEAPONS[e.carriedEquipment.weapon]?.category !== 'pistol').length;
    const cash = rows.reduce((s, e) => s + e.cashAtEnd, 0), average = rows.length ? cash / rows.length : 0;
    const effective = average + carried * 2700 / Math.max(1, rows.length);
    const kind: BuyKind = effective >= 4300 ? 'full' : effective >= 3000 ? 'force' : effective >= 2000 ? 'half' : 'eco';
    const label = kind === 'full' ? '可以全起' : kind === 'force' ? '只够强起' : kind === 'half' ? '半起或保存' : '大概率经济局';
    return {team, side: nextSide, cash, average, kind, label, lossTier: rows[0]?.lossTierAfter ?? 0};
  });
}

/** Consecutive rounds won by `team` ending at `rounds` (most recent last). */
export function streak(rounds: readonly RoundResult[], team: TeamIndex): number {
  let n = 0;
  for (let i = rounds.length - 1; i >= 0 && rounds[i].winner === team; i--) n++;
  return n;
}
export type Form = 'hot' | 'cold' | null;
/** Recent form over the last `window` rounds: kills minus deaths plus damage/100 per round. */
export function playerForm(rounds: readonly RoundResult[], playerId: string, window = 5): {form: Form; kills: number; deaths: number; score: number} {
  const recent = rounds.slice(-window).filter(r => r.initial.some(f => f.id === playerId));
  let kills = 0, deaths = 0, damage = 0;
  for (const r of recent) for (const e of r.events) {
    if (e.kind === 'kill' && e.actor === playerId) kills++;
    if (e.kind === 'kill' && e.target === playerId) deaths++;
    if (e.kind === 'damage' && e.actor === playerId) damage += e.damage ?? 0;
  }
  const n = recent.length || 1, score = (kills - deaths + damage / 100) / n;
  const form: Form = recent.length >= 3 && kills >= Math.max(5, recent.length) && score >= 1.2 ? 'hot' : recent.length >= 4 && kills === 0 && deaths >= recent.length - 1 ? 'cold' : null;
  return {form, kills, deaths, score};
}
/** Player pairs on this map where one has killed the other at least `min` times. */
export function rivalries(state: Pick<MapState, 'rounds'>, min = 3) {
  const pairs = new Map<string, number>();
  for (const r of state.rounds) for (const e of r.events) if (e.kind === 'kill' && e.actor && e.target) {
    const key = `${e.actor}>${e.target}`; pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  return [...pairs].filter(([, n]) => n >= min).map(([key, n]) => { const [killer, victim] = key.split('>'); return {killer, victim, kills: n}; }).sort((a, b) => b.kills - a.kills);
}
