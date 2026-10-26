> 2026-10-26 CS2 全面升级：当前实现、验证数字和剩余缺口以 [UPGRADE_REPORT.md](UPGRADE_REPORT.md) 为准；以下保留前期设计与验收记录。

# 数据来源、许可与缺口

## 官方阵容基线

- [Valve 2026-10-05 全球 VRS](https://github.com/ValveSoftware/counter-strike_regional_standings/blob/main/invitation/2026/standings_global_2026_10_05.md)：前 50 支队伍，250 个首发席位。
- [Valve VRS 官方仓库](https://github.com/ValveSoftware/counter-strike_regional_standings)：同日欧洲、美洲、亚洲榜用于完整五人阵容匹配地区，不按国籍猜测地区。
- 原文保存在 `data/source/valve-*-2026-10-05.md`。导入脚本保留排名、积分、队名、昵称与来源 URL。

快照版本固定为 2026-10-05，不称为“当前实时阵容”。ID 绑定初始席位，生涯转会改变队伍名单，不覆盖原始身份来源。

## 选手身份补充

来源：[unicbm/CS2-pro-steamid-lib](https://github.com/unicbm/CS2-pro-steamid-lib)，许可原文保存在 `data/source/identity-license.md`。

采用“忽略大小写的精确职业昵称 + 队伍观察相符”的唯一匹配；规范化 Team / Esports / Gaming / CS 队名附缀，不只凭相似昵称匹配。保留页面 URL、修订 ID、修订时间及来源说明于 `data/normalized/identity-attribution.json`。项目内 upstream 子集只保留公开职业昵称、国籍、角色、队伍观察和来源，不保留本名、出生日期或平台账号标识。

| 字段 | 已确认 | 缺口 / 说明 |
| --- | --- | --- |
| 官方首发席位 | 250 / 250 | 快照事实 |
| 国籍 | 209 / 250 | 208 人身份库匹配、1 人 HLTV 补充；41 人留空 |
| 有来源角色 | 209 / 250 | 41 人保留通用步枪手并标注待核实 |
| 真实转会历史 | 0 / 250 | 仅当前队伍观察不能冒充完整履历 |
| 官方榜单地区 | 50 / 50 | EU 39 / AMERICAS 8 / ASIA 3 |

派生 Liquipedia 数据归属 **Liquipedia contributors，CC BY-SA 3.0**。上游维护者可许可的原创事实整理依其许可证使用；外部页面、商标与其他数据库权利不因引用 URL 而被重新许可。未使用头像和俱乐部商标。

## 规则依据

- [Valve Major Supplemental Rulebook](https://github.com/ValveSoftware/counter-strike_rules_and_regs/blob/main/major-supplemental-rulebook.md)：本地原文 `data/source/major-rulebook.md`，用于 Major 阶段与 BO1/BO3 禁选流程。
- [Valve 2024-05-23 更新归档](https://store.steampowered.com/news/posts/?appids=730&enddate=1718063111&feed=steam_announce%2F1000)：T 下包被拆后的额外团队奖励 $600，以及 CT 燃烧弹价格调整。
- [Valve 2025-07-15 公告](https://steamcommunity.com/games/CSGO/announcements/detail/529852487375519750)：CT 击杀团队奖励规则参考；已通过 Steam 官方新闻 API 取得可读正文并确认 $50 数值，原始响应保存在 `data/source/steam-economy-2025-07-15.json`（UTC 发布为 2025-07-16）。

用户指定七图为 Dust II、Mirage、Inferno、Nuke、Ancient、Anubis、Cache。Steam 官方 2026-07-08 更新确认 Cache 替换 Overpass，2026-01-21 更新确认 Anubis 替换 Train；相关原始正文保存在 `steam-map-major-updates.json`。本项目版本仍固定该七图，后续现实变更不自动改写存档。区域名称有现实地图依据；连通抽象、视线、掩体与耗时为游戏建模，未从 Valve BSP 精确提取。

## 解说素材

用户授权使用的素材：

- `quotes_draft.md`：364 条字幕整理语录，最高优先级，保留比赛出处和 AI 字幕整理说明。
- `CS2_Commentary_Event_Lines_v1.jsonl` 与用户 ZIP 中的扩展 JSONL：各 180 条原创模板。
- 两份研究 Markdown 保存在 `docs/COMMENTARY_MATERIAL_V1.md` 与 `docs/COMMENTARY_RESEARCH_EXPANDED.md`。

用户授权本地项目使用，不等于项目自行宣告这些材料的通用再授权许可证。本地保留原文与归属，不伪造现场逐字录音认证。

## 可重复导入

`npm run data:import` 依次导入 VRS、补充身份、匹配地区、应用 HLTV 资料证据、导入原创模板、导入优先语录。默认只读取项目内已保存的源文件。`npm run data:validate` 输出实际确认数量；不会为了消除空字段编造履历。

## 决赛格式的版本差异

Valve Supplemental Rulebook 本地文本仍写淘汰赛全 BO3，但 [Valve 2025-11-12 Budapest 公告](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1816215235365195) 明确该 Major 总决赛采用 BO5。游戏保留上半年 Major 的 BO3 规则版本，年末 Major 显式配置为 Budapest 启发的 BO5 决赛；不能据单一赛事公告推断所有 Major 都采用 BO5。原始公告保存于 `steam-map-major-updates.json`。

## 选手表现与职责证据

已核对 HLTV 2025 Top 20 全部 20 位选手的年度文章，保留 59 条数值事实及各自年份、样本范围、原文链接；结合年度职责评审及 2026 年职责变动报道。来源、模型换算和缺口见 [选手资料核查](PLAYER_DATA_AUDIT.md)。年度排名不冒充实时排名，资料事实不等于十二项游戏能力。
