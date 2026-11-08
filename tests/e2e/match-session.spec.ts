import {test,expect,type Page} from '@playwright/test';
const start=async(page:Page)=>{
 await page.goto('/');
 await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();
 await page.getByLabel('播报速度').selectOption('-1');
 await page.getByRole('button',{name:'手动',exact:true}).click();
};
const next=(page:Page)=>page.getByRole('button',{name:'执行下一回合 →',exact:true});
const choose=(page:Page,name:string)=>page.getByRole('group',{name:'战术方案'}).getByRole('button',{name,exact:true}).click();
const buy=(page:Page,name:string)=>page.getByRole('group',{name:'经济策略',exact:true}).getByRole('button',{name,exact:true});

test('查资料后保留指令、历史回放位置，执行仍使用原草稿',async({page})=>{
 await start(page);await next(page).click();
 await page.getByRole('button',{name:'展开手动设置'}).click();
 await choose(page,'快速 B 爆弹');await buy(page,'经济局').click();
 await page.locator('.battle-plan-editor summary').click();await page.getByLabel('烟雾处理').selectOption('cross');
 await page.getByText('五人初始站位与路线',{exact:true}).click();
 const position=page.locator('.position-pair').first().locator('select').first();
 await position.selectOption({index:1});const chosenPosition=await position.inputValue();
 await page.getByLabel('解说事件进度').fill('5');
 await page.getByLabel('回放回合').selectOption('0');
 await page.getByLabel('解说事件进度').fill('5');
 await page.getByRole('button',{name:'选手数据库',exact:true}).click();
 await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await expect(page.getByRole('group',{name:'战术方案'}).getByRole('button',{name:'快速 B 爆弹',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(buy(page,'经济局')).toHaveAttribute('aria-pressed','true');
 await page.locator('.battle-plan-editor summary').click();await expect(page.getByLabel('烟雾处理')).toHaveValue('cross');
 await page.getByText('五人初始站位与路线',{exact:true}).click();await expect(position).toHaveValue(chosenPosition);
 await expect(page.getByLabel('回放回合')).toHaveValue('0');
 await expect(page.getByLabel('解说事件进度')).toHaveValue('5');
 await expect(page.getByRole('switch',{name:'连播'})).not.toBeChecked();
 await next(page).click();await page.getByLabel('播报速度').selectOption('0');
 await page.getByRole('button',{name:'战术复盘',exact:true}).click();
 await expect(page.locator('.review')).toContainText('快速 B 爆弹');
 await page.getByRole('button',{name:'精确账本',exact:true}).click();
 await page.getByText('逐人经济账本 · 第 2 回合',{exact:true}).click();
 const spending=await page.locator('.economy-ledger tbody tr').evaluateAll(rows=>rows.slice(0,5).map(row=>row.children[2].textContent));
 expect(spending).toEqual(['0','0','0','0','0']);
});

test('翻阅旧解说后切页返回保留滚动位置与跟随状态',async({page})=>{
 await start(page);await page.getByRole('button',{name:'动效 开',exact:true}).click();
 await next(page).click();await page.getByLabel('播报速度').selectOption('0');
 const feed=page.locator('.commentary-feed');
 await expect.poll(()=>feed.evaluate(el=>el.scrollTop)).toBeGreaterThan(60);
 await feed.evaluate(el=>{el.scrollTop=25;el.dispatchEvent(new Event('scroll'));});
 await expect(page.getByRole('button',{name:'回到最新',exact:true})).toBeVisible();
 const before=await feed.evaluate(el=>el.scrollTop);
 await page.getByRole('button',{name:'存档',exact:true}).click();
 await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await expect(page.getByRole('button',{name:'回到最新',exact:true})).toBeVisible();
 await expect.poll(()=>feed.evaluate(el=>el.scrollTop)).toBe(before);
});

test('调速不倒退、不解除阅读暂停，直接显示仍可展开全部',async({page})=>{
 await start(page);await next(page).click();await page.getByLabel('解说事件进度').fill('5');
 for(const speed of ['2500','1000','-1']){
  await page.getByLabel('播报速度').selectOption(speed);
  await expect(page.getByLabel('解说事件进度')).toHaveValue('5');
  await expect(page.getByRole('button',{name:'继续播报',exact:true})).toHaveCount(1);
 }
 await page.getByLabel('播报速度').selectOption('0');
 await expect(page.getByTestId('live-state')).toContainText('回合结束');
 const position=await page.getByLabel('解说事件进度').inputValue();
 await page.getByLabel('播报速度').selectOption('1000');
 await expect(page.getByLabel('解说事件进度')).toHaveValue(position);
});

test('离开比赛停止连播，返回暂停阅读并保留进度',async({page})=>{
 await start(page);await page.getByLabel('播报速度').selectOption('0');await next(page).click();
 await page.getByRole('switch',{name:'连播'}).check();
 await page.getByRole('button',{name:'选手数据库',exact:true}).click();
 await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await expect(page.getByRole('switch',{name:'连播'})).not.toBeChecked();
 const rounds=await page.getByLabel('回放回合').locator('option').count();
 await page.waitForTimeout(2100);
 expect(await page.getByLabel('回放回合').locator('option').count()).toBe(rounds);
});

test('同种子重开和载入同 ID 存档不继承上一局草稿',async({page})=>{
 await start(page);await choose(page,'快速 B 爆弹');await buy(page,'经济局').click();
 await page.getByRole('button',{name:'沙盒',exact:true}).click();
 await page.getByRole('button',{name:'进入地图禁选 →'}).click();
 await page.getByRole('button',{name:'自动完成禁选'}).click();
 await expect(buy(page,'自动')).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('group',{name:'战术方案'}).getByRole('button',{name:'默认控图',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'存档',exact:true}).click();
 await page.getByRole('button',{name:'保存',exact:true}).first().click();
 await expect(page.getByRole('status')).toContainText('已保存到槽位 1');
 await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await choose(page,'快速 B 爆弹');await buy(page,'经济局').click();
 await page.getByRole('button',{name:'存档',exact:true}).click();
 await page.getByRole('button',{name:'载入',exact:true}).first().click();
 await expect(page.getByRole('status')).toContainText('存档已载入');
 await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await expect(buy(page,'自动')).toHaveAttribute('aria-pressed','true');
});
