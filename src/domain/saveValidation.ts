import {BATTLE_ENGINE,validateStoredPlan,validatePlanInput} from './battlePlan';
import { ATTRIBUTE_KEYS, type World, type Series, type Equipment, type Fighter, type TimeoutRules } from './types';
import { COACH_LABELS } from './rules';
import { timeoutLimit } from './coach';
import { COUNT_STAT_KEYS, type PlayerStats } from './statistics';
import type { Career } from './career';
import { MAPS, getMap } from './maps';
import { WEAPONS, UTILITY_PRICES } from './economy';
import { mapWinner, sidesForRound } from './series';
import { validateRound } from './invariants';
import { validateNarration } from './narrative';
const check: (ok: unknown, message: string) => asserts ok = (ok, message) => { if (!ok)
    throw new Error(`存档校验失败：${message}`); };
const integer = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const pair = (a: unknown, min = 0, max = 1000) => Array.isArray(a) && a.length === 2 && a.every(n => integer(n, min, max));
const unique = (ids: unknown) => Array.isArray(ids) && ids.every(id => typeof id === 'string') && new Set(ids).size === ids.length;
const webUrl = (value: unknown) => { try {
    return typeof value === 'string' && ['https:', 'http:'].includes(new URL(value).protocol);
}
catch {
    return false;
} };
function timeoutRules(rules: TimeoutRules | undefined) { if (rules)
    check(integer(rules.perMap, 0, 10) && integer(rules.durationSeconds, 1, 120) && integer(rules.overtimeExtra, 0, 5) && integer(rules.cooldownRounds, 0, 10), '暂停规则错误'); }
function playerStats(rows: PlayerStats[], ids: Set<string>) {
    check(Array.isArray(rows) && unique(rows.map(r => r.id)), '统计选手重复');
    for (const row of rows) {
        check(ids.has(row.id) && COUNT_STAT_KEYS.every(key => integer(row[key], 0, 1e9)), '选手累计统计错误');
        check(row.deaths <= row.rounds && row.kastRounds <= row.rounds && row.clutchWins <= row.clutchAttempts && row.utilityDamage <= row.damage && row.ctRounds + row.tRounds === row.rounds, '选手统计范围错误');
        check(['adr', 'kast', 'rating'].every(key => typeof row[key as keyof PlayerStats] === 'number' && Number.isFinite(row[key as keyof PlayerStats])), '派生统计错误');
    }
}
export function validateWorld(world: World, full = true) {
    check(Array.isArray(world.teams) && Array.isArray(world.players), '世界数据缺失');
    check(world.teams.length === (full ? 50 : 2) && world.players.length === (full ? 250 : 10), '队伍或选手数量错误');
    check(unique(world.teams.map(t => t.id)) && unique(world.players.map(p => p.id)), '重复身份');
    const playerIds = new Set(world.players.map(p => p.id));
    const seats = world.teams.flatMap(t => t.startingFive);
    check(unique(seats) && seats.length === world.teams.length * 5 && seats.every(id => playerIds.has(id)), '阵容席位无效');
    for (const p of world.players) {
        check(typeof p.nickname === 'string' && p.nickname.length > 0 && p.nickname.length <= 100, '选手昵称错误');
        check(['IGL', 'AWPer', 'Entry', 'Support', 'Lurker', 'Rifler', 'Anchor'].includes(p.role), '选手角色错误');
        check(p.attributes && ATTRIBUTE_KEYS.every(key => integer(p.attributes[key], 0, 100)), '个人能力越界');
        if(p.profile){
            const v=p.profile;
            check(typeof v.checkedAt==='string'&&['ranked','sampled','role-only','baseline'].includes(v.basis),'资料版本错误');
            check(Array.isArray(v.roles)&&v.roles.every(r=>typeof r.label==='string'&&typeof r.asOf==='string'&&webUrl(r.url)),'职责来源错误');
            check(Array.isArray(v.awards)&&v.awards.every(a=>typeof a.label==='string'&&webUrl(a.url)),'奖项来源错误');
            check(Array.isArray(v.metrics)&&v.metrics.every(m=>typeof m.key==='string'&&typeof m.label==='string'&&typeof m.value==='number'&&Number.isFinite(m.value)&&typeof m.scope==='string'&&typeof m.period==='string'&&webUrl(m.url)),'表现统计来源错误');
            if(v.ranking)check(integer(v.ranking.year,2000,2100)&&integer(v.ranking.rank,1,20)&&webUrl(v.ranking.url),'年度排名错误');
        }
        check(p.mapProficiency && MAPS.every(m => integer(p.mapProficiency[m.id], 0, 100)), '地图熟练度错误');
        check(Array.isArray(p.history) && p.history.every(h => typeof h === 'string') && p.source && webUrl(p.source.url) && (!p.source.identityUrl || webUrl(p.source.identityUrl)), '选手来源结构错误');
    }
    for (const t of world.teams) {
        check(typeof t.name === 'string' && t.name.length > 0 && t.name.length <= 100, '队名错误');
        check(['EU', 'AMERICAS', 'ASIA', 'UNKNOWN'].includes(t.region), '地区错误');
        const d = t.dynamics;
        check(d && ['chemistry', 'execution', 'communication', 'adaptability', 'economyDiscipline', 'belief'].every(k => typeof d[k as keyof typeof d] === 'number' && Number(d[k as keyof typeof d]) >= 0 && Number(d[k as keyof typeof d]) <= 100), '团队能力越界');
        check(d.mapPreparation && MAPS.every(m => integer(d.mapPreparation[m.id], 0, 100)) && d.tacticFamiliarity && Object.values(d.tacticFamiliarity).every(v => typeof v === 'number' && v >= 0 && v <= 100), '团队熟练度错误');
        check(t.coach && Object.hasOwn(COACH_LABELS, t.coach.style), '教练资料错误');
    }
}
function equipment(eq: Equipment) {
    check(eq && Object.hasOwn(WEAPONS, eq.weapon) && Object.hasOwn(WEAPONS, eq.pistol) && WEAPONS[eq.pistol].category === 'pistol', '未知装备');
    check(integer(eq.armor, 0, 100) && typeof eq.helmet === 'boolean' && typeof eq.kit === 'boolean', '护甲或拆弹器错误');
    check(Array.isArray(eq.utility) && eq.utility.length <= 4 && eq.utility.every(x => Object.hasOwn(UTILITY_PRICES, x)), '道具数量或种类错误');
    for (const item of new Set(eq.utility))
        check(eq.utility.filter(x => x === item).length <= (item === 'flash' ? 2 : 1), '重复道具超限');
}
function fighters(list: Fighter[], s: Series, map: string, allowSpawn = false) {
    check(Array.isArray(list) && list.length === 10 && unique(list.map(f => f.id)), '场上选手数量错误');
    const zones = getMap(map as Series['maps'][number]).zones;
    for (const f of list) {
        check((f.team === 0 || f.team === 1) && s.teams[f.team].startingFive.includes(f.id), '场上队伍归属错误');
        check(['T', 'CT'].includes(f.side) && integer(f.hp, 0, 100) && typeof f.alive === 'boolean' && f.alive === (f.hp > 0), '生命值错误');
        check(integer(f.cash, 0, 16000) && typeof f.blindedUntil === 'number' && typeof f.hasBomb === 'boolean', '选手状态错误');
        check(zones.some(z => z.id === f.zone) || (allowSpawn && f.zone === ''), '选手区域错误');
        equipment(f.equipment);
    }
}
export function validateSeries(s: Series) {
    check(s.engineVersion === undefined || [BATTLE_ENGINE,'causal-2026-10-v3'].includes(s.engineVersion), '未知比赛引擎版本');
    timeoutRules(s.timeoutRules);
    validateWorld({ teams: s.teams, players: s.players }, false);
    check(typeof s.id === 'string' && integer(s.seed, 0, 0xffffffff) && integer(s.rngState, 0, 0xffffffff), '比赛随机状态错误');
    check([1, 3, 5].includes(s.bestOf) && ['veto', 'playing', 'finished'].includes(s.status) && pair(s.score, 0, 3), '系列赛状态错误');
    check(Array.isArray(s.maps) && unique(s.maps) && s.maps.every(id => MAPS.some(m => m.id === id)), '地图池错误');
    check(Array.isArray(s.veto) && s.veto.length <= 6 && unique(s.veto.map(v => v.map)) && s.veto.every(v => (v.team === 0 || v.team === 1) && ['ban', 'pick'].includes(v.kind) && MAPS.some(m => m.id === v.map)), '禁选图错误');
    check(Array.isArray(s.mapStates) && s.mapStates.length <= s.bestOf, '地图进度错误');
    check(s.higherSeed === undefined || s.higherSeed === 0 || s.higherSeed === 1, '高种子归属错误');
    check(s.vetoA === undefined || s.vetoA === 0 || s.vetoA === 1, '禁选顺序错误');
    if (s.startingSides)
        check(Object.entries(s.startingSides).every(([id, side]) => MAPS.some(m => m.id === id) && ['T', 'CT'].includes(side)), '预设选边错误');
    if (s.status === 'veto')
        check(s.veto.length < 6 && s.mapStates.length === 0 && s.winner === null, '禁选阶段错误');
    else
        check(s.maps.length === s.bestOf && s.veto.length === 6 && s.mapStates.length > 0, '选图尚未完成');
    const scores: [
        number,
        number
    ] = [0, 0];
    for (const [index, m] of s.mapStates.entries()) {
        check(m.map === s.maps[index] && ['T', 'CT'].includes(m.startSide) && Array.isArray(m.rounds) && m.rounds.length <= 1000 && pair(m.score), '地图状态错误');
        timeoutRules(m.timeoutRules);
        check(pair(m.lossTiers, 0, 4) && pair(m.timeoutsUsed, 0, timeoutLimit(m)) && Array.isArray(m.effects) && m.effects.length === 2 && Array.isArray(m.timeoutHistory), '经济或暂停状态错误');
        for (const effect of m.effects)
            if (effect)
                check(['position', 'belief', 'economy'].includes(effect.kind) && ['A', 'B'].includes(effect.site) && integer(effect.expiresAfterRound, 1, 1001), '暂停效果错误');
        for (const i of [0, 1])
            check(m.timeoutHistory.filter(t => t.team === i).length === m.timeoutsUsed[i], '暂停扣次不一致');
        const mapScores: [
            number,
            number
        ] = [0, 0];
        for (const [ri, r] of m.rounds.entries()) {
            check(r.number === ri + 1 && r.map === m.map && (r.winner === 0 || r.winner === 1), '回合编号或赢家错误');
            check(Array.isArray(r.sides) && r.sides.length === 2 && r.sides.every((side, i) => side === sidesForRound(m.startSide, ri)[i]), '回合攻守方错误');
            check(['elimination', 'defuse', 'explode', 'time'].includes(r.reason), '回合结束原因错误');
            check(Array.isArray(r.events) && r.events.length > 0 && r.events.length < 20000 && Array.isArray(r.economy) && r.economy.length === 10 && Array.isArray(r.commentary), '回合账本结构错误');
            if(s.engineVersion===BATTLE_ENGINE){
                check(Array.isArray(r.plans)&&r.plans.length===2,'回合缺少执行计划');
                for(const i of [0,1] as const){
                    validateStoredPlan(r.plans[i],r.sides[i]);
                    validatePlanInput(r.decisions[i],r.sides[i]);
                    check(r.plans[i].tactic===r.decisions[i].tactic,'执行计划与战术不一致');
                }
            }
            fighters(r.initial, s, m.map);
            fighters(r.final, s, m.map);
            check(validateRound(r).length === 0 && validateNarration(r).length === 0, '回合账本不守恒');
            mapScores[r.winner]++;
            check(pair(r.score) && r.score.every((n, i) => n === mapScores[i]), '回合比分不一致');
            if (ri < m.rounds.length - 1)
                check(mapWinner(mapScores) === null, '地图结束后仍有回合');
        }
        check(m.score.every((n, i) => n === mapScores[i]) && m.winner === mapWinner(mapScores), '地图比分或赢家不一致');
        fighters(m.fighters, s, m.map, m.rounds.length === 0);
        if (m.winner !== null)
            scores[m.winner]++;
        else
            check(index === s.mapStates.length - 1 && s.status === 'playing', '未结束地图之后仍有比赛');
    }
    check(scores.every((n, i) => n === s.score[i]), '系列赛比分不一致');
    const winner = scores[0] > s.bestOf / 2 ? 0 : scores[1] > s.bestOf / 2 ? 1 : null;
    check(s.winner === winner && (s.status === 'finished') === (winner !== null), '系列赛胜负不一致');
}
export function validateCareer(c: Career) {
    validateWorld(c.world);
    const teamIds = new Set(c.world.teams.map(t => t.id)), playerIds = new Set(c.world.players.map(p => p.id));
    check(teamIds.has(c.managedTeamId) && integer(c.seed, 0, 0xffffffff) && integer(c.season, 1, 10000) && integer(c.week, 1, 52), '生涯状态错误');
    check(c.ratings && [...teamIds].every(id => typeof c.ratings[id] === 'number' && Number.isFinite(c.ratings[id])), '模拟排名错误');
    check(Array.isArray(c.calendar) && c.calendar.length === 12 && unique(c.calendar.map(e => e.id)) && Array.isArray(c.history) && Array.isArray(c.transfers), '赛历或历史错误');
    check(c.calendar.filter(e => e.status === 'active').length <= 1, '同时存在多个进行中赛事');
    if (c.archivedSeasons) {
        check(Array.isArray(c.archivedSeasons) && new Set(c.archivedSeasons.map(s => s.season)).size === c.archivedSeasons.length, '赛季归档重复');
        for (const archive of c.archivedSeasons) {
            check(integer(archive.season, 1, c.season - 1), '赛季归档时间错误');
            playerStats(archive.playerStats, playerIds);
        }
    }
    for (const e of c.calendar) {
        check(['upcoming', 'active', 'finished'].includes(e.status) && ['major', 'masters', 'premier', 'open', 'cup'].includes(e.template) && integer(e.week, 1, 52), '赛事状态错误');
        check(e.finalBestOf === undefined || [3, 5].includes(e.finalBestOf), '决赛赛制错误');
        if (e.status === 'upcoming') {
            check(e.tournament === null, '未开始赛事包含赛果');
            continue;
        }
        const t = e.tournament;
        check(t && t.id === e.id && unique(t.participants) && t.participants.every(id => teamIds.has(id)), '参赛名单错误');
        timeoutRules(t.timeoutRules);
        check(t.template === e.template && (t.finalBestOf === undefined || [3, 5].includes(t.finalBestOf)) && (e.finalBestOf === undefined || t.finalBestOf === e.finalBestOf), '赛事规则不一致');
        check(['swiss', 'playoffs', 'finished'].includes(t.phase) && integer(t.stage, 1, 4) && integer(t.wave, 1, 5) && Array.isArray(t.standings) && Array.isArray(t.fixtures) && Array.isArray(t.playerStats), '赛事进度错误');
        check(t.participants.length === (t.template === 'major' ? 32 : ['premier', 'cup'].includes(t.template) ? 8 : 16), '参赛人数错误');
        playerStats(t.playerStats, playerIds);
        for (const id of t.participants)
            check(t.lockedRosters && unique(t.lockedRosters[id]) && t.lockedRosters[id].length === 5 && t.lockedRosters[id].every(p => playerIds.has(p)), '锁定阵容错误');
        check(unique(t.fixtures.map(f => f.id)), '重复赛程');
        for (const f of t.fixtures)
            check(t.participants.includes(f.a) && t.participants.includes(f.b) && f.a !== f.b && [1, 3, 5].includes(f.bestOf) && integer(f.seed, 0, 0xffffffff) && (f.winner === null ? f.score === null : [f.a, f.b].includes(f.winner) && pair(f.score, 0, 3)), '对阵结构错误');
        for (const f of t.fixtures)
            if (f.winner !== null) {
                const wi = f.winner === f.a ? 0 : 1;
                check(f.score![wi] === Math.ceil(f.bestOf / 2) && f.score![1 - wi] < Math.ceil(f.bestOf / 2), '对阵胜负与比分不一致');
            }
        for (const row of t.standings)
            check(t.participants.includes(row.teamId) && integer(row.wins, 0, 3) && integer(row.losses, 0, 3) && unique(row.opponents) && row.opponents.every(id => t.participants.includes(id) && id !== row.teamId), '瑞士轮积分错误');
        check((e.status === 'finished') === (t.phase === 'finished') && (t.champion === null || t.participants.includes(t.champion)), '赛事冠军状态错误');
    }
}
