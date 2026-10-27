import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {realQuoteCatalog,quoteCandidates} from '../src/domain/realQuotes';
import {deriveCommentaryBeats,renderChineseCommentary} from '../src/domain/commentaryBeats';
it('用户语录完整保留且手枪局优先于原创模板',()=>{expect([...realQuoteCatalog.keys()].filter(id=>id.startsWith('RQ-'))).toHaveLength(364);const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);const r=resolveRound(s);const opening=realQuoteCatalog.get(r.commentary[0].templateId!)!;expect(opening).toBeDefined();expect(r.commentary[0].quoteSource).toBe(opening.source);expect(r.commentary[0].text).toContain(opening.text);const before=s.rngState;expect(renderChineseCommentary(deriveCommentaryBeats(r,s),r,s)).toEqual(r.commentary);expect(s.rngState).toBe(before);});
it('优先级不能绕过场景限制',()=>{const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);const r=resolveRound(s),setup=deriveCommentaryBeats(r,s).find(b=>b.category==='setup')!;r.number=2;r.decisions[r.sides[0]==='T'?0:1].tactic='fastA';expect(quoteCandidates(setup,r)).toEqual([]);expect(quoteCandidates({...setup,category:'save-decision'},r)).toEqual([]);});
it('强烈呐喊与比喻仅用于高光，跨回合冷却不靠换句绕过',()=>{
 let emphaticCount=0;
 for(let seed=1;seed<=40;seed++){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);let lastEmphatic=-100,lastMetaphor=-100;
  for(const round of s.mapStates[0].rounds){const intense=round.commentary.filter(x=>/卧槽|牛逼|无敌|太变态|太夸张/.test(x.text)),metaphors=round.commentary.filter(x=>/高压锅|一键扫荡|歼灭模式|游龙|包饺子|空城计|变速齿轮|融化|凡人挑战神明|杀戮机器/.test(x.text));expect(intense.length).toBeLessThanOrEqual(1);expect(metaphors.length).toBeLessThanOrEqual(1);if(intense.length){expect(round.number-lastEmphatic).toBeGreaterThan(3);lastEmphatic=round.number;emphaticCount++;}if(metaphors.length){expect(round.number-lastMetaphor).toBeGreaterThan(10);lastMetaphor=round.number;}}
 }
 expect(emphaticCount).toBeGreaterThan(0);
},20000);
