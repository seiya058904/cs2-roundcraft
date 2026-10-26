import quotes from '../data/quotes.json';
import type { CommentaryBeat } from './commentaryBeats';
import type { RoundResult } from './types';
import { WEAPONS } from './economy';
import { getMap, getZone } from './maps';
export const realQuoteCatalog = new Map(quotes.map(q => [q.id, q]));
/** Original wording is immutable. Each enabled line has a scene gate, not a keyword match. */
export function quoteCandidates(beat: CommentaryBeat, round: RoundResult): string[] {
    const t = round.sides[0] === 'T' ? 0 : 1;
    const refs = round.events.filter(e => beat.eventIds.includes(e.id));
    switch (beat.category) {
        case 'setup': return round.number === 1 || round.number === 13 ? ['RQ-1-8'] : round.decisions[t].tactic === 'default' ? ['RQ-1-12'] : round.decisions[t].tactic === 'midControl' ? ['RQ-1-14'] : [];
        case 'trade': return ['RQ-2-24', 'RQ-9-32', ...(refs.filter(e=>e.kind==='kill').length>=2&&Math.abs(refs.filter(e=>e.kind==='kill')[0].at-refs.filter(e=>e.kind==='kill')[1].at)<=2?['RQ-2-14']:[]), ...(refs.some(e => e.kind === 'trade' && e.team === t) ? ['RQ-2-10'] : [])];
        case 'clutch-start': {
            const ids = ['RQ-3-9', 'RQ-3-12'];
            const f = round.initial.find(f => f.id === beat.facts.clutchId);
            if (f?.side === 'CT' && !f.equipment.kit) {
                const thrown = round.events.filter(e => e.actor === f.id && e.kind === 'smoke' && e.at <= beat.at).length;
                if (!f.equipment.utility.includes('smoke') || thrown)
                    ids.push('RQ-3-10');
                if (beat.facts.clutchSize === 4)
                    ids.push('RQ-3-5');
            }
            return ids;
        }
        case 'clutch-win': return ['RQ-3-8', 'RQ-10-9', 'RQ-7-23', ...(beat.facts.clutchSize === 2 ? ['RQ-9-35'] : [])];
        case 'headshot': return ['RQ-2-25', ...(refs.some(e => e.kind === 'damage' && e.hpBefore === 100 && e.damage === 100) ? ['RQ-4-11'] : [])];
        case 'four-v-three': return ['RQ-2-27'];
        case 'five-v-three': return ['RQ-2-35'];
        case 'disadvantage': return ['RQ-10-22'];
        case 'multikill': {
            const kills = refs.filter(e => e.kind === 'kill');
            const ids = ['RQ-4-14', 'RQ-10-1', 'RQ-10-2', 'RQ-10-10', 'RQ-10-11', 'RQ-10-12', 'RQ-10-25'];
            if (kills.every(e => e.weapon !== 'HE' && e.weapon !== 'fire'))
                ids.push('RQ-4-32');
            if (kills.every(e => WEAPONS[e.weapon ?? '']?.category === 'rifle'))
                ids.push('RQ-10-14');
            if (kills.every(e => getZone(getMap(round.map), e.zone!).site === 'mid'))
                ids.push('RQ-4-13');
            if (kills.length === 4)
                ids.push('RQ-4-33');
            if (kills.length === 5)
                ids.push('RQ-4-38', 'RQ-10-32');
            return ids;
        }
        case 'pickup': return ['RQ-5-14'];
        case 'save-decision': {
            const save = refs.find(e => e.kind === 'save'), ids = save?.detail.reason === '无法及时到达并拆包' ? ['RQ-3-15'] : [];
            // Armor is never purchased mid-round; only a final surviving carrier is certain to retain it.
            if (save && round.final.some(f => f.id === save.actor && f.alive && f.equipment.armor > 0) && beat.at === round.events.at(-1)!.at)
                ids.push('RQ-5-34');
            return ids;
        }
        case 'flash-conversion': return refs.some(e=>e.kind==='blind') && refs.some(e=>e.kind==='kill'&&e.team===t) ? ['RQ-2-2'] : [];
        case 'extinguish': return ['RQ-6-29'];
        case 'fire-damage': return ['RQ-6-30'];
        case 'smoke': return ['RQ-6-20'];
        case 'plant': return ['RQ-8-16'];
        case 'match-point': return ['RQ-7-36', 'RQ-7-34', ...(round.score.includes(10) ? ['RQ-7-1'] : [])];
        case 'overtime-threat': return ['RQ-7-2'];
        case 'eco-win': return ['RQ-5-11'];
        case 'overtime': return ['RQ-7-6'];
        case 'close': return round.reason === 'explode' ? ['RQ-8-29', ...(round.events.some(e => e.kind === 'kill' && e.team !== t && e.at > (round.events.find(e => e.kind === 'plant')?.at ?? Infinity)) ? ['RQ-8-26'] : [])] : [];
        default: return [];
    }
}
