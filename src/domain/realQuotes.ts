import quotes from '../data/quotes.json';
import type { CommentaryBeat } from './commentaryBeats';
import type { RoundResult } from './types';
import { WEAPONS } from './economy';
import { getMap, getZone } from './maps';
import { mapWinner } from './series';
export const realQuoteCatalog = new Map(quotes.map(q => [q.id, q]));
/** Original wording is immutable. Each enabled line has a scene gate, not a keyword match. */
function firstBatchCandidates(beat: CommentaryBeat, round: RoundResult): string[] {
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

/** Material tags are hints. These reviewed conditions, rather than words in a quote, authorize playback. */
export function quoteCandidates(beat: CommentaryBeat, round: RoundResult): string[] {
    // Frozen pre-battle-plan engines retain their original narration and save fingerprints.
    if (!round.plans) return firstBatchCandidates(beat, round);
    const t = round.sides[0] === 'T' ? 0 : 1, ct = 1 - t;
    const refs = round.events.filter(e => beat.eventIds.includes(e.id));
    // Event order matters even when several events share a timestamp.
    const anchor = Math.max(-1, ...refs.map(e => round.events.indexOf(e)));
    const past = round.events.slice(0, anchor + 1);
    const kills = refs.filter(e => e.kind === 'kill');
    const kill = kills.at(-1);
    const weaponAt = (id: string | undefined) => past.filter(e => e.kind === 'pickup' && e.actor === id && e.weapon).at(-1)?.weapon ?? round.initial.find(f => f.id === id)?.equipment.weapon;
    const site = (zone: string | undefined) => zone ? getZone(getMap(round.map), zone).site : undefined;
    const loadouts = (team: number) => round.initial.filter(f => f.team === team).map(f => f.equipment);
    const duelFor = (event: typeof kill) => {
        const damage = event && past.find(e => event.causes.includes(e.id) && e.kind === 'damage');
        return damage && past.find(e => damage.causes.includes(e.id) && e.kind === 'duel');
    };
    const alive = round.initial.filter(f => !past.some(e => e.kind === 'kill' && e.target === f.id));
    const locationAt = (id: string) => past.filter(e => e.kind === 'position' && e.actor === id).at(-1)?.zone ?? round.initial.find(f => f.id === id)?.zone;
    const remainingUtility = (id: string) => {
        const utility = [...round.initial.find(f => f.id === id)!.equipment.utility];
        for (const e of past.filter(e => e.actor === id)) {
            const kind = ['smoke','flash','fire','he'].find(kind => kind === e.kind);
            if (kind) { const index = utility.indexOf(kind as typeof utility[number]); if (index >= 0) utility.splice(index, 1); }
        }
        return utility;
    };
    // This inventory-sensitive legacy line is rechecked against the ordered prefix below.
    // A failed 2v1 or an equipment upset alone does not prove poor coordination or split duels.
    const ids = firstBatchCandidates(beat, round).filter(id=>!['RQ-3-10','RQ-9-35','RQ-4-33'].includes(id) && (id!=='RQ-4-13'||getZone(getMap(round.map),getMap(round.map).mid).name==='中路'));
    const add = (...extra: string[]) => ids.push(...extra);
    switch (beat.category) {
        case 'awp-repeat-miss': {
            const shots=refs.filter(e=>e.kind==='duel'&&e.weapon==='AWP'&&e.detail.hit===false),last=shots.at(-1),first=shots[0];
            const phase=refs.find(e=>e.kind==='tactic'&&e.team===last?.team&&(!e.actor||e.actor===last?.actor)&&['execution','regroup','retake','smoke'].includes(String(e.detail.rule))&&['executing','crossing','completed'].includes(String(e.detail.status)));
            if(first&&last&&first.id!==last.id&&first.actor===last.actor&&first.at<last.at&&phase&&last.at-phase.at<=5&&past.indexOf(first)<past.indexOf(phase)&&past.indexOf(phase)<past.indexOf(last)&&!past.slice(past.indexOf(phase)+1,past.indexOf(last)).some(e=>e.kind==='plant'))add('RD-12-3');
            break;
        }
        case 'defuse-killed': {
            const start=refs.find(e=>e.kind==='defuseStart'),plant=refs.find(e=>e.kind==='plant');
            if(start&&plant&&kill?.team===t&&kill.target===start.actor&&start.team===ct&&start.causes.includes(plant.id)&&past.indexOf(start)<past.indexOf(kill)&&!past.some(e=>e.kind==='defuseStop'&&e.causes.includes(start.id))&&Number(plant.detail.explodeAt)-kill.at>0&&Number(plant.detail.explodeAt)-kill.at<=1)add('RD-8-4');
            break;
        }
        case 'defuse-cover-kill': {
            const start=refs.find(e=>e.kind==='defuseStart');
            if(start&&start.team===ct&&kill?.team===t&&kill.target!==start.actor&&round.initial.find(f=>f.id===kill.target)?.team===ct&&past.indexOf(start)<past.indexOf(kill)&&!past.some(e=>e.kind==='defuseStop'&&e.causes.includes(start.id))&&!past.some(e=>e.kind==='kill'&&e.target===start.actor))add('RD-8-9');
            break;
        }
        case 'defuse-start': {
            const start=refs.find(e=>e.kind==='defuseStart'&&e.team===ct);
            if(start&&past.some(e=>e.kind==='plant'&&start.causes.includes(e.id)))add('RF-8-5');
            break;
        }
        case 'awp-first-miss': {
            const shot=refs.find(e=>e.kind==='duel'&&e.weapon==='AWP'&&e.detail.hit===false);
            if(shot&&!past.slice(0,past.indexOf(shot)).some(e=>e.kind==='duel'&&e.actor===shot.actor&&e.weapon==='AWP'))add('RD-12-15','RW-12-5');
            break;
        }
        case 'setup':
            // The supplied half-time tags describe R13's opening, not the end of R12.
            if (round.number === 13) add('RB-11-24', 'RB-11-40');
            if (round.number === 1 || round.number === 13) add('RF-1-6', 'RW-1-1');
            if (round.number === 13) add('RD-1-6');
            if (round.number!==1&&round.number!==13&&round.decisions[t].tactic === 'default') add('RF-1-3');
            if(round.number!==1&&round.number!==13&&round.decisions[ct].tactic==='standard'&&!round.decisions[ct].positions)add('RF-1-5');
            {
                const start = round.score.map((value, team) => value - (team === round.winner ? 1 : 0));
                if (Math.min(...start) === 0 && Math.max(...start) >= 11) add('RQ-7-13');
            }
            break;
        case 'plan':
            if (round.decisions[t].tactic === 'fakeB') add('RQ-9-34');
            if (round.decisions[t].tactic === 'midControl' && getZone(getMap(round.map),getMap(round.map).mid).name==='中路') add('RB-10-16');
            if (round.decisions[t].tactic === 'default' && loadouts(t).every(e => WEAPONS[e.weapon].category === 'rifle')) add('RB-9-16');
            if (round.decisions[t].tactic==='default') add('RD-9-8');
            if(round.decisions[t].tactic==='midControl'&&getZone(getMap(round.map),getMap(round.map).mid).name==='中路')add('RD-9-6','RD-9-18');
            if(round.decisions[t].tactic==='splitB'&&round.plans[t].execution==='regroup')add('RF-9-2');
            break;
        case 'timeout': {
            const timeout = refs.find(e => e.kind === 'coachTimeout');
            if (timeout) add('RB-11-2', 'RB-11-13', 'RB-11-27', 'RB-11-38');
            if (timeout?.detail.kind === 'economy') add('RB-11-4');
            if (timeout && round.number > 24) add('RB-11-21');
            if (timeout && beat.facts.暂停队 === 'FURIA') add('RB-11-19');
            if (timeout && beat.facts.暂停队 === 'Natus Vincere') add('RB-11-30');
            if (timeout && beat.facts.暂停队 === 'Vitality') add('RB-11-43');
            if (timeout) add('RW-11-1');
            if (timeout && round.number <= 3) add('RW-11-2');
            if (timeout && beat.facts.暂停队 === 'FaZe') add('RW-11-4');
            if (timeout && beat.facts.暂停队 === 'Vitality') add('RF-11-9');
            if(timeout&&beat.facts.remainingTimeouts===0)add('RD-11-6','RB-11-39');
            break;
        }
        case 'economy': {
            const weak = beat.facts.weakTeam;
            if (typeof weak === 'number') {
                const economy = round.plans[weak].economy, gear = loadouts(weak), strong = 1 - weak;
                const utility = gear.reduce((n,e) => n + e.utility.length,0);
                const primary = gear.filter(e => WEAPONS[e.weapon].category !== 'pistol');
                if (economy === 'eco' && gear.every(e => e.armor === 0 && WEAPONS[e.weapon].category === 'pistol')) add('RB-5-24');
                if (economy === 'semi' && utility <= 3) add('RB-5-18');
                if (weak === t && loadouts(t).every(e => e.armor === 0)) add('RB-5-29');
                if (weak === t && economy === 'eco' && loadouts(t).every(e => e.armor === 0)) add('RQ-5-1');
                if (utility <= 2) add('RD-6-9');
                if (utility === 0 && gear.some(e => e.armor > 0)) add('RQ-6-1');
                if (economy === 'semi' && primary.length === 1) add('RB-5-15');
                if (economy === 'semi' && weak === ct && gear.every(e => !e.kit)) add('RQ-5-13');
                if (gear.filter(e => e.weapon === 'AWP' && e.armor === 0).length === 1) add('RB-5-28');
                if (round.economy.some(book => round.initial.find(f => f.id === book.playerId)?.team === weak && book.loadout.weapon === 'AWP' && book.loadout.armor === 0 && book.spend >= WEAPONS.AWP.price)) add('RD-5-6');
                if (primary.length === 0 && gear.filter(e => e.weapon === 'Deagle' && e.armor > 0 && !e.helmet).length === 1 && gear.filter(e => e.armor > 0).length === 1) add('RF-5-5');
                if (gear.some(e => e.weapon === 'Tec-9' && e.armor > 0 && !e.helmet && e.utility.length > 0)) add('RF-6-9');
                if (loadouts(strong).reduce((n,e)=>n + WEAPONS[e.weapon].price,0) > gear.reduce((n,e)=>n + WEAPONS[e.weapon].price,0) && loadouts(strong).reduce((n,e)=>n + e.utility.length,0) >= utility + 4) add('RD-6-16');
                if(weak===t&&economy==='force'&&primary.length>=2)add('RW-1-3');
                if(weak===t&&utility===0)add('RW-6-17');
                if(strong===t&&loadouts(t).reduce((n,e)=>n+e.utility.length,0)>=10&&utility<=2)add('RF-6-8');
                if(loadouts(t).filter(e=>e.utility.length>=2).length===2&&loadouts(t).filter(e=>e.utility.length>0).length===2)add('RB-6-44');
            }
            break;
        }
        case 'opening':
            if (kill) add('RQ-2-30');
            if (duelFor(kill)?.detail.headshot === true){add('RQ-2-25','RQ-2-15','RD-4-10','RF-12-7');if(weaponAt(kill?.target)==='AWP')add('RB-12-42');}
            if(kill&&beat.facts.actorName==='ZywOo'){
                const shots=past.filter(e=>e.kind==='duel'&&e.actor===kill.actor);
                if(shots.length>=2&&shots.every(e=>e.detail.headshot===true))add('RF-12-14');
            }
            if (kill?.team === t && kill.at <= 20 && ['fastA','fastB'].includes(round.decisions[t].tactic)) add('RW-2-12');
            if (kill?.alive && [...kill.alive].sort().join(':') === '4:5') add('RW-2-10','RW-2-11');
            break;
        case 'trade': {
            if (!refs.some(e => e.kind === 'trade') || kills.length < 2) break;
            add('RB-2-2', 'RB-2-7', 'RB-2-35', 'RB-2-42');
            add('RF-2-8', 'RW-2-1', 'RW-2-5', 'RD-2-3');
            if (kill?.team === t && kills.length === 2 && kill.alive?.[0] === 4 && kill.alive[1] === 4) add('RQ-2-4');
            if (beat.facts.actorName === 'apEX') add('RF-2-15');
            if (beat.facts.actorName === 'm0NESY') add('RF-2-9');
            if(kill&&past.some(e=>e.kind==='blind'&&e.target===kill.target&&e.actor!==kill.actor&&Number(e.detail.until)>=kill.at&&round.initial.find(f=>f.id===e.actor)?.team===kill.team)){
                const map=getMap(round.map);
                if(kill.zone===map.siteA||kill.zone===map.siteB)add('RB-2-8');
                if(beat.facts.actorName==='ropz')add('RF-2-14');
            }
            if (beat.facts.actorName === 'flameZ' && kills.at(-1)!.at - kills[0].at <= 2) add('RD-2-6');
            if (beat.facts.actorName === 'zont1x' && kills.at(-1)!.at > kills[0].at) add('RD-2-13');
            if (kill && weaponAt(kill.target) === 'AWP') {
                add('RF-2-3');
                if (beat.facts.actorName === 'TeSeS' && beat.facts.targetName === 'ropz') add('RD-2-7');
                if (beat.facts.actorName === 'zont1x' && duelFor(kill)?.detail.range === 'close') add('RD-2-14');
            }
            if (kill?.team === t && duelFor(kill)?.detail.range === 'close') add('RD-2-1');
            if (kills.every(e => site(e.zone) === 'mid')) add('RB-2-30', 'RB-2-34');
            if(kill?.team!==undefined&&kill.alive?.[kill.team]===2&&kill.alive[1-kill.team]===1)add('RF-2-16');
            if(beat.facts.actorName==='flameZ')add('RF-2-11');
            break;
        }
        case 'clutch-start': {
            const clutcher=round.initial.find(f=>f.id===beat.facts.clutchId);
            if(clutcher?.side==='CT'&&!clutcher.equipment.kit&&!remainingUtility(clutcher.id).includes('smoke'))add('RQ-3-10');
            add('RB-3-6', 'RB-3-16', 'RB-3-18');
            add('RD-3-2', 'RD-3-5');
            if (beat.facts.actorName === 'flameZ' && beat.facts.clutchSize === 2) add('RD-3-7');
            if (beat.facts.actorName === 'ZywOo') add('RF-3-9');
            if (beat.facts.clutchSize === 4) add('RB-3-37');
            if (beat.facts.actorName === 'ZywOo') add('RB-3-9');
            if (beat.facts.actorName === 'apEX') add('RB-3-21');
            if (beat.facts.clutchSize === 2 && past.filter(e => e.kind === 'kill' && e.actor === beat.facts.clutchId).length === 2) add('RB-3-30');
            break;
        }
        case 'clutch-win':
            add('RB-3-3', 'RB-3-34', 'RQ-10-13');
            add('RD-3-1', 'RF-3-7', 'RF-3-14', 'RW-3-6');
            if(refs.some(e=>e.kind==='roundEnd')&&round.score[round.winner]>=10&&kills.filter(e=>e.actor===beat.facts.clutchId).length>=2)add('RQ-4-10');
            if (round.reason === 'elimination' && kills.filter(e => e.actor === kills.at(-1)?.actor && !['HE','fire'].includes(e.weapon!)).length >= 2) add('RF-3-8');
            if (round.reason === 'elimination' && kills.length && kills.every(e => e.zone === getMap(round.map).siteB)) add('RB-3-42');
            break;
        case 'clutch-loss':
            if(refs.some(e=>e.kind==='roundEnd')&&beat.at===round.events.at(-1)?.at&&round.initial.find(f=>f.id===beat.facts.clutchId)?.team!==round.winner){
                const effort=kills.some(e=>e.actor===beat.facts.clutchId);
                if(effort)add('RD-3-11','RD-3-12');
                if(effort&&beat.facts.actorTeamName==='Natus Vincere')add('RB-3-2');
                if(effort&&round.final.filter(f=>f.team===round.winner&&f.alive).length===1)add('RW-3-5');
            }
            break;
        case 'map-win':
            if(refs.some(e=>e.kind==='roundEnd'&&e.id===round.events.at(-1)?.id)&&mapWinner(round.score)===round.winner&&Number(beat.facts.seriesFinished)===1)add('RB-7-14','RB-7-20','RF-7-3');
            break;
        case 'overtime-match-point':
            {const next:[number,number]=[...round.score];next[round.winner]++;if(round.number>24&&mapWinner(round.score)===null&&mapWinner(next)===round.winner&&refs.some(e=>e.kind==='roundEnd'&&e.id===round.events.at(-1)?.id))add('RQ-7-36','RB-7-10');}
            break;
        case 'overtime-repeat':
            if(round.number>24&&round.score[0]===round.score[1]&&round.score[0]%3===0&&refs.some(e=>e.kind==='roundEnd'&&e.id===round.events.at(-1)?.id))add('RQ-7-6');
            break;
        case 'match-point-saved':
            {const previous:[number,number]=[...round.score];previous[round.winner]--;previous[1-round.winner]++;
            if(refs.some(e=>e.kind==='roundEnd'&&e.id===round.events.at(-1)?.id)&&mapWinner(round.score)===null&&mapWinner(previous)===1-round.winner){
                add('RB-7-2');
                const next:[number,number]=[...round.score];next[1-round.winner]++;
                if(beat.facts.pointLeaderName==='Falcons'&&mapWinner(next)===1-round.winner)add('RD-7-1');
            }}
            break;
        case 'headshot':
            if (kill) add('RQ-2-15');
            if (duelFor(kill)?.detail.headshot === true) {
                add('RD-4-10', 'RF-12-7');
                if (beat.facts.actorName === 'NiKo') add('RD-4-9');
                if (beat.facts.actorName === 'zont1x' && beat.facts.targetName === 'ZywOo') add('RF-12-15');
                if (beat.facts.actorName === 'ZywOo' && kill?.weapon === 'Tec-9') add('RD-4-13');
            }
            if (kill && weaponAt(kill.target) === 'AWP') add('RB-12-42');
            break;
        case 'rifle-v-awp':
            if (kill && weaponAt(kill.target) === 'AWP' && WEAPONS[kill.weapon ?? '']?.category === 'rifle') {
                if (duelFor(kill)?.detail.headshot === true) add('RB-12-42');
            }
            break;
        case 'awp-opening':
            if (kill?.weapon === 'AWP') {
                add('RB-12-5','RB-12-36');
                if (beat.facts.actorName === 'ZywOo') add('RF-12-10');
            }
            break;
        case 'two-v-two':
            if (kill?.alive?.[0] === 2 && kill.alive[1] === 2) {
                add('RF-3-15');
                if(alive.some(f=>String(beat.facts['name:'+f.id]??'').toLowerCase()==='frozen'&&beat.facts['prior2v2:'+f.id]===1))add('RW-3-2');
            }
            break;
        case 'even': {
            const mid = getMap(round.map).mid;
            if (getZone(getMap(round.map),mid).name==='中路' && kill?.alive?.[0] === 3 && kill.alive[1] === 3 && kill.team === t && kill.zone === mid && alive.some(f=>f.team===t&&locationAt(f.id)===mid) && !alive.some(f=>f.team===ct&&locationAt(f.id)===mid)) add('RD-2-17');
            break;
        }
        case 'rotation':
            if (refs.some(e => e.kind === 'info' && e.team === ct) && refs.some(e => e.kind === 'move' && e.team === ct)) add('RW-9-8');
            break;
        case 'half-time':
            if (round.number === 12 && refs.some(e => e.kind === 'roundEnd')) add('RD-11-8');
            break;
        case 'smoke-kill':
            if (round.map === 'nuke' && kill?.weapon === 'AK-47' && kill.zone === getMap(round.map).mid && Number(duelFor(kill)?.detail.smoke) < 1) add('RF-6-7');
            break;
        case 'awp-duel':
            if (kill?.weapon === 'AWP' && weaponAt(kill.target) === 'AWP') add('RB-12-5', 'RB-12-36');
            break;
        case 'awp-followup':
            if(kills.length===2&&kill?.weapon==='AWP'&&kill.zone===getMap(round.map).ctSpawn&&kills[0].weapon==='AWP'&&kills[0].actor===kill.actor)add('RF-12-6');
            break;
        case 'multikill': {
            if (kills.length < 3) break;
            add('RQ-10-13', 'RQ-10-27');
            if (kills.length === 3) add('RB-4-6');
            if (beat.facts.actorName === 'ZywOo') {
                add('RQ-10-7');
                if(kill&&!['HE','fire'].includes(kill.weapon??'')&&refs.some(e=>e.kind==='trade'&&e.actor===kill.actor&&e.causes.includes(kill.id)&&past.some(first=>first.kind==='kill'&&first.id!==kill.id&&e.causes.includes(first.id)&&first.actor===kill.target&&round.initial.find(f=>f.id===first.target)?.team===kill.team)))add('RQ-4-5');
                if (kills.length === 3) add('RB-4-15', 'RB-4-16');
            }
            if (typeof beat.facts.actorName === 'string' && beat.facts.actorName.toLowerCase() === 'makazze' && kills.length === 3) add('RB-4-24');
            if (kills.every(e => e.weapon === 'Deagle' && e.zone===getMap(round.map).siteA && e.team === t) && kill?.actor && locationAt(kill.actor)===getMap(round.map).siteA && past.some(e=>e.kind==='position'&&e.actor===kill.actor&&e.zone===getMap(round.map).siteA&&e.detail.from&&past.indexOf(e)<past.indexOf(kills[0]))) add('RQ-5-9');
            const actor = round.initial.find(f => f.id === kill?.actor);
            if (kills.length === 3 && actor?.hp === 100 && !past.some(e => e.kind === 'damage' && e.target === actor.id && Number(e.damage) > 0)) {
                add('RB-4-13');
                if (round.number === 25 && beat.facts.actorName === 'ZywOo') add('RQ-4-36');
            }
            if (kills.length === 5) add('RB-4-23');
            if (kills.length >= 3 && kills.every(e => e.team===t&&e.zone === getMap(round.map).siteA) && kill!.at - kills[0].at <= 3 && !alive.some(f=>f.team===ct&&locationAt(f.id)===getMap(round.map).siteA)) add('RQ-4-15');
            if (kills.length === 3 && kills.every(e => e.zone === getMap(round.map).siteA || e.zone === getMap(round.map).siteB) && new Set(kills.map(e => e.zone)).size === 1) add('RD-4-3');
            if (kills.length === 3 && kills.every(e => e.weapon === 'AK-47' && e.team === t && e.zone === kill!.zone && (e.zone===getMap(round.map).siteA||e.zone===getMap(round.map).siteB)) && alive.filter(f=>f.team===t).length>=2 && alive.filter(f=>f.team===t).every(f=>locationAt(f.id)===kill!.zone)) add('RW-4-4');
            if (kills.length === 3 && kill!.at - kills[0].at <= 3) add('RD-4-1');
            if (kills.length === 3 && actor?.team === t && actor.hp === 100 && kills.every(e=>e.zone===getMap(round.map).siteA||e.zone===getMap(round.map).siteB) && locationAt(actor.id)===kill!.zone && !past.some(e=>e.kind==='damage'&&e.target===actor.id&&Number(e.damage)>0)) add('RD-4-2');
            if (kills.length === 4 && beat.facts.actorName === 'KSCERATO') add('RF-4-1');
            if (getZone(getMap(round.map),getMap(round.map).mid).name==='中路' && kills.every(e=>e.zone === getMap(round.map).mid) && kill!.at <= 25) add('RF-4-4');
            if (beat.facts.actorTeamName === 'FURIA' && kill!.at <= 20) add('RF-1-4');
            if (kills.length === 4 && (round.number === 1 || round.number === 13) && kill!.at-kills[0].at<=8) add('RW-1-2');
            break;
        }
        case 'flash':
            // Viewing angles are not modeled: use the new support line instead of claiming a look direction.
            if (refs.some(e => e.kind === 'blind' && e.actor !== e.target && round.initial.find(f => f.id === e.actor)?.team !== round.initial.find(f => f.id === e.target)?.team)) add('RD-6-5');
            break;
        case 'flash-conversion':
            if (refs.some(e => e.kind === 'blind') && kill)add('RQ-9-32', 'RD-6-5');
            break;
        case 'grenade':
            if (kill?.weapon === 'HE' && past.some(e => e.kind === 'kill' && e.at < kill.at)) add('RD-6-6');
            if (refs.some(e => e.kind === 'damage' && e.weapon === 'HE') && past.filter(e => e.kind === 'he').length >= 2) add('RW-6-19');
            break;
        case 'fire-damage':
            if (refs.some(e => e.kind === 'damage' && e.weapon === 'fire' && Number(e.damage) > 0)) add('RQ-6-30');
            break;
        case 'pickup':
            if (refs.some(e => e.kind === 'pickup' && WEAPONS[e.weapon ?? '']?.category !== 'pistol')) add('RQ-5-14');
            if (beat.facts.actorName === 'flameZ'&&refs.some(e=>e.kind==='pickup'&&e.weapon==='AWP'&&(e.zone===getMap(round.map).siteA||e.zone===getMap(round.map).siteB)&&alive.some(f=>f.id===e.actor)&&!alive.some(f=>f.team!==e.team&&locationAt(f.id)===e.zone)))add('RF-12-5');
            if(refs.some(e=>e.kind==='pickup'&&past.some(previous=>previous.kind==='trade'&&previous.actor===e.actor&&past.indexOf(previous)<past.indexOf(e)&&past.some(k=>k.kind==='kill'&&k.actor===e.actor&&Boolean(WEAPONS[k.weapon??''])&&!['HE','fire'].includes(k.weapon??'')&&previous.causes.includes(k.id)&&e.causes.includes(k.id)))))add('RF-2-10');
            break;
        case 'extinguish': {
            const extinguish = refs.find(e => e.kind === 'extinguish');
            if (extinguish) add('RW-6-6');
            if (extinguish && beat.facts.actorName === 'm0NESY' && locationAt(extinguish.actor!) === extinguish.zone && past.some(e=>e.kind==='kill'&&e.actor===extinguish.actor&&e.weapon==='AWP')) add('RF-6-14');
            break;
        }
        case 'plant': {
            const plant = refs.find(e => e.kind === 'plant');
            const startAt=Number(plant?.detail.startAt);
            if (plant && Number.isFinite(startAt) && past.some(e => e.kind === 'kill' && e.actor === plant.actor && e.at <= startAt)) add('RB-8-33');
            if(plant&&Number.isFinite(startAt)&&past.some(e=>{
                if(e.kind!=='kill'||e.team!==t||e.zone!==plant.zone||e.at>startAt||startAt-e.at>5)return false;
                const prefix=past.slice(0,past.indexOf(e)+1),victimGun=prefix.filter(x=>x.kind==='pickup'&&x.actor===e.target&&x.weapon).at(-1)?.weapon??round.initial.find(f=>f.id===e.target)?.equipment.weapon;
                return victimGun==='AWP'&&!round.initial.some(f=>f.team===ct&&!prefix.some(x=>x.kind==='kill'&&x.target===f.id)&&(prefix.filter(x=>x.kind==='position'&&x.actor===f.id).at(-1)?.zone??f.zone)===plant.zone);
            }))add('RF-8-2');
            break;
        }
        case 'defuse-timing': {
            const defuse = refs.find(e => e.kind === 'defuse');
            const plant = refs.find(e => e.kind === 'plant');
            if (defuse && plant && Number(plant.detail.explodeAt) - defuse.at <= 3) add('RB-8-4');
            if (defuse) add('RQ-9-33');
            if (defuse && !defuse.detail.kit) add('RW-8-7');
            break;
        }
        case 'save-decision': {
            const save = refs.find(e => e.kind === 'save' && e.detail.decision === true);
            if (save) add('RB-6-30');
            if (save?.team === ct && alive.filter(f=>f.team===ct).every(f=>past.some(e=>e.kind==='save'&&e.actor===f.id&&e.detail.decision===true))) add('RD-5-5');
            if (save && weaponAt(save.actor) === 'AWP') add('RB-12-6');
            if (save && round.initial.find(f => f.id === save.actor)?.equipment.armor && beat.at === round.events.at(-1)?.at && round.final.some(f => f.id === save.actor && f.alive && f.equipment.armor > 0)) add('RQ-5-34');
            break;
        }
        case 'eco-win':
            add('RB-5-16', 'RQ-10-13');
            if(round.plans[round.winner].economy==='force'&&loadouts(round.winner).filter(e=>WEAPONS[e.weapon].category!=='pistol').length>=2)add('RB-5-1','RB-5-4');
            if (round.plans[round.winner].economy === 'eco') add('RD-5-2');
            if (kills.some(e=>e.weapon==='Five-SeveN'&&e.team===round.winner)) add('RF-5-8');
            if (round.winner===t&&round.plans[t].economy==='force'&&loadouts(t).filter(e=>WEAPONS[e.weapon].category!=='pistol').length>=2&&alive.filter(f=>f.team===ct).length>0&&alive.filter(f=>f.team===ct).every(f=>past.some(e=>e.kind==='save'&&e.actor===f.id&&e.detail.decision===true)))add('RQ-5-2');
            break;
        case 'close':
            if (round.score[round.winner] === 6) add('RQ-7-20');
            if (round.score[1 - round.winner] === 11 && round.score[round.winner] < 12) add('RQ-7-8');
            if (round.score[1 - round.winner] === 12 && round.score[round.winner] < 12) add('RQ-7-33');
            if ((round.number === 1 || round.number === 13) && past.filter(e=>e.kind==='kill'&&e.team===round.winner).length >= 3 && new Set(past.filter(e=>e.kind==='kill'&&e.team===round.winner).map(e=>e.actor)).size >= 2) add('RD-1-2');
            if (round.plans[t].tactic === 'fakeA' || round.plans[t].tactic === 'fakeB') {
                const map = getMap(round.map);
                if (round.winner === t && round.reason === 'elimination' && [map.laneA,map.laneB].every(zone=>past.some(e=>e.kind==='position'&&e.team===t&&e.zone===zone))) add('RF-4-3');
            }
            break;
        case 'match-point':
            if (Math.min(...round.score) <= 5) add('RQ-7-27');
            if (Number(beat.facts.winStreak) >= 3) add('RF-7-2');
            break;
        case 'overtime-threat':
            add('RQ-7-12', 'RD-7-4', 'RD-7-5', 'RF-11-3', 'RW-11-5');
            break;
        case 'phase-execution': {
            const execution = refs.find(e => e.kind === 'tactic' && e.detail.rule === 'execution' && e.detail.status === 'executing' && e.team === t);
            if (execution) add('RB-9-24');
            const first = past.find(e => e.kind === 'kill');
            if (execution && first?.team === ct) add('RQ-2-8');
            if (execution && round.decisions[t].tactic === 'fastB') add('RW-6-3');
            break;
        }
        case 'phase-retake': {
            const retake = refs.find(e => e.kind === 'tactic' && e.team === ct && e.detail.rule === 'retake' && e.detail.status === 'executing');
            const defenders = alive.filter(f => f.team === ct);
            const plant=past.find(e=>e.kind==='plant');
            const activeSiteSmoke=plant&&retake&&past.some(e=>e.kind==='smoke'&&e.zone===plant.zone&&e.at<=retake.at&&e.at+18>retake.at);
            if (retake && plant && !activeSiteSmoke && defenders.length && defenders.every(f => !remainingUtility(f.id).includes('smoke'))) add('RF-8-4','RW-8-3','RW-8-4');
            if(retake&&defenders.length===2&&defenders.every(f=>f.equipment.utility.length>0&&remainingUtility(f.id).length===0))add('RD-6-8');
            if(retake&&defenders.reduce((n,f)=>n+remainingUtility(f.id).length,0)>=8)add('RW-6-12');
            break;
        }
        case 'phase-utility': {
            const rule=refs.find(e=>e.kind==='tactic'&&e.detail.rule==='utility'&&e.actor);
            if(rule?.detail.status==='released'&&remainingUtility(rule.actor!).length>0&&['A','B'].includes(site(rule.zone)!))add('RF-6-11');
            break;
        }
        case 'phase-smoke': {
            const rule=refs.find(e=>e.kind==='tactic'&&e.detail.rule==='smoke'&&e.team===ct&&['waiting','interrupted'].includes(String(e.detail.status))&&e.actor);
            const plant=past.find(e=>e.kind==='plant');
            if(rule&&plant?.zone===rule.zone&&round.plans[ct].postPlant==='retake'&&past.some(e=>rule.causes.includes(e.id)&&e.kind==='smoke')&&!past.some(e=>e.kind==='save'&&e.actor===rule.actor))add('RD-9-22');
            break;
        }
        case 'highlight-shout': {
            // A candidate context for the existing high moment, not an extra retelling of the event.
            const kind = beat.facts.highlightKind;
            const multikill = kind === 'multikill' && kills.length >= 3 && new Set(kills.map(e => e.actor)).size === 1;
            const ended = refs.some(e => e.kind === 'roundEnd' && e.id === round.events.at(-1)?.id) && beat.at === round.events.at(-1)?.at;
            const clutch = kind === 'clutch-win' && ended && Number(beat.facts.clutchSize) >= 2 && round.final.some(f => f.id === beat.facts.clutchId && f.team === round.winner && f.alive);
            const values = [0,1].map(team => loadouts(team).reduce((n,e) => n + WEAPONS[e.weapon].price + e.armor * 6.5 + (e.helmet ? 350 : 0),0));
            const eco = kind === 'eco-win' && ended && values[1-round.winner] > values[round.winner] * 1.8 && values[1-round.winner] - values[round.winner] > 5000;
            if (!multikill && !clutch && !eco) break;
            add('RD-10-1','RD-10-8','RD-10-9','RD-10-13','RF-10-1','RF-10-4');
            if (multikill || (clutch && kills.some(e => e.actor === beat.facts.clutchId))) add('RW-10-1','RW-10-3');
            if (clutch || eco) add('RW-10-8','RW-10-9');
            if (beat.facts.actorName === 'TeSeS' && (multikill || clutch)) add('RD-10-2');
            if (beat.facts.actorName === 'ZywOo' && (multikill || clutch)) add('RD-10-3');
            if (beat.facts.actorTeamName === 'Natus Vincere' && (multikill || clutch)) add('RD-10-5');
            if (multikill && beat.facts.actorTeamName === 'FaZe') add('RW-4-6');
            if (multikill && duelFor(kill)?.detail.headshot === true) add('RF-12-1');
            if (multikill && kills.filter(e => ['HE','fire'].includes(e.weapon!)).length >= 2) add('RW-6-14','RW-6-15');
            break;
        }
    }
    // Iteration 9: each line below was individually reviewed against immutable source text.
    // The old gates above stay intact. No tag or keyword authorizes a quote.
    const map=getMap(round.map),pistol=round.number===1||round.number===13;
    const nameOf=(id:string|undefined)=>String(beat.facts['name:'+id]??'').toLowerCase();
    const teamName=(index:number)=>String(beat.facts['teamName:'+index]??'');
    const throws=past.filter(e=>['smoke','flash','fire','he'].includes(e.kind));
    const planted=past.find(e=>e.kind==='plant');
    const midNamed=getZone(map,map.mid).name==='中路';
    const midLost=midNamed&&kill?.alive?.[0]===3&&kill.alive[1]===3&&kill.team===t&&kill.zone===map.mid&&alive.some(f=>f.team===t&&locationAt(f.id)===map.mid)&&!alive.some(f=>f.team===ct&&locationAt(f.id)===map.mid);
    const hpAt=(id:string)=>past.filter(e=>e.kind==='damage'&&e.target===id).at(-1)?.hpAfter??round.initial.find(f=>f.id===id)!.hp;
    const clutcher=round.initial.find(f=>f.id===beat.facts.clutchId);
    const rule=refs.find(e=>e.kind==='tactic'&&e.detail.rule);
    const ended=refs.some(e=>e.kind==='roundEnd'&&e.id===round.events.at(-1)?.id);
    const clutchEntry=clutcher&&refs.find(e=>e.kind==='kill'&&e.target!==clutcher.id&&round.initial.find(f=>f.id===e.target)?.team===clutcher.team);
    const ownKills=clutchEntry?past.filter(e=>e.kind==='kill'&&e.actor===clutcher!.id&&past.indexOf(e)>past.indexOf(clutchEntry)):[];
    switch(beat.category){
        case 'setup':
            if(round.number>=10&&beat.facts.totalTimeouts===0&&!past.some(e=>e.kind==='coachTimeout'))add('RF-11-7');
            if(round.number>=17&&round.number<=24&&Number(beat.facts.STREAK)>=4)add('RF-11-10');
            break;
        case 'plan': {
            if(round.decisions[ct].tactic==='midContest'&&midNamed)add('RD-9-2');
            if(round.decisions[ct].tactic==='passive'&&round.decisions[ct].risk==='conservative')add('RD-9-24');
            if(['fakeA','fakeB'].includes(round.decisions[t].tactic))add('RD-9-26');
            if(['fastA','fastB'].includes(round.decisions[t].tactic)&&loadouts(t).reduce((n,e)=>n+e.utility.length,0)>=10)add('RD-9-27');
            const tp=round.decisions[t].positions,cp=round.decisions[ct].positions;
            if(midNamed&&tp&&Object.values(tp).filter(zone=>zone===map.mid).length===4)add('RD-9-29');
            if(midNamed&&cp&&Object.values(cp).filter(zone=>zone===map.mid).length>=3)add('RW-1-7');
            if(cp&&Object.values(cp).filter(zone=>zone===map.siteB).length===3&&round.initial.some(f=>f.team===ct&&f.equipment.weapon==='AWP'&&cp[f.id]===map.siteB))add('RW-9-9');
            if(round.decisions[ct].tactic==='stackB'&&!cp)add('RF-1-7');
            break;
        }
        case 'economy':
            if(typeof beat.facts.weakTeam==='number'&&beat.facts.pointLeader===1-beat.facts.weakTeam&&loadouts(beat.facts.weakTeam).filter(e=>WEAPONS[e.weapon].category!=='pistol').length<=1&&round.economy.filter(e=>round.initial.find(f=>f.id===e.playerId)?.team===beat.facts.weakTeam).reduce((n,e)=>n+e.cashBefore,0)<=7500)add('RD-7-2');
            break;
        case 'opening':
            if(kill&&midNamed&&kill.zone===map.mid&&kill.team===ct&&kill.at<=15&&new Set(past.filter(e=>e.kind==='position'&&e.team===t&&e.zone===map.mid&&e.at<=12).map(e=>e.actor)).size>=3)add('RD-1-9');
            if(kill&&kill.team===ct&&midNamed&&kill.zone===map.mid&&kill.at<=20&&teamName(t)==='Falcons'&&past.some(e=>e.kind==='position'&&e.actor===kill.target&&e.zone===map.mid&&e.at>=kill.at-3))add('RD-9-19');
            if(kill&&!planted&&round.initial.find(f=>f.id===kill.target)?.hasBomb){add('RD-8-12');if(midNamed&&kill.zone===map.mid)add('RD-8-11');}
            if(kill&&kill.team===t&&kill.at<=20&&kill.zone===map.siteA&&locationAt(kill.actor!)===map.siteA&&!alive.some(f=>f.team===ct&&locationAt(f.id)===map.siteA))add('RF-1-8');
            break;
        case 'headshot': {
            if(duelFor(kill)?.detail.headshot===true&&past.filter(e=>e.kind==='kill'&&e.actor===kill?.actor).length===2)add('RD-4-11');
            break;
        }
        case 'even':
            if(midLost){
                if(throws.filter(e=>e.team===t).length<=1)add('RD-6-2');
                if(past.some(e=>e.kind==='position'&&e.team===ct&&e.zone===map.mid))add('RD-9-30');
                if(teamName(t)==='Vitality')add('RF-9-5');
                if(alive.filter(f=>f.team===t&&locationAt(f.id)===map.mid&&f.id!==kill!.actor).length>=1)add('RW-9-21');
            }
            break;
        case 'one-v-one':
            if(kill?.alive?.[0]===1&&kill.alive[1]===1)add('RF-3-6');
            break;
        case 'awp-hurt':
            if(refs.some(e=>e.kind==='damage'&&e.hpAfter!>0&&e.hpAfter!<=35&&WEAPONS[e.weapon??'']&&!['HE','fire'].includes(e.weapon!)&&weaponAt(e.target)==='AWP'))add('RW-12-13');
            break;
        case 'rifle-v-awp':
            if(kill&&weaponAt(kill.target)==='AWP'&&past.some(e=>e.kind==='save'&&e.actor===kill.target&&e.detail.decision===true&&e.at<kill.at))add('RW-5-3');
            break;
        case 'awp-opening':
            if(kill?.weapon==='AWP'&&kill.at<=20)add('RF-12-11');
            break;
        case 'clutch-start':
            if(clutcher){
                if(nameOf(clutcher.id)==='niko'&&weaponAt(clutcher.id)==='P250')add('RF-3-3');
                if(nameOf(clutcher.id)==='m0nesy')add('RF-3-16');
                if(hpAt(clutcher.id)===1)add('RW-3-3');
                if(beat.facts.clutchSize===2)add('RW-3-9');
                if(clutcher.team===ct&&planted&&weaponAt(clutcher.id)==='AWP'&&Number(beat.facts.clutchSize)>=3&&!clutcher.equipment.kit&&remainingUtility(clutcher.id).length===0)add('RW-12-6');
                if(WEAPONS[weaponAt(clutcher.id)!].category==='pistol'&&past.some(e=>e.kind==='kill'&&e.zone===locationAt(clutcher.id)&&weaponAt(e.target)==='AWP'&&!past.some(p=>p.kind==='pickup'&&p.causes.includes(e.id))))add('RW-12-11');
            }
            break;
        case 'save-decision': {
            const save=refs.find(e=>e.kind==='save'&&e.detail.decision===true),f=round.initial.find(f=>f.id===save?.actor);
            if(save&&f&&save.at>=30&&f.equipment.armor-past.filter(e=>e.kind==='damage'&&e.target===f.id).length*5>0)add('RD-5-4');
            const defenders=alive.filter(f=>f.team===ct),allSaving=defenders.length>0&&defenders.every(f=>past.some(e=>e.kind==='save'&&e.actor===f.id&&e.detail.decision===true));
            if(save?.team===ct&&allSaving&&beat.facts.pointLeader===t&&planted)add('RF-7-1','RW-7-1');
            break;
        }
        case 'flash-conversion':
            if(kill?.team===ct&&['midContest','aggressionA','aggressionB'].includes(round.decisions[ct].tactic)&&refs.some(e=>e.kind==='blind'&&round.initial.find(f=>f.id===e.actor)?.team===ct))add('RW-6-4');
            break;
        case 'smoke-kill':
            if(kill?.team===t&&(kill.zone===map.siteA||kill.zone===map.siteB)&&Number(duelFor(kill)?.detail.smoke)<1&&throws.some(e=>e.kind==='smoke'&&e.team===t&&e.zone===kill.zone&&e.at<=kill.at&&e.at+18>=kill.at))add('RW-6-7');
            break;
        case 'phase-execution':
            if(rule?.team===t&&rule.detail.status==='executing'){
                if(pistol&&['fastA','fastB'].includes(round.decisions[t].tactic)&&throws.filter(e=>e.team===t).length>=2)add('RF-1-2');
                if(['fastA','fastB'].includes(round.decisions[t].tactic)&&round.plans[t].execution==='direct'&&rule.at<=15&&alive.filter(f=>f.team===t).length>=4)add('RW-1-10');
                if(alive.filter(f=>f.team===t).reduce((n,f)=>n+remainingUtility(f.id).length,0)>=8&&past.some(e=>e.kind==='tactic'&&e.team===t&&e.detail.rule==='regroup'&&e.detail.status==='executing'))add('RW-6-20');
                const redirect=past.find(e=>e.kind==='info'&&e.team===t&&e.detail.fromSite&&e.detail.toSite);
                if(redirect&&((round.decisions[t].tactic==='fakeA'&&redirect.detail.fromSite==='B'&&redirect.detail.toSite==='A'&&rule.zone===map.siteA)||(round.decisions[t].tactic==='fakeB'&&redirect.detail.fromSite==='A'&&redirect.detail.toSite==='B'&&rule.zone===map.siteB)))add('RW-9-1');
                if(midNamed&&rule.zone===map.siteA&&past.some(e=>e.kind==='kill'&&e.team===t&&e.zone===map.mid&&e.at>=rule.at-2))add('RW-9-12');
            }
            break;
        case 'phase-retake':
            if(rule?.team===ct&&rule.detail.status==='executing'){
                const defenders=alive.filter(f=>f.team===ct),attackers=alive.filter(f=>f.team===t);
                if(defenders.length===2&&attackers.length===1)add('RD-3-13');
                if(defenders.length===3&&attackers.length===4)add('RD-3-15');
                if(planted&&new Set(defenders.flatMap(f=>remainingUtility(f.id))).size>=2&&defenders.some(f=>remainingUtility(f.id).includes('fire')&&locationAt(f.id)===planted.zone))add('RD-6-3');
                if(rule.actor&&nameOf(rule.actor)==='teses'&&defenders.length===1&&locationAt(rule.actor)===map.ctSpawn)add('RD-9-20');
                const initialUtility=loadouts(ct).reduce((n,e)=>n+e.utility.length,0);
                if(initialUtility>=5&&throws.filter(e=>e.team===ct).length===initialUtility&&round.initial.filter(f=>f.team===ct).every(f=>remainingUtility(f.id).length===0))add('RW-6-16');
            }
            break;
        case 'phase-utility':
            if(throws.length>=15)add('RD-6-7');
            if(rule?.actor&&nameOf(rule.actor)==='frozen'){
                if(locationAt(rule.actor)===map.ctSpawn&&alive.filter(f=>f.team===ct).reduce((n,f)=>n+remainingUtility(f.id).length,0)<=2)add('RW-6-5');
                const owner=round.initial.find(f=>f.id===rule.actor)!;
                if(remainingUtility(owner.id).length>0&&round.initial.filter(f=>f.team===owner.team&&f.id!==owner.id).every(f=>remainingUtility(f.id).length===0))add('RW-6-11');
            }
            if(rule?.team===ct&&rule.actor&&rule.detail.status==='waiting'&&remainingUtility(rule.actor).includes('fire')&&past.some(e=>e.kind==='tactic'&&e.team===t&&e.detail.rule==='execution'&&e.detail.status==='executing'&&e.at>=20)&&alive.some(f=>f.team===t&&locationAt(f.id)===locationAt(rule.actor!)))add('RF-6-6');
            break;
        case 'plant': {
            const plant=refs.find(e=>e.kind==='plant');
            if(plant){
                if(alive.some(f=>f.team===ct&&locationAt(f.id)===plant.zone))add('RD-8-1');
                if(past.filter(e=>e.kind==='kill'&&e.actor===plant.actor&&e.at>=Number(plant.detail.startAt)-5&&e.at<=Number(plant.detail.startAt)).length===2)add('RD-8-2');
                const fakeSite=round.decisions[t].tactic==='fakeA'?'A':round.decisions[t].tactic==='fakeB'?'B':null;
                if(fakeSite&&site(plant.zone)!==fakeSite&&throws.filter(e=>e.team===t&&site(e.zone)===fakeSite).length>=2&&past.some(e=>e.kind==='position'&&e.team===t&&site(e.zone)===fakeSite))add('RD-9-12');
            }
            break;
        }
        case 'timeout':
            if(refs.some(e=>e.kind==='coachTimeout')){
                add('RD-11-3');
                if(beat.facts.timeoutNumber===2)add('RD-11-5');
                if(beat.facts.暂停队==='FURIA'&&beat.facts.remainingTimeouts===1)add('RF-11-4');
                if(beat.facts.timeoutNumber===1&&round.number===2)add('RF-11-5');
            }
            break;
        case 'overtime-threat':
            if(round.number<=24&&[...round.score].sort((a,b)=>a-b).join(':')==='11:12'){
                add('RW-11-6');
                if(round.score.some((score,i)=>score===11&&teamName(i)==='FURIA'))add('RF-11-2');
            }
            break;
        case 'match-point':
            if(ended&&round.number<=24&&past.some(e=>e.kind==='kill'&&e.alive?.[round.winner]===5&&e.alive[1-round.winner]===3))add('RF-7-4');
            break;
        case 'map-win':
            if(ended&&mapWinner(round.score)===round.winner&&Number(beat.facts['maxDeficit:'+round.winner])>=5)add('RW-7-4');
            if(ended&&mapWinner(round.score)===ct&&round.decisions[ct].tactic==='midContest'&&midNamed&&past.filter(e=>e.kind==='kill'&&e.team===ct&&e.zone===map.mid&&e.at<=25).length>=3)add('RW-7-2');
            break;
        case 'close':
            if(ended){
                if(pistol&&teamName(round.winner)==='Natus Vincere')add('RD-1-3');
                if(loadouts(1-round.winner).filter(e=>e.weapon==='AWP').length===2)add('RD-5-8');
                if(round.winner===ct&&!planted&&!throws.some(e=>e.team===ct))add('RW-6-9');
                const allKills=past.filter(e=>e.kind==='kill');
                if(allKills.length>=2&&allKills.slice(0,2).every(e=>e.team!==round.winner))add('RW-10-2');
                const last=allKills.at(-1);
                if(planted&&last&&last.at===beat.at&&Number(planted.detail.explodeAt)-last.at>=0&&Number(planted.detail.explodeAt)-last.at<=1)add('RW-3-8');
                if(round.reason==='elimination'&&round.winner===t&&teamName(ct)==='G2'&&planted&&last?.team===t&&last.at>planted.at&&!['HE','fire'].includes(last.weapon!)&&past.some(e=>e.kind==='tactic'&&e.team===ct&&e.detail.rule==='retake'&&e.detail.status==='executing'))add('RW-4-5');
                const winners=alive.filter(f=>f.team===round.winner);
                const duoStart=allKills.find(e=>e.alive?.[round.winner]===2&&e.alive[1-round.winner]>=3);
                if(winners.length===2&&duoStart&&winners.every(f=>allKills.some(e=>e.actor===f.id&&past.indexOf(e)>past.indexOf(duoStart))))add('RF-3-10');
                if(round.reason==='explode'&&alive.filter(f=>f.team===ct).length===3&&alive.filter(f=>f.team===ct).every(f=>locationAt(f.id)===map.ctSpawn&&past.some(e=>e.kind==='save'&&e.actor===f.id&&e.detail.decision===true&&Number(e.detail.remaining)<=Number(e.detail.required))))add('RW-8-8');
            }
            break;
        case 'clutch-win':
            if(ended&&clutcher){
                if(pistol)add('RD-1-1');
                if(round.reason==='elimination'&&ownKills.length>=2&&ownKills.every(e=>!['HE','fire'].includes(e.weapon!)))add('RF-3-13');
                if(round.reason==='time'&&clutchEntry&&beat.at-clutchEntry.at>=15&&nameOf(clutcher.id)==='m0nesy'&&ownKills.some(e=>e.weapon==='AWP'))add('RF-8-6');
                if(ownKills.filter(e=>e.weapon==='AWP').length>=2)add('RD-12-14');
                if(round.reason==='defuse'&&round.plans[ct].postPlant==='clear'&&ownKills.length>=2&&past.some(e=>e.kind==='tactic'&&e.actor===clutcher.id&&e.detail.rule==='clear'&&e.detail.status==='completed'))add('RW-9-23','RW-9-24');
                if(round.decisions[round.winner].risk==='aggressive'&&ownKills.some(e=>Number(duelFor(e)?.detail.smoke)<1||Number(duelFor(e)?.detail.blindness)<1))add('RW-10-4');
                add('RF-10-10');
            }
            break;
        case 'clutch-loss':
            if(ended&&clutcher&&ownKills.length===3&&ownKills.every(e=>e.weapon==='AWP')&&past.filter(e=>e.kind==='duel'&&e.actor===clutcher.id).length===3)add('RW-12-10');
            break;
        case 'eco-win':
            if(ended){
                if(round.plans[round.winner].economy==='force'&&loadouts(round.winner).filter(e=>WEAPONS[e.weapon].category!=='pistol').length>=2&&beat.facts['priorForceUpsets:'+round.winner]===2)add('RW-1-4');
                if(round.plans[round.winner].economy==='force'&&loadouts(round.winner).filter(e=>WEAPONS[e.weapon].category!=='pistol').length>=2&&beat.facts['priorForceUpsets:'+round.winner]===1)add('RW-1-5');
                if(Number(beat.facts['priorSemiUpsets:'+round.winner])>0)add('RW-5-1');
                if(round.reason==='elimination')add('RF-5-10');
                const hero=round.initial.find(f=>f.team===round.winner&&f.equipment.weapon==='AWP');
                if(hero&&loadouts(round.winner).filter(e=>WEAPONS[e.weapon].category!=='pistol').length===1&&past.filter(e=>e.kind==='kill'&&e.actor===hero.id&&e.weapon==='AWP').length>=2)add('RF-5-3');
                if(round.initial.some(f=>f.team===round.winner&&nameOf(f.id)==='teses'&&f.equipment.armor===0&&past.filter(e=>e.kind==='kill'&&e.actor===f.id&&e.weapon==='Deagle'&&duelFor(e)?.detail.headshot===true).length>=3))add('RF-5-4');
                add('RF-10-10');
            }
            break;
        case 'multikill': {
            const actor=kill?.actor,actorKills=past.filter(e=>e.kind==='kill'&&e.actor===actor);
            if(kills.length>=3){
                if(teamName(kill!.team!)==='FURIA'&&past.filter(e=>e.kind==='kill'&&e.team===kill!.team).every(e=>duelFor(e)?.detail.headshot===true))add('RD-4-8');
                if(nameOf(actor)==='zywoo'&&past.filter(e=>e.kind==='trade'&&e.actor===actor&&past.some(k=>k.kind==='kill'&&k.actor===actor&&Boolean(WEAPONS[k.weapon??''])&&!['HE','fire'].includes(k.weapon??'')&&e.causes.includes(k.id))).length>=2)add('RF-2-13');
                if(round.number===13&&nameOf(actor)==='yekindar')add('RD-11-9');
                if(kills.every(e=>e.weapon==='AK-47'))add('RW-5-6');
                if(nameOf(actor)==='frozen'&&kills.length===3&&kills.every(e=>duelFor(e)?.detail.headshot===true))add('RW-4-3');
                const shots=past.filter(e=>e.kind==='duel'&&e.actor===actor&&e.weapon==='AWP').slice(-3);
                if(kills.every(e=>e.weapon==='AWP')&&shots.length===3&&shots.every(e=>past.some(d=>d.kind==='damage'&&d.causes.includes(e.id))))add('RW-12-12');
                if(nameOf(actor)==='zont1x'&&actorKills.filter(e=>weaponAt(e.target)==='AWP').length>=2)add('RD-12-13');
                const teamKills=past.filter(e=>e.kind==='kill'&&e.team===kill!.team);
                if(teamKills.length===4&&new Set(teamKills.map(e=>e.actor)).size===2&&teamKills.at(-1)!.at-teamKills[0].at<=4)add('RF-4-2');
                if(kill!.alive?.[kill!.team!]===3&&kill!.alive?.[1-kill!.team!]===2&&past.some(e=>e.kind==='blind'&&e.target===kill!.target&&e.actor!==kill!.actor&&round.initial.find(f=>f.id===e.actor)?.team===kill!.team&&Number(e.detail.until)>=kill!.at))add('RF-9-11');
            }
            break;
        }
        case 'highlight-shout': {
            const highKills=beat.facts.highlightKind==='multikill'&&kills.length>=3;
            const highEnd=ended&&['clutch-win','eco-win'].includes(String(beat.facts.highlightKind));
            if(highKills||highEnd){
                add('RF-10-3');
                if(highKills&&kills.at(-1)!.at-kills[0].at<=5)add('RF-10-9');
                if(highKills&&kills.length>=4&&kills.at(-1)!.at-kills[0].at<=8)add('RW-10-7');
                if(highKills&&beat.facts.bestOf===3&&nameOf(kill?.actor)==='m0nesy')add('RD-10-6');
                if(past.filter(e=>e.kind==='kill'&&e.team===0).length>=3&&past.filter(e=>e.kind==='kill'&&e.team===1).length>=3)add('RD-10-4');
            }
            break;
        }
    }
    if (['multikill','clutch-win','eco-win'].includes(beat.category)) add(...quoteCandidates({...beat,category:'highlight-shout',facts:{...beat.facts,highlightKind:beat.category}},round));
    return [...new Set(ids)];
}
