> 2026-10-26 CS2 全面升级：当前实现、验证数字和剩余缺口以 [UPGRADE_REPORT.md](UPGRADE_REPORT.md) 为准；以下保留前期设计与验收记录。

# 目标文档对照

对应 PRODUCT_TARGET.md 第 16.3 节，记录本轮实际交付范围。通过自动测试表示已覆盖对应检查，不替代未实施的物理规则、真实赛事细则或人工长期游玩验收。

| 目标 | 本轮状态 | 代码 / 证据与限制 |
| --- | --- | --- |
| 50 队 / 250 席位与队伍选择 | 已实现 | src/data、数据校验；全部队伍可浏览和选择 |
| Vitality / FURIA 快速 BO3 | 已实现并浏览器验证 | tests/e2e/game.spec.ts；逐回合与后台完成系列赛 |
| 12 项个人能力实际参与 | 已实现游戏系数 | docs/GAME_BALANCE.md、PLAYER_DATA_AUDIT.md；参考有限真实资料换算，非官方能力评分 |
| 战术影响过程与适度反制 | 已实现，平衡待改进 | tactics.ts、engine.ts；6,000 回合战术对照；CT 仍偏弱 |
| MR12 / 换边 / MR3 / 死亡合法 | 已实现并压力验证 | 10,000 图 / 205,677 回合、invariants.ts |
| 同决策、同 seed 手动与自动等价 | 已实现 | engine.test.ts、simulation.worker.ts；后台调用相同引擎 |
| 中文解说由真实事件驱动 | 已实现并验证 | narrative.ts、commentaryBeats.ts、replay.ts；150 图引用/复现检查 |
| 团队八维、地图准备、阵容默契 | 已实现游戏系数 | types.ts、engine.ts、career.ts；高默契不保证所有路线胜率单调提高 |
| 教练类型、可配置次数、三选一 | 已实现 | coach.ts、coach.test.ts、timeout-validation.json |
| 七图子区域、移动、装备与经济 | 部分实现 | 78 区域及独立连通估值；不是实测轮转，移动途中不交火，无完整武器/弹药物理 |
| Major 三级瑞士轮与混合赛制 | 已实现近似赛事 | career.ts、series.ts；32 队、106 系列赛；非完整现实 Buchholz/邀请算法 |
| 转会唯一性与赛事名单锁定 | 已实现交换制 | career.test.ts；无自由球员和合同系统 |
| 赛后统计与事件一致 | 已实现并校验 | statistics.ts、statistics.test.ts；自定义 CTM 不是 HLTV Rating |
| 两赛季、沙盒隔离 | 已实现并验证 | 24 赛事 / 894 系列赛；浏览器验证最近沙盒恢复 |
| 保存、刷新、导入导出 | 已实现并验证 | saveValidation.ts、storage.ts；失败原文备份；未全面保证跨开发版本历史兼容 |
| 桌面与窄屏可操作 | 已验证 Chromium | 1440/1280/1024/390 px；未验证其他浏览器和真实手机 |
| 来源、估值、虚构赛事区分 | 已实现标注 | DATA_SOURCES.md、应用数据与规则页；41 国籍和全部真实履历缺失 |
| 构建、测试、校验和模拟证据 | 已保存 | QA_REPORT.md、带源码指纹的 JSON 报告、evidence 截图 |

原目标中的真实语录逐字听录、完整物理模拟、真实赛事全细则不因本表而被视为完成。语录优先级遵循用户后续指定；绰号严格限解说称呼，身份数据与其他 UI 保留选手正式名。

最新称呼规则：解说选手绰号后附职业名，例如“载物（ZywOo）”；名单和统计的正式名字不变。
