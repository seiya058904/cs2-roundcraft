import {test,expect} from '@playwright/test';
for(const config of [{width:1440,smooth:true},{width:1280,smooth:false},{width:390,smooth:true}])test(`选手表格中心滚动 ${config.width}px / smooth=${config.smooth}`,async({page})=>{
 await page.setViewportSize({width:config.width,height:1000});await page.goto('/');if(!config.smooth)await page.getByRole('button',{name:'顺滑滚动 开',exact:true}).click();await page.getByRole('button',{name:'选手数据库',exact:true}).click();
 const table=page.locator('.table-scroll').last();await table.scrollIntoViewIfNeeded();
 await page.evaluate(()=>window.dispatchEvent(new Event('ctm:navigate')));
 const box=await table.boundingBox();expect(box).not.toBeNull();
 await page.mouse.move(box!.x+Math.min(box!.width/2,400),Math.max(150,Math.min(box!.y+120,650)));
 const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,500);
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before+100);
 await table.evaluate(el=>el.scrollIntoView({block:'start'}));
 const next=await table.boundingBox();await page.mouse.move(next!.x+Math.min(200,next!.width/2),Math.max(100,next!.y+100));
 await page.mouse.wheel(400,0);await expect.poll(()=>table.evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);
});
