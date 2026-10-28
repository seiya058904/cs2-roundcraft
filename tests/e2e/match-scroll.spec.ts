import {test,expect} from '@playwright/test';
for(const {smooth,width} of [{smooth:true,width:1440},{smooth:false,width:1440},{smooth:true,width:390}])test(`比赛解说内外滚动交接 ${width}px smooth=${smooth}`,async({page})=>{
 // A hosted runner can still be animating after a fixed sleep; measure a settled baseline.
 const settlePage=async()=>{let previous=-1,stable=0;await expect.poll(async()=>{const y=await page.evaluate(()=>scrollY);stable=Math.abs(y-previous)<1?stable+1:0;previous=y;return stable;},{intervals:[100],timeout:10000}).toBeGreaterThanOrEqual(3);};
 await page.setViewportSize({width,height:1000});await page.goto('/');if(!smooth)await page.getByRole('button',{name:'顺滑滚动 开',exact:true}).click();
 await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByLabel('播报速度').selectOption('0');await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 const feed=page.locator('.commentary-feed');await expect(feed.getByTestId('live-state')).toContainText('回合结束');
 // Statistics are now collapsed by default. Open them to leave real page scroll space below the feed.
 await page.locator('.statistics-disclosure>summary').click();
 await feed.evaluate(el=>{el.scrollIntoView({block:'center',behavior:'instant'});el.scrollTop=el.scrollHeight;});
 const box=await feed.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
 await page.waitForTimeout(400);const stable=await feed.boundingBox();await page.mouse.move(stable!.x+stable!.width/2,stable!.y+stable!.height/2);const bottomPage=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,280);await page.waitForTimeout(200);await page.mouse.wheel(0,280);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(bottomPage+100);
 await settlePage();await feed.evaluate(el=>{el.scrollIntoView({block:'center',behavior:'instant'});el.scrollTop=0;});await settlePage();
 const topBox=await feed.boundingBox();await page.mouse.move(topBox!.x+topBox!.width/2,topBox!.y+topBox!.height/2);
 const topPage=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,-200);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(topPage-70);
 await settlePage();await feed.evaluate(el=>{el.scrollIntoView({block:'center',behavior:'instant'});el.scrollTop=80;});await settlePage();
 const mid=await feed.boundingBox();await page.mouse.move(mid!.x+mid!.width/2,mid!.y+mid!.height/2);const before=await page.evaluate(()=>scrollY);
 await page.mouse.wheel(0,100);await expect.poll(()=>feed.evaluate(el=>el.scrollTop)).toBeGreaterThan(140);expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThan(5);
});
