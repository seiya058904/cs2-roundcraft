# CS2 全面升级交付记录

本地版本已实现主要升级，入口 http://127.0.0.1:5173/ 。生产版用 npm run build 后 npm run preview；未发布到外部。当前目录没有 Git 元数据，使用升级前源码压缩包与交付 SHA-256 清单核对，不能提供 Git 提交或云端同步状态。

## 已落地

- 统一石墨灰界面、中文信息层级、攻守配色与所有页面的共享交互样式。比赛桌面为己方五人 / 解说 / 对方五人；手机为紧凑双方卡片、可展开装备详情。战术执行入口紧邻比赛现场。
- 选手档案直接显示全部十二项能力，数据库十二列与双人对比，游戏估值和原始资料分别呈现。职业名不变；解说绰号附职业名。
- GSAP 面板和事件时间线，Lenis 单 ticker 平滑滚动；动效/滚动开关独立保存，系统减少动态效果关闭位移和惯性。内部解说、横表、导航保持独立滚动。
- 详解默认开启，精简、暂停、继续、倍速、进度定位、整回合展开共享事件位置。向上阅读暂停自动跟随，回到最新后恢复。
- 新系列赛标识 causal-2026-10-v3。改进闪白视野、双端烟区遮挡、情报有效期、真实指挥阵亡处理、轮转留守与补枪目标选择。旧比赛缺少版本时走原机制，历史事件与比分不重算。
- 保留 Worker 模拟、取消/恢复、生涯、转会、玩家职责及离线存档。新增近期资料不擅自更新快照球队席位。

## 资料与解说

[资料核查与估值公式](PLAYER_DATA_AUDIT.md)：50 队 250 人，210 人职责有来源，40 人职责待核实；209 人国籍有来源。保留年度 20 人 59 条事实，新增 7 人近期三个月 56 条事实，数值证据共覆盖 23 人。HLTV 原始页面及地图样本保存在 data/source/player-recent-evidence-2026-10-26.json。HEROIC 官方公告用于 Brollan / MartinezSa 职责校正。所有十二维仍是游戏换算，不是官方测量。

本轮解说验证 150 图、2,857 回合、23,218 片段，平均约 477 字，P95 为 565 字。激活 70 个模板 ID，其中真实引用、适配引用与原创模板明确分类。364 条用户优先语录完整保留，但不强迫所有原句出现；人物、事件支持与冷却仍约束调用。没有为填字数制造伤亡和过程。

[32 个审读样本](COMMENTARY_REVIEW_SAMPLES.md)覆盖普通回合、经济翻盘、闪光接枪、转点/轮转、回防拆弹、保枪、残局及加时，每类四个。审读中修正相同类别重复叙述、同回合同句重复、“马上补枪”时间不贴合、计时获胜被说成全歼以及旧赛点被重复宣布。仍有概括性口语连接、跨回合常用句复现；它是本地事件文本解说，不是真人录音或完整语言模型。

## 验证

- npm run build：72 模块，生产构建通过。
- npm test：14 文件，134 项通过。
- npm run test:e2e：15 项通过，包含 BO3/BO5、生涯、取消恢复、错误存档保护、十二维对比、详略位置、自动跟随与减少动态效果。
- npm run test:offline：1 项通过，缓存完成后断网刷新、恢复并运行 Worker。
- data:validate：50 队 / 250 人，资料缺口如上；data:import 可复现检查见 verification-summary.json。
- 两赛季：24 项赛事、894 场比赛、220 人累计统计，存档 963,499 字节。
- 万图压力：10,000 图 / 201,513 回合通过，七图 CT 胜率约 43.47%–51.87%（该测试抽样条件，非真实赛事预测）。战术实验、攻守配对、平衡矩阵、教练暂停、校准的最终明细在同目录 JSON 报告；当前指纹见 verification-summary.json。
- 14 张浏览器截图，1440 / 1280 / 1024 / 390 宽度无页面横向溢出、无浏览器脚本错误；键盘焦点检查通过。本机 89 次 rAF 间隔均值约 16.67ms，P95 16.8ms，不能代替真实设备性能测量。

## 平衡解释与未完成项

配对实验采用等能力、镜像职责、攻守互换、每条件 200 种子、旧/新机制相同输入。新机制改善盲目支援与补枪，但固定战术和第二回合条件下仍出现 50.5%–80.5% 的 CT 胜率，特别是两种方向结果差距大。没有硬改为 50%，也不能据此宣称所有地图已达到真实职业平衡。另一个固定队伍校准样本 CT 胜率约 35.88%，说明样本组成会明显影响统计。

仍待进一步投入：更广的个人同口径统计、真实设备触控与辅助技术验收、每个动态按钮的完整状态穷举、所有页面在每个宽度的全部生涯状态组合、独立多层高光编排、地图与团队条件下更深入的平衡校准。Hallmark 静态格式检查尚有保留项，见 [技能与设计审查](SKILLS_AND_DESIGN_REVIEW.md)。这些缺口不应被描述为已全部验收。

## 交付文件与对照

- 主要修改：src/App.tsx、MatchView.tsx、MatchRoster.tsx、ui.tsx、PlayerEvidence.tsx、motion.tsx、upgrade.css；domain/engine.ts、narrative.ts、commentaryBeats.ts、realQuotes.ts、series.ts、types.ts、saveValidation.ts；资料导入器与 world.json。
- 新增测试/证据脚本：tests/upgrade.test.ts；scripts/upgrade-experiments.mts、review-upgrade-commentary.mts、capture-upgrade.mjs；浏览器回归扩充。
- 升级前源码：baseline-cs2-upgrade/source-before.zip。此前球队页截图 evidence/chinese-team.png 仅作历史界面参考，并非同一比赛的严格前后对照。此前比赛截图未单独备份，不伪造前图。
- 当前截图：[桌面比赛](evidence/upgrade/match-1440.png)、[手机比赛](evidence/upgrade/match-390.png)、[十二项档案](evidence/upgrade/player-1440.png)、[双人对比](evidence/upgrade/compare-1440.png)。
- 交付指纹 delivery-manifest.json；验证汇总 verification-summary.json；技能使用记录 SKILLS_AND_DESIGN_REVIEW.md。
