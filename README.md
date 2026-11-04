# 大光路物业运营平台需求与演示原型

仓库名称：`daguanglu-community-prototype`。

本项目保存商城之外由 lee 统筹的产品需求、演示原型、验收与研发交接资料。商城继续由原项目推进；居民共享与邻里互助由同事设计。本项目保留整个建设方案的功能对应关系，方便后续整合。

## 当前状态

- 当前步骤：INIT已完成；Stage00文档整合、待提交复核。
- 需求与计划：REQUIREMENTS V0.2已审阅通过，当前V0.3仅同步状态、导航和框架决定；PLAN V0.4、ACCEPTANCE V0.4待本轮提交后的ChatGPT复核。
- Git：初始化基线为`6299471765ca4045b25abb91667991cfc81809ca`；origin为[目标仓库](https://github.com/erya1991/daguanglu-community-prototype)，本轮仅提交并推送`stage/00-foundation`。
- 原型：未实施，没有业务页面、前端依赖或启动服务；Stage01～05未启动。
- 技术方向：Web沿用实际LiLiShop Manager的Vue 2、View UI/view-design、Vue Router 3、Vuex 3与Vue CLI；三小程序使用uni-app、Vue 3＋TypeScript＋Vite。依赖、锁文件与构建按Web/移动端隔离，精确环境实施前核验，见[AGENTS第6.1节](AGENTS.md#61-分端前端技术基线2026-11-04用户确认)。
- 生产进度：以研发和原商城项目实际记录为准，本仓库尚未核定。

本轮仅合并文档、核对一致性并提交推送，完成后停止，等待ChatGPT复核；复核通过后另行进入Codex计划模式实施。六阶段分组与产品交接日期仍保留为讨论建议，不视为全部外部业务规则或研发交期已确认。

## 第一次使用

1. 打开现有独立仓库，先读[AGENTS.md](AGENTS.md)并核对实际分支、工作区与本轮授权；不重复初始化Git。
2. 阅读[Stage00需求](docs/stages/stage-00/REQUIREMENTS.md)、[计划](docs/stages/stage-00/PLAN.md)、[验收清单](docs/stages/stage-00/ACCEPTANCE.md)和[结果](docs/stages/stage-00/RESULT.md)。当前有效目录仅为`docs/stages/stage-00/`。
3. 后续Stage按[阶段计划](docs/STAGES.md)由用户启动。[仓库准备说明](docs/REPOSITORY_SETUP.md)保留为INIT历史操作说明，不是本轮待执行任务。

实际本地位置：`D:\git\daguanglu-community-prototype`。此目录与商城生产开发目录分开。本轮只使用现有文本和Git工具，不安装前端框架或数据库。

## 项目级文档

| 文件 | 用途 |
|---|---|
| [AGENTS.md](AGENTS.md) | Codex 工作边界、读取顺序、模拟与验证要求 |
| [WORKFLOW.md](docs/WORKFLOW.md) | 需求、评审、原型、交接、变更与生产反馈流程 |
| [OVERALL_REQUIREMENTS.md](docs/OVERALL_REQUIREMENTS.md) | 总体范围、角色对象、业务关系和公共原则 |
| [STAGES.md](docs/STAGES.md) | 阶段分组、依赖、实际状态及交接安排 |
| [SCOPE_REGISTER.md](docs/SCOPE_REGISTER.md) | 64个需求包的唯一范围与条目状态台账 |
| [OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | 27项待确认问题、实际结论和确认依据 |
| [SOURCE_COVERAGE.md](docs/SOURCE_COVERAGE.md) | 建设方案117条功能行、12项其他约束及15项历史差异 |
| [sources/README.md](docs/sources/README.md) | 资料索引、原文归档及使用优先级 |
| [stages/README.md](docs/stages/README.md) | 阶段目录建立和模板使用方式 |

根 README、AGENTS、WORKFLOW、OVERALL_REQUIREMENTS、STAGES 是五份核心项目文档。三张台账分别管理范围、问题和来源对应，不再在其他文档重复维护逐项状态。

## 范围概览

| 归属 | 需求包数 | 处理方式 |
|---|---:|---|
| lee统筹的剩余范围 | 53 | 逐批细化需求、制作原型并交研发；运行保障由研发测试运维执行 |
| 商城原项目 | 8 | 继续原P0流程，保留公共关联和验收来源 |
| 同事协作模块 | 3 | 居民共享、邻里互助及相关举报争议，按固定版本协作 |
| 合计 | 64 | 数量表示整理粒度，不是页面数、工作量或已完成数量 |

建设方案第3章四端功能表共117行：住户27、管理端19、商户19、Web52。其他章节另有12项平台约束和前置条件。覆盖关系完整不代表需求已确认或生产已实现。

## Stage建议分组

| Stage | 名称 | 当前状态 |
|---|---|---|
| 00 | 公共基础与协作约定 | 文档整合、待提交复核；需求已审，原型未实施 |
| 01 | 物业收费停车与统一事件闭环 | 未启动；01A收费停车、01B工单隐患分件交接 |
| 02 | 便民服务闭环 | 未启动 |
| 03 | 活动与积分运营 | 未启动；活动暂由lee负责 |
| 04 | 网格党建与安全协同 | 未启动；业务及外部条件需并行确认 |
| 05 | 运营汇总与整体交付 | 未启动；消息权限统计随各业务同步定义 |

各阶段使用 `REQUIREMENTS.md`、`PLAN.md`、`ACCEPTANCE.md`、`RESULT.md` 四份文档。[四份模板](docs/templates/stage/REQUIREMENTS.md)已准备；Stage00已归并到规范目录，其他阶段在获准启动时创建。

Stage00承担三个独立小程序框架＋Manager兼容Web框架＋DGL-001～011基础业务原型。住户沿用“首页｜服务｜商城｜我的”，商户沿用“工作台｜经营｜订单｜我的”；管理端独立，“工作台｜档案｜我的”是本版方案。商城实际工程继续作为生产开发基础，原型只复用获准框架、主题、组件与导航，新增业务只接Service/Adapter后的Mock，研发按模块接收增量。

基础网格与责任区域本次不执行，不作为前置；普通社区/小区数据可见清单保留。DGL-039仍在总体清单中待街道确认。H5同源静态预览共享模拟事实，微信分别做本端模拟验证，样例切换不代表跨App同步。

## 文档与状态维护

- 本仓库 Markdown 是后续主维护版本；前一轮 Excel 和 Word 保留为讨论快照，不再与仓库双向各自更新状态。
- 需求包编号保持稳定。来源文件保持原文，新决定写入当前文档和问题记录。
- 项目级分工或公共规则变化更新总体需求；条目状态更新范围台账；问题答复更新问题台账；阶段交接更新阶段计划与对应 RESULT。
- 后续有可运行原型后，再补充实际核验的精确依赖、Node/包管理器、安装命令、启动端口、路由、角色与样例数据复位方式；不重开已确认的技术方向。

## 初始化核验与本轮记录

2026-11-04本轮接手时，本地`main`与远程`main`均为上述初始化SHA；origin正确，暂存区为空。工作区已有手动修改的根AGENTS及`docs/stages/stage00/`四文档，均作为输入保留；现归并到`stage-00/`并同步项目状态和规则，详细记录见[RESULT第10节](docs/stages/stage-00/RESULT.md#10-v04文档合并与一致性核对2026-11-04)。

本轮提交、推送及远程SHA核对以提交后的实际Git结果为准，不在提交文件中预填其自身SHA。文档已审或已提交不代表原型、生产、真实渠道或人工验收通过。
