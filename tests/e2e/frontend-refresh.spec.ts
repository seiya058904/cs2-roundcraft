import {test,expect} from '@playwright/test';
const start=async(page:import('@playwright/test').Page)=>{await page.goto('/');await page.getByRole('button',{name:'快速开赛 · Vitality vs FURIA →'}).click();};
for(const width of [1440,1280,1024,390])test(`观战布局与指挥入口 ${width}`,async({page})=>{
 await page.setViewportSize({width,height:800});await start(page);
 const command=page.getByRole('region',{name:'战术指令',exact:true}),board=page.getByRole('region',{name:'双方选手对比',exact:true});
 const c=await command.boundingBox(),b=await board.boundingBox();expect(c!.y+c!.height).toBeLessThan(b!.y);
 await expect(board.getByTestId('match-player')).toHaveCount(10);
 for(const row of await board.locator('.match-player').all()){await expect(row.locator('.player-cash')).toBeVisible();await expect(row.locator('.player-weapon')).toBeVisible();await expect(row.locator('.player-gear')).toBeVisible();}
 const left=await board.locator('.own-roster .match-player').all(),right=await board.locator('.enemy-roster .match-player').all();
 for(let i=0;i<5;i++){const a=await left[i].boundingBox(),b=await right[i].boundingBox();expect(Math.abs(a!.y-b!.y)).toBeLessThan(1);expect(a!.x+a!.width).toBeLessThan(b!.x);}
 if(width===1280)expect(b!.y+b!.height).toBeLessThanOrEqual(800);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel('播报速度').selectOption('-1');await command.getByRole('button',{name:'执行下一回合 →',exact:true}).click();
 await expect(board).toContainText('购买后现金 / 开局护甲');await expect(board.locator('.player-kd').first()).toHaveText('击杀 0死亡 0');
 await page.getByRole('button',{name:'展开本回合全部解说'}).click();await expect(board).toContainText('结算现金 / 最终护甲');
 const dead=board.locator('.is-dead');expect(await dead.count()).toBeGreaterThan(0);await expect(dead.first().locator('.player-weapon')).toHaveCount(0);await expect(dead.first().locator('.player-cash')).toBeVisible();
});
test('吸顶与主操作共享执行，连续同轮点击不会重复提交',async({page})=>{
 await start(page);const button=page.locator('.execute-round');await button.evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
 await expect(page.getByText('回放第 1 回合',{exact:true})).toBeVisible();
 await page.locator('.match-main').scrollIntoViewIfNeeded();await expect(page.getByRole('region',{name:'战术指令',exact:true})).not.toBeInViewport();
 const quick=page.getByRole('button',{name:'快捷执行下一回合 →',exact:true});await expect(quick).toBeVisible();await quick.click();await expect(page.getByText('回放第 2 回合',{exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'选手数据库',exact:true}).click();await expect(quick).toHaveCount(0);
});
test('规则阅读、空筛选、存档失败和键盘焦点',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'数据与规则',exact:true}).click();await page.getByText('模拟边界',{exact:true}).click();await expect(page.getByText(/MR12 常规赛/)).toBeVisible();
 await page.getByRole('button',{name:'选手数据库',exact:true}).click();await page.getByLabel('搜索选手').fill('不存在的选手abcdef');await expect(page.getByText('没有符合筛选条件的选手，请调整昵称或职责。')).toBeVisible();
 await page.getByLabel('搜索选手').focus();await page.keyboard.press('Tab');await expect(page.getByLabel('角色筛选')).toBeFocused();
 await page.getByRole('button',{name:'存档',exact:true}).click();await page.getByRole('button',{name:'载入',exact:true}).first().click();await expect(page.getByRole('alert')).toContainText('该槽位为空');
});

test('窄屏长职业名与三位数生命值不会相互挤占',async({page})=>{
 await page.setViewportSize({width:390,height:844});await start(page);
 await page.locator('.player-identity>strong').evaluateAll(names=>names.forEach(name=>name.textContent='VeryLongProfessionalNickname'));
 const geometry=await page.locator('.match-player').evaluateAll(rows=>rows.map(row=>{
  const name=row.querySelector('.player-identity')!.getBoundingClientRect();
  const hp=row.querySelector<HTMLElement>('.player-hp')!;const box=hp.getBoundingClientRect();
  return {separate:name.right<=box.left||box.right<=name.left,hpFits:hp.scrollWidth<=hp.clientWidth+1};
 }));
 expect(geometry).toHaveLength(10);expect(geometry.every(x=>x.separate&&x.hpFits)).toBe(true);
});

test('客方生涯固定在左，历史回放隐藏后续赛果，换边不交换选手列',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'开启职业生涯',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  // These modules are served by Vite inside the isolated browser, not resolved by Node.
  const source='/src/';
  const {newWorld}=await import(source+'data/index.ts');const {createCareer,startEvent,fixtureSeries}=await import(source+'domain/career.ts');
  const {autoVeto}=await import(source+'domain/series.ts');const {simulateSeries}=await import(source+'domain/engine.ts');
  const {makeSave}=await import(source+'domain/save.ts');const {saveSlot}=await import(source+'storage.ts');
  const career=createCareer(newWorld(),'team-3',20261005);const event=career.calendar[0];startEvent(career,event.id);
  const next=event.tournament.fixtures[0];career.managedTeamId=next.b;
  const match=fixtureSeries(career.world,event.tournament,next);autoVeto(match);simulateSeries(match);
  await saveSlot('autosave',makeSave(career,match,{eventId:event.id,fixtureId:next.id}));
  const round=match.mapStates[0].rounds[0];
  return {team:match.teams[1].name,score:[round.score[1],round.score[0]].join(' : ')};
 });
 await page.reload();await page.getByRole('button',{name:'比赛指挥台',exact:true}).click();await page.getByLabel('播报速度').selectOption('0');
 await page.getByLabel('回放回合').selectOption('0');await expect(page.locator('.own-roster h3')).toHaveText(fixture.team);
 await expect(page.locator('.result')).toHaveCount(0);await expect(page.locator('.map-strip>div').first().locator('span')).toHaveText(fixture.score);
 const options=await page.getByLabel('回放回合').locator('option').allTextContents();expect(options.slice(2).every(text=>!text.includes(':'))).toBe(true);
 const classes=await page.locator('.own-roster').getAttribute('class');const names=await page.locator('.own-roster .player-identity>strong').allTextContents();
 await page.getByLabel('回放回合').selectOption('12');await expect(page.locator('.own-roster')).not.toHaveAttribute('class',classes!);
 expect(await page.locator('.own-roster .player-identity>strong').allTextContents()).toEqual(names);
});
