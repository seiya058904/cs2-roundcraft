import {BATTLE_ENGINE, classifyEconomy, resolveBattlePlan, validatePlanInput, shouldWaitForSmoke, regroupReady, shouldReserveUtility, shouldSave} from './battlePlan';
import type {BattlePlan} from './battlePlan';
import { DEFAULT_TIMEOUT_RULES } from './rules';
import type { Series, Decision, Fighter, RoundEvent, EventKind, TeamIndex, RoundResult, EconomyEntry } from './types';
import { Random, clamp } from './random';
import { getMap, getZone, shortestPath, sightRange } from './maps';
import { ECONOMY, WEAPONS, emptyEquipment, purchase, purchaseForTeammates } from './economy';
import { chooseAI, getTactic } from './tactics';
import { aiTimeout } from './coach';
import { sidesForRound, mapWinner, completeMap } from './series';
import { renderCommentary } from './narrative';
/** Pure simulation boundary: all entropy is stored in Series.rngState. No UI or clock reads. */
export function resolveRound(series: Series, manual?: Partial<Record<TeamIndex, Decision>>): RoundResult {
    if (series.status !== 'playing')
        throw new Error('当前没有可执行的回合');
    const planned = series.engineVersion === BATTLE_ENGINE;
    const modern = planned || series.engineVersion === 'causal-2026-10-v3';
    const ms = series.mapStates.at(-1)!;
    if (ms.winner !== null)
        throw new Error('地图已经结束');
    const rng = new Random(series.rngState), map = getMap(ms.map), n = ms.rounds.length, sides = sidesForRound(ms.startSide, n);
    for (const index of [0, 1] as const) {
        const decision = manual?.[index];
        if (!decision)
            continue;
        if (planned) validatePlanInput(decision, sides[index]);
        if (getTactic(decision.tactic).side !== sides[index])
            throw new Error('该战术不适用于当前攻守方');
        if (!['auto', 'eco', 'halfBuy', 'forceBuy', 'fullBuy', 'awpPriority'].includes(decision.buy) || !['conservative', 'balanced', 'aggressive'].includes(decision.risk))
            throw new Error('无效回合指令');
        for (const [id, zone] of Object.entries(decision.positions ?? {})) {
            if (!series.teams[index].startingFive.includes(id))
                throw new Error('只能配置本队首发站位');
            if (zone)
                getZone(map, zone);
        }
        for (const [id, stance] of Object.entries(decision.stances ?? {}))
            if (!series.teams[index].startingFive.includes(id) || !['close', 'standard'].includes(stance))
                throw new Error('无效架点方式');
    }
    const reset = n === 0 || n === 12 || n >= 24 && (n - 24) % 3 === 0;
    if (reset) {
        ms.lossTiers = [ECONOMY.initialLossTier, ECONOMY.initialLossTier];
        for (const f of ms.fighters) {
            f.cash = n >= 24 ? ECONOMY.otCash : ECONOMY.startCash;
            f.equipment = emptyEquipment(sides[f.team]);
        }
    }
    for (const f of ms.fighters) {
        f.side = sides[f.team];
        f.hp = 100;
        f.alive = true;
        f.blindedUntil = 0;
        f.hasBomb = false;
        f.zone = f.side === 'T' ? map.tSpawn : map.ctSpawn;
    }
    for (const index of [0, 1] as const)
        if (!manual?.[index])
            aiTimeout(series.teams[index], index, ms, rng);
    const decisions = [0, 1].map(i => structuredClone(manual?.[i as TeamIndex] ?? chooseAI(series.teams[i], i as TeamIndex, ms, sides[i], rng, planned))) as [
        Decision,
        Decision
    ];
    for (const index of [0, 1] as const) {
        const effect = ms.effects[index];
        if (effect?.kind === 'position' && effect.expiresAfterRound >= n + 1)
            decisions[index].tactic = sides[index] === 'T' ? (effect.site === 'A' ? 'splitA' : 'splitB') : (effect.site === 'A' ? 'stackA' : 'stackB');
    }
    decisions.forEach((d, i) => { if (getTactic(d.tactic).side !== sides[i])
        throw new Error('该战术不适用于当前攻守方'); });
    const events: RoundEvent[] = [];
    let now = 0;
    const alive = () => [ms.fighters.filter(f => f.team === 0 && f.alive).length, ms.fighters.filter(f => f.team === 1 && f.alive).length] as [
        number,
        number
    ];
    const emit = (kind: EventKind, data: Partial<Omit<RoundEvent, 'kind' | 'id' | 'at'>> = {}): RoundEvent => { const e: RoundEvent = { id: `r${n + 1}-e${events.length + 1}`, at: now, kind, causes: [], detail: {}, ...data }; events.push(e); return e; };
    const player = (f: Fighter) => series.players.find(p => p.id === f.id)!;
    const economy: EconomyEntry[] = ms.fighters.map(f => { const effect = ms.effects[f.team]; let policy = effect?.kind === 'economy' && effect.expiresAfterRound >= n + 1 ? 'auto' : decisions[f.team].buy; if (policy === 'auto' && (n === 0 || n === 12))
        policy = 'fullBuy'; const before = f.cash; const bought = purchase(f, policy, player(f).role === 'AWPer', effect?.kind === 'economy' ? 100 : series.teams[f.team].dynamics.economyDiscipline); emit('buy', { actor: f.id, team: f.team, weapon: f.equipment.weapon, detail: { cashBefore: before, spend: bought.spend, cashAfter: f.cash, armor: f.equipment.armor, helmet: f.equipment.helmet } }); return { playerId: f.id, cashBefore: before, spend: bought.spend, cashAfterBuy: f.cash, loadout: bought.loadout, killRewards: 0, objectiveRewards: 0, teamRewards: 0, cashAtEnd: 0, carriedEquipment: null, lossTierBefore: ms.lossTiers[f.team], lossTierAfter: 0 }; });
    const cashBook = (id: string) => economy.find(e => e.playerId === id)!;
    for (const gift of purchaseForTeammates(ms.fighters, decisions.map(d => d.buy) as [
        Decision['buy'],
        Decision['buy']
    ], new Set(series.players.filter(p => p.role === 'AWPer').map(p => p.id)))) {
        const donor = ms.fighters.find(f => f.id === gift.donor)!, recipient = ms.fighters.find(f => f.id === gift.recipient)!;
        const book = cashBook(donor.id);
        book.spend += gift.price;
        book.cashAfterBuy = donor.cash;
        cashBook(recipient.id).loadout = structuredClone(recipient.equipment);
        emit('donation', { actor: donor.id, target: recipient.id, team: donor.team, weapon: gift.weapon, detail: { price: gift.price, cashAfter: donor.cash } });
    }
    const plans = planned ? ([0,1] as const).map(i => {
        const effect=ms.effects[i], active=effect && effect.expiresAfterRound>=n+1;
        return resolveBattlePlan(decisions[i],sides[i],classifyEconomy(n+1,active&&effect.kind==='economy'?'auto':decisions[i].buy,ms.fighters.filter(f=>f.team===i),economy),ms.rounds,i,Boolean(active&&effect.kind==='position'));
    }) as [BattlePlan,BattlePlan] : undefined;
    const tTeam = sides[0] === 'T' ? 0 : 1, ctTeam = (1 - tTeam) as TeamIndex;
    const attackRoleOrder = { Entry: 0, IGL: 1, Rifler: 2, Support: 2, Anchor: 2, AWPer: 3, Lurker: 4 };
    const defenseRoleOrder = { Entry: 0, Support: 1, Anchor: 1, Rifler: 2, AWPer: 2, IGL: 3, Lurker: 4 };
    const ts = ms.fighters.filter(f => f.side === 'T').sort((a, b) => attackRoleOrder[player(a).role] - attackRoleOrder[player(b).role]);
    const cts = ms.fighters.filter(f => f.side === 'CT').sort((a, b) => defenseRoleOrder[player(a).role] - defenseRoleOrder[player(b).role]);
    (ts.find(f => player(f).role === 'Support') ?? ts.find(f => player(f).role === 'IGL') ?? ts[0]).hasBomb = true;
    const initial = structuredClone(ms.fighters);
    const tactics = decisions.map(d => ({ ...getTactic(d.tactic) }));
    tactics.forEach((t, i) => { if (t.side === 'T')
        t.pace = Math.max(3, t.pace + (decisions[i].risk === 'conservative' ? 8 : decisions[i].risk === 'aggressive' ? -6 : 0)); });
    let target = tactics[tTeam].site === 'adaptive' ? (rng.next() < .5 ? 'A' : 'B') : tactics[tTeam].site;
    const siteZone = () => target === 'A' ? map.siteA : map.siteB;
    const effect = ms.effects[ctTeam];
    const ctSite = effect?.kind === 'position' && effect.expiresAfterRound >= n + 1 ? effect.site : tactics[ctTeam].site;
    let allocation = ctSite === 'A' ? ['A', 'A', 'A', 'mid', 'B'] : ctSite === 'B' ? ['A', 'mid', 'B', 'B', 'B'] : ['A', 'A', 'mid', 'B', 'B'];
    const destinations = new Map<string, string[]>(), transit = new Map<string, {
        to: string;
        at: number;
        start: number;
        from: string;
        cause: string;
    }>();
    const readyAt = new Map<string, number>(), lastShot = new Map<string, number>(), smokes = new Map<string, number>(), fires = new Map<string, {
        until: number;
        actor: Fighter;
        cause: string;
    }>();
    const arrivedAt = new Map<string, number>(), entrance = new Map<string, string>();
    const order = (f: Fighter, to: string) => { destinations.set(f.id, shortestPath(map, f.zone, to).zones.slice(1)); };
    for (const [i, f] of cts.entries()) {
        const assignment = allocation[i];
        let zone = assignment === 'A' ? map.siteA : assignment === 'B' ? map.siteB : map.mid;
        if (tactics[ctTeam].aggression > 0 && i % 2 === 0)
            zone = assignment === 'A' ? map.laneA : assignment === 'B' ? map.laneB : map.mid;
        if (tactics[ctTeam].id === 'retake')
            zone = i < 3 ? map.ctSpawn : zone;
        // Passive anchors hold covered site corners; pushing the attacker's lane is a different tactic.
        const override = decisions[ctTeam].positions?.[f.id];
        if (override) {
            getZone(map, override);
            zone = override;
        }
        order(f, zone);
    }
    let attackSite = target;
    for (const [i, f] of ts.entries()) {
        let lane = target === 'A' ? map.laneA : map.laneB;
        if (tactics[tTeam].split && i > 2)
            lane = target === 'A' ? map.alternateA : map.alternateB;
        if (tactics[tTeam].fake && i < 2)
            lane = target === 'A' ? map.laneB : map.laneA;
        const override = decisions[tTeam].positions?.[f.id];
        if (override) {
            getZone(map, override);
            lane = override;
        }
        const team = series.teams[tTeam], familiarity = team.dynamics.tacticFamiliarity[ms.map + ':' + decisions[tTeam].tactic] ?? 60;
        const coordinationGap = (300 - team.dynamics.execution - familiarity - team.dynamics.chemistry) / 24;
        order(f, lane);
        readyAt.set(f.id, Math.max(0, tactics[tTeam].pace - 10) + rng.next() * coordinationGap);
    }
    for (const i of [0, 1] as const) {
        emit('tactic', { team: i, detail: { id: decisions[i].tactic, name: tactics[i].name, side: sides[i], target: i === tTeam ? target : ctSite } });
        const timeout = ms.timeoutHistory.find(t => t.round === n + 1 && t.team === i);
        if (timeout)
            emit('coachTimeout', { team: i, detail: { kind: timeout.kind, reason: timeout.reason, durationSeconds: (ms.timeoutRules ?? DEFAULT_TIMEOUT_RULES).durationSeconds } });
    }
    for (const f of ms.fighters)
        emit('position', { actor: f.id, team: f.team, zone: f.zone, detail: { side: f.side } });
    let plantAt: number | null = null, plantStart: number | null = null, planter: string | null = null, bombZone: string | null = null, defuseStart: number | null = null, defuser: string | null = null;
    let winner: TeamIndex | null = null, reason: RoundResult['reason'] = 'time';
    let observedAt: number | null = null, observedZone: string | null = null, rotated = false, executing = false;
    let lastReport = -20;
    let adapted = false;
    const saving = new Set<string>();
    const ruleStates = new Map<string,{id:string;status:string;team:TeamIndex;actor?:string}>();
    const rule = (id:string,status:string,team:TeamIndex,reason:string,actor?:string,zone?:string,causes:string[]=[]) => {
        const key=id+':'+(actor??team);
        if(ruleStates.get(key)?.status===status)return;
        ruleStates.set(key,{id,status,team,actor});
        emit('tactic',{team,actor,zone,causes,detail:{rule:id,status,reason,version:'plans-1'}});
    };

    const lastDeaths = new Map<string, {
        at: number;
        killer: string;
        event: string;
        zone: string;
    }>();
    const tradeResponse = new Map<string, {
        target: string;
        readyAt: number;
        cause: string;
    }>();
    const drops: {
        zone: string;
        weapon: string;
        taken: boolean;
        cause: string;
        owner: string;
    }[] = [];
    const form = new Map(ms.fighters.map(f => { const p = player(f); const calm = ms.effects[f.team]?.kind === 'belief' && ms.effects[f.team]!.expiresAfterRound >= n + 1; const pressure = Math.max(...ms.score) >= 11; const variance = (100 - p.attributes.consistency) * (pressure ? (110 - p.attributes.composure) / 70 : 1) * (calm ? .45 : 1) / 200; return [f.id, (rng.next() - .5) * variance + (rng.next() < .015 ? p.attributes.peakPotential / 600 : 0)]; }));
    function damage(attacker: Fighter, victim: Fighter, amount: number, weapon: string, cause: string) {
        if (winner !== null)
            return;
        if ((!attacker.alive && weapon !== 'fire') || !victim.alive)
            throw new Error('死者参与伤害');
        const hpBefore = victim.hp;
        const actual = Math.min(hpBefore, Math.max(1, Math.round(amount)));
        victim.hp -= actual;
        const hit = emit('damage', { actor: attacker.id, target: victim.id, team: attacker.team, zone: victim.zone, weapon, damage: actual, hpBefore, hpAfter: victim.hp, causes: [cause] });
        if (victim.hp === 0) {
            victim.alive = false;
            transit.delete(victim.id);
            destinations.delete(victim.id);
            const kill = emit('kill', { actor: attacker.id, target: victim.id, team: attacker.team, zone: victim.zone, weapon, alive: alive(), causes: [hit.id] });
            cashBook(attacker.id).killRewards += WEAPONS[weapon]?.killReward ?? 300;
            drops.push({ zone: victim.zone, weapon: victim.equipment.weapon, taken: false, cause: kill.id, owner: victim.id });
            for (const [id, death] of lastDeaths)
                if (death.killer === victim.id && now - death.at <= 5 && shortestPath(map, death.zone, attacker.zone).seconds <= 5) {
                    emit('trade', { actor: attacker.id, target: id, team: attacker.team, zone: attacker.zone, causes: [death.event, kill.id] });
                    break;
                }
            lastDeaths.set(victim.id, { at: now, killer: attacker.id, event: kill.id, zone: victim.zone });
            for (const ally of ms.fighters.filter(f => f.alive && f.team === victim.team && !transit.has(f.id) && sightRange(map, f.zone, attacker.zone) !== null)) {
                const delay = Math.max(0, Math.round((100 - series.teams[ally.team].dynamics.chemistry) / 35 + (100 - player(ally).attributes.teamwork) / 70));
                const previous = tradeResponse.get(ally.id);
                if (previous?.target === attacker.id && previous.readyAt <= now + delay)
                    continue;
                const response = emit('info', { actor: ally.id, target: attacker.id, team: ally.team, zone: attacker.zone, causes: [kill.id], detail: { reason: '队友倒下后的补枪反应', readyAt: now + delay, reactionSeconds: delay } });
                tradeResponse.set(ally.id, { target: attacker.id, readyAt: now + delay, cause: response.id });
            }
            if (victim.hasBomb) {
                victim.hasBomb = false;
                bombZone = victim.zone;
            }
            if (plantAt === null && !ms.fighters.some(f => f.alive && f.team === victim.team)) {
                winner = (1 - victim.team) as TeamIndex;
                reason = 'elimination';
            }
        }
    }
    for (now = 1; now <= 160; now++) {
        for (const f of ms.fighters.filter(f => f.alive)) {
            const travel = transit.get(f.id);
            if (travel && now >= travel.at) {
                f.zone = travel.to;
                transit.delete(f.id);
                arrivedAt.set(f.id, now);
                entrance.set(f.id, travel.from);
                emit('position', { actor: f.id, team: f.team, zone: f.zone, causes: [travel.cause], detail: { from: travel.from, departAt: travel.start, travelSeconds: travel.at - travel.start } });
            }
            if (transit.has(f.id))
                continue;
            const route = destinations.get(f.id);
            if (route?.length && now >= (readyAt.get(f.id) ?? 0)) {
                const next=route[0];
                if(plans && plans[f.team].smoke==='respect' && (smokes.get(next)??0)>now){
                    const remaining=plantAt===null?ECONOMY.roundSeconds-now:plantAt+ECONOMY.bombSeconds-now;
                    const travel=shortestPath(map,f.zone,plantAt===null?(f.side==='T'?siteZone():route.at(-1)!):bombZone!).seconds+(f.side==='T'?ECONOMY.plantSeconds:f.equipment.kit?5:10);
                    const smoke=events.slice().reverse().find(e=>e.kind==='smoke'&&e.zone===next);
                    if(shouldWaitForSmoke(smokes.get(next)!,now,remaining,travel)){
                        rule('smoke','waiting',f.team,'前方烟雾尚未散去，暂缓穿越',f.id,next,smoke?[smoke.id]:[]);
                        continue;
                    }
                    rule('smoke','interrupted',f.team,'剩余时间不足以等烟，立即推进',f.id,next,smoke?[smoke.id]:[]);
                } else if(plans && ruleStates.get('smoke:'+f.id)?.status==='waiting') {
                    rule('smoke','completed',f.team,'当前路线不再受烟雾阻挡，恢复推进',f.id,next);
                }
                if(plans?.[f.team].smoke==='cross'&&(smokes.get(next)??0)>now)rule('smoke','crossing',f.team,'按指令穿过烟区，继续当前路线',f.id,next,events.filter(e=>e.kind==='smoke'&&e.zone===next).slice(-1).map(e=>e.id));
                const to = route.shift()!;
                const edge = getZone(map, f.zone).paths.find(p => p.to === to);
                if (!edge)
                    throw new Error('非法瞬移');
                const blocked = (fires.get(to)?.until ?? 0) > now ? 3 : 0;
                const move = emit('move', { actor: f.id, team: f.team, zone: f.zone, detail: { to, travelSeconds: edge.seconds + blocked } });
                transit.set(f.id, { from: f.zone, to, at: now + edge.seconds + blocked, start: now, cause: move.id });
                continue;
            }
            const pickup = drops.find(d => !d.taken && d.zone === f.zone && WEAPONS[d.weapon].price > WEAPONS[f.equipment.weapon].price);
            if (pickup) {
                f.equipment.weapon = pickup.weapon;
                pickup.taken = true;
                emit('pickup', { actor: f.id, team: f.team, zone: f.zone, weapon: pickup.weapon, causes: [pickup.cause], detail: { fromPlayer: pickup.owner } });
            }
            if (f.side === 'T' && bombZone === f.zone && plantAt === null && !ts.some(t => t.hasBomb)) {
                f.hasBomb = true;
                bombZone = null;
                emit('pickup', { actor: f.id, team: f.team, zone: f.zone, detail: { item: 'bomb' } });
            }
        }
        // A defender's first information is actual visible contact or an audible utility event.
        const closeHold = (f: Fighter) => !transit.has(f.id) && now - (arrivedAt.get(f.id) ?? now) >= 4 &&
            (decisions[f.team].stances?.[f.id] === 'close' || (!decisions[f.team].stances?.[f.id] && f.side === 'CT' && tactics[ctTeam].id === 'passive' && WEAPONS[f.equipment.weapon].category !== 'awp'));
        const visible = (a: Fighter, b: Fighter) => (!modern || (a.blindedUntil <= now && (((smokes.get(b.zone) ?? 0) <= now && (smokes.get(a.zone) ?? 0) <= now) || a.zone === b.zone))) && (a.zone === b.zone || (!closeHold(a) && !closeHold(b))) && sightRange(map, a.zone, b.zone) !== null;
        const seenAttackers = ts.filter(t => t.alive && !transit.has(t.id) && cts.some(c => c.alive && !transit.has(c.id) && visible(c, t)));
        const contact = seenAttackers.find(t => getZone(map, t.zone).site === 'A' || getZone(map, t.zone).site === 'B') ?? seenAttackers[0];
        if (contact && now - lastReport >= 5 && (observedAt === null || observedZone !== contact.zone)) {
            observedAt = now;
            observedZone = contact.zone;
            rotated = false;
            lastReport = now;
            emit('sight', { actor: contact.id, team: ctTeam, zone: contact.zone, detail: { observedBy: 'CT', visibleAttackers: seenAttackers.length } });
        }
        for (const f of ms.fighters.filter(f => f.alive && !transit.has(f.id))) {
            if (winner !== null)
                break;
            if (!f.alive)
                continue; // Earlier HE in this tick may have killed a queued thrower.
            const foes = ms.fighters.filter(x => x.alive && x.team !== f.team && !transit.has(x.id) && visible(f, x));
            const familiarity = series.teams[f.team].dynamics.tacticFamiliarity[ms.map + ':' + decisions[f.team].tactic] ?? 60;
            const reserve=plans && shouldReserveUtility(plans[f.team].utility,f.side,executing,plantAt!==null,foes.some(e=>e.zone===f.zone));
            if(reserve && foes.length && f.equipment.utility.length) rule('utility','waiting',f.team,'保持远处接触，暂时保留道具',f.id,f.zone);
            if(!reserve && ruleStates.get('utility:'+f.id)?.status==='waiting')rule('utility','released',f.team,'进入执行阶段或近点交火，允许使用道具',f.id,f.zone);
            if (!reserve && foes.length && f.equipment.utility.length && !saving.has(f.id) && rng.next() < .1 + familiarity / 800) {
                const item = f.equipment.utility.shift()!, enemy = rng.pick(foes), zone = enemy.zone;
                const utility = emit(item as EventKind, { actor: f.id, team: f.team, zone, detail: { item, familiarity } });
                if (f.side === 'T' && observedAt === null && (!modern || cts.some(c => c.alive && !transit.has(c.id) && (c.zone === zone || sightRange(map, c.zone, zone) !== null)))) {
                    observedAt = now;
                    observedZone = zone;
                }
                if (item === 'smoke') {
                    smokes.set(zone, now + 18);
                    const fire = fires.get(zone);
                    if (fire && fire.until > now) {
                        fires.delete(zone);
                        emit('extinguish', { actor: f.id, team: f.team, zone, causes: [utility.id, fire.cause], detail: { item: 'smoke' } });
                    }
                }
                if (item === 'fire' && (smokes.get(zone) ?? 0) <= now)
                    fires.set(zone, { until: now + 7, actor: f, cause: utility.id });
                if (item === 'flash')
                    for (const e of foes)
                        if (rng.next() < player(f).attributes.utility / 110) {
                            e.blindedUntil = now + 2 + player(f).attributes.utility / 40;
                            emit('blind', { actor: f.id, target: e.id, zone: e.zone, causes: [utility.id], detail: { until: e.blindedUntil } });
                        }
                if (item === 'he')
                    damage(f, enemy, 10 + player(f).attributes.utility * .3, 'HE', utility.id);
            }
        }
        for (const [zone, fire] of fires)
            if (fire.until > now) {
                for (const victim of ms.fighters.filter(f => f.alive && f.team !== fire.actor.team && !transit.has(f.id) && f.zone === zone))
                    damage(fire.actor, victim, 8 + player(fire.actor).attributes.utility / 20, 'fire', fire.cause);
            }
        if (winner !== null)
            break;
        if (!adapted && !executing && decisions[tTeam].adaptive && now >= tactics[tTeam].pace + 7 && now < 70) {
            const seenDefenders = cts.filter(c => c.alive && !transit.has(c.id) && ts.some(t => t.alive && !transit.has(t.id) && visible(t, c)));
            const ownIGL = ts.find(f => f.alive && player(f).role === 'IGL') ?? (modern && ts.some(f => player(f).role === 'IGL') ? undefined : ts.filter(f => f.alive).sort((a, b) => player(b).attributes.gameSense - player(a).attributes.gameSense)[0]);
            const overloaded = seenDefenders.filter(c => getZone(map, c.zone).site === target).length >= 3;
            if (ownIGL && overloaded && rng.next() < player(ownIGL).attributes.gameSense / 125) {
                const old = target;
                target = target === 'A' ? 'B' : 'A';
                attackSite = target;
                adapted = true;
                const info = emit('info', { actor: ownIGL.id, team: tTeam, zone: siteZone(), detail: { fromSite: old, toSite: target, observedDefenders: seenDefenders.length, reason: 'IGL 依据已看见的多人防守改变进攻方向' } });
                for (const f of ts.filter(f => f.alive && !transit.has(f.id)))
                    order(f, siteZone());
                emit('tactic', { team: tTeam, causes: [info.id], detail: { id: decisions[tTeam].tactic, target, adapted: true } });
            }
        }
        let canExecute=true;
        if(plans?.[tTeam].execution==='regroup'&&!executing&&now>=tactics[tTeam].pace+12){
            const aliveTs=ts.filter(f=>f.alive);
            const staged=aliveTs.filter(f=>!transit.has(f.id)&&!destinations.get(f.id)?.length&&f.zone!==map.tSpawn).length;
            const travel=Math.max(...aliveTs.map(f=>shortestPath(map,f.zone,siteZone()).seconds))+ECONOMY.plantSeconds;
            canExecute=regroupReady(aliveTs.length,staged,now,tactics[tTeam].pace+12,ECONOMY.roundSeconds-now,travel);
            rule('regroup',canExecute?'executing':'waiting',tTeam,canExecute?`结束集结等待，${staged} 名队员已就位`:`等待分路队友就位，当前 ${staged}/${aliveTs.length}`);
        }
        if (!executing && now >= tactics[tTeam].pace + 12 && canExecute) {
            executing = true;
            if(plans)rule('execution','executing',tTeam,'进攻队伍开始向目标包点推进',undefined,siteZone());
            for (const f of ts.filter(f => f.alive && !saving.has(f.id))) {
                if (transit.has(f.id))
                    continue;
                order(f, siteZone());
            }
        }
        // Finish paths from staging points after they arrive (including fakes and split routes).
        if (executing)
            for (const f of ts.filter(f => f.alive && !transit.has(f.id) && !saving.has(f.id)))
                if (!destinations.get(f.id)?.length && f.zone !== siteZone())
                    order(f, siteZone());
        const preparation = series.teams[ctTeam].dynamics.mapPreparation[ms.map];
        if(plans?.[ctTeam].rotation==='hold' && observedAt!==null && plantAt===null)rule('rotation','held',ctTeam,'接到接触报告，按指令保持当前防区',undefined,observedZone??undefined,events.filter(e=>e.kind==='sight').slice(-1).map(e=>e.id));
        if (plans?.[ctTeam].rotation!=='hold' && decisions[ctTeam].adaptive && observedAt !== null && (!modern || now - observedAt <= 12) && !rotated && now >= observedAt + Math.max(1, 16 - series.teams[ctTeam].dynamics.communication / 10 - preparation / 20) + (tactics[ctTeam].id === 'fastRotate' ? -2 : 0)) {
            rotated = true;
            const seen = getZone(map, observedZone!).site;
            const dest = seen === 'A' ? map.siteA : seen === 'B' ? map.siteB : map.mid;
            emit('info', { team: ctTeam, zone: observedZone!, detail: { delay: now - observedAt, observedAt, informationAge: now - observedAt } });
            // No secret T target is used here: only the first observed zone.
            if (seen === 'A' || seen === 'B') {
                const opposite = seen === 'A' ? map.siteB : map.siteA;
                const candidates = cts.filter(f => f.alive && !transit.has(f.id) && f.zone !== dest && !destinations.get(f.id)?.includes(dest));
                const anchor = candidates.find(f => modern ? getZone(map, f.zone).site === getZone(map, opposite).site : f.zone === opposite);
                const responders = candidates.filter(f => f !== anchor || (!modern && tactics[ctTeam].id === 'fastRotate')).sort((a, b) => shortestPath(map, a.zone, dest).seconds - shortestPath(map, b.zone, dest).seconds);
                for (const f of responders.slice(0, tactics[ctTeam].id === 'fastRotate' ? 4 : 2))
                    order(f, dest);
            }
        }
        if (plantAt !== null)
            for (const f of cts.filter(f => f.alive && !transit.has(f.id) && !saving.has(f.id))) {
                const required = shortestPath(map, f.zone, bombZone!).seconds + (f.equipment.kit ? 5 : 10), remaining = plantAt + 40 - now;
                const hopeless = cts.filter(x => x.alive).length <= 2 && ts.filter(x => x.alive).length >= 4;
                const unfavorable=hopeless && decisions[f.team].risk !== 'aggressive' && player(f).attributes.gameSense >= 65 && WEAPONS[f.equipment.weapon].price >= 1050;
                const safeSave = plans ? shouldSave(plans[ctTeam].postPlant,remaining,required,unfavorable) : remaining <= required || unfavorable;
                if(plans && unfavorable && !safeSave) rule('retake','executing',ctTeam,'人数不利，按指令继续回防',f.id,bombZone!,events.filter(e=>e.kind==='plant').map(e=>e.id));
                if (safeSave && f.zone !== bombZone) {
                    saving.add(f.id);
                    order(f, map.ctSpawn);
                    emit('save', { actor: f.id, team: f.team, zone: f.zone, weapon: f.equipment.weapon, detail: { decision: true, reason: remaining <= required ? '无法及时到达并拆包' : '人数劣势，保留长枪', remaining, required } });
                }
                else if (f.zone !== bombZone && !destinations.get(f.id)?.length)
                    order(f, bombZone!);
            }
        const shooters = ms.fighters.filter(f => f.alive && !transit.has(f.id)).map(f => ({ f, priority: rng.next() })).sort((a, b) => a.priority - b.priority).map(x => x.f);
        for (const f of shooters) {
            if (winner !== null)
                break;
            if (!f.alive || (planter === f.id && plantStart !== null && plantAt === null) || (defuser === f.id && defuseStart !== null) || now - (lastShot.get(f.id) ?? -10) < (WEAPONS[f.equipment.weapon].category === 'awp' ? 3 : 2))
                continue;
            const response = tradeResponse.get(f.id);
            const foes = ms.fighters.filter(e => e.alive && e.team !== f.team && !transit.has(e.id) && visible(f, e) && !(response?.target === e.id && now < response.readyAt));
            if (!foes.length)
                continue;
            // Narrow entrances expose a lead pair, with the rest providing trades rather than five simultaneous guns.
            if (f.side === 'T' && plantAt === null) {
                const entry = entrance.get(f.id);
                const peers = ts.filter(t => t.alive && !transit.has(t.id) && t.zone === f.zone && entrance.get(t.id) === entry).sort((a, b) => player(b).attributes.entry - player(a).attributes.entry);
                if (peers.indexOf(f) >= 2 && foes.some(e => e.zone === f.zone || getZone(map, e.zone).site === getZone(map, f.zone).site))
                    continue;
            }
            const enemy = (modern && response && now >= response.readyAt ? foes.find(e => e.id === response.target) : undefined) ?? foes.sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id))[0];
            lastShot.set(f.id, now);
            const gun = WEAPONS[f.equipment.weapon], p = player(f), team = series.teams[f.team];
            const zone = getZone(map, enemy.zone), range = closeHold(f) || closeHold(enemy) ? 'close' : sightRange(map, f.zone, enemy.zone)!, ri = range === 'close' ? 0 : range === 'mid' ? 1 : 2;
            const allies = ms.fighters.filter(x => x.alive && x.team === f.team && !transit.has(x.id) && visible(x, enemy)).length;
            const lone = ms.fighters.filter(x => x.team === f.team && x.alive).length === 1;
            const positioning = (p.attributes.positioning - 70) / 500, aim = (p.attributes.aim - 70) / 160, role = gun.category === 'awp' ? (p.attributes.awp - 70) / 200 : 0;
            const tactical = (f.side === 'CT' ? (p.attributes.defense - 70) / 450 : events.some(e => e.kind === 'kill') ? 0 : (p.attributes.entry - 70) / 350);
            const synergy = Math.min(.08, (allies - 1) * p.attributes.teamwork / 2000);
            const mapSkill = (p.mapProficiency[ms.map] - 70) / 600;
            const blindness = f.blindedUntil > now ? .22 : 1, smoke = (smokes.get(enemy.zone) ?? 0) > now ? .48 : 1;
            const belief = (team.dynamics.belief - 70) / 1500;
            const enemyAttacking = enemy.side === 'T' && plantAt === null;
            const established = now - (arrivedAt.get(enemy.id) ?? 0) >= 4 && !enemyAttacking;
            const cover = zone.cover * (established ? .35 : .04);
            const movingPenalty = now - (arrivedAt.get(f.id) ?? 0) < 2 ? .12 : 0;
            const chance = clamp((gun.accuracy[ri] + aim + role + positioning + tactical + synergy + mapSkill + (lone ? (p.attributes.clutch - 70) / 350 : 0) + (form.get(f.id) ?? 0) + belief - cover - movingPenalty) * blindness * smoke, .035, .94);
            const duel = emit('duel', { actor: f.id, target: enemy.id, team: f.team, zone: enemy.zone, weapon: gun.id, detail: { range, chance, aim, role, positioning, tactical, synergy, mapSkill, blindness, smoke, allies, cover, movingPenalty } });
            if (rng.next() < chance) {
                const headshot = rng.next() < .1 + p.attributes.aim / 650;
                duel.detail.headshot = headshot;
                const armored = enemy.equipment.armor > 0 && (!headshot || enemy.equipment.helmet);
                const armorFactor = armored ? gun.penetration : 1;
                damage(f, enemy, gun.damage * (headshot ? 3 : 1) * armorFactor, gun.id, duel.id);
                if (armored)
                    enemy.equipment.armor = Math.max(0, enemy.equipment.armor - 5);
            }
        }
        if (winner !== null)
            break;
        const ta = ts.filter(f => f.alive), ca = cts.filter(f => f.alive);
        if (plantAt === null) {
            if (!ca.length) {
                winner = tTeam;
                reason = 'elimination';
                break;
            }
            if (!ta.length) {
                winner = ctTeam;
                reason = 'elimination';
                break;
            }
            const carrier = ta.find(f => f.hasBomb && !transit.has(f.id) && f.zone === siteZone());
            if (carrier && !ca.some(f => !transit.has(f.id) && f.zone === carrier.zone)) {
                if (planter !== carrier.id) {
                    plantStart = now;
                    planter = carrier.id;
                }
                if (plantStart !== null && now - plantStart >= ECONOMY.plantSeconds && now <= ECONOMY.roundSeconds) {
                    plantAt = now;
                    bombZone = carrier.zone;
                    carrier.hasBomb = false;
                    cashBook(carrier.id).objectiveRewards += ECONOMY.plantPersonal;
                    emit('plant', { actor: carrier.id, team: tTeam, zone: bombZone, detail: { site: attackSite, explodeAt: now + ECONOMY.bombSeconds, startAt: plantStart, duration: now - plantStart } });
                }
            }
            else {
                plantStart = null;
                planter = null;
            }
            if (plantAt === null && now >= ECONOMY.roundSeconds) {
                winner = ctTeam;
                reason = 'time';
                emit('timerEnd', { team: ctTeam });
                break;
            }
        }
        else {
            const defender = ca.find(f => !transit.has(f.id) && f.zone === bombZone);
            const clearRequired=plans?.[ctTeam].postPlant==='clear'&&ta.length>0;
            if(defender && clearRequired)rule('clear','waiting',ctTeam,'已到达包点，按指令先清除剩余对手再拆包',defender.id,bombZone!);
            if(defender && !clearRequired && ruleStates.get('clear:'+defender.id)?.status==='waiting')rule('clear','completed',ctTeam,'对手已经清空，可以开始拆包',defender.id,bombZone!,events.filter(e=>e.kind==='kill').slice(-1).map(e=>e.id));
            if (defender && !clearRequired && !ta.some(f => !transit.has(f.id) && visible(defender, f))) {
                if (defuser !== defender.id) {
                    defuser = defender.id;
                    defuseStart = now;
                }
                const duration = defender.equipment.kit ? 5 : 10;
                if (defuseStart !== null && now - defuseStart >= duration && now < plantAt + 40) {
                    winner = ctTeam;
                    reason = 'defuse';
                    cashBook(defender.id).objectiveRewards += ECONOMY.defusePersonal;
                    emit('defuse', { actor: defender.id, team: ctTeam, zone: bombZone!, detail: { startAt: defuseStart, duration, kit: defender.equipment.kit } });
                    break;
                }
            }
            else {
                defuser = null;
                defuseStart = null;
            }
            if (now >= plantAt + 40) {
                winner = tTeam;
                reason = 'explode';
                emit('explode', { team: tTeam, zone: bombZone! });
                break;
            }
        }
    }
    if (winner === null)
        throw new Error(`回合无合法终局 seed=${series.seed}`);
    if(plans){
        for(const state of ruleStates.values()){
            if(state.status!=='waiting')continue;
            const f=ms.fighters.find(f=>f.id===state.actor);
            rule(state.id,'interrupted',state.team,f&&!f.alive?'选手阵亡，等待指令终止':'回合结束，未完成的等待指令终止',f?.id,f?.zone,events.filter(e=>e.kind==='kill'&&e.target===state.actor).slice(-1).map(e=>e.id));
        }
    }
    for (const f of ms.fighters.filter(f => f.alive))
        emit('save', { actor: f.id, team: f.team, zone: f.zone, weapon: f.equipment.weapon, detail: { winner: f.team === winner } });
    emit('roundEnd', { team: winner, alive: alive(), detail: { reason } });
    for (const index of [0, 1] as const) {
        const old = ms.lossTiers[index];
        ms.lossTiers[index] = winner === index ? Math.max(0, old - 1) : Math.min(4, old + 1);
        const d = series.teams[index].dynamics;
        d.belief = clamp(70 + (d.belief - 70) * .92 + (winner === index ? 1.4 : -1.4), 48, 86);
        d.chemistry = clamp(d.chemistry + .015);
        const key = ms.map + ':' + decisions[index].tactic;
        d.tacticFamiliarity[key] = clamp((d.tacticFamiliarity[key] ?? 60) + .08);
    }
    const ctKills = events.filter(e => e.kind === 'kill' && e.team === ctTeam).length;
    for (const f of ms.fighters) {
        const book = cashBook(f.id);
        let reward = winner === f.team ? (reason === 'defuse' || reason === 'explode' ? ECONOMY.bombWin : ECONOMY.win) : ECONOMY.loss[book.lossTierBefore];
        if (reason === 'time' && f.side === 'T' && f.alive)
            reward = 0;
        if (f.side === 'T' && reason === 'defuse')
            reward += ECONOMY.plantedLoss;
        if (f.side === 'CT')
            reward += ctKills * ECONOMY.ctKillTeam;
        book.teamRewards = reward;
        f.cash = Math.min(ECONOMY.maxCash, f.cash + book.killRewards + book.objectiveRewards + reward);
        book.cashAtEnd = f.cash;
        book.lossTierAfter = ms.lossTiers[f.team];
        book.carriedEquipment = f.alive ? structuredClone(f.equipment) : null;
        if (!f.alive)
            f.equipment = emptyEquipment(f.side);
    }
    ms.score[winner]++;
    const result: RoundResult = { number: n + 1, map: ms.map, sides, decisions: structuredClone(decisions), winner, reason, events, economy, initial, final: structuredClone(ms.fighters), commentary: [], score: [...ms.score] };
    if(plans) result.plans=structuredClone(plans);
    result.commentary = renderCommentary(result, series);
    ms.rounds.push(result);
    ms.winner = mapWinner(ms.score);
    series.rngState = rng.state;
    completeMap(series);
    return result;
}
export function simulateSeries(series: Series) { let count = 0; while (series.status === 'playing') {
    resolveRound(series);
    if (++count > 2000)
        throw new Error('超出安全回合上限');
} return series; }
