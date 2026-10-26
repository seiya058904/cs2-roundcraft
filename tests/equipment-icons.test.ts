import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WeaponIcon,GearIcon} from '../src/EquipmentIcon';
import {WEAPONS} from '../src/domain/economy';

it('每把实际武器均使用独立且型号匹配的本地资源',()=>{
 const expected:Record<string,string>={'AK-47':'ak47','M4A1-S':'m4a1_silencer',AWP:'awp',FAMAS:'famas',Galil:'galilar',MP9:'mp9','MAC-10':'mac10',Glock:'glock','USP-S':'usp_silencer',P250:'p250','Five-SeveN':'fiveseven','Tec-9':'tec9',Deagle:'deagle'};
 expect(Object.keys(expected).sort()).toEqual(Object.keys(WEAPONS).sort());
 for(const [weapon,file] of Object.entries(expected))expect(renderToStaticMarkup(createElement(WeaponIcon,{weapon}))).toContain(`/${file}.svg`);
 expect(renderToStaticMarkup(createElement(WeaponIcon,{weapon:'unknown'}))).toBe('');
});
it('燃烧物按阵营区分，双闪与装备中文提示保留',()=>{
 expect(renderToStaticMarkup(createElement(GearIcon,{kind:'fire',side:'T',label:'燃烧瓶'}))).toContain('/molotov.svg');
 expect(renderToStaticMarkup(createElement(GearIcon,{kind:'fire',side:'CT',label:'燃烧弹'}))).toContain('/incgrenade.svg');
 const flash=renderToStaticMarkup(createElement(GearIcon,{kind:'flash',label:'闪光弹 × 2',count:2}));
 expect(flash).toContain('aria-label="闪光弹 × 2"');expect(flash).toContain('<small>2</small>');
 expect(renderToStaticMarkup(createElement(GearIcon,{kind:'helmet',label:'头盔'}))).toContain('/helmet.svg');
 expect(renderToStaticMarkup(createElement(GearIcon,{kind:'armor',label:'护甲 100'}))).toContain('/kevlar.svg');
 expect(renderToStaticMarkup(createElement(GearIcon,{kind:'kit',label:'拆弹器'}))).toContain('/defuser.svg');
});
