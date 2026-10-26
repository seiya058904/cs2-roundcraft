import {test,expect} from '@playwright/test';
test('生产版缓存完成后断网刷新、恢复、Worker 模拟',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE',msg.text());});
 await page.goto('./');await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
 await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByRole('button',{name:'执行下一回合 →'}).click();await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'存档',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('已保存到槽位 1');
 await context.setOffline(true);await page.reload();await expect(page.getByRole('status')).toContainText('已恢复上次自动存档');await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
 const equipment=await page.evaluate(async()=>{
  const cacheName=(await caches.keys()).find(name=>name.startsWith('ctm-assets-'))!;
  const urls=(await (await caches.open(cacheName)).keys()).map(request=>request.url).filter(url=>url.endsWith('.svg'));
  return Promise.all(urls.map(async url=>{const response=await fetch(url);const img=new Image();img.src=url;await img.decode();return response.ok&&img.naturalWidth>0;}));
 });
 expect(equipment).toHaveLength(23);expect(equipment.every(Boolean)).toBe(true);
 await page.getByRole('button',{name:'模拟 BO3',exact:true}).click();await expect(page.getByText('系列赛结束',{exact:true})).toBeVisible({timeout:30000});expect(errors).toEqual([]);
});
