import {test,expect} from '@playwright/test';
const start=async(page:import('@playwright/test').Page)=>{await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();};

test('指挥档位：默认均衡，托管可执行，档位偏好在刷新后保留',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 const modes=page.getByRole('group',{name:'指挥档位'});
 await expect(modes.getByRole('button',{name:'均衡',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('战术池',{exact:true})).toHaveCount(0);
 await modes.getByRole('button',{name:'托管',exact:true}).click();await expect(page.locator('.command-hint')).toContainText('教练 AI');
 await page.getByLabel('播报速度').selectOption('0');await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
 await modes.getByRole('button',{name:'激进',exact:true}).click();await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 await expect(page.getByText('回放第 2 回合',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'战术复盘',exact:true}).click();await page.getByText('本回合实际计划与执行记录',{exact:true}).click();
 await expect(page.locator('.review')).toContainText('主动施压');
 await page.reload();await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await expect(page.getByRole('group',{name:'指挥档位'}).getByRole('button',{name:'激进',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(errors).toEqual([]);
});

test('连播：默认关闭，打开后自动推进，回看历史回合时暂停，关闭后停止',async({page})=>{
 await start(page);await page.getByLabel('播报速度').selectOption('0');
 const toggle=page.getByRole('switch',{name:'连播'});await expect(toggle).not.toBeChecked();
 await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
 await toggle.check();await expect(page.getByText('回放第 3 回合',{exact:true})).toBeVisible({timeout:20000});
 await page.getByLabel('回放回合').selectOption('0');await expect(page.locator('.autoplay-note')).toContainText('回看历史回合');
 const played=await page.getByLabel('回放回合').locator('option').count();await page.waitForTimeout(3500);
 expect(await page.getByLabel('回放回合').locator('option').count()).toBe(played);
 await toggle.uncheck();await page.getByLabel('回放回合').selectOption('-1');await page.waitForTimeout(3500);
 expect(await page.getByLabel('回放回合').locator('option').count()).toBe(played);
});
