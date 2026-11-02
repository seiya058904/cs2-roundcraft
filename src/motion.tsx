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
  const row=ref.current,q=(sel:string)=>row.querySelector(sel);
  const tl=gsap.timeline({defaults:{duration:MOTION.normal,ease:MOTION.ease,overwrite:'auto'}});
  // One-shot overlay nodes (damage numbers, kill slash) run CSS animations outside this GSAP context, so a
  // revert on the next update cannot strand them; each removes itself when its animation ends.
  const overlay=(className:string,text='')=>{const el=document.createElement('span');el.className=className;el.setAttribute('aria-hidden','true');el.textContent=text;row.appendChild(el);const done=()=>el.remove();el.addEventListener('animationend',done,{once:true});setTimeout(done,1600);return el;};
  const float=(text:string,tone:string)=>overlay(`float-num ${tone}`,text);
  const trail=q('.player-health>.trail');
  if(trail&&before.hp!==hp)tl.fromTo(trail,{scaleX:Math.max(0,before.hp)/100},{scaleX:Math.max(0,alive?hp:0)/100,duration:.55,delay:.28,ease:'power2.in'},0);
  if(before.alive&&!alive){
   tl.fromTo(row,{'--hit':1},{'--hit':0,duration:.9,ease:'power2.out'},0);
   tl.fromTo(row,{x:-7},{x:0,duration:.5,ease:'elastic.out(1,.35)',clearProps:'transform'},0);
   tl.from(q('.dead-status'),{opacity:0,x:6,clearProps:'transform,opacity'},.1);
   overlay('kill-slash');
   if(before.hp>0)float(`-${before.hp}`,'lethal');
  }
  else if(before.hp>hp){tl.fromTo(row,{'--hit':.75},{'--hit':0,duration:.6,ease:'power2.out'},0);tl.fromTo(q('.player-hp'),{scale:1.28},{scale:1,duration:.42,ease:'back.out(3)',clearProps:'transform'},0);float(`-${before.hp-hp}`,before.hp-hp>=50?'heavy':'');}
  if(before.cash!==cash)tl.from(q('.player-cash'),{opacity:.35,y:3,clearProps:'transform,opacity'},'<');
  if(alive&&before.gear!==gear)tl.from(q('.player-loadout'),{opacity:.3,clearProps:'opacity'},'<');
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

export function useMotionEnabled(){return useContext(MotionContext).enabled;}
/** Tweens a displayed number toward `value`; snaps instantly when motion is off. */
export function useTweenNumber(value:number,duration=.5){
 const {enabled}=useContext(MotionContext);const [shown,setShown]=useState(value);const state=useRef({v:value});
 useEffect(()=>{
  if(!enabled||!Number.isFinite(value)){state.current.v=value;setShown(value);return;}
  const tween=gsap.to(state.current,{v:value,duration,ease:'power3.out',onUpdate:()=>setShown(state.current.v)});
  return()=>{tween.kill();};
 },[value,enabled,duration]);
 return shown;
}
/**
 * Slides one `.indicator` child under whichever descendant matches `activeSelector`.
 * Used by the sidebar, tabs and segmented controls so every selection change moves, not blinks.
 */
export function useIndicator<T extends HTMLElement>(activeSelector:string,deps:unknown[]){
 const ref=useRef<T>(null);const {enabled}=useContext(MotionContext);const first=useRef(true);
 useEffect(()=>{
  const root=ref.current;if(!root)return;
  const place=(animate:boolean)=>{
   const indicator=root.querySelector<HTMLElement>(':scope>.indicator'),active=root.querySelector<HTMLElement>(activeSelector);
   if(!indicator)return;if(!active){indicator.style.opacity='0';return;}
   const r=root.getBoundingClientRect(),a=active.getBoundingClientRect();
   const box={x:a.left-r.left+root.scrollLeft,y:a.top-r.top+root.scrollTop,width:a.width,height:a.height};
   gsap.to(indicator,{...box,opacity:1,duration:animate&&enabled?.32:0,ease:'power3.out',overwrite:true});
  };
  place(!first.current);first.current=false;
  const observer=new ResizeObserver(()=>place(false));observer.observe(root);
  return()=>observer.disconnect();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[activeSelector,enabled,...deps]);
 return ref;
}
/** Staggers the direct children of the page body in on every navigation. */
export function useRouteEnter(page:string){
 const ref=useRef<HTMLDivElement>(null);const {enabled}=useContext(MotionContext);
 useGSAP(()=>{if(!enabled||!ref.current)return;const items=[...ref.current.children].slice(0,8);gsap.from(items,{y:14,opacity:0,duration:.42,ease:'power3.out',stagger:.045,clearProps:'transform,opacity'});},{scope:ref,dependencies:[page,enabled],revertOnUpdate:true});
 return ref;
}
/** Score change: the digit drops in oversized with a glow that settles; never loops. */
export function useBurst<T extends HTMLElement>(key:unknown){
 const ref=useRef<T>(null);const {enabled}=useContext(MotionContext);const seen=useRef(key);
 useGSAP(()=>{if(seen.current===key)return;seen.current=key;if(!enabled||!ref.current)return;
  gsap.timeline().fromTo(ref.current,{yPercent:-70,opacity:0,scale:1.6},{yPercent:0,opacity:1,scale:1,duration:.6,ease:'back.out(2.2)',clearProps:'transform,opacity'})
   .fromTo(ref.current,{textShadow:'0 0 34px currentColor'},{textShadow:'0 0 0px currentColor',duration:1.1,ease:'power2.out',clearProps:'textShadow'},0);
 },{dependencies:[key,enabled]});
 return ref;
}
/** One-shot pop when `key` changes (score digits, chips); never loops. */
export function usePop<T extends HTMLElement>(key:unknown,from:gsap.TweenVars={yPercent:-40,opacity:0}){
 const ref=useRef<T>(null);const {enabled}=useContext(MotionContext);const seen=useRef(key);
 useGSAP(()=>{if(seen.current===key)return;seen.current=key;if(!enabled||!ref.current)return;gsap.from(ref.current,{...from,duration:.45,ease:'back.out(2)',clearProps:'transform,opacity'});},{dependencies:[key,enabled]});
 return ref;
}
