import {test,expect} from '@playwright/test';
import quotes from '../../src/data/quotes.json' with {type:'json'};
import {readFile} from 'node:fs/promises';
test('快速 BO3 手动与自动、暂停、存档恢复及证据',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page).toHaveTitle(/CS2 Roundcraft/);
 await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await expect(page.getByRole('heading',{name:'Vitality',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'执行下一回合 →'}).click();await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
 await page.getByLabel('播报速度').selectOption('0');await expect(page.locator('.segment.conclusion')).toContainText('比分来到');
 await page.getByRole('button',{name:'教练暂停 · 4 次'}).click();await expect(page.getByRole('heading',{name:'暂停建议 · 三选一'})).toBeVisible();await page.getByRole('button',{name:/稳住比赛节奏 当前比分/}).click();await expect(page.getByRole('button',{name:'教练暂停 · 3 次'})).toBeDisabled();
 await page.getByRole('button',{name:'自动 3 回合',exact:true}).click();await expect(page.getByText('回放第 4 回合',{exact:true})).toBeVisible();
 const score=await page.locator('.score-center strong').innerText();await page.getByRole('button',{name:'存档',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('已保存到槽位 1');
 await page.reload();await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await expect(page.locator('.score-center strong')).toHaveText(score,{useInnerText:true});
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:test.info().outputPath('desktop-match-1440.png'),fullPage:true});
 await page.getByRole('button',{name:'模拟 BO3',exact:true}).click();await expect(page.getByText('系列赛结束',{exact:true})).toBeVisible({timeout:30000});await expect(page.locator('.result')).toContainText('赢下系列赛',{timeout:15000});expect(errors).toEqual([]);
});
test('选手搜索、弱队邀请、赛事完成',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'选手数据库',exact:true}).click();await page.getByLabel('搜索选手').fill('ZywOo');await expect(page.locator('.panel').filter({has:page.getByRole('heading',{name:'初始职业阵容',exact:true})}).locator('tbody tr')).toHaveCount(1);await page.getByRole('button',{name:'ZywOo',exact:true}).click();await expect(page.locator('.player-detail')).toContainText('法国');await expect(page.locator('.player-detail')).toContainText('狙击手');await expect(page.getByRole('region',{name:'选手资料依据'})).toContainText('HLTV 2025 年度第 1 名');await expect(page.getByRole('region',{name:'选手资料依据'})).toContainText('Major 赛事');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:test.info().outputPath('player-evidence-1440.png'),fullPage:true});await page.getByLabel('角色筛选').selectOption({label:'狙击手'});await expect(page.locator('.panel').filter({has:page.getByRole('heading',{name:'初始职业阵容',exact:true})}).locator('tbody tr')).toHaveCount(1);await page.getByLabel('搜索选手').fill('法国');await expect(page.locator('.panel').filter({has:page.getByRole('heading',{name:'初始职业阵容',exact:true})}).locator('tbody')).toContainText('ZywOo');
 await page.getByRole('button',{name:'总览',exact:true}).click();await page.getByLabel('选择起始战队').selectOption('team-46');await page.getByRole('button',{name:'开启职业生涯'}).click();await expect(page.getByRole('heading',{name:'Nuclear TigeRES',exact:true})).toBeVisible();await page.getByRole('button',{name:'我的战队',exact:true}).click();await page.locator('.roster-row select').first().selectOption({label:'辅助'});await expect(page.locator('.roster-row select').first()).toHaveValue('Support');await page.getByRole('button',{name:'存档',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('已保存到槽位 1');await page.reload();await page.getByRole('button',{name:'我的战队',exact:true}).click();await expect(page.locator('.roster-row select').first()).toHaveValue('Support');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:test.info().outputPath('chinese-team.png'),fullPage:true});
 await page.getByRole('button',{name:'赛事中心',exact:true}).click();const major=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Major 世界锦标赛 6',exact:true})});await expect(major).toContainText('当前排名未获得邀请');
 await page.getByRole('button',{name:'模拟当前 / 下一赛事'}).click();await expect(page.getByRole('status').filter({hasText:'模拟完成'})).toBeVisible({timeout:30000});await expect(page.locator('.event-list .panel').first()).toContainText('冠军：');
});
for(const width of [1280,1024,390])test(`${width}px 主要操作无横向页面溢出`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByRole('button',{name:'执行下一回合 →'}).click();await page.getByLabel('播报速度').selectOption('0');await expect(page.locator('.segment.conclusion')).toBeVisible();
 const dimensions=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth,dpr:window.devicePixelRatio}));expect(dimensions.scroll).toBeLessThanOrEqual(width);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:test.info().outputPath(`match-${width}.png`),fullPage:true});
});
test('沙盒自建队 BO5 禁选及完整系列',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'配置沙盒',exact:true}).click();await page.getByLabel('系列赛制').selectOption('5');await page.getByLabel('自建五人阵容').check();await page.getByLabel('战队名称').fill('测试梦之队');await page.getByLabel('位置 1',{exact:true}).selectOption('team-1-p1');await page.getByRole('button',{name:'进入地图禁选 →'}).click();await expect(page.getByRole('heading',{name:'测试梦之队',exact:true})).toBeVisible();await page.getByRole('button',{name:'自动完成禁选'}).click();await expect(page.locator('.map-strip>div')).toHaveCount(5);await page.getByRole('button',{name:'模拟 BO5',exact:true}).click();await expect(page.getByText('系列赛结束',{exact:true})).toBeVisible({timeout:30000});
});

test('玩家语录出处、备份导出导入、非法导入不覆盖当前状态',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByRole('button',{name:'执行下一回合 →'}).click();await page.getByLabel('播报速度').selectOption('0');
 const first=page.locator('.segment').first();await expect(first).toContainText('手枪局');
 const text=await first.innerText(),opening=quotes.filter(q=>['RQ-1-8','RF-1-6','RW-1-1'].includes(q.id)).find(q=>text.includes(q.text));
 expect(opening).toBeDefined();await first.locator('summary').click();await expect(first).toContainText(`语录出处：${opening!.source}`);
 await expect(page.locator('.segment').first()).toContainText('小蜜蜂');await expect(page.getByRole('heading',{name:'Vitality',exact:true,level:1})).toBeVisible();await expect(page.getByRole('heading',{name:'黑豹',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'存档',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON',exact:true}).click();const download=await downloadPromise;const path=await download.path();expect(path).toBeTruthy();
 await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":999}')});await expect(page.getByRole('alert')).toContainText('不支持的存档版本');
 await page.locator('input[type=file]').setInputFiles(path!);await expect(page.getByRole('status')).toContainText('存档已验证并导入');await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
});

test('后台赛季可以取消，并保留完整赛事边界进度',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开启职业生涯'}).click();await page.getByRole('button',{name:'赛事中心',exact:true}).click();await page.getByRole('button',{name:'后台完成本赛季',exact:true}).click();await expect(page.getByRole('button',{name:'停止模拟',exact:true})).toBeVisible();await page.getByRole('button',{name:'停止模拟',exact:true}).click();await expect(page.getByRole('status')).toContainText('已在安全边界停止模拟并保存进度',{timeout:20000});
 await page.getByRole('button',{name:'存档',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('已保存到槽位 1');await page.reload();await expect(page.getByRole('status')).toContainText('已恢复上次自动存档');
});

test('推进至 Major 并只进入玩家队伍对局',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'开启职业生涯'}).click();await page.getByRole('button',{name:'赛事中心',exact:true}).click();
 const major=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Major 世界锦标赛 6',exact:true})});await major.getByRole('button',{name:'开启赛事',exact:true}).click();await expect(page.locator('.breadcrumb')).toContainText('职业生涯',{timeout:60000});await expect(page.getByRole('heading',{name:'Vitality',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'自动完成禁选',exact:true}).click();await page.getByRole('button',{name:'执行下一回合 →'}).click();await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'存档',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('已保存到槽位 1');await page.reload();await expect(page.getByRole('status')).toContainText('已恢复上次自动存档');await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await expect(page.locator('.breadcrumb')).toContainText('职业生涯');expect(errors).toEqual([]);
});

test('逐段解说同步现场存活，不提前展示结算统计',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();
 await page.getByLabel('播报速度').selectOption('-1');await page.getByRole('button',{name:'执行下一回合 →'}).click();
 await expect(page.getByTestId('live-state')).toContainText('存活 5 : 5');await expect(page.getByRole('region',{name:'己方选手 · Vitality',exact:true}).getByTestId('match-player')).toHaveCount(5);await expect(page.getByRole('region',{name:'对方选手 · FURIA',exact:true}).getByTestId('match-player')).toHaveCount(5);for(const meter of await page.getByRole('meter').all())await expect(meter).toHaveAttribute('aria-valuenow','100');await expect(page.getByTestId('live-state')).toContainText('比分 0 : 0');await expect(page.locator('.map-strip>div').first()).toContainText('0 : 0');
 await expect(page.getByRole('heading',{name:'系列技术统计',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'继续下一段',exact:true}).click();await expect(page.locator('.segment')).toHaveCount(2);
 await page.getByRole('button',{name:'展开本回合全部解说',exact:true}).click();await expect(page.getByTestId('live-state')).toContainText('回合结束');await expect(page.getByTestId('match-player')).toHaveCount(10);expect(await page.locator('.match-player.is-dead').count()).toBeGreaterThan(0);await page.locator('.statistics-disclosure>summary').click();await expect(page.getByRole('heading',{name:'系列技术统计',exact:true})).toBeVisible();
});

test('生涯对局不覆盖最近沙盒，沙盒可恢复原回合',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByRole('button',{name:'执行下一回合 →'}).click();
 await page.getByRole('button',{name:'总览',exact:true}).click();await page.getByRole('button',{name:'开启职业生涯',exact:true}).click();await page.getByRole('button',{name:'赛事中心',exact:true}).click();
 await page.getByRole('button',{name:'开启赛事',exact:true}).first().click();await expect(page.locator('.breadcrumb')).toContainText('职业生涯');
 await page.getByRole('button',{name:'沙盒',exact:true}).click();await expect(page.getByRole('button',{name:'继续 / 回看最近沙盒对局',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await page.getByRole('button',{name:'自动完成禁选',exact:true}).click();await page.getByRole('button',{name:'模拟 BO3',exact:true}).click();
 await expect(page.getByRole('button',{name:'结算并返回赛事',exact:true})).toBeVisible({timeout:15000});
 await page.getByLabel('播报速度').selectOption('0');
 const result=await page.locator('.result').innerText();
 await page.getByRole('button',{name:'总览',exact:true}).click();
 await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();
 await expect(page.locator('.breadcrumb')).toContainText('职业生涯');
 await expect(page.locator('.result')).toHaveText(result,{useInnerText:true});
 await page.reload();await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await expect(page.locator('.result')).toHaveText(result,{useInnerText:true});
 await page.getByRole('button',{name:'结算并返回赛事',exact:true}).click();
 await page.getByRole('button',{name:'沙盒',exact:true}).click();await page.getByRole('button',{name:'继续 / 回看最近沙盒对局',exact:true}).click();await expect(page.locator('.breadcrumb')).toContainText('独立沙盒');await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
});

test('自动恢复失败保留原件，新进度建立前归档可导出备份',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'开启职业生涯',exact:true})).toBeVisible();
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('cs-tactics-manager',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({schemaVersion:999,marker:'preserve-original'},'autosave');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);}));
 await page.reload();await expect(page.getByRole('alert')).toContainText('原自动存档已保留');
 const original=await page.evaluate(()=>new Promise<unknown>((resolve,reject)=>{const request=indexedDB.open('cs-tactics-manager',1);request.onsuccess=()=>{const db=request.result,get=db.transaction('saves').objectStore('saves').get('autosave');get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};}));expect(original).toEqual({schemaVersion:999,marker:'preserve-original'});
 await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByRole('button',{name:'存档',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出最近恢复备份',exact:true}).click();const path=await(await pending).path();expect(JSON.parse(await readFile(path!,'utf8'))).toEqual(original);
 await page.reload();await expect(page.getByRole('status')).toContainText('已恢复上次自动存档');
});




test('完整十二项能力与双人对比',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'选手数据库',exact:true}).click();
 await page.getByLabel('搜索选手').fill('ZywOo');await page.getByRole('button',{name:'对比 ZywOo',exact:true}).click();
 await page.getByLabel('搜索选手').fill('donk');await page.getByRole('button',{name:'对比 donk',exact:true}).click();
 const compare=page.locator('.panel').filter({has:page.getByRole('heading',{name:'选手能力对比',exact:true})});
 await expect(compare.locator('meter')).toHaveCount(24);await expect(compare.getByText('全部 12 项游戏能力',{exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'清空对比'}).click();await expect(compare).toHaveCount(0);
});
test('详略切换保持事件位置，滑动阅读不抢回底部',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();
 await page.getByLabel('播报速度').selectOption('-1');await page.getByRole('button',{name:'执行下一回合 →'}).click();
 await page.getByRole('button',{name:'继续下一段',exact:true}).click();const before=await page.getByTestId('live-state').innerText();
 await page.getByRole('button',{name:'精简',exact:true}).click();await expect(page.getByTestId('live-state')).toHaveText(before);
 await page.getByRole('button',{name:'详解',exact:true}).click();await expect(page.getByTestId('live-state')).toHaveText(before);
 await page.getByRole('button',{name:'展开本回合全部解说',exact:true}).click();const feed=page.locator('.commentary-feed');
 await feed.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});await expect(page.getByRole('button',{name:'回到最新',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'回到最新',exact:true}).click();await expect(page.getByRole('button',{name:'回到最新',exact:true})).toHaveCount(0);
 await page.getByLabel('解说事件进度').fill('1');await expect(page.getByTestId('live-state')).toContainText('存活 5 : 5');
});
test('动效偏好持久化与系统减少动态效果',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'动效 开',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-motion','off');
 await page.getByRole('button',{name:'顺滑滚动 开',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'动效 关',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'顺滑滚动 关',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'动效 关',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('html')).toHaveAttribute('data-motion','off');
});
