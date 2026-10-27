# 给执行 AI 的材料包说明

这是一包配合仓库使用的材料：审计结论、执行提示词、第二批语录。第一批语录、绰号表、风格指南仓库里已经有了，本包不再重复放，避免版本打架。

## 包里有什么

- roundcraft-ai-prompt.md：给执行 AI 的目标与提示词，先读这个。
- roundcraft-commentary-audit.md：审计报告，记录已知缺口与护栏。
- quotes_batch2.md：第二批玩机器真实语录，458 条，12 章，与第一批 364 条无重复。
- quotes_batch2_beats.json：第二批每条对应的引擎节拍标签，与正文逐条对齐。

## 阅读顺序

1. 先读 roundcraft-ai-prompt.md，按里面的迭代流程走。
2. 再读 roundcraft-commentary-audit.md，了解要补的节拍和池子。
3. 最后接第二批：按 quotes_batch2_beats.json 的标签更新 realQuotes.ts，接完跑模拟校验，对比基线。

## 接线注意

- beats 里标 plan 与 NEW:highlight-shout、NEW:awp-duel、NEW:utility-management、NEW:momentum 的条目，在引擎里目前没有对应的候选 case，需要新建 case 再挂 ID；其余按现有节拍接线。
- 真实语录原文不可改写；显示层统一做“首选绰号（职业名）”格式化。
- 待定事项：第二批第十章第 24 条含“马岱”一词，与第一批的“马踏死”同属 MATYS 绰号待定问题，在用户定下来之前，不要把该词绑定到选手。
