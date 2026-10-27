import type { RoundResult, Series, CommentarySegment, RoundEvent, TeamIndex } from './types';
import { getMap, getZone } from './maps';
import { hash } from './random';
import { WEAPONS } from './economy';
import { getTactic } from './tactics';
import { mapWinner } from './series';
import { timeoutLimit } from './coach';
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
const originalTemplatesByFamily = new Map<string,string[]>();
for (const template of templates.filter(template=>template.provenance==='assistant-authored-original-template'))
    originalTemplatesByFamily.set(template.family,[...(originalTemplatesByFamily.get(template.family)??[]),template.id]);
export const COMMENTARY_VERSION = 'causal-story-14';
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
    const mapPoint=(score:[number,number],index:number)=>{const next:[number,number]=[...score];next[index]++;return mapWinner(next)===index;};
    const pointLeader=([0,1] as const).find(index=>mapPoint(startScore,index));
    const overtimeNumber=round.number>24?Math.floor((round.number-25)/6)+1:0;
    const roundContext=round.plans?[...(overtimeNumber?[`第${overtimeNumber}轮加时，第${(round.number-25)%6+1}回合。`]:[]),...(pointLeader!==undefined?[`${team(pointLeader)}的地图赛点，这一分就能收图。`]:[])].join(''):'';
    const previous=series.mapStates.find(state=>state.map===round.map)?.rounds.filter(old=>old.number<round.number)??[];
    const prior2v2=new Set<string>();
    if(round.plans)for(const old of previous){
        const living=new Set(old.initial.map(f=>f.id));
        for(const e of old.events)if(e.kind==='kill'){living.delete(e.target!);if(e.alive?.[0]===2&&e.alive[1]===2)for(const id of living)prior2v2.add(id);}
    }
    const initialValue=(r:RoundResult,index:number)=>r.initial.filter(f=>f.team===index).reduce((sum,f)=>sum+WEAPONS[f.equipment.weapon].price+f.equipment.armor*6.5+(f.equipment.helmet?350:0),0);
    const priorUpsets=(index:number,economy:string)=>previous.filter(old=>old.winner===index&&old.plans?.[index].economy===economy&&(economy!=='force'||old.initial.filter(f=>f.team===index&&WEAPONS[f.equipment.weapon].category!=='pistol').length>=2)&&initialValue(old,1-index)>initialValue(old,index)*1.8&&initialValue(old,1-index)-initialValue(old,index)>5000).length;
    const common: Record<string, string | number> = { T: team(t), CT: team(ct), MAP: map.name, 地图: map.name, 攻方: team(t), 守方: team(ct), 获胜队: team(round.winner), 失败队: team(1 - round.winner), 比分: startScore.join(':'),...(round.plans?{...Object.fromEntries([...prior2v2].map(id=>['prior2v2:'+id,1])),bestOf:series.bestOf,pointLeader:pointLeader??-1,totalTimeouts:series.mapStates.find(state=>state.map===round.map)?.timeoutHistory.filter(record=>record.round<=round.number).length??0,...Object.fromEntries(series.players.map(p=>['name:'+p.id,p.nickname])),...Object.fromEntries(([0,1] as const).flatMap(index=>[['teamName:'+index,series.teams[index].name],['priorForceUpsets:'+index,priorUpsets(index,'force')],['priorSemiUpsets:'+index,priorUpsets(index,'semi')],['maxDeficit:'+index,Math.max(0,...previous.map(old=>old.score[1-index]-old.score[index]))]]))}:{}) };
    const add = (category: string, at: number, priority: number, refs: RoundEvent[], candidates: string[], fallback: string, facts: Record<string, string | number> = {}, emphasis: CommentarySegment['emphasis'] = 'neutral') => {
        const subject = refs.filter(e => e.kind === 'kill').at(-1) ?? refs.find(e => e.actor);
        const actorTeam = round.initial.find(f => f.id === subject?.actor)?.team;
        const identities: Record<string,string|number> = round.plans ? { actorName: series.players.find(p => p.id === subject?.actor)?.nickname ?? '', targetName: series.players.find(p => p.id === subject?.target)?.nickname ?? '', actorTeamName: actorTeam === undefined ? '' : series.teams[actorTeam].name } : {};
        beats.push({ id: `${round.map}-r${round.number}-${category}-${beats.length}`, at, category, priority, eventIds: [...new Set(refs.map(e => e.id))], candidates, facts: { ...common, ...identities, ...facts }, fallback, emphasis });
    };
    const variant=(key:string,options:string[])=>options[hash(`${series.id}|${round.map}|${round.number}|${key}`)%options.length];
    const tactics = events.filter(e => e.kind === 'tactic' && e.at === 0), tactic = getTactic(round.decisions[t].tactic), ctTactic = getTactic(round.decisions[ct].tactic);
    const pistol = round.number === 1 || round.number === 13;
    const runTeam=previous.at(-1)?.winner;let streak=0;
    if(runTeam!==undefined)for(const old of previous.slice().reverse()){if(old.winner!==runTeam)break;streak++;}
    const ordinaryFamily=Math.min(...startScore)>=8&&Math.abs(startScore[0]-startScore[1])<=1?['context-close']:streak>=3?['context-run','context-pressure']:['context-round'];
    const ordinaryIds=round.plans?ordinaryFamily.flatMap(family=>originalTemplatesByFamily.get(family)??[]):['WJ-008', 'WJ-009'];
    const openerIds = round.number === 1 ? ['C001', 'C002', 'WJ-001', 'WJ-004'] : round.number === 13 ? ['WJ-172'] : round.number === 25 ? ['C168'] : ordinaryIds;
    add('setup', 0, 100, tactics, openerIds, `${map.name}，${team(t)}进攻，${team(ct)}防守。${roundContext}`, round.plans?{roundContext,STREAK:streak,RUNNER:runTeam===undefined?'':team(runTeam),CHASE:runTeam===undefined?'':team(1-runTeam)}:{});
    const planText=round.plans?variant('plan-facts',[
        `${team(t)}选择${tactic.name}，${team(ct)}这边是${ctTactic.name}。`,
        `这一分${team(t)}选择${tactic.name}，防守方${team(ct)}选择${ctTactic.name}。`,
        `进攻方${team(t)}的计划是${tactic.name}，另一边${team(ct)}选择${ctTactic.name}。`
    ]):`${team(t)}选择${tactic.name}，${team(ct)}用${ctTactic.name}应对。`;
    add('plan', 0, 90, tactics, [], planText);
    for (const timeout of events.filter(e => e.kind === 'coachTimeout')) {
        const change = timeout.detail.kind === 'belief' ? '稳住节奏' : timeout.detail.kind === 'economy' ? '统一购买预算' : '调整重点区域';
        const state=series.mapStates.find(state=>state.map===round.map);
        const remaining=state?Math.max(0,timeoutLimit({...state,rounds:state.rounds.filter(previous=>previous.number<round.number)})-state.timeoutHistory.filter(record=>record.round<=round.number&&record.team===timeout.team).length):undefined;
        const timeoutText=round.plans?variant('timeout-'+timeout.team,[`${team(timeout.team!)}叫了暂停，这次希望${change}。`,`暂停过后，${team(timeout.team!)}准备${change}。`,`${team(timeout.team!)}用一个暂停来${change}，接着看这一分。`]):`${team(timeout.team!)}刚刚暂停，下一步重点是${timeout.detail.kind === 'belief' ? '缩小临场波动' : timeout.detail.kind === 'economy' ? '统一起枪预算' : '重新分配重点区域'}；效果还要看这一回合实际执行。`;
        add('timeout', 0, 91, [timeout], [], timeoutText, round.plans ? { 暂停队: series.teams[timeout.team!].name,timeoutFocus:change,timeoutNumber:state?.timeoutHistory.filter(record=>record.round<=round.number&&record.team===timeout.team).length??0,...(remaining!==undefined?{remainingTimeouts:remaining}:{}) } : {});
    }
    const strength = (index: number) => round.economy.filter(e => round.initial.find(f => f.id === e.playerId)!.team === index).reduce((sum, e) => sum + WEAPONS[e.loadout.weapon].price + e.loadout.armor * 6.5 + (e.loadout.helmet ? 350 : 0), 0);
    const values = [strength(0), strength(1)];
    const weak = values[0] < values[1] ? 0 : 1, strong = 1 - weak;
    if (values[strong] > values[weak] * 1.8 && values[strong] - values[weak] > 5000) {
        const eco = round.decisions[weak].buy === 'eco';
        const gear=round.initial.filter(f=>f.team===weak).map(f=>f.equipment),primary=gear.filter(e=>WEAPONS[e.weapon].category!=='pistol').length,utility=gear.reduce((n,e)=>n+e.utility.length,0);
        const primaryText=primary?`${primary}把主武器`:'没有主武器',utilityText=utility?`${utility}件道具`:'没有道具';
        const economyText=round.plans?variant('economy-facts',[
            `${team(weak)}装备落后，开局${primary?'有':''}${primaryText}，${utility?'带了':''}${utilityText}；${team(strong)}这边装备占优。`,
            `这分${team(weak)}的装备处于劣势，${primary?'只有':''}${primaryText}，${utility?'配了':''}${utilityText}，${team(strong)}买得更足。`,
            `${team(strong)}装备占优，${team(weak)}开局${primary?'只有':''}${primaryText}，${utility?'道具共'+utility+'件':'一件道具都没有'}。`
        ]):`${team(weak)}装备明显落后，得靠近点和补枪争取交换。`;
        add('economy', 0, 88, events.filter(e => e.kind === 'buy'), eco ? ['WJ-121', 'WJ-125'] : ['WJ-125'], economyText, { 经济劣势队: team(weak), 装备优势队: team(strong), ...(round.plans ? { weakTeam: weak } : {}) });
    }
    const kills = events.filter(e => e.kind === 'kill'), first = kills[0];
    let planted = false, firstRecorded = false, firstTrade = false;
    let clutchPlayer: string | null = null;
    let clutchSize = 0;
    let clutchStart: RoundEvent | null = null;
    let activeDefuse:RoundEvent|null=null;
    const eventIndex = new Map(events.map((e, i) => [e.id, i]));
    for (const e of events) {
        if(e.kind==='defuseStart')activeDefuse=e;
        if(e.kind==='defuseStop'&&activeDefuse&&e.causes.includes(activeDefuse.id))activeDefuse=null;
        if(round.plans&&e.kind==='duel'&&e.weapon==='AWP'&&e.detail.hit===false&&!events.slice(0,eventIndex.get(e.id)).some(x=>x.kind==='duel'&&x.actor===e.actor&&x.weapon==='AWP')&&!beats.some(b=>b.category==='awp-first-miss'))
            add('awp-first-miss',e.at,80,[e],[],`${nick(e.actor)}的AWP第一枪没有命中${nick(e.target)}。`,{},'tense');
        if(round.plans&&e.kind==='duel'&&e.weapon==='AWP'&&e.detail.hit===false&&!beats.some(b=>b.category==='awp-repeat-miss')){
            const prefix=events.slice(0,eventIndex.get(e.id));
            const earlier=prefix.filter(x=>x.kind==='duel'&&x.actor===e.actor&&x.weapon==='AWP'&&x.detail.hit===false&&x.at<e.at).reverse();
            for(const previous of earlier){
                const phase=prefix.slice(prefix.indexOf(previous)+1).filter(x=>x.kind==='tactic'&&x.team===e.team&&(!x.actor||x.actor===e.actor)&&['execution','regroup','retake','smoke'].includes(String(x.detail.rule))&&['executing','crossing','completed'].includes(String(x.detail.status))&&e.at-x.at<=5&&!prefix.slice(prefix.indexOf(x)+1).some(event=>event.kind==='plant')).at(-1);
                if(!phase)continue;
                add('awp-repeat-miss',e.at,72,[previous,phase,e],[],`${nick(e.actor)}的AWP再次没能命中，距上次空枪${e.at-previous.at}秒。`,{missInterval:e.at-previous.at},'tense');break;
            }
        }
        if(e.kind==='tactic'&&typeof e.detail.rule==='string'&&typeof e.detail.reason==='string'){
            let family=`phase-${e.detail.rule}-${e.detail.status}`;
            const causes=events.filter(cause=>e.causes.includes(cause.id));
            const death=causes.some(cause=>cause.kind==='kill'&&cause.target===e.actor);
            if(round.plans&&e.detail.status==='interrupted'){
                if(death)family='phase-interrupted-death';
                else if(e.detail.rule!=='smoke'||!causes.some(cause=>cause.kind==='smoke'))continue;
            }
            if(!round.plans){
                add('phase-'+e.detail.rule,e.at,e.detail.status==='waiting'?88:e.detail.status==='interrupted'?50:84,[e],[],`${e.actor?nick(e.actor):team(e.team!)}：${e.detail.reason}。`);
                continue;
            }
            const priorities:Record<string,number>={'phase-smoke-waiting':73,'phase-smoke-completed':82,'phase-smoke-crossing':80,'phase-smoke-interrupted':89,'phase-regroup-waiting':74,'phase-regroup-executing':83,'phase-execution-executing':84,'phase-utility-waiting':68,'phase-utility-released':81,'phase-rotation-held':66,'phase-retake-executing':86,'phase-clear-waiting':91,'phase-clear-completed':97,'phase-interrupted-death':50};
            const person=e.actor?nick(e.actor):team(e.team!),squad=team(e.team!),zone=e.zone?getZone(map,e.zone).name:'前面';
            const descriptions:Record<string,string>={
                'phase-smoke-waiting':`${person}还在等${zone}的烟。`,'phase-smoke-completed':`这条路可以接着走，${person}往${zone}靠。`,
                'phase-smoke-crossing':`${person}要顶着烟往${zone}走。`,'phase-smoke-interrupted':`${person}没时间等烟了。`,
                'phase-regroup-waiting':`${squad}还在等队友集合。`,'phase-regroup-executing':`${squad}不再等集合，要动了。`,
                'phase-execution-executing':`${squad}开始往${zone}进攻。`,'phase-utility-waiting':`${person}先把道具留着。`,
                'phase-utility-released':`${person}可以把道具交出来了。`,'phase-rotation-held':`${squad}选择先留守。`,
                'phase-retake-executing':`${person}还要回防${zone}。`,'phase-clear-waiting':`${person}先清人，再考虑拆包。`,
                'phase-clear-completed':`${person}这边对手没了，可以拆。`,'phase-interrupted-death':`${person}被带走，刚才这一步没能继续。`
            };
            if(round.plans&&!descriptions[family])continue;
            add('phase-'+e.detail.rule,e.at,round.plans?priorities[family]:e.detail.status==='waiting'?88:e.detail.status==='interrupted'?50:84,[e],round.plans?(originalTemplatesByFamily.get(family)??[]):[],round.plans?descriptions[family]:`${person}：${e.detail.reason}。`,round.plans?{P:person,TEAM:squad,ZONE:zone,phaseRule:e.detail.rule,phaseStatus:String(e.detail.status),phaseTeam:e.team!,phaseFamily:family,phaseActor:e.actor??''}:{});
        }
        if (e.kind === 'kill') {
            if(round.plans&&activeDefuse&&e.team===t&&round.initial.find(f=>f.id===e.target)?.team===ct){
                const plant=events.find(x=>activeDefuse!.causes.includes(x.id)&&x.kind==='plant');
                if(plant){
                    const killedDefuser=e.target===activeDefuse.actor;
                    const beforeStart=events.slice(0,eventIndex.get(activeDefuse.id)),previousStart=beforeStart.filter(x=>x.kind==='defuseStart').at(-1);
                    const handoff=Boolean(previousStart&&previousStart.actor!==activeDefuse.actor&&beforeStart.some(x=>x.kind==='defuseStop'&&x.causes.includes(previousStart.id)));
                    const liveAction=handoff?'已经接手拆包':'正在拆包';
                    add(killedDefuser?'defuse-killed':'defuse-cover-kill',e.at,88,[plant,activeDefuse,e],[],killedDefuser?`${nick(e.target)}拆包时被${nick(e.actor)}击杀。`:`${nick(e.actor)}击杀${nick(e.target)}，${nick(activeDefuse.actor)}${liveAction}。`,{remaining:Number(plant.detail.explodeAt)-e.at,defuserId:activeDefuse.actor??'',defuseHandoff:handoff?1:0},'tense');
                    if(killedDefuser)activeDefuse=null;
                }
            }
            const before = [0, 1].map(team => round.initial.filter(f => f.team === team && aliveIds.has(f.id)).length);
            aliveIds.delete(e.target!);
            const a = e.alive!;
            if (!firstRecorded) {
                firstRecorded = true;
                const zone=getZone(map,e.zone!).name,weapon=e.weapon==='fire'?'燃烧弹':e.weapon==='HE'?'手雷':e.weapon,opening=round.plans?variant('opening-facts',[
                    `首杀出现在${zone}！${nick(e.actor)}用${weapon}拿下${nick(e.target)}，场上变成${a[t]}打${a[ct]}。`,
                    `${nick(e.actor)}在${zone}用${weapon}拿下${nick(e.target)}，首杀之后是${a[t]}打${a[ct]}。`,
                    `${zone}这边先掉人，${nick(e.actor)}用${weapon}拿下${nick(e.target)}，人数变成${a[t]}打${a[ct]}。`
                ]):`${zone}先交火！${nick(e.actor)}用${e.weapon}拿下${nick(e.target)}，场上变成${a[t]}打${a[ct]}。`;
                add('opening', e.at, 95, [e], pistol ? ['WJ-016'] : [], opening, { 选手A: nick(e.actor) }, 'tense');
            }
            if (a[t] === 3 && a[ct] === 5)
                add('disadvantage', e.at, 67, [e], ['C075', 'WJ-076'], `${team(t)}现在三打五，原定的推进要重新掂量。`, {}, 'tense');
            if (a[t] === 3 && a[ct] === 3 && !planted && e.at < 60)
                add('even', e.at, 60, [e], ['C017'], '三打三，包还没下，双方都还有调整的时间。');
            if (a[t] === 2 && a[ct] === 2)
                add('two-v-two', e.at, 65, [e], ['WJ-084'], '双方剩下二打二，局面又回到均势。', {}, 'tense');
            if(round.plans&&a[t]===1&&a[ct]===1)
                add('one-v-one',e.at,70,[e],[],`最后一打一，${nick(round.initial.find(f=>f.team===t&&aliveIds.has(f.id))!.id)}对${nick(round.initial.find(f=>f.team===ct&&aliveIds.has(f.id))!.id)}。`,{},'tense');
            if (a[t] === 4 && a[ct] === 3 && !planted)
                add('four-v-three', e.at, 72, [e], [], `${team(t)}四打三，人数优势已经到手。`);
            if (a[t] === 5 && a[ct] === 3 && !planted)
                add('five-v-three', e.at, 72, [e], [], `${team(t)}五打三，保住人数优势还有推进空间。`);
            const winnerSide = round.initial.find(f => f.id === e.actor)!.side;
            const priorPickups = events.slice(0, eventIndex.get(e.id)).filter(x => x.kind === 'pickup' && x.actor === e.target && x.weapon);
            const weaponVictim = priorPickups.at(-1)?.weapon ?? round.economy.find(b => b.playerId === e.target)?.loadout.weapon;
            if (weaponVictim === 'AWP' && WEAPONS[e.weapon ?? '']?.category === 'rifle')
                add('rifle-v-awp', e.at, 78, [e], ['C122'], round.plans?`${nick(e.actor)}用${e.weapon}打掉${nick(e.target)}手里的AWP！`:`${nick(e.actor)}用步枪打掉了狙击手！`, { Q: nick(e.actor) }, 'hype');
            if (e.weapon === 'AWP' && e.id === first?.id && winnerSide === 'CT')
                add('awp-opening', e.at, 96, [e], ['WJ-109'], round.plans ? `${nick(e.actor)}用AWP拿下${nick(e.target)}，防守方收下首杀，场上变成${a[t]}打${a[ct]}。` : `${nick(e.actor)}的 AWP 先响，防守方收下首杀。`, { 选手A: nick(e.actor) }, 'tense');
            if (round.plans && e.weapon === 'AWP' && weaponVictim === 'AWP')
                add('awp-duel', e.at, 79, [e], [], `${nick(e.actor)}在对狙中击杀了${nick(e.target)}。`, {}, 'tense');
            if(round.plans&&e.weapon==='AWP'&&e.zone===map.ctSpawn){
                const previous=events.slice(0,eventIndex.get(e.id)).filter(x=>x.kind==='kill'&&x.actor===e.actor&&x.weapon==='AWP');
                if(previous.length===1&&!beats.some(b=>b.category==='awp-followup'))add('awp-followup',e.at,85,[previous[0],e],[],`${nick(e.actor)}又用AWP击杀了${nick(e.target)}，这次目标在警家。`,{},'tense');
            }
            const damage = events.find(x => e.causes.includes(x.id) && x.kind === 'damage');
            const duel = damage && events.find(x => damage.causes.includes(x.id) && x.kind === 'duel');
            if (round.plans && e.weapon === 'HE' && damage && !beats.some(b => b.category === 'grenade'))
                add('grenade', e.at, 81, [...events.filter(x => damage.causes.includes(x.id)), damage, e], [], `${nick(e.actor)}的手雷直接带走${nick(e.target)}。`);
            if (round.plans && e.weapon === 'fire' && damage && !beats.some(b => b.category === 'fire-kill'))
                add('fire-kill', e.at, 81, [...events.filter(x => damage.causes.includes(x.id)), damage, e], [], `${nick(e.actor)}的火烧掉了${nick(e.target)}，位置在${getZone(map,e.zone!).name}。`);
            if (duel?.detail.headshot === true && !beats.some(b => b.category === 'headshot')) {
                add('headshot', e.at, 82, [duel, damage!, e], [], `${nick(e.actor)}爆头带走${nick(e.target)}！`, {}, 'hype');
                const opening = beats.find(b => b.category === 'opening' && b.eventIds.includes(e.id));
                if (opening && round.plans) opening.fallback = opening.fallback.replace('拿下', '爆头拿下');
                const awpOpening = beats.find(b => b.category === 'awp-opening' && b.eventIds.includes(e.id));
                if (awpOpening && round.plans) awpOpening.fallback = awpOpening.fallback.replace('拿下', '爆头拿下');
            }
            const flash = events.slice(0, eventIndex.get(e.id)).reverse().find(x => x.kind === 'blind' && x.target === e.target && x.actor !== e.actor && Number(x.detail.until) >= e.at);
            if (flash && (!round.plans || (WEAPONS[e.weapon ?? ''] && !['HE','fire'].includes(e.weapon!))) && !beats.some(b => b.category === 'flash-conversion'))
                add('flash-conversion', e.at, 94, [flash, ...events.filter(x => flash.causes.includes(x.id)), e], [], round.plans?`闪给到了！第一时间${nick(flash.actor)}把${nick(e.target)}闪白，${nick(e.actor)}第二时间用${e.weapon}完成击杀。`:`闪给到了！${nick(flash.actor)}先把${nick(e.target)}闪白，${nick(e.actor)}第二时间接上击杀。`, {}, 'tense');
            if (duel && Number(duel.detail.smoke) < 1)
                add('smoke-kill', e.at, 83, [duel, damage!, e], ['WJ-116'], round.plans?`${nick(e.actor)}隔着烟用${e.weapon}拿下${nick(e.target)}！`:`${nick(e.actor)}隔着烟带走了对手，这一枪穿得漂亮！`, { 选手A: nick(e.actor) }, 'hype');
            for (const index of [0, 1] as const) {
                const opponents = 1 - index;
                if (a[index] === 1 && a[opponents] >= 2 && before[index] > 1 && !clutchPlayer) {
                    clutchPlayer = round.initial.find(f => f.team === index && aliveIds.has(f.id))!.id;
                    clutchSize = a[opponents];
                    clutchStart = e;
                    add('clutch-start', e.at, 76, [e], clutchSize === 2 ? ['WJ-097'] : clutchSize === 3 ? ['C101'] : [], `只剩${nick(clutchPlayer)}，一打${clutchSize}。${round.plans?'':'先拆成单独交锋，才有继续打下去的机会。'}`, { P: nick(clutchPlayer), 选手A: nick(clutchPlayer), clutchId: clutchPlayer, clutchSize, ...(round.plans ? { actorName: series.players.find(p => p.id === clutchPlayer)!.nickname } : {}) }, 'tense');
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
            const utilityTrade=round.plans&&last&&['HE','fire'].includes(last.weapon??'');
            const tradeText=utilityTrade?`${nick(e.actor)}${delay?`隔${delay}秒`:'马上'}用${last!.weapon==='fire'?'燃烧弹':'手雷'}换掉${nick(last!.target)}，${last!.alive?`场上是${last!.alive[t]}打${last!.alive[ct]}`:'人数差距被缩小'}。`:round.plans&&last?.target?`${nick(e.actor)}${delay?`只隔${delay}秒就`:'马上'}补掉${nick(last.target)}，${last.alive?`场上是${last.alive[t]}打${last.alive[ct]}`:'人数差距被缩小'}。`:`${nick(e.actor)}${delay ? `只隔${delay}秒就` : '马上'}把枪补上，${last?.alive ? `场上是${last.alive[t]}打${last.alive[ct]}` : '人数差距被缩小'}。`;
            add(utilityTrade?'utility-trade':'trade', e.at, 96, refs, utilityTrade?[]:candidates, tradeText, {}, 'tense');
        }
        if (e.kind === 'blind' && !beats.some(b => b.category === 'flash')) {
            const thrower = round.initial.find(f => f.id === e.actor)!;
            add('flash', e.at, 58, [e, ...events.filter(x => e.causes.includes(x.id))], thrower.team === t ? ['WJ-038'] : [], `${nick(e.target)}在${getZone(map, e.zone!).name}被闪白，视野短暂丢失。`, { 进攻点: getZone(map, e.zone!).name });
        }
        if (e.kind === 'smoke' && !beats.some(b => b.category === 'smoke'))
            add('smoke', e.at, 47, [e], ['WJ-037'], `${getZone(map, e.zone!).name}烟雾升起，隔烟交火的命中会受到压制。`);
        if (e.kind === 'extinguish' && !beats.some(b => b.category === 'extinguish'))
            add('extinguish', e.at, 87, [e, ...events.filter(x => e.causes.includes(x.id))], [], `烟灭火！${nick(e.actor)}这颗烟把${getZone(map, e.zone!).name}的火扑掉了，火区压力先解开。`);
        if (e.kind === 'damage' && e.weapon === 'HE' && e.hpAfter! <= 35 && (!round.plans || e.hpAfter! > 0) && (!round.plans || !beats.some(b => b.category === 'grenade')))
            add('grenade', e.at, 66, [e, ...events.filter(x => e.causes.includes(x.id))], ['WJ-046'], `这颗雷把${nick(e.target)}炸到${e.hpAfter}血，后续交火容错更低了。`);
        if (e.kind === 'damage' && e.weapon === 'fire' && e.hpAfter! <= 35 && (!round.plans || e.hpAfter! > 0) && !beats.some(b => b.category === 'fire-damage'))
            add('fire-damage', e.at, 77, [e, ...events.filter(x => e.causes.includes(x.id))], [], `${nick(e.target)}被火焰逼到${e.hpAfter}血，再不离开火区就危险了。`);
        if(round.plans&&e.kind==='damage'&&e.hpAfter!>0&&e.hpAfter!<=35&&WEAPONS[e.weapon??'']&& !['HE','fire'].includes(e.weapon!)&&!beats.some(b=>b.category==='awp-hurt')){
            const gun=events.slice(0,eventIndex.get(e.id)).filter(x=>x.kind==='pickup'&&x.actor===e.target&&x.weapon).at(-1)?.weapon??round.initial.find(f=>f.id===e.target)?.equipment.weapon;
            if(gun==='AWP')add('awp-hurt',e.at,68,[...events.filter(x=>e.causes.includes(x.id)),e],[],`${nick(e.target)}手里这把AWP还在，但这一枪过后只剩${e.hpAfter}血。`,{},'tense');
        }
        if(round.plans&&e.kind==='damage'&&e.hpAfter!>0&&e.hpAfter!<=25&&WEAPONS[e.weapon??'']&&!['HE','fire'].includes(e.weapon!)&&!beats.some(b=>b.category==='gun-hurt')){
            const prefix=events.slice(0,eventIndex.get(e.id)),gun=prefix.filter(x=>x.kind==='pickup'&&x.actor===e.target&&x.weapon).at(-1)?.weapon??round.initial.find(f=>f.id===e.target)?.equipment.weapon;
            const shot=prefix.find(x=>e.causes.includes(x.id)&&x.kind==='duel'&&x.actor===e.actor&&x.target===e.target&&x.weapon===e.weapon);
            if(gun!=='AWP'&&shot){
                const description=variant('gun-hurt-facts',[
                    `${nick(e.actor)}用${e.weapon}把${nick(e.target)}打到${e.hpAfter}血，下一次交火的容错很低。`,
                    `${nick(e.target)}吃到${nick(e.actor)}的${e.weapon}，现在只剩${e.hpAfter}血。`,
                    `这一枪没有带走，${nick(e.target)}还剩${e.hpAfter}血；开枪的是${nick(e.actor)}，用的是${e.weapon}。`
                ]);
                add('gun-hurt',e.at,74,[shot,e],[],description,{},'tense');
            }
        }
        if (e.kind === 'info' && e.team === ct && e.detail.delay !== undefined) {
            const nextMove = events.slice((eventIndex.get(e.id) ?? 0) + 1).find(x => x.kind === 'move' && x.team === ct && x.at <= e.at + 2);
            if (nextMove && !beats.some(b => b.category === 'rotation'))
                add('rotation', nextMove.at, 64, [e, nextMove], [], `${team(ct)}收到${getZone(map, e.zone!).name}的情报，${nick(nextMove.actor)}开始支援；这段轮转得实实在在跑${nextMove.detail.travelSeconds}秒。`);
        }
        if (e.kind === 'pickup' && e.weapon && WEAPONS[e.weapon].category !== 'pistol') {
            const original = round.economy.find(b => b.playerId === e.actor)!.loadout.weapon;
            const trades=round.plans?events.slice(0,eventIndex.get(e.id)).filter(previous=>previous.kind==='trade'&&previous.actor===e.actor&&events.some(k=>k.kind==='kill'&&k.actor===e.actor&&Boolean(WEAPONS[k.weapon??''])&&!['HE','fire'].includes(k.weapon??'')&&previous.causes.includes(k.id)&&e.causes.includes(k.id))):[];
            const refs=[...events.filter(previous=>trades.some(trade=>trade.causes.includes(previous.id))),...trades,e];
            add('pickup', e.at, 73, refs, WEAPONS[original].category === 'pistol' ? ['WJ-124'] : [], `${nick(e.actor)}在${getZone(map, e.zone!).name}捡到${e.weapon}，这把枪留在手里了。`, { 选手A: nick(e.actor) });
        }
        if (e.kind === 'plant') {
            planted = true;
            const zone=getZone(map,e.zone!).name,plantText=round.plans?variant('plant-facts',[
                `${nick(e.actor)}把包下在${zone}，40秒倒计时开始。`,
                `${zone}的包落地，${nick(e.actor)}完成下包；距离爆炸还有40秒。`,
                `${nick(e.actor)}在${zone}下包成功，回防方现在有40秒时间。`
            ]):`${nick(e.actor)}把包下在${zone}，40 秒回防倒计时开始。`;
            add('plant', e.at, 92, [e], ['C091'], plantText, {}, 'tense');
        }
        if(round.plans&&e.kind==='defuseStart'&&!beats.some(b=>b.category==='defuse-start')){
            const plant=events.find(x=>e.causes.includes(x.id)&&x.kind==='plant');
            if(plant){
                const remaining=Number(plant.detail.explodeAt)-e.at,duration=Number(e.detail.duration),margin=remaining-duration;
                const clockNote=margin<=0?'按当前工具已经不够读满。':margin<=3?`读满只剩${margin}秒余量，还得看能不能坚持。`:'还得看能不能坚持读完。';
                add('defuse-start',e.at,93,[plant,e],[],`${nick(e.actor)}开始拆包，炸弹还剩${remaining}秒；${e.detail.kit?'有钳':'没钳'}需要${duration}秒。${clockNote}`,{remaining,duration,clockNote},'tense');
            }
        }
        if(round.plans&&e.kind==='defuseStop'&&!beats.some(b=>b.category==='defuse-stop')){
            const start=events.find(x=>e.causes.includes(x.id)&&x.kind==='defuseStart');
            const plant=start&&events.find(x=>start.causes.includes(x.id)&&x.kind==='plant');
            if(start&&plant)add('defuse-stop',e.at,91,[plant,start,e],[],`${nick(e.actor)}的拆包中断了，炸弹还剩${Number(plant.detail.explodeAt)-e.at}秒。`,{},'tense');
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
        const count=star[1].length,span=last.at-star[1][0].at;
        const highFacts=round.plans?[
            `${nick(star[0])}这一回合已经拿到${count}杀，他的第一杀到最后一杀相隔${span}秒。`,
            `${nick(star[0])}拿到${count}个击杀，这${count}杀横跨${span}秒。`,
            `${nick(star[0])}站出来了！从第一个到第${count}个击杀，经过了${span}秒。`
        ]:[];
        const highText=round.plans?highFacts[hash(`${series.id}|${round.map}|${round.number}|multikill-facts`)%highFacts.length]:`${nick(star[0])}！这一回合已经拿到${count}杀，关键枪线接连被他打穿。`;
        const lastTrade=round.plans?events.find(e=>e.kind==='trade'&&e.actor===star![0]&&e.causes.includes(last.id)&&e.at===last.at):undefined;
        add('multikill', last.at, 89, [...star[1],...(lastTrade?[lastTrade]:[])], [], highText, round.plans ? { actorName: series.players.find(p => p.id === star[0])!.nickname } : {}, 'hype');
    }
    const end = events.at(-1)!;
    const ending = round.reason === 'defuse' ? '拆掉了，回防成功' : round.reason === 'explode' ? '时间走完，炸弹爆炸' : round.reason === 'time' ? '时间到了，进攻方没能下包' : '对方全部倒下，这个回合结束';
    const other=1-round.winner;
    const scoreMoment=round.plans?(startScore[round.winner]<startScore[other]&&round.score[round.winner]===round.score[other]?'双方比分扳平。':startScore[round.winner]===startScore[other]&&startScore[0]+startScore[1]>=8?'这一分打破平局。':startScore[other]-startScore[round.winner]===2&&round.score[other]-round.score[round.winner]===1?'分差追到只剩一分。':''):'';
    const endRefs = [end, ...events.filter(e => ['defuse', 'explode', 'timerEnd'].includes(e.kind))];
    const finished=round.plans&&mapWinner(round.score)!==null;
    const mapIndex=series.maps.indexOf(round.map);
    const previousWins=series.mapStates.slice(0,Math.max(0,mapIndex)).filter(state=>state.winner===round.winner).length;
    let endTemplates: string[] = [];
    if (round.reason === 'time')
        endTemplates = [];
    else if (pistol && round.number === 1)
        endTemplates = ['WJ-023'];
    if (clutchPlayer && round.initial.find(f => f.id === clutchPlayer)!.team === round.winner && round.final.some(f => f.id === clutchPlayer && f.alive)) {
        const clutchKills=kills.filter(k=>k.actor===clutchPlayer&&events.indexOf(k)>events.indexOf(clutchStart!)).length;
        const clutchLead=round.plans?clutchKills>0?variant('clutch-win-facts',[
            `${nick(clutchPlayer)}把一打${clutchSize}拿下了，进入残局后打掉${clutchKills}人。`,
            `${nick(clutchPlayer)}接住一打${clutchSize}，残局阶段贡献${clutchKills}杀。`,
            `这一分给${nick(clutchPlayer)}顶住了：一打${clutchSize}，残局里拿到${clutchKills}个击杀。`
        ]):`${nick(clutchPlayer)}在一打${clutchSize}中存活到回合结束。`:`${nick(clutchPlayer)}把一打${clutchSize}拿下了！`;
        add('clutch-win', end.at, 99, [clutchStart!, ...kills.filter(k => k.actor === clutchPlayer), ...endRefs], ['WJ-106'], `${clutchLead}${round.reason==='time'?'他坚持到了时间耗尽，进攻方没能完成下包。':round.reason==='defuse'?'最后完成拆包，回防成功。':round.reason==='explode'?'最后守住了炸弹计时。':'最后一个对手也被解决了。'}`, { 选手A: nick(clutchPlayer), clutchSize, ...(round.plans ? { clutchId: clutchPlayer, actorName: series.players.find(p => p.id === clutchPlayer)!.nickname, actorTeamName: series.teams[round.winner].name } : {}) }, 'hype');
    }
    else if(round.plans&&clutchPlayer&&round.initial.find(f=>f.id===clutchPlayer)!.team!==round.winner){
        const postStart=events.slice(eventIndex.get(clutchStart!.id)!+1),player=round.initial.find(f=>f.id===clutchPlayer)!;
        const saved=round.final.some(f=>f.id===clutchPlayer&&f.alive)&&events.some(e=>e.kind==='save'&&e.actor===clutchPlayer&&e.detail.decision===true);
        const postClutchKills=postStart.filter(e=>e.kind==='kill'&&e.actor===clutchPlayer).length;
        if(postClutchKills>0&&!saved)add('clutch-loss',end.at,91,[clutchStart!,...postStart.filter(e=>e.kind==='kill'),...endRefs],[],`${nick(clutchPlayer)}已经打掉${postClutchKills}个，可这个一打${clutchSize}还是没能拿下来。`,{clutchId:clutchPlayer,clutchSize,postClutchKills,actorTeamName:series.teams[player.team].name});
    }
    if (round.winner === weak && values[strong] > values[weak] * 1.8 && values[strong] - values[weak] > 5000) {
        const smallGuns = round.economy.filter(b => round.initial.find(f => f.id === b.playerId)!.team === weak).every(b => WEAPONS[b.loadout.weapon].category === 'pistol');
        if (smallGuns && weak === t)
            endTemplates = ['C120'];
        add('eco-win', end.at, 94, endRefs, [], `${team(weak)}在装备明显落后的情况下拿下回合！`, {}, 'hype');
    }
    add('close', end.at, 100, endRefs, endTemplates, `${ending}。${team(round.winner)}拿下这一分，比分来到${round.score.join(':')}。${scoreMoment}`, { 比分: round.score.join(':'),...(round.plans?{scoreMoment}:{}) }, 'conclusion');
    if (round.number === 12)
        add('half-time', end.at, 92, [end], ['WJ-171'], `上半场结束，${round.score.join(':')}。换边之后重新进入手枪局。`, { 比分: round.score.join(':') }, 'conclusion');
    if (round.score[0] === 12 && round.score[1] === 12)
        add('overtime', end.at, 99, [end], ['C161', 'WJ-177'], '十二比十二，进入加时。', {}, 'hype');
    if (round.score[round.winner] === 12 && Math.min(...round.score) < 12) {
        if (Math.min(...round.score) === 11)
            add('overtime-threat', end.at, 97, [end], [], `十二比十一，下一分决定常规时间结束还是加时。`, {}, 'tense');
        else
            add('match-point', end.at, 94, [end], [], `${team(round.score[0] === 12 ? 0 : 1)}拿到常规时间赛点。`, round.plans ? { winStreak: series.mapStates.filter(m=>m.map===round.map).flatMap(m=>m.rounds).filter(r=>r.number<round.number).slice(-2).filter(r=>r.winner===round.winner).length === 2 ? 3 : 1 } : {}, 'tense');
    }
    if(round.plans){
        if(finished)add('map-win',end.at,100,[end],[],`${team(round.winner)}收下${map.name}这张图！${previousWins+1>series.bestOf/2?'系列赛也拿下了。':''}`,{seriesFinished:previousWins+1>series.bestOf/2?1:0});
        else{
            if(round.number>24&&mapPoint(round.score,round.winner)&&!mapPoint(startScore,round.winner))add('overtime-match-point',end.at,97,[end],['WJ-175'],`${team(round.winner)}拿到第${overtimeNumber}轮加时的地图赛点，再赢一分就收图。`,{领先队:team(round.winner),落后队:team(1-round.winner)});
            if(round.number>24&&round.score[0]===round.score[1]&&round.score[0]%3===0)add('overtime-repeat',end.at,99,[end],[],`${round.score.join(':')}，还没分出来！接着打，第${overtimeNumber+1}轮加时。`);
            if(round.number>24&&(round.number-24)%6===3)add('overtime-half',end.at,92,[end],[],`第${overtimeNumber}轮加时前半场结束，${round.score.join(':')}。接下来交换攻守。`);
            const previousLeader=1-round.winner;
            if(mapPoint(startScore,previousLeader)&&round.score[0]!==round.score[1])add('match-point-saved',end.at,95,[end],['WJ-176'],`${team(round.winner)}顶住了，${team(previousLeader)}这个赛点没能收掉。`,{领先队:team(previousLeader),落后队:team(round.winner),pointLeaderName:series.teams[previousLeader].name});
        }
    }
    return beats;
}
export function renderChineseCommentary(beats: CommentaryBeat[], round: RoundResult, series: Series): CommentarySegment[] {
    const high = beats.some(b => ['clutch-win','overtime','eco-win'].includes(b.category));
    const seenCategories = new Set<string>();
    const priority=(b:CommentaryBeat)=>round.plans&&b.category==='clutch-start'&&quoteCandidates(b,round).some(id=>['RF-3-3','RW-3-3','RW-12-6','RW-12-11'].includes(id))?91:b.priority;
    const ranked = beats.filter(b => !['setup', 'plan', 'close'].includes(b.category)).sort((a, b) => priority(b) - priority(a)).filter(b=>{const key=round.plans&&b.category.startsWith('phase-')?b.facts.phaseFamily==='phase-interrupted-death'?`phase-death:${b.facts.phaseActor}`:`${b.category}:${b.facts.phaseStatus}`:b.category;if(seenCategories.has(key))return false;seenCategories.add(key);return true;});
    const transitionKinds = ['half-time','overtime','overtime-threat','match-point','overtime-match-point','overtime-repeat','overtime-half','map-win','match-point-saved'];
    const transitions = round.plans ? ranked.filter(b=>transitionKinds.includes(b.category)) : [];
    // Cover different causes, not just the loudest kills. All segments retain event anchors.
    const distinct = ranked.filter(b => {
        if (!round.plans) return true;
        if(b.category==='even'&&quoteCandidates(b,round).includes('RD-2-17'))return true;
        if(b.category==='two-v-two'&&quoteCandidates(b,round).includes('RW-3-2'))return true;
        if(b.category==='phase-regroup'&&b.facts.phaseStatus==='executing'&&ranked.some(other=>other.category==='phase-execution'&&other.at===b.at&&other.facts.phaseTeam===b.facts.phaseTeam))return false;
        const narrators = b.category === 'opening' ? ['awp-opening'] : b.category === 'headshot' ? ['opening'] : ['two-v-two','even','four-v-three','five-v-three','disadvantage'].includes(b.category) ? ['opening','trade'] : [];
        return !ranked.some(other => narrators.includes(other.category) && other.eventIds.some(id => b.eventIds.includes(id) && round.events.find(e => e.id === id)?.kind === 'kill'));
    });
    // A kill may have several causes. Speak the action once and retain its other facts and anchors.
    // Trades narrate their final kill; their earlier victim remains context, not a second action.
    const actionKinds = ['opening','awp-opening','headshot','flash-conversion','smoke-kill','rifle-v-awp','awp-duel','grenade','trade',...(round.plans?['even','two-v-two','defuse-killed','defuse-cover-kill','awp-followup','fire-kill','utility-trade']:[])];
    const groups = new Map<string,CommentaryBeat[]>();
    const groupedIds = new Map<string,string[]>();
    const additionalFacts = new Map<string,{tag:string;text:string}[]>();
    const baseFallbacks=new Map<string,string>();
    const compact:CommentaryBeat[]=[];
    for(const beat of distinct){
        const kill = round.plans&&actionKinds.includes(beat.category) ? round.events.filter(e=>beat.eventIds.includes(e.id)&&e.kind==='kill').at(-1) : undefined;
        if(!kill){compact.push(beat);continue;}
        const group=groups.get(kill.id);
        if(group)group.push(beat);else{groups.set(kill.id,[beat]);compact.push({...beat});}
    }
    for(const group of groups.values()){
        const primary=compact.find(b=>b.id===group[0].id)!;
        const extras=group.slice(1),facts:{tag:string;text:string}[]=[];
        for(const beat of extras){
            if(beat.category==='flash-conversion'){
                const flash=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='blind')!;
                facts.push({tag:'flash',text:`第一时间是${commentaryPlayerName(series.players.find(p=>p.id===flash.actor)!)}这颗闪，先限制住了对手的视野。`});
            }
            if(beat.category==='rifle-v-awp')facts.push({tag:'awp-victim',text:'对面这把大狙也掉了。'});
            if(beat.category==='awp-duel')facts.push({tag:'awp-duel',text:'这一枪赢下了对狙。'});
            if(beat.category==='even'&&quoteCandidates(beat,round).includes('RD-2-17'))facts.push({tag:'mid',text:(/3打3|三打三/.test(primary.fallback)?'':'现在三打三，')+'中路这边已经没有防守队员了。'});
            if(beat.category==='defuse-killed')facts.push({tag:'defuse-killed',text:'被击杀的正是正在拆包的选手。'});
            if(beat.category==='defuse-cover-kill')facts.push({tag:'defuse-cover',text:`${commentaryPlayerName(series.players.find(p=>p.id===beat.facts.defuserId)!)}${beat.facts.defuseHandoff===1?'已经接手拆包':'正在拆包'}。`});
            if(beat.category==='fire-kill'&&!primary.fallback.includes('燃烧弹'))facts.push({tag:'fire',text:'这次击杀来自燃烧弹。'});
        }
        const smoke=extras.some(b=>b.category==='smoke-kill'),headshot=extras.some(b=>b.category==='headshot');
        if(smoke)facts.push({tag:'smoke',text:headshot?'隔着烟，还打了个爆头。':'这一枪是隔着烟打的。'});
        else if(headshot)facts.push({tag:'headshot',text:primary.category==='trade'?'补上的还是个爆头。':'还是个爆头。'});
        baseFallbacks.set(primary.id,primary.fallback);
        primary.fallback+=facts.length?' '+facts.map(f=>f.text).join(' '):'';
        additionalFacts.set(primary.id,facts);
        primary.eventIds=[...new Set(group.flatMap(b=>b.eventIds))];
        groupedIds.set(primary.id,group.map(b=>b.id));
    }
    const contextKinds=['trade','utility-trade','flash-conversion','extinguish','defuse-timing','defuse-start','defuse-stop','rotation','grenade','fire-damage','save-decision'];
    const context=compact.find(b=>contextKinds.includes(b.category)||(groupedIds.get(b.id)??[]).some(id=>contextKinds.includes(beats.find(beat=>beat.id===id)!.category)));
    const main:CommentaryBeat[]=[];
    for(const beat of compact){
        if(round.plans&&transitionKinds.includes(beat.category))continue;
        if(round.plans&&beat.category.startsWith('phase-')&&main.filter(other=>other.category.startsWith('phase-')).length>=(high?3:2))continue;
        main.push(beat);if(main.length>=(high?9:6)-transitions.length)break;
    }
    if (context && !main.includes(context))
        main[main.length - 1] = context;
    const anchorIndex=(b:CommentaryBeat)=>Math.max(...b.eventIds.map(id=>round.events.findIndex(e=>e.id===id)));
    const endOrder=(b:CommentaryBeat)=>b.category==='close'?1:transitionKinds.includes(b.category)?b.category==='half-time'?3:2:0;
    const selected = [...beats.filter(b => b.category === 'setup' || b.category === 'plan'), ...main, ...beats.filter(b => b.category === 'close'), ...transitions].sort((a, b) => a.at - b.at || (round.plans ? anchorIndex(a)-anchorIndex(b)||endOrder(a)-endOrder(b) : a.category === 'close' ? 1 : b.category === 'close' ? -1 : 0));
    const recent = new Set(series.mapStates.filter(m => m.map === round.map).flatMap(m => m.rounds).filter(r => r.number < round.number && r.number >= round.number - 5).flatMap(r => r.commentary.flatMap(s => [s.templateId,s.supportTemplateId])).filter(Boolean));
    const history = series.mapStates.filter(m => m.map === round.map).flatMap(m => m.rounds).filter(r => r.number < round.number);
    const emphatic = /卧槽|牛逼|无敌|太变态|太夸张/;
    const metaphor = round.plans ? /高压锅|一键扫荡|歼灭模式|游龙|包饺子|空城计|变速齿轮|融化|凡人挑战神明|杀戮机器/ : /高压锅|一键扫荡|歼灭模式|游龙|包饺子|空城计|变速齿轮/;
    const recentEmphasis = history.filter(r => r.number >= round.number - 3).some(r => r.commentary.some(s => emphatic.test(s.text)));
    const recentMetaphor = history.filter(r => r.number >= round.number - 10).some(r => r.commentary.some(s => metaphor.test(s.text)));
    const result: CommentarySegment[] = [];
    const eventById = new Map(round.events.map(e => [e.id,e]));
    const briefBeats = new Set((round.plans ? main : ranked).slice(0, round.plans?Math.max(0,3-transitions.length):3).map(b => b.id));
    const recentText = history.filter(r => r.number >= round.number - 5).flatMap(r => r.commentary.map(s => s.text));
    const wording = (beat:CommentaryBeat, variants:string[]) => {
        const available = round.plans ? variants.filter(text => !recentText.some(previous => previous.includes(text))) : variants;
        return available.length ? available[hash(`${series.seed}|${round.number}|${beat.category}|detail`)%available.length] : '';
    };
    const detailFor = (beat: CommentaryBeat) => {
        const refs = beat.eventIds.map(id => eventById.get(id)!).filter(Boolean);
        const kill = refs.find(e => e.kind === 'kill');
        const nick = (id?:string) => commentaryPlayerName(series.players.find(p => p.id===id) ?? '选手');
        if(beat.category==='setup') return `当前比分${round.score.map((v,i)=>v-(i===round.winner?1:0)).join('比')}。`;
        if(beat.category==='plan') return '';
        if(beat.category==='opening' && kill) return round.plans?'':`首杀出现在${kill.at}秒。${nick(kill.target)}这一侧少了一个交火点，接下来是立刻补枪，还是先稳住重新组织，要看队友的位置。`;
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
        if(round.plans&&beat.category==='defuse-stop'){
            const start=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='defuseStart');
            const alreadyExplained=start&&result.some(line=>line.sourceBeatIds?.some(id=>beats.some(b=>b.id===id&&b.category==='defuse-killed'&&b.eventIds.includes(start.id))));
            if(alreadyExplained)continue;
        }
        const intensityFits = (text: string) => {
            const highMoment = ['multikill', 'clutch-win', 'eco-win'].includes(beat.category);
            if (emphatic.test(text) && (!highMoment || recentEmphasis || result.some(s => emphatic.test(s.text))))
                return false;
            if (metaphor.test(text) && (!highMoment || recentMetaphor || result.some(s => metaphor.test(s.text))))
                return false;
            return true;
        };
        const quoteIds=[...new Set([...quoteCandidates(beat,round),...(groupedIds.get(beat.id)??[]).filter(id=>id!==beat.id).flatMap(id=>quoteCandidates(beats.find(other=>other.id===id)!,round))])];
        const quotes = quoteIds.map(id => realQuoteCatalog.get(id)!).filter(q => !(round.plans&&beat.category==='close'&&transitions.some(b=>b.category==='match-point-saved')&&['RQ-7-8','RQ-7-33'].includes(q.id)) && !result.some(s => s.templateId===q.id) && !recent.has(q.id) && intensityFits(q.text));
        const all = beat.candidates.map(id => commentaryCatalog.get(id)).filter((t): t is {
            id: string;
            text: string;
        } => Boolean(t) && !result.some(s=>s.templateId===t!.id||s.supportTemplateId===t!.id) && intensityFits(t!.text));
        const fresh = all.filter(t => !recent.has(t.id));
        const candidates = quotes.length ? quotes : fresh.length || round.plans ? fresh : all;
        const version = round.plans ? COMMENTARY_VERSION : 'causal-story-6';
        const template = candidates.length ? candidates[hash(`${series.id}|${round.map}|${round.number}|${version}|${beat.category}`) % candidates.length] : undefined;
        const repeatedResolution = round.plans && beat.category === 'close' && result.some(s => s.sourceBeatIds?.some(id => beats.some(b => b.id === id && ['defuse-timing','clutch-win'].includes(b.category))));
        const repeatedDefuse=round.plans&&beat.category==='clutch-win'&&result.some(s=>s.sourceBeatIds?.some(id=>beats.some(b=>b.id===id&&b.category==='defuse-timing')));
        const fallback = repeatedResolution ? `${commentaryTeamName(series.teams[round.winner])}拿下这一分，比分来到${round.score.join(':')}。${beat.facts.scoreMoment??''}` : repeatedDefuse ? beat.fallback.replace('最后完成拆包，回防成功。','') : beat.fallback;
        let text = template?.text.replace(/\{([^{}]+)\}/g, (_, key: string) => String(beat.facts[key] ?? `{${key}}`)) ?? fallback;
        if (/\{[^{}]+\}/.test(text))
            text = beat.fallback;
        const quote = template && realQuoteCatalog.get(template.id);
        const phaseCovered=quote&&['RB-9-24','RW-6-3','RW-9-12','RD-9-20'].includes(quote.id);
        const support = quote && round.plans && beat.category.startsWith('phase-') && fresh.length && !phaseCovered ? fresh[hash(`${series.id}|${round.map}|${round.number}|${beat.id}|support`) % fresh.length] : undefined;
        const supportingFacts = support?.text.replace(/\{([^{}]+)\}/g,(_,key:string)=>String(beat.facts[key]??`{${key}}`));
        let quoteFallback=fallback;
        if(quote&&round.plans&&baseFallbacks.has(beat.id)){
            // Only reviewed, explicit semantic coverage suppresses a redundant generic supplement.
            // The immutable quote and all named kill facts, anchors and brief facts remain intact.
            const covered=quote.id==='RF-6-7'?['smoke']:quote.id==='RD-2-17'?['mid']:quote.id==='RD-8-4'?['defuse-killed']:['RB-12-42','RF-2-3'].includes(quote.id)?['awp-victim']:[];
            const saysHeadshot=['RD-4-10','RD-4-11','RD-4-9','RF-12-7','RF-12-14','RQ-2-15','RQ-2-25','RB-12-42'].includes(quote.id);
            const facts=(additionalFacts.get(beat.id)??[]).flatMap(f=>{
                if(covered.includes(f.tag))return f.tag==='smoke'&&f.text.includes('爆头')&&!saysHeadshot?[{tag:'headshot',text:'还是个爆头。'}]:[];
                if(saysHeadshot&&f.tag==='headshot')return [];
                if(saysHeadshot&&f.tag==='smoke'&&f.text.includes('爆头'))return [{tag:'smoke',text:'这一枪是隔着烟打的。'}];
                return [f];
            });
            const hit=round.events.filter(e=>beat.eventIds.includes(e.id)&&e.kind==='kill').at(-1);
            let base=quote.id==='RF-6-7'&&beat.category==='smoke-kill'&&hit?`${commentaryPlayerName(series.players.find(p=>p.id===hit.actor)!)}拿下${commentaryPlayerName(series.players.find(p=>p.id===hit.target)!)}。`:baseFallbacks.get(beat.id)!;
            if(saysHeadshot)base=base.replace('爆头拿下','拿下').replace('爆头带走','带走');
            quoteFallback=base+(facts.length?' '+facts.map(f=>f.text).join(' '):'');
        }
        if(quote?.id==='RD-2-17')quoteFallback=beat.category==='even'?'包还没下。':quoteFallback.replace('，场上是3打3。','。');
        if(quote&&phaseCovered){
            const phase=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='tactic'&&typeof e.detail.rule==='string');
            if(phase){
                const prefix=round.events.slice(0,round.events.indexOf(phase)+1),living=round.initial.filter(f=>f.team===phase.team&&!prefix.some(e=>e.kind==='kill'&&e.target===f.id)).length;
                const squad=commentaryTeamName(series.teams[phase.team!]),zone=phase.zone?getZone(getMap(round.map),phase.zone).name:'目标区域';
                quoteFallback=quote.id==='RD-9-20'?`目标是${zone}。`:quote.id==='RB-9-24'?`${squad}这次目标是${zone}，还有${living}人。`:`${squad}此时还有${living}人。`;
            }
        }
        if(quote&&beat.category==='timeout'&&beat.facts.timeoutFocus)quoteFallback=`${commentaryTeamName(series.teams[Number(round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='coachTimeout')!.team)])}这次希望${beat.facts.timeoutFocus}。`;
        if(quote?.id==='RD-8-4'&&beat.category==='defuse-killed'){
            const kill=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='kill');
            if(kill)quoteFallback=`击杀记在${commentaryPlayerName(series.players.find(p=>p.id===kill.actor)!)}名下，炸弹还剩${beat.facts.remaining}秒。`;
        }
        if(quote?.id==='RW-3-2')quoteFallback=beat.category==='two-v-two'?'看寒王和队友怎么处理。':quoteFallback.replace(/，场上(?:是|变成)2打2。/,'。');
        if(quote?.id==='RF-3-15'){
            const anchor=Math.max(...beat.eventIds.map(id=>round.events.findIndex(e=>e.id===id))),plant=round.events.slice(0,anchor+1).find(e=>e.kind==='plant');
            quoteFallback=beat.category==='two-v-two'?(plant?`包在${getZone(getMap(round.map),plant.zone!).name}。`:'包还没下。'):quoteFallback.replace(/，场上(?:是|变成)2打2。/,'。');
        }
        if(quote?.id==='RF-2-16')quoteFallback=quoteFallback.replace(/，场上是(?:2打1|1打2)。/,'。');
        if(quote&&beat.category==='trade'&&['RF-2-15','RF-2-11','RF-2-9','RD-2-6','RD-2-13','RD-2-14','RF-2-14','RQ-2-33'].includes(quote.id)){
            const ks=round.events.filter(e=>beat.eventIds.includes(e.id)&&e.kind==='kill'),last=ks.at(-1),first=ks[0];
            if(first&&last?.alive){const delay=last.at-first.at,t=round.sides[0]==='T'?0:1;quoteFallback=`${delay?`间隔${delay}秒`:'马上接上'}，击杀的是${commentaryPlayerName(series.players.find(p=>p.id===last.target)!)}，场上是${last.alive[t]}打${last.alive[1-t]}。`+(additionalFacts.get(beat.id)??[]).filter(f=>!(quote.id==='RF-2-14'&&f.tag==='flash')&&!(quote.id==='RD-2-14'&&f.tag==='awp-victim')).map(f=>' '+f.text).join('');}
        }
        if(quote?.id==='RD-6-6'&&beat.category==='grenade'){
            const kill=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='kill');
            if(kill)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===kill.actor)!)}投出这颗雷，${commentaryPlayerName(series.players.find(p=>p.id===kill.target)!)}倒下。`;
        }
        if(quote?.id==='RW-3-9')quoteFallback=`现在就看${commentaryPlayerName(series.players.find(p=>p.id===beat.facts.clutchId)!)}。`;
        if(quote&&beat.category==='clutch-start'&&['RB-3-30','RB-3-37','RQ-3-5'].includes(quote.id))quoteFallback=`现在就看${commentaryPlayerName(series.players.find(p=>p.id===beat.facts.clutchId)!)}。`;
        if(quote&&beat.category==='clutch-start'&&['RB-3-9','RF-3-9','RB-3-21','RF-3-16'].includes(quote.id))quoteFallback=`现在是一打${beat.facts.clutchSize}。`;
        if(quote?.id==='RQ-3-12')quoteFallback=`眼前是${commentaryPlayerName(series.players.find(p=>p.id===beat.facts.clutchId)!)}一打${beat.facts.clutchSize}。`;
        if(quote?.id==='RF-3-8')quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===beat.facts.clutchId)!)}一打${beat.facts.clutchSize}，最后以击杀结束回合。`;
        if(quote&&beat.category==='multikill'&&['RB-4-6','RB-4-13','RB-4-15','RB-4-16','RB-4-24','RD-4-1','RD-4-2','RD-4-3','RW-4-3','RW-4-4','RW-1-2','RF-4-1'].includes(quote.id)){
            const kills=round.events.filter(e=>beat.eventIds.includes(e.id)&&e.kind==='kill'),first=kills[0],last=kills.at(-1);
            if(first&&last)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===last.actor)!)}从第一杀到最后一杀相隔${last.at-first.at}秒。`;
        }
        if(quote?.id==='RF-6-14'){
            const e=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='extinguish');
            if(e)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===e.actor)!)}在${getZone(getMap(round.map),e.zone!).name}。`;
        }
        if(quote?.id==='RF-12-5'){
            const pickup=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='pickup');
            if(pickup)quoteFallback=`这把狙是在${getZone(getMap(round.map),pickup.zone!).name}捡到的。`;
        }
        if(quote?.id==='RB-12-42'&&beat.category==='rifle-v-awp'){
            const kill=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='kill');
            if(kill&&!additionalFacts.get(beat.id)?.length)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===kill.actor)!)}用${kill.weapon}拿下${commentaryPlayerName(series.players.find(p=>p.id===kill.target)!)}。`;
        }
        if(quote?.id==='RB-12-6'){
            const save=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='save');
            if(save)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===save.actor)!)}手里的是AWP。`;
        }
        if(quote?.id==='RF-8-5'){
            const start=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='defuseStart');
            if(start)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===start.actor)!)}${start.detail.kit?'有钳':'没钳'}，拆包需要${start.detail.duration}秒；炸弹还剩${beat.facts.remaining}秒。${beat.facts.clockNote??''}`;
        }
        if(quote?.id==='RD-12-3'){
            const shot=round.events.filter(e=>beat.eventIds.includes(e.id)&&e.kind==='duel').at(-1);
            if(shot)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===shot.actor)!)}两次出手相隔${beat.facts.missInterval}秒。`;
        }
        if(quote?.id==='RF-12-6'){
            const last=round.events.filter(e=>beat.eventIds.includes(e.id)&&e.kind==='kill').at(-1),shots=round.events.filter(e=>beat.eventIds.includes(e.id)&&e.kind==='kill'&&e.weapon==='AWP'&&e.actor===last?.actor);
            if(shots.length>=2&&last){
                const facts=(additionalFacts.get(beat.id)??[]).map(f=>' '+f.text).join('');
                quoteFallback=beat.category==='awp-followup'?`${commentaryPlayerName(series.players.find(p=>p.id===last.actor)!)}拿下${commentaryPlayerName(series.players.find(p=>p.id===last.target)!)}，两次击杀相隔${last.at-shots[0].at}秒。${facts}`:`${baseFallbacks.get(beat.id)??beat.fallback} 距离第一次相隔${last.at-shots[0].at}秒。${facts}`;
            }
        }
        if(quote?.id==='RW-8-7'){
            const d=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='defuse'),plant=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='plant');
            if(d&&plant)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===d.actor)!)}拆了${d.detail.duration}秒，离爆炸还剩${Number(plant.detail.explodeAt)-d.at}秒。`;
        }
        if(quote&&beat.category==='map-win'&&['RB-7-14','RB-7-20','RF-7-3'].includes(quote.id))quoteFallback=`${commentaryTeamName(series.teams[round.winner])}以${round.score[round.winner]}比${round.score[1-round.winner]}收下${getMap(round.map).name}。`;
        if(quote&&beat.category==='match-point')quoteFallback=`${commentaryTeamName(series.teams[round.winner])}以${round.score[round.winner]}比${round.score[1-round.winner]}领先，再拿一分就能收图。`;
        if(quote?.id==='RB-7-2'&&beat.category==='match-point-saved')quoteFallback=`${commentaryTeamName(series.teams[round.winner])}顶住了，比分来到${round.score.join(':')}。`;
        if(quote&&beat.category==='close'&&['RQ-8-26','RQ-8-29'].includes(quote.id)&&round.reason==='explode')quoteFallback=`炸弹爆炸，${commentaryTeamName(series.teams[round.winner])}拿下这一分，比分来到${round.score.join(':')}。${beat.facts.scoreMoment??''}`;
        if(quote?.id==='RD-3-7'){
            const anchor=Math.max(...beat.eventIds.map(id=>round.events.findIndex(e=>e.id===id)));
            const plant=round.events.slice(0,anchor+1).find(e=>e.kind==='plant');
            quoteFallback=plant?`包在${getZone(getMap(round.map),plant.zone!).name}。`:'包还没下。';
        }
        if(quote?.id==='RF-3-6')quoteFallback=quoteFallback.replace('最后一打一，','');
        if(quote?.id==='RW-12-13'){
            const hit=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='damage');
            if(hit)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===hit.target)!)}剩${hit.hpAfter}血。`;
        }
        if(quote&&beat.category==='awp-first-miss'){
            const shot=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='duel');
            if(shot)quoteFallback=`${commentaryPlayerName(series.players.find(p=>p.id===shot.actor)!)}对上${commentaryPlayerName(series.players.find(p=>p.id===shot.target)!)}。`;
        }
        if (quote)
            text = round.plans ? quote.text + ' ' + (supportingFacts&&!/\{[^{}]+\}/.test(supportingFacts)?supportingFacts:quoteFallback) : beat.fallback + ' ' + quote.text;
        else if (beat.category === 'close' && template)
            text += round.plans?` ${fallback}`:` ${commentaryTeamName(series.teams[round.winner])}拿下这一分，比分来到${round.score.join(':')}。`;
        if(round.plans&&!quote&&template?.id==='WJ-016'){
            const kill=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='kill');
            if(kill?.alive)text+=` 倒下的是${commentaryPlayerName(series.players.find(p=>p.id===kill.target)!)}，使用的是${kill.weapon==='fire'?'燃烧弹':kill.weapon==='HE'?'手雷':kill.weapon}，场上${kill.alive[round.sides[0]==='T'?0:1]}打${kill.alive[round.sides[0]==='CT'?0:1]}。`;
        }
        if(round.plans&&!quote&&template?.id==='WJ-116'){
            const kill=round.events.filter(e=>beat.eventIds.includes(e.id)&&e.kind==='kill').at(-1);
            if(kill)text+=` 倒下的是${commentaryPlayerName(series.players.find(p=>p.id===kill.target)!)}，这枪用的是${kill.weapon}。`;
        }
        if(round.plans&&!quote&&template?.id==='C122'){
            const kill=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='kill');
            if(kill)text+=` 倒下的是${commentaryPlayerName(series.players.find(p=>p.id===kill.target)!)}，这次用的是${kill.weapon}。`;
        }
        if(round.plans&&!quote&&template?.id==='C091'){
            const plant=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='plant');
            if(plant)text+=` 下包的是${commentaryPlayerName(series.players.find(p=>p.id===plant.actor)!)}，位置在${getZone(getMap(round.map),plant.zone!).name}，40秒倒计时开始。`;
        }
        if(round.plans&&!quote&&template?.id==='WJ-046'){
            const hit=round.events.find(e=>beat.eventIds.includes(e.id)&&e.kind==='damage'&&e.weapon==='HE');
            if(hit)text+=` ${commentaryPlayerName(series.players.find(p=>p.id===hit.target)!)}还剩${hit.hpAfter}血。`;
        }
        if(!quote&&template&&additionalFacts.get(beat.id)?.length)text+=' '+additionalFacts.get(beat.id)!.map(f=>f.text).join(' ');
        if(round.plans&&beat.category==='setup'&&template&&!quote&&beat.facts.roundContext)text+=' '+beat.facts.roundContext;
        const lastKill=round.plans&&beat.category==='close'&&round.reason==='elimination'?round.events.filter(e=>e.kind==='kill').at(-1):undefined;
        const missedLastKill=lastKill&&!result.some(line=>line.eventIds.includes(lastKill.id))?lastKill:undefined;
        const lastKillText=missedLastKill?`最后倒下的是${commentaryPlayerName(series.players.find(p=>p.id===missedLastKill.target)??'选手')}，击杀记在${commentaryPlayerName(series.players.find(p=>p.id===missedLastKill.actor)??'选手')}名下。`:'';
        if(lastKillText)text+=' '+lastKillText;
        text = formatCommentaryNames(text, series.players, series.teams);
        const briefFacts = round.plans&&beat.category.startsWith('phase-') ? supportingFacts??(!quote&&template?text:fallback) : fallback;
        const briefText = ['setup','close',...(round.plans?transitionKinds:[])].includes(beat.category) || briefBeats.has(beat.id) ? formatCommentaryNames(briefFacts+(lastKillText?' '+lastKillText:''),series.players,series.teams) : '';
        // A quote is followed by the anchored facts; avoid a third restatement of the same action.
        const detail=round.plans&&(quote||['C091','WJ-046'].includes(template?.id??'')||['rotation','plant','trade','flash-conversion'].includes(beat.category))?'':detailFor(beat);
        const explanation=round.plans&&detail&&recentText.some(text=>text.includes(detail))?'':detail;
        if(explanation) text += ' ' + explanation;
        const stage: CommentarySegment['stage'] = ['setup','plan','economy','timeout'].includes(beat.category)?'开局部署':['flash','flash-conversion','smoke','extinguish','grenade','fire-damage',...(round.plans?['phase-smoke','phase-utility']:[])].includes(beat.category)?'道具配合':['close','half-time','overtime','match-point','overtime-threat',...(round.plans?['clutch-loss',...transitionKinds]:[])].includes(beat.category)?'回合结算':['rotation','plant','clutch-start','save-decision','defuse-start','defuse-stop','defuse-timing',...(round.plans?['phase-regroup','phase-execution','phase-rotation','phase-retake','phase-clear']:[])].includes(beat.category)?'局势变化':'接触交锋';
        if (beat.category === 'plan' && result.length && (!quote || !round.plans)) {
            const previous = result.at(-1)!;
            previous.text += ' ' + text;
            previous.eventIds = [...new Set([...previous.eventIds, ...beat.eventIds])];
            previous.sourceBeatIds!.push(beat.id);
            continue;
        }
        result.push({ text, briefText, stage, at: beat.at, sourceType: quote ? (formatCommentaryNames(quote.text,series.players,series.teams)===quote.text?'quote':'adapted-quote') : template?'template':'original', eventIds: missedLastKill?[...new Set([...beat.eventIds,missedLastKill.id])].sort((a,b)=>round.events.findIndex(e=>e.id===a)-round.events.findIndex(e=>e.id===b)):beat.eventIds, emphasis: beat.emphasis, sourceBeatIds: groupedIds.get(beat.id)??[beat.id], ...(template ? { templateId: template.id } : {}), ...(support&&supportingFacts&&!/\{[^{}]+\}/.test(supportingFacts)?{supportTemplateId:support.id}:{}), ...(quote ? { quoteSource: quote.source } : {}) });
    }
    return result;
}
