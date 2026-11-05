# 大光路物业运营平台需求与演示原型

仓库名称：`daguanglu-community-prototype`。

本项目保存商城之外由 lee 统筹的产品需求、演示原型、验收与研发交接资料。商城继续由原项目推进；居民共享与邻里互助由同事设计。本项目保留整个建设方案的功能对应关系，方便后续整合。

## 当前状态

- 当前步骤：Stage00原型已实施，待lee人工验收；七类构建和三端类型检查通过，微信工具及完整源画面对照仍有受阻项。
- Stage01：完整V0.3四文档已首次导入，需求设计与评审中；原型未实施、验收未执行，未标PASS。当前仅文档授权，不实施Stage01代码。
- 需求与计划：REQUIREMENTS V0.3承接已审V0.2；用户于2026-11-04告知ChatGPT已复核文档提交dea2d20，并确认集中实施计划。执行事实见RESULT第11节。
- Git：当前`stage/00-foundation`，首次导入轮开始HEAD为`a4210cd8ec9319df3a7092738ac889ae522b406c`；文档导入结束后，用户于2026-11-05追加授权将15份文档保存为一次提交并推送到`origin/stage/00-foundation`。本次版本以包含本段记录的Git提交为准，实际推送以Git回执及远端SHA核对为准；不合并、不切换分支。
- 原型：三个独立uni-app＋Manager兼容Web＋DGL-001～011 Mock基础业务；Stage00仍为NOT_STAGE_PASS，Stage01仅文档设计，Stage02～05未启动。
- 技术方向：Web沿用实际LiLiShop Manager的Vue 2、View UI/view-design、Vue Router 3、Vuex 3与Vue CLI；三小程序使用uni-app、Vue 3＋TypeScript＋Vite。依赖、锁文件与构建按Web/移动端隔离，精确环境实施前核验，见[AGENTS第6.1节](AGENTS.md#61-分端前端技术基线2026-11-04用户确认)。
- 生产进度：以研发和原商城项目实际记录为准，本仓库尚未核定。

Stage00文档整合、复核、实施自测及本地Git检查点属于此前记录，人工验收、真实研发接收和Stage通过仍需实际依据。本轮只更新长期协作规则并首次导入Stage01完整文档，不安装、不启动、不构建、不做代码测试。六阶段分组与产品交接日期仍为讨论建议。三角色、产品语言与演示辅助、Web布局及微信验证的长期原则以[根AGENTS](AGENTS.md)为主维护位置。

## 第一次使用

1. 打开现有独立仓库，先读[AGENTS.md](AGENTS.md)并核对实际分支、工作区与本轮授权；不重复初始化Git。
2. Stage00实际原型与验收边界见[需求](docs/stages/stage-00/REQUIREMENTS.md)、[计划](docs/stages/stage-00/PLAN.md)、[验收清单](docs/stages/stage-00/ACCEPTANCE.md)和[结果](docs/stages/stage-00/RESULT.md)。Stage01文档入口见[需求](docs/stages/stage-01/REQUIREMENTS.md)、[计划](docs/stages/stage-01/PLAN.md)、[验收设计](docs/stages/stage-01/ACCEPTANCE.md)和[本地导入记录](docs/stages/stage-01/RESULT.md)。
3. Stage01代码实施及后续Stage按[阶段计划](docs/STAGES.md)和实际授权推进。[仓库准备说明](docs/REPOSITORY_SETUP.md)保留为INIT历史操作说明，不是本轮待执行任务。

实际本地位置：`D:\git\daguanglu-community-prototype`。安装、构建、缓存和静态预览均在本原型仓完成，不依赖商城目录；无生产后端或业务Mock服务。

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
| 00 | 公共基础与协作约定 | 原型待人工验收；构建与H5自测通过，微信及部分视觉证据受阻 |
| 01 | 物业收费停车与统一事件闭环 | V0.3文档已首次导入，需求设计与评审中；01A／01B共享四文档，原型未实施、验收未执行 |
| 02 | 便民服务闭环 | 未启动 |
| 03 | 活动与积分运营 | 未启动；活动暂由lee负责 |
| 04 | 网格党建与安全协同 | 未启动；业务及外部条件需并行确认 |
| 05 | 运营汇总与整体交付 | 未启动；消息权限统计随各业务同步定义 |

各阶段使用 `REQUIREMENTS.md`、`PLAN.md`、`ACCEPTANCE.md`、`RESULT.md` 四份文档。Stage00已归并到规范目录，Stage01从完整V0.3输入包首次导入，无本地V0.1／V0.2旧版；没有完整输入的后续阶段获准启动后使用[阶段模板](docs/templates/stage/REQUIREMENTS.md)。

Stage00承担三个独立小程序框架＋Manager兼容Web框架＋DGL-001～011基础业务原型。住户沿用“首页｜服务｜商城｜我的”，商户沿用“工作台｜经营｜订单｜我的”；管理端独立，“工作台｜档案｜我的”是本版方案。商城实际工程继续作为生产开发基础，原型只复用获准框架、主题、组件与导航，新增业务只接Service/Adapter后的Mock，研发按模块接收增量。

基础网格与责任区域本次不执行，不作为前置；普通社区/小区数据可见清单保留。DGL-039仍在总体清单中待街道确认。H5同源静态预览共享模拟事实，微信分别做本端模拟验证，样例切换不代表跨App同步。

## 文档与状态维护

- 本仓库 Markdown 是后续主维护版本；前一轮 Excel 和 Word 保留为讨论快照，不再与仓库双向各自更新状态。
- 需求包编号保持稳定。来源文件保持原文，新决定写入当前文档和问题记录。
- 项目级分工或公共规则变化更新总体需求；条目状态更新范围台账；问题答复更新问题台账；阶段交接更新阶段计划与对应 RESULT。
- 下文安装、启动、身份、复位及运行证据均为Stage00既有操作说明；Stage01本轮只做文档，实际导入与静态检查统一维护在其RESULT，不重开已确认规则或将旧运行证据记为Stage01验证。

## 初始化及上一轮文档记录（历史保留）

2026-11-04本轮接手时，本地`main`与远程`main`均为上述初始化SHA；origin正确，暂存区为空。工作区已有手动修改的根AGENTS及`docs/stages/stage00/`四文档，均作为输入保留；现归并到`stage-00/`并同步项目状态和规则，详细记录见[RESULT第10节](docs/stages/stage-00/RESULT.md#10-v04文档合并与一致性核对2026-11-04)。

本轮提交、推送及远程SHA核对以提交后的实际Git结果为准，不在提交文件中预填其自身SHA。文档已审或已提交不代表原型、生产、真实渠道或人工验收通过。

## Stage00安装与运行

已验证环境为Windows、Node **24.14.0**、npm **11.9.0**，本仓专用Yarn **1.22.22**。Web与移动分别安装，根目录不安装统一Vue。精确版本、锁文件和来源见[实际来源清单](docs/stages/stage-00/evidence/source-manifest.json)及[构建记录](docs/stages/stage-00/evidence/build-results.json)。

在PowerShell中执行：

```powershell
Set-Location 'D:\git\daguanglu-community-prototype'
node scripts/setup-tools.mjs
$env:npm_config_cache = 'D:\git\daguanglu-community-prototype\.runtime\stage00\cache\npm'
npm.cmd --prefix miniapp ci --no-audit --no-fund
$env:YARN_CACHE_FOLDER = 'D:\git\daguanglu-community-prototype\.runtime\stage00\cache\yarn'
node .runtime/stage00/tools/yarn/bin/yarn.js --cwd web/manager install --frozen-lockfile --non-interactive
npm.cmd run build:preview
npm.cmd run preview
```

预览器默认绑定`http://127.0.0.1:19200/`；冲突时顺延至可用端口，实际地址记录在`.runtime/stage00/preview.json`，不会停止已有服务。安装命令仅改变当前进程缓存变量，不修改全局工具配置。Manager沿用原锁定栈及compression-webpack-plugin的受控兼容补丁；Sass弃用和包体积警告见构建日志，不通过全量升级或关闭校验消除。

| 入口 | 默认虚构账号 | 本轮功能 |
| --- | --- | --- |
| `/web/?session=demo` | archive／基础资料维护岗 | 组织权限、空间、居民绑定审核、导入、统计、车辆、设施、人员、文件与消息；按身份显示菜单 |
| `/resident/?session=demo` | resident-a／林示例 | 首页、资料、本人房屋与申请、车辆、结果消息；服务与商城保留交付边界 |
| `/merchant/?session=demo` | merchant／演示商户 | 工作台、经营、订单、我的及主体范围；无交易全链路副本 |
| `/staff/?session=demo` | staff／受限查询岗 | 工作台、档案、我的；按权限查询基础档案，无移动审批 |

住户与商户保留原四Tab，管理端为三Tab。三个应用有独立App/main/pages/manifest和产物，不使用单App切角色替代。手机H5可使用390×844或414×896视口；Web已检查1366×768及1920×1080。

## 演示身份、主流程与复位

本节保留Stage00实际账号与操作说明，未据本轮文档任务修改原型身份。后续社区、物业演示默认采用[根AGENTS第5.2节](AGENTS.md#52-社区物业原型的演示角色)的三角色规则；Stage01获准实施时再按实际基线衔接，不能据文档导入宣称现有页面已完成角色或布局改造。

Web右上角“演示控制”、移动“我的—演示控制”可切换固定虚构身份。主要Web账号：`archive`资料维护、`audit`人房审核、`admin`配置、`staff`受限查询、`sensitive`敏感查询、`file-owner`文件维护、`file-reader`可查不可下载；住户有`resident-a`、`resident-b`及双身份样例`dual`。账号无真实口令、登录或商城Token；每端角色限定于该App，不合并所有身份权限。小区空清单表示未授权，不从已选社区继承全部小区。演示配置管理员可在本项目已建档虚构社区、小区内配置授权，这是Q03未确认前的明确演示参数，不代表生产授权上界。

1. 从同源入口打开住户、Web、管理端，统一使用`session=demo`，保留住户身份不动。
2. 住户进入“我的房屋—添加房屋”，选择青禾示例社区／花园／楼栋／房屋，选择关系并提交。绑定说明可空，联系号码必填；变更和解除须说明原因；材料和有效期标为样例规则。
3. Web切`audit`，进入关系申请，核对同一申请编号，选择通过或填写原因驳回。内部备注只供获准核验岗；重提保留旧轮次。
4. 住户刷新／重新激活，检查申请结果、我的房屋和结果消息。管理端按授权查询同一房屋及获准资料。
5. 分别用受限账号检查脱敏、无权详情、材料、导出和文件下载；配置管理员不默认具备居民敏感权限。

新建社区或小区保存后，应由`admin`在账号授权中明确勾选新范围，再切回业务身份查询和维护下级；新建不会自动扩大当前业务身份授权。旧演示会话如需使用本轮更新后的初始访问清单，请先在工具区手动复位。

种子`stage00-v1`含两个虚构社区、有／无单元、多人多房、驳回样例、车辆冲突、离岗双身份及文件V1。通过实际上传新版本生成V2并保留V1。房屋导入提供UTF-8 CSV示例，演示限制2 MiB；文件演示接受PDF、PNG/JPEG、TXT、DOCX、XLSX，限10 MiB。以上是原型技术限制，Q04/Q06正式政策未确认；不支持预览的格式明确说明并按权限下载。

演示控制中的复位需确认，仅重置当前会话事实和附件。各端身份键独立；同一会话在同一浏览器配置、同源下共享IndexedDB事实。不同端口不作为共享环境，其他会话和商城数据不受复位影响。表单提供模拟失败、保留输入及重试；关系草稿可本地保存。

## 构建、自测和微信工具

```powershell
Set-Location 'D:\git\daguanglu-community-prototype'
node scripts/verify-builds.mjs
node scripts/prepare-wechat.mjs
npm.cmd test
npm.cmd run check
node scripts/browser-acceptance.mjs
node scripts/browser-interactions.mjs
node scripts/browser-constraints.mjs
node scripts/browser-fields.mjs
node scripts/check-docs.mjs
```

`verify-builds`逐项输出Web、住户／商户／管理端各H5和mp-weixin共七类构建及三个vue-tsc结果，日志位于`.runtime/stage00/BUILD_*/`。移动端也可在`miniapp`目录单独运行`npm.cmd run build:resident:h5`等`build:<resident|merchant|staff>:<h5|mp-weixin>`和`type-check:<resident|merchant|staff>`。单端开发脚本`dev:<端>:<平台>`仅用于调试，不作为跨端数据共享证据。

三个微信导入目录分别为：

```text
D:\git\daguanglu-community-prototype\miniapp\apps\resident-miniapp\dist\build\mp-weixin
D:\git\daguanglu-community-prototype\miniapp\apps\merchant-miniapp\dist\build\mp-weixin
D:\git\daguanglu-community-prototype\miniapp\apps\staff-miniapp\dist\build\mp-weixin
```

`prepare-wechat`生成本地测试配置，保留本原型中已有的用户本地工具配置，不复制商城AppID或登录状态。若工具要求测试资格，按各端获准配置处理；不启用真实后台或登录。微信使用各App本端uni存储；“未绑定／已通过样例”仅为本端种子切换，不表示Web审核回传。

当前微信工具**未完成三端关键路径验收**：住户实际导入曾发现WXSS选择器错误，代码已修复、后续构建和静态检查通过；修正后的工具交互被电脑控制停止信号阻断。CLI安全端口关闭，本轮未修改安全设置。请在工具中分别编译三端，检查主要Tab、返回、胶囊与安全区、表单、空态／无权；住户完成本端提交，管理端查询，商户核对范围入口。保留实际错误日志，不以H5替代。

## 验收证据与研发接收

当前[RESULT第11节](docs/stages/stage-00/RESULT.md#11-本轮获准实施自测与待验收记录2026-11-04)记录任务、来源、失败修复、七类构建及31场景。[字段映射](docs/stages/stage-00/evidence/field-mapping.json)保留23表287行对应，PASS表示实际呈现证据，规则及权限还须结合场景验证，不等于所有人工组合已验收。截图、日志和工具缓存位于`.runtime/stage00/`，不会自动进入Git；可按需要连同证据索引进行内部交接。

新业务页面位于各App的`pages/foundation`和共享`miniapp/packages/foundation`；Web基础业务位于`web/manager/src/views`及组件；框架无关规则、Mock契约和存储适配在`prototype-shared`。研发可按DGL模块迁移页面与规则，公共App/main、路由、manifest、导航、主题、组件、Manager布局与构建配置须语义合并，不能覆盖正式工程。生成的`src/_shared`和`src/_core`由同步脚本维护，改动应回到规范源文件。

**生产排除：**虚构账号、演示切换、失败控制、种子、复位、IndexedDB／uni Mock适配及静态预览器均不进入生产。生产需要补验真实账号映射、鉴权、字段与附件授权、导出、后端事务与持久化、文件存储、消息、真实台账和接入商城后的回归。Q02～Q06仍待确认。

2026-11-04的工作区待验收快照见[evidence/candidate-snapshot.json](docs/stages/stage-00/evidence/candidate-snapshot.json)；2026-11-05本地提交授权及范围见[RESULT第12节](docs/stages/stage-00/RESULT.md#12-本地git检查点2026-11-05)。本地提交仅保存当前实现，lee人工验收、研发实际接收和Stage00通过仍需后续实际依据。
