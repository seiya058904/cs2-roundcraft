import {it,expect} from 'vitest';
import {newWorld} from '../src/data';
import {createSeries,autoVeto} from '../src/domain/series';
import {simulateSeries} from '../src/domain/engine';
import {commentaryCutoff,commentarySnapshot,snapshotAt} from '../src/domain/replay';
import {momentFor} from '../src/match/Spotlight';

const played=(seed:number)=>{const s=createSeries(newWorld(),'team-3','team-7',1,seed);autoVeto(s);simulateSeries(s);return s;};

it('按事件下标的快照与按解说段的快照一致，且逐个事件单调推进',()=>{
 const s=played(21);
 for(const r of s.mapStates[0].rounds.slice(0,8)){
  for(let n=1;n<=r.commentary.length;n++)expect(snapshotAt(r,commentaryCutoff(r,n))).toEqual(commentarySnapshot(r,n));
  let alive=[5,5];
  for(let i=0;i<r.events.length;i++){const snap=snapshotAt(r,i);expect(snap.alive[0]).toBeLessThanOrEqual(alive[0]);expect(snap.alive[1]).toBeLessThanOrEqual(alive[1]);alive=snap.alive;}
 }
});

it('特写只给多杀、残局、首杀和炸弹节点，并且只引用已经发生的事件',()=>{
 const s=played(21),nick=(id?:string)=>id??'';let multi=0,first=0,bomb=0;
 for(const r of s.mapStates[0].rounds){
  const kills=r.events.map((e,i)=>({e,i})).filter(x=>x.e.kind==='kill');
  for(let i=0;i<r.events.length;i++){
   const m=momentFor(r,r.events.slice(0,i+1),nick);if(!m)continue;
   expect(r.events.slice(0,i+1).some(e=>e.id===m.key)).toBe(true);
   if(['三杀','四杀','ACE'].includes(m.title))multi++;
   if(m.title==='首杀'){first++;expect(kills.find(k=>k.e.actor&&r.initial.find(f=>f.id===k.e.actor)?.team!==r.initial.find(f=>f.id===k.e.target)?.team)?.e.id).toBe(m.key);}
   if(['炸弹已安放','拆包成功','炸弹爆炸'].includes(m.title))bomb++;
  }
 }
 expect(first).toBeGreaterThan(10);expect(bomb).toBeGreaterThan(3);expect(multi).toBeGreaterThan(0);
});
