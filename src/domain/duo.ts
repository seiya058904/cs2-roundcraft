/**
 * Two-voice booth for engine v5 matches: the play-by-play caster (existing narration) plus an
 * analyst who cites numbers derived from the ledger. Every added line cites events that are
 * already revealed by the segment it follows, so live playback never leaks the future.
 */
import type {CommentarySegment, RoundEvent, RoundResult, Series, TeamIndex} from './types';
import templates from '../data/commentary.json';
import {hash} from './random';
import {commentaryPlayerName, commentaryTeamName, formatCommentaryNames} from './names';
import {biggestSwing, clutchOf, economyOutlook, liveCtWin, playerForm, preRoundCtWin, roundMvp, streak, teamValue} from './insights';

const byFamily = new Map<string, {id: string; text: string}[]>();
for (const t of templates as {id: string; family: string; text: string}[])
  if (t.family.startsWith('an-') || t.family.startsWith('ca-')) byFamily.set(t.family, [...(byFamily.get(t.family) ?? []), t]);
export const DUO_FAMILIES = [...byFamily.keys()];

const pct = (p: number) => `${Math.round(Math.min(.99, Math.max(.01, p)) * 100)}%`;
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
type Line = {priority: number; family: string; facts: Record<string, string | number>; anchor: string; voice: 'caster' | 'analyst'; emphasis?: CommentarySegment['emphasis']; after?: 'close'};

export function addDuoVoices(segments: CommentarySegment[], round: RoundResult, series: Series): CommentarySegment[] {
  if (!segments.length) return segments;
  const out: CommentarySegment[] = segments.map(s => ({...s, voice: 'caster'}));
  const prior = series.mapStates.find(m => m.map === round.map)?.rounds.filter(r => r.number < round.number) ?? [];
  const recent = new Set(prior.slice(-5).flatMap(r => r.commentary.map(s => s.templateId)));
  const index = new Map(round.events.map((e, i) => [e.id, i]));
  const ct = (round.sides[0] === 'CT' ? 0 : 1) as TeamIndex, t = (1 - ct) as TeamIndex;
  const team = (i: number) => commentaryTeamName(series.teams[i]);
  const player = (id?: string) => commentaryPlayerName(series.players.find(p => p.id === id) ?? '选手');
  const pistol = round.number === 1 || round.number === 13;
  const lines: Line[] = [];
  const firstKill = round.events.find(e => e.kind === 'kill');
  const setupAnchor = out[0].eventIds[0];

  // Setup: one framing line before the first contact.
  const ctValue = teamValue(round.initial, ct), tValue = teamValue(round.initial, t);
  const preCt = preRoundCtWin(round.initial, ct,series,round);
  const casterFramedRun = /连拿|连下|连胜|连续/.test(out[0].text);
  const leader = casterFramedRun ? undefined : ([0, 1] as TeamIndex[]).map(i => ({i, n: streak(prior, i)})).find(x => x.n === 3 || x.n === 5 || x.n >= 8);
  const hot = pistol ? undefined : round.initial.map(f => ({f, form: playerForm(prior, f.id)})).filter(x => x.form.form === 'hot').sort((a, b) => b.form.score - a.form.score)[0];
  const gap = Math.abs(ctValue - tValue), strong = ctValue >= tValue ? ct : t, strongP = strong === ct ? preCt : 1 - preCt;
  const fullBuy = round.initial.every(f => teamValue([f], f.team) >= 3900);
  const roll = hash(`${series.id}|${round.map}|${round.number}|duo`);
  if (pistol) lines.push({priority: 3, family: 'an-pistol', facts: {}, anchor: setupAnchor, voice: 'analyst'});
  else if (leader && leader.n >= 4) lines.push({priority: 4, family: 'an-streak', facts: {队: team(leader.i), 对手: team(1 - leader.i), 连胜: leader.n}, anchor: setupAnchor, voice: 'analyst'});
  else if (gap >= 3000 && strongP >= .55) lines.push({priority: 3, family: 'an-economy-gap', facts: {强队: team(strong), 弱队: team(1 - strong), 强值: money(Math.max(ctValue, tValue)), 弱值: money(Math.min(ctValue, tValue)), 差额: money(gap), 胜率: pct(strongP)}, anchor: setupAnchor, voice: 'analyst'});
  else if (hot && roll % 2) lines.push({priority: 4, family: 'an-form', facts: {选手: player(hot.f.id), 击杀: hot.form.kills}, anchor: setupAnchor, voice: 'analyst'});
  else if (leader) lines.push({priority: 4, family: 'an-streak', facts: {队: team(leader.i), 对手: team(1 - leader.i), 连胜: leader.n}, anchor: setupAnchor, voice: 'analyst'});
  else if (fullBuy && gap < 1500 && roll % 3 === 0) lines.push({priority: 5, family: 'an-even-buy', facts: {T: team(t), CT: team(ct), T值: money(tValue), CT值: money(ctValue), 差额: money(gap)}, anchor: setupAnchor, voice: 'analyst'});
  if (lines.at(-1)?.family === 'an-economy-gap' && (strongP >= .8 || strongP <= .2) && roll % 2 === 0)
    lines.push({priority: 0, family: 'ca-reply', facts: {}, anchor: setupAnchor, voice: 'caster'});

  // Middle: the decisive moment, told once — clutch odds first, else post-plant odds, else the biggest swing.
  const clutch = clutchOf(round);
  const state = (upTo: RoundEvent) => {
    const fighters = structuredClone(round.initial);
    let planted = false;
    for (const e of round.events.slice(0, index.get(upTo.id)! + 1)) {
      if (e.kind === 'kill') { const f = fighters.find(x => x.id === e.target); if (f) f.alive = false; }
      if (e.kind === 'plant') planted = true;
    }
    return {fighters, planted};
  };
  // Only a live clutch: 1v2 or 1v3, the clutcher fights on (no save) and the round does not end on the same event.
  const clutchKill = clutch && clutch.versus >= 2 && clutch.versus <= 3 && !round.events.some(e => e.kind === 'save' && e.actor === clutch.playerId && e.detail.decision) ? round.events.find(e => e.id === clutch.eventIds[0]) : undefined;
  let clutchOdds: number | undefined;
  if (clutch && clutchKill) {
    const s = state(clutchKill), pCt = liveCtWin(s.fighters, ct, s.planted);
    clutchOdds = clutch.team === ct ? pCt : 1 - pCt;
    const playedOut = round.events.slice(index.get(clutchKill.id)! + 1).some(e => (e.kind === 'kill' || e.kind === 'damage' || e.kind === 'duel') && (e.actor === clutch.playerId || e.target === clutch.playerId));
    if (clutchOdds >= .03 && clutchOdds <= .35 && playedOut) lines.push({priority: 1, family: 'an-clutch-odds', facts: {选手: player(clutch.playerId), N: clutch.versus, 胜率: pct(clutchOdds)}, anchor: clutchKill.id, voice: 'analyst'});
    else clutchOdds = undefined;
  }
  const plant = round.events.find(e => e.kind === 'plant');
  if (clutchOdds === undefined && plant) {
    const s = state(plant), tAlive = s.fighters.filter(f => f.team === t && f.alive).length, ctAlive = s.fighters.filter(f => f.team === ct && f.alive).length;
    if (tAlive && ctAlive && ctAlive >= tAlive - 1) lines.push({priority: 2, family: 'an-postplant', facts: {T: team(t), CT: team(ct), T人: tAlive, CT人: ctAlive, 胜率: pct(liveCtWin(s.fighters, ct, true))}, anchor: plant.id, voice: 'analyst'});
  }
  if (clutchOdds === undefined && !lines.some(l => l.family === 'an-postplant')) {
    const swing = biggestSwing(round, 0,series);
    if (swing && Math.abs(swing.delta) >= .2 && swing.after > .02 && swing.after < .98 && swing.eventId !== firstKill?.id) {
      const gainer = (swing.delta > 0 ? 0 : 1) as TeamIndex, view = (p: number) => gainer === 0 ? p : 1 - p;
      lines.push({priority: 2, family: 'an-swing', facts: {队: team(gainer), 前: pct(view(swing.before)), 后: pct(view(swing.after))}, anchor: swing.eventId, voice: 'analyst'});
    }
  }
  // A grudge match-up inside this map, at most once per round.
  const tally = new Map<string, number>();
  for (const r of prior) for (const e of r.events) if (e.kind === 'kill') tally.set(`${e.actor}>${e.target}`, (tally.get(`${e.actor}>${e.target}`) ?? 0) + 1);
  const rivalryCooldown = prior.slice(-2).some(old => old.commentary.some(l => l.templateId?.startsWith('DA-rivalry')));
  for (const e of round.events) if (e.kind === 'kill' && e.actor && e.target) {
    const key = `${e.actor}>${e.target}`, n = (tally.get(key) ?? 0) + 1;
    tally.set(key, n);
    const mentioned = prior.slice(-3).some(old => old.commentary.some(l => l.templateId?.startsWith('DA-rivalry') && l.eventIds.some(id => { const k = old.events.find(x => x.id === id); return k?.kind === 'kill' && k.actor === e.actor && k.target === e.target; })));
    if ((n === 3 || n === 5 || n === 8) && !mentioned && !rivalryCooldown && round.initial.find(f => f.id === e.actor)?.team !== round.initial.find(f => f.id === e.target)?.team && !lines.some(l => l.anchor === e.id)) {
      lines.push({priority: 7, family: 'an-rivalry', facts: {击杀者: player(e.actor), 受害者: player(e.target), 次数: n}, anchor: e.id, voice: 'analyst'});
      break;
    }
  }

  // Wrap: after the round-closing line.
  const closeAnchor = out.at(-1)!.eventIds.at(-1)!;
  const winnerPre = round.winner === ct ? preCt : 1 - preCt;
  if (clutchOdds !== undefined && clutch?.won) lines.push({priority: 0, family: 'ca-clutch-react', facts: {选手: player(clutch.playerId), N: clutch.versus, 胜率: pct(clutchOdds)}, anchor: closeAnchor, voice: 'caster', emphasis: 'hype', after: 'close'});
  else if (!pistol && winnerPre < .3) lines.push({priority: 0, family: 'ca-upset', facts: {队: team(round.winner), 胜率: pct(winnerPre)}, anchor: closeAnchor, voice: 'caster', emphasis: 'hype', after: 'close'});
  const mvp = roundMvp(round);
  const outlook = economyOutlook(round);
  if (round.number === 12) { /* the caster already announces the half */ }
  else if (mvp && mvp.kills >= 2 && (roll >> 3) % 2) lines.push({priority: 5, family: 'an-mvp', facts: {选手: player(mvp.playerId), 击杀: mvp.kills, 伤害: Math.round(mvp.damage)}, anchor: closeAnchor, voice: 'analyst', after: 'close'});
  else if (!outlook.some(o => o.reset) && (roll >> 5) % 3 === 0) lines.push({priority: 6, family: 'an-economy-next', facts: {队A: team(0), 队B: team(1), 标签A: outlook[0].label, 标签B: outlook[1].label}, anchor: closeAnchor, voice: 'analyst', after: 'close'});

  // Keep the booth readable: at most three analyst lines and two caster reactions per round.
  const chosen = new Set<Line>();
  for (const l of [...lines].sort((a, b) => a.priority - b.priority)) if ([...chosen].filter(k => k.voice === l.voice).length < (l.voice === 'analyst' ? 3 : 2)) chosen.add(l);
  // A caster reply only makes sense when the analyst line it answers survived.
  const kept = lines.filter(l => chosen.has(l) && (l.family !== 'ca-reply' || chosen.has(lines.find(k => k.family === 'an-economy-gap')!)));
  const used = new Set<string>();
  const inserts: {position: number; segment: CommentarySegment}[] = [];
  for (const l of kept) {
    const pool = byFamily.get(l.family) ?? [];
    const fresh = pool.filter(t => !recent.has(t.id) && !used.has(t.id));
    const choices = fresh.length ? fresh : pool.filter(t => !used.has(t.id));
    if (!choices.length) continue;
    const template = choices[hash(`${series.id}|${round.map}|${round.number}|${l.family}`) % choices.length];
    const text = template.text.replace(/\{([^{}]+)\}/g, (m, key) => l.facts[key] === undefined ? m : String(l.facts[key]));
    if (/\{[^{}]+\}/.test(text)) continue;
    used.add(template.id);
    const anchorIndex = index.get(l.anchor) ?? 0, reach = (s: CommentarySegment) => Math.max(...s.eventIds.map(id => index.get(id) ?? -1));
    // Setup and wrap lines follow the opening / closing line; mid-round lines must follow the caster line that narrated their event.
    const host = l.after === 'close' ? out.length - 1 : l.anchor === setupAnchor ? 0 : out.findIndex(s => s.eventIds.includes(l.anchor));
    if (l.after !== 'close' && l.anchor !== setupAnchor && host === out.length - 1) continue;
    if (host < 0) continue;
    // Cite the fact itself plus the host line's latest event, so anchors stay monotonic in playback.
    const hostEvent = round.events[reach(out[host])]?.id;
    const eventIds = [...new Set([l.anchor, ...(hostEvent ? [hostEvent] : [])])];
    inserts.push({position: host, segment: {text: formatCommentaryNames(text, series.players, series.teams), briefText: '', stage: out[host].stage, at: out[host].at, sourceType: 'template', templateId: template.id, eventIds, emphasis: l.emphasis ?? 'neutral', voice: l.voice}});
  }
  // Insert back to front so earlier positions stay valid; within a host, keep the planned order.
  inserts.map((x, order) => ({...x, order})).sort((a, b) => b.position - a.position || b.order - a.order)
    .forEach(({position, segment}) => out.splice(position + 1, 0, segment));
  return out;
}
