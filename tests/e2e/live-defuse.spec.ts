import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';

test('真实拆包开始逐段显示证据，尚未揭示后续结果，存档重载可恢复',async({page})=>{
 const {save,index,at}=JSON.parse(execFileSync(process.execPath,['--import','tsx','scripts/make-live-defuse-fixture.mts'],{encoding:'utf8',maxBuffer:20_000_000}));
 await page.goto('/');await expect(page.getByRole('button',{name:'开启职业生涯',exact:true})).toBeVisible();
 await page.evaluate(async data=>{localStorage.setItem('ctm-speed','-1');await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('cs-tactics-manager',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(data,'autosave');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);});},save);
 await page.reload();await expect(page.getByRole('status')).toContainText('已恢复上次自动存档');await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await page.getByLabel('解说事件进度').fill(String(index+1));await expect(page.getByTestId('live-state')).toContainText(`${at} 秒`);await expect(page.getByTestId('live-state')).toContainText('播报进行中');
 const line=page.locator('.segment').nth(index);await expect(line).toContainText('拆包');await line.locator('summary').click();await expect(line).toContainText('开始拆包');await expect(line).not.toContainText('拆除炸弹');
 await page.reload();await expect(page.getByRole('status')).toContainText('已恢复上次自动存档');await expect(page.getByRole('alert')).toHaveCount(0);
});
