import {getMap,getZone} from './maps';
import type { Decision, Side, Team, MapState, TeamIndex } from './types';
import { Random } from './random';
export interface Tactic {
    id: string;
    name: string;
    side: Side;
    site: 'A' | 'B' | 'adaptive';
    pace: number;
    split: boolean;
    fake: boolean;
    aggression: number;
    description: string;
}
const t = (id: string, name: string, side: Side, site: Tactic['site'], pace: number, split = false, fake = false, aggression = 0, description = ''): Tactic => ({ id, name, side, site, pace, split, fake, aggression, description });
export const TACTICS: Tactic[] = [
    t('default', '默认控图', 'T', 'adaptive', 35, true, false, 0, '分散探路，依已发现的防区再集合'), t('fastA', '快速 A 爆弹', 'T', 'A', 8, false, false, 1, '最快集合 A 主路，容易碰到重防'), t('fastB', '快速 B 爆弹', 'T', 'B', 8, false, false, 1, '最快集合 B 主路'), t('slowA', '慢速控 A', 'T', 'A', 55), t('slowB', '慢速控 B', 'T', 'B', 55), t('splitA', '双路夹 A', 'T', 'A', 30, true), t('splitB', '双路夹 B', 'T', 'B', 30, true), t('midControl', '争夺关键通道', 'T', 'adaptive', 25, true, false, 1), t('fakeA', '佯攻 A 转 B', 'T', 'B', 43, true, true), t('fakeB', '佯攻 B 转 A', 'T', 'A', 43, true, true), t('contact', '静步接触', 'T', 'adaptive', 35, false, false, -1), t('lurk', '分散抓单', 'T', 'adaptive', 48, true, false, -1),
    t('standard', '标准 2-1-2', 'CT', 'adaptive', 0), t('stackA', '重兵防 A', 'CT', 'A', 0), t('stackB', '重兵防 B', 'CT', 'B', 0), t('aggressionA', 'A 区前顶', 'CT', 'A', 0, false, false, 2), t('aggressionB', 'B 区前顶', 'CT', 'B', 0, false, false, 2), t('midContest', '关键通道前压', 'CT', 'adaptive', 0, true, false, 2), t('passive', '近点埋伏', 'CT', 'adaptive', 0, false, false, -1), t('earlyInfo', '前探后收', 'CT', 'adaptive', 0, true, false, 1), t('fastRotate', '情报快速轮转', 'CT', 'adaptive', 0, true), t('retake', '放点回防', 'CT', 'adaptive', 0, false, false, -2)
];
export const getTactic = (id: string) => { const v = TACTICS.find(t => t.id === id); if (!v)
    throw new Error('未知战术'); return v; };
export const defaultDecision = (side: Side): Decision => ({ tactic: side === 'T' ? 'default' : 'standard', buy: 'auto', risk: 'balanced', adaptive: true });
export function chooseAI(team: Team, index: TeamIndex, map: MapState, side: Side, rng: Random, observedOnly = false): Decision {
    const pool = TACTICS.filter(t => t.side === side);
    let tactic = rng.pick(pool);
    const recent = map.rounds.slice(-5).map(r => {
        if(!observedOnly)return getTactic(r.decisions[index === 0 ? 1 : 0].tactic).site;
        // Public plant or this team's actual sight report; never inspect a hidden preset ID.
        const known=r.events.filter(e=>e.zone&&(e.kind==='plant'||(e.kind==='sight'&&e.team===index))).at(-1);
        const site=known?.zone?getZone(getMap(map.map),known.zone).site:undefined;
        return site==='A'||site==='B'?site:'adaptive';
    });
    if (side === 'CT' && recent.length >= 3 && rng.next() < team.dynamics.adaptability / 140) {
        const a = recent.filter(s => s === 'A').length, b = recent.filter(s => s === 'B').length;
        if (a >= 3 || b >= 3)
            tactic = getTactic(a > b ? 'stackA' : 'stackB');
    }
    return { tactic: tactic.id, buy: 'auto', risk: 'balanced', adaptive: true };
}
