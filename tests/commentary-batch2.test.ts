import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseQuotes,duplicateQuote} from '../scripts/import-quotes.mts';
import manifest from '../data/normalized/quotes-manifest.json';
import {realQuoteCatalog,quoteCandidates} from '../src/domain/realQuotes';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound,simulateSeries} from '../src/domain/engine';
import {deriveCommentaryBeats,renderChineseCommentary,type CommentaryBeat} from '../src/domain/commentaryBeats';
import type {RoundEvent} from '../src/domain/types';

function fixture(){const s=createSeries(newWorld(),'team-3','team-7',1,76);autoVeto(s);return {s,r:resolveRound(s)};}
function beat(category:string,events:RoundEvent[],facts:CommentaryBeat['facts']={}):CommentaryBeat{return {id:'test',at:events.at(-1)?.at??0,category,priority:90,eventIds:events.map(e=>e.id),candidates:[],facts,fallback:'事实句',emphasis:'neutral'};}
it('跨批去重保留第一批所有字段，第二批逐字保留并有独立标签与来源',()=>{
 const first=parseQuotes(readFileSync('data/source/quotes_draft.md','utf8'),'quotes_draft.md','RQ');
 for(const row of first)expect(realQuoteCatalog.get(row.id)).toEqual(row);
 const raw=parseQuotes(readFileSync('data/source/quotes_batch2.md','utf8'),'quotes_batch2.md','RB');
 expect(raw).toHaveLength(458);
 const imported=[...realQuoteCatalog.values()].filter(q=>q.id.startsWith('RB-'));
 expect(imported.length+manifest.exclusions.filter(row=>row.id.startsWith('RB-')).length).toBe(raw.length);
 const accepted=[...first];
 for(const row of imported){const source=raw.find(q=>q.id===row.id)!;expect(row.text).toBe(source.text);expect(row.source).toBe(source.source);expect(row.provenance).toBe('user-supplied-transcript-quote');expect('beat' in row&&row.beat).toBeTruthy();expect(accepted.some(q=>duplicateQuote(q.text,row.text))).toBe(false);accepted.push({...source});}
 expect(realQuoteCatalog.has('RB-10-24')).toBe(false);
 expect(realQuoteCatalog.has('RB-12-8')).toBe(false);
});
it('去重忽略标点空格和大小写，包含关系只排除长度至少十字的句子',()=>{
 expect(duplicateQuote(' AWP， 好吧！','awp好吧')).toBe(true);
 expect(duplicateQuote('一二三四五六七八九十','前一二三四五六七八九十后')).toBe(true);
 expect(duplicateQuote('好补枪','一个好补枪')).toBe(false);
});
it('下半场开场语录在第十三回合接线，暂停经济语录只在真实经济暂停播出',()=>{
 const {r}=fixture();r.number=13;expect(quoteCandidates(beat('setup',[]),r)).toContain('RB-11-40');
 r.number=12;expect(quoteCandidates(beat('setup',[]),r)).not.toContain('RB-11-40');
 const event:RoundEvent={id:'timeout',at:0,kind:'coachTimeout',team:0,causes:[],detail:{kind:'belief'}};r.events=[event];
 expect(quoteCandidates(beat('timeout',[event]),r)).not.toContain('RB-11-4');
 event.detail.kind='economy';expect(quoteCandidates(beat('timeout',[event]),r)).toContain('RB-11-4');
 expect(quoteCandidates(beat('timeout',[]),r)).toEqual([]);
});
it('拆包读秒语录要求实际拆除且剩余不超过三秒',()=>{
 const {r}=fixture();const plant:RoundEvent={id:'plant',at:10,kind:'plant',causes:[],detail:{explodeAt:50}};
 const defuse:RoundEvent={id:'defuse',at:46,kind:'defuse',causes:[],detail:{}};r.events=[plant,defuse];
 expect(quoteCandidates(beat('defuse-timing',r.events),r)).not.toContain('RB-8-4');
 defuse.at=47;expect(quoteCandidates(beat('defuse-timing',r.events),r)).toContain('RB-8-4');
 expect(quoteCandidates(beat('defuse-timing',[plant]),r)).toEqual([]);
});
it('同秒稍后捡到的狙不能用于之前的对狙场景门',()=>{
 const {r}=fixture();const target=r.initial[0],actor=r.initial[5];target.equipment.weapon='AK-47';
 const kill:RoundEvent={id:'kill',at:10,kind:'kill',actor:actor.id,target:target.id,weapon:'AWP',causes:[],detail:{}};
 const pickup:RoundEvent={id:'pickup',at:10,kind:'pickup',actor:target.id,weapon:'AWP',causes:[],detail:{}};
 r.events=[kill,pickup];expect(quoteCandidates(beat('awp-duel',[kill]),r)).toEqual([]);
 r.events=[pickup,kill];expect(quoteCandidates(beat('awp-duel',[kill]),r)).toContain('RB-12-5');
});
it('有击杀不代表满血三杀，三杀语录不能在四杀时当成最终成绩',()=>{
 const {r}=fixture();const actor=r.initial[0];actor.hp=100;
 const kills:RoundEvent[]=r.initial.slice(5,9).map((f,i)=>({id:`k${i}`,at:10+i,kind:'kill',actor:actor.id,target:f.id,zone:f.zone,weapon:'AK-47',causes:[],detail:{}}));
 r.events=kills.slice(0,3);expect(quoteCandidates(beat('multikill',r.events),r)).toContain('RB-4-13');
 r.events=[{id:'hurt',at:1,kind:'damage',target:actor.id,damage:1,causes:[],detail:{}},...kills.slice(0,3)];
 expect(quoteCandidates(beat('multikill',kills.slice(0,3)),r)).not.toContain('RB-4-13');
 r.events=kills;expect(quoteCandidates(beat('multikill',kills),r)).not.toContain('RB-4-6');
});
it('真实计划语录保留独立来源，模板冷却和首杀去重不破坏事件锚点',()=>{
 const {s,r}=fixture();r.decisions[r.sides[0]==='T'?0:1].tactic='fakeB';
 const plan=beat('plan',r.events.filter(e=>e.kind==='tactic'&&e.at===0));
 const lines=renderChineseCommentary([beat('setup',plan.eventIds.map(id=>r.events.find(e=>e.id===id)!)),plan],r,s);
 const quote=lines.find(line=>line.templateId==='RQ-9-34')!;expect(quote.sourceType).toBe('quote');expect(quote.quoteSource).toBe(realQuoteCatalog.get('RQ-9-34')!.source);expect(quote.sourceBeatIds).toEqual([plan.id]);
});
it('审读发现的侧别错误、非枪械闪光转化与同次首杀重复有回归保护',()=>{
 let flashConversions=0;
 for(let seed=1;seed<=15;seed++){
  const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);
  for(const r of s.mapStates[0].rounds){
   const beats=deriveCommentaryBeats(r,s),emitted=new Set(r.commentary.flatMap(line=>line.sourceBeatIds??[]));
   const opening=beats.find(b=>b.category==='opening');
   for(const b of beats){
    if(b.category==='flash-conversion'){flashConversions++;expect(r.events.filter(e=>b.eventIds.includes(e.id)&&e.kind==='kill').every(e=>!['HE','fire'].includes(e.weapon!))).toBe(true);}
    if(b.category==='headshot'&&opening?.eventIds.some(id=>b.eventIds.includes(id)))expect(emitted.has(b.id)).toBe(false);
    if(quoteCandidates(b,r).includes('RQ-6-7')){const damage=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='damage')!;expect(r.initial.find(f=>f.id===damage.target)!.side).toBe('T');}
   }
  }
 }
 expect(flashConversions).toBeGreaterThan(0);
},20000);
