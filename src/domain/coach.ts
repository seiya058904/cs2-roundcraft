import type { MapState, Team, TeamIndex, TimeoutEffect } from './types';
import { Random } from './random';
import { sidesForRound } from './series';
import { DEFAULT_TIMEOUT_RULES } from './rules';
export const TIMEOUT_LIMIT = 4;
export function timeoutLimit(map: MapState) { const rules = map.timeoutRules ?? DEFAULT_TIMEOUT_RULES; const overtimeBlocks = map.rounds.length < 24 ? 0 : 1 + Math.floor((map.rounds.length - 24) / 6); return rules.perMap + overtimeBlocks * rules.overtimeExtra; }
export const timeoutRemaining = (map: MapState, index: TeamIndex) => Math.max(0, timeoutLimit(map) - map.timeoutsUsed[index]);
export function timeoutAdvice(map: MapState, index: TeamIndex) {
    const lost = map.rounds.slice(-3).filter(r => r.winner !== index).length;
    const cash = map.fighters.filter(f => f.team === index).reduce((s, f) => s + f.cash, 0) / 5;
    const site = map.rounds.slice(-3).filter(r => r.events.some(e => e.kind === 'plant' && e.detail.site === 'B')).length >= 2 ? 'B' : 'A';
    const attacking = sidesForRound(map.startSide, map.rounds.length)[index] === 'T';
    return [
        { kind: 'position' as const, site, title: attacking ? `集结双路夹 ${site}` : `收缩 ${site} 区交叉`, description: attacking ? `下一回合分主路与侧翼夹击 ${site}，放弃另一包点的佯攻压力；不会提升枪械伤害。` : `下回合三人优先覆盖 ${site}，另一侧人数减少；不会提升枪械伤害。`, reason: `最近三回合丢失 ${lost} 分，重新分配${attacking ? '进攻路线' : '防区'}` },
        { kind: 'belief' as const, site, title: '稳住比赛节奏', description: '未来两回合缩小状态波动；减少爆发幅度，也避免持续失误。', reason: `当前比分 ${map.score[index]}:${map.score[index === 0 ? 1 : 0]}` },
        { kind: 'economy' as const, site, title: '统一经济计划', description: '下一回合保留低预算，足够资金时统一长枪；可能牺牲当局装备。', reason: `己方平均现金 $${Math.round(cash)}` }
    ] as const;
}
export function canTimeout(map: MapState, index: TeamIndex) { const rules = map.timeoutRules ?? DEFAULT_TIMEOUT_RULES; return map.winner === null && timeoutRemaining(map, index) > 0 && !map.timeoutHistory.some(h => h.team === index && map.rounds.length + 1 - h.round <= rules.cooldownRounds); }
export function applyTimeout(map: MapState, index: TeamIndex, kind: TimeoutEffect['kind']) {
    if (!canTimeout(map, index))
        throw new Error('暂停次数已用尽、比赛结束或尚在赛事规定的冷却期');
    const advice = timeoutAdvice(map, index).find(x => x.kind === kind)!;
    if (!advice)
        throw new Error('非法暂停选项');
    map.timeoutsUsed[index]++;
    map.effects[index] = { kind, site: advice.site, expiresAfterRound: map.rounds.length + (kind === 'belief' ? 2 : 1) };
    map.timeoutHistory.push({ round: map.rounds.length + 1, team: index, kind, reason: advice.reason });
}
export function aiTimeout(team: Team, index: TeamIndex, map: MapState, rng: Random) {
    if (!canTimeout(map, index) || map.rounds.length < 2)
        return;
    const recent = map.rounds.slice(-3), losses = recent.filter(r => r.winner !== index).length, wins = recent.length - losses;
    const cash = map.fighters.filter(f => f.team === index).reduce((s, f) => s + f.cash, 0) / 5;
    const style = team.coach.style;
    const responds = map.timeoutHistory.some(h => h.team !== index && h.round >= map.rounds.length - 1);
    const highLeverage = map.rounds.length >= 24 || Math.max(...map.score) >= 11;
    const trigger = style === 'stopLoss' ? losses >= 2 : style === 'momentum' ? wins >= 2 : style === 'reactive' ? responds : style === 'economist' ? cash >= 3600 && cash <= 6500 : style === 'highLeverage' ? highLeverage : map.rounds.length >= 6 && (losses >= 2 || wins >= 2);
    if (trigger && rng.next() < (style === 'opportunist' ? .10 : .52)) {
        const kind = style === 'economist' ? 'economy' : style === 'stopLoss' || style === 'highLeverage' ? 'belief' : 'position';
        applyTimeout(map, index, kind);
    }
}
