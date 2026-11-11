import {test,expect} from '@playwright/test';
test('首回合未揭示时指挥经济、暂停和分析不泄漏结算，完整复盘是主动揭示',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByLabel('播报速度').selectOption('-1');await page.getByRole('button',{name:'动效 开',exact:true}).click();
 await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 await expect(page.getByTestId('live-state')).toContainText('存活 5 : 5 · 比分 0 : 0');
 await expect(page.locator('.command-hint')).not.toContainText('$');await expect(page.getByRole('button',{name:'教练暂停 · 待揭示'})).toBeDisabled();
 await page.getByRole('button',{name:'手动',exact:true}).click();await expect(page.locator('.buy-control')).not.toContainText('$');await page.getByRole('button',{name:'收起手动设置'}).click();
 await page.getByRole('button',{name:'场外分析',exact:true}).click();await expect(page.locator('.desk-leaders')).toHaveCount(0);await expect(page.locator('.score-center strong')).toHaveText(/0\s*:\s*0/);
 await page.getByRole('button',{name:'现场解说',exact:true}).click();await expect(page.getByLabel('解说事件进度')).toHaveValue('1');
 await page.getByRole('button',{name:'战术复盘',exact:true}).click();await expect(page.locator('.review')).toContainText('赢下回合');
 await page.getByRole('button',{name:'现场解说',exact:true}).click();await expect(page.getByTestId('live-state')).toContainText('回合结束');await expect(page.getByRole('button',{name:/教练暂停 · \d+ 次/})).toBeEnabled();
 await page.getByRole('button',{name:'场外分析',exact:true}).click();await expect(page.locator('.desk-leaders li')).toHaveCount(3);
});

test('历史回放和已结束系列的未揭示回合不显示最新指挥状态',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByLabel('播报速度').selectOption('-1');
 await page.getByRole('button',{name:'模拟 BO3',exact:true}).click();await expect(page.locator('.result')).toBeVisible({timeout:30000});
 await page.getByLabel('回放回合').selectOption('0');await expect(page.getByTestId('live-state')).toContainText('比分 0 : 0');await expect(page.locator('.command-status')).toHaveCount(0);
 await expect(page.locator('.command-hint')).not.toContainText('$');await page.getByRole('button',{name:'场外分析',exact:true}).click();await expect(page.locator('.desk-leaders')).toHaveCount(0);
 await page.getByRole('button',{name:'显示本回合结果'}).click();await expect(page.locator('.desk-leaders li')).toHaveCount(3);await expect(page.locator('.command-hint')).not.toContainText('$');
 await page.getByRole('button',{name:'现场解说',exact:true}).click();await page.getByLabel('回放回合').selectOption('-1');await expect(page.locator('.result')).toHaveCount(0);await expect(page.locator('.command-status')).toHaveCount(0);
 await page.getByRole('button',{name:'展开本回合全部解说'}).click();await expect(page.locator('.result')).toBeVisible();
});
