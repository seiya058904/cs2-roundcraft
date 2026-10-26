# 本地观战装备图标

枪械采用用户逐枪确认的 Lexogrine CS2 HUD SVG（commit `7874750c97fcecd8f72eb3fad382917e035ec651`），包括现有游戏全部 13 把枪。阵亡标记亦来自该 HUD。保留 `LEXOGRINE-LICENSE.txt`。

道具、头盔、胸甲与拆弹器来自 Juknum/counter-strike-icons 的 `cs2/panorama/images/icons/equipment/`（commit `92fa323cb5f954f310b8d653a7c280f5d1335163`）。该库说明素材由 CS2 游戏资源提取；对应版本文件记录 build `26144732`。保留其资产归属说明 `VALVE-ASSETS-LICENSE.md`，不将 Valve 资产描述为 MIT 授权的原创图形。

`sources.json` 记录逐文件固定来源和 SHA-256。原始 SVG 几何路径保持不变。武器使用图片等比适配，道具使用原 SVG 的透明蒙版着阵营色；没有重新描绘形状。

型号映射注意：`m4a1_silencer` → M4A1-S，`usp_silencer` → USP-S，`galilar` → Galil AR（游戏 ID Galil），`glock` → Glock-18（游戏 ID Glock），`deagle` → Desert Eagle（游戏 ID Deagle）。未知武器不再套用手枪占位图，仍由旁边的型号文字显示身份。

游戏统一的 `fire` 库存按持有者阵营显示：T → molotov／燃烧瓶；CT → incgrenade／燃烧弹。只改变显示，不修改购买、伤害、价格、回放或存档字段。
