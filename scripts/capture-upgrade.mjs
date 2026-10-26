import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('docs/evidence/upgrade',{recursive:true});
const captures=[];
async function capture(name){await page.evaluate(()=>window.dispatchEvent(new Event('ctm:navigate')));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForTimeout(360);await page.screenshot({path:`docs/evidence/upgrade/${name}.png`,fullPage:false});captures.push({name,viewport:page.viewportSize(),url:page.url(),title:await page.title(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),meaningful:await page.locator('main').innerText().then(t=>t.length>50)});}
await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).waitFor();await capture('home-1440');
await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByLabel('播报速度').selectOption('0');await page.getByRole('button',{name:'执行当前战术',exact:true}).click();await page.getByTestId('live-state').filter({hasText:'回合结束'}).waitFor();await capture('match-1440');
for(const width of [1280,1024,390]){await page.setViewportSize({width,height:1000});await capture(`match-${width}`);}
await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'选手数据库',exact:true}).click();await page.getByLabel('搜索选手').fill('ZywOo');await page.getByRole('button',{name:'ZywOo',exact:true}).click();await capture('player-1440');
await page.getByRole('button',{name:'对比 ZywOo',exact:true}).click();await page.getByLabel('搜索选手').fill('donk');await page.getByRole('button',{name:'对比 donk',exact:true}).click();await capture('compare-1440');
for(const name of ['总览','赛事中心','转会窗口','沙盒','存档','数据与规则']){await page.getByRole('button',{name,exact:true}).click();await capture(`page-${name}`);}
await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
const frameIntervals=await page.evaluate(async()=>{const frames=[];let previous=performance.now();window.dispatchEvent(new WheelEvent('wheel',{deltaY:550,bubbles:true,cancelable:true}));await new Promise(resolve=>{let count=0;function frame(t){frames.push(t-previous);previous=t;if(++count<90)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});return frames.slice(1);});
const keyboard=page.getByRole('button',{name:'执行当前战术',exact:true});await keyboard.focus();const focused=await keyboard.evaluate(el=>el===document.activeElement);
await page.emulateMedia({reducedMotion:'reduce'});await page.locator('html[data-motion=off]').waitFor();await capture('reduced-motion');
await writeFile('docs/upgrade-browser-audit.json',JSON.stringify({generatedAt:new Date().toISOString(),browser:'Chromium headless',deviceScaleFactor:1,captures,errors,keyboardFocus:focused,frameSample:{count:frameIntervals.length,meanMs:frameIntervals.reduce((a,b)=>a+b,0)/frameIntervals.length,p95Ms:frameIntervals.sort((a,b)=>a-b)[Math.floor(frameIntervals.length*.95)]},limitations:'Synthetic desktop wheel/rAF sample, not a physical touch device or universal FPS guarantee. Hallmark Puppeteer renderer unavailable; Playwright used for visual checks.'},null,2));
await browser.close();if(errors.length||captures.some(c=>c.overflow||!c.meaningful))throw new Error('Browser audit failed');console.log('Browser captures and motion sample passed:',captures.length);
