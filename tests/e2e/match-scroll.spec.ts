import {test,expect} from '@playwright/test';
// Narrow screens keep a long page: the feed hands wheel scrolling back to the page at either end.
for(const {smooth,width} of [{smooth:true,width:390},{smooth:false,width:390}])test(`比赛解说内外滚动交接 ${width}px smooth=${smooth}`,async({page})=>{
 // A hosted runner can still be animating after a fixed sleep; measure a settled baseline.
 const settlePage=async()=>{let previous=-1,stable=0;await expect.poll(async()=>{const y=await page.evaluate(()=>scrollY);stable=Math.abs(y-previous)<1?stable+1:0;previous=y;return stable;},{intervals:[100],timeout:10000}).toBeGreaterThanOrEqual(3);};
 await page.setViewportSize({width,height:1000});await page.goto('/');if(!smooth)await page.getByRole('button',{name:'顺滑滚动 开',exact:true}).click();
 await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByLabel('播报速度').selectOption('0');await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 const feed=page.locator('.commentary-feed');await expect(feed.getByTestId('live-state')).toContainText('回合结束');
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

// Desktop stage: the whole match fits the viewport, the newest line stays pinned, and only panels scroll.
for(const {smooth,width,height} of [{smooth:true,width:1440,height:900},{smooth:false,width:1280,height:800},{smooth:true,width:1920,height:1080}])test(`桌面转播台一屏观赛 ${width}x${height} smooth=${smooth}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/');if(!smooth)await page.getByRole('button',{name:'顺滑滚动 开',exact:true}).click();
 await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByLabel('播报速度').selectOption('0');await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 const feed=page.locator('.commentary-feed');await expect(feed.getByTestId('live-state')).toContainText('回合结束');
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
 for(const region of ['.now-speaking .segment','.match-command .execute-round','.own-roster','.enemy-roster','.score-center'])await expect(page.locator(region)).toBeInViewport({ratio:1});
 // The feed scrolls by itself and never moves the page.
 expect(await feed.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await feed.evaluate(el=>{el.scrollTop=0;});const box=await feed.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
 await page.mouse.wheel(0,120);await expect.poll(()=>feed.evaluate(el=>el.scrollTop)).toBeGreaterThan(40);expect(await page.evaluate(()=>scrollY)).toBe(0);
 // Opening the manual drawer overlays the arena instead of pushing it below the fold.
 await page.getByRole('button',{name:'手动',exact:true}).click();await expect(page.getByLabel('战术池',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
 await page.getByRole('button',{name:'收起手动设置',exact:true}).click();await expect(page.getByLabel('战术池',{exact:true})).toHaveCount(0);
});
