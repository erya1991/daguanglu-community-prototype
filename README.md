# 大光路物业运营平台需求与演示原型

仓库名称：`daguanglu-community-prototype`。

本项目保存商城之外由 lee 统筹的产品需求、演示原型、验收与研发交接资料。商城继续由原项目推进；居民共享与邻里互助由同事设计。本项目保留整个建设方案的功能对应关系，方便后续整合。

## 当前状态

- 当前Git保存轮（2026-11-07）：用户确认将工作区全部有效修改提交到`stage/00-foundation`。该分支承接现有`c3d51eb`基线和两个既有提交，再保存R2全部整改、权限适配、测试证据及Stage02四份准备文档；不推送、不合并main，其他分支位置保持。实际本地检查点以包含本段的提交及Git回执为准；验收状态仍待负责人确认。
- 上一实施轮记录（保留）：Stage00 R2人工验收整改，修复身份切换并调整空间资源查询与操作；本次R1人工反馈2 PASS、4 FAIL、9待验，R2实际结果见Stage00 RESULT第14节，OWNER_RETEST_PENDING、NOT_STAGE_PASS。
- 此前Git交付轮（历史）：模板归整完成后，用户追加授权一次工作区提交并推送Stage01同名分支；包含继承R1／R2、Stage01原型、证据与V0.4文档。不合并、不上线、不改变人工验收结论；实际检查点以包含Stage01 RESULT第8.6节的提交及远端回执为准。
- 已有联合原型及模板轮历史：Stage01联合原型已实现，自测记录已形成，待lee统一人工验收；Stage00 R1历史反馈及H08 FAIL保持。先前模板轮只归整Stage01四文档；后续R2按用户授权最小适配既有平台管理权限，未新增Stage01业务。
- Stage01：01A物业收费停车与01B工单报修隐患已实施，本地自测已记录，待lee统一人工验收；V0.3需求设计基线保留，未标PASS。
- 需求与计划：Stage00 REQUIREMENTS V0.6 R2补充、PLAN／ACCEPTANCE V0.7、RESULT V0.8；此前文档复核、R1及人工沿革保留，当前事实见RESULT第15节。
- Git历史（R1及首次导入轮）：本轮R1开始基线为`234bf251f429e77e0996ce2854a237021c1914f4`，分支`stage/00-foundation`，开始时工作区及暂存区为空；本轮不暂存、提交、推送或合并。以下为历史交付授权：首次导入轮开始HEAD为`a4210cd8ec9319df3a7092738ac889ae522b406c`；文档导入结束后，用户于2026-11-05追加授权将15份文档保存为一次提交并推送到`origin/stage/00-foundation`。本次版本以包含本段记录的Git提交为准，实际推送以Git回执及远端SHA核对为准；不合并、不切换分支。
- 原型：三个独立uni-app＋Manager兼容Web＋DGL-001～011 Mock基础业务；Stage00仍为NOT_STAGE_PASS，Stage01联合原型已实现、待lee统一人工验收，Stage02～05未启动。
- 技术方向：Web沿用实际LiLiShop Manager的Vue 2、View UI/view-design、Vue Router 3、Vuex 3与Vue CLI；三小程序使用uni-app、Vue 3＋TypeScript＋Vite。依赖、锁文件与构建按Web/移动端隔离，精确环境实施前核验，见[AGENTS第6.1节](AGENTS.md#61-分端前端技术基线2026-11-04用户确认)。
- 生产进度：以研发和原商城项目实际记录为准，本仓库尚未核定。

Stage00文档整合、复核、实施自测及本地Git检查点属于此前记录，人工验收、真实研发接收和Stage通过仍需实际依据。此前首次导入轮只更新长期协作规则和Stage01完整文档，不安装、不启动、不构建、不做代码测试。六阶段分组与产品交接日期仍为讨论建议。三角色、产品语言与演示辅助、Web布局及微信验证的长期原则以[根AGENTS](AGENTS.md)为主维护位置。

## 第一次使用

1. 打开现有独立仓库，先读[AGENTS.md](AGENTS.md)并核对实际分支、工作区与本轮授权；不重复初始化Git。
2. Stage00实际原型与验收边界见[需求](docs/stages/stage-00/REQUIREMENTS.md)、[计划](docs/stages/stage-00/PLAN.md)、[验收清单](docs/stages/stage-00/ACCEPTANCE.md)和[结果](docs/stages/stage-00/RESULT.md)。Stage01文档入口见[需求](docs/stages/stage-01/REQUIREMENTS.md)、[计划](docs/stages/stage-01/PLAN.md)、[验收设计](docs/stages/stage-01/ACCEPTANCE.md)和[实施与验证记录](docs/stages/stage-01/RESULT.md)。
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
| 01 | 物业收费停车与统一事件闭环 | V0.3设计基线保留；01A／01B联合原型已实现，自测见RESULT，待lee统一人工验收 |
| 02 | 便民服务闭环 | 未启动 |
| 03 | 活动与积分运营 | 未启动；活动暂由lee负责 |
| 04 | 网格党建与安全协同 | 未启动；业务及外部条件需并行确认 |
| 05 | 运营汇总与整体交付 | 未启动；消息权限统计随各业务同步定义 |

各阶段使用 `REQUIREMENTS.md`、`PLAN.md`、`ACCEPTANCE.md`、`RESULT.md` 四份文档。Stage00已归并到规范目录，Stage01从完整V0.3输入包首次导入，无本地V0.1／V0.2旧版；所有来源的阶段四文档均须按当前[阶段模板](docs/templates/stage/REQUIREMENTS.md)组织；完整附件作为内容来源并完整归位，具体流程统一见[WORKFLOW](docs/WORKFLOW.md)。Stage01当前四文档V0.4仅作模板结构归整／内容保全修订，V0.3业务基线与真实实施记录保留。

Stage00承担三个独立小程序框架＋Manager兼容Web框架＋DGL-001～011基础业务原型。住户沿用“首页｜服务｜商城｜我的”，商户沿用“工作台｜经营｜订单｜我的”；管理端独立，“工作台｜档案｜我的”是本版方案。商城实际工程继续作为生产开发基础，原型只复用获准框架、主题、组件与导航，新增业务只接Service/Adapter后的Mock，研发按模块接收增量。

基础网格与责任区域本次不执行，不作为前置；普通社区/小区数据可见清单保留。DGL-039仍在总体清单中待街道确认。H5同源静态预览共享模拟事实，微信分别做本端模拟验证，样例切换不代表跨App同步。

## 文档与状态维护

- 本仓库 Markdown 是后续主维护版本；前一轮 Excel 和 Word 保留为讨论快照，不再与仓库双向各自更新状态。
- 需求包编号保持稳定。来源文件保持原文，新决定写入当前文档和问题记录。
- 项目级分工或公共规则变化更新总体需求；条目状态更新范围台账；问题答复更新问题台账；阶段交接更新阶段计划与对应 RESULT。
- 下文安装、启动、身份、复位及运行证据均为Stage00既有操作说明；Stage01当前实施与证据见下文新增入口和其RESULT；Stage00以下段落保留历史含义，不将旧运行证据记作Stage01验证。

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
| `/web/?session=demo` | 新会话platform-admin／平台管理员，可切物业管理员 | 社区房屋档案树列表、资源和房屋导入、房屋绑定四页签及原基础业务 |
| `/resident/?session=demo` | resident-a／林示例 | 首页、资料、本人房屋与申请、车辆、结果消息；服务与商城保留交付边界 |
| `/merchant/?session=demo` | merchant／演示商户 | 工作台、经营、订单、我的及主体范围；无交易全链路副本 |
| `/staff/?session=demo` | property-admin／物业管理员 | 工作台、档案、我的；授权内查询基础档案，仍无移动审批 |

住户与商户保留原四Tab，管理端为三Tab。三个应用有独立App/main/pages/manifest和产物，不使用单App切角色替代。手机H5可使用390×844或414×896视口；Web已检查1366×768及1920×1080。

## 演示身份、主流程与复位

R1普通演示采用[根AGENTS第5.2节](AGENTS.md#52-社区物业原型的演示角色)的三个角色类型：平台管理员、物业管理员、住户。住户A/B是同一角色下的不同账号；商户保留固定主体与独立App，不加入三角色选择器。管理端的物业身份不包含移动审核。

Web右上角“演示身份”，移动“我的—演示身份与辅助工具”（默认收起）可切普通虚构账号。Web默认平台管理员，物业管理员负责青禾授权范围的日常维护、审核、车辆、人员和文件；平台全范围由明确种子清单表达，敏感信息和文件下载另验权。旧archive、audit、sensitive、file-owner、file-reader及dual等保留为自动回归夹具，不出现在普通选择器，不要求负责人逐个切换。账号没有真实口令或商城Token；空小区清单仍为无权，上下文只能缩小范围。

1. 从同源入口打开住户、Web、管理端，统一使用`session=demo`，保留住户身份不动。
2. 住户进入“我的房屋—添加房屋”，选择青禾示例社区／花园／楼栋／房屋，选择关系并提交。绑定说明可空，联系号码必填；变更和解除须说明原因；材料和有效期标为样例规则。
3. Web在“演示身份”切物业管理员，进入“房屋绑定”，核对申请编号及绑定信息／居民信息／房屋信息／审核记录四页签；选择通过或填写原因驳回，无需再切audit。内部备注只供获准管理人员；重提保留旧轮次。
4. 住户刷新／重新激活，检查申请结果、我的房屋和结果消息。管理端按授权查询同一房屋及获准资料。
5. 分别用受限账号检查脱敏、无权详情、材料、导出和文件下载；配置管理员不默认具备居民敏感权限。

新建社区或小区后，由平台管理员在账号授权中明确勾选新范围，再维护下级；保存不会自动扩大授权。已有会话自动幂等升级，不要求清空：原房屋、申请、关系、消息、附件、历史和旧账号保留；旧Web资料身份映射为物业、配置身份映射为平台，并保留原授权。新会话按三角色种子初始化。升级异常会提示保留数据，不自动复位。

种子`stage00-v1`含两个虚构社区、有／无单元、多人多房、驳回样例、车辆冲突、离岗双身份及文件V1。通过实际上传新版本生成V2并保留V1。房屋导入提供UTF-8 CSV示例，演示限制2 MiB；文件演示接受PDF、PNG/JPEG、TXT、DOCX、XLSX，限10 MiB。以上是原型技术限制，Q04/Q06正式政策未确认；不支持预览的格式明确说明并按权限下载。

演示控制中的复位需确认，仅重置当前会话事实和附件。各端身份键独立；同一会话在同一浏览器配置、同源下共享IndexedDB事实。不同端口不作为共享环境，其他会话和商城数据不受复位影响。表单提供模拟失败、保留输入及重试；关系草稿可本地保存。

## 构建、自测和微信工具

```powershell
Set-Location 'D:\git\daguanglu-community-prototype'
node scripts/verify-builds.mjs
node scripts/prepare-wechat.mjs
npm.cmd test
npm.cmd run check
node scripts/browser-r1.mjs
node scripts/browser-r1-fields.mjs
node scripts/check-docs.mjs
```

以上browser-acceptance／interactions／constraints／fields脚本保留旧版回归沿革；R1当前使用`node scripts/browser-r1.mjs`与`node scripts/browser-r1-fields.mjs`，分别记录实际场景及24表295行可达性。失败项可用`node scripts/browser-r1.mjs --only=R1-04`定向复验，参数先校验，始终创建独立虚构会话。历史字段映射不覆盖，R1证据单独位于`docs/stages/stage-00/evidence/r1-*.json`。

`verify-builds`逐项输出Web、住户／商户／管理端各H5和mp-weixin共七类构建及三个vue-tsc结果，日志位于`.runtime/stage00/BUILD_*/`。移动端也可在`miniapp`目录单独运行`npm.cmd run build:resident:h5`等`build:<resident|merchant|staff>:<h5|mp-weixin>`和`type-check:<resident|merchant|staff>`。单端开发脚本`dev:<端>:<平台>`仅用于调试，不作为跨端数据共享证据。

三个微信导入目录分别为：

```text
D:\git\daguanglu-community-prototype\miniapp\apps\resident-miniapp\dist\build\mp-weixin
D:\git\daguanglu-community-prototype\miniapp\apps\merchant-miniapp\dist\build\mp-weixin
D:\git\daguanglu-community-prototype\miniapp\apps\staff-miniapp\dist\build\mp-weixin
```

`prepare-wechat`生成本地测试配置，保留本原型中已有的用户本地工具配置，不复制商城AppID或登录状态。若工具要求测试资格，按各端获准配置处理；不启用真实后台或登录。微信使用各App本端uni存储；“未绑定／已通过样例”仅为本端种子切换，不表示Web审核回传。

历史实现轮微信工具**未完成三端关键路径验收**：住户实际导入曾发现WXSS选择器错误，代码已修复、后续构建和静态检查通过；修正后的工具交互被电脑控制停止信号阻断。CLI安全端口关闭，本轮未修改安全设置。请在工具中分别编译三端，检查主要Tab、返回、胶囊与安全区、表单、空态／无权；住户完成本端提交，管理端查询，商户核对范围入口。保留实际错误日志，不以H5替代。

## 验收证据与研发接收

历史[RESULT第11节](docs/stages/stage-00/RESULT.md#11-本轮获准实施自测与待验收记录2026-11-04)记录任务、来源、失败修复、七类构建及31场景。[字段映射](docs/stages/stage-00/evidence/field-mapping.json)保留23表287行对应，PASS表示实际呈现证据，规则及权限还须结合场景验证，不等于所有人工组合已验收。截图、日志和工具缓存位于`.runtime/stage00/`，不会自动进入Git；可按需要连同证据索引进行内部交接。

新业务页面位于各App的`pages/foundation`和共享`miniapp/packages/foundation`；Web基础业务位于`web/manager/src/views`及组件；框架无关规则、Mock契约和存储适配在`prototype-shared`。研发可按DGL模块迁移页面与规则，公共App/main、路由、manifest、导航、主题、组件、Manager布局与构建配置须语义合并，不能覆盖正式工程。生成的`src/_shared`和`src/_core`由同步脚本维护，改动应回到规范源文件。

**生产排除：**虚构账号、演示切换、失败控制、种子、复位、IndexedDB／uni Mock适配及静态预览器均不进入生产。生产需要补验真实账号映射、鉴权、字段与附件授权、导出、后端事务与持久化、文件存储、消息、真实台账和接入商城后的回归。Q02～Q06仍待确认。

2026-11-04的工作区待验收快照见[evidence/candidate-snapshot.json](docs/stages/stage-00/evidence/candidate-snapshot.json)；2026-11-05本地提交授权及范围见[RESULT第12节](docs/stages/stage-00/RESULT.md#12-本地git检查点2026-11-05)。本地提交仅保存当前实现，lee人工验收、研发实际接收和Stage00通过仍需后续实际依据。

## Stage00 R1待复验入口（历史步骤，当前空间规则见R2）

本轮另起的统一静态预览为 **http://127.0.0.1:19201/**；旧19200服务未停止。四端使用同一新端口和同一`session`，例如：

- [Web社区房屋档案](http://127.0.0.1:19201/web/?session=R1-demo#/spaces)：新会话默认平台管理员；右上“演示身份”可切物业管理员。
- [住户H5](http://127.0.0.1:19201/resident/?session=R1-demo)：林示例／住户，可在“我的”辅助工具切同角色住户B。
- [管理端H5](http://127.0.0.1:19201/staff/?session=R1-demo)：物业管理员，授权内查询，无移动审核。
- [商户H5](http://127.0.0.1:19201/merchant/?session=R1-demo)：固定商户上下文，保留原四Tab和交付说明。

旧端口、不同浏览器或其他设备的演示存储不会共享到新端口；升级仅处理同一源既有会话，不跨端口迁移。下次重启仍以`.runtime/stage00/preview.json`的实际地址为准。

建议先复验H08：社区房屋档案→选小区／楼栋→新增房间、设施／车位→房屋导入；再验房屋绑定四页签、物业审核、住户结果及管理端查询；最后抽查权限、帮助和移动端关键路径。H08初次FAIL仍保留，原始失败环境、截图和具体步骤未提供，当前为整改自测后待负责人复验。

导入虚构样表：[无单元02幢](docs/stages/stage-00/evidence/r1-houses-without-unit.csv)、[有单元01幢](docs/stages/stage-00/evidence/r1-houses-with-unit.csv)。前者在02幢、后者在01幢或1单元范围导入；已导入的样表再次提交应提示重复。选择不同楼栋应提示归属冲突，错误批次不写入；不要为了重试先清空已有关系。两表业务编号及房号都保留前导零。

设施／车位只能在小区或楼栋下新增，社区仅汇总，单元和房间不显示资源新增；车位与房屋独立，不涉及收费、月卡、租赁或实时占用。房间显示名不改变原房屋对象、编号和绑定引用。新增社区小区后通过显式授权继续维护，不自动授予下级范围。

当前证据：[R1场景](docs/stages/stage-00/evidence/r1-scenario-results.json)、[七构建及三类型](docs/stages/stage-00/evidence/r1-build-results.json)、[295行访问映射](docs/stages/stage-00/evidence/r1-field-mapping.json)、[微信实际范围](docs/stages/stage-00/evidence/r1-wechat-results.json)及[RESULT第13节](docs/stages/stage-00/RESULT.md#13-stage00人工验收整改r12026-11-05)。295行PASS表示实际可达呈现，不能代替全部业务组合、生产或人工验收。

本轮微信工具实际确认了住户首页／我的、辅助展开、房屋空态与绑定表单；提交按钮自动化边界缺失，未完成工具内提交；商户和管理端尚无本轮工具交互证据。工具警告、截图通道限制及历史BLOCKED均保留。七类构建和H5通过不替代这些检查，也不代替真机和负责人复验。

R1交付停止在工作区待复验版本，**未暂存、未提交、未推送、未合并，NOT_STAGE_PASS**。该R1轮未改Stage01四文档；空间资源关联变化在Stage00交接中记录，等待后续研发衔接。


## Stage00 R2：当前操作与复验约定

本轮只使用 **19201**。负责人原反馈环境为`session=R1-demo`，请保留该会话的数据和历史；自动测试另用独立会话。现有工作区已包含Stage01增量，R2在实际`stage/01-property-parking-workorder`上保护既有成果，不切换分支或重建工程。

- [Web社区房屋档案](http://127.0.0.1:19201/web/?session=R1-demo#/spaces)：演示身份平台／物业切换后应自动关闭；关闭按钮、遮罩、Escape及连续切换均需复验。
- [住户](http://127.0.0.1:19201/resident/?session=R1-demo)、[管理端](http://127.0.0.1:19201/staff/?session=R1-demo)、[商户](http://127.0.0.1:19201/merchant/?session=R1-demo)：同一浏览器、同一会话读取同源事实，原应用和身份边界保留。

R2最新补充：平台管理员拥有全部已实现的后台演示管理权限，新社区／小区无需另补平台授权；物业及住户仍按原范围。空间树根默认“大光路社区”。搜索框下独立工具栏按当前选中节点提供“新增下级／新增同级”，当前节点名称在工具栏下显示；树行只展示层级图标、名称、数量及停用状态。点击选中节点后才显示该节点右侧编辑／启停图标，根图标编辑名称；悬停或仅聚焦未选节点不显示操作，切换选中后旧节点图标隐藏。当前节点旁的信息图标可查看详情。房间无行操作，仍从右列表查看、编辑及启停。树内容单独滚动，不滚走新增工具栏；停用历史保留，不自动级联删除。

右侧恒定房屋空间、设施点位、车位资源三页签，按当前节点汇总末级结果。各树层级都能新增房间；已知社区／小区／楼栋／单元逐字段显示名称并禁用，其余级联选择。有单元楼栋下的单元可选；房间入口按实际父级新增同级，保存后回父查看。CSV仍从上级范围导入，房间自身不作导入容器。

设施、车位也使用逐级归属，可小区直属、楼栋直属或实际单元直属；单元下可直接新增，房间入口沿其实际单元／楼栋新增。资源不进入房屋层级，旧编号和归属保持，普通编辑不迁移。列表过宽可在表内横向滚动，详情只读，房屋绑定审核仍在原四页签中办理。最新规则见Stage00 REQUIREMENTS第12节、执行与证据见RESULT第15节；三端微信工具和真机另按实际记录。

复验顺序：身份弹窗连续切换→左树结构／停用→恒三页签与全部末级汇总→全路径和资源归属→行操作／只读详情→CSV合法、错误、超限重选→原绑定、消息和权限。仍可使用原[有单元样表](docs/stages/stage-00/evidence/r1-houses-with-unit.csv)、[无单元样表](docs/stages/stage-00/evidence/r1-houses-without-unit.csv)，不为重试先清已有关系。

负责人本次R1-H03、H06 PASS原样保留，R1-H01、H02、H04、H05 FAIL不因自动测试而改成人工PASS；R1-H07～H15仍待验。当前R2执行与真实分项结果见[RESULT第14节](docs/stages/stage-00/RESULT.md#14-r2人工验收整改空间资源查询与操作2026-11-06)及[专项验收](docs/stages/stage-00/ACCEPTANCE.md#11-r2专项验收空间资源查询与操作)。未完成的微信工具／真机单独记录，NOT_STAGE_PASS，不自动提交、推送或合并。

## Stage01联合原型（待统一人工验收）

当前分支stage/01-property-parking-workorder，基线234bf25加继承R1及本轮未提交差异。完整结果、验收、字段路径与限制见[Stage01 RESULT实现与自测](docs/stages/stage-01/RESULT.md#2-实际需求实现对应表)、[ACCEPTANCE](docs/stages/stage-01/ACCEPTANCE.md)及[PLAN实际路由与字段路径](docs/stages/stage-01/PLAN.md#stage01-actual-routes)。Stage00历史H08 FAIL与NOT_STAGE_PASS保持。

| 本机入口 | 身份 |
| --- | --- |
| [统一入口](http://127.0.0.1:19202/) | stage01-demo；请在同一浏览器使用同一会话 |
| [Web物业办理](http://127.0.0.1:19202/web/?session=stage01-demo#/property/bills) | 默认property-admin；顶部“演示身份”可选platform-admin进入原系统管理 |
| [住户服务](http://127.0.0.1:19202/resident/?session=stage01-demo#/pages/service/index) | 默认resident-b周明；物业缴费、停车、报修、隐患、业务记录 |
| [管理端工作台](http://127.0.0.1:19202/staff/?session=stage01-demo#/pages/workbench/index) | 默认property-admin；工单待办、现场上报、收费查询；收费及Stage00档案只读 |

预览停止时，在仓库根执行node scripts/preview.mjs --stage01或npm run preview -- --stage01，以实际输出端口为准。当前为127.0.0.1本机静态预览，不是远端部署。

五条主线分别为：CSV导入核验发布→住户单账单缴费与凭证；停车月租新办／续费预缴→平台登记；临停单张账单→确认报价支付核销；住户报修→物业核实派单接单处理复核→住户确认评价；隐患上报→整改前后证据→复核销号→公开反馈。具体逐步操作与[CSV样例](docs/stages/stage-01/evidence/物业账单导入样例.csv)见[RESULT第7.1节](docs/stages/stage-01/RESULT.md#stage01-demo-entry)。

复位在独立辅助入口选择“仅复位Stage01”，保留基础档案、关系及Stage00历史；异常场景与回放也在辅助入口。不同浏览器、端口、设备及微信App不会自然同步本地数据。

本轮70项规则、七构建与三类型通过；23视图和实际字段证据见阶段记录。微信开发者工具只读状态授权超时，运行与真机未验，lee人工验收未执行。金额、自然月、字典和附件上限为可替换演示假设；真实支付、厂商、消息、生产鉴权与上线均不在本轮。无感未开放、积分关闭，不进入Stage02；保留工作区，不暂存、提交、推送或合并。

Stage01复核使用npm test，以及node scripts/check-stage01.mjs、node scripts/check-stage01-fields.mjs、node scripts/check-stage00.mjs --stage01和node scripts/check-docs.mjs --stage01；后两者必须带阶段参数以保护Stage00历史输出。
