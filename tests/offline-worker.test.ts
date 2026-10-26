import {describe,it,expect,vi} from 'vitest';
import {runInNewContext} from 'node:vm';
import {offlineWorker} from '../scripts/offline-build';

function harness(){
 const handlers:Record<string,(event:any)=>void>={};
 const match=vi.fn(async()=> 'cached-app'),remove=vi.fn(async()=>true);
 const cache={match,addAll:vi.fn(async()=>{})};
 const caches={open:vi.fn(async()=>cache),delete:remove,keys:async()=>[
  'ctm-assets-%2Ffirst%2F-old','ctm-assets-%2Ffirst%2F-new',
  'ctm-assets-%2Fsecond%2F-old','ctm-assets-legacy','unrelated-cache'
 ]};
 const fetch=vi.fn(async()=>{throw new Error('offline');});
 runInNewContext(offlineWorker(['./','index.html'],'new'),{URL,caches,fetch,self:{
  registration:{scope:'https://example.test/first/'},location:{origin:'https://example.test'},
  clients:{claim:vi.fn()},skipWaiting:vi.fn(),addEventListener:(name:string,fn:any)=>{handlers[name]=fn;}
 }});
 return {handlers,caches,match,remove,fetch};
}
describe('offline deployment isolation',()=>{
 it('removes only obsolete caches in its own Pages scope',async()=>{
  const h=harness();let pending:Promise<unknown>|undefined;
  h.handlers.activate({waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;
  expect(h.remove.mock.calls).toEqual([['ctm-assets-%2Ffirst%2F-old']]);
 });
 it('reads the scoped shell on offline navigation',async()=>{
  const h=harness();let response:Promise<unknown>|undefined;
  h.handlers.fetch({request:{url:'https://example.test/first/',method:'GET',mode:'navigate'},respondWith:(p:Promise<unknown>)=>{response=p;}});
  expect(await response).toBe('cached-app');expect(h.caches.open).toHaveBeenCalledWith('ctm-assets-%2Ffirst%2F-new');
  expect(h.match).toHaveBeenCalledWith('https://example.test/first/index.html',{ignoreVary:true});
 });
 it('does not intercept another project, external origin or write request',()=>{
  const h=harness(),respondWith=vi.fn();
  for(const [url,method] of [['https://example.test/second/app.js','GET'],['https://other.test/first/app.js','GET'],['https://example.test/first/','POST']])h.handlers.fetch({request:{url,method},respondWith});
  expect(respondWith).not.toHaveBeenCalled();
 });
});
