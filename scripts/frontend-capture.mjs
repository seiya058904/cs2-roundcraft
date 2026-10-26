import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.argv[2]??'before';
const root=process.env.CAPTURE_DIR??'artifacts/frontend-refresh';
const out=`${root}/${phase}`;mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'开启职业生涯',exact:true}).click();
const nav=page.getByRole('navigation',{name:'主导航'});
const metrics=[];const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
async function measure(name,fn){const start=await cdp.send('Performance.getMetrics');const wall=performance.now();await fn();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const end=await cdp.send('Performance.getMetrics');const values={};for(const key of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'])values[key]=(end.metrics.find(m=>m.name===key)?.value??0)-(start.metrics.find(m=>m.name===key)?.value??0);metrics.push({name,wallMs:performance.now()-wall,...values});}
await nav.getByRole('button',{name:'选手数据库',exact:true}).click();
for(let i=0;i<5;i++)await measure('filter',async()=>{await page.getByRole('textbox',{name:'搜索选手'}).fill(i%2?'':'Zyw');});
await page.getByRole('textbox',{name:'搜索选手'}).fill('');
for(let i=0;i<5;i++)await measure('navigation',()=>nav.getByRole('button',{name:i%2?'选手数据库':'我的战队',exact:true}).click());
await nav.getByRole('button',{name:'总览',exact:true}).click();await page.getByRole('button',{name:/快速开赛/}).click();
await page.getByLabel('播报速度').selectOption('-1');await page.getByRole('button',{name:/^执行当前战术$|^执行下一回合/}).first().click();
for(let i=0;i<5;i++)await measure('replay',()=>page.getByRole('button',{name:'继续下一段',exact:true}).click());
const checks=[];
for(const width of [1440,1280,1024,390]){
 await page.setViewportSize({width,height:width===1280?800:1000});
 for(const [id,label] of [['home','总览'],['match','比赛指挥台'],['team','我的战队'],['players','选手数据库'],['events','赛事中心'],['transfer','转会窗口'],['sandbox','沙盒'],['saves','存档'],['about','数据与规则']]){
  await nav.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(350);
  checks.push({id,width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),title:await page.title()});
  await page.screenshot({path:`${out}/${id}-${width}.png`,fullPage:true});
 }
}
writeFileSync(`${root}/${phase}.json`,JSON.stringify({phase,generatedAt:new Date().toISOString(),errors,metrics,checks},null,2));await browser.close();console.log(JSON.stringify({out,errors,checks:checks.length,overflow:checks.filter(x=>x.overflow)}));
