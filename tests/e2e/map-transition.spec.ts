import {test,expect} from '@playwright/test';
test('same-side map transition clears previous map positions before another manual round',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'开启职业生涯'})).toBeVisible();
 const prepared=await page.evaluate(async()=>{
 const source=(path:string)=>import(path);
 const {newWorld}=await source('/src/data/index.ts');
 const {createSeries,autoVeto,sidesForRound}=await source('/src/domain/series.ts');
 const {resolveRound}=await source('/src/domain/engine.ts');
 const {defaultDecision}=await source('/src/domain/tactics.ts');
 const {getMap}=await source('/src/domain/maps.ts');
 const {makeSave}=await source('/src/domain/save.ts');
 const series=createSeries(newWorld(),'team-3','team-7',3,20261005);autoVeto(series);
 let before=structuredClone(series), found=false;
 for(let i=0;i<100;i++){
  const map=series.mapStates.at(-1)!;const side=sidesForRound(map.startSide,map.rounds.length)[0];
  const positions={[series.teams[0].startingFive[0]]:getMap(map.map).siteA};
  before=structuredClone(series);resolveRound(series,{0:{...defaultDecision(side),positions}});
  const next=series.mapStates.at(-1)!;
  if(next.map!==map.map){found=sidesForRound(next.startSide,0)[0]===side;break;}
 }
 return {found,save:makeSave(null,before,null),position:getMap(before.mapStates.at(-1)!.map).siteA};
 });
 expect(prepared.found).toBe(true);
 await page.evaluate(save=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('cs-tactics-manager',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(save,'autosave');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
 }),prepared.save);
 await page.reload();await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();
 await page.getByLabel('播报速度').selectOption('0');
 await page.getByText('五人初始站位与路线',{exact:true}).click();
 const position=page.locator('.position-pair').first().locator('select').first();
 await position.selectOption(prepared.position);
 await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 await expect(position).toHaveValue('');
 await page.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
});
