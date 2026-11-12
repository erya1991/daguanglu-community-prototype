// Required markers describe the inputs needed by the current action. They do
// not replace the command's validation or make optional evidence mandatory.
const requiredByAction = {
  "qualification.save": ["申请服务类目", "申请覆盖社区"],
  "qualification.status": ["状态", "暂停或恢复原因", "原因说明"],
  "personnel.save": ["姓名", "工作联系电话", "可执行服务类目"],
  "personnel.status": ["人员状态", "状态", "启停原因", "原因说明"],
  "service.save": ["服务名称", "所属服务类目", "服务主图", "服务简介", "服务详细说明", "公开服务电话", "规格名称", "规格说明", "包含内容", "规格启用状态", "服务对象填写要求", "组合固定价格", "完成证据要求"],
  "service.status": ["状态"],
  "order.book": ["联系人姓名", "联系人电话", "期望时间选择", "服务约定确认"],
  "order.accept": ["接单结果"],
  "order.arrange": ["服务人员", "安排服务日期", "安排开始时间", "安排结束时间"],
  "order.respond": ["居民安排答复"],
  "order.change": ["改期原因"],
  "order.arrive": [],
  "order.start": [],
  "order.process": ["过程说明"],
  "order.result": ["服务结果", "实际完成内容", "实际服务结束时间"],
  "order.confirm": ["居民结果答复"],
  "order.cancel": ["申请原因"],
  "order.anomaly": ["异常类型", "异常发生时间", "异常事实说明"],
  "aftersale.apply": ["申请类型", "申请原因"],
  "aftersale.plan": ["方案处理类型", "方案说明", "业务结案方式"],
  "aftersale.respond": ["居民方案答复"],
  "aftersale.evidence": ["追加说明"],
  "aftersale.withdraw": ["撤回原因"],
  "aftersale.ruling": ["裁定结果", "裁定说明", "裁定作出人", "裁定作出时间", "裁定后业务处理"],
  "aftersale.rulingNote": ["追加说明"],
  "qualification.review": ["审核结果"],
  "personnel.review": ["核验结论"],
  "service.review": ["审核结果"],
  "evaluation.save": ["总体评分"],
  "evaluation.status": ["状态"],
};

/**
 * Return undefined for an action whose existing field-specific rules apply.
 * @param {string} action
 * @param {{name: string, id?: string}} field
 * @param {Record<string, any>} [data]
 * @param {Record<string, any>} [options]
 * @param {Record<string, any>} [record]
 * @returns {boolean | undefined}
 */
export function requiredServiceField(action, field, data = {}, options = {}, record = {}) {
  if (!Object.prototype.hasOwnProperty.call(requiredByAction, action)) return undefined;
  const name = field.name;
  if (action === "order.book" && field.id?.startsWith("29-C.")) {
    if (["所属社区", "详细地址"].includes(name)) return true;
    return name === "所属小区" && (options.selectedCombo?.["上门覆盖小区"] || []).length > 0;
  }
  if (["qualification.save", "personnel.save"].includes(action) && field.id?.startsWith("26-D.")) {
    return name === "材料名称";
  }
  if (requiredByAction[action].includes(name)) return true;
  if (action === "qualification.save" && name === "服务资质材料") {
    const categories = Array.isArray(data["申请服务类目"]) ? data["申请服务类目"] : [];
    return categories.some(id => options.categories?.some(c => (c._id || c.value) === id && c["商户证明是否必需"]));
  }
  if (action === "service.save") {
    if (name === "服务对象填写提示") return data["服务对象填写要求"] === "必填";
    if (name === "上门覆盖社区") return data["组合流程模板"] === "上门";
    if (name === "可服务门店或服务点") return data["组合流程模板"] === "预约到点";
  }
  if (action === "service.status") {
    const state = data["状态"];
    if (name === "上架或下架原因") return state === "已下架";
    if (name === "暂停原因") return state === "暂停接单";
    if (name === "原因说明") return ["已下架", "暂停接单", "平台限制", "解除限制"].includes(state);
  }
  if (action === "evaluation.status" && name === "评价限制原因") return data["状态"] === "受限";
  if (action === "order.book") {
    if (name === "服务对象描述") return options.selectedSpec?.["服务对象填写要求"] === "必填";
    if (["期望服务日期", "期望时段偏好"].includes(name)) return data["期望时间选择"] === "指定日期";
  }
  if (action === "order.accept") {
    if (name === "无法承接说明") return data["接单结果"] === "无法承接";
    if (["安排服务日期", "安排开始时间", "安排结束时间"].includes(name)) return data["接单结果"] !== "无法承接" && !!data["服务人员"];
  }
  if (action === "order.arrange" && ["改期原因", "原安排仍可履行"].includes(name))
    return !!(record.currentArrangement || record["当前有效安排"]);
  if (action === "order.respond" && name === "居民答复说明") return data["居民安排答复"] === "希望调整";
  if (action === "order.result") {
    if (["未完成内容", "未完成原因"].includes(name)) return !!data["服务结果"] && data["服务结果"] !== "全部完成";
    if (name === "结果图片") return (record._combo || record["服务内容快照"]?.方式 || {})["完成证据要求"] === "必需图片";
  }
  if (action === "order.confirm" && name === "问题说明") return ["有异议", "反馈问题"].includes(data["居民结果答复"]);
  if (action === "aftersale.plan") {
    if (["取消核实结果", "服务是否已实际开始", "核实依据说明"].includes(name)) return record["申请类型"] === "核实取消";
    if (["拟退款金额", "金额依据说明"].includes(name)) return data["方案处理类型"] === "部分退款";
    if (name === "补充履约内容") return data["方案处理类型"] === "补充履约";
  }
  if (action === "aftersale.respond" && name === "居民方案答复说明") return data["居民方案答复"] === "不同意";
  if (action === "aftersale.ruling") {
    if (name === "裁定退款金额") return data["裁定结果"] === "部分退款";
    if (name === "继续或补充履约内容") return data["裁定结果"] === "继续或补充履约";
    if (name === "更正原因") return !!(record["裁定版本"] || record.rulings?.length);
  }
  if (["qualification.review", "service.review"].includes(action) && name === "审核意见") {
    if (data["审核结果"] && data["审核结果"] !== "通过") return true;
    if (action === "qualification.review" && data["审核结果"] === "通过")
      return [["批准服务类目", "申请服务类目"], ["批准覆盖社区", "申请覆盖社区"], ["批准覆盖小区", "申请覆盖小区"]]
        .some(([approved, requested]) => Array.isArray(data[approved]) && data[approved].length !== (record[requested] || []).length);
    return false;
  }
  if (action === "personnel.review" && name === "核验意见") return data["核验结论"] === "不认可";
  return false;
}
