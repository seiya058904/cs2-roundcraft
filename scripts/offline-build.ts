import type {Plugin} from 'vite';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
/** Cache only this build's public assets. Saves stay in IndexedDB, outside the asset cache. */
export function offlineBuild():Plugin{
 return{name:'local-offline-build',apply:'build',async closeBundle(){
  const assets=(await readdir('dist/assets')).map(name=>`assets/${name}`);
  const index=await readFile('dist/index.html','utf8');const revision=createHash('sha256').update(index).digest('hex').slice(0,12);
  const script=offlineWorker(['./','index.html',...assets],revision);
  await writeFile(join('dist','sw.js'),script);
 }};
}

export function offlineWorker(files:string[],revision:string){
 return `const SCOPE=self.registration.scope;
const PREFIX='ctm-assets-'+encodeURIComponent(new URL(SCOPE).pathname)+'-';
const CACHE=PREFIX+${JSON.stringify(revision)};
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(SCOPE))return;
 const cached=(key)=>caches.open(CACHE).then(cache=>cache.match(key,{ignoreVary:true}));
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>cached(new URL('index.html',SCOPE).href)));return;}
 event.respondWith(cached(request).then(hit=>hit||fetch(request)));
});
`;
}
