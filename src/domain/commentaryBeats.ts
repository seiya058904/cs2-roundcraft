import type { RoundResult, Series, CommentarySegment, RoundEvent, TeamIndex } from './types';
import { getMap, getZone } from './maps';
import { hash } from './random';
import { WEAPONS } from './economy';
import { getTactic } from './tactics';
import templates from '../data/commentary.json';
import { quoteCandidates, realQuoteCatalog } from './realQuotes';
import { commentaryPlayerName, commentaryTeamName, formatCommentaryNames } from './names';
/** Every eligible original line has an explicit fact gate. Unsupported scenes stay in the source library. */
export interface CommentaryBeat {
    id: string;
    at: number;
    category: string;
    priority: number;
    eventIds: string[];
    candidates: string[];
    facts: Record<string, string | number>;
    fallback: string;
    emphasis: CommentarySegment['emphasis'];
}
export const commentaryCatalog = new Map<string, {
    id: string;
    text: string;
}>([...templates, ...realQuoteCatalog.values()].map(t => [t.id, t]));
export const COMMENTARY_VERSION = 'causal-story-6';
export function deriveCommentaryBeats(round: RoundResult, series: Series): CommentaryBeat[] {
    const events = round.events, map = getMap(round.map), beats: CommentaryBeat[] = [];
    const nick = (id?: string) => commentaryPlayerName(series.players.find(p => p.id === id) ?? '选手');
    const t: TeamIndex = round.sides[0] === 'T' ? 0 : 1, ct: TeamIndex = t === 0 ? 1 : 0;
    const team = (i: number) => commentaryTeamName(series.teams[i]);
    const aliveIds = new Set(round.initial.map(f => f.id));
    const startScore: [
        number,
        number
    ] = [...round.score];
    startScore[round.winner]--;
    const common: Record<string, string | number> = { T: team(t), CT: team(ct), MAP: map.name, 地图: map.name, 攻方: team(t), 守方: team(ct), 获胜队: team(round.winner), 失败队: team(1 - round.winner), 比分: startScore.join(':') };
    const add = (category: string, at: number, priority: number, refs: RoundEvent[], candidates: string[], fallback: string, facts: Record<string, string | number> = {}, emphasis: CommentarySegment['emphasis'] = 'neutral') => {
        beats.push({ id: `${round.map}-r${round.number}-${category}-${beats.length}`, at, category, priority, eventIds: [...new Set(refs.map(e => e.id))], candidates, facts: { ...common, ...facts }, fallback, emphasis });
    };
    const tactics = events.filter(e => e.kind === 'tactic' && e.at === 0), tactic = getTactic(round.decisions[t].tactic), ctTactic = getTactic(round.decisions[ct].tactic);
    const pistol = round.number === 1 || round.number === 13;
    const openerIds = round.number === 1 ? ['C001', 'C002', 'WJ-001', 'WJ-004'] : round.number === 13 ? ['WJ-172'] : round.number === 25 ? ['C168'] : ['WJ-008', 'WJ-009'];
    add('setup', 0, 100, tactics, openerIds, `${map.name}，${team(t)}进攻，${team(ct)}防守。`);
    add('plan', 0, 90, tactics, [], `${team(t)}选择${tactic.name}，${team(ct)}用${ctTactic.name}应对。`);
    for (const timeout of events.filter(e => e.kind === 'coachTimeout')) {
        const change = timeout.detail.kind === 'belief' ? '缩小临场波动' : timeout.detail.kind === 'economy' ? '统一起枪预算' : '重新分配重点区域';
        add('timeout', 0, 91, [timeout], [], `${team(timeout.team!)}刚刚暂停，下一步重点是${change}；效果还要看这一回合实际执行。`);
    }
    const strength = (index: number) => round.economy.filter(e => round.initial.find(f => f.id === e.playerId)!.team === index).reduce((sum, e) => sum + WEAPONS[e.loadout.weapon].price + e.loadout.armor * 6.5 + (e.loadout.helmet ? 350 : 0), 0);
    const values = [strength(0), strength(1)];
    const weak = values[0] < values[1] ? 0 : 1, strong = 1 - weak;
    if (values[strong] > values[weak] * 1.8 && values[strong] - values[weak] > 5000) {
        const eco = round.decisions[weak].buy === 'eco';
        add('economy', 0, 88, events.filter(e => e.kind === 'buy'), eco ? ['WJ-121', 'WJ-125'] : ['WJ-125'], `${team(weak)}装备明显落后，得靠近点和补枪争取交换。`, { 经济劣势队: team(weak), 装备优势队: team(strong) });
    }
    const kills = events.filter(e => e.kind === 'kill'), first = kills[0];
    let planted = false, firstRecorded = false, firstTrade = false;
    let clutchPlayer: string | null = null;
    let clutchSize = 0;
    let clutchStart: RoundEvent | null = null;
    const eventIndex = new Map(events.map((e, i) => [e.id, i]));
    for (const e of events) {
        if(e.kind==='tactic'&&typeof e.detail.rule==='string'&&typeof e.detail.reason==='string'){
            add('phase-'+e.detail.rule,e.at,e.detail.status==='waiting'?88:e.detail.status==='interrupted'?50:84,[e],[],`${e.actor?nick(e.actor):team(e.team!)}：${e.detail.reason}。`);
        }
        if (e.kind === 'kill') {
            const before = [0, 1].map(team => round.initial.filter(f => f.team === team && aliveIds.has(f.id)).length);
            aliveIds.delete(e.target!);
            const a = e.alive!;
            if (!firstRecorded) {
                firstRecorded = true;
                add('opening', e.at, 95, [e], pistol ? ['WJ-016'] : [], `${getZone(map, e.zone!).name}先交火！${nick(e.actor)}用${e.weapon}拿下${nick(e.target)}，场上变成${a[t]}打${a[ct]}。`, { 选手A: nick(e.actor) }, 'tense');
            }
            if (a[t] === 3 && a[ct] === 5)
                add('disadvantage', e.at, 67, [e], ['C075', 'WJ-076'], `${team(t)}现在三打五，原定的推进要重新掂量。`, {}, 'tense');
            if (a[t] === 3 && a[ct] === 3 && !planted && e.at < 60)
                add('even', e.at, 60, [e], ['C017'], '三打三，包还没下，双方都还有调整的时间。');
            if (a[t] === 2 && a[ct] === 2)
                add('two-v-two', e.at, 65, [e], ['WJ-084'], '双方剩下二打二，局面又回到均势。', {}, 'tense');
            if (a[t] === 4 && a[ct] === 3 && !planted)
                add('four-v-three', e.at, 72, [e], [], `${team(t)}四打三，人数优势已经到手。`);
            if (a[t] === 5 && a[ct] === 3 && !planted)
                add('five-v-three', e.at, 72, [e], [], `${team(t)}五打三，保住人数优势还有推进空间。`);
            const winnerSide = round.initial.find(f => f.id === e.actor)!.side;
            const priorPickups = events.slice(0, eventIndex.get(e.id)).filter(x => x.kind === 'pickup' && x.actor === e.target && x.weapon);
            const weaponVictim = priorPickups.at(-1)?.weapon ?? round.economy.find(b => b.playerId === e.target)?.loadout.weapon;
            if (weaponVictim === 'AWP' && WEAPONS[e.weapon ?? '']?.category === 'rifle')
                add('rifle-v-awp', e.at, 78, [e], ['C122'], `${nick(e.actor)}用步枪打掉了狙击手！`, { Q: nick(e.actor) }, 'hype');
            if (e.weapon === 'AWP' && e.id === first?.id && winnerSide === 'CT')
                add('awp-opening', e.at, 96, [e], ['WJ-109'], `${nick(e.actor)}的 AWP 先响，防守方收下首杀。`, { 选手A: nick(e.actor) }, 'tense');
            const damage = events.find(x => e.causes.includes(x.id) && x.kind === 'damage');
            const duel = damage && events.find(x => damage.causes.includes(x.id) && x.kind === 'duel');
            if (duel?.detail.headshot === true && !beats.some(b => b.category === 'headshot'))
                add('headshot', e.at, 82, [duel, damage!, e], [], `${nick(e.actor)}爆头带走${nick(e.target)}！`, {}, 'hype');
            const flash = events.slice(0, eventIndex.get(e.id)).reverse().find(x => x.kind === 'blind' && x.target === e.target && x.actor !== e.actor && Number(x.detail.until) >= e.at);
            if (flash && !beats.some(b => b.category === 'flash-conversion'))
                add('flash-conversion', e.at, 94, [flash, ...events.filter(x => flash.causes.includes(x.id)), e], [], `闪给到了！${nick(flash.actor)}先把${nick(e.target)}闪白，${nick(e.actor)}第二时间接上击杀。`, {}, 'tense');
            if (duel && Number(duel.detail.smoke) < 1)
                add('smoke-kill', e.at, 83, [duel, damage!, e], ['WJ-116'], `${nick(e.actor)}隔着烟带走了对手，这一枪穿得漂亮！`, { 选手A: nick(e.actor) }, 'hype');
            for (const index of [0, 1] as const) {
                const opponents = 1 - index;
                if (a[index] === 1 && a[opponents] >= 2 && before[index] > 1 && !clutchPlayer) {
                    clutchPlayer = round.initial.find(f => f.team === index && aliveIds.has(f.id))!.id;
                    clutchSize = a[opponents];
                    clutchStart = e;
                    add('clutch-start', e.at, 76, [e], clutchSize === 2 ? ['WJ-097'] : clutchSize === 3 ? ['C101'] : [], `只剩${nick(clutchPlayer)}，一打${clutchSize}。先拆成单独交锋，才有继续打下去的机会。`, { P: nick(clutchPlayer), 选手A: nick(clutchPlayer), clutchId: clutchPlayer, clutchSize }, 'tense');
                }
            }
        }
        if (e.kind === 'trade' && !firstTrade) {
            firstTrade = true;
            const tradeKills = e.causes.map(id => events.find(x => x.id === id)!).filter(Boolean);
            const last = tradeKills.at(-1);
            const refs = [...tradeKills, e];
            const candidates = ['WJ-052'];
            if (last?.alive?.[0] === 4 && last.alive[1] === 4 && e.causes.includes(first?.id ?? ''))
                candidates.push('C067');
            const delay = tradeKills.length >= 2 ? Math.abs(tradeKills[0].at - tradeKills[1].at) : 0;
            add('trade', e.at, 96, refs, candidates, `${nick(e.actor)}${delay ? `只隔${delay}秒就` : '马上'}把枪补上，${last?.alive ? `场上是${last.alive[t]}打${last.alive[ct]}` : '人数差距被缩小'}。`, {}, 'tense');
        }
        if (e.kind === 'blind' && !beats.some(b => b.category === 'flash')) {
            const thrower = round.initial.find(f => f.id === e.actor)!;
            add('flash', e.at, 58, [e, ...events.filter(x => e.causes.includes(x.id))], thrower.team === t ? ['WJ-038'] : [], `${nick(e.target)}在${getZone(map, e.zone!).name}被闪白，视野短暂丢失。`, { 进攻点: getZone(map, e.zone!).name });
        }
        if (e.kind === 'smoke' && !beats.some(b => b.category === 'smoke'))
            add('smoke', e.at, 47, [e], ['WJ-037'], `${getZone(map, e.zone!).name}烟雾升起，隔烟交火的命中会受到压制。`);
        if (e.kind === 'extinguish' && !beats.some(b => b.category === 'extinguish'))
            add('extinguish', e.at, 87, [e, ...events.filter(x => e.causes.includes(x.id))], [], `烟灭火！${nick(e.actor)}这颗烟把${getZone(map, e.zone!).name}的火扑掉了，火区压力先解开。`);
        if (e.kind === 'damage' && e.weapon === 'HE' && e.hpAfter! <= 35)
            add('grenade', e.at, 66, [e, ...events.filter(x => e.causes.includes(x.id))], ['WJ-046'], `这颗雷把${nick(e.target)}炸到${e.hpAfter}血，后续交火容错更低了。`);
        if (e.kind === 'damage' && e.weapon === 'fire' && e.hpAfter! <= 35 && !beats.some(b => b.category === 'fire-damage'))
            add('fire-damage', e.at, 77, [e, ...events.filter(x => e.causes.includes(x.id))], [], `${nick(e.target)}被火焰逼到${e.hpAfter}血，再不离开火区就危险了。`);
        if (e.kind === 'info' && e.team === ct && e.detail.delay !== undefined) {
            const nextMove = events.slice((eventIndex.get(e.id) ?? 0) + 1).find(x => x.kind === 'move' && x.team === ct && x.at <= e.at + 2);
            if (nextMove && !beats.some(b => b.category === 'rotation'))
                add('rotation', nextMove.at, 64, [e, nextMove], [], `${team(ct)}收到${getZone(map, e.zone!).name}的情报，${nick(nextMove.actor)}开始支援；这段轮转得实实在在跑${nextMove.detail.travelSeconds}秒。`);
        }
        if (e.kind === 'pickup' && e.weapon && WEAPONS[e.weapon].category !== 'pistol') {
            const original = round.economy.find(b => b.playerId === e.actor)!.loadout.weapon;
            add('pickup', e.at, 73, [e], WEAPONS[original].category === 'pistol' ? ['WJ-124'] : [], `${nick(e.actor)}在${getZone(map, e.zone!).name}捡到${e.weapon}，这把枪留在手里了。`, { 选手A: nick(e.actor) });
        }
        if (e.kind === 'plant') {
            planted = true;
            add('plant', e.at, 92, [e], ['C091'], `${nick(e.actor)}把包下在${getZone(map, e.zone!).name}，40 秒回防倒计时开始。`, {}, 'tense');
        }
        if (e.kind === 'defuse') {
            const plant = events.find(x => x.kind === 'plant')!;
            const spare = Number(plant.detail.explodeAt) - e.at;
            add('defuse-timing', e.at, 98, [plant, e], [], `拆掉了！${nick(e.actor)}${e.detail.kit ? '有钳' : '没钳'}，这一拆用了${e.detail.duration}秒，离爆炸还剩${spare}秒。`, {}, spare <= 3 ? 'hype' : 'tense');
        }
        if (e.kind === 'save' && e.detail.decision === true && !beats.some(b => b.category === 'save-decision'))
            add('save-decision', e.at, 93, [e], [], `${nick(e.actor)}选择撤退保枪：${e.detail.reason}。`);
    }
    const counts = new Map<string, RoundEvent[]>();
    for (const k of kills)
        counts.set(k.actor!, [...(counts.get(k.actor!) ?? []), k]);
    const star = [...counts].sort((a, b) => b[1].length - a[1].length)[0];
    if (star && star[1].length >= 3) {
        const last = star[1].at(-1)!;
        add('multikill', last.at, 89, star[1], [], `${nick(star[0])}！这一回合已经拿到${star[1].length}杀，关键枪线接连被他打穿。`, {}, 'hype');
    }
    const end = events.at(-1)!;
    const ending = round.reason === 'defuse' ? '拆掉了，回防成功' : round.reason === 'explode' ? '时间走完，炸弹爆炸' : round.reason === 'time' ? '时间到了，进攻方没能下包' : '对方全部倒下，这个回合结束';
    const endRefs = [end, ...events.filter(e => ['defuse', 'explode', 'timerEnd'].includes(e.kind))];
    let endTemplates: string[] = [];
    if (round.reason === 'time')
        endTemplates = [];
    else if (pistol && round.number === 1)
        endTemplates = ['WJ-023'];
    if (clutchPlayer && round.initial.find(f => f.id === clutchPlayer)!.team === round.winner && round.final.some(f => f.id === clutchPlayer && f.alive)) {
        add('clutch-win', end.at, 99, [clutchStart!, ...kills.filter(k => k.actor === clutchPlayer), ...endRefs], ['WJ-106'], `${nick(clutchPlayer)}把一打${clutchSize}拿下了！${round.reason==='time'?'他坚持到了时间耗尽，进攻方没能完成下包。':round.reason==='defuse'?'最后完成拆包，回防成功。':round.reason==='explode'?'最后守住了炸弹计时。':'最后一个对手也被解决了。'}`, { 选手A: nick(clutchPlayer), clutchSize }, 'hype');
    }
    if (round.winner === weak && values[strong] > values[weak] * 1.8 && values[strong] - values[weak] > 5000) {
        const smallGuns = round.economy.filter(b => round.initial.find(f => f.id === b.playerId)!.team === weak).every(b => WEAPONS[b.loadout.weapon].category === 'pistol');
        if (smallGuns && weak === t)
            endTemplates = ['C120'];
        add('eco-win', end.at, 94, endRefs, [], `${team(weak)}在装备明显落后的情况下拿下回合！`, {}, 'hype');
    }
    add('close', end.at, 100, endRefs, endTemplates, `${ending}。${team(round.winner)}拿下这一分，比分来到${round.score.join(':')}。`, { 比分: round.score.join(':') }, 'conclusion');
    if (round.number === 12)
        add('half-time', end.at, 92, [end], ['WJ-171'], `上半场结束，${round.score.join(':')}。换边之后重新进入手枪局。`, { 比分: round.score.join(':') }, 'conclusion');
    if (round.score[0] === 12 && round.score[1] === 12)
        add('overtime', end.at, 99, [end], ['C161', 'WJ-177'], '十二比十二，进入加时。', {}, 'hype');
    if (round.score[round.winner] === 12 && Math.min(...round.score) < 12) {
        if (Math.min(...round.score) === 11)
            add('overtime-threat', end.at, 97, [end], [], `十二比十一，下一分决定常规时间结束还是加时。`, {}, 'tense');
        else
            add('match-point', end.at, 94, [end], [], `${team(round.score[0] === 12 ? 0 : 1)}拿到常规时间赛点。`, {}, 'tense');
    }
    return beats;
}
export function renderChineseCommentary(beats: CommentaryBeat[], round: RoundResult, series: Series): CommentarySegment[] {
    const high = beats.some(b => ['clutch-win','overtime','eco-win'].includes(b.category));
    const seenCategories = new Set<string>();
    const ranked = beats.filter(b => !['setup', 'plan', 'close'].includes(b.category)).sort((a, b) => b.priority - a.priority).filter(b=>{if(seenCategories.has(b.category))return false;seenCategories.add(b.category);return true;});
    const context = ranked.find(b => ['trade', 'flash-conversion', 'extinguish', 'defuse-timing', 'rotation', 'grenade', 'fire-damage', 'save-decision'].includes(b.category));
    // Cover different causes, not just the loudest kills. All segments retain event anchors.
    const main = ranked.slice(0, high ? 9 : 6);
    if (context && !main.includes(context))
        main[main.length - 1] = context;
    const anchorIndex=(b:CommentaryBeat)=>Math.max(...b.eventIds.map(id=>round.events.findIndex(e=>e.id===id)));
    const selected = [...beats.filter(b => b.category === 'setup' || b.category === 'plan'), ...main, ...beats.filter(b => b.category === 'close')].sort((a, b) => a.at - b.at || (a.category === 'close' ? 1 : b.category === 'close' ? -1 : round.plans ? anchorIndex(a)-anchorIndex(b) : 0));
    const recent = new Set(series.mapStates.filter(m => m.map === round.map).flatMap(m => m.rounds).filter(r => r.number < round.number && r.number >= round.number - 5).flatMap(r => r.commentary.map(s => s.templateId)).filter(Boolean));
    const history = series.mapStates.filter(m => m.map === round.map).flatMap(m => m.rounds).filter(r => r.number < round.number);
    const emphatic = /卧槽|牛逼|无敌|太变态|太夸张/;
    const metaphor = /高压锅|一键扫荡|歼灭模式|游龙|包饺子|空城计|变速齿轮/;
    const recentEmphasis = history.filter(r => r.number >= round.number - 3).some(r => r.commentary.some(s => emphatic.test(s.text)));
    const recentMetaphor = history.filter(r => r.number >= round.number - 10).some(r => r.commentary.some(s => metaphor.test(s.text)));
    const result: CommentarySegment[] = [];
    const eventById = new Map(round.events.map(e => [e.id,e]));
    const briefBeats = new Set(ranked.slice(0, 3).map(b => b.id));
    const wording = (beat:CommentaryBeat, variants:string[]) => variants[hash(`${series.seed}|${round.number}|${beat.category}|detail`)%variants.length];
    const detailFor = (beat: CommentaryBeat) => {
        const refs = beat.eventIds.map(id => eventById.get(id)!).filter(Boolean);
        const kill = refs.find(e => e.kind === 'kill');
        const nick = (id?:string) => commentaryPlayerName(series.players.find(p => p.id===id) ?? '选手');
        if(beat.category==='setup') return `当前比分${round.score.map((v,i)=>v-(i===round.winner?1:0)).join('比')}。`;
        if(beat.category==='plan') return '';
        if(beat.category==='opening' && kill) return `首杀出现在${kill.at}秒。${nick(kill.target)}这一侧少了一个交火点，接下来是立刻补枪，还是先稳住重新组织，要看队友的位置。`;
        if(beat.category==='trade') return wording(beat,['你看第二个人，位置跟上了，这次交换没有白给。','前面的人倒下，后面的人还能接上交火，这才是队形的价值。','这波要连着看，第一枪和第二枪不是两件事，补上这一下才把交换做出来。']);
        if(beat.category==='flash-conversion') return wording(beat,['你看这颗闪，先把视野限制住，再由队友接枪，两个人的贡献得一起算。','漂亮的不是最后这一枪而已，前面的闪光先把机会送出来了。','这次道具和枪接上了，吃白的人还没恢复视野，第二个人就完成了击杀。']);
        if(beat.category==='rotation') return wording(beat,['人已经往这边靠了，守点的人得先顶住，支援还要跑这一段。','转过来了！不过路还得跑完，先看原地的队友能拖多久。','这次轮转有情报依据，接下来就看赶到现场的时间。']);
        if(beat.category==='smoke') return '这颗烟先改变的是视野，后续能不能转成空间，还要看队员是否跟进。现在不能提前说这个区域已经安全。';
        if(beat.category==='extinguish') return '火区解除和区域清空是两回事。烟处理掉了持续伤害，剩下的枪线还得靠人来确认。';
        if(beat.category==='clutch-start') return wording(beat,['现在最怕同时面对两条枪线，得争取一个一个处理。','先别急着判死刑，要是能把对面拆成单挑，还有操作的空间。','兄弟们，后面已经没人能补枪了，每一步都得自己处理。']);
        if(beat.category==='plant') return '包一落地，比赛的任务就变了：进攻方可以围绕时间组织，防守方必须在计时结束前完成拆除。';
        if(beat.category==='grenade'||beat.category==='fire-damage') return '血量被压低之后，下一次交火的容错就小了。道具造成的这部分伤害，也会影响后面的交换。';
        if(beat.category==='clutch-win') return wording(beat,['这一分真给他接住了，人数不是最后的答案！','拿下！落到残局这个位置，还真把回合收回来了。','这分量就不一样了，从少打多到拿下回合，顶住了。']);
        return '';
    };
    for (const beat of selected) {
        const intensityFits = (text: string) => {
            const highMoment = ['multikill', 'clutch-win', 'eco-win'].includes(beat.category);
            if (emphatic.test(text) && (!highMoment || recentEmphasis || result.some(s => emphatic.test(s.text))))
                return false;
            if (metaphor.test(text) && (!highMoment || recentMetaphor || result.some(s => metaphor.test(s.text))))
                return false;
            return true;
        };
        const quotes = quoteCandidates(beat, round).map(id => realQuoteCatalog.get(id)!).filter(q => !result.some(s => s.templateId===q.id) && !recent.has(q.id) && intensityFits(q.text));
        const all = beat.candidates.map(id => commentaryCatalog.get(id)).filter((t): t is {
            id: string;
            text: string;
        } => Boolean(t) && !result.some(s=>s.templateId===t!.id) && intensityFits(t!.text));
        const fresh = all.filter(t => !recent.has(t.id));
        const candidates = quotes.length ? quotes : fresh.length ? fresh : all;
        const template = candidates.length ? candidates[hash(`${series.id}|${round.map}|${round.number}|${COMMENTARY_VERSION}|${beat.category}`) % candidates.length] : undefined;
        let text = template?.text.replace(/\{([^{}]+)\}/g, (_, key: string) => String(beat.facts[key] ?? `{${key}}`)) ?? beat.fallback;
        if (/\{[^{}]+\}/.test(text))
            text = beat.fallback;
        const quote = template && realQuoteCatalog.get(template.id);
        if (quote)
            text = beat.fallback + ' ' + quote.text;
        else if (beat.category === 'close' && template)
            text += ` ${commentaryTeamName(series.teams[round.winner])}拿下这一分，比分来到${round.score.join(':')}。`;
        text = formatCommentaryNames(text, series.players, series.teams);
        const briefText = ['setup','close'].includes(beat.category) || briefBeats.has(beat.id) ? formatCommentaryNames(beat.fallback,series.players,series.teams) : '';
        const explanation=detailFor(beat);
        if(explanation) text += ' ' + explanation;
        const stage: CommentarySegment['stage'] = ['setup','plan','economy','timeout'].includes(beat.category)?'开局部署':['flash','flash-conversion','smoke','extinguish','grenade','fire-damage'].includes(beat.category)?'道具配合':['close','half-time','overtime','match-point','overtime-threat'].includes(beat.category)?'回合结算':['rotation','plant','clutch-start','save-decision','defuse-timing'].includes(beat.category)?'局势变化':'接触交锋';
        if (beat.category === 'plan' && result.length) {
            const previous = result.at(-1)!;
            previous.text += ' ' + text;
            previous.eventIds = [...new Set([...previous.eventIds, ...beat.eventIds])];
            previous.sourceBeatIds!.push(beat.id);
            continue;
        }
        result.push({ text, briefText, stage, at: beat.at, sourceType: quote ? (formatCommentaryNames(quote.text,series.players,series.teams)===quote.text?'quote':'adapted-quote') : template?'template':'original', eventIds: beat.eventIds, emphasis: beat.emphasis, sourceBeatIds: [beat.id], ...(template ? { templateId: template.id } : {}), ...(quote ? { quoteSource: quote.source } : {}) });
    }
    return result;
}
