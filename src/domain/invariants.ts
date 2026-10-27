import type { RoundResult } from './types';
import { getMap, getZone, sightRange } from './maps';
import { ECONOMY, WEAPONS } from './economy';
export function validateRound(r: RoundResult): string[] {
    const issues: string[] = [];
    const check = (v: boolean, message: string) => { if (!v)
        issues.push(message); };
    const map = getMap(r.map);
    check(r.initial.length === 10 && new Set(r.initial.map(f => f.id)).size === 10, '首发不是唯一十人');
    check(r.initial.every(f => f.alive && f.hp === 100), '初始生命状态错误');
    const fighterIds = new Set(r.initial.map(f => f.id));
    const zones = new Map(r.initial.map(f => [f.id, f.zone]));
    const equipment = new Map(r.initial.map(f => [f.id, structuredClone(f.equipment)]));
    const moving = new Map<string, {
        to: string;
        arrives: number;
        cause: string;
    }>();
    const drops = new Map<string, {
        weapon: string;
        zone: string;
    }>();
    const kinds = new Set(['buy', 'position', 'move', 'sight', 'info', 'misread', 'flash', 'smoke', 'fire', 'he', 'blind', 'duel', 'damage', 'kill', 'trade', 'plant', 'defuseStart', 'defuseStop', 'defuse', 'save', 'explode', 'timerEnd', 'roundEnd', 'tactic', 'coachTimeout', 'pickup', 'donation', 'extinguish']);
    check(r.events.filter(e => e.kind === 'roundEnd').length === 1 && r.events.at(-1)?.kind === 'roundEnd', '回合终止事件必须唯一且在最后');
    const hp = new Map(r.initial.map(f => [f.id, 100]));
    const killed = new Set<string>();
    const ids = new Set<string>();
    let activeDefuseStart:RoundResult['events'][number]|undefined;
    let time = -1;
    for (const e of r.events) {
        check(e.at >= time, '事件时间倒退');
        time = e.at;
        check(!ids.has(e.id), '重复事件 ID');
        for (const id of e.causes)
            check(ids.has(id), '无效因果引用');
        ids.add(e.id);
        check(kinds.has(e.kind) && Number.isFinite(e.at) && e.at >= 0 && e.at <= 160, '事件类型或时间错误');
        if (e.actor)
            check(fighterIds.has(e.actor), '未知行为主体');
        if (e.target)
            check(fighterIds.has(e.target), '未知行为目标');
        if (e.zone)
            check(map.zones.some(z => z.id === e.zone), '非法区域');
        if (['damage', 'kill', 'plant', 'defuseStart', 'defuse', 'duel', 'move', 'pickup', 'flash', 'smoke', 'fire', 'he'].includes(e.kind) && e.actor && e.weapon !== 'fire')
            check(!killed.has(e.actor), '死者行动');
        if(e.kind==='defuseStart'){
            const plant=r.events.find(x=>e.causes.includes(x.id)&&x.kind==='plant');
            const fighter=r.initial.find(f=>f.id===e.actor),kit=equipment.get(e.actor!)?.kit;
            check(Boolean(plant)&&plant!.zone===e.zone&&e.at<Number(plant!.detail.explodeAt),'拆包开始缺少有效炸弹');
            check(Boolean(fighter)&&fighter!.side==='CT'&&fighter!.team===e.team&&zones.get(e.actor!)===e.zone&&!moving.has(e.actor!),'拆包者位置或阵营错误');
            check(e.detail.kit===kit&&e.detail.duration===(kit?5:10),'拆包开始工具或时间错误');
            check(!activeDefuseStart,'已有拆包未中断或完成');
            activeDefuseStart=e;
        }
        if(e.kind==='defuseStop'){
            const start=r.events.find(x=>e.causes.includes(x.id)&&x.kind==='defuseStart');
            check(Boolean(start)&&start!.actor===e.actor&&start!.team===e.team&&start!.zone===e.zone&&start!.at<=e.at,'拆包中断缺少对应开始事件');
            check(Boolean(activeDefuseStart)&&e.causes.includes(activeDefuseStart!.id),'拆包中断不是当前进行的拆包');
            activeDefuseStart=undefined;
        }
        if(e.kind==='defuse'&&activeDefuseStart){check(e.causes.includes(activeDefuseStart.id)&&e.actor===activeDefuseStart.actor,'拆包完成与开始事件不一致');activeDefuseStart=undefined;}
        if (['flash', 'smoke', 'fire', 'he'].includes(e.kind) && e.actor) {
            const stock = equipment.get(e.actor)?.utility;
            const index = stock?.indexOf(e.kind) ?? -1;
            check(index >= 0, '使用了不存在的投掷物');
            if (index >= 0)
                stock!.splice(index, 1);
        }
        if (e.kind === 'position' && e.actor && e.zone) {
            if (e.at > 0) {
                const travel = moving.get(e.actor);
                check(Boolean(travel) && travel!.to === e.zone && travel!.arrives <= e.at && e.causes.includes(travel!.cause), '到位事件缺少合法行程');
            }
            zones.set(e.actor, e.zone);
            moving.delete(e.actor);
        }
        if (e.kind === 'duel') {
            check(equipment.get(e.actor!)?.weapon === e.weapon, '使用未持有的枪械');
            check(!moving.has(e.actor!) && !moving.has(e.target!), '移动途中非法交锋');
            const from = zones.get(e.actor!), to = zones.get(e.target!);
            if (from && to)
                check(sightRange(map, from, to) !== null, '隔断区域非法交锋');
        }
        if (e.kind === 'damage') {
            check(!killed.has(e.target!), '重复伤害死者');
            check(e.hpBefore === hp.get(e.target!), 'HP 前值不符');
            check(e.damage! > 0 && e.damage! <= e.hpBefore!, '伤害越界');
            check(e.hpAfter === e.hpBefore! - e.damage!, 'HP 不守恒');
            hp.set(e.target!, e.hpAfter!);
        }
        if (e.kind === 'damage' && e.weapon === 'fire')
            check(e.causes.some(id => r.events.find(x => x.id === id)?.kind === 'fire'), '火焰伤害缺少投掷来源');
        if (e.kind === 'kill') {
            check(!killed.has(e.target!), '重复死亡');
            check(hp.get(e.target!) === 0, '未到零血死亡');
            const cause = r.events.find(x => e.causes.includes(x.id) && x.kind === 'damage');
            check(Boolean(cause) && cause!.target === e.target && cause!.actor === e.actor, '击杀缺少对应伤害');
            killed.add(e.target!);
            moving.delete(e.target!);
            drops.set(e.id, { weapon: equipment.get(e.target!)?.weapon ?? '', zone: zones.get(e.target!) ?? '' });
            if (e.alive)
                for (const team of [0, 1])
                    check(e.alive[team] === r.initial.filter(f => f.team === team && !killed.has(f.id)).length, '存活人数错误');
        }
        if (e.kind === 'move') {
            const edge = getZone(map, e.zone!).paths.find(p => p.to === e.detail.to);
            check(Boolean(edge), '非法跨区域路线');
            if (edge)
                check(Number(e.detail.travelSeconds) >= edge.seconds, '移动时间过短');
            check(zones.get(e.actor!) === e.zone && !moving.has(e.actor!), '移动起点或行程冲突');
            moving.set(e.actor!, { to: String(e.detail.to), arrives: e.at + Number(e.detail.travelSeconds), cause: e.id });
        }
        if (e.kind === 'pickup' && e.weapon) {
            const cause = e.causes.find(id => drops.has(id)), drop = cause ? drops.get(cause) : undefined;
            check(Boolean(drop) && drop!.weapon === e.weapon && drop!.zone === zones.get(e.actor!), '拾取枪械缺少对应掉落');
            if (cause)
                drops.delete(cause);
            if (equipment.has(e.actor!))
                equipment.get(e.actor!)!.weapon = e.weapon;
        }
    }
    for (const f of r.final) {
        check(f.alive === !killed.has(f.id), '终局存活不符');
        check(f.hp === hp.get(f.id), '终局 HP 不符');
        check(f.cash === r.economy.find(b => b.playerId === f.id)?.cashAtEnd, '终局钱包与账本不符');
    }
    for (const b of r.economy) {
        check(b.cashBefore - b.spend === b.cashAfterBuy, '购买现金不守恒');
        check(b.spend >= 0 && b.cashAfterBuy >= 0, '负数资金');
        check(Math.min(ECONOMY.maxCash, b.cashAfterBuy + b.killRewards + b.objectiveRewards + b.teamRewards) === b.cashAtEnd, '奖励现金不守恒');
        const f = r.initial.find(f => f.id === b.playerId)!;
        const gun = WEAPONS[b.loadout.weapon];
        check(Boolean(gun), '未知枪械'); /* Opposite-side weapons may legally be carried after pickup. */
        check(b.cashAtEnd <= 16000, '超过现金上限');
        check((b.carriedEquipment !== null) === r.final.find(x => x.id === f.id)!.alive, '保枪状态错误');
    }
    const plant = r.events.find(e => e.kind === 'plant');
    const winnerSide = r.sides[r.winner];
    if (!plant) {
        const terminal = r.events.findIndex(e => e.kind === 'kill' && e.alive?.some(n => n === 0));
        if (terminal >= 0)
            check(!r.events.slice(terminal + 1).some(e => ['damage', 'kill', 'duel'].includes(e.kind)), '灭队终局后继续交火');
    }
    if (r.reason === 'elimination') {
        check(!plant, '下包后错误地判灭队胜利');
        check(r.final.filter(f => f.team !== r.winner).every(f => !f.alive), '未消灭全部对手');
    }
    if (r.reason === 'explode')
        check(Boolean(plant) && winnerSide === 'T' && r.events.some(e => e.kind === 'explode' && e.at >= plant!.at + 40), '非法爆炸终局');
    if (r.reason === 'defuse') {
        const d = r.events.find(e => e.kind === 'defuse');
        check(Boolean(plant && d) && winnerSide === 'CT' && d!.at < plant!.at + 40, '非法拆包终局');
        if (d && plant) {
            const kit = r.initial.find(f => f.id === d.actor)?.equipment.kit;
            check(d.detail.duration === (kit ? 5 : 10) && d.at - Number(d.detail.startAt) >= Number(d.detail.duration) && Number(d.detail.startAt) >= plant.at, '拆包耗时错误');
        }
    }
    if (r.reason === 'time')
        check(!plant && winnerSide === 'CT' && r.events.some(e => e.kind === 'timerEnd' && e.at >= 115), '非法超时终局');
    return issues;
}
