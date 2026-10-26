import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {validateRound} from '../src/domain/invariants';
import type {RoundResult} from '../src/domain/types';
const series=createSeries(newWorld(),'team-3','team-7',3,224);autoVeto(series);simulateSeries(series);
const rounds=series.mapStates.flatMap(m=>m.rounds);
const sample=(predicate:(round:RoundResult)=>boolean)=>{const round=rounds.find(predicate);if(!round)throw new Error('测试场景缺失');return structuredClone(round);};

it('拒绝使用未持有枪械',()=>{const r=sample(r=>r.events.some(e=>e.kind==='duel'));r.events.find(e=>e.kind==='duel')!.weapon='impossible-gun';expect(validateRound(r)).toContain('使用未持有的枪械');});
it('拒绝未到行程结束时间就到位',()=>{const r=sample(r=>r.events.some(e=>e.kind==='move'));r.events.find(e=>e.kind==='move')!.detail.travelSeconds=1000;expect(validateRound(r)).toContain('到位事件缺少合法行程');});
it('拒绝无库存投掷物',()=>{const r=sample(r=>r.events.some(e=>e.kind==='smoke'));const thrown=r.events.find(e=>e.kind==='smoke')!;r.initial.find(f=>f.id===thrown.actor)!.equipment.utility=[];expect(validateRound(r)).toContain('使用了不存在的投掷物');});
it('拒绝凭空捡枪或把一把掉落领两次',()=>{const r=sample(r=>r.events.some(e=>e.kind==='pickup'&&e.weapon));const pickup=r.events.find(e=>e.kind==='pickup'&&e.weapon)!;pickup.causes=[];expect(validateRound(r)).toContain('拾取枪械缺少对应掉落');});
it('拒绝 roundEnd 后追加剧情事件',()=>{const r=sample(()=>true);r.events.push({...r.events.at(-1)!,id:'duplicate-ending'});expect(validateRound(r)).toContain('回合终止事件必须唯一且在最后');});
