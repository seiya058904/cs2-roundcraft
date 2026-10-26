import {initialWorld} from './index';
import type {GameSave} from '../domain/save';

/** Refresh future career matches only; never rewrite an in-progress match, results, transfers or user roles. */
export function refreshProfiles(input:GameSave){
 const save=structuredClone(input);let updated=0;
 for(const p of save.career?.world.players??[]){
  const source=initialWorld.players.find(row=>row.id===p.id&&row.nickname===p.nickname);
  if(!source||p.modelVersion===source.modelVersion)continue;
  p.attributes=structuredClone(source.attributes);p.mapProficiency=structuredClone(source.mapProficiency);
  if(source.nationality)p.nationality=source.nationality;if(source.source.identityUrl)p.source.identityUrl=source.source.identityUrl;
  p.profile=structuredClone(source.profile);p.modelVersion=source.modelVersion;
  if(p.roleConfidence!=='user-assigned'){p.role=source.role;p.roleConfidence=source.roleConfidence;}
  updated++;
 }
 return {save,updated};
}
