import {it,expect} from 'vitest';
import {commentaryPlayerName,commentaryTeamName,formatCommentaryNames} from '../src/domain/names';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
it.each([['ZywOo','载物（ZywOo）'],['m0NESY','小孩儿（m0NESY）'],['kyxsan','京介（kyxsan）'],['kyousuke','京芥（kyousuke）'],['huNter-','表哥（huNter-）'],['karrigan','大表哥（karrigan）'],['ropz','ropz'],['小夫','小夫']])('解说称呼 %s → %s',(name,expected)=>{expect(commentaryPlayerName(name)).toBe(expected);});
it('队伍绰号只使用给定映射',()=>{expect(commentaryTeamName('Vitality')).toBe('小蜜蜂');expect(commentaryTeamName('BETBOOM')).toBe('BB');expect(commentaryTeamName('Natus Vincere')).toBe('Natus Vincere');});
it('处理旧解说与备选称呼，职业名注释只出现一次',()=>{const players=[{nickname:'ZywOo'},{nickname:'torzsi'},{nickname:'karrigan'},{nickname:'huNter-'}],teams=[{name:'Vitality'}];const text='ZyWoo、载物、大番薯（ZywOo）与托子；大表哥、表哥，小蜜蜂。';const formatted=formatCommentaryNames(text,players,teams);expect(formatted).toBe('载物（ZywOo）、载物（ZywOo）、载物（ZywOo）与托神（torzsi）；大表哥（karrigan）、表哥（huNter-），小蜜蜂。');expect(formatCommentaryNames(formatted,players,teams)).toBe(formatted);});
it('解说映射不改选手名字、队名、阵容与原始数据',()=>{const world=newWorld(),before=world.players.map(p=>p.nickname),s=createSeries(world,'team-3','team-7',1,42);autoVeto(s);const names=s.players.map(p=>p.nickname),teams=s.teams.map(t=>t.name);const round=resolveRound(s);expect(round.commentary[0].text).toContain('小蜜蜂');expect(round.commentary[0].text).toContain('黑豹');expect(s.players.map(p=>p.nickname)).toEqual(names);expect(s.teams.map(t=>t.name)).toEqual(teams);expect(world.players.map(p=>p.nickname)).toEqual(before);});
