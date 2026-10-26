import {describe,it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {createCareer,startEvent,simulateCareerFixture} from '../src/domain/career';
import {makeSave,parseSave,validateSave} from '../src/domain/save';

const sample=()=>{const s=createSeries(newWorld(),'team-3','team-7',3,2026);autoVeto(s);resolveRound(s);return makeSave(null,s,null);};
describe('存档恢复边界',()=>{
 it('旧版迁移不修改历史或随机流',()=>{const a=sample();const old={...structuredClone(a),schemaVersion:1};const restored=validateSave(old);expect(restored.schemaVersion).toBe(2);expect(restored.match).toEqual(a.match);simulateSeries(restored.match!);simulateSeries(a.match!);expect(restored.match).toEqual(a.match);});
 it('空存档与禁选阶段都可恢复',()=>{expect(validateSave(makeSave(null,null,null)).match).toBeNull();expect(()=>validateSave(makeSave(null,createSeries(newWorld(),'team-3','team-7',1,4),null))).not.toThrow();});
 it('赛事开始后与结算中均可恢复',()=>{const c=createCareer(newWorld(),'team-3',42);startEvent(c,c.calendar[0].id);expect(()=>validateSave(makeSave(c,null,null))).not.toThrow();simulateCareerFixture(c,c.calendar[0].id);expect(()=>validateSave(makeSave(c,null,null))).not.toThrow();});
 it.each(['weapon','cash','hp','winner','score','attribute','seat','event','reference'] as const)('拒绝损坏数据：%s',kind=>{const s=sample(),m=s.match!,map=m.mapStates[0],r=map.rounds[0];switch(kind){case 'weapon':map.fighters[0].equipment.weapon='laser';break;case 'cash':map.fighters[0].cash=-1;break;case 'hp':map.fighters[0].hp=101;break;case 'winner':m.winner=1;break;case 'score':r.score=[99,0];break;case 'attribute':m.players[0].attributes.aim=999;break;case 'seat':m.teams[1].startingFive[0]=m.teams[0].startingFive[0];break;case 'event':r.events.find(e=>e.kind==='damage')!.damage=999;break;case 'reference':r.commentary[0].eventIds=['missing'];}expect(()=>validateSave(s)).toThrow();});
 it('失败导入不修改输入对象',()=>{const s=sample();s.match!.mapStates[0].score=[999,999];const before=JSON.stringify(s);expect(()=>validateSave(s)).toThrow();expect(JSON.stringify(s)).toBe(before);});
 it('拒绝攻守方与换边规则冲突',()=>{const s=sample();s.match!.mapStates[0].rounds[0].sides.reverse();expect(()=>validateSave(s)).toThrow('攻守方');});
 it('拒绝不合法的决赛配置及伪造赛果',()=>{const c=createCareer(newWorld(),'team-3',42),e=startEvent(c,c.calendar[0].id);simulateCareerFixture(c,e.id);const s=makeSave(c,null,null);s.career!.calendar[0].tournament!.fixtures[0].score=[0,0];expect(()=>validateSave(s)).toThrow('比分');const invalid=makeSave(c,null,null);invalid.career!.calendar[0].finalBestOf=1 as 3;expect(()=>validateSave(invalid)).toThrow('决赛');});
 it('拒绝危险字段、未来版本与错误 JSON',()=>{expect(()=>parseSave('{')).toThrow();const s=sample();expect(()=>validateSave({...s,schemaVersion:99})).toThrow();expect(()=>parseSave(JSON.stringify(s).replace('"schemaVersion":2','"__proto__":{},"schemaVersion":2'))).toThrow();});
});
