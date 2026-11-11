import {test,expect,type Page} from '@playwright/test';
const next=(page:Page)=>page.getByRole('button',{name:'执行下一回合 →',exact:true});
const saved=(page:Page)=>expect(page.getByTestId('autosave-status')).toHaveText('已保存');
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();await page.getByLabel('播报速度').selectOption('0');await saved(page);}
async function storedRounds(page:Page,slot='autosave'){return page.evaluate(async slot=>{const source=(path:string)=>import(path);const {loadSlot}=await source('/src/storage.ts');return (await loadSlot(slot))?.match?.mapStates[0].rounds.length;},slot);}
async function abortNextWrite(page:Page,key:string){await page.evaluate(key=>{
 const original=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(value,slot){const request=original.call(this,value,slot);if(slot===key){IDBObjectStore.prototype.put=original;request.addEventListener('success',()=>request.transaction!.abort(),{once:true});}return request;};
},key);}
const slotOne=(page:Page)=>page.locator('.save-slots .panel').first();

test('事务中止可见、可重试，下一次自动保存不会堵在旧队列',async({page})=>{
 await start(page);await abortNextWrite(page,'autosave');await next(page).click();
 await expect(page.getByTestId('autosave-status')).toHaveText('保存失败');
 await expect(page.getByRole('alert')).toContainText('事务已中止');expect(await storedRounds(page)).toBe(0);
 await page.getByRole('button',{name:'重试保存'}).click();await saved(page);expect(await storedRounds(page)).toBe(1);
 await abortNextWrite(page,'autosave');await next(page).click();await expect(page.getByTestId('autosave-status')).toHaveText('保存失败');
 await next(page).click();await saved(page);expect(await storedRounds(page)).toBe(3);
 await page.reload();await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await expect(page.getByText('回放第 3 回合',{exact:true})).toBeVisible();
});

test('槽位摘要、载入回退与刷新恢复保留完整进度',async({page})=>{
 await start(page);await next(page).click();await saved(page);await page.getByRole('button',{name:'存档',exact:true}).click();
 await expect(slotOne(page)).toContainText('空槽位');await expect(slotOne(page).getByRole('button',{name:'载入',exact:true})).toBeDisabled();
 await slotOne(page).getByRole('button',{name:'保存',exact:true}).click();await expect(slotOne(page)).toContainText('已完成 1 回合');await expect(slotOne(page).locator('time')).toHaveAttribute('datetime',/T/);
 await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await next(page).click();await saved(page);
 await page.getByRole('button',{name:'存档',exact:true}).click();await slotOne(page).getByRole('button',{name:'载入',exact:true}).click();await expect(page.getByRole('status')).toContainText('存档已载入');
 expect(await storedRounds(page)).toBe(1);expect(await storedRounds(page,'replacement-backup')).toBe(2);
 await page.getByRole('button',{name:'恢复替换前进度'}).click();await saved(page);await expect.poll(()=>storedRounds(page)).toBe(2);
 await page.reload();await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await expect(page.getByText('回放第 2 回合',{exact:true})).toBeVisible();
});

test('备份写入失败不替换当前进度或手动槽位，成功覆盖只保留一份备份',async({page})=>{
 await start(page);await next(page).click();await saved(page);await page.getByRole('button',{name:'存档',exact:true}).click();await slotOne(page).getByRole('button',{name:'保存',exact:true}).click();await expect(slotOne(page)).toContainText('已完成 1 回合');
 await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await next(page).click();await saved(page);await page.getByRole('button',{name:'存档',exact:true}).click();
 await abortNextWrite(page,'replacement-backup');await slotOne(page).getByRole('button',{name:'载入',exact:true}).click();await expect(page.getByRole('alert')).toContainText('当前进度保留');expect(await storedRounds(page)).toBe(2);
 await page.getByRole('button',{name:'重试保存'}).click();await saved(page);
 await abortNextWrite(page,'replacement-backup');await slotOne(page).getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByRole('alert')).toContainText(/事务已中止|存档读写失败/);expect(await storedRounds(page,'slot-1')).toBe(1);
 await slotOne(page).getByRole('button',{name:'保存',exact:true}).click();await expect(slotOne(page)).toContainText('已完成 2 回合');expect(await storedRounds(page,'replacement-backup')).toBe(1);
 await slotOne(page).getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByRole('status')).toContainText('已保存到槽位 1');
 const keys=await page.evaluate(()=>new Promise<IDBValidKey[]>((resolve,reject)=>{const r=indexedDB.open('cs-tactics-manager',1);r.onsuccess=()=>{const db=r.result,get=db.transaction('saves').objectStore('saves').getAllKeys();get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};}));
 expect(keys.filter(k=>String(k).startsWith('replacement-'))).toEqual(['replacement-backup']);
});

test('导入保存替换前备份，重复选择同一个文件也可导入',async({page})=>{
 await start(page);await next(page).click();await saved(page);
 const original=await page.evaluate(async()=>{const source=(p:string)=>import(p);return (await source('/src/storage.ts')).loadSlot('autosave');});
 await next(page).click();await saved(page);await page.getByRole('button',{name:'存档',exact:true}).click();
 const file={name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))};
 await page.locator('input[type=file]').setInputFiles(file);await expect(page.getByRole('status')).toContainText('存档已验证并导入');expect(await storedRounds(page,'replacement-backup')).toBe(2);
 await page.getByRole('button',{name:'恢复替换前进度'}).click();await expect.poll(()=>storedRounds(page)).toBe(2);
 await page.locator('input[type=file]').setInputFiles(file);await expect.poll(()=>storedRounds(page)).toBe(1);expect(await storedRounds(page,'replacement-backup')).toBe(2);
});
