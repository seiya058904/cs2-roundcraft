import type {Side} from './domain/types';
import ak47 from './assets/equipment/ak47.svg?no-inline';
import m4a1_silencer from './assets/equipment/m4a1_silencer.svg?no-inline';
import awp from './assets/equipment/awp.svg?no-inline';
import famas from './assets/equipment/famas.svg?no-inline';
import galilar from './assets/equipment/galilar.svg?no-inline';
import mp9 from './assets/equipment/mp9.svg?no-inline';
import mac10 from './assets/equipment/mac10.svg?no-inline';
import glock from './assets/equipment/glock.svg?no-inline';
import usp_silencer from './assets/equipment/usp_silencer.svg?no-inline';
import p250 from './assets/equipment/p250.svg?no-inline';
import fiveseven from './assets/equipment/fiveseven.svg?no-inline';
import tec9 from './assets/equipment/tec9.svg?no-inline';
import deagle from './assets/equipment/deagle.svg?no-inline';
import kevlar from './assets/equipment/kevlar.svg?no-inline';
import helmet from './assets/equipment/helmet.svg?no-inline';
import defuser from './assets/equipment/defuser.svg?no-inline';
import flashbang from './assets/equipment/flashbang.svg?no-inline';
import smokegrenade from './assets/equipment/smokegrenade.svg?no-inline';
import hegrenade from './assets/equipment/hegrenade.svg?no-inline';
import molotov from './assets/equipment/molotov.svg?no-inline';
import incgrenade from './assets/equipment/incgrenade.svg?no-inline';
import c4 from './assets/equipment/c4.svg?no-inline';
import dead from './assets/equipment/dead.svg?no-inline';

// Verified, local source assets. Original SVG geometry is retained; see sources.json.
const weaponIcons:Record<string,string>={
 'AK-47':ak47,'M4A1-S':m4a1_silencer,AWP:awp,FAMAS:famas,Galil:galilar,
 MP9:mp9,'MAC-10':mac10,Glock:glock,'USP-S':usp_silencer,P250:p250,
 'Five-SeveN':fiveseven,'Tec-9':tec9,Deagle:deagle
};
export function WeaponIcon({weapon}:{weapon:string}){
 const src=Object.hasOwn(weaponIcons,weapon)?weaponIcons[weapon]:undefined;
 return src?<img className="weapon-icon" src={src} alt="" aria-hidden="true" draggable={false}/>:null;
}
export type GearKind='smoke'|'flash'|'he'|'fire'|'armor'|'helmet'|'kit'|'bomb'|'dead';
const gearIcons:Record<Exclude<GearKind,'fire'>,string>={smoke:smokegrenade,flash:flashbang,he:hegrenade,armor:kevlar,helmet,kit:defuser,bomb:c4,dead};
export function GearIcon({kind,label,count,side}:{kind:GearKind;label:string;count?:number;side?:Side}){
 const src=kind==='fire'?(side==='T'?molotov:incgrenade):gearIcons[kind];
 return <span className="gear-icon" role="img" aria-label={label} title={label}><span className="gear-art" aria-hidden="true" style={{maskImage:`url("${src}")`,WebkitMaskImage:`url("${src}")`}}/>{count&&count>1?<small>{count}</small>:null}</span>;
}
