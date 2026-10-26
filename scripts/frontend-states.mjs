import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out=process.env.CAPTURE_DIR??'artifacts/frontend-refresh/states';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:/快速开赛/}).click();await page.getByLabel('播报速度').selectOption('0');await page.getByRole('button',{name:'自动 3 回合',exact:true}).click();await page.getByLabel('播报速度').selectOption('-1');await page.locator('.command-primary').getByLabel('经济策略').selectOption('awpPriority');await page.locator('.execute-round').click();
await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`${out}/armed-1280.png`,fullPage:false});
await page.setViewportSize({width:390,height:844});await page.locator('.observer-board').scrollIntoViewIfNeeded();await page.locator('.observer-board').screenshot({path:`${out}/armed-390.png`});
await page.getByRole('button',{name:'选手数据库',exact:true}).click();await page.getByLabel('搜索选手').fill('ZywOo');await page.getByRole('button',{name:'ZywOo',exact:true}).click();await page.screenshot({path:`${out}/player-390.png`,fullPage:false});
await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:`${out}/player-1440.png`,fullPage:false});
// Independent test-only preparation state for maximal inventory and unusually long names.
await page.evaluate(async()=>{
 const {newWorld}=await import('/src/data/index.ts');const {createSeries,autoVeto}=await import('/src/domain/series.ts');const {makeSave}=await import('/src/domain/save.ts');const {saveSlot}=await import('/src/storage.ts');
 const world=newWorld();world.players.find(p=>p.id===world.teams[2].startingFive[0]).nickname='VeryLongProfessionalNickname';
 const s=createSeries(world,'team-3','team-7',3,20261005);autoVeto(s);
 for(const f of s.mapStates[0].fighters){f.cash=16000;f.equipment={weapon:'AWP',pistol:f.side==='T'?'Glock':'USP-S',armor:100,helmet:true,kit:f.side==='CT',utility:['smoke','flash','flash','he']};}
 await saveSlot('autosave',makeSave(null,s,null));
});
await page.reload();await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.locator('.observer-board').scrollIntoViewIfNeeded();await page.locator('.observer-board').screenshot({path:`${out}/boundary-inventory-390.png`});
const fit=await page.locator('.player-gear').evaluateAll(nodes=>nodes.map(el=>({fits:el.scrollWidth<=el.clientWidth+1,height:el.getBoundingClientRect().height})));if(fit.some(x=>!x.fits))throw new Error('Inventory overflow');
const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const touchPage=await phone.newPage();await touchPage.goto('http://127.0.0.1:5173/');await touchPage.getByRole('button',{name:'选手数据库',exact:true}).click();const cdp=await phone.newCDPSession(touchPage);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:650}]});for(const y of [600,520,440,360,280])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touchPage.waitForTimeout(400);const touchScroll=await touchPage.evaluate(()=>scrollY);if(touchScroll<100)throw new Error('Touch page scroll failed');
writeFileSync(`${out}/checks.json`,JSON.stringify({errors,inventory:fit,touchScroll,fixture:'Boundary inventory is synthetic UI preparation state, separate from user saves.'},null,2));await browser.close();console.log({errors,fit,touchScroll});
