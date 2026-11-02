import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {validateNarration,renderCommentary,deriveCommentaryBeats,renderChineseCommentary} from '../src/domain/narrative';
import {addDuoVoices} from '../src/domain/duo';
import {spokenCount} from '../src/domain/spoken';
import {realQuoteCatalog} from '../src/domain/realQuotes';
import {formatCommentaryNames} from '../src/domain/names';

const played=(seed:number,version?:string)=>{const s=createSeries(newWorld(),'team-3','team-7',1,seed);if(version)s.engineVersion=version;autoVeto(s);simulateSeries(s);return s;};

it('口语层只改写详解事实句：语录原文、精简、事件锚点与来源不变，且可复现',()=>{
 for(const seed of [3,21,57]){const s=played(seed);
  for(const r of s.mapStates[0].rounds){
   expect(validateNarration(r)).toEqual([]);expect(renderCommentary(r,s)).toEqual(r.commentary);
   const raw=addDuoVoices(renderChineseCommentary(deriveCommentaryBeats(r,s),r,s),r,s);
   expect(r.commentary).toHaveLength(raw.length);
   r.commentary.forEach((line,i)=>{const before=raw[i];
    expect({...line,text:''}).toEqual({...before,text:''});
    if(line.voice==='analyst')expect(line.text).toBe(before.text);
    const quote=line.templateId?realQuoteCatalog.get(line.templateId):undefined;
    if(quote)expect(line.text.startsWith(formatCommentaryNames(quote.text,s.players,s.teams))).toBe(true);});
  }}
});

it('机械事实句改为口播：人数读作汉字，比分与秒数保留数字，结算仍报比分',()=>{
 let rewritten=0;
 for(const seed of [3,21]){const s=played(seed);
  for(const r of s.mapStates[0].rounds){
   for(const line of r.commentary.filter(l=>l.voice!=='analyst')){
    expect(line.text).not.toMatch(/人数变成\d打\d|40秒倒计时开始|比分来到\d|一打\d/);
    if(/[一二三四五]打[一二三四五]/.test(line.text))rewritten++;}
   const settled=r.commentary.filter(l=>l.emphasis==='conclusion'||l.stage==='回合结算').map(l=>l.text).join(' ');
   const [a,b]=r.score;expect(settled.includes(`${a}:${b}`)||settled.includes(`${a}比${b}`)||settled.includes(`${b}比${a}`)||settled.includes(`${Math.max(a,b)}比${Math.min(a,b)}`)).toBe(true);
  }}
 expect(rewritten).toBeGreaterThan(20);expect(spokenCount(4)).toBe('四');
});

it('情绪层守住强度预算：同回合至多一次强烈呐喊，三回合内不重复',()=>{
 for(let seed=1;seed<=20;seed++){const s=played(seed);let last=-100;
  for(const r of s.mapStates[0].rounds){const intense=r.commentary.filter(l=>/卧槽|牛逼|无敌|太变态|太夸张/.test(l.text));
   expect(intense.length).toBeLessThanOrEqual(1);if(intense.length){expect(r.number-last).toBeGreaterThan(3);last=r.number;}}}
});

it('旧引擎比赛保持冻结解说，口语层不介入',()=>{
 const s=played(21,'causal-plans-v4');
 expect(s.mapStates[0].rounds.every(r=>r.commentary.every(l=>l.voice===undefined))).toBe(true);
 expect(s.mapStates[0].rounds.some(r=>r.commentary.some(l=>l.text.includes('比分来到')))).toBe(true);
});
