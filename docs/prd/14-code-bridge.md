# 番茄钟 PRD 与代码桥接

> [返回产品文档地图](README.md) · 桥接修订v4 · 2026-11-06

**证据边界。** 本文主体的代码映射和差异表核对于 `973c5c3`，保留该提交的固定链接。这次文档接入基于 `4a94d440ef2e1683764645535d384dd96ba977ba`，其后续设计进展见下表；本轮未重新审计全部应用代码，旧差异不能自动当成最新已复现问题。产品要求以本目录v37为准。

**人物研究补充，2026-11-06。** [人物弧光讨论稿](15-character-arc-proposal.md)将角色选择对应到章稿、真实前情、静态呈现及既有收集规则；[研究复盘](16-character-research.md)说明推导与证据局限。本轮只更新文档，不引入人格状态、关系等级、叙事引擎或新动画义务；这些人物建议尚待讨论，不计入代码已实现进度。

| 后续证据 | 已读取的仓库报告说明 | 本轮如何使用 |
| --- | --- | --- |
| [设计批次1](../verification/design-pass-batch1.md) | 专注卡片保留一行，按需向上扩展，主控位置保持；结束读数与后台结果恢复调整，契约C2-P4 | 作为后续实现记录，未在本轮重跑交互验证 |
| [设计批次2](../verification/design-pass-batch2.md) | 连续触摸弹簧、切场渐变、手部节奏与专注期间降噪 | 作为后续实现记录，不据此认定新故事或性格已完成 |
| [设计批次3](../verification/design-pass-batch3.md) | 设置分组、记录搜索、圆角与按压反馈整理 | 作为后续实现记录；报告中的桌面检查不代替真机 |

三份报告仍各自负责其验证范围；具体主控稳定性、真实存储和新故事规则按对应PRD验收。

**如何使用：** 先看第2节理解理念怎样成为行为，再按第3节定位功能与代码；发现两边不同，进入第5节判断改哪一边。PRD回写建议在第6节，开发经验和新创意在第7节。每次相关改动后更新同一文件，保留稳定编号，避免另起一份相互矛盾的清单。

原核对基线的判断：计时、想法、回顾与鼓励已有较完整的原型实现；伙伴已有11种活动，但独立单章、完整走完才收集的生活事实及完整数据备份尚未交付。桥接的重点，是把可靠的工具底层接到可持续的伙伴生活上，同时让实践中成立的交互回到PRD。

## 1 基线与文件职责

当前修订：v4，2026-11-06，日期按 America/Los_Angeles。产品文档迁入本目录v37，原代码核对点继续保留；后续实现证据列于文首，本次不修改应用代码。用户已确认前三项主性格与轻微笨拙，并要求台词适配简单画面；新增48句日常台词是创作候选，不代表已接入或逐句定稿。

| 对象 | 当前依据 | 用途 |
| --- | --- | --- |
| 产品主稿 | [产品文档地图 v37][prd-live]，由单文件v36版本25完整拆分；附录编号不变 | 当前产品维护入口；旧单文件与仓库handoff文件为历史来源 |
| 代码基线 | [Hughstudy/clock][repo]，`main`，`973c5c3d9790abd9b990a78a18c6326b5e5826be` | 原始代码映射及差异的固定核对点；后续报告另列，不混用证据 |
| 后续产品决定 | [AGENTS.md][agents]、[PLAN.md][plan]及相应验证报告中的用户决定记录 | 识别PRD之后已经确认的调整；正文写“据仓库记录”时，表示尚未独立回查原对话 |
| 工作与证据 | 仓库模块计划、验证报告；原[开发协作文件][coordination] | 计划负责顺序；协作文件负责分工；验证报告负责具体检查结果 |

本文件负责“为什么做 → 用户看到什么 → 如何实现 → 差异如何处理”。不复制完整PRD，不代替代码，不新建人员分工板。文中代码链接固定到上述提交；以后更新基线时重新核对，不能仅替换提交号而沿用旧结论。

本轮明确决定：保留手动结束的短章小记和自然到期的完整章页；不设计已结束会话的未完事项；未完整走完不收集，原段暂停仍可继续。自然到期、故事完整且保存成功才按章稿收集，短段也适用；短章仍可回看。时长尺、原型／最终视觉阶段、物件交互边界和连续动作核验已回写，详见第6节。本次再确认好奇、有自己的小主意、认真但不较劲为主性格，轻微笨拙只作点缀；不是新的人格数值或随机失误功能。

发生冲突时，优先按当前明确的用户决定和产品主稿判断；代码只能证明现状，不能自动把现状变成正确需求。仓库历史提案、已废弃的解锁规则、未经确认的创意均不能覆盖正式结论。

**分别记录三种状态。** 决策可以是“已确认／建议／待澄清”；实现可以是“未做／局部／已实现”；验证可以是“静态核对／本轮测试通过／历史报告通过／真机待验”。不能只写一个“完成”，把三者混在一起。

## 2 产品理念怎样落到实践

| 理念 | 用户必须能感受到的行为 | 当前落点 | 实践判断 |
| --- | --- | --- | --- |
| 用户做自己的事，伙伴有自己的生活 | 角色围绕自己的事情行动；不监督、不催办、不靠用户养活 | [场景选择][scenes]、[伙伴呈现][presentation]、[文案目录][encouragement] | 活动与语气已有基础；持久生活和前情尚未实现，不能仅凭动画数量认定完成 |
| 自主，允许中断和离开 | 暂停保留原段；提前结束记真实投入；下一段与休息都由用户启动 | [计时状态转换][timer]、[业务动作][app]、[专注页][home] | 基础路径已实现；需继续守住延迟、失败和重试时的原意图 |
| 无评判的正向支持 | 0秒、短段、长段都得到基本善意；不以时长定义用户价值 | [反馈规则][feedback]；全部活动立即可用 | 不恢复完成解锁、哭泣、饥饿、关系衰减。故事进展可不同，善意不能分等级 |
| 想法先有地方放 | 随时留标记或写字，不必处理完才能休息；到期不丢字、不换归属 | [想法协调][thought-hook]、[想法规则][thought-logic] | 正式内容、草稿和临时输入分开；私密想法不参与剧情选择 |
| 事实可信 | “已经结束”和“已经保存”是两个判断；失败不显示虚假成功 | [应用协调][clock-hook]、[存储][storage]、[记录视图][views] | 已有待保存／只读／仅本次等状态；场景不得提前宣称物件已永久留下 |
| 安静、低负担，但有生命力 | 核心操作稳定；输入和阅读时表演让位；关闭动画仍可完整使用 | [布局样式][focus-css]、[场景适配][scene-fit]、[气泡定位][head-speech] | 趣味主要来自角色动机与动作，不靠增加用户任务 |
| 长期积累来自共同经历 | 能找回某一次发生了什么，也能看当前小屋为何如此 | [记录查询][records-query]、[小屋][room] | 现在是活动画签与原记录索引；故事快照和世界事实仍缺失，见D03—D04 |

同一条原则需同时约束界面、业务和数据。例如“可以安心暂停”必须意味着计时停止、本段故事可停、结束不留待办、记录仍可信、按钮可达；一句温柔文案不能替代其中任何一层。

## 3 功能与代码构造对应

PRD章节号用于找到规则，代码路径与函数用于找到实现入口。此表是阅读地图，不要求按表重新拆目录。

| 功能与PRD入口 | 代码入口与关键构造 | 实现方式与边界 | 验证入口 |
| --- | --- | --- | --- |
| M01 准备与时长，3.1／A.1／RULE-START、RULE-DURATION | [HomeScreen][home]、[useDurationChoice][duration-choice]、[DurationRuler][ruler]、[useDurationRuler][ruler-hook]；`nextFocusMinutes` | 准备值与设置默认分开；用时长只准备，明确开始才创建会话；当前采用数字／铅笔打开刻度尺 | `prepare.test.ts`、`settings.test.ts`；`verify-focus-interactions.mjs` |
| M02 计时、结束、恢复，A.1／C.4／C.6 | [timer.ts][timer]的开始／暂停／继续／到期；[app.ts][app]的`applyAction`、`reconcile`；[useClockApp][clock-hook] | 运行段保存截止点，暂停段保存余量；到期先核对，最多结算一段；界面结果与保存结果分开 | `timer.test.ts`、`app.test.ts`、`storage.test.ts`；`scene-e2e.mjs` |
| M03 想法与草稿，3.2／A.2／C.9.3.4—6 | [useThoughts][thought-hook]、`ThoughtPanel.tsx`、[app.ts][app]、[thoughts.ts][thought-logic]；`ThoughtDraft`、`draftStamp`、`baseRev` | 编辑入口锁定归属；草稿与正式条目分开；保存后继续输入仍保护文字；删除保留短期撤销依据 | `thoughts.test.ts`、`useThoughts.test.ts`；`verify-v35-persistence.mjs` |
| M04 鼓励与收藏，3.4／A.4／E | `EncouragementReader.tsx`、`useQuoteFavorites.ts`、[favorites契约][favorites]、[反馈规则][feedback] | 一层阅读任务；收藏捕获当时句子身份、版本和文本；取消有删除标识；阅读不改变计时 | `favorites.test.ts`、`feedback.test.ts`；交互与持久化脚本 |
| M05 回顾与查找，3.5／A.5 | [StatsScreen][records-screen]、[useViews][views]、`useRecordsQuery.ts`、[records-query.ts][records-query] | 汇总读已确认结束记录；月份、文字搜索、7／30天汇总各自独立；20条替换分页；按对象恢复位置 | `records-query.test.ts`、`stats.test.ts`；`verify-records-companion.mjs` |
| M06 伙伴活动与动作，A.3／B.4 | [scenes.ts][scenes]、`scene-rules.ts`、[presentation.ts][presentation]、`scene-pose.ts`、`CompanionSceneArt.tsx` | 8种专注和3种休息活动，分池轮换并保存本段分配；渲染消费时间事实，不能写计时或发奖。当前活动分配不等于v36单段故事及收集资格 | 场景、姿态、手臂轮廓测试；`scene-e2e.mjs`；[动作报告][arm-report] |
| M07 小屋与来源，3.3／A.3.1—2 | [RecordsRoom][room]、[indexRoomActivities][records-query]、`RecordsArt.tsx` | 初始布景＋已保存活动的画签；按活动找原记录。没有完整世界状态、节点来源账本或物件小话 | `verify-records-companion.mjs`；完整故事验收尚未成立 |
| M08 设置与更新，3.6／A.6／C.6—7 | [SettingsScreen][settings-screen]、`useSettingsForm.ts`、`usePwaUpdate.ts`、`useSoundPreview.ts` | 默认时长、声音、动态与场景偏好；更新前保护会话、输入和待存内容；备份／恢复／清空入口缺失 | `settings.test.ts`、`sound.test.ts`；`verify-v35-update.mjs` |
| M09 布局与操作稳定，第四章／B.1—3 | [focus.css][focus-css]、`FocusPanel.tsx`、`FocusTaskDialog.tsx`、`TimerActionButton.tsx`、[useSceneFit][scene-fit]、[useHeadSpeech][head-speech] | 固定核心区域；小屏、大字或键盘压缩空间时换同层阅读／滚动布局；气泡靠实际头部定位 | `verify-v35-panels.mjs`；[气泡报告][speech-report]；真实手机仍待验 |
| M10 数据与迁移，C.1—12 | [types.ts][types]、[snapshot.ts][snapshot]、[SnapshotStore][storage]、`locks.ts`、[useClockApp][clock-hook] | v8单快照；短Web Lock内读最新、变更、写入；保留未知新版原件；无锁时已存数据只读 | `snapshot.test.ts`、`storage.test.ts`；`verify-v35-persistence.mjs`；不等于完整C章逐条验收 |

通用调用方向为：页面表达用户意图，协调层管理输入、请求与回执，纯业务层计算变化，存储适配器提交事实，再由视图与动画呈现。`src/logic`里也有纯绘画计算，不能仅根据目录名推断业务归属。

### 三条贯通实例

**开始专注。** 刻度尺改变准备值 → 明确开始 → 应用协调层分配会话身份与时区 → 业务层锁定目标、记录参与并分配活动 → 存储提交 → 计时和角色读取同一会话。PRD未来的故事绑定应接在业务事务内；动画结束回调不能补做绑定或记账。

**写想法时到期。** 编辑器先捕获原段 → 用户继续输入 → 计时独立结算 → 保存提交的是明确点击时的文字快照和原归属 → 后来新输入仍保留 → 回顾读正式条目与原段关系。需覆盖到期、保存失败、重试、另一窗口开始新段，而不只检查“输入框能保存”。

**从小屋回看。** 当前路径是已保存记录的`sceneId` → 同类活动画签 → 对应专注列表 → 原记录。未来路径应增加物件稳定身份 → 伙伴小话 → 符合收集条件的原会话终态 → 原故事。v36的短章仍从历史回看，但不构成新物件来源；活动类别不能直接迁移成已收集物件。

## 4 PRD逻辑数据与当前存储的映射

PRD C.1.1和C.9.1允许开发选择物理存储；v36退役接续对象，并将逻辑契约标为schema／format 3，与现有应用v8独立。是否使用SQL、是否逐项拆物理表，不是符合需求的判断标准；必须检查身份、关系、可解释的未知值和提交边界能否等价表达。

| PRD逻辑对象 | 当前v8落点 | 等价程度与待补之处 |
| --- | --- | --- |
| `db_meta` | `version`、`revision`、`writer`、`datasetGeneration` | 有版本与数据世代基础；替换／清空尚无完整入口，不能以有字段认定已实现 |
| `app_preferences` | `settings`、`lastFocusMinutes`、`focusDefaultsRevision` | 支持当前偏好与时长记忆；未来仅增加已启用且有明确用途的字段 |
| `sessions` | `timer.session`＋`records[]`＋`participations[]`＋`lastRestEnd` | 当前分开表达活动段、专注历史、参与与最近休息终态。结束专注记录未保留原`timeZone`；并非PRD完整会话字段的无损映射，见D08 |
| `notes` | `thoughts[]`的`id/sessionId/text/status/rev/deletedAt` | 基本想法生命周期成立；缺少独立的来源类型、创建时区与删除操作身份等PRD语义，需迁移映射而非直接改字段名 |
| `note_drafts` | 单个`thoughtDraft`＋`draftStamp` | 有来源、基础版本和草稿条件更新；新稿ID同时用于未来正式想法，与PRD分离的草稿／目标身份不同，需按完整寿命证明等价 |
| `note_undo` | 删除后暂留在同一`Thought.text`，到期清空 | 可在应用内撤销；物理上未分区。未来导出必须剔除删除原文，不能原样导出内部快照，见D07 |
| `story_items/session_stories/world_state` | 尚无对应完整对象 | v36一段一实例，保留本段检查点；符合RULE-COLLECT的到期才提交小屋成果。现有scene／lastEnded不能证明完整故事或收集 |
| `story_continuation`（退役） | 当前本就无完整模块 | 用户已取消跨段未完事项，不再作为待开发缺口；原段暂停恢复仍必需，旧数据若确有该语义须保护迁移 |
| `story_rotation` | `scenes.focus/rest`轮换袋 | 当前随机袋适用于原型活动，不等价于v36按已收集前情、独立时长稿和合法目录选择；不得为了未收集强制反复派同一事项 |
| `quote_favorites` | `quoteFavorites[]` | 有句子版本、当时文本、修订与取消标识；仅覆盖主动句子收藏 |
| `content_grants` | 无完整模块；旧`unlocked/introduced/announced`仅兼容保留 | 旧解锁字段不再控制活动，不能拿来充当新物件资格账本 |
| `mutation_receipts` | 协调层内存中的操作ID、待重试任务及想法回执 | 有局部协调；不等价于完整持久回执契约。哪些动作必须持久去重、哪些可由身份和终态证明，应逐项说明 |

**内部存储格式与便携备份格式分别定义。** 当前v8可以作为输入来源，但备份需校验、删去短期撤销原文与技术字段、捕获活动段检查点，并说明缺失的旧事实；不能简单给`JSON.stringify(snapshot)`加下载按钮就算完成。

## 5 当前差异与处理方向

下表是差异的唯一当前状态表。D编号长期保留；后文引用编号补充理由，不重复建立另一套状态。

| 编号 | 具体差异与依据 | 判断与处理方向 | 当前状态／关闭条件 |
| --- | --- | --- | --- |
| D01 时长入口 | 当前数字／铅笔打开1—120刻度尺；v36正文、附录及动作索引已同步 | 保留选择／开始分离，不恢复快捷按钮行 | 文档差异已关闭；首次使用与真机验证继续按原要求 |
| D02 绘画基线 | v36已区分当前原型画法与最终已确认水墨目标 | 原型继续验证功能、动作；最终美术另验收，工具名称不能代替风格 | 文档阶段边界已明确；最终角色及美术样稿仍待验 |
| D03 独立故事与过程记录 | v36取消跨段未完事项；代码目前仍是11种活动轮换，未具备完整单章事实 | 先做DAY05独立起点、短章／完整章、本段暂停恢复和合法重复，不开发待续队列或跨时长旧进度映射 | 新规则已确认；单章仍未完成，不能因省去接续就标全部实现 |
| D04 小屋积累 | 当前画签由已保存活动分类生成；PRD要求当前生活事实、物件小话与真实来由 | 保留画签查找价值；按RULE-COLLECT另做物件／终态来源模型，不把画签改名为已收集物件 | 局部实现；新增物件、已有状态变化、无新增三种结果均有证据后关闭 |
| D05 数据管理 | 设置仅有偏好与数据说明，无导出／替换／清空闭环 | 补代码及迁移、输入保护、多窗口世代隔离；不能删掉PRD要求来宣称完成 | 未实现；按C.7及D.20—24验收后关闭 |
| D06 时刻与重试 | PRD要求暂停／结束按受控意图时刻处理；`useClockApp.commit`在执行事务时重新取`nowMs()`，动作本身未携带计时意图时刻 | 高优先级定向复现；保留PRD的时间事实要求。区分已应用但写盘失败与尚未执行的锁等待／锁失败 | 静态疑点，尚未复现为用户故障；验证等待10秒、重试、跨截止点和竞争终态，确认规则或修复后关闭 |
| D07 删除与备份隔离 | PRD短期撤销原文不导出；当前删除正文短期保留在`Thought.text` | 可保留等价内部实现，但导出必须专门投影、校验；同时核对删除版本与旧草稿复活 | 内部结构差异已确认；当前无导出，尚不能判断备份合规；专门用例通过后关闭 |
| D08 数据无损映射 | 当前结束记录缺原开始时区，想法缺完整来源语义；历史迁移含`legacy-completion`参与及补入当前时区的路径 | 逐字段核对源版本证据，保留“未知”；新版本补字段，旧数据不能按当前时区伪造原事实。不得仅为表面一致填默认值 | 已确认模型差异；历史影响待样本核验；映射、迁移与备份样本通过后关闭 |
| D09 小屋昼夜 | 当前按时间段初始化背景，没有PRD A.3.2明确的白天／夜晚选择入口 | 在真实小屋模块内补实现；是否保留自动初始背景可作为默认策略讨论，切换只影响呈现 | 局部视觉，不算完整交互；同一物件身份／来源跨昼夜一致后关闭 |
| D10 内容容量目标 | PRD C.8提出每条故事增量平均128 UTF-8字节，同时要求可解释历史结果 | 当前没有完整故事样本，不能证明目标合理或不合理；先测一章。必要时调整预算数值，不牺牲事实与回看 | 待实测建议；对应R04，不视为现有代码缺陷 |
| D11 文档口径 | PLAN开头反映当前功能，后部仍混有旧快速开始、旧回顾描述及滞后复选项 | 将当前口径集中，旧设计明确归档；桥接只链接相关结论，避免继续堆叠“后来又改了” | 静态核对已确认；整理文档后核查入口无互相冲突 |
| D12 验收范围 | 有大量单元与历史浏览器检查；当前仍缺真实手机、真实软键盘和读屏验收 | 保留PRD验收标准；代码存在、自动测试通过、真机通过、已发布分别记录 | 初版现状检查的387项单元测试及构建通过；本次仅改文档，未重跑应用测试，真机待验 |
| D13 收集资格 | v36要求自然到期＋完整故事结果＋保存成功，当前活动画签可来源于手动结束记录 | 画签仅作活动查找，不能当故事收集；新小屋成果只在合格终态事务落地，manual只保存小记 | 规则已定、代码未实现；覆盖结尾姿态提前结束、短稿完整、后台到期、失败重试和旧成果保留 |
| D14 物件与动作 | v36收窄物件互动范围，并补拿起至放下／中途停止的身体一致性核验 | 普通装饰不默认按钮；全部已收集物件有文字路径；数值几何测试留工程 | 规则已回写；后续真实物件模块与真机按新范围验收 |

### 优先验证的时间事实

D06的核对场景：运行到第2分钟时点击暂停，写锁被占用10秒后才取得。先明确系统在哪一步接受暂停；如果已接受，页面与记录不能把等待时间记为用户继续专注。然后测试锁失败再试、等待期间到期、另一窗口已结束原段，以及原操作已应用但仅写盘失败。每种情况应保留原目标与唯一终态。

当前代码对“已应用但待保存”的操作采用重新核对而非重放，已有保护。疑点主要在尚未执行／锁失败后重试的时刻语义；不能把所有失败统一称为同一个缺陷，也不能凭总测试数认定已覆盖。

## 6 本轮PRD回写决定

本节保留v36已确认、并由v37继承的产品处理。代码与测试未随文档自动改变；不把建议写成已实现。

| 编号 | 决定与落点 | 状态 |
| --- | --- | --- |
| R01 时长尺 | 正文2.2、A.1、动作映射／F及相关验收统一数字／铅笔入口、刻度尺及输入；应用只准备 | 已采纳并回写 |
| R02 视觉阶段 | 正文2.1、全局规则、B.4.1／D.4明确当前原型保持现有画法，最终水墨目标仍保留；两阶段分别验证 | 已采纳并回写 |
| R03 画签边界 | 画签作为当前代码过渡索引留在桥接，不升级成长期产品名词；v36只定义历史与收集小屋的关系 | 调整建议，未新增重复功能 |
| R04 容量预算 | C.8／E.14已将128字节及资源体积定为可复核试做目标；本轮不再改数字或重复加说明 | 保持现状，等待实测 |
| R05 动作可信 | B.4.1／D.4补连续姿态与任意暂停／结束时的握点、肩部、道具支撑核验；工程阈值不写成永久审美比例 | 已采纳并回写 |
| R06 两种归档 | 用户明确保留手动短章／自然到期完整章，不采用统一归档的建议；两者不分级关爱，均可回看 | 已确认保留 |
| R07 无跨段未完事项 | RULE-CONTINUITY改为原段可继续、结束不留待办；退役story_continuation及跨段进度映射，原段恢复和旧资料保护仍必需 | 已采纳并同步A／C／D／E／F |
| R08 完整才收集 | RULE-COLLECT明确自然到期、完整故事及提交成功三个条件；未完整留下真实小记，不进入小屋收集；旧有可靠成果不追溯扣除 | 已采纳并同步数据事务、样例与验收 |
| R09 互动范围 | 承载已收集经历或明确设计为互动的物件有小话；普通装饰不自动变按钮，全部已收集物件有可达文字入口 | 已采纳并回写A.3.2／E.10／D |
| R10 伙伴性格与文字 | [性格简历](10-character.md)保留已确认主轴；[日常台词](11-dialogue.md)新增48句候选，复用已有简单画面，不把台词转成动作制作清单 | 主性格已确认；新台词是候选，未接入应用；不改变原鼓励库或触发规则 |

性格落地时，先在现有章稿中明确伙伴想要什么、怎样选择、变化后如何回应，再交给场景姿态与呈现层；不新增人格引擎。笨拙应是一次有因果、能自行处理的小偏差，不能用穿模或道具悬空代替，也不能因表演延迟暂停、结束或保存。具体章稿和演法未验证前，不因PRD已定性格就把M06或D03标为完成。

不削弱计时准确、想法保护、完整备份／恢复、旧未知保留未知及真机验收。接续被取消是用户明确调整产品范围，不是以现有代码为理由删要求。短章不收集也不能抹去真实历史或恢复旧惩罚文案。

## 7 从开发经验到新创意

### 已有实践值得保留的部分

| 实践 | 提炼出的产品认识 | 回到PRD的方式 |
| --- | --- | --- |
| 气泡按实际头部定位，放不下进入阅读布局 | “不挡脸”需要覆盖各活动、动作姿态和文字长度，不能只调一张截图 | 在B.1／B.4补明确场景覆盖；具体测量算法留代码 |
| 失败时仍显示已保存原文，待存编辑另标状态 | 安心来自能分清“已保住什么”和“还需处理什么” | 保留A.2／C.5的双状态语义，在功能示例中加入失败编辑场景 |
| 记录按对象恢复页码、展开项与位置 | “找得回来”也包括离开详情后不丢原阅读位置 | 保留A.5的来源返回规则；将跨窗口插入／删除纳入验收 |
| 动画与业务事实分开 | 看不看动画都应得到相同记录；静态不是残缺版本 | 作为每个新章的默认验收，不再逐章重复发明规则 |
| 道具移到手够得着的位置 | 生动可以来自合理的小动作，不必靠更夸张的形变 | 优先复用短动作与可信接触，减少内容维护成本 |

### 创意复核与最小验证

| 编号 | 当前判断 | 后续验证 |
| --- | --- | --- |
| I01 自然提及以前的小事 | 只可引用已收集或有据旧事实；不采用“接着上次未完的事”开场，不建立待办 | 首章完成后下一章的一句自然前情；不读取私人想法、不催补完 |
| I02 物件有熟悉后的新话 | PRD已有按状态预写1—3句的规则，不作为新增功能 | 一个明确互动对象的真实状态与小话一致，普通装饰不扩功能 |
| I03 过程本身值得回看 | 短章小记已有规则；v36明确不完整不收集，不用过程物绕过资格 | 不同manual落点如实记录，完整结果保存后才变小屋；不以收集差别评价用户 |
| I04 图与文字入口互补 | PRD已有要求，不重复扩写 | 图文指向同一身份，触区不足仍可由列表完成，全部已收集对象可达 |

先验证一章完整闭环，不增加照顾义务、离线受苦、签到、任务树或AI聊天。

## 8 持续维护与双向闭环

每次相关改动按以下顺序维护；不要求为所有小改动重复阅读整份PRD。

1. **定基线。** 核对当前PRD版本、相关后续决定、代码提交和未提交改动；先读本模块对应的规则、代码与验收。
2. **给差异定性。** 是代码未完成、等价实现、PRD过时、PRD表达问题，还是新创意？一句话说明用户影响，不先下“改PRD”的结论。
3. **选择改哪一边。** 已确认规则未实现则改代码；已确认后续决定未回写则同步PRD；新方案写收益、代价与最小验证。例行修复无需重新打开已定产品原则。
4. **保证整条路径。** 检查入口、输入、业务动作、持久事实、呈现、回看和异常恢复；动画与数据库不能各自宣布完成。
5. **分别留下证据。** 写明PRD落点、代码提交、实际验证环境与结果；发布另记远端提交、部署结果和线上核对，不把推送成功等同发布成功。
6. **更新当前状态。** 修改原D／R／I编号，把已采纳方案并入现行PRD和模块映射；已否定方案只保留短理由，不积累长讨论。实际分工仍回原协作文件。

### 新增差异的最小记录

| 必填信息 | 要回答的问题 |
| --- | --- |
| 编号与用户场景 | 谁在什么情况下会遇到什么问题？ |
| PRD依据与代码落点 | 哪条要求、哪个函数／组件／数据结构不同？ |
| 证据与性质 | 是观察、可复现结果、静态疑点还是想法？ |
| 处理决定与理由 | 改PRD、改代码、两边补充或继续验证？保护什么产品价值？ |
| 落地与关闭条件 | PRD是否已改，代码是否已提交，哪些测试／真机结果足以关闭？ |

文档更新本身只说明映射和判断已保存；它不会自动修改PRD、代码或向其他窗口发通知。后续AI需读取本文件及关联源文件后继续工作。

## 9 已有证据与建议顺序

| 检查 | 证据时间与边界 |
| --- | --- |
| 代码静态核对 | 基线`973c5c3`；检查主要模型、计时、想法、存储、记录、场景、设置及当前计划 |
| TypeScript与单元测试 | 上一阶段现状检查实际运行`npm run check`，36个测试文件、387项测试通过；与本文代码基线相同 |
| 生产构建 | `/clock/`路径构建通过；线上首页引用的主JS/CSS文件名与该构建一致，不据此声称逐字节或部署任务全验证 |
| 线上界面 | 检查首页、调时入口、鼓励阅读、记录模式、小屋与设置；不代表所有端到端路径通过 |
| 浏览器整套自动化 | 仓库有历史通过报告；初版检查时测试浏览器下载失败，未重跑完整套件 |
| 手机与辅助操作 | 真机、真实软键盘、安装态和读屏仍待验收 |
| 本轮文档修订 | v37拆分、文档地图、48句台词与仓库入口更新；[迁移验证](../verification/prd-v37-migration.md)记录保留与链接检查。应用代码未改，未重跑应用测试；文档提交和Pages流程分别确认 |

建议先核对D06时间意图与D08数据映射，避免扩大数据后再返工；然后用DAY05贯通独立单章、两种归档和完整才收集，同时在扩大长期试用前完成D05备份／恢复；最后补真实手机验收。R01、R02、R05、R07—09已回写PRD，R06按用户要求保留；R10主性格已确认，具体演法先随DAY05试稿检验，不增加并行功能任务；I类按上表复核，不再作为新增功能清单。

## 参考入口

下列链接对应本文基线。文件中的函数名可用于代码搜索；后续提交改名或移动时同步修改相关映射。

[prd-live]: README.md
[coordination]: https://chatgpt.com/library?file_id=libfile_c81e264086d88191828a7654a36d7421&account_id=personal
[repo]: https://github.com/Hughstudy/clock
[agents]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/AGENTS.md
[plan]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/PLAN.md
[types]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/types.ts
[snapshot]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/snapshot.ts
[timer]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/timer.ts
[app]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/app.ts
[clock-hook]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/hooks/useClockApp.ts
[storage]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/adapters/storage.ts
[home]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/screens/HomeScreen.tsx
[duration-choice]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/hooks/useDurationChoice.ts
[ruler]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/components/DurationRuler.tsx
[ruler-hook]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/hooks/useDurationRuler.ts
[thought-hook]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/hooks/useThoughts.ts
[thought-logic]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/thoughts.ts
[favorites]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/contracts/favorites.ts
[feedback]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/feedback.ts
[encouragement]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/data/encouragement.zh-CN.json
[records-screen]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/screens/StatsScreen.tsx
[views]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/hooks/useViews.ts
[records-query]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/records-query.ts
[scenes]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/scenes.ts
[presentation]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/logic/presentation.ts
[room]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/components/RecordsRoom.tsx
[settings-screen]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/screens/SettingsScreen.tsx
[focus-css]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/styles/focus.css
[scene-fit]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/hooks/useSceneFit.ts
[head-speech]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/src/hooks/useHeadSpeech.ts
[speech-report]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/docs/verification/focus-speech.md
[arm-report]: https://github.com/Hughstudy/clock/blob/973c5c3d9790abd9b990a78a18c6326b5e5826be/docs/verification/all-scene-arms.md
