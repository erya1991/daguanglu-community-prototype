# Stage00｜公共基础与协作约定｜原型执行计划

> 当前版本：V1.1｜2026-11-09｜负责人已确认当前Web／H5原型范围全部验证通过；微信检查按原决定暂缓。生产研发、真实联调及其他Stage验收分别记录。

<!-- stage00-current-v1.1 -->

修订前全文按原字节保存在[PLAN历史快照](evidence/pre-main-20261109/PLAN.txt)，摘要及模板来源见[归档清单](evidence/pre-main-20261109/manifest.json)。本文件正文是唯一现行口径；历史未执行、FAIL、BLOCKED及当时的待复验不被改写成当前通过。

## 1. 计划基线与执行范围

| 项目 | 内容 |
| --- | --- |
| 计划状态／负责人 | 现行原型已实施，lee已确认当前Web／H5范围验收通过；本轮收口四文档并准备已授权本地main合并 |
| 需求文档版本及确认依据 | REQUIREMENTS V1.1；本会话负责人最终验证确认，未重新开展需求评审 |
| 本次需求编号与交接分件 | DGL-001～011，Stage00；P00-01～P00-07编号保持，复用和取消不记成实现 |
| 原型技术栈及启动环境 | Web：Vue／compiler 2.7.16、view-design 4.7.0、Router 3.6.5、Vuex 3.6.2、Vue CLI 4.5.19、Webpack 4.47.0；移动：uni-app 3.0.0-5020420260813003、Vue 3.4.21、Vite 5.2.8、TS 4.9.5、vue-tsc 1.8.27；Node 24.14.0、npm 11.9.0、本仓Yarn 1.22.22 |
| 建议实施／验收／交接日期 | 初次实施及R1～R3已有实际记录；人工验收确认2026-11-09；研发接收日期未发生，不虚填 |
| 已明确可执行范围 | 已验收原型的字段／路由／交互／结果整理；历史保全、文档检查、保存Stage00成果及本地main合并 |
| 被待确认问题阻塞的范围 | 无阻止当前原型收口的问题；Q02～Q06、R3-Q02只影响生产接入或正式数据映射；已取消独立统计不阻塞 |
| 实际Git起始状态 | stage/00-foundation，HEAD e8ad276e72b81ca6dfd3146097fc320a60b30d11，继承R3未提交成果；main本地6299471，远程main实际a4210cd；不reset、不stash、不推送 |
| 模板依据 | docs/templates/stage/PLAN.md，实际SHA-256见归档清单 |

### 1.1 工程、来源与依赖隔离

| 位置／来源 | 当前用途 | 保护及交付边界 |
| --- | --- | --- |
| web/manager | 独立Vue2／Manager兼容Web；package.json、yarn.lock、node_modules、dist | 不与移动端共享Vue运行时，沿用现有压缩插件兼容补丁 |
| miniapp | npm workspace下resident、merchant、staff三个独立App；共享主题／UI／foundation | 分别入口、pages、manifest、身份、H5及mp-weixin产物；确定性同步共享代码 |
| prototype-shared | 不依赖Vue的业务规则、权限边界、Mock、同源存储及本端适配 | 产品运行不引用商城目录，不把本地存储适配和种子当生产后端 |
| scripts及.runtime | 构建／文档／浏览器检查、同源预览、原型专用工具缓存及证据 | 不改全局配置、不占用或停止商城服务；生成物按忽略规则管理 |
| 商城小程序源 | 8f15eed1255222ff9178b529d7a3039bfd67fab6所处已核验工作区的白名单 | 源仓只读；逐文件SHA及提取前后记录见source-manifest.json；未重新复制工程 |
| LiLiShop Manager源 | 23dfcffd4205fb893d70dcc3fa7b79843616f16b | 复用布局、主题、控件、构建和锁定体系，真实登录／Token／远程菜单初始化不带入 |
| 项目规范源 | 156f35bfcc5644f0aa11b3d61555942c6a2497f9 | 只引用适用Design System和微信规范；历史截图不冒充当前运行通过 |

本轮只修订文档，不重做P00-01／02、不安装、不升级、不再运行构建或业务页面；已执行构建、检查和失败修复按RESULT的实际日期及范围引用。来源详情及许可见[来源清单](evidence/source-manifest.json)和[第三方声明](../../../THIRD_PARTY_NOTICES.md)。

## 2. 页面、角色与业务路径

| 页面／视图 | 终端及角色 | 业务入口与去向 | 关联需求 | 关键交互／状态 | 交接分件 |
| --- | --- | --- | --- | --- | --- |
| 物业工作台、三级菜单 | Web平台／物业 | /dashboard及物业管理分组 | DGL-001／010 | 全展开，可折叠；末级选择不改开合，正常身份切换无旧遮罩 | Stage00 |
| 社区房屋档案 | Web平台／物业 | /spaces；树→三资源列表→独立表单／只读详情 | DGL-002／003／005 | 结构与资源共源；节点计数、删除保护、CSV | Stage00 |
| 房间CSV导入 | Web平台／物业 | 空间页选择上级→CSV弹窗→预览→确认 | DGL-003 | 真实解析、整批校验、超限清预览、确认重校验 | Stage00 |
| 居民档案／本人资料 | Web平台／物业、住户 | /residents；住户/pages/profile/edit | DGL-004 | 列表维护；居民详情基本信息／记录子表；本人资料不改居民ID | Stage00 |
| 房屋绑定／当前绑定 | Web及住户、物业H5只读查询 | /applications，tab=bindings；住户申请与我的房屋 | DGL-004 | 四页签、审核轮次、彩色状态；列表独立审核；重提／撤回／解除 | Stage00 |
| 房屋缺失反馈 | Web及住户 | /missing；住户地址缺失反馈 | DGL-004 | 不自动补建房屋；Web只读详情无变更记录 | Stage00 |
| 车辆档案 | Web、本人住户、物业H5查询 | /vehicles；住户申报车辆 | DGL-006 | 本人重复／冲突校验，人工核实；不生成停车权益 | Stage00 |
| 设施点位／车位 | Web及物业H5设施查询 | /facilities与/spaces三资源页签 | DGL-007／003 | 位置分列、合法楼栋／单元归属、关联房屋过滤、无启停 | Stage00 |
| 物业人员 | Web及物业H5查询 | /personnel | DGL-008 | 来自账号组织，号码完整，无新增／离岗 | Stage00 |
| 文件资料 | Web平台／物业 | /files | DGL-009 | 简单上传／编辑／预览下载，失败重试，详情只读 | Stage00 |
| 三个App主导航 | 住户、商户、物业H5 | 住户四Tab、商户四Tab、物业三Tab | DGL-010 | 名称卡片、返回与安全区；商品订单正常空态 | Stage00 |
| 既有物业服务 | 原Stage01角色与路由 | /property/*、/parking/*、/workorders/* | 继承Stage01 | 保护现有业务及范围，当前不重新实施或确认Stage01通过 | 原分件保留 |

| 角色／端 | 本阶段职责与可见范围 | 各独立业务动作及留痕 | 默认主线／同角色多账号异常 |
| --- | --- | --- | --- |
| 平台／物业Web | 当前Stage00全范围已实现管理能力 | 新增、编辑、审核、核实、导入和删除分别记录动作，不能跳过状态／引用保护 | 正常账号下拉切换；无细岗／复位工具 |
| 住户 | 本人资料、申请、人房关系、车辆及反馈 | 本人发起、撤回、补充重提，Web审核后读同一事实 | 林悦、周宁等同角色账号用于本人隔离，不因同住开放资料 |
| 物业H5 | Stage00档案只读，沿用Stage01既有工作入口 | 查询和详情，不增加移动档案审核写入 | 小区／房屋按名称和地址识别，详情不显示小区编号 |
| 商户 | 独立固定主体 | 四Tab及正常经营／订单空态 | 不混入居民档案或交易副本 |

### 2.1 页面布局与字段访问路径

| 页面／视图 | 首屏摘要及当前主操作 | 默认列表列 | 分组／一层业务页签 | 操作容器及触发条件 | 非首屏字段、历史及附件访问路径 | 条件隐藏及依据 |
| --- | --- | --- | --- | --- | --- | --- |
| 空间 | 当前节点、三资源范围数量、筛选及新增 | 房间为小区／楼栋／单元／房间号／面积／用途；资源各自编号类型位置 | 房屋空间／设施点位／车位资源 | 左树结构工具栏、右列表新增编辑、删除确认；房间无树行更多 | 结构详情从当前节点信息按钮；房屋／资源行详情；CSV独立弹窗 | 资源无社区，普通房屋无编号，小区详情无小区编号；有无单元和锁定上级按事实 |
| 居民 | 姓名和房屋关联 | 姓名／电话／账号关联情况／房屋 | 基本信息／操作与变更记录 | 列表新增编辑，详情只读 | 记录页签用HistoryPanel子表，不把原始技术字段作为产品字段 | 空值不强铺；本人资料字段在住户我的编辑 |
| 房屋绑定 | 申请人、房屋、状态，行操作审核 | 申请人／地址／申请关系类型／类型／时间／状态 | 申请记录／当前绑定；详情四页签 | 待审行审核弹窗，通过／驳回、对外原因和内部备注分开 | 绑定信息材料预览，房屋信息核对，审核记录子表 | 绑定不显示原关系，解除不填目标类型；期限仅开启时；内部备注不对住户 |
| 缺失／车辆 | 识别对象与当前状态 | 反馈地址与联系；车辆车牌及核实状态 | Web详情不增变更记录区 | 车辆列表编辑／核实；反馈查询 | 详情有值字段；物业H5保留其既有只读详情／操作记录 | 车辆Web仅十项精简详情；核实人时间反馈按状态显示 |
| 设施／人员 | 位置与类别；人员姓名、组织、号码 | 设施位置／类别／编号／数量／状态；人员四项 | 不增加审计区或启停 | 设施列表编辑；人员无维护动作 | 详情按现有记录；附件本地预览 | 单位随数量条件必填；关联房屋限定空间；人员无账号旧记录不显示 |
| 文件 | 名称、分类、组织、附件 | 名称／分类／组织／附件名／格式／大小／更新时间 | 简单只读详情 | 上传编辑、预览、下载独立动作 | 附件反馈与本地预览；普通组织／范围调整原因 | 版本、有效期、提醒、角色配置退出；不可预览格式提示下载 |
| 移动列表／详情 | 对象名称、地址、状态、下一步 | 单列卡片，不缩小Web宽表格 | 保留原主Tab和必要业务分组 | 次页有返回，正常输入错误和重试 | 住户申请／我的房屋／车辆；物业只读名称卡片 | 不显示阶段及辅助工具；资料与号码按本人或账号投影 |

### 2.2 全部现行字段到页面与实现的映射

下表逐行引用REQUIREMENTS六列表的全部212条当前字段定义（26组）；是访问与代码映射，不是第二套业务字典。不以旧287／295数量要求恢复已取消字段。具体必填、显隐和编辑条件仍以需求同行为准。

| 需求小节／字段 | 端与页面／访问路径 | 控件及可见／编辑依据 | 实现位置 | 关联验收 |
| --- | --- | --- | --- | --- |
| [ 当前人员 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 文本／只读；必填：自动带出；可见：Web顶部；编辑：正常账号切换 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 当前角色 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 文本／只读；必填：自动带出；可见：Web顶部；编辑：正常身份切换 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 所属组织 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 文本／只读；必填：自动带出；可见：身份及物业端我的；编辑：本仓不维护 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 已建档房屋数 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 整数／只读；必填：系统计算；可见：工作台；编辑：否 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 居民档案人数 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 整数／只读；必填：系统计算；可见：工作台；编辑：否 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 有效人房关系数 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 整数／只读；必填：系统计算；可见：工作台；编辑：否 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 已关联账号人数 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 整数／只读；必填：系统计算；可见：工作台；编辑：否 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 待审核申请数 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 整数／只读；必填：系统计算；可见：Web工作台；编辑：否 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 功能入口名称 ](REQUIREMENTS.md#fields-dashboard) | /dashboard | 文本／导航；必填：自动生成；可见：菜单／工作台；编辑：否 | web/manager/src/App.vue；web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T02／T17／T30 |
| [ 目录名称 ](REQUIREMENTS.md#fields-space-root) | /spaces | 文本／单行输入；必填：是；可见：左树／根名称弹窗；编辑：平台管理员 | web/manager/src/views/SpaceArchive.vue | S00-T18 |
| [ 所选空间 ](REQUIREMENTS.md#fields-space-root) | /spaces | 树／只读上下文；必填：选择；可见：树高亮／标题／面包屑／新增上下文；编辑：切换节点 | web/manager/src/views/SpaceArchive.vue | S00-T18 |
| [ 小区名称 ](REQUIREMENTS.md#fields-estates) | /spaces | 文本／单行输入；必填：是；可见：筛选、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 小区地址 ](REQUIREMENTS.md#fields-estates) | /spaces | 文本／单行输入；必填：是；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 物业管理单位 ](REQUIREMENTS.md#fields-estates) | /spaces | 关联对象／组织选择；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 资料来源 ](REQUIREMENTS.md#fields-estates) | /spaces | 枚举／系统只读；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 来源说明 ](REQUIREMENTS.md#fields-estates) | /spaces | 多行文本／文本域；必填：资料来源非人工维护时；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 维护人 ](REQUIREMENTS.md#fields-estates) | /spaces | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 更新时间 ](REQUIREMENTS.md#fields-estates) | /spaces | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 楼栋编号 ](REQUIREMENTS.md#fields-buildings) | /spaces | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 所属小区 ](REQUIREMENTS.md#fields-buildings) | /spaces | 关联对象／单选；必填：是；可见：筛选、表单、详情有值时；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 楼栋名称／楼栋号 ](REQUIREMENTS.md#fields-buildings) | /spaces | 文本／单行输入；必填：是；可见：筛选、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 是否设单元 ](REQUIREMENTS.md#fields-buildings) | /spaces | 布尔／单选；必填：是；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 资料来源 ](REQUIREMENTS.md#fields-buildings) | /spaces | 枚举／系统只读；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 来源说明 ](REQUIREMENTS.md#fields-buildings) | /spaces | 多行文本／文本域；必填：资料来源非人工维护时；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 维护人 ](REQUIREMENTS.md#fields-buildings) | /spaces | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 更新时间 ](REQUIREMENTS.md#fields-buildings) | /spaces | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 单元编号 ](REQUIREMENTS.md#fields-units) | /spaces | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 所属小区 ](REQUIREMENTS.md#fields-units) | /spaces | 关联对象／只读展示；必填：自动带出，无需填写；可见：筛选、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 所属楼栋 ](REQUIREMENTS.md#fields-units) | /spaces | 关联对象／单选；必填：是；可见：筛选、表单、详情有值时；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 单元名称／单元号 ](REQUIREMENTS.md#fields-units) | /spaces | 文本／单行输入；必填：是；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 资料来源 ](REQUIREMENTS.md#fields-units) | /spaces | 枚举／系统只读；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 来源说明 ](REQUIREMENTS.md#fields-units) | /spaces | 多行文本／文本域；必填：资料来源非人工维护时；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 维护人 ](REQUIREMENTS.md#fields-units) | /spaces | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 更新时间 ](REQUIREMENTS.md#fields-units) | /spaces | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 所属小区 ](REQUIREMENTS.md#fields-houses) | /spaces | 关联对象／级联单选；必填：是；可见：筛选、列表、表单、详情有值时；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 所属楼栋 ](REQUIREMENTS.md#fields-houses) | /spaces | 关联对象／级联单选；必填：是；可见：筛选、列表、表单、详情有值时；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 所属单元 ](REQUIREMENTS.md#fields-houses) | /spaces | 关联对象／级联单选；必填：有单元楼栋的房间必选；设施／车位可选实际单元；可见：筛选、列表、表单、详情有值时；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 楼层 ](REQUIREMENTS.md#fields-houses) | /spaces | 文本／单行输入；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 房号 ](REQUIREMENTS.md#fields-houses) | /spaces | 文本／单行输入；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 完整房屋地址 ](REQUIREMENTS.md#fields-houses) | /spaces | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 房屋用途 ](REQUIREMENTS.md#fields-houses) | /spaces | 枚举／下拉单选；必填：否；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 房屋面积 ](REQUIREMENTS.md#fields-houses) | /spaces | 小数／数字输入（㎡）；必填：否；可见：列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 关联居民 ](REQUIREMENTS.md#fields-houses) | /spaces | 关联对象集合／按权限只读列表；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 资料来源 ](REQUIREMENTS.md#fields-houses) | /spaces | 枚举／系统只读；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 来源说明 ](REQUIREMENTS.md#fields-houses) | /spaces | 多行文本／文本域；必填：资料来源非人工维护时；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 维护人 ](REQUIREMENTS.md#fields-houses) | /spaces | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 更新时间 ](REQUIREMENTS.md#fields-houses) | /spaces | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/SpaceArchive.vue；FieldEditor.vue；prototype-shared/core.js | S00-T01／T08／T14／T18／T19 |
| [ 所属小区 ](REQUIREMENTS.md#fields-resource-position) | /spaces | 关联单选／禁用回显；必填：是；可见：资源列表／表单／详情；编辑：按上下文锁定或选择 | web/manager/src/views/SpaceArchive.vue | S00-T01／T12／T14 |
| [ 关联楼栋 ](REQUIREMENTS.md#fields-resource-position) | /spaces | 关联单选／禁用回显；必填：是；可见：资源列表／表单／详情；编辑：按上下文锁定或选择 | web/manager/src/views/SpaceArchive.vue | S00-T01／T12／T14 |
| [ 所属单元 ](REQUIREMENTS.md#fields-resource-position) | /spaces | 关联单选／禁用回显；必填：否；可见：有单元或已有归属时；编辑：已知单元锁定，其余可选 | web/manager/src/views/SpaceArchive.vue | S00-T01／T12／T14 |
| [ 所属空间 ](REQUIREMENTS.md#fields-parking) | /spaces | 关联对象／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T01／T10／T14 |
| [ 车位编号 ](REQUIREMENTS.md#fields-parking) | /spaces | 文本／单行输入；必填：是；可见：筛选、列表、表单、详情有值时；编辑：仅新增可填，编辑锁定 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T01／T10／T14 |
| [ 车位类型 ](REQUIREMENTS.md#fields-parking) | /spaces | 枚举／单选；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T01／T10／T14 |
| [ 备注 ](REQUIREMENTS.md#fields-parking) | /spaces | 多行文本／文本域；必填：否；可见：列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T01／T10／T14 |
| [ 维护人 ](REQUIREMENTS.md#fields-parking) | /spaces | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T01／T10／T14 |
| [ 更新时间 ](REQUIREMENTS.md#fields-parking) | /spaces | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T01／T10／T14 |
| [ 房屋空间数量 ](REQUIREMENTS.md#fields-resource-counts) | /spaces | 整数／页签只读；必填：自动生成；可见：房屋空间页签；编辑：否 | web/manager/src/views/SpaceArchive.vue | S00-T10／T14 |
| [ 设施点位数量 ](REQUIREMENTS.md#fields-resource-counts) | /spaces | 整数／页签只读；必填：自动生成；可见：设施点位页签；编辑：否 | web/manager/src/views/SpaceArchive.vue | S00-T10／T14 |
| [ 车位资源数量 ](REQUIREMENTS.md#fields-resource-counts) | /spaces | 整数／页签只读；必填：自动生成；可见：车位资源页签；编辑：否 | web/manager/src/views/SpaceArchive.vue | S00-T10／T14 |
| [ 文件名称 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文件选择／只读名称；必填：导入前；可见：导入弹窗；编辑：选择文件 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 资料来源 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 枚举／只读；必填：自动带出；可见：导入弹窗；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 来源说明 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 多行文本；必填：是；可见：导入表单／结果；编辑：确认前 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 房屋编号 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文本／CSV可选；必填：否；可见：模板／预览；编辑：CSV | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 所属小区 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文本／CSV归属；必填：是；可见：CSV／预览；编辑：CSV | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 所属楼栋 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文本／CSV归属；必填：是；可见：CSV／预览；编辑：CSV | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 所属单元 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文本／CSV条件字段；必填：按楼栋结构；可见：CSV／预览；编辑：CSV | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 楼层 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文本／CSV字段；必填：否；可见：CSV／预览；编辑：CSV | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 房号 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文本／CSV字段；必填：是；可见：CSV／预览；编辑：CSV | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 房屋用途 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 枚举／CSV字段；必填：否；可见：CSV／预览；编辑：CSV | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 房屋面积 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 数值／CSV字段；必填：否；可见：CSV／预览；编辑：CSV | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 数据行号 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 整数／只读；必填：生成；可见：预览／错误下载；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 校验结果 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 状态／只读；必填：生成；可见：预览；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 错误原因 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文本集合／只读；必填：有错误时；可见：预览／下载；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 总行数 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 整数／只读；必填：生成；可见：预览；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 通过行数 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 整数／只读；必填：生成；可见：预览；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 不通过行数 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 整数／只读；必填：生成；可见：预览；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 导入处理状态 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 状态／只读；必填：生成；可见：结果；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 提交人 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 文本／只读；必填：确认后；可见：结果；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 提交时间 ](REQUIREMENTS.md#fields-import) | /spaces → 房间CSV导入 | 时间／只读；必填：确认后；可见：结果；编辑：否 | web/manager/src/components/ImportPanel.vue；prototype-shared/import-houses.js | S00-T08／T18／T19 |
| [ 居民编号 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 居民姓名 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 文本／单行输入；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 联系电话 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 联系方式／单行输入、脱敏展示；必填：否；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 关联账号 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 文本／账号选择或只读展示；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 账号关联情况 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 枚举／只读标签；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 关联房屋 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 关联对象集合／只读列表；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 资料来源 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 枚举／下拉单选；必填：是；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 来源说明 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 多行文本／文本域；必填：资料来源非人工维护时；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 维护人 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 更新时间 ](REQUIREMENTS.md#fields-residents) | /residents；住户／物业H5居民相关页面 | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T06／T18／T19／T20 |
| [ 头像 ](REQUIREMENTS.md#fields-profile) | /pages/profile/edit | 图片／本地附件；必填：否；可见：本人资料表单；编辑：本人 | miniapp/packages/foundation/FoundationPage.vue；prototype-shared/core.js | S00-T06／T19／T20 |
| [ 昵称 ](REQUIREMENTS.md#fields-profile) | /pages/profile/edit | 文本／输入；必填：否；可见：本人资料；编辑：本人 | miniapp/packages/foundation/FoundationPage.vue；prototype-shared/core.js | S00-T06／T19／T20 |
| [ 姓名 ](REQUIREMENTS.md#fields-profile) | /pages/profile/edit | 文本／输入；必填：已有有效关系时；可见：本人资料；编辑：本人 | miniapp/packages/foundation/FoundationPage.vue；prototype-shared/core.js | S00-T06／T19／T20 |
| [ 手机号 ](REQUIREMENTS.md#fields-profile) | /pages/profile/edit | 手机号文本／输入；必填：按办理前置；可见：本人资料；编辑：本人 | miniapp/packages/foundation/FoundationPage.vue；prototype-shared/core.js | S00-T06／T19／T20 |
| [ 操作时间 ](REQUIREMENTS.md#fields-history) | /residents → 详情 → 操作与变更记录 | 时间／只读；必填：自动生成；可见：居民记录页签；编辑：否 | web/manager/src/components/HistoryPanel.vue；prototype-shared/core.js | S00-T20 |
| [ 操作人 ](REQUIREMENTS.md#fields-history) | /residents → 详情 → 操作与变更记录 | 文本／只读；必填：自动生成；可见：记录子表；编辑：否 | web/manager/src/components/HistoryPanel.vue；prototype-shared/core.js | S00-T20 |
| [ 操作名称 ](REQUIREMENTS.md#fields-history) | /residents → 详情 → 操作与变更记录 | 文本／只读；必填：自动生成；可见：记录子表；编辑：否 | web/manager/src/components/HistoryPanel.vue；prototype-shared/core.js | S00-T20 |
| [ 变更字段 ](REQUIREMENTS.md#fields-history) | /residents → 详情 → 操作与变更记录 | 文本集合／只读；必填：有变化时；可见：记录子表；编辑：否 | web/manager/src/components/HistoryPanel.vue；prototype-shared/core.js | S00-T20 |
| [ 操作说明／原因 ](REQUIREMENTS.md#fields-history) | /residents → 详情 → 操作与变更记录 | 文本／只读；必填：按动作规则；可见：记录子表；编辑：否 | web/manager/src/components/HistoryPanel.vue；prototype-shared/core.js | S00-T20 |
| [ 操作结果 ](REQUIREMENTS.md#fields-history) | /residents → 详情 → 操作与变更记录 | 状态文本／只读；必填：自动生成；可见：记录子表；编辑：否 | web/manager/src/components/HistoryPanel.vue；prototype-shared/core.js | S00-T20 |
| [ 申请编号 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 文本／只读展示；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 申请类型 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 枚举／只读带入；必填：是；可见：筛选、列表、Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 申请人姓名 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 文本／只读带入；必填：自动带出，无需填写；可见：筛选、列表、Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 联系号码 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 联系方式／单行输入、脱敏展示；必填：是；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：新增／编辑表单可填，已提交详情只读 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 所属社区 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 关联对象／级联单选；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 所属小区 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 关联对象／级联单选；必填：是；可见：筛选、表单、Web四页签／审核子表或本人结果中的适用字段；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 所属楼栋 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 关联对象／级联单选；必填：是；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 所属单元 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 关联对象／级联单选；必填：有单元楼栋的房间必选；设施／车位可选实际单元；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 房号 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 关联对象／房屋选择；必填：是；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：新增／编辑表单可填，已提交详情只读 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 房屋地址 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 文本／只读展示；必填：自动带出，无需填写；可见：筛选、列表、Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 当前关系类型 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 枚举／只读标签；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 申请关系类型 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 枚举／下拉单选；必填：按本行规则；可见：列表、表单、Web四页签／审核子表或本人结果中的适用字段；编辑：新增／编辑表单可填，已提交详情只读 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 申请说明 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 多行文本／文本域；必填：按本行规则；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：新增／编辑表单可填，已提交详情只读 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 证明说明 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 多行文本／文本域；必填：否；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：新增／编辑表单可填，已提交详情只读 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 证明附件 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 文件集合／上传与受控预览；必填：否；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：新增／编辑表单可填，已提交详情只读 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 申请有效起始日 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 日期／日期选择；必填：按本行规则；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：新增／编辑表单可填，已提交详情只读 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 申请有效结束日 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 日期／日期选择；必填：按本行规则；可见：表单、Web四页签／审核子表或本人结果中的适用字段；编辑：新增／编辑表单可填，已提交详情只读 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 申请状态 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 枚举／状态标签；必填：自动带出，无需填写；可见：筛选、列表、Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 审核轮次 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 整数／只读展示；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 提交时间 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 日期时间／只读展示；必填：自动带出，无需填写；可见：筛选、列表、Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 审核操作 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 枚举／单选操作；必填：Web审核时必选；可见：Web审核弹窗、Web四页签／审核子表或本人结果中的适用字段；编辑：待审核时在Web审核弹窗填写，提交后只读；住户不见内部备注 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 对外审核说明 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 多行文本／文本域；必填：按本行规则；可见：Web审核弹窗、Web四页签／审核子表或本人结果中的适用字段；编辑：待审核时在Web审核弹窗填写，提交后只读；住户不见内部备注 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 内部审核备注 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 多行文本／文本域；必填：否；可见：Web审核弹窗、Web四页签／审核子表或本人结果中的适用字段；编辑：待审核时在Web审核弹窗填写，提交后只读；住户不见内部备注 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 审核人 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 文本／只读展示；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 审核时间 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 日期时间／只读展示；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 撤回时间 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 日期时间／只读展示；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 维护人 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 文本／只读展示；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 更新时间 ](REQUIREMENTS.md#fields-applications) | /applications；住户申请及申请记录 | 日期时间／只读展示；必填：自动带出，无需填写；可见：Web四页签／审核子表或本人结果中的适用字段；编辑：只读，由档案／业务动作生成 | BindingDetail.vue；Workspace.vue；FoundationPage.vue；prototype-shared/core.js | S00-T04～T07／T19／T20／T28 |
| [ 设置关系有效期 ](REQUIREMENTS.md#fields-relation-validity) | 住户绑定／变更／解除申请 | 开关／布尔；必填：否；可见：住户申请表单；编辑：提交前可切换 | miniapp/packages/foundation/FoundationPage.vue | S00-T19 |
| [ 居民姓名 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 文本／只读展示；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 房屋地址 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 文本／只读展示；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 关系类型 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 枚举／只读标签；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 关系状态 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 枚举／状态标签；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 有效起始日 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 日期／只读展示；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 有效结束日 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 日期／只读展示；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 来源申请编号 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 文本／关联入口；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 建立时间 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 失效原因 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 多行文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 失效时间 ](REQUIREMENTS.md#fields-relations) | /applications?tab=bindings；住户我的房屋 | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T04／T06／T07／T28 |
| [ 房屋编号 ](REQUIREMENTS.md#fields-binding-house) | /applications → 详情 → 房屋信息 | 文本／只读；必填：系统带出；可见：Web绑定详情房屋信息；编辑：否 | web/manager/src/components/BindingDetail.vue | S00-T14／T18 |
| [ 当前关系状态 ](REQUIREMENTS.md#fields-binding-house) | /applications → 详情 → 房屋信息 | 状态文本／只读；必填：有关联时生成；可见：Web绑定信息页签；编辑：否 | web/manager/src/components/BindingDetail.vue | S00-T14／T18 |
| [ 社区 ](REQUIREMENTS.md#fields-missing) | /missing；住户地址缺失反馈 | 关联对象／可选单选；必填：否；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T08／T19／T28 |
| [ 小区名称或地址 ](REQUIREMENTS.md#fields-missing) | /missing；住户地址缺失反馈 | 文本／单行输入；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T08／T19／T28 |
| [ 具体房屋描述 ](REQUIREMENTS.md#fields-missing) | /missing；住户地址缺失反馈 | 多行文本／文本域；必填：是；可见：列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T08／T19／T28 |
| [ 联系号码 ](REQUIREMENTS.md#fields-missing) | /missing；住户地址缺失反馈 | 联系方式／单行输入；必填：是；可见：列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T08／T19／T28 |
| [ 提交时间 ](REQUIREMENTS.md#fields-missing) | /missing；住户地址缺失反馈 | 日期时间／只读展示；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T08／T19／T28 |
| [ 车辆档案编号 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 文本／只读展示；必填：自动带出，无需填写；可见：Web十项精简详情／物业H5既有只读详情；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 车牌号码 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 文本／单行输入；必填：是；可见：筛选、列表、表单、Web十项精简详情／物业H5既有只读详情；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 车辆类型 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 枚举／下拉单选；必填：否；可见：筛选、列表、表单、Web十项精简详情／物业H5既有只读详情；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 车辆颜色 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 文本／单行输入；必填：否；可见：表单、Web十项精简详情／物业H5既有只读详情；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 关联居民 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 关联对象／只读带入或后台选择；必填：是；可见：列表、表单、Web十项精简详情／物业H5既有只读详情；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 关联房屋 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 关联对象／单选；必填：否；可见：列表、表单、Web十项精简详情／物业H5既有只读详情；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 登记说明 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 多行文本／文本域；必填：否；可见：表单、Web十项精简详情／物业H5既有只读详情；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 核实状态 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 枚举／状态标签；必填：自动带出，无需填写；可见：筛选、列表、Web十项精简详情／物业H5既有只读详情；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 核实操作 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 枚举／操作选择；必填：Web核实时填写；可见：Web核实弹窗、Web十项精简详情／物业H5既有只读详情；编辑：待核实时在Web核实弹窗填写，提交后只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 核实反馈 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 多行文本／文本域；必填：Web核实时填写；可见：Web核实弹窗、Web十项精简详情／物业H5既有只读详情；编辑：待核实时在Web核实弹窗填写，提交后只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 核实人 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 文本／只读展示；必填：自动带出，无需填写；可见：Web十项精简详情／物业H5既有只读详情；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 核实时间 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 日期时间／只读展示；必填：自动带出，无需填写；可见：Web十项精简详情／物业H5既有只读详情；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 资料来源 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 枚举／下拉单选；必填：是；可见：表单、Web十项精简详情／物业H5既有只读详情；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 来源说明 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 多行文本／文本域；必填：资料来源非人工维护时；可见：表单、Web十项精简详情／物业H5既有只读详情；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 维护人 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 文本／只读展示；必填：自动带出，无需填写；可见：Web十项精简详情／物业H5既有只读详情；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 更新时间 ](REQUIREMENTS.md#fields-vehicles) | /vehicles；住户车辆申报；物业H5车辆详情 | 日期时间／只读展示；必填：自动带出，无需填写；可见：Web十项精简详情／物业H5既有只读详情；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T19 |
| [ 所属社区 ](REQUIREMENTS.md#fields-vehicle-filters) | /vehicles → 查询条件 | 关联单选／筛选；必填：否；可见：Web车辆筛选；编辑：选择筛选值 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T18 |
| [ 所属小区 ](REQUIREMENTS.md#fields-vehicle-filters) | /vehicles → 查询条件 | 关联单选／筛选；必填：否；可见：Web车辆筛选；编辑：选择筛选值 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T11／T18 |
| [ 点位编号 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 文本／只读展示；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 所属空间 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 关联对象／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 点位名称 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 文本／单行输入；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 点位类别 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 枚举／下拉单选；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 所属小区 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 关联对象／级联单选；必填：是；可见：筛选、列表、表单、详情有值时；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 具体位置 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 文本／单行输入；必填：是；可见：列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 关联楼栋 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 关联对象／可选单选；必填：是；可见：列表、表单、详情有值时；编辑：按选中节点锁定已知上级，其余级联选择；普通空间编辑不迁移上级 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 关联房屋 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 关联对象／可选单选；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 设备或设施编号 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 文本／单行输入；必填：否；可见：筛选、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 数量 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 非负整数／数字输入；必填：否；可见：列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 数量单位 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 枚举／下拉单选；必填：填写数量时；可见：列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 厂商名称 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 文本／单行输入；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 维护单位 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 关联对象／组织选择；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 工作联系人 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 文本／单行输入；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 工作联系电话 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 联系方式／单行输入；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 点位照片 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 图片集合／上传、预览；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 接入状态 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 枚举／只读标签；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 备注 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 多行文本／文本域；必填：否；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 资料来源 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 枚举／系统只读；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 来源说明 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 多行文本／文本域；必填：资料来源非人工维护时；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 维护人 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 更新时间 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 所属单元 ](REQUIREMENTS.md#fields-facilities) | /facilities；/spaces → 设施点位 | 关联对象／级联单选；必填：有单元楼栋的房间必选；设施／车位可选实际单元；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T12／T14／T18／T19 |
| [ 人员姓名 ](REQUIREMENTS.md#fields-personnel) | /personnel；物业H5人员查询 | 文本／单行输入；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T09／T19 |
| [ 所属物业组织 ](REQUIREMENTS.md#fields-personnel) | /personnel；物业H5人员查询 | 关联对象／单选；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T09／T19 |
| [ 岗位 ](REQUIREMENTS.md#fields-personnel) | /personnel；物业H5人员查询 | 文本／单行输入；必填：自动带出，无需填写；可见：筛选、列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T09／T19 |
| [ 工作联系电话 ](REQUIREMENTS.md#fields-personnel) | /personnel；物业H5人员查询 | 联系方式／单行输入；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T09／T19 |
| [ 文件编号 ](REQUIREMENTS.md#fields-files) | /files | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 文件名称 ](REQUIREMENTS.md#fields-files) | /files | 文本／单行输入；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 文件分类 ](REQUIREMENTS.md#fields-files) | /files | 枚举／下拉单选；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 所属组织 ](REQUIREMENTS.md#fields-files) | /files | 关联对象／单选；必填：是；可见：筛选、列表、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 适用社区 ](REQUIREMENTS.md#fields-files) | /files | 关联对象／多选；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 适用小区 ](REQUIREMENTS.md#fields-files) | /files | 关联对象／多选；必填：否；可见：筛选、表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 文件附件 ](REQUIREMENTS.md#fields-files) | /files | 文件／上传控件；必填：是；可见：表单、详情有值时；编辑：新增／编辑表单可填，已提交详情只读 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 附件文件名 ](REQUIREMENTS.md#fields-files) | /files | 文本／只读展示；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 文件格式 ](REQUIREMENTS.md#fields-files) | /files | 文本／只读展示；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 文件大小 ](REQUIREMENTS.md#fields-files) | /files | 容量数值／只读展示；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 上传人 ](REQUIREMENTS.md#fields-files) | /files | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 上传时间 ](REQUIREMENTS.md#fields-files) | /files | 日期时间／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 维护人 ](REQUIREMENTS.md#fields-files) | /files | 文本／只读展示；必填：自动带出，无需填写；可见：详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 更新时间 ](REQUIREMENTS.md#fields-files) | /files | 日期时间／只读展示；必填：自动带出，无需填写；可见：列表、详情有值时；编辑：只读，由档案／业务动作生成 | web/manager/src/views/Workspace.vue；prototype-shared/core.js | S00-T13／T19／T27 |
| [ 操作原因 ](REQUIREMENTS.md#fields-file-reason) | /files → 编辑 | 多行文本／文本域；必填：组织或范围变化时；可见：Web文件编辑；编辑：保存前 | web/manager/src/views/Workspace.vue | S00-T13／T19 |
| [ 附件处理结果 ](REQUIREMENTS.md#fields-upload-feedback) | 文件编辑／住户证明及本人头像上传 | 状态文本／只读；必填：动作后生成；可见：上传控件旁或页面错误区；编辑：重选／重试触发更新 | FieldEditor.vue；MobileFields.vue；storage-h5.js；storage-uni.js | S00-T13／T19／T27 |
| [ 登录账号 ](REQUIREMENTS.md#fields-account-contract) | 复用LiLiShop；本仓正常身份及人员名录 | 文本／接入约定；必填：账号录入时；可见：正式账号功能，本仓用于身份上下文；编辑：原账号体系 | prototype-shared/r1-migration.js；r3-product.js；core.js；App.vue | S00-T02／T03／T09 |
| [ 人员姓名 ](REQUIREMENTS.md#fields-account-contract) | 复用LiLiShop；本仓正常身份及人员名录 | 文本／接入约定；必填：账号录入时；可见：正常身份／人员名录；编辑：账号体系 | prototype-shared/r1-migration.js；r3-product.js；core.js；App.vue | S00-T02／T03／T09 |
| [ 手机号 ](REQUIREMENTS.md#fields-account-contract) | 复用LiLiShop；本仓正常身份及人员名录 | 文本／手机号输入；必填：账号录入／保存；可见：账号资料及名录号码；编辑：账号体系，名录只读 | prototype-shared/r1-migration.js；r3-product.js；core.js；App.vue | S00-T02／T03／T09 |
| [ 所属组织 ](REQUIREMENTS.md#fields-account-contract) | 复用LiLiShop；本仓正常身份及人员名录 | 关联／接入约定；必填：管理账号录入时；可见：身份及人员；编辑：账号体系 | prototype-shared/r1-migration.js；r3-product.js；core.js；App.vue | S00-T02／T03／T09 |
| [ 岗位 ](REQUIREMENTS.md#fields-account-contract) | 复用LiLiShop；本仓正常身份及人员名录 | 文本／接入约定；必填：按账号资料；可见：人员名录；编辑：账号体系 | prototype-shared/r1-migration.js；r3-product.js；core.js；App.vue | S00-T02／T03／T09 |
| [ 授权角色 ](REQUIREMENTS.md#fields-account-contract) | 复用LiLiShop；本仓正常身份及人员名录 | 关联集合／接入约定；必填：账号录入时；可见：正常角色切换；编辑：账号体系 | prototype-shared/r1-migration.js；r3-product.js；core.js；App.vue | S00-T02／T03／T09 |

## 3. Mock数据与场景设计

| 业务对象／场景 | 数据来源与示例范围 | 共享标识及状态 | 可触发的动作／异常 | 重置或重放方式 |
| --- | --- | --- | --- | --- |
| 空间及资源 | 两个合理虚构小区、有／无单元、多房、旧小区直属设施及车位 | 稳定房屋和资源编号、实际归属，不从名称重建ID | 合法新增、编辑、整批CSV、重复、超限、非空／被引用删除 | 开发测试命令使用独立会话；普通页面无复位 |
| 居民与人房申请 | 本人A／B、多房多人、已驳回和有效关系 | 申请与关系、原申请、审核轮次独立 | 绑定、通过、驳回重提、撤回、变更、解除、并发重复 | Node与浏览器夹具；不清负责人原会话 |
| 车辆／文件／人员 | 他人冲突车牌、账号组织号码、当前及旧附件字节 | 原车辆、资料主题、账号编号保持 | 冲突不泄露、只读名录、非法文件重选及预览下载 | 仅开发命令，不加前台故障开关 |
| 旧数据兼容 | 由e8ad276源码生成独立旧版夹具 | 原业务号、地址快照、历史、附件字节及Stage01事实 | 升级幂等与字段显示别名 | 旧QA会话独立，不读取或替换负责人真实原会话 |

H5通过IndexedDB的当前会话保存事实和本地Blob，业务写入重读最新记录，使用对象版本、动作标识和事务保持一致。跨标签通知只触发重读，重新前台时刷新；切身份清旧投影，迟到结果不得覆盖新身份。微信别名入口隔离window、document、IndexedDB，使用本端uni存储串行写入。没有业务Mock服务、生产后端、云同步或真实接口回退。

| 外部行为 | 集中环境说明／必要业务提示及模拟结果 | 已确认公共约定 | 未确认内容及问题编号 | 真实联调责任 |
| --- | --- | --- | --- | --- |
| 真实登录与权限 | 只在文档说明模拟身份，页面正常切换 | 三角色、商户独立、物业H5只读、本人归属 | Q02／Q03 | 账号体系／研发 |
| 附件 | 只使用当前会话本地文件，错误保留输入 | 访问先校验，成功与失败按真实本地动作记录 | Q04／Q06正式策略 | 研发／资料责任方 |
| 业务通知 | 业务结果可查，通用消息服务复用但未实连 | 不恢复独立消息或假发送成功 | 实际渠道与接入契约 | 原商城通知／研发 |
| 支付、设备、停车 | 本阶段没有新增真实调用或交易副本 | 车辆／车位／设施建档不生成权益或监测事实 | 按原Stage01及其他专项确认 | 相应研发与外部提供方 |

| 演示辅助项 | 复用入口／默认收起位置 | 作用与复位范围 | 对业务状态校验的约束 |
| --- | --- | --- | --- |
| 前台复位、场景、故障、回执回放 | 已取消，不提供入口 | 无普通页面复位；独立QA仅由开发命令运行 | 不能跳过校验或清商城／负责人其它会话 |
| 正常角色切换 | Web账号下拉、住户我的正常账号切换 | 当前端身份变化；共享业务事实不重建 | 本人、本主体及状态校验仍生效 |

## 4. 执行任务与依赖

| 任务编号 | 关联需求／场景 | 具体交付物 | 前置依赖 | 执行责任 | 交接分件 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| P00-01 | 四文档基线 | 此前文档合并及用户告知ChatGPT复核依据 | 已完成文档轮 | lee／Codex | Stage00 | 历史完成，本轮不重做 |
| P00-02 | 来源与框架 | 真实来源清单、白名单SHA、许可与差异 | 实际源码核验 | Codex | Stage00 | 已有证据；本轮不改商城或重新提取 |
| P00-03A | 三端独立工程 | 三App入口、pages、manifest、独立产物 | P00-02 | Codex | Stage00 | H5原型已验收；当前微信补验暂缓 |
| P00-03B | 主题、组件、导航 | 复用主题、组件、正常Tab、返回及状态反馈 | P00-03A | Codex | Stage00 | 现行Web／H5已验收 |
| P00-03C | Manager兼容Web | 三级菜单、正常身份、布局与路由 | 来源／依赖隔离 | Codex | Stage00 | 现行范围已验收 |
| P00-03D | 共享Mock | 同源四端业务事实、分端身份、绑定最小闭环 | 四端入口 | Codex | Stage00 | 已验收；原前台辅助退出不记实现 |
| P00-04 | 空间、居民、绑定、导入、数量 | 按最新范围完成已保留功能 | P00-03D | Codex | Stage00 | 已验收；组织通用菜单复用、独立统计取消另记 |
| P00-05 | 车辆、设施、人员、文件、结果 | 当前车辆核实、资源归属、只读人员和简单文件 | 基础事实 | Codex | Stage00 | 现行范围已验收；版本／离岗／权限／消息菜单不计实现 |
| P00-06 | 自测与人工验收 | 分项技术结果、失败修复、负责人当前范围确认 | 已实施原型 | Codex／lee | Stage00 | Web／H5原型人工验收通过；微信和真机暂缓 |
| P00-07 | 交接与版本 | 当前四文档、运行、来源、字段映射、证据及已授权本地合并 | 负责人通过且文档收口 | lee／Codex／接收研发 | Stage00 | 资料整理完成；Git以实际回执为准，研发尚无接收反馈 |

## 5. 验证安排

| 验证目的 | 操作或检查方法 | 关联验收场景 | 预期观察结果 | 执行状态 |
| --- | --- | --- | --- | --- |
| 当前业务主链 | 住户提交→Web审核→住户看结果→物业查询 | T04～T07／T28 | 同源事实与独立身份一致 | 已有实际PASS证据及负责人确认 |
| 重要异常 | 整批CSV错误／重复／超限重选、删除取消／引用拒绝、车辆冲突、文件失败重试 | T08／T11／T13／T14／T19 | 错误不写成功，保留输入和原关系 | 对应Node／浏览器记录，不宣称每组合都逐项人工执行 |
| 正常角色与范围 | 默认平台／物业权限，本人／商户隔离、物业只读 | T02／T03／T06／T17 | 简化前台授权演示不取消业务归属 | 现行保留部分已验证，退出部分不计PASS |
| 当前字段与模板 | 本版六列、逐字段访问映射、四文档顺序／表头／链接／历史SHA | T18／T31 | 定义与实际当前控件及访问路径一致 | 本轮执行文档静态检查，不重跑业务构建 |
| 构建及类型 | 初次七构建三类型；R3多批；末轮仅Web、staff H5、staff类型 | T21／T23～T26 | 按批次来源引用，不混成当前十项全重跑 | 实际结果见RESULT，旧原生结果只作历史 |
| 菜单与名称详情 | 默认全展开、手动折叠保留、末级切页、小区详情隐藏编号 | T02／T18／T30 | 开合不自动重设；内部编号和关联保留 | 4项定向检查PASS，负责人后续已全部确认 |
| 界面与视觉 | Web1366／1920宽、H5 390／414宽截图，四状态边框及文字对比度 | T17／T30 | 保留当前主题及正常产品语言 | 实际截图／浏览器证据，非当前源商城全页面视觉实跑 |
| 微信开发者工具／真机 | 当前负责人决定暂缓 | T25／T29 | 不拿H5和构建代替真实端检查 | NOT_RUN，不列成本次Web／H5验收阻塞 |

## 6. 集中评审与实施约束

当前需求和原型范围由负责人逐轮确认，最终本会话明确已全部验证。本轮只将现行规则归位，不修改业务实现，不重新设计需求，不触碰商城或Stage01／02四文档。四文档修订后做模板、字段、状态、范围和链接核对；普通文档修订不重复无关构建和页面检查。

负责人已授权将Stage00成果本地并入main；先保存当前分支有效源码、文档及证据，检查main祖先关系，正常保留历史合并，不强制reset／清理，不自动推送。源分支已继承Stage01代码及Stage02准备文档，合并保留既有内容，不改变它们的验收状态；独立Stage02 worktree不操作。

## 7. 验收与交接准备

| 交付项 | 计划内容 | 当前状态 |
| --- | --- | --- |
| 可操作原型、角色入口与演示场景 | 19201四端正常页面、角色和业务事实 | 负责人当前Web／H5范围已确认 |
| 四份阶段文档及需求对应关系 | 本版正文与实际菜单／字段／状态／流程归并 | 文档收口；历史原字节和旧编号保全 |
| lee人工验收与修正记录 | 原批注、复验表、末轮两点及最终确认 | 已取得用户确认，不虚构逐步签字或微信结果 |
| 固定版本及已知问题 | 验收提交及main指针按真实Git回执记录 | 本地合并获准；推送未授权 |
| 研发交接范围与Mock边界 | 迁移页面、需语义合并公共文件、生产排除项 | 资料准备；研发接收与生产未取得证据 |

## 8. 计划调整记录

| 日期 | 原计划与调整 | 原因及依据 | 影响需求／交接分件 | 需同步的验收与原型 |
| --- | --- | --- | --- | --- |
| 2026-11-04 | 从文档准备进入完整框架与基础业务实施 | 用户批准集中实施计划 | P00-02～07 | 原型、四文档及七构建证据 |
| 2026-11-05～07 | R1统一空间；R2宽树、三资源、平台权限及行操作 | 负责人验收反馈 | DGL-002～010 | 保留原失败与复测，不改历史结论 |
| 2026-11-09 | R3前台无辅助、通用菜单退出、绑定合并、人员和文件简化 | 最新原则及批注结果／问题 | 现行Stage00范围 | 原型已实现并归入当前REQ／ACCEPTANCE |
| 2026-11-09 | 独立统计退出→节点三资源数量；默认菜单全部展开；小区详情隐藏编号 | 负责人复验及补充两点 | W02／03／05／09／10、S02、W01／16 | 已实施与定向验证，当前正文不保留相反标准 |
| 2026-11-09 | 当前原型验收通过后修订四文档并准备main本地合并 | 两次已全部验证及合并前修订文档的指令 | Stage00验收资料与版本 | 实际Git版本见回执，不扩大为生产或其他Stage通过 |

### 历史链接兼容

以下旧链接仅承接历史引用，原文在[PLAN修订前完整快照](evidence/pre-main-20261109/PLAN.txt)；当前规则以本文正文为准，不从历史恢复取消要求。

<a id="stage00公共基础与协作约定前端执行计划"></a>
<a id="1-阶段目标依据与执行边界"></a>
<a id="11-stage00的两项交付"></a>
<a id="12-依据与优先关系"></a>
<a id="13-初次文档轮与后续实施轮历史"></a>
<a id="2-范围与已确认框架决定"></a>
<a id="21-包含与排除"></a>
<a id="22-整体框架的深度"></a>
<a id="23-已审需求的最小文字同步"></a>
<a id="3-源工程核验与复用基线"></a>
<a id="31-v03编制时已读证据与未核验范围"></a>
<a id="32-本地codex实施前只读检查"></a>
<a id="33-复用白名单及禁止项"></a>
<a id="4-目标目录与技术隔离"></a>
<a id="5-小程序整体框架专项"></a>
<a id="51-框架交付矩阵"></a>
<a id="52-公共组件核验与最小适配"></a>
<a id="53-住户端页面及入口"></a>
<a id="54-商户端框架"></a>
<a id="55-管理端框架"></a>
<a id="56-框架一致性对照"></a>
<a id="6-web页面实施范围"></a>
<a id="7-产品字段与控件映射"></a>
<a id="8-mock与跨端演示"></a>
<a id="81-共用业务事实"></a>
<a id="82-h5联动同源静态预览"></a>
<a id="83-微信端本端模拟单独验证"></a>
<a id="84-数据与异常"></a>
<a id="9-实施任务与顺序"></a>
<a id="10-验证及退出标准"></a>
<a id="11-后续扩展和正式研发交接"></a>
<a id="12-来源索引和修订记录"></a>
<a id="13-人工验收整改r1增量2026-11-05"></a>
<a id="131-字段访问路径"></a>
<a id="132-迁移与研发接收"></a>
<a id="133-验证与停止点"></a>
<a id="14-r2定向实施任务2026-11-06"></a>
<a id="15-r2人工反馈补充实施2026-11-06"></a>
<a id="16-r3本轮执行与验证2026-11-09"></a>
<a id="17-r3复验反馈实施与验证2026-11-09"></a>
