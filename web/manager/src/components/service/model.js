export const views = {
  qualifications: {
    title: "商户服务经营资格",
    intro: "核对商户当前服务授权，审核申请并保留每轮依据。",
    table: "qualifications",
    filter: ["26-A"],
    columns: [
      "商户编号",
      "商户名称",
      "经营店铺名称",
      "申请状态",
      "服务经营有效性",
      "最近审核时间",
    ],
    groups: [
      ["当前授权", ["26-B"]],
      ["申请与审核", ["26-C", "26-D"]],
    ],
  },
  personnel: {
    title: "商户服务人员",
    intro: "查询本范围人员、有效资质与受影响服务安排。",
    table: "personnel",
    filter: ["26-A"],
    columns: [
      "服务人员编号",
      "人员姓名",
      "所属商户名称",
      "可执行服务类目",
      "人员状态",
    ],
    groups: [
      ["人员资料", ["26-E"]],
      ["资格材料", ["26-D"]],
    ],
  },
  categories: {
    title: "服务分类",
    intro: "维护服务类目与已支持的履约方式。",
    table: "categories",
    filter: [],
    columns: [
      "类目名称",
      "上级类目",
      "商户材料必需",
      "人员材料必需",
      "类目状态",
      "排序",
    ],
    groups: [["配置详情", ["27-A"]]],
  },
  methods: {
    title: "履约方式",
    intro: "沿用上门和预约到点两种流程，名称及说明可维护。",
    table: "methods",
    filter: [],
    columns: ["履约方式名称", "流程模板", "方式状态", "方式版本"],
    groups: [["配置详情", ["27-A"]]],
  },
  review: {
    title: "服务审核",
    intro: "审核送审版本、监管发布供给，原订单始终保留原快照。",
    table: "services",
    filter: ["27-B"],
    columns: [
      "服务项目编号",
      "服务项目名称",
      "经营店铺名称",
      "服务类目",
      "审核状态",
      "上架状态",
      "接收预约状态",
      "展示价格",
    ],
    groups: [
      ["服务内容", ["27-C", "28-A"]],
      ["规格与方式", ["27-D", "27-E"]],
      ["审核与监管", ["27-F"]],
    ],
  },
  orders: {
    title: "服务订单",
    intro: "查询订单约定、当前安排、履约与独立资金事实。",
    table: "orders",
    filter: ["29-D"],
    columns: [
      "服务订单号",
      "服务项目名称",
      "服务规格名称",
      "履约方式名称",
      "业务进度",
      "订单应付金额",
      "支付状态",
      "售后状态",
    ],
    groups: [
      ["订单约定", ["29-E", "29-B", "29-C"]],
      ["服务安排", ["28-A", "28-B", "28-C", "28-D"]],
      ["履约记录", ["30-A", "30-B", "30-C", "30-D", "30-E"]],
      ["售后记录", ["31-A", "31-B", "31-C", "31-G"]],
      ["资金记录", ["29-F", "31-D", "32-C", "32-D", "32-E"]],
    ],
  },
  aftersales: {
    title: "服务售后",
    intro: "在原售后记录中查看协商、录入线下裁定结果并追踪执行。",
    table: "aftersales",
    filter: ["31-A"],
    columns: [
      "售后编号",
      "关联服务订单号",
      "服务项目名称",
      "申请类型",
      "售后状态",
      "申请时间",
    ],
    groups: [
      ["申请与协商", ["31-A", "31-B", "31-C"]],
      ["裁定结果", ["31-G"]],
      ["执行与退款", ["31-D", "32-E"]],
    ],
  },
  evaluations: {
    title: "服务评价",
    intro: "保留居民原始评价，按授权核查公开展示限制。",
    table: "evaluations",
    filter: ["31-F"],
    columns: [
      "评价编号",
      "服务项目名称",
      "服务规格名称",
      "总体评分",
      "评价时间",
      "评价展示状态",
    ],
    groups: [
      ["评价内容", ["31-E"]],
      ["监管记录", ["31-F"]],
    ],
  },
  overview: {
    title: "服务经营",
    intro: "各指标按自身发生时间统计，当前待办单独展示。",
    table: "orders",
    filter: ["32-A"],
    columns: [],
    groups: [],
  },
  funds: {
    title: "服务资金",
    intro: "查询支付、退款、分账、回退与只读规则快照。",
    table: "funds",
    filter: ["32-A"],
    columns: [
      "资金业务单号",
      "资金类型",
      "关联服务订单号",
      "商户名称",
      "金额",
      "资金状态",
      "发生时间",
    ],
    groups: [
      ["资金摘要", ["32-C"]],
      ["付款与退款", ["29-F", "31-D"]],
      ["分账与回退", ["32-D", "32-E"]],
      ["规则与核查", ["32-F"]],
    ],
  },
  exceptions: {
    title: "资金异常核查",
    intro: "围绕原资金请求核查和恢复，说明记录不代替资金结果。",
    table: "exceptions",
    filter: ["32-A"],
    columns: [
      "异常业务编号",
      "异常类型",
      "关联服务订单号",
      "原资金业务单号",
      "异常说明",
      "处理状态",
    ],
    groups: [
      ["异常与原单", ["32-F", "32-C"]],
      ["关联资金", ["29-F", "31-D", "32-D", "32-E"]],
    ],
  },
};
export const entityNames = {
  qualifications: "服务经营资格",
  personnel: "服务人员",
  categories: "服务类目",
  methods: "履约方式",
  services: "服务供给",
  orders: "服务订单",
  aftersales: "服务售后",
  evaluations: "服务评价",
  funds: "资金记录",
  exceptions: "资金异常",
};
export function titleOf(row = {}) {
  return (
    row["服务项目名称"] ||
    row["服务名称"] ||
    row["商户名称"] ||
    row["人员姓名"] ||
    row["姓名"] ||
    row["类目名称"] ||
    row["履约方式名称"] ||
    row["申请类型"] ||
    row["资金类型"] ||
    row._title ||
    row._id ||
    "记录详情"
  );
}
export function valueOf(row = {}, name) {
  const aliases = {
    服务人员编号: ["人员编号"],
    人员姓名: ["姓名", "服务人员姓名"],
    类目状态: ["启用状态", "状态"],
    商户材料必需: ["商户证明是否必需"],
    人员材料必需: ["人员证明是否必需"],
    方式状态: ["启用状态", "状态"],
    方式版本: ["版本"],
    排序: ["类目排序", "显示顺序", "排序号"],
    流程模板: ["绑定流程模板"],
    审核状态: ["服务审核状态"],
    上架状态: ["发布状态"],
    接收预约状态: ["接收新预约状态", "接收预约开关"],
    展示价格: ["当前展示价", "最低展示价格", "最低价格"],
    服务项目编号: ["服务编号"],
    商户名称: ["经营主体名称"],
    服务项目名称: ["服务名称"],
    服务订单号: ["订单编号", "订单号"],
    服务类目: ["所属服务类目"],
    业务进度: ["当前业务进度", "订单状态", "服务进度"],
    订单应付金额: ["应付金额", "订单金额"],
    售后编号: ["服务售后编号"],
    关联服务订单号: ["原服务订单号", "服务订单号", "订单号"],
    资金业务单号: [
      "业务单号",
      "支付业务单号",
      "退款业务单号",
      "分账业务单号",
      "回退业务单号",
    ],
    金额: ["资金金额"],
    资金状态: ["状态", "支付状态", "退款状态", "分账状态", "回退状态"],
    发生时间: [
      "资金发生时间",
      "付款成功时间",
      "支付成功时间",
      "退款发起时间",
      "创建时间",
    ],
    异常业务编号: ["异常记录编号", "异常编号"],
    异常类型: ["异常业务类型"],
    原资金业务单号: ["关联资金单据号"],
    处理状态: ["异常处理状态", "状态"],
  };
  if (row[name] !== undefined) return row[name];
  for (const k of aliases[name] || []) if (row[k] !== undefined) return row[k];
  return undefined;
}
export function plain(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value))
    return (
      value
        .map((v) => (typeof v === "object" ? titleOf(v) : String(v)))
        .join("、") || "—"
    );
  if (typeof value === "object")
    return Object.entries(value)
      .filter(([k]) => !k.startsWith("_"))
      .map(([k, v]) => k + "：" + plain(v))
      .join("；");
  return String(value);
}
export function operationId() {
  return (
    "web-service-" + Date.now() + "-" + Math.random().toString(36).slice(2)
  );
}
