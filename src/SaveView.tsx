import {useEffect,useState} from 'react';
import type {GameSave} from './domain/save';
import {MANUAL_SLOTS,REPLACEMENT_BACKUP,deleteSlot,listSlots,loadRecoveryBackup,loadReplacementRaw,saveSlot,type SlotInfo} from './storage';
import {Panel} from './ui';
import {getMap} from './domain/maps';

function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function Summary({info}:{info?:SlotInfo}){
 if(!info)return <p className="muted">正在读取…</p>;
 if(info.invalid)return <p className="orange">存档无法读取；可导出备份后再处理。</p>;
 if(!info.save)return <p className="muted">空槽位</p>;
 const {career,match,savedAt}=info.save,map=match?.mapStates.at(-1);
 return <div className="save-summary"><time dateTime={savedAt}>{new Date(savedAt).toLocaleString('zh-CN',{hour12:false})}</time>{career&&<p>{career.world.teams.find(t=>t.id===career.managedTeamId)?.name} · 生涯第 {career.season} 季 / 第 {career.week} 周</p>}{match&&<p>{match.teams.map(t=>t.name).join(' / ')} · BO{match.bestOf}<br/>{map?`${getMap(map.map).name} · 已完成 ${map.rounds.length} 回合 · ${map.score.join(':')}`:'地图禁选'}</p>}{!career&&!match&&<p>尚未开始比赛或生涯</p>}</div>;
}
export function SaveView({state,busy,onLoad,onImport,onNotify,onError}:{state:GameSave;busy:boolean;onLoad:(slot:string)=>Promise<void>;onImport:(file:File)=>Promise<void>;onNotify:(text:string)=>void;onError:(text:string)=>void}){
 const [slots,setSlots]=useState<SlotInfo[]>([]),[working,setWorking]=useState(false);
 useEffect(()=>{let active=true;listSlots().then(s=>{if(active)setSlots(s);}).catch(e=>{if(active)onError(e.message);});return()=>{active=false;};},[]);
 const run=async(action:()=>Promise<void>)=>{if(working||busy)return;setWorking(true);try{await action();setSlots(await listSlots());}catch(e){onError(e instanceof Error?e.message:String(e));}finally{setWorking(false);}};
 const disabled=busy||working,backup=slots.find(s=>s.id===REPLACEMENT_BACKUP);
 return <><header className="section-title"><h1>本地存档</h1><p>三个独立手动槽位。载入、导入或覆盖已有槽位时，保留最近一次替换前的备份。</p></header>
 <div className="save-slots">{MANUAL_SLOTS.map((slot,i)=>{const info=slots.find(s=>s.id===slot);return <Panel key={slot} title={`存档槽 ${i+1}`}><Summary info={info}/><div className="button-row"><button disabled={disabled||!info} onClick={()=>run(async()=>{await saveSlot(slot,state);onNotify(`已保存到槽位 ${i+1}`);})}>保存</button><button disabled={disabled||!info?.save} onClick={()=>run(()=>onLoad(slot))}>载入</button><button className="danger-button" disabled={disabled||!info||(!info.save&&!info.invalid)} onClick={()=>{if(window.confirm(`仅删除存档槽 ${i+1}？自动存档和当前进度保留。`))void run(async()=>{await deleteSlot(slot);onNotify('该槽位已删除');});}}>删除</button></div></Panel>;})}</div>
 <Panel title="最近替换备份"><Summary info={backup}/><div className="button-row"><button disabled={disabled||!backup?.save} onClick={()=>run(()=>onLoad(REPLACEMENT_BACKUP))}>恢复替换前进度</button><button disabled={disabled||!backup||(!backup.save&&!backup.invalid)} onClick={()=>run(async()=>download(await loadReplacementRaw(),'CS_Tactics_Manager_previous.json'))}>导出替换备份</button></div><p className="fine muted">仅保留最近一份。恢复时也会备份当前进度；长期保留请导出 JSON。</p></Panel>
 <Panel title="备份与迁移"><div className="button-row"><button onClick={()=>download(state,'CS_Tactics_Manager_save.json')}>导出 JSON</button><button onClick={()=>run(async()=>{const backup=await loadRecoveryBackup();if(backup===undefined)throw new Error('没有待恢复的备份');download(backup,'CS_Tactics_Manager_recovery.json');})}>导出最近恢复备份</button><label className="file-label">导入 JSON<input disabled={disabled} type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(()=>onImport(file));}}/></label></div><p className="muted">导入会先校验并备份当前进度，再替换。未知版本、危险字段与无效阵容会被拒绝。</p></Panel></>;
}
