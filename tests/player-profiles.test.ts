import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {refreshProfiles} from '../src/data/refreshProfiles';
import {createCareer} from '../src/domain/career';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {makeSave,validateSave} from '../src/domain/save';
const player=(name:string)=>newWorld().players.find(p=>p.nickname===name)!;
it('关键职责使用来源，不由席位顺序决定',()=>{
 expect(player('donk').role).toBe('Entry');expect(player('mezii').role).toBe('Anchor');expect(player('ropz').role).toBe('Lurker');expect(player('ZywOo').role).toBe('AWPer');
 expect(player('KSCERATO').role).toBe('Lurker');expect(player('xertioN').role).toBe('IGL');expect(player('Twistzz').role).toBe('IGL');
});
it('兼任狙击的步枪手不会成为队内主狙',()=>{expect(player('dumau').role).toBe('Rifler');expect(player('latto').role).toBe('Rifler');expect(player('try').role).toBe('AWPer');});
it('完整年度榜、统计范围、来源可追溯',()=>{
 const ranked=newWorld().players.filter(p=>p.profile?.ranking);expect(ranked).toHaveLength(20);
 expect(ranked.map(p=>p.profile!.ranking!.rank).sort((a,b)=>a-b)).toEqual(Array.from({length:20},(_,i)=>i+1));
 for(const p of ranked){expect(p.profile!.ranking!.year).toBe(2025);expect(p.profile!.metrics.length).toBeGreaterThan(0);for(const metric of p.profile!.metrics){expect(metric.scope).toBeTruthy();expect(metric.url).toMatch(/^https:\/\/www.hltv.org\/(news|player)\//);}}
 expect(player('donk').profile!.metrics.find(m=>m.key==='adr')!.value).toBe(97.1);
});
it('未知职责不虚构指挥或主狙，未量化能力保持基线',()=>{
 for(const p of newWorld().players.filter(p=>p.roleConfidence==='inferred'&&!p.profile?.ranking)){expect(p.role).toBe('Rifler');expect(p.attributes.aim).toBe(75);expect(p.profile!.basis).toBe('baseline');}
 expect(player('ZywOo').attributes.awp).toBeGreaterThan(player('mezii').attributes.awp);
 expect(player('donk').attributes.aim).toBeGreaterThan(player('apEX').attributes.aim);
});
it('升级旧生涯保留转会、玩家职责与已开打对局',()=>{
 const career=createCareer(newWorld(),'team-3',42),p=career.world.players.find(p=>p.nickname==='ZywOo')!;
 p.modelVersion='ctm-balance-1';p.attributes.awp=40;p.role='Support';p.roleConfidence='user-assigned';
 const match=createSeries(career.world,'team-3','team-7',1,7);autoVeto(match);resolveRound(match);
 const input=makeSave(career,match,null),before=JSON.stringify(input),result=refreshProfiles(input);
 expect(result.updated).toBe(1);expect(result.save.career!.world.players.find(row=>row.id===p.id)!.role).toBe('Support');
 expect(result.save.career!.world.players.find(row=>row.id===p.id)!.attributes.awp).toBe(player('ZywOo').attributes.awp);
 expect(JSON.stringify(result.save.match)).toBe(JSON.stringify(input.match));expect(JSON.stringify(input)).toBe(before);expect(refreshProfiles(result.save).updated).toBe(0);expect(()=>validateSave(result.save)).not.toThrow();
});
it('拒绝来源中的危险链接',()=>{const c=createCareer(newWorld(),'team-3',1);c.world.players.find(p=>p.profile?.ranking)!.profile!.ranking!.url='javascript:alert(1)';expect(()=>validateSave(makeSave(c,null,null))).toThrow('年度排名错误');});
