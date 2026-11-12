import { fieldById, fieldRange } from "./fields.js";
export { fieldById, fieldRange };
export const moneyFields = [
  "BL13",
  "BL14",
  "BL15",
  "BL16",
  "PY04",
  "PY05",
  "PY06",
  "PY07",
  "PY21",
  "MP04",
  "MO09",
  "TB06",
  "TB07",
  "TB08",
];
export const attachmentFields = [
  "WO19",
  "IM01",
  "EX07",
  "RP17",
  "SP03",
  "EV13",
  "PR05",
  "PR06",
  "RV05",
  "UC03",
];
export const formFields = {
  editBill: ["BL02", "BL07", "BL10", "BL11", "BL12", "BL13", "BL14", "BL17"],
  saveParkingRelation: ["PK02", "PK04", "PK05", "PK07", "PK08", "PK09"],
  saveProduct: ["MP02", "MP03", "MP04", "MP05", "MP06", "MP07", "MP09", "MP10"],
  saveTemporary: [
    "TB17",
    "TB02",
    "TB03",
    "TB04",
    "TB05",
    "TB06",
    "TB09",
    "TB10",
    "TB12",
  ],
  report: [
    "RP03",
    "RP06",
    "RP07",
    "RP08",
    "RP09",
    "RP10",
    "RP11",
    "RP12",
    "RP13",
    "RP14",
    "RP15",
    "RP16",
    "RP17",
  ],
  supplement: ["SP02", "SP03"],
  verify: [
    "EV03",
    "EV04",
    "EV05",
    "EV06",
    "EV07",
    "EV08",
    "HZ03",
    "HZ04",
    "HZ05",
    "HZ09",
    "EV12",
  ],
  editTask: ["WO15", "WO16", "WO17", "WO18", "WO19", "WO22", "WO23"],
  requestSupplement: ["WO20", "WO18"],
  markDuplicate: ["WO21", "WO18"],
  markFalse: ["WO18"],
  dispatch: ["WO04", "WO05"],
  return: ["OP01"],
  transfer: ["OP03", "OP04"],
  saveProcess: ["PR02", "PR03", "PR04", "PR05", "PR06", "PR07", "PR11"],
  submitProcess: ["PR02", "PR03", "PR04", "PR05", "PR06", "PR07", "PR11"],
  review: ["RV02", "RV03", "RV04", "RV05", "EV12", "EV13"],
  confirm: ["UC01", "UC02", "UC03"],
  evaluate: ["VA01", "VA02"],
  saveCheck: ["EX06", "EX07", "EX10"],
};
// Display the same required inputs as the current command validation. Optional
// evidence and conditionally visible fields must not acquire a permanent mark.
const requiredByAction = {
  editBill: ["BL07", "BL10", "BL11", "BL13"],
  saveParkingRelation: ["PK02", "PK04", "PK05", "PK08", "PK09"],
  saveProduct: ["MP02", "MP03", "MP04", "MP05", "MP06", "MP07"],
  saveTemporary: ["TB02", "TB03", "TB04", "TB05", "TB06", "TB09", "TB10"],
  report: ["RP07", "RP08", "RP09", "RP10", "RP11", "RP13", "RP14"],
  editTask: ["WO15", "WO16", "WO17", "WO18"],
  dispatch: ["WO04", "WO05"],
  transfer: ["OP03", "OP04"],
  saveProcess: ["PR02", "PR07"],
  submitProcess: ["PR02", "PR07"],
  confirm: ["UC01"],
  evaluate: ["VA01"],
  saveCheck: ["EX06"],
};
/**
 * @param {string} action
 * @param {string} id
 * @param {Record<string, any>} [data]
 * @param {Record<string, any>} [record]
 */
export function isRequiredField(action, id, data = {}, record = {}) {
  if ((requiredByAction[action] || []).includes(id)) return true;
  if (action === "report") {
    if (id === "RP12") return data.RP11 === "房屋内";
    if (["RP15", "RP16"].includes(id)) return data.RP07 === "报修";
    if (id === "RP17") return data.RP07 === "隐患";
  }
  if (action === "editTask") {
    if (["WO22", "WO23"].includes(id)) return data.WO15 === "报修";
    if (id === "WO19")
      return data.WO15 === "隐患" && !(record.report?.RP17?.length || record.WO19?.length);
  }
  return action === "confirm" && id === "UC02" && data.UC01 === "未解决";
}
export const actionNames = {
  createCheck: "登记核对事项",
  editTask: "更正工单",
  requestSupplement: "要求补充",
  markDuplicate: "标记重复",
  markFalse: "标记误报",
  editBill: "核验更正",
  publish: "发布账单",
  saveParkingRelation: "维护停车关系",
  saveProduct: "维护月租产品",
  saveTemporary: "登记临停费用",
  report: "登记工单",
  supplement: "补充信息",
  verify: "核实事项",
  dispatch: "人工派单",
  accept: "接单",
  return: "退单",
  transfer: "内部转派",
  startProcess: "开始处理",
  saveProcess: "保存处理记录",
  submitProcess: "提交验收",
  review: "复核",
  closeHazard: "确认销号",
  confirm: "确认处理结果",
  evaluate: "服务评价",
  saveCheck: "登记处理意见",
  queryPayment: "核对付款",
  recoverPayment: "更新核销登记",
};
export const enums = {
  PK07: ["有效", "无效"],
  MP07: ["启用", "停用"],
  RP07: ["报修", "隐患"],
  WO15: ["报修", "隐患"],
  RP11: ["公共位置", "房屋内"],
  EV05: ["有效", "需补充", "误报", "重复"],
  RV03: ["通过", "退回"],
  UC01: ["已解决", "未解决"],
};
export const paymentStates = [
  "待支付",
  "处理中",
  "结果待确认",
  "失败",
  "已关闭",
  "成功",
];
export const settlementStates = ["未核销", "成功", "异常"];
export const listStates = {
  bills: [
    "待发布",
    "未结清",
    "部分结清",
    "已结清",
    "已支付待核销",
    "付款结果确认中",
  ],
  parkingRelations: ["有效", "无效"],
  products: ["启用", "停用"],
  monthly: [
    "待支付",
    "支付确认中",
    "付款结果确认中",
    "已支付待登记",
    "已登记",
    "登记异常",
    "已关闭",
  ],
  temporary: ["未结清", "部分结清", "已结清", "已支付待核销", "付款结果确认中"],
  workorders: [
    "待派单",
    "待处理",
    "处理中",
    "待确认",
    "待评价",
    "已完成",
  ],
  checks: ["待核查", "已核查"],
  payments: paymentStates,
};
listStates.reports = listStates.workorders;
listStates.dues = [
  ...new Set([
    ...listStates.bills,
    ...listStates.monthly,
    ...listStates.temporary,
  ]),
];
export function rowActions(row, table = row._table) {
  if (table === "workorders") return row._actions || [];
  if (table === "bills" && row.BL19 === "待发布")
    return ["editBill", "publish"];
  if (table === "parkingRelations") return ["saveParkingRelation"];
  if (table === "products") return ["saveProduct"];
  if (table === "checks") return ["saveCheck"];
  if (["bills", "monthly", "temporary", "payments"].includes(table))
    return [
      ...(table === "temporary" &&
      !row.TB07 &&
      !(row.payments || []).some((p) =>
        ["处理中", "结果待确认", "成功"].includes(p.PY12)
      )
        ? ["saveTemporary"]
        : []),
      ...(["处理中", "结果待确认"].includes(row._paymentState)
        ? ["queryPayment"]
        : []),
      ...(row._paymentState === "成功" && row._settlementState !== "成功"
        ? ["recoverPayment"]
        : []),
      "createCheck",
    ];
  return [];
}
export function choices(id, options = {}, records = []) {
  if (enums[id]) return enums[id].map((v) => ({ value: v, label: v }));
  if (["RP08", "EV03", "WO16"].includes(id))
    return (options.config?.categories || []).map((v) => ({
      value: v,
      label: v,
    }));
  if (id === "HZ03")
    return (options.config?.risks || []).map((v) => ({ value: v, label: v }));
  if (id === "VA01")
    return (options.config?.ratings || []).map((v) => ({ value: v, label: v }));
  if (["BL07", "RP12", "QF04"].includes(id)) return options.houses || [];
  if (["RP09", "QF02"].includes(id)) return options.communities || [];
  if (["RP10", "QF03"].includes(id)) return options.estates || [];
  if (id === "PK02") return options.vehicles || [];
  if (["WO04", "OP03"].includes(id)) return options.personnel || [];
  if (id === "TB03")
    return (options.relations || []).map((r) => ({
      value: r._id,
      label: r._title,
    }));
  if (id === "MP03")
    return [
      ...new Map(
        (options.relations || []).map((r) => [
          r.PK04,
          { value: r.PK04, label: r.PK05 },
        ])
      ).values(),
    ];
  if (id === "EV08")
    return records.map((r) => ({
      value: r._id,
      label: r.EV01 + " · " + r._title,
    }));
  if (id === "WO21")
    return records
      .filter((r) => !r.WO21 && !["误报终止", "重复关联"].includes(r.WO06))
      .map((r) => ({ value: r._id, label: r._id + " · " + r._title }));
  return null;
}
export function activeFields(action, data, role = "property", kind = "") {
  return (formFields[action] || []).filter((id) => {
    if (id === "RP03") return ["property", "platform"].includes(role);
    if (id === "RP12") return data.RP11 === "房屋内";
    if (["RP15", "RP16"].includes(id)) return data.RP07 === "报修";
    if (id === "EV07") return data.EV05 === "需补充";
    if (id === "EV08") return data.EV05 === "重复";
    if (id.startsWith("HZ"))
      return kind === "隐患" && (action === "dispatch" || data.EV05 === "有效");
    if (id === "WO19") return data.WO15 === "隐患";
    if (["WO22", "WO23"].includes(id)) return data.WO15 === "报修";
    if (id === "UC02" || id === "UC03") return data.UC01 === "未解决";
    return true;
  });
}
export function format(id, value, labels = {}) {
  if (value === undefined || value === null || value === "") return "未提供";
  if (labels[id]) return labels[id];
  if (moneyFields.includes(id)) return "¥" + (Number(value) / 100).toFixed(2);
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value))
    return (
      value
        .map((v) =>
          typeof v === "object"
            ? v.HI02 || v.SP02 || v.PR07 || "记录"
            : String(v)
        )
        .join("、") || "暂无"
    );
  if (typeof value === "object")
    return (
      Object.entries(value)
        .filter(([k]) => !k.startsWith("_"))
        .map(([k, v]) => (fieldById[k]?.name || k) + "：" + format(k, v))
        .join("；") || "无变更"
    );
  if (/^\d{4}-\d\d-\d\dT/.test(String(value)))
    return new Date(value).toLocaleString("zh-CN", {
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
  return String(value);
}
/** @type {Record<string, [string, string[]][]>} */
export const sections = {
  bills: [
    ["房屋与费用", fieldRange("BL", 3, 18)],
    ["来源与发布", ["BL01", "BL02", "BL19", "BL20", "BL21", "BL22", "BL23"]],
  ],
  payments: [
    ["交易与金额", fieldRange("PY", 1, 10)],
    ["支付与核销", fieldRange("PY", 11, 19)],
    ["已有退款事实", fieldRange("PY", 20, 22)],
  ],
  checks: [["异常核查", fieldRange("EX", 1, 10)]],
  parkingRelations: [
    [
      "车辆与停车关系",
      [...fieldRange("PK", 1, 11), ...fieldRange("PK", 13, 16)],
    ],
  ],
  products: [["产品及期间规则", fieldRange("MP", 1, 10)]],
  monthly: [
    ["办理与期间", fieldRange("MO", 1, 9)],
    ["支付及平台登记", [...fieldRange("MO", 10, 18), "MO20"]],
  ],
  temporary: [
    ["停车及费用依据", [...fieldRange("TB", 1, 12), "TB17", "TB18"]],
    ["缴费结果", fieldRange("TB", 13, 15)],
  ],
  reports: [
    ["当前受理", ["WO15", "WO16", "WO17"]],
    ["原始上报", fieldRange("RP", 1, 17)],
    ["当前进度", ["RP19"]],
  ],
  events: [["核实记录", fieldRange("EV", 1, 13)]],
  workorders: [
    [
      "当前工单",
      ["WO15", "WO16", "WO17", "WO18", "WO19", "WO20", "WO21", "WO22", "WO23"],
    ],
    ["责任与状态", fieldRange("WO", 1, 13)],
    ["隐患整改", fieldRange("HZ", 1, 9)],
    ["时间事实", fieldRange("ST", 6, 8)],
  ],
  batches: [["导入批次", fieldRange("IM", 1, 13)]],
};

// Business-facing detail groups: complete financial facts without internal IDs or operation histories.
/** @type {Record<string, [string, string[]][]>} */
export const detailSections = {
  bills: [["房屋与费用", ["BL01", "BL08", "BL09", "BL10", "BL11", "BL12", "BL13", "BL14", "BL15", "BL16", "BL17", "BL18", "BL19", "BL20", "BL21", "BL22", "BL23"]]],
  payments: [["缴费信息", ["PY01", "PY02", "PY03", "PY04", "PY06", "PY07", "PY08", "PY09", "PY10", "PY11", "PY12", "PY13", "PY14", "PY16", "PY17", "PY18", "PY19", "PY20", "PY21", "PY22"]]],
  parkingRelations: [["车辆与停车关系", ["PK03", "PK15", "PK16", "PK06", "PK13", "PK14", "PK05", "PK07", "PK08", "PK09"]]],
  products: [["月租产品", ["MP01", "MP02", "MP03", "MP04", "MP05", "MP06", "MP07", "MP09", "MP10"]]],
  monthly: [["月租订单", ["MO01", "MO02", "MO03", "MO05", "MO06", "MO07", "MO08", "MO09", "MO10", "MO12", "MO13", "MO14", "MO15", "MO16", "MO17", "MO20"]]],
  temporary: [["临停费用", ["TB01", "TB02", "TB04", "TB05", "TB18", "TB06", "TB07", "TB08", "TB09", "TB10", "TB12", "TB13", "TB14", "TB15", "TB17"]]],
  checks: [["核对信息", ["EX01", "EX02", "EX03", "EX04", "EX05", "EX06", "EX07", "EX08", "EX09", "EX10"]]],
  batches: [["导入批次", ["IM02", "IM03", "IM04", "IM05", "IM06", "IM07", "IM08", "IM09", "IM10", "IM11", "IM12", "IM13"]]],
};
