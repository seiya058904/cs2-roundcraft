"""Record reviewed conclusions separately from the structural scanner."""
from pathlib import Path
import json
OUT=Path('docs/esm-review')
def load(name): return json.loads((OUT/name).read_text(encoding='utf-8'))
def write(name,value): (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
adopt={
 'doNotWaitSmoke':('smoke','烟散与紧迫计时决定是否等待'),
 'saveGrenades':('utility','执行、下包或同区威胁解除道具保留'),
 'splitDelay':('execution','按多数就位、最长等待和剩余时间判断集结'),
 'groupTogether':('execution','集合是进攻执行前条件，不照搬固定 late 时间'),
 'allowRotate':('rotation','使用已有目击/听见信息触发支援，保留弱侧锚点'),
 'alwaysRetake':('postPlant','忽略人数劣势的保枪建议，但不忽略物理拆包时限'),
 'defuseOnlyAfterAllTDead':('postPlant','所有进攻队员倒下才开始拆除，可能输于计时'),
}
existing={'zeroBuy':'现有 eco 购买指令；不另设会与购买菜单冲突的开关','rushA':'fastA 路线','rushB':'fastB 路线','splitA':'splitA 双路','splitB':'splitB 双路','fakeA':'fakeA 佯攻路线','fakeB':'fakeB 佯攻路线','stackA':'stackA 防区','stackB':'stackB 防区','contactPlay':'contact 静步接触预设','lurkPlay':'lurk 分路预设','engageA':'既有目标包点推进','engageB':'既有目标包点推进','allHoldPoint':'现有下包后守点，不追加命中加成','holdPositions':'保留现有初始站位；CT 新 rotation=hold 可延缓回防前轮转','pushPositions':'保留已有前顶与路线，不引入原作坐标','fastMid':'midControl 关键通道控制','agressivePush':'aggressionA/B 前顶预设'}
excluded={'allowBoost':'区域模型没有垂直叠人和碰撞支持','noSnipers':'没有独立禁狙预算策略；不偷偷覆写玩家购买','lessDefaultGrenades':'没有原作购买数量公式，避免与购买策略冲突','doNotDropBomb':'原作主动丢包条件未知；当前只处理死亡掉包','doublePump':'缺少可靠的撤退重打触发条件与地图路径验证','customCheck':'原作坐标不能直接映射本项目区域','customPush':'原作坐标不能直接映射本项目区域','allowFakeDefuse':'缺少假拆的声音感知与诱敌闭环','tryFastDefuse':'保留当前安全拆包条件，不伪造原作抢拆概率','allAgressive':'盲目追击会使用未获知敌人位置；本轮不引入','someHoldPoint':'部分守点所需人员分配证据不足','stackOnPossiblePoint':'“可能点位”推断算法缺失，不使用隐藏进攻目标','checkEnemy':'保留已有真实视野侦察；不凭名称增加透视情报','switchPositions':'换位目标、时机、分配规则缺失'}
rows=[]
for r in load('rule-usage.json'):
 key=r['rule'].split('_')[-1]
 row={'source':'02_tactics/rules.json#'+r['rule'],'rawRule':r['rule'],'references':r['actualRefs'],'evidence':'规则名称、阶段、阵营和全部引用；没有函数体','risk':'名称只支持设计意图，不能证明原作执行次序或参数'}
 if key in adopt:
  field,reason=adopt[key];row.update(disposition='适配后采用',meaning=reason,gap='原来只有预设整体行为，不能独立调整此条件',integration='src/domain/battlePlan.ts#'+field,verification='tests/battle-plan.test.ts; tests/esm-compat.test.ts; phase-experiments.json')
 elif key in existing:row.update(disposition='只作参考',meaning=existing[key],gap='已有相近机制；不重复计算为新增玩法',integration='src/domain/tactics.ts; src/domain/engine.ts',verification='现有因果与战术实验；不声称复刻原作')
 else:row.update(disposition='本轮不采用',meaning=excluded[key],gap='证据或模拟表达不足',integration=None,verification='不生成运行时配置')
 rows.append(row)
write('rule-dispositions.json',rows)
coverage=[]
for row in load('files.json'):
 p=row['path'];r={k:row[k] for k in ['path','bytes','sha256','format','status','identicalFiles']}
 r.update(semantic='尚未确认',disposition='只作参考')
 if p.startswith('tools/'):
  r.update(semantic='已逐行阅读',purpose='资源提取、派生文档或诊断；不执行原脚本',disposition='本轮不采用',reason='技术栈与输入不同；存在写文件、清理、原游戏访问副作用')
 elif p.startswith('02_tactics/'):
  r.update(semantic='规则名称与去重战术描述已审阅；组合已全量结构核验',purpose='阶段、阵营、地图、经济和自定义坐标配置',reason='参见每条规则处置；不照搬576条记录或原作坐标')
 elif p.startswith('03_strategies/'):
  r.update(semantic='全部引用、经济类型、空配置核验',purpose='按经济分类的战术列表',disposition='适配后采用',reason='本项目按实际装备分类；轮换算法为本项目设计')
 elif p.startswith('04_events/'):
  r.update(semantic='全量图结构核验；99个主题审阅；节点效果尚未确认',purpose='经营对话图与多语言文本',reason='主题均为经营事件；缺失条件和效果，不接入比赛执行器',disposition='本轮不采用')
 elif p.startswith('01_localization/'):
  r.update(semantic='全量键与占位符核验；简中去重文本已审阅',purpose='界面翻译与对照文本',reason='重复派生不计独立设计；错误直译不进入游戏')
 elif p.startswith('06_vocab/'):
  r.update(semantic='已全量结构核验；符号归属/数值类型未确认',purpose='类型、字段、方法、枚举、常量索引或其派生文档',reason='累计成员分组有异常；无方法体与签名；保留未知，禁止推断为原作公式')
 elif p.startswith('05_text_corpus/'):
  r.update(semantic='全量文本解码；语义审阅未完成',purpose='混合字符串、候选语料和第三方资源',disposition='本轮不采用',reason='存在乱码、拼接和模板；不替代用户的真实解说语录')
 elif p.startswith('08_import_ready/'):
  r.update(semantic='构建逻辑已逐行审阅；产物全量解析',purpose='启发式转换的方便导入数据',disposition='本轮不采用',reason='节奏攻击性为推算；TeamCall映射未证实；事件缺失效果')
 elif p.startswith('07_design/'):
  r.update(semantic='已审阅并对照当前项目',purpose='提取者的设计建议',reason='已有utility/clutch/mapProficiency；禁止采纳过时缺口和推断调用链')
 else:r.update(purpose='来源、清单或历史快照',reason='用于计数与时间边界，不作为当前项目状态或实现证据')
 coverage.append(r)
write('coverage.json',coverage)
print('Recorded',len(coverage),'files and',len(rows),'independent rules')
