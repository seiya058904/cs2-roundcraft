import {createContext,useContext,useEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(useGSAP,ScrollTrigger);
const MotionContext=createContext({enabled:true,smooth:true,setEnabled:(_v:boolean)=>{},setSmooth:(_v:boolean)=>{}});
function preference(key:string,fallback:boolean){try{return JSON.parse(localStorage.getItem(key)??String(fallback))===true;}catch{return fallback;}}
export function MotionProvider({children}:{children:ReactNode}){
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [enabled,setEnabled]=useState(()=>preference('ctm-motion',true));
 const [smooth,setSmooth]=useState(()=>preference('ctm-smooth',true));
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(mq.matches);mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change);},[]);
 useEffect(()=>{document.documentElement.dataset.motion=enabled&&!reduced?'on':'off';try{localStorage.setItem('ctm-motion',JSON.stringify(enabled));localStorage.setItem('ctm-smooth',JSON.stringify(smooth));}catch{/* Preferences never block play. */}},[enabled,smooth,reduced]);
 useEffect(()=>{
  if(!smooth||reduced)return;
  const lenis=new Lenis({autoRaf:false,lerp:.16,smoothWheel:true,syncTouch:false,anchors:true,allowNestedScroll:true});
  const tick=(seconds:number)=>lenis.raf(seconds*1000);
  const navigate=()=>{lenis.stop();lenis.start();lenis.scrollTo(0,{immediate:true});ScrollTrigger.refresh();};
  const key=(event:KeyboardEvent)=>{if(['Tab','Home','End','PageUp','PageDown'].includes(event.key))lenis.scrollTo(window.scrollY,{immediate:true});};
  lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(tick);window.addEventListener('ctm:navigate',navigate);window.addEventListener('keydown',key);
  return()=>{gsap.ticker.remove(tick);window.removeEventListener('ctm:navigate',navigate);window.removeEventListener('keydown',key);lenis.destroy();};
 },[smooth,reduced]);
 return <MotionContext.Provider value={{enabled:enabled&&!reduced,smooth:smooth&&!reduced,setEnabled,setSmooth}}>{children}</MotionContext.Provider>;
}
export function MotionSettings(){const m=useContext(MotionContext);return <div className="motion-settings" aria-label="显示偏好"><button aria-pressed={m.enabled} onClick={()=>m.setEnabled(!m.enabled)}>动效 {m.enabled?'开':'关'}</button><button aria-pressed={m.smooth} onClick={()=>m.setSmooth(!m.smooth)}>顺滑滚动 {m.smooth?'开':'关'}</button></div>;}
export function MotionRoute({page}:{page:string}){useEffect(()=>{window.dispatchEvent(new Event('ctm:navigate'));window.scrollTo({top:0,behavior:'instant'});},[page]);return null;}
export function usePanelMotion(){const ref=useRef<HTMLElement>(null);const {enabled}=useContext(MotionContext);useGSAP(()=>{if(!enabled||!ref.current)return;gsap.from(ref.current,{y:10,opacity:.82,duration:.32,ease:'power2.out',clearProps:'transform,opacity',scrollTrigger:{trigger:ref.current,start:'top 98%',once:true}});},{scope:ref,dependencies:[enabled],revertOnUpdate:true});return ref;}
export function useEventMotion(ref:RefObject<HTMLElement|null>,anchor:string){const {enabled}=useContext(MotionContext);useGSAP(()=>{if(!enabled||!ref.current)return;const segment=ref.current.querySelector('.segment:last-child');if(!segment)return;const timeline=gsap.timeline();timeline.from(segment,{y:8,opacity:.65,duration:.26,ease:'power2.out',clearProps:'transform,opacity'});if(segment.classList.contains('hype'))timeline.fromTo(segment,{scale:.99},{scale:1,duration:.24,clearProps:'transform'},'<');},{scope:ref,dependencies:[anchor,enabled],revertOnUpdate:true});}

export const MOTION={fast:.16,normal:.24,event:.3,ease:'power2.out'};
export function useRosterMotion(anchor:string,hp:number,alive:boolean,cash:number,gear:string){
 const ref=useRef<HTMLElement>(null);const {enabled}=useContext(MotionContext);
 const previous=useRef({anchor,hp,alive,cash,gear});
 useGSAP(()=>{
  const before=previous.current;previous.current={anchor,hp,alive,cash,gear};
  if(!enabled||!ref.current||before.anchor===anchor)return;
  const tl=gsap.timeline({defaults:{duration:MOTION.normal,ease:MOTION.ease,overwrite:'auto'}});
  if(before.alive&&!alive)tl.from(ref.current.querySelector('.dead-status'),{opacity:.2,x:4,clearProps:'transform,opacity'},0);
  else if(before.hp!==hp)tl.from(ref.current.querySelector('.player-hp'),{scale:1.12,clearProps:'transform'},0);
  if(before.cash!==cash)tl.from(ref.current.querySelector('.player-cash'),{opacity:.35,y:3,clearProps:'transform,opacity'},'<');
  if(alive&&before.gear!==gear)tl.from(ref.current.querySelector('.player-loadout'),{opacity:.3,clearProps:'opacity'},'<');
 },{scope:ref,dependencies:[anchor,enabled,hp,alive,cash,gear],revertOnUpdate:true});
 return ref;
}

/** Refresh only after real disclosure/layout changes; one debounced listener per app. */
export function MotionLayout(){
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>ScrollTrigger.refresh(),80);};
  document.addEventListener('toggle',refresh,true);
  return()=>{clearTimeout(timer);document.removeEventListener('toggle',refresh,true);};
 },[]);return null;
}
