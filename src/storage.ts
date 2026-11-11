import {validateSave,type GameSave} from './domain/save';
let failedAutosave:unknown=undefined;
export const REPLACEMENT_BACKUP='replacement-backup';
export const MANUAL_SLOTS=['slot-1','slot-2','slot-3'] as const;
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('cs-tactics-manager',1);request.onupgradeneeded=()=>request.result.createObjectStore('saves');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
/** Resolve only at the transaction boundary, including aborts without a request error. */
async function transaction<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,result:(value:T)=>void)=>void):Promise<T>{
 const db=await database();
 try{return await new Promise<T>((resolve,reject)=>{
  const tx=db.transaction('saves',mode);let result:T;
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error??new Error('本地存档读写失败'));
  tx.onabort=()=>reject(tx.error??new Error('本地存档事务已中止，请重试'));
  try{work(tx.objectStore('saves'),value=>{result=value;});}catch(error){tx.abort();reject(error);}
 });}finally{db.close();}
}
const readRaw=(slot:string)=>transaction<unknown>('readonly',(store,result)=>{const request=store.get(slot);request.onsuccess=()=>result(request.result);});
/** Preserve the existing invalid-save recovery path separately from the bounded replacement backup. */
function preserveRecovery(store:IDBObjectStore,recovery:unknown){if(recovery!==undefined){const key=`recovery-${crypto.randomUUID()}`;store.put(recovery,key);store.put(key,'recovery-latest');}}
export async function saveSlot(slot:string,save:GameSave){
 const recovery=slot==='autosave'?failedAutosave:undefined;
 await transaction<void>('readwrite',store=>{
  preserveRecovery(store,recovery);
  if(MANUAL_SLOTS.some(id=>id===slot)){
   const previous=store.get(slot);
   previous.onsuccess=()=>{if(previous.result!==undefined)store.put(previous.result,REPLACEMENT_BACKUP);store.put({...save,savedAt:new Date().toISOString()},slot);};
  }else store.put(save,slot);
 });
 if(recovery!==undefined&&failedAutosave===recovery)failedAutosave=undefined;
}
/** Backup and replacement commit together: a failed backup must never replace progress. */
export async function replaceAutosave(next:GameSave,previous:GameSave){
 const recovery=failedAutosave;
 await transaction<void>('readwrite',store=>{preserveRecovery(store,recovery);store.put(previous,REPLACEMENT_BACKUP);store.put(next,'autosave');});
 if(recovery!==undefined&&failedAutosave===recovery)failedAutosave=undefined;
}
export async function loadSlot(slot:string):Promise<GameSave|null>{const raw=await readRaw(slot);if(raw===undefined||raw===null)return null;try{return validateSave(raw);}catch(error){if(slot==='autosave')failedAutosave=raw;throw error;}}
export async function loadRecoveryBackup(){const key=await readRaw('recovery-latest');return typeof key==='string'?readRaw(key):failedAutosave;}
export const deleteSlot=(slot:string)=>transaction<void>('readwrite',store=>{store.delete(slot);});
export interface SlotInfo {id:string;save:GameSave|null;invalid:boolean}
export async function listSlots():Promise<SlotInfo[]>{
 return transaction('readonly',(store,result)=>{
  const slots:SlotInfo[]=[];result(slots);
  for(const id of [...MANUAL_SLOTS,REPLACEMENT_BACKUP]){const request=store.get(id);request.onsuccess=()=>{
   try{slots.push({id,save:request.result==null?null:validateSave(request.result),invalid:false});}
   catch{slots.push({id,save:null,invalid:true});}
  };}
 });
}
export const loadReplacementRaw=()=>readRaw(REPLACEMENT_BACKUP);
