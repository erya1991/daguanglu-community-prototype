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
  saveProduct: ["MP02", "MP03", "MP04", "MP05", "MP06", "MP07", "MP09"],
  saveTemporary: [
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
export const actionNames = {
  createCheck: "建立异常核查",
  editBill: "核验更正",
  publish: "发布账单",
  saveParkingRelation: "维护停车关系",
  saveProduct: "维护月租产品",
  saveTemporary: "登记临停费用",
  report: "登记事项",
  supplement: "补充信息",
  verify: "核实事项",
  dispatch: "人工派单",
  accept: "接单",
  return: "退单",
  transfer: "内部转派",
  saveProcess: "保存处理记录",
  submitProcess: "提交复核",
  review: "复核",
  closeHazard: "确认销号",
  confirm: "确认处理结果",
  evaluate: "服务评价",
  saveCheck: "登记核查意见",
  queryPayment: "查询原支付",
  recoverPayment: "核对原核销",
};
export const enums = {
  PK07: ["有效", "无效"],
  MP07: ["启用", "停用"],
  RP07: ["报修", "隐患"],
  RP11: ["公共位置", "房屋内"],
  EV05: ["有效", "需补充", "误报", "重复"],
  RV03: ["通过", "退回"],
  UC01: ["已解决", "未解决"],
};
export function choices(id, options = {}, records = []) {
  if (enums[id]) return enums[id].map((v) => ({ value: v, label: v }));
  if (["RP08", "EV03"].includes(id))
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
  return null;
}
export function activeFields(action, data, role = "property", kind = "") {
  return (formFields[action] || []).filter((id) => {
    if (id === "RP03") return role === "property";
    if (id === "RP07" && role === "resident" && kind) return false;
    if (id === "RP12") return data.RP11 === "房屋内";
    if (["RP15", "RP16"].includes(id)) return data.RP07 === "报修";
    if (id === "EV07") return data.EV05 === "需补充";
    if (id === "EV08") return data.EV05 === "重复";
    if (id.startsWith("HZ")) return kind === "隐患" && data.EV05 === "有效";
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
  parkingRelations: [["车辆与停车关系", fieldRange("PK", 1, 11)]],
  products: [["产品及期间规则", fieldRange("MP", 1, 9)]],
  monthly: [
    ["办理与期间", fieldRange("MO", 1, 9)],
    ["支付及平台登记", fieldRange("MO", 10, 18)],
  ],
  temporary: [
    ["停车及费用依据", fieldRange("TB", 1, 12)],
    ["缴费结果", fieldRange("TB", 13, 15)],
  ],
  reports: [
    ["原始上报", fieldRange("RP", 1, 17)],
    ["当前进度", ["RP19"]],
  ],
  events: [["核实记录", fieldRange("EV", 1, 13)]],
  workorders: [
    ["责任与状态", fieldRange("WO", 1, 13)],
    ["隐患整改", fieldRange("HZ", 1, 9)],
    ["时间事实", fieldRange("ST", 6, 8)],
  ],
  batches: [["导入批次", fieldRange("IM", 1, 13)]],
};
