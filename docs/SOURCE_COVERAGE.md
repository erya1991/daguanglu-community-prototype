# 建设方案覆盖关系与历史差异

> 版本：V0.1｜2026-11-04。该文件记录“每项需求去哪里”，不记录完成率。

## 1. 来源与统计范围

S0为用户在本次会话提供的《大光路片区智慧社区综合管理与运营平台建设方案》。下表保留第3章四端功能表的逐行对应，模块名与功能明细用于定位，功能说明为整理摘要，不是原文全文归档。完整原文以用户原始消息或后续正式原稿为准。

第3章共117行：住户27、管理端19、商户19、Web52。第1、2、4、5章另列12项平台约束、节点及前置条件，不与117条功能相加称为功能总数。合并后的需求包共64个，同一需求包可能对应多个终端功能行。

待确认项也建立映射，不能据此视为范围已冻结。来源覆盖、需求确认、原型实现、研发生产实现分别维护。阶段、需求状态和实际确认记录分别见[阶段计划](STAGES.md)、[范围台账](SCOPE_REGISTER.md)与[问题台账](OPEN_QUESTIONS.md)。归档来源见[sources/README.md](sources/README.md)。

## 3.1 住户小程序（27行）

| 来源行 | 模块 | 功能明细 | 说明摘要 | 对应需求包 | 归属处理 |
| --- | --- | --- | --- | --- | --- |
| C-R01 | 首页与社区信息 | 业务入口、公告及推荐 | 缴费报修商城服务活动随手拍入口、社区公告和服务推荐 | [DGL-010](SCOPE_REGISTER.md#dgl-010) [DGL-047](SCOPE_REGISTER.md#dgl-047) | 本次剩余范围 |
| C-R02 | 账号与个人资料 | 微信登录、手机号及个人资料 | 登录、手机号绑定、本人资料及稳定账号业务关联 | [EXT-M01](SCOPE_REGISTER.md#ext-m01) [DGL-001](SCOPE_REGISTER.md#dgl-001) [DGL-004](SCOPE_REGISTER.md#dgl-004) | 跨项目共用 |
| C-R03 | 房屋与车辆 | 房屋绑定、关系确认 | 绑定申请、审核结果、本人关联房屋及授权查询 | [DGL-004](SCOPE_REGISTER.md#dgl-004) | 本次剩余范围 |
| C-R04 | 房屋与车辆 | 车辆登记、车辆关系 | 车牌资料、本人及停车关系 | [DGL-006](SCOPE_REGISTER.md#dgl-006) [DGL-015](SCOPE_REGISTER.md#dgl-015) | 本次剩余范围 |
| C-R05 | 物业缴费 | 账单查询、欠费提醒 | 本人房屋账期、金额、状态和提醒 | [DGL-012](SCOPE_REGISTER.md#dgl-012) [DGL-014](SCOPE_REGISTER.md#dgl-014) | 本次剩余范围 |
| C-R06 | 物业缴费 | 在线缴费、缴费记录 | 支付结果、记录、凭证、已启用积分抵扣明细 | [DGL-013](SCOPE_REGISTER.md#dgl-013) [DGL-038](SCOPE_REGISTER.md#dgl-038) | 本次剩余范围 |
| C-R07 | 物业报事报修 | 报修提交、图片说明 | 事项类型位置描述照片，形成报修及工单 | [DGL-023](SCOPE_REGISTER.md#dgl-023) [DGL-019](SCOPE_REGISTER.md#dgl-019) | 本次剩余范围 |
| C-R08 | 物业报事报修 | 进度查询、结果确认与评价 | 受理分派处置完成、反馈确认与评价 | [DGL-023](SCOPE_REGISTER.md#dgl-023) [DGL-021](SCOPE_REGISTER.md#dgl-021) [DGL-022](SCOPE_REGISTER.md#dgl-022) | 本次剩余范围 |
| C-R09 | 社区团购商城 | 商品分类、搜索及详情 | 规格价格库存商户与履约方式 | [EXT-M03](SCOPE_REGISTER.md#ext-m03) [EXT-M04](SCOPE_REGISTER.md#ext-m04) | 商城原项目 |
| C-R10 | 社区团购商城 | 购物车、收货地址及下单 | 按商户商品履约确认、多商户统一结算及商户订单 | [EXT-M04](SCOPE_REGISTER.md#ext-m04) | 商城原项目 |
| C-R11 | 社区团购商城 | 在线支付、支付结果 | 微信支付、结果、失败重试、取消和超时关闭 | [EXT-M04](SCOPE_REGISTER.md#ext-m04) [EXT-M07](SCOPE_REGISTER.md#ext-m07) | 商城原项目 |
| C-R12 | 社区团购商城 | 订单查询、配送与核销 | 商户配送普通物流自提到店核销、收货或凭证 | [EXT-M05](SCOPE_REGISTER.md#ext-m05) | 商城原项目 |
| C-R13 | 社区团购商城 | 售后、退款及商品评价 | 退款退货、处理和退款结果、商品评价 | [EXT-M06](SCOPE_REGISTER.md#ext-m06) [EXT-M07](SCOPE_REGISTER.md#ext-m07) | 商城原项目 |
| C-R14 | 社区便民服务 | 服务查询、时段选择及预约 | 项目价格范围时段、地址需求与预约 | [DGL-027](SCOPE_REGISTER.md#dgl-027) [DGL-028](SCOPE_REGISTER.md#dgl-028) [DGL-029](SCOPE_REGISTER.md#dgl-029) | 本次剩余范围 |
| C-R15 | 社区便民服务 | 支付、执行进度及售后 | 收费支付、接单到场开始完成、取消退款确认评价 | [DGL-029](SCOPE_REGISTER.md#dgl-029) [DGL-030](SCOPE_REGISTER.md#dgl-030) [DGL-031](SCOPE_REGISTER.md#dgl-031) | 本次剩余范围 |
| C-R16 | 居民共享 | 闲置发布、意向申请及交付 | 发布编辑下架审核、意向领取交换及线下交付 | [EXT-C01](SCOPE_REGISTER.md#ext-c01) | 同事负责 |
| C-R17 | 邻里互助 | 需求、技能发布及预约认领 | 低风险互助技能、撮合预约认领、完成评价 | [EXT-C02](SCOPE_REGISTER.md#ext-c02) | 同事负责 |
| C-R18 | 居民共享与邻里互助 | 举报、争议反馈 | 举报证据、本人事项处理结果 | [EXT-C03](SCOPE_REGISTER.md#ext-c03) | 同事负责 |
| C-R19 | 停车服务 | 月卡办理、续费及临停查询 | 对接费用、月卡及临停金额和业务状态 | [DGL-015](SCOPE_REGISTER.md#dgl-015) [DGL-016](SCOPE_REGISTER.md#dgl-016) | 本次剩余范围 |
| C-R20 | 停车服务 | 在线缴费、授权支付及记录 | 支付记录，无感在系统支付渠道具备条件后按授权接入 | [DGL-015](SCOPE_REGISTER.md#dgl-015) [DGL-017](SCOPE_REGISTER.md#dgl-017) [DGL-018](SCOPE_REGISTER.md#dgl-018) | 本次剩余范围 |
| C-R21 | 社区活动 | 活动查询、报名及支付 | 活动对象场次名额、报名及收费支付 | [DGL-033](SCOPE_REGISTER.md#dgl-033) [DGL-034](SCOPE_REGISTER.md#dgl-034) | 本次剩余范围 |
| C-R22 | 社区活动 | 签到、参与记录及评价 | 签到凭证现场核验、参与记录和评价 | [DGL-035](SCOPE_REGISTER.md#dgl-035) | 本次剩余范围 |
| C-R23 | 智慧党建 | 待社区确认 | 待社区确认 | [DGL-041](SCOPE_REGISTER.md#dgl-041) | 本次剩余范围 |
| C-R24 | 安全隐患随手拍 | 拍照上报、位置及问题描述 | 照片社区小区位置、事件登记核实整改 | [DGL-024](SCOPE_REGISTER.md#dgl-024) [DGL-019](SCOPE_REGISTER.md#dgl-019) | 本次剩余范围 |
| C-R25 | 安全隐患随手拍 | 办理进度、整改反馈 | 受理整改复核销号、对外反馈，内部敏感资料隔离 | [DGL-025](SCOPE_REGISTER.md#dgl-025) | 本次剩余范围 |
| C-R26 | 积分 | 积分余额、规则及明细 | 余额规则流水、已启用消费活动激励 | [DGL-036](SCOPE_REGISTER.md#dgl-036) [DGL-037](SCOPE_REGISTER.md#dgl-037) [DGL-038](SCOPE_REGISTER.md#dgl-038) | 本次剩余范围 |
| C-R27 | 个人中心与消息 | 业务记录、通知及详情跳转 | 汇总本人房屋车辆缴费订单服务活动共享隐患与消息 | [DGL-048](SCOPE_REGISTER.md#dgl-048) [DGL-049](SCOPE_REGISTER.md#dgl-049) [EXT-M08](SCOPE_REGISTER.md#ext-m08) [EXT-C01](SCOPE_REGISTER.md#ext-c01) [EXT-C02](SCOPE_REGISTER.md#ext-c02) | 跨项目共用 |


## 3.2 管理端小程序（19行）

| 来源行 | 模块 | 功能明细 | 说明摘要 | 对应需求包 | 归属处理 |
| --- | --- | --- | --- | --- | --- |
| C-G01 | 移动工作台 | 角色工作台、待办及提醒 | 按岗位辖区展示工单预警巡查活动待办 | [DGL-010](SCOPE_REGISTER.md#dgl-010) [DGL-048](SCOPE_REGISTER.md#dgl-048) [DGL-050](SCOPE_REGISTER.md#dgl-050) | 本次剩余范围 |
| C-G02 | 移动工作台 | 身份授权、工作范围 | 角色功能、社区小区网格任务数据范围 | [DGL-001](SCOPE_REGISTER.md#dgl-001) | 本次剩余范围 |
| C-G03 | 社区与小区信息 | 基本信息、人口及设施查询 | 小区楼栋户数人口更新时间及设备点位 | [DGL-002](SCOPE_REGISTER.md#dgl-002) [DGL-003](SCOPE_REGISTER.md#dgl-003) [DGL-005](SCOPE_REGISTER.md#dgl-005) [DGL-007](SCOPE_REGISTER.md#dgl-007) | 本次剩余范围 |
| C-G04 | 居民与房屋查询 | 居民、房屋及必要缴费信息 | 职责范围内居民房屋和必要缴费信息 | [DGL-003](SCOPE_REGISTER.md#dgl-003) [DGL-004](SCOPE_REGISTER.md#dgl-004) [DGL-014](SCOPE_REGISTER.md#dgl-014) | 本次剩余范围 |
| C-G05 | 物业人员名录 | 人员名录、岗位及责任联系 | 岗位管理区在岗状态和工作联系方式 | [DGL-008](SCOPE_REGISTER.md#dgl-008) | 本次剩余范围 |
| C-G06 | 社区网格 | 网格范围、责任人及事项 | 本人网格、小区楼栋关联和责任人员 | [DGL-039](SCOPE_REGISTER.md#dgl-039) | 本次剩余范围 |
| C-G07 | 安全隐患随手拍 | 现场拍照、定位及上报 | 隐患照片类别位置、待核实事件或已有事件证据 | [DGL-024](SCOPE_REGISTER.md#dgl-024) | 本次剩余范围 |
| C-G08 | 统一事件工单 | 事件核实、分类及责任确认 | 报修随手拍巡查告警核实、级别责任、误报重复 | [DGL-019](SCOPE_REGISTER.md#dgl-019) | 本次剩余范围 |
| C-G09 | 统一事件工单 | 派单、接单及转办 | 责任单位人员、时限、接单协作转办记录 | [DGL-020](SCOPE_REGISTER.md#dgl-020) | 本次剩余范围 |
| C-G10 | 统一事件工单 | 现场处理、整改记录及提交复核 | 前后照片、说明完成时间与提交复核 | [DGL-021](SCOPE_REGISTER.md#dgl-021) | 本次剩余范围 |
| C-G11 | 统一事件工单 | 复核验收、退回整改及销号 | 结果检查、关闭或说明退回 | [DGL-021](SCOPE_REGISTER.md#dgl-021) | 本次剩余范围 |
| C-G12 | 统一事件工单 | 超期提醒、记录查询 | 临期超期退回、全过程责任结果 | [DGL-022](SCOPE_REGISTER.md#dgl-022) | 本次剩余范围 |
| C-G13 | 车棚监控与预警 | 待确认具体需求 | 待确认具体需求 | [DGL-042](SCOPE_REGISTER.md#dgl-042) | 本次剩余范围 |
| C-G14 | 充电安全监测 | 待确认具体需求 | 待确认具体需求 | [DGL-043](SCOPE_REGISTER.md#dgl-043) | 本次剩余范围 |
| C-G15 | 消防安全监管 | 待确认具体需求 | 待确认具体需求 | [DGL-044](SCOPE_REGISTER.md#dgl-044) | 本次剩余范围 |
| C-G16 | 智慧党建 | 待确认具体需求 | 待确认具体需求 | [DGL-041](SCOPE_REGISTER.md#dgl-041) | 本次剩余范围 |
| C-G17 | 社区活动执行 | 名单查询、签到及现场核验 | 名单扫码签到、异常和执行记录 | [DGL-035](SCOPE_REGISTER.md#dgl-035) | 本次剩余范围 |
| C-G18 | 收费业务查询 | 物业及停车缴费记录 | 收费岗位辖区账单欠费结果，其他角色授权摘要 | [DGL-014](SCOPE_REGISTER.md#dgl-014) [DGL-015](SCOPE_REGISTER.md#dgl-015) [DGL-017](SCOPE_REGISTER.md#dgl-017) | 本次剩余范围 |
| C-G19 | 消息与个人中心 | 任务通知、个人信息及办理记录 | 工单告警巡查活动消息、个人信息与本人任务和办理记录 | [DGL-048](SCOPE_REGISTER.md#dgl-048) [DGL-049](SCOPE_REGISTER.md#dgl-049) | 本次剩余范围 |


## 3.3 商户小程序（19行）

| 来源行 | 模块 | 功能明细 | 说明摘要 | 对应需求包 | 归属处理 |
| --- | --- | --- | --- | --- | --- |
| C-M01 | 账号与工作人员 | 商户登录、人员授权 | 负责人工作人员、岗位启停权限与本商户数据 | [EXT-M01](SCOPE_REGISTER.md#ext-m01) [DGL-026](SCOPE_REGISTER.md#dgl-026) | 跨项目共用 |
| C-M02 | 商户入驻与合作 | 入驻申请、资质提交及审核查询 | 主体联系人门店资质、草稿驳回再提交 | [EXT-M02](SCOPE_REGISTER.md#ext-m02) [DGL-026](SCOPE_REGISTER.md#dgl-026) | 跨项目共用 |
| C-M03 | 商户入驻与合作 | 协议、经营资格及合作状态 | 协议有效期经营范围、交易条件原因 | [EXT-M02](SCOPE_REGISTER.md#ext-m02) [DGL-026](SCOPE_REGISTER.md#dgl-026) | 跨项目共用 |
| C-M04 | 店铺与履约点位 | 店铺资料、自提点及核销点 | 营业联系方式地址、自提核销点位履约方式 | [EXT-M02](SCOPE_REGISTER.md#ext-m02) | 商城原项目 |
| C-M05 | 商品管理 | 商品资料、分类及图片详情 | 商品资料图片履约、草稿或审核 | [EXT-M03](SCOPE_REGISTER.md#ext-m03) | 商城原项目 |
| C-M06 | 商品管理 | 规格、价格及库存 | 规格价格库存与可售状态 | [EXT-M03](SCOPE_REGISTER.md#ext-m03) | 商城原项目 |
| C-M07 | 商品管理 | 审核、上下架及监管反馈 | 审核驳回、上下架及监管限制 | [EXT-M03](SCOPE_REGISTER.md#ext-m03) | 商城原项目 |
| C-M08 | 服务管理 | 服务项目、价格及范围 | 内容规格收费范围、审核上下架 | [DGL-027](SCOPE_REGISTER.md#dgl-027) | 本次剩余范围 |
| C-M09 | 服务管理 | 预约时段、容量及接单 | 日期时段容量、预约及授权接单 | [DGL-028](SCOPE_REGISTER.md#dgl-028) [DGL-030](SCOPE_REGISTER.md#dgl-030) | 本次剩余范围 |
| C-M10 | 订单与履约 | 订单列表、详情及待办 | 商品与服务、支付履约、备货配送核销事项 | [EXT-M05](SCOPE_REGISTER.md#ext-m05) [DGL-029](SCOPE_REGISTER.md#dgl-029) [DGL-030](SCOPE_REGISTER.md#dgl-030) | 跨项目共用 |
| C-M11 | 订单与履约 | 商户配送、普通物流发货 | 备货配送送达、物流公司单号和居民进度 | [EXT-M05](SCOPE_REGISTER.md#ext-m05) | 商城原项目 |
| C-M12 | 订单与履约 | 社区自提、到店核销 | 扫码输码、订单点位核对、人员时间结果 | [EXT-M05](SCOPE_REGISTER.md#ext-m05) | 商城原项目 |
| C-M13 | 订单与履约 | 服务接单、到场、开始及完成 | 履约节点说明和结果 | [DGL-030](SCOPE_REGISTER.md#dgl-030) | 本次剩余范围 |
| C-M14 | 售后管理 | 退款、退货审核及处理 | 申请审核、退货地址收货结果与退款进度 | [EXT-M06](SCOPE_REGISTER.md#ext-m06) [DGL-031](SCOPE_REGISTER.md#dgl-031) | 跨项目共用 |
| C-M15 | 售后管理 | 异常订单、争议及协同反馈 | 异常争议说明证据、平台协同及留痕 | [EXT-M06](SCOPE_REGISTER.md#ext-m06) [DGL-031](SCOPE_REGISTER.md#dgl-031) | 跨项目共用 |
| C-M16 | 评价管理 | 商品及服务评价查询 | 商品服务反馈和质量 | [EXT-M06](SCOPE_REGISTER.md#ext-m06) [DGL-031](SCOPE_REGISTER.md#dgl-031) | 跨项目共用 |
| C-M17 | 经营信息 | 订单、收入及经营统计 | 订单成交履约售后服务经营 | [EXT-M08](SCOPE_REGISTER.md#ext-m08) [DGL-032](SCOPE_REGISTER.md#dgl-032) [DGL-050](SCOPE_REGISTER.md#dgl-050) | 跨项目共用 |
| C-M18 | 经营信息 | 结算、分账、退款及资金明细 | 资金结果应结实结异常、具体订单关联 | [EXT-M07](SCOPE_REGISTER.md#ext-m07) [DGL-032](SCOPE_REGISTER.md#dgl-032) | 跨项目共用 |
| C-M19 | 消息与工作台 | 审核、订单、售后及资金通知 | 入驻商品订单售后资金消息和详情 | [EXT-M08](SCOPE_REGISTER.md#ext-m08) [DGL-048](SCOPE_REGISTER.md#dgl-048) | 跨项目共用 |


## 3.4 Web管理后台（52行）

| 来源行 | 模块 | 功能明细 | 说明摘要 | 对应需求包 | 归属处理 |
| --- | --- | --- | --- | --- | --- |
| C-W01 | 综合工作台 | 业务概况、待办及安全态势 | 授权范围基础经营告警工单及重点事项 | [DGL-050](SCOPE_REGISTER.md#dgl-050) | 本次剩余范围 |
| C-W02 | 社区与小区档案 | 社区、小区及管理范围 | 名称地址单位责任范围、楼栋房屋网格设施 | [DGL-002](SCOPE_REGISTER.md#dgl-002) [DGL-003](SCOPE_REGISTER.md#dgl-003) [DGL-039](SCOPE_REGISTER.md#dgl-039) | 本次剩余范围 |
| C-W03 | 社区与小区档案 | 人口、户数及统计来源 | 口径数据来源更新时间维护责任 | [DGL-005](SCOPE_REGISTER.md#dgl-005) | 本次剩余范围 |
| C-W04 | 社区与小区档案 | 楼栋、单元、房屋及人房关系 | 房屋居民、绑定申请关系及调整记录 | [DGL-003](SCOPE_REGISTER.md#dgl-003) [DGL-004](SCOPE_REGISTER.md#dgl-004) | 本次剩余范围 |
| C-W05 | 社区与小区档案 | 车辆、停车关系及基础资料 | 车辆居民停车资源关联、费用和停车 | [DGL-006](SCOPE_REGISTER.md#dgl-006) [DGL-015](SCOPE_REGISTER.md#dgl-015) | 本次剩余范围 |
| C-W06 | 设施点位档案 | 监控、车棚、充电及消防点位 | 位置类型数量编号供应商责任接入状态、分类统计 | [DGL-007](SCOPE_REGISTER.md#dgl-007) | 本次剩余范围 |
| C-W07 | 组织与权限 | 组织、账号、岗位及角色 | 社区物业运营服务组织、账号角色菜单操作 | [DGL-001](SCOPE_REGISTER.md#dgl-001) | 本次剩余范围 |
| C-W08 | 组织与权限 | 辖区数据权限、敏感信息权限 | 社区小区网格归属，视频党务居民财务独立授权 | [DGL-001](SCOPE_REGISTER.md#dgl-001) | 本次剩余范围 |
| C-W09 | 物业人员与文件 | 物业企业、岗位及人员档案 | 组织人员联系方式职责责任区在岗 | [DGL-008](SCOPE_REGISTER.md#dgl-008) | 本次剩余范围 |
| C-W10 | 物业人员与文件 | 文件分类、上传、版本及检索 | 制度图纸合同资质巡检整改报告、检索版本预览 | [DGL-009](SCOPE_REGISTER.md#dgl-009) | 本次剩余范围 |
| C-W11 | 物业人员与文件 | 文件权限、下载及有效期提醒 | 查阅下载范围、到期提醒和操作记录 | [DGL-009](SCOPE_REGISTER.md#dgl-009) | 本次剩余范围 |
| C-W12 | 社区网格管理 | 网格划分、辖区关联及责任人 | 网格责任人、小区楼栋关联和物业区协作 | [DGL-039](SCOPE_REGISTER.md#dgl-039) | 本次剩余范围 |
| C-W13 | 社区网格管理 | 需求待明确 | 扩展需求待明确 | [DGL-040](SCOPE_REGISTER.md#dgl-040) | 本次剩余范围 |
| C-W14 | 智慧党建 | 需求待明确 | 需求待明确 | [DGL-041](SCOPE_REGISTER.md#dgl-041) | 本次剩余范围 |
| C-W15 | 车棚监控与预警 | 需求待明确 | 需求待明确 | [DGL-042](SCOPE_REGISTER.md#dgl-042) | 本次剩余范围 |
| C-W16 | 充电桩安全监测 | 需求待明确 | 需求待明确 | [DGL-043](SCOPE_REGISTER.md#dgl-043) | 本次剩余范围 |
| C-W17 | 消防安全监管 | 需求待明确 | 需求待明确 | [DGL-044](SCOPE_REGISTER.md#dgl-044) | 本次剩余范围 |
| C-W18 | 安全隐患管理 | 随手拍、巡查上报及隐患核实 | 图片地点类别来源、风险与责任 | [DGL-024](SCOPE_REGISTER.md#dgl-024) [DGL-019](SCOPE_REGISTER.md#dgl-019) | 本次剩余范围 |
| C-W19 | 安全隐患管理 | 整改要求、期限及闭环台账 | 整改措施期限、前后证据复核与未闭环 | [DGL-025](SCOPE_REGISTER.md#dgl-025) | 本次剩余范围 |
| C-W20 | 统一事件工单 | 多源接收、自动登记及去重 | 报修随手拍网格视频充电消防来源编号证据、避免重复转单 | [DGL-019](SCOPE_REGISTER.md#dgl-019) | 本次剩余范围 |
| C-W21 | 统一事件工单 | 分类分级、规则分派及人工派单 | 按事项位置责任规则，核实或满足预设条件转任务 | [DGL-019](SCOPE_REGISTER.md#dgl-019) [DGL-020](SCOPE_REGISTER.md#dgl-020) | 本次剩余范围 |
| C-W22 | 统一事件工单 | 接单、协同、转办及过程记录 | 责任主体、协作转办整改，各端同一过程 | [DGL-020](SCOPE_REGISTER.md#dgl-020) | 本次剩余范围 |
| C-W23 | 统一事件工单 | 复核验收、退回、关闭及销号 | 复核退回合格销号、误报撤销有依据 | [DGL-021](SCOPE_REGISTER.md#dgl-021) | 本次剩余范围 |
| C-W24 | 统一事件工单 | 时限督办、消息及统计 | 时限升级通知、待办超期闭环轨迹 | [DGL-022](SCOPE_REGISTER.md#dgl-022) | 本次剩余范围 |
| C-W25 | 商户与合作管理 | 商户准入、资质及门店 | 主体门店人员经营状态和审核 | [EXT-M02](SCOPE_REGISTER.md#ext-m02) [DGL-026](SCOPE_REGISTER.md#dgl-026) | 跨项目共用 |
| C-W26 | 商户与合作管理 | 合作协议、经营范围及资格 | 协议版本期限经营授权、资格与结算规则 | [EXT-M02](SCOPE_REGISTER.md#ext-m02) [DGL-026](SCOPE_REGISTER.md#dgl-026) | 跨项目共用 |
| C-W27 | 商品与服务运营 | 分类、商品规格及服务项目 | 商品和服务类目、规格库存范围时段容量 | [EXT-M03](SCOPE_REGISTER.md#ext-m03) [DGL-027](SCOPE_REGISTER.md#dgl-027) [DGL-028](SCOPE_REGISTER.md#dgl-028) | 跨项目共用 |
| C-W28 | 商品与服务运营 | 发布审核、上下架及推荐 | 审核驳回下架、首页分类推荐 | [EXT-M03](SCOPE_REGISTER.md#ext-m03) [DGL-027](SCOPE_REGISTER.md#dgl-027) [DGL-047](SCOPE_REGISTER.md#dgl-047) | 跨项目共用 |
| C-W29 | 订单与履约管理 | 商城订单、服务预约及履约监管 | 商品服务订单、配送核销执行与异常记录 | [EXT-M05](SCOPE_REGISTER.md#ext-m05) [DGL-029](SCOPE_REGISTER.md#dgl-029) [DGL-030](SCOPE_REGISTER.md#dgl-030) | 跨项目共用 |
| C-W30 | 订单与履约管理 | 售后、退款、评价及争议处理 | 商品服务退款退货、争议评价证据 | [EXT-M06](SCOPE_REGISTER.md#ext-m06) [DGL-031](SCOPE_REGISTER.md#dgl-031) | 跨项目共用 |
| C-W31 | 支付与资金管理 | 支付渠道、主体配置及交易记录 | 按确认收款主体关联商城服务物业停车活动、回调最终结果 | [EXT-M07](SCOPE_REGISTER.md#ext-m07) [DGL-011](SCOPE_REGISTER.md#dgl-011) [DGL-013](SCOPE_REGISTER.md#dgl-013) [DGL-017](SCOPE_REGISTER.md#dgl-017) [DGL-029](SCOPE_REGISTER.md#dgl-029) [DGL-034](SCOPE_REGISTER.md#dgl-034) | 跨项目共用 |
| C-W32 | 支付与资金管理 | 结算分账、规则及订单快照 | 按协议渠道配置规则接收关系快照、实际结果 | [EXT-M07](SCOPE_REGISTER.md#ext-m07) [DGL-032](SCOPE_REGISTER.md#dgl-032) | 跨项目共用 |
| C-W33 | 支付与资金管理 | 退款回退、异常处理及基础对账 | 必要分账回退、未知失败重试及订单渠道差异 | [EXT-M07](SCOPE_REGISTER.md#ext-m07) [DGL-014](SCOPE_REGISTER.md#dgl-014) [DGL-017](SCOPE_REGISTER.md#dgl-017) [DGL-031](SCOPE_REGISTER.md#dgl-031) [DGL-034](SCOPE_REGISTER.md#dgl-034) | 跨项目共用 |
| C-W34 | 物业收费管理 | 账单导入、同步及费用查询 | 房屋账期金额应收核验、导入或接口 | [DGL-012](SCOPE_REGISTER.md#dgl-012) | 本次剩余范围 |
| C-W35 | 物业收费管理 | 缴费核销、欠费提醒及记录 | 实际支付更新、欠费提醒、核对记录 | [DGL-013](SCOPE_REGISTER.md#dgl-013) [DGL-014](SCOPE_REGISTER.md#dgl-014) | 本次剩余范围 |
| C-W36 | 物业服务管理 | 报事报修、服务跟踪及评价 | 物业诉求规则、关联工单回访评价时效 | [DGL-023](SCOPE_REGISTER.md#dgl-023) [DGL-022](SCOPE_REGISTER.md#dgl-022) | 本次剩余范围 |
| C-W37 | 停车业务管理 | 停车系统、月卡及临停业务 | 接口映射、月卡续费临停与授权无感业务 | [DGL-015](SCOPE_REGISTER.md#dgl-015) [DGL-016](SCOPE_REGISTER.md#dgl-016) [DGL-018](SCOPE_REGISTER.md#dgl-018) | 本次剩余范围 |
| C-W38 | 停车业务管理 | 费用、支付回传及异常核对 | 费用记录、支付回传车场、账单及回传异常 | [DGL-017](SCOPE_REGISTER.md#dgl-017) | 本次剩余范围 |
| C-W39 | 居民共享与邻里互助 | 内容审核、展示范围及过程记录 | 闲置需求技能审核、社区展示撮合预约完成 | [EXT-C01](SCOPE_REGISTER.md#ext-c01) [EXT-C02](SCOPE_REGISTER.md#ext-c02) | 同事负责 |
| C-W40 | 居民共享与邻里互助 | 风险类别、举报及纠纷管理 | 禁发低风险规则、举报下架纠纷证据 | [EXT-C03](SCOPE_REGISTER.md#ext-c03) | 同事负责 |
| C-W41 | 社区活动管理 | 活动发布、对象、场次及报名 | 内容对象名额审核收费、报名取消 | [DGL-033](SCOPE_REGISTER.md#dgl-033) [DGL-034](SCOPE_REGISTER.md#dgl-034) | 本次剩余范围 |
| C-W42 | 社区活动管理 | 签到、支付、评价及活动统计 | 支付名单签到执行评价和参与统计 | [DGL-034](SCOPE_REGISTER.md#dgl-034) [DGL-035](SCOPE_REGISTER.md#dgl-035) | 本次剩余范围 |
| C-W43 | 积分运营 | 积分账户、规则及流水 | 获取使用规则和账户、已确认消费活动缴费激励 | [DGL-036](SCOPE_REGISTER.md#dgl-036) [DGL-037](SCOPE_REGISTER.md#dgl-037) | 本次剩余范围 |
| C-W44 | 积分运营 | 抵扣、退款回退及异常核查 | 启用规则占用抵扣释放回退、业务操作关联 | [DGL-038](SCOPE_REGISTER.md#dgl-038) [DGL-037](SCOPE_REGISTER.md#dgl-037) | 本次剩余范围 |
| C-W45 | 内容与消息管理 | 首页、社区公告及定向发布 | 首页推荐公告政策、按小区角色范围 | [DGL-047](SCOPE_REGISTER.md#dgl-047) | 本次剩余范围 |
| C-W46 | 内容与消息管理 | 业务通知、告警提醒及发送记录 | 审核交易缴费工单活动风险通知、状态异常 | [DGL-048](SCOPE_REGISTER.md#dgl-048) | 本次剩余范围 |
| C-W47 | 运营分析 | 居民、商户及业务运营统计 | 居民商户商品服务交易缴费共享活动、时间范围 | [DGL-050](SCOPE_REGISTER.md#dgl-050) | 本次剩余范围 |
| C-W48 | 城运平台对接 | 监控资源目录、视频共享授权 | 按确认规范目录视频授权与共享结果 | [DGL-045](SCOPE_REGISTER.md#dgl-045) | 本次剩余范围 |
| C-W49 | 城运平台对接 | 接口鉴权、失败重传及同步日志 | 连接鉴权请求回执失败重传、跨平台一致性 | [DGL-046](SCOPE_REGISTER.md#dgl-046) | 本次剩余范围 |
| C-W50 | 系统管理 | 参数、字典、文件及定时任务 | 业务参数字典公共文件和定时任务 | [DGL-051](SCOPE_REGISTER.md#dgl-051) | 本次剩余范围 |
| C-W51 | 系统管理 | 导入导出、日志及接口管理 | 授权导入导出、审计接口状态异常 | [DGL-051](SCOPE_REGISTER.md#dgl-051) [DGL-052](SCOPE_REGISTER.md#dgl-052) | 本次剩余范围 |
| C-W52 | 系统管理 | 监测、备份恢复及维护记录 | 巡检安全检测、备份恢复演练与版本维护 | [DGL-053](SCOPE_REGISTER.md#dgl-053) | 本次剩余范围 |


## 其他章节约束与前置条件（12项）

| 编号 | 来源章节 | 要求摘要 | 对应需求包 | 处理方式 |
| --- | --- | --- | --- | --- |
| C-A01 | 建设方案 1.1—1.2 | 统一居民服务入口、Web与三个小程序、管理端社区物业共用 | [DGL-010](SCOPE_REGISTER.md#dgl-010) [DGL-001](SCOPE_REGISTER.md#dgl-001) | 四端入口及身份范围；商城和同事模块保留协作归属 |
| C-A02 | 建设方案 1.2 | 跨主体信息共享及居民、党务、视频、财务分别授权 | [DGL-001](SCOPE_REGISTER.md#dgl-001) [DGL-052](SCOPE_REGISTER.md#dgl-052) | 公共权限先约定，各业务逐项验收；真实权限由研发验证 |
| C-A03 | 建设方案 1.3及2.1 | 社区治理、物业、安全、便民运营、数据分析五能力领域 | [DGL-002](SCOPE_REGISTER.md#dgl-002) [DGL-019](SCOPE_REGISTER.md#dgl-019) [DGL-027](SCOPE_REGISTER.md#dgl-027) [DGL-033](SCOPE_REGISTER.md#dgl-033) [DGL-039](SCOPE_REGISTER.md#dgl-039) [DGL-041](SCOPE_REGISTER.md#dgl-041) [DGL-042](SCOPE_REGISTER.md#dgl-042) [DGL-043](SCOPE_REGISTER.md#dgl-043) [DGL-044](SCOPE_REGISTER.md#dgl-044) [DGL-050](SCOPE_REGISTER.md#dgl-050) | 映射六阶段，待确认专项单列而非取消 |
| C-A04 | 建设方案 2.1 | 身份空间、事件工单、交易支付、履约、文件消息及日志公共能力 | [DGL-011](SCOPE_REGISTER.md#dgl-011) [DGL-001](SCOPE_REGISTER.md#dgl-001) [DGL-019](SCOPE_REGISTER.md#dgl-019) [DGL-048](SCOPE_REGISTER.md#dgl-048) [DGL-051](SCOPE_REGISTER.md#dgl-051) [DGL-052](SCOPE_REGISTER.md#dgl-052) [EXT-M07](SCOPE_REGISTER.md#ext-m07) | 复用、扩展或新建由研发核验；共同业务约定在00交付 |
| C-A05 | 建设方案 2.1末段 | 报修隐患巡查告警统一处置，保留业务来源规则与责任主体 | [DGL-019](SCOPE_REGISTER.md#dgl-019) [DGL-020](SCOPE_REGISTER.md#dgl-020) [DGL-021](SCOPE_REGISTER.md#dgl-021) [DGL-023](SCOPE_REGISTER.md#dgl-023) [DGL-024](SCOPE_REGISTER.md#dgl-024) [DGL-025](SCOPE_REGISTER.md#dgl-025) | 来源记录与任务关系先确认，不复制各模块工单状态 |
| C-A06 | 建设方案 2.1 | 设备及城运授权接口接入、业务协同、安全和运行保障 | [DGL-042](SCOPE_REGISTER.md#dgl-042) [DGL-043](SCOPE_REGISTER.md#dgl-043) [DGL-044](SCOPE_REGISTER.md#dgl-044) [DGL-045](SCOPE_REGISTER.md#dgl-045) [DGL-046](SCOPE_REGISTER.md#dgl-046) [DGL-053](SCOPE_REGISTER.md#dgl-053) | 原型与真实接入分列验收；厂商、城运和研发共同确认条件 |
| C-P01 | 建设方案 4 | 11月30日目标版本交付及各业务原开发节点 | [DGL-053](SCOPE_REGISTER.md#dgl-053) | 原计划日期保留；当前事实和产能待核验，产品交接日期另列 |
| C-K01 | 建设方案 5第1项 | 三个小程序运营主体、注册认证备案及发布权限 | [DGL-053](SCOPE_REGISTER.md#dgl-053) [DGL-010](SCOPE_REGISTER.md#dgl-010) | Q02、Q25落实账号主体与发布责任，不以原型代替上线 |
| C-K02 | 建设方案 5第2项 | 各收费业务收款主体及支付分账退款结算方案 | [DGL-011](SCOPE_REGISTER.md#dgl-011) [DGL-013](SCOPE_REGISTER.md#dgl-013) [DGL-017](SCOPE_REGISTER.md#dgl-017) [DGL-029](SCOPE_REGISTER.md#dgl-029) [DGL-032](SCOPE_REGISTER.md#dgl-032) [DGL-034](SCOPE_REGISTER.md#dgl-034) [EXT-M07](SCOPE_REGISTER.md#ext-m07) | Q08逐业务确认，统一能力不代表相同收款主体 |
| C-K03 | 建设方案 5第3项 | 停车监控充电消防接口、数据授权与现有算法条件 | [DGL-016](SCOPE_REGISTER.md#dgl-016) [DGL-017](SCOPE_REGISTER.md#dgl-017) [DGL-018](SCOPE_REGISTER.md#dgl-018) [DGL-042](SCOPE_REGISTER.md#dgl-042) [DGL-043](SCOPE_REGISTER.md#dgl-043) [DGL-044](SCOPE_REGISTER.md#dgl-044) | Q09、Q10、Q18～Q20核验厂商资料；不存在的能力不承诺自研 |
| C-K04 | 建设方案 5第4项 | 城运视频共享、告警推送和事件协同接口规范 | [DGL-045](SCOPE_REGISTER.md#dgl-045) [DGL-046](SCOPE_REGISTER.md#dgl-046) | Q21分别确认各对接场景、授权与联调条件 |
| C-K05 | 建设方案 5第5项 | 其他社区新提需求及时确认 | [DGL-011](SCOPE_REGISTER.md#dgl-011) | 通过范围台账登记来源、责任人、期限与版本影响；确认后评估交期，不自动并入当前实施包 |


## 历史差异与当前处理（15项）

以下处理是本轮范围整理依据。涉及新增范围、规则或排期承诺的内容仍需记录实际确认；旧文档包含某项不等于本月自动纳入，旧文档排除某项也不能覆盖用户本轮明确要求。

| 编号 | 主题 | 旧资料口径 | 本轮／较新资料口径 | 当前处理 | 历史依据 |
| --- | --- | --- | --- | --- | --- |
| H01 | 产品终端 | 旧0826为三端并后移运营作业端 | 新建设方案为Web加住户、商户、管理端三个小程序 | 按四端纳入；管理端社区物业共用 | S1 §1、§4；S2 §4、§28.2 |
| H02 | 活动与工单 | 旧一期后移活动、报修、工单、巡检 | 新方案已列活动、统一事件工单、报修隐患及管理端执行 | 活动及工单纳入；巡查扩展内容另确认 | S1 §4；S2 §28.1、§28.3 |
| H03 | 安全与城运 | 旧0826无完整专项包 | 新方案列党建网格、车棚充电消防及城运 | 逐项登记确认与交付责任，不只挂待定 | S0 §3.2、§3.4、§5 |
| H04 | 停车范围 | 旧仅车辆关系、账单缴费，排除临停计费、无感和复杂月卡 | 新方案列月卡、临停查询支付回传和条件化无感 | 新增范围需核验厂商；不默认自建计费或设备平台 | S2 §25.4；S0 §3.1、§3.4 |
| H05 | 活动设计分工 | dot称同事负责活动 | 本轮用户仅明确共享、互助分给同事 | 活动暂列lee，Q01确认 | 本轮分工指示与dot建议 |
| H06 | 商城技术与交易基线 | 0826基于RuoYi，早期结算及履约较窄 | 最新P0为LiLiShop、多商户统一结算、四种履约 | 商城沿原P0，不搬仓、不重做，不将旧后台假定为当前技术事实 | S3 §§1.4、3、7；S4 §§1、6.1 |
| H07 | 团购商城名称 | V0.4有成团规则；0826和P0排除真实团购 | 新方案名称含团购但功能为普通商城交易 | 不自动加拼团团长集采，Q27确认名称与机制 | S5 §6.2.4；S1 §4；S4 §1.5 |
| H08 | 积分优先级与抵扣 | 旧总表S1或按启用，详单部分列S0 | 新方案账户规则纳入，抵扣按启用 | 统一场景与政策后再冻结，不沿用矛盾优先级 | S1 PT-02/03；S2 §§20、23 |
| H09 | 物业系统依赖 | V0.4需求规格要求复用同步，概要又写全新建设 | 当前方案允许账单导入或同步 | 按数据对象确认主责，不整体假设全新或全接旧系统 | S5 §11.1；S6 §10.2 |
| H10 | 空间资源与社群 | V0.4有独立空间预约和社群运营 | 当前方案未列独立业务 | 历史保留，默认不增加到本月；如恢复需变更评估 | S5 §6.3、§6.6.3 |
| H11 | 家庭代办与增强活动 | V0.4有家庭授权、候补、多人报名等 | 当前明确人房授权查询和基础活动 | 家庭代办、候补、多人成单等逐项确认 | S5 §6.1.2、§6.2.6、§6.6.1 |
| H12 | 积分商城与复杂营销 | 旧研究文本有兑换任务，0826和P0明确收缩 | 当前仅账户规则来源抵扣回退 | 不默认增加积分商城、签到任务、会员等级 | S1 §4；S4 §1.5；S5 §6.2.7 |
| H13 | 复杂业务增强 | 旧明确不做复杂排班、物业计费、钱包提现、自动开票、骑手平台等 | 本轮未恢复这些能力 | 保留边界，变更需评估；临停查询不等于自建计费 | S2 §28；S4 §1.5 |
| H14 | 研究专项与平台月度交付 | 立项周期2026.06—2027.12，含模型驱动、AI和知识图谱 | 本轮要求11/30平台目标版本 | 研究计划单列；不等同本月全部实现；今年研究验证由课题负责人确认 | S5 §14.9；S6 §16.8；S7 年度计划 |
| H15 | 旧进度与当前事实 | 建设方案进度截至10/28；旧清单为需求范围 | 本轮未给每模块最新生产验收证据 | 保留原目标日期；需求、原型、研发、实联调分别核定 | S0 §4；S3阶段退出条件 |


## 维护方法

新增原文行时续编来源行编号，补充关联需求编号；调整当前实现范围时更新需求台账和问题决策，保留来源原意。若收到正式建设方案新版本，记录新旧差异与来源文件，不直接用新文本覆盖历史归档。
