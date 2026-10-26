# 技能实际应用与设计审查

2026-10-26。本轮按用户明确批准的重设计执行；没有创建代理、发布或修改远端。

| 必用技能 | 实际落点 |
| --- | --- |
| impeccable:impeccable | PRODUCT.md / DESIGN.md 固定产品语境；状态、操作、信息依据分层；中文文案与移动端紧凑装备展开；减少动态效果、键盘焦点和横向表格 |
| hallmark | 使用用户指定 CS2 视觉方向，石墨灰、进攻橙、防守蓝；真实比分与选手阵容主导版式；upgrade.css 设计记录；实际截图复核 |
| gsap-core | 共享 motion.tsx、面板入场和事件反馈，transform / opacity 与清理 |
| gsap-react | useGSAP、scope、dependencies、revertOnUpdate；卸载回收 |
| gsap-timeline | 回放事件变化触发时间线，高光片段短促强调，不阻塞比赛操作 |
| gsap-performance | 生命条 scaleX、单一 GSAP ticker 驱动 Lenis、事件及统计 memo、避免布局属性连续动画 |
| gsap-scrolltrigger | 面板首次进入视口触发、Lenis scroll 更新 ScrollTrigger、切页刷新及 context 清理 |
| build-web-apps:react-best-practices | 选手筛选与队伍映射缓存、回合统计 useMemo；阅读偏好独立于比赛状态；不引入重复 RAF |
| build-web-apps:frontend-testing-debugging | Playwright 回归、生产离线 Worker、四档宽度、浏览器错误采集、自动跟随与减少动态效果 |

按 [Lenis 官方 GSAP 集成](https://github.com/darkroomengineering/lenis)连接 ticker；仅新增 gsap、@gsap/react、lenis。内部滚动区域独立；触屏 syncTouch=false，保留原生滚动。没有弹窗式操作：暂停与详情采用页内面板/原生 details，因此没有声称验证不存在的弹窗焦点锁。

## 设计检查的真实结果

- Impeccable 扫描记录 docs/impeccable-audit.json 提出一项“圆角卡片配粗顶边”警告，已将阵容卡顶角归零并通过截图复核。
- Hallmark 静态扫描 docs/hallmark-audit.json 是修正前记录：18 FAIL、143 REFLEX、4 WARN。其自带渲染器因没有 Puppeteer 未运行；改由已安装 Playwright 生成并查看截图，没有声称该扫描全绿。
- 已修正英文 TACTICS MANAGER 品牌副标、首段字距标签规则、移动端通知顶端偏移；缺值破折号、真实回放状态/估值提示不是装饰性 eyebrow，表内 sticky 与侧栏不共享主滚动上下文。JSON、BO1/3/5 属于用户要求保留的固定名称。
- 保留项：既有操作文字箭头、密集元信息分隔点、旧 CSS 中非四倍数间距，不是逻辑故障；仍未满足 Hallmark 的全部格式偏好。当前优先保持用户操作语义与密集比赛信息。不得把此审查描述为“所有设计检查通过”。
- 人工查看桌面比赛、选手十二维和手机截图；末轮只修正阵亡血条与手机信息拥挤。没有开展无限视觉重做。

## 动效覆盖与限制

按钮/导航/筛选、面板、表格行、能力条、通知、折叠详情和解说事件采用共享 CSS 或 GSAP 反馈；disabled 不接受动作，焦点可见，普通重渲染不重复面板入场。死亡血条立即归零。全部事件动画可以被进度变化或卸载打断，比赛命令不等待动画。

当前高光为片段级时间线，尚不是独立多层首杀/残局/结束大屏。未对每一个动态生成按钮做完整八状态排列穷举；测试覆盖主要业务流程与新增控件，不等价于物理触屏或所有辅助技术认证。浏览器帧采样是本机 headless 环境指标，不能宣称所有设备稳定 60 FPS。
