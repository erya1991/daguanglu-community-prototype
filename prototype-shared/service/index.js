import { loadScenario } from "./scenarios.js";
import { fieldTables } from "./fields.js";
import { prepare as seed, SCENARIOS } from "./seed.js";
import { supplyCommand, saleability, methodFor, comboValid } from "./supply.js";
import {
  orderCommand,
  refreshOrder,
  currentArrangement,
  proposal,
  currentRound,
} from "./orders.js";
import { aftersaleCommand, businessTreatments } from "./aftersale.js";
import {
  fundCommand,
  syncOrder,
  splitIfReady,
  refund,
  fund,
  finish,
} from "./funds.js";
import {
  domain,
  list,
  need,
  value,
  actor,
  admin,
  resident,
  merchant,
  find,
  get,
  visible,
  clone,
  clock,
  day,
  append,
  revision,
  fundsFor,
  success,
  refundable,
  pendingRefund,
  activeAftersale,
  maskPhone,
  shopRecord,
  attachmentIds,
  authorizeAttachment,
  materialState,
  materialValid,
  TABLES,
  qualified,
  pointFor,
  qualificationFor,
} from "./common.js";
export { prepare } from "./seed.js";
export function accounts(s, ctx) {
  seed(s);
  const a = actor(s, ctx);
  const ids =
    a.app === "web"
      ? ["platform-admin", "property-admin", "service-web-limited"]
      : a.app === "merchant"
        ? ["merchant", "service-merchant-b"]
        : ["resident-a", "resident-b"];
  return s.accounts
    .filter((x) => ids.includes(x._id))
    .map((x) => ({
      id: x._id,
      name: x["人员姓名"],
      roles: list(x["授权角色"]).map((id) => ({
        id,
        name: s.roles.find((r) => r._id === id)?.["角色名称"] || id,
      })),
    }));
}
const action = (name, label, fields = [], defaults = {}) => ({
  name,
  label,
  fields,
  defaults,
});
function actions(s, a, t, r) {
  const ac = [];
  const add = (...v) => ac.push(action(...v));
  if (t === "qualifications") {
    if (a.role === "merchant") {
      if (r["申请状态"] !== "待审核")
        add("qualification.save", "编辑申请", ["26-C"]);
      if (["草稿", "已退回", "已撤回"].includes(r["申请状态"]))
        add("qualification.submit", "提交申请");
    }
    if (a.grant.review) {
      if (r["申请状态"] === "待审核")
        add("qualification.review", "审核经营申请", ["26-C"]);
      add(
        "qualification.status",
        r["服务经营有效性"] === "有效" ? "暂停资格" : "恢复资格",
        ["26-C"],
        { 状态: r["服务经营有效性"] === "有效" ? "暂停" : "恢复" },
      );
    }
  }
  if (t === "personnel" && a.role === "merchant") {
    add("personnel.save", "编辑人员", ["26-E"]);
    add(
      "personnel.status",
      r["人员状态"] === "启用" ? "停用人员" : "启用人员",
      ["26-E"],
      { 状态: r["人员状态"] === "启用" ? "停用" : "启用" },
    );
  }
  if (
    t === "personnel" &&
    a.grant.review &&
    a.grant.sensitive &&
    list(r["人员资质材料"]).length
  )
    add("personnel.review", "核验人员材料", ["26-D"]);
  if (["categories", "methods"].includes(t) && a.grant.config) {
    const k = t === "categories" ? "category" : "method",
      state = r[t === "categories" ? "类目状态" : "方式状态"];
    add(k + ".save", "编辑配置", ["27-A"]);
    add(k + ".status", state === "启用" ? "停用" : "启用", ["27-A"], {
      状态: state === "启用" ? "停用" : "启用",
    });
  }
  if (t === "services") {
    if (a.role === "merchant") {
      if (r["审核状态"] !== "待审核")
        add("service.save", "编辑服务", ["27-C", "27-D", "27-E"]);
      if (["草稿", "退回"].includes(r["审核状态"]))
        add("service.submit", "提交审核");
      if (r.approved && r["当前发布版本"] !== r["当前编辑版本"])
        add("service.publish", "发布已审核版本");
      if (r.published || r.approved)
        add(
          "service.status",
          r["上架状态"] === "已上架" ? "下架服务" : "上架服务",
          ["27-F"],
          { 状态: r["上架状态"] === "已上架" ? "已下架" : "已上架" },
        );
      add(
        "service.status",
        r["接收新预约状态"] === "暂停" ? "恢复接单" : "暂停接单",
        ["28-A"],
        { 状态: r["接收新预约状态"] === "暂停" ? "恢复接单" : "暂停接单" },
      );
    }
    if (a.grant.review && r["审核状态"] === "待审核")
      add("service.review", "审核供给", ["27-F"]);
    if (a.grant.manage) {
      add("service.status", "平台限制", ["27-F"], { 状态: "平台限制" });
      if (r["平台限制原因"])
        add("service.status", "解除限制", ["27-F"], { 状态: "解除限制" });
      add("service.status", "强制下架", ["27-F"], { 状态: "已下架" });
      add("service.status", "推荐展示", ["27-F"], { 状态: "推荐" });
    }
  }
  if (t === "orders") {
    const sale = activeAftersale(s, r),
      rework = sale?._id === r._reworkSale,
      open = r["结案结果"] === "进行中",
      blocked = !!sale && !rework;
    if (a.role === "resident") {
      if (open && ["待发起", "失败"].includes(r["支付状态"]))
        add("order.pay", "付款");
      if (open && !sale) add("order.cancel", "取消／申请取消", ["31-A"]);
      if (open && proposal(r) && !blocked)
        add("order.respond", "答复服务安排", ["28-B"]);
      if (
        open &&
        currentArrangement(r) &&
        r["履约状态"] === "未开始" &&
        !blocked
      )
        add("order.change", "申请调整时间", ["28-C"]);
      if (r["履约状态"] === "结果已提交" && !blocked)
        add("order.confirm", "确认履约结果", ["30-D"]);
      if (r["支付状态"] === "成功" && !sale)
        add("aftersale.apply", "申请售后", ["31-A"]);
      if (
        ["正常完成", "部分履行终止"].includes(r["结案结果"]) &&
        !domain(s).evaluations.some((e) => e._order === r._id)
      )
        add("evaluation.save", "评价服务", ["31-E"]);
    }
    if (a.role === "merchant" && open && !blocked) {
      if (r["支付状态"] === "成功" && r["接单状态"] === "待接单")
        add("order.accept", "接单并安排", ["28-B"]);
      if (r["接单状态"] === "已接单" && r["履约状态"] === "未开始")
        add(
          "order.arrange",
          currentArrangement(r) ? "提出新安排" : "安排服务",
          ["28-B", "28-C"],
        );
      if (r["安排状态"] === "已确认" && r["履约状态"] === "未开始")
        add(
          r._mode === "上门" ? "order.arrive" : "order.verify",
          r._mode === "上门" ? "记录到场" : "到点核验",
          [r._mode === "上门" ? "30-A" : "30-B"],
        );
      if (["已到场", "已到点"].includes(r["履约状态"]))
        add("order.start", "开始服务", ["30-A"]);
      if (r["履约状态"] === "服务中") {
        add("order.process", "追加过程", ["30-C"]);
        add("order.result", "提交服务结果", ["30-C"]);
      }
      if (r["履约状态"] === "结果已提交")
        add("order.result", "补充结果新版本", ["30-C"]);
      add("order.anomaly", "记录履约异常", ["30-E"]);
    }
  }
  if (t === "aftersales") {
    const currentRuling = [...(r.rulings || [])]
      .reverse()
      .find(
        (x) =>
          x["裁定有效状态"] === "生效" &&
          (x._issueVersion || 0) === (r._issueVersion || 0),
      );
    if (
      a.role === "merchant" &&
      ["待处理", "协商中", "待居民确认方案"].includes(r["售后状态"])
    )
      add("aftersale.plan", "提出处理方案", ["31-B"]);
    if (a.role === "resident" && r["售后状态"] === "待居民确认方案")
      add("aftersale.respond", "答复处理方案", ["31-B"]);
    if (
      ["merchant", "resident"].includes(a.role) &&
      !["已解决", "已撤回"].includes(r["售后状态"])
    )
      add("aftersale.evidence", "追加证据", ["31-C"]);
    if (
      a.role === "resident" &&
      ["待处理", "协商中", "待居民确认方案"].includes(r["售后状态"])
    )
      add("aftersale.withdraw", "撤回申请", ["31-C"]);
    if (
      a.grant.ruling &&
      !["已解决", "已撤回"].includes(r["售后状态"]) &&
      !r._refund &&
      (!currentRuling || currentRuling["执行状态"] === "待执行") &&
      !fundsFor(s, { _id: r._order }).some((f) =>
        ["处理中", "结果未知", "受阻"].includes(f["资金状态"]),
      )
    )
      add("aftersale.ruling", currentRuling ? "更正裁定结果" : "录入裁定结果", [
        "31-G",
      ]);
    if (a.grant.ruling && a.grant.sensitive && r.rulings?.length)
      add("aftersale.rulingNote", "追加裁定说明", ["31-C", "31-G"]);
    if (r["售后状态"] === "待执行" && (a.grant.ruling || a.role === "merchant"))
      add("aftersale.execute", "执行生效结果");
  }
  if (t === "evaluations" && a.grant.manage)
    add(
      "evaluation.status",
      r["评价展示状态"] === "显示" ? "限制展示" : "恢复展示",
      ["31-F"],
      { 状态: r["评价展示状态"] === "显示" ? "受限" : "显示" },
    );
  if (t === "funds") {
    const allowed =
      a.role === "merchant" ||
      (a.role === "resident" && ["支付", "退款"].includes(r["资金类型"])) ||
      a.grant.funds;
    if (
      allowed &&
      ["结果未知", "处理中", "失败", "受阻"].includes(r["资金状态"])
    )
      add("fund.query", "查询原请求");
    if (allowed && r["资金状态"] === "失败") add("fund.retry", "重试原请求");
    if (a.grant.funds) add("fund.note", "记录核查说明", ["32-F"]);
  }
  if (t === "exceptions" && a.grant.funds)
    add("fund.note", "记录核查说明", ["32-F"]);
  return ac;
}
function productAliases(s, a, t, r) {
  const put = (key, v) => {
    if (v !== undefined && v !== null && r[key] === undefined)
      r[key] = clone(v);
  };
  const historical = {
    qualifications: ["审核及监管历史"],
    personnel: ["变更历史"],
    categories: ["配置历史"],
    methods: ["配置历史"],
    services: ["审核及上下架历史"],
    orders: ["订单历史"],
    aftersales: ["处理历史"],
    evaluations: ["评价监管历史"],
    exceptions: ["异常核查历史"],
  };
  for (const key of historical[t] || []) put(key, r.history || []);
  if (["categories", "methods"].includes(t)) {
    const last = [...(r.history || [])].reverse().find((h) => h["原因说明"]);
    put("配置变更原因", last?.["原因说明"]);
  }
  if (t === "qualifications" && r["申请状态"] === "已通过") {
    put("批准服务类目", r["获准服务类目"]);
    put("批准覆盖社区", r["获准社区"]);
    put("批准覆盖小区", r["获准小区"]);
  }
  if (t === "services") {
    put("被审核服务编号", r["服务编号"]);
    put("被审核服务名称", r.submitted?.["服务名称"] || r["服务名称"]);
    put("历史版本", r.versions);
    put("审核轮次", list(r.versions).length);
    const valid = qualified(
      s,
      r._shop,
      (r.submitted || r.published || r)["所属服务类目"],
    );
    put("经营资格核验结果", valid ? "满足" : "不满足");
    put(
      "资格不满足原因",
      valid ? [] : ["当前主体、协议、类目或必要资质不满足"],
    );
    put(
      "受影响未完成订单数",
      domain(s).orders.filter(
        (o) => o._service === r._id && o["结案结果"] === "进行中",
      ).length,
    );
    const content = a.role === "resident" ? r : r.published || r,
      prices = list(content["服务规格集合"])
        .filter((x) => x["规格启用状态"] !== "停用")
        .flatMap((x) =>
          list(x["组合集合"])
            .filter((c) => c["组合启用状态"] !== "停用")
            .map((c) => Number(c["组合固定价格"])),
        )
        .filter(Number.isFinite);
    if (prices.length) r["当前展示价"] = Math.min(...prices).toFixed(2);
    put("价格摘要", r["当前展示价"] ? "¥" + r["当前展示价"] + "起" : undefined);
    put("适用履约方式", [
      ...new Set(
        list(content["服务规格集合"]).flatMap((x) =>
          list(x["组合集合"]).map((c) => c["组合履约方式名称"]),
        ),
      ),
    ]);
    put(
      "当前可售提示",
      saleability(s, find(s, "services", r._id)).join("；") || "可预约",
    );
    put("可售状态说明", r["当前可售提示"]);
    const switchEvent = [...(r.history || [])]
      .reverse()
      .find((h) =>
        h.changes?.some((c) => c["变更字段名称"] === "接收新预约状态"),
      );
    put("开关变更时间", switchEvent?.["记录时间"]);
  }
  if (t === "orders") {
    const snapshot = r["服务内容快照"] || {},
      spec = snapshot["规格"] || {},
      way = snapshot["方式"] || {};
    put("选定服务项目", r._service);
    put("选定服务规格", r._spec);
    put("选定履约方式", r["履约方式名称"]);
    put("方式说明", way["方式说明"]);
    put("规格包含内容", spec["包含内容"]);
    put("规格不包含内容", spec["不包含内容"]);
    put("期望时间信息", r["原始期望时间"]);
    put("规格方式固定价", r["订单应付金额"]);
    put("应付总金额", r["订单应付金额"]);
    put("约定版本", r["服务供给版本"]);
    put("收款主体名称", "青禾物业服务有限公司");
    put(r._mode === "上门" ? "上门服务地址" : "到点服务地点", r["地点快照"]);
    put("履约主体名称", r["经营主体名称"]);
    if (r["接单状态"] === "已接单") put("接单结果", "接单");
    if (r["接单状态"] === "已拒单") put("接单结果", "无法承接");
    put("安排变更历史", r.changes);
    put("居民确认状态", r["居民完成确认状态"]);
    if (r["居民完成确认状态"] === "已确认") put("居民结果答复", "确认完成");
    else if (r["居民完成确认状态"] === "有异议") put("居民结果答复", "有异议");
    const anomaly = r.anomalies?.[r.anomalies.length - 1];
    if (anomaly) for (const [k, v] of Object.entries(anomaly)) put(k, v);
    const change = r.changes?.[r.changes.length - 1];
    if (change) for (const [k, v] of Object.entries(change)) put(k, v);
  }
  if (t === "aftersales") {
    put("裁定历史", r.rulings);
    const note = r.rulingNotes?.[r.rulingNotes.length - 1];
    if (note) {
      r["追加说明"] = note["追加说明"];
      r["裁定依据附件"] = [
        ...(r["裁定依据附件"] || []),
        ...r.rulingNotes.flatMap((n) => n["裁定依据附件"] || []),
      ];
    }
    const extra = r.evidence?.[r.evidence.length - 1];
    if (extra) for (const [k, v] of Object.entries(extra)) put(k, v);
    const order = find(s, "orders", r._order);
    if (order?.["结案结果"] === "未服务取消")
      put("取消生效时间", order["结案时间"]);
    const current = r.rulings?.[r.rulings.length - 1];
    if (current) {
      r["执行状态"] =
        find(s, "aftersales", r._id)?.["执行状态"] || current["执行状态"];
      const refund = r.fundRecords?.find((f) => f._id === r._refund);
      put("执行结果说明", refund?.["退款结果说明"]);
    }
  }
  if (t === "funds") {
    const kind = r["资金类型"];
    put(
      kind === "支付"
        ? "支付处理历史"
        : kind === "分账"
          ? "分账历史"
          : kind === "回退"
            ? "回退处理历史"
            : "处理历史",
      r.history,
    );
    put("履约主体名称", r["经营主体名称"]);
    if (kind === "支付")
      put("支付关闭结果", find(s, "orders", r._order)?.["支付关闭结果"]);
    if (kind === "分账") put("渠道分账单号", r["渠道分账号"]);
    if (kind === "回退") {
      put("渠道回退单号", r["渠道回退号"]);
      put(
        "原退款业务单号",
        domain(s).funds.find((f) => f._dependency === r._id)?._id,
      );
    }
    if (kind === "退款") {
      const dependency = r._dependency ? find(s, "funds", r._dependency) : null;
      put(
        "退款资金准备结果",
        dependency
          ? dependency["资金状态"] === "成功"
            ? "回退已确认，资金准备就绪"
            : "等待原回退结果"
          : "原支付未分账，无需回退",
      );
      if (dependency) {
        put("原分账业务单号", dependency["原分账业务单号"]);
        put("回退业务单号", dependency._id);
        put("需回退金额", dependency["需回退金额"]);
        put("回退状态", dependency["资金状态"]);
        put("成功回退金额", dependency["成功回退金额"]);
      }
    }
  }
}
function project(s, a, t, row) {
  const r = clone(row);
  if (t === "services" && a.role === "resident") {
    Object.assign(r, clone(row.published));
    for (const spec of list(r["服务规格集合"])) {
      spec["组合集合"] = list(spec["组合集合"])
        .filter((c) => comboValid(s, c, r["所属服务类目"], row._shop))
        .map((c) => {
          const method = methodFor(s, c),
            current = {
              ...c,
              组合履约方式名称: method["履约方式名称"],
              组合流程模板: method["绑定流程模板"],
              方式版本: method["方式版本"],
              方式说明: method["履约方式说明"],
            };
          if (current["组合流程模板"] === "预约到点")
            current["可服务门店或服务点"] = list(
              c["可服务门店或服务点"],
            ).flatMap((p) => {
              const point = pointFor(s, row._shop, p);
              return point
                ? [
                    Object.fromEntries(
                      Object.entries(point).filter(([k]) => !k.startsWith("_")),
                    ),
                  ]
                : [];
            });
          return current;
        });
    }
    r["服务规格集合"] = list(r["服务规格集合"]).filter(
      (spec) =>
        spec["规格启用状态"] !== "停用" && list(spec["组合集合"]).length,
    );
    r["当前可售提示"] = saleability(s, row).join("；") || "可预约";
    r["可售状态说明"] = r["当前可售提示"];
    delete r.submitted;
    delete r.approved;
    delete r.versions;
    delete r.history;
    delete r["审核意见"];
    r.evaluations = domain(s)
      .evaluations.filter(
        (e) => e._service === r._id && e["评价展示状态"] === "显示",
      )
      .map((e) => ({
        总体评分: e["总体评分"],
        评价内容: e["评价内容"],
        评价图片: e["评价图片"],
        评价人公开名称: e["评价人公开名称"],
        评价时间: e["评价时间"],
      }));
  }
  if (t === "funds") {
    const order = find(s, "orders", r._order);
    if (order) {
      const summary = syncOrder(s, clone(order)),
        original = clone(r),
        names = fieldTables
          .find((t) => t.id === "32-C")
          .fields.map((f) => f.name);
      for (const name of names)
        if (summary[name] !== undefined) r[name] = summary[name];
      Object.assign(r, original);
    }
    if (r["资金类型"] === "支付") r["渠道成功付款时间"] = r["成功时间"] || null;
    if (r["资金类型"] === "退款")
      r["退款最近查询时间"] = r["最近查询时间"] || null;
    if (r["资金类型"] === "分账")
      r["分账最近查询时间"] = r["最近查询时间"] || null;
  }
  if (t === "orders") {
    refreshOrder(s, r);
    r.currentArrangement = clone(currentArrangement(r));
    r.proposal = clone(proposal(r));
    r.result = clone(r.results?.[r.results.length - 1] || null);
    r.rounds = (r.rounds || []).map((round) => ({
      ...round,
      ...(round.process?.[round.process.length - 1] || {}),
      ...(round.results?.[round.results.length - 1] || {}),
    }));
    r.currentAftersale = clone(activeAftersale(s, r) || null);
    r.aftersales = domain(s)
      .aftersales.filter(
        (sale) => sale._order === r._id && visible(s, a, "aftersales", sale),
      )
      .map((sale) => project(s, a, "aftersales", sale));
    r.fundRecords = fundsFor(s, r)
      .filter((f) => visible(s, a, "funds", f))
      .map((f) => project(s, a, "funds", f));
    r["当前安排"] = r.currentArrangement;
    r["当前安排提案"] = r.proposal;
    r["当前待确认结果版本"] = r.result?.["结果版本"] || null;
    r["当前有效安排"] = r.currentArrangement;
    r["当前结果"] = r.result;
    r["当前确认日期"] = r.currentArrangement?.["安排服务日期"] || "";
    r["当前确认开始时间"] = r.currentArrangement?.["安排开始时间"] || "";
    r["当前确认结束时间"] = r.currentArrangement?.["安排结束时间"] || "";
    if (r.credential) Object.assign(r, r.credential);
  }
  if (t === "personnel") {
    r["资质有效性"] = personnelValidity(s, r);
    const affected = domain(s).orders.filter(
      (o) =>
        o._shop === r._shop &&
        o["结案结果"] === "进行中" &&
        currentArrangement(o)?.["服务人员"] === r._id,
    );
    r["未完成安排数量"] = affected.length;
    r["受影响服务订单号"] = affected.map((o) => o["服务订单号"]);
  }
  if (t === "aftersales") {
    const o = find(s, "orders", r._order);
    if (o)
      r.handlingOptions = {
        plan: Object.fromEntries(
          ["全额退款", "部分退款", "补充履约", "不退款"].map((type) => [
            type,
            businessTreatments(o, type),
          ]),
        ),
        ruling: Object.fromEntries(
          ["全额退款", "部分退款", "继续或补充履约", "不予退款"].map((type) => [
            type,
            businessTreatments(o, type, true),
          ]),
        ),
      };
    r["已确认付款金额"] = o ? moneyValue(success(s, o, "支付")) : "0.00";
    r["已成功退款金额"] = o ? moneyValue(success(s, o, "退款")) : "0.00";
    r["在途退款占用金额"] = o ? moneyValue(pendingRefund(s, o)) : "0.00";
    r["本次可申请退款上限"] = o ? moneyValue(refundable(s, o)) : "0.00";
    r["剩余可退金额"] = r["本次可申请退款上限"];
    r.fundRecords = o
      ? fundsFor(s, o)
          .filter(
            (f) => f["关联售后编号"] === r._id && visible(s, a, "funds", f),
          )
          .map((f) => project(s, a, "funds", f))
      : [];
    if (r._refund) {
      const original = clone(r),
        refundRecord = r.fundRecords.find((f) => f._id === r._refund);
      if (refundRecord)
        for (const name of fieldTables
          .find((t) => t.id === "31-D")
          .fields.map((f) => f.name))
          if (refundRecord[name] !== undefined) r[name] = refundRecord[name];
    }
    if (r.plans?.length) Object.assign(r, r.plans[r.plans.length - 1]);
    if (r.rulings?.length) Object.assign(r, r.rulings[r.rulings.length - 1]);
  }
  productAliases(s, a, t, r);
  if (a.role === "resident") {
    for (const key of [
      "ruleSnapshot",
      "分账阻断原因",
      "分账接收主体名称",
      "服务商应结金额",
      "物业应得金额",
      "手续费金额",
      "手续费承担主体",
      "服务商累计实分金额",
      "服务商累计回退金额",
      "服务商净实分金额",
      "实结金额",
      "结算结果时间",
      "资金规则业务编号",
      "资金规则名称",
      "资金规则版本",
      "规则适用主体名称",
      "规则适用店铺名称",
      "规则适用业务",
      "分账业务条件",
    ])
      delete r[key];
    if (
      r.currentArrangement &&
      !["已接受"].includes(r.currentArrangement["安排状态"])
    )
      delete r.currentArrangement["服务人员工作联系电话"];
    if (r.proposal) delete r.proposal["服务人员工作联系电话"];
    if (r.rulings)
      r.rulings = r.rulings.map((x) => {
        const z = { ...x };
        delete z["裁定依据附件"];
        delete z["录入操作人"];
        return z;
      });
    delete r["裁定依据附件"];
    delete r["内部备注"];
    delete r["核实依据附件"];
    if (r.currentAftersale)
      r.currentAftersale = project(s, a, "aftersales", r.currentAftersale);
  }
  if (a.role === "merchant" && t === "aftersales") {
    delete r["裁定依据附件"];
    r.rulings = r.rulings?.map((x) => {
      const z = { ...x };
      delete z["裁定依据附件"];
      return z;
    });
  }
  if (a.app === "web" && !a.grant.sensitive) {
    for (const k of [
      "联系人电话",
      "工作联系电话",
      "经营联系电话",
      "服务人员工作联系电话",
    ])
      if (r[k]) r[k] = maskPhone(r[k]);
    delete r["人员资质材料"];
    delete r["服务资质材料"];
    delete r["裁定依据附件"];
  }
  r.history = (r.history || []).filter(
    (h) => !h._private || (a.app === "web" && a.grant.sensitive),
  );
  r._actions = actions(s, a, t, row);
  if (a.role === "resident")
    for (const ar of r.arrangements || [])
      if (ar["安排状态"] !== "已接受") delete ar["服务人员工作联系电话"];
  const privateField = (name) =>
    (name === "接收账户标识" &&
      !(
        a.role === "merchant" ||
        (a.app === "web" && a.grant.funds && a.grant.sensitive)
      )) ||
    (["渠道回退单号", "渠道回退号"].includes(name) &&
      !(a.app === "web" && a.grant.funds && a.grant.sensitive)) ||
    (/裁定依据/.test(name) &&
      !(a.app === "web" && a.grant.ruling && a.grant.sensitive)) ||
    (/核查依据/.test(name) &&
      !(a.app === "web" && a.grant.funds && a.grant.sensitive)) ||
    (/评价监管证据/.test(name) &&
      !(a.app === "web" && a.grant.manage && a.grant.sensitive));
  const scrub = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node))
      for (let i = node.length - 1; i >= 0; i--) {
        const name = node[i]?.["变更字段名称"];
        if (
          typeof name === "string" &&
          (privateField(name) ||
            (a.role === "resident" &&
              /应结|应得|实分|实结|分账|回退|手续费|资金规则|内部|资质|裁定依据|核查依据/.test(
                name,
              )) ||
            (a.role === "merchant" && /裁定依据|核查依据/.test(name)) ||
            (a.app === "web" &&
              !a.grant.sensitive &&
              /裁定依据|核查依据|资质材料|内部备注/.test(name)))
        ) {
          node.splice(i, 1);
        }
      }
    if (
      a.app === "web" &&
      !a.grant.sensitive &&
      /电话|联系号码/.test(node["变更字段名称"] || "")
    ) {
      for (const key of ["变更前值", "变更后值"])
        if (typeof node[key] === "string") node[key] = maskPhone(node[key]);
    }
    for (const key of Object.keys(node)) {
      if (
        privateField(key) ||
        ((a.role === "resident" ||
          a.role === "merchant" ||
          (a.app === "web" && !a.grant.sensitive)) &&
          ["裁定依据附件", "核查依据"].includes(key)) ||
        ((a.role === "resident" || (a.app === "web" && !a.grant.sensitive)) &&
          [
            "内部备注",
            "服务资质材料",
            "人员资质材料",
            "authorizationMaterials",
          ].includes(key))
      )
        delete node[key];
      else if (
        a.app === "web" &&
        !a.grant.sensitive &&
        /电话|联系号码/.test(key) &&
        typeof node[key] === "string"
      )
        node[key] = maskPhone(node[key]);
      else if (key === "材料有效性") node[key] = materialState(s, node);
      else scrub(node[key]);
    }
  };
  scrub(r);
  return r;
}
const moneyValue = (n) => (Number(n || 0) / 100).toFixed(2);
function inPeriod(v, start, end) {
  if (!v) return false;
  const d = String(v).slice(0, 10);
  return (!start || d >= start) && (!end || d <= end);
}
function personnelValidity(s, r) {
  const cats = list(r["可执行服务类目"]).filter(
    (id) => find(s, "categories", id)?.["人员证明是否必需"],
  );
  if (!cats.length) return "无专项要求";
  const states = cats.map((cat) => {
    const proofs = list(r["人员资质材料"]).filter((m) =>
      list(m["对应服务类目"]).includes(cat),
    );
    return proofs.some((m) => materialValid(s, m))
      ? "有效"
      : !proofs.length || proofs.some((m) => m["核验结论"] !== "认可")
        ? "待核实"
        : "已失效";
  });
  return states.every((v) => v === "有效")
    ? "有效"
    : states.includes("待核实")
      ? "待核实"
      : "已失效";
}
function filterRows(s, a, t, filters = {}) {
  let rows = domain(s)[t] || [];
  rows = rows.filter((r) => visible(s, a, t, r));
  if (a.role === "resident" && t === "services")
    rows = rows.filter((r) => saleability(s, r).length === 0);
  const shop = value(
    filters,
    "merchant",
    "经营店铺筛选",
    "经营店铺",
    "服务商筛选",
  );
  if (shop) rows = rows.filter((r) => r._shop === shop);
  const projectId = value(filters, "service", "服务项目筛选");
  if (projectId)
    rows = rows.filter((r) => r._service === projectId || r._id === projectId);
  const keyword = value(
    filters,
    "keyword",
    "搜索关键词",
    "服务关键词",
    "服务名称关键词",
    "商户关键词",
    "人员姓名",
    "服务订单号筛选",
    "资金单据号筛选",
    "售后编号筛选",
    "配置名称关键词",
  );
  if (keyword)
    rows = rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(String(keyword).toLowerCase()),
    );
  for (const [filter, key] of [
    ["审核状态筛选", "审核状态"],
    ["上架状态筛选", "上架状态"],
    ["业务进度筛选", "当前业务进度"],
    ["支付状态筛选", "支付状态"],
    ["售后状态筛选", "售后状态"],
    ["人员状态", "人员状态"],
  ])
    if (filters[filter]) rows = rows.filter((r) => r[key] === filters[filter]);
  for (const [filter, key] of [
    ["申请状态", "申请状态"],
    ["资格有效性", "服务经营有效性"],
    ["售后类型筛选", "申请类型"],
    ["售后状态筛选", "售后状态"],
    ["评分筛选", "总体评分"],
    ["退款状态筛选", "退款状态"],
    ["分账状态筛选", "分账状态"],
    ["回退状态筛选", "回退状态"],
  ])
    if (filters[filter] !== undefined && filters[filter] !== "")
      rows = rows.filter((r) => String(r[key]) === String(filters[filter]));
  if (filters["履约方式筛选"]) {
    const method = domain(s).methods.find(
      (m) =>
        m._id === filters["履约方式筛选"] ||
        m["履约方式名称"] === filters["履约方式筛选"],
    );
    rows = rows.filter((r) => {
      const combos =
        t === "services"
          ? list((r.published || r)["服务规格集合"]).flatMap((sp) =>
              list(sp["组合集合"]),
            )
          : [r._combo];
      return (
        combos.some(
          (c) =>
            c &&
            methodFor(s, c)?._id === (method?._id || filters["履约方式筛选"]),
        ) || r["履约方式名称"] === filters["履约方式筛选"]
      );
    });
  }
  if (filters["人员资质有效性"] && t === "personnel")
    rows = rows.filter(
      (r) => personnelValidity(s, r) === filters["人员资质有效性"],
    );
  const cat = value(
    filters,
    "category",
    "服务类目",
    "服务类目筛选",
    "服务类目选择",
  );
  if (list(cat).length)
    rows = rows.filter((r) =>
      list(
        r[
          t === "qualifications"
            ? filters["申请状态"]
              ? "申请服务类目"
              : "获准服务类目"
            : t === "personnel"
              ? "可执行服务类目"
              : "所属服务类目"
        ] || r._category,
      ).some((x) => list(cat).includes(x)),
    );
  for (const [filter, keys] of [
    ["覆盖社区", ["获准社区", "申请覆盖社区", "上门覆盖社区", "_community"]],
    ["覆盖小区", ["获准小区", "申请覆盖小区", "上门覆盖小区", "_estate"]],
  ])
    if (list(filters[filter]).length)
      rows = rows.filter((r) =>
        keys
          .flatMap((k) => list(r[k]))
          .some((x) => list(filters[filter]).includes(x)),
      );
  const phoneFilter = value(filters, "人员联系电话", "联系人电话筛选");
  if (phoneFilter) {
    need(
      a.role === "merchant" || (a.app === "web" && a.grant.sensitive),
      "当前身份没有联系电话检索权限",
    );
    rows = rows.filter((r) =>
      String(r["工作联系电话"] || r["联系人电话"] || "").includes(
        String(phoneFilter),
      ),
    );
  }
  if (filters["联系人姓名筛选"])
    rows = rows.filter((r) =>
      String(r["联系人姓名"] || "").includes(filters["联系人姓名筛选"]),
    );
  if (filters["配置启用状态筛选"])
    rows = rows.filter(
      (r) => (r["类目状态"] || r["方式状态"]) === filters["配置启用状态筛选"],
    );
  if ([true, "是", "true", 1].includes(filters["仅看异常"]))
    rows = rows.filter(
      (r) =>
        t === "exceptions" ||
        ["失败", "结果未知", "受阻"].includes(r["资金状态"]) ||
        (r["金额差异"] !== undefined &&
          r["金额差异"] !== null &&
          Number(r["金额差异"]) !== 0),
    );
  if (filters["平台限制筛选"])
    rows = rows.filter((r) =>
      ["受限", "已限制", "限制"].includes(filters["平台限制筛选"])
        ? !!r["平台限制原因"]
        : !r["平台限制原因"],
    );
  if (filters["评价项目筛选"])
    rows = rows.filter(
      (r) =>
        r._service === filters["评价项目筛选"] ||
        r["服务项目名称"] === filters["评价项目筛选"],
    );
  if (filters["评价订单号筛选"])
    rows = rows.filter((r) =>
      String(r["关联服务订单号"] || "").includes(filters["评价订单号筛选"]),
    );
  const explicitRanges = [
    ["申请开始日期", "申请结束日期", "申请时间"],
    ["创建开始日期", "创建结束日期", "创建时间"],
    ["评价开始日期", "评价结束日期", "评价时间"],
  ];
  for (const [startKey, endKey, timeKey] of explicitRanges)
    if (filters[startKey] || filters[endKey])
      rows = rows.filter((r) =>
        inPeriod(r[timeKey], filters[startKey], filters[endKey]),
      );
  const arrDay = value(filters, "确认服务日期筛选", "安排查询日期");
  if (arrDay && t === "orders")
    rows = rows.filter(
      (r) => currentArrangement(r)?.["安排服务日期"] === arrDay,
    );
  const staff = value(filters, "服务人员筛选");
  if (staff && t === "orders")
    rows = rows.filter((r) => currentArrangement(r)?.["服务人员"] === staff);
  if (filters.metric) rows = metricRows(s, rows, t, filters.metric, filters, a);
  else if (
    filters.start ||
    filters.end ||
    filters["查询开始日期"] ||
    filters["查询结束日期"]
  ) {
    const start = filters.start || filters["查询开始日期"],
      end = filters.end || filters["查询结束日期"],
      basis = filters["时间口径"] || "";
    if (basis && ["funds", "exceptions"].includes(t)) {
      const desired = /退款/.test(basis)
        ? "退款"
        : /回退/.test(basis)
          ? "回退"
          : /分账/.test(basis)
            ? "分账"
            : /支付|付款/.test(basis)
              ? "支付"
              : null;
      const successBasis = /成功/.test(basis),
        created = /创建|发起|发生/.test(basis);
      need(successBasis || created, "该资金明细时间口径不适用");
      rows = rows.filter((r) => {
        const fact = t === "exceptions" ? find(s, "funds", r._fund) : r;
        if (!fact) return false;
        if (desired && fact["资金类型"] !== desired) return false;
        if (successBasis && fact["资金状态"] !== "成功") return false;
        return inPeriod(
          fact[successBasis ? "成功时间" : created ? "发生时间" : "创建时间"],
          start,
          end,
        );
      });
    } else {
      const key =
        t === "funds"
          ? "成功时间"
          : t === "aftersales"
            ? "申请时间"
            : "创建时间";
      rows = rows.filter((r) => inPeriod(r[key], start, end));
    }
  }
  return rows;
}
function metricRows(s, rows, t, metric, f, a) {
  const start = f.start || f["查询开始日期"],
    end = f.end || f["查询结束日期"];
  if (t === "funds") {
    if (metric === "期间净收款")
      return rows.filter(
        (r) =>
          ["支付", "退款"].includes(r["资金类型"]) &&
          r["资金状态"] === "成功" &&
          inPeriod(r["成功时间"], start, end),
      );
    const type = metric.includes("退款")
      ? "退款"
      : metric.includes("回退")
        ? "回退"
        : metric.includes("分账")
          ? "分账"
          : "支付";
    return rows.filter(
      (r) =>
        r["资金类型"] === type &&
        r["资金状态"] === "成功" &&
        inPeriod(r["成功时间"], start, end),
    );
  }
  if (metric === "当前待接单数")
    return rows.filter(
      (o) =>
        o["支付状态"] === "成功" &&
        o["接单状态"] === "待接单" &&
        o["结案结果"] === "进行中",
    );
  if (metric === "当前待安排数")
    return rows.filter(
      (o) =>
        o["接单状态"] === "已接单" &&
        o["安排状态"] === "待商家安排" &&
        o["结案结果"] === "进行中",
    );
  if (metric === "当前售后待处理数")
    return rows.filter((o) => {
      const sale = activeAftersale(s, o);
      if (!sale || !a) return false;
      const responsibility =
        sale["售后状态"] === "待执行"
          ? ["aftersale.execute"]
          : ["待处理", "协商中"].includes(sale["售后状态"])
            ? ["aftersale.plan", "aftersale.ruling"]
            : [];
      return actions(s, a, "aftersales", sale).some((action) =>
        responsibility.includes(action.name),
      );
    });
  if (metric === "已确认服务安排数")
    return rows.filter(
      (o) =>
        currentArrangement(o)?.["安排服务日期"] === (f.serviceDate || day(s)) &&
        o["结案结果"] === "进行中",
    );
  if (metric === "付款成功订单数")
    return rows.filter((o) =>
      fundsFor(s, o, "支付").some(
        (x) => x["资金状态"] === "成功" && inPeriod(x["成功时间"], start, end),
      ),
    );
  if (metric === "正常完成订单数")
    return rows.filter(
      (o) =>
        o["结案结果"] === "正常完成" && inPeriod(o["居民确认时间"], start, end),
    );
  if (metric === "未服务取消订单数")
    return rows.filter(
      (o) =>
        o["结案结果"] === "未服务取消" && inPeriod(o["结案时间"], start, end),
    );
  if (metric === "部分履行终止订单数")
    return rows.filter(
      (o) =>
        o["结案结果"] === "部分履行终止" && inPeriod(o["结案时间"], start, end),
    );
  return rows.filter((o) => inPeriod(o["创建时间"], start, end));
}
export function query(s, ctx, table, filters = {}) {
  seed(s);
  const a = actor(s, ctx);
  need(TABLES.includes(table), "未知服务业务表");
  return filterRows(s, a, table, filters).map((r) => project(s, a, table, r));
}
export function record(s, ctx, table, key) {
  seed(s);
  const a = actor(s, ctx);
  return project(s, a, table, get(s, a, table, key));
}
export function options(s, ctx) {
  seed(s);
  const a = actor(s, ctx);
  return {
    actor: a,
    clock: clock(s),
    today: day(s),
    scenario: domain(s).scenario,
    ruleVersion: domain(s).ruleVersion || "DEMO-ALLOC-V1",
    merchants: domain(s)
      .merchants.filter((m) => a.role !== "merchant" || m._id === a.shop)
      .map((m) => ({
        _id: m._id,
        value: m._id,
        label: m["经营店铺名称"],
        经营店铺名称: m["经营店铺名称"],
        商户名称: m["商户名称"],
      })),
    categories: domain(s)
      .categories.filter(
        (x) => a.role !== "resident" || x["类目状态"] === "启用",
      )
      .map((x) =>
        a.role === "resident"
          ? {
              _id: x._id,
              value: x._id,
              label: x["类目名称"],
              类目名称: x["类目名称"],
              上级类目: x["上级类目"],
            }
          : { ...x, value: x._id, label: x["类目名称"] },
      ),
    methods: domain(s)
      .methods.filter((x) => a.role !== "resident" || x["方式状态"] === "启用")
      .map((x) =>
        a.role === "resident"
          ? {
              _id: x._id,
              value: x._id,
              label: x["履约方式名称"],
              履约方式名称: x["履约方式名称"],
              绑定流程模板: x["绑定流程模板"],
            }
          : { ...x, value: x._id, label: x["履约方式名称"] },
      ),
    points:
      a.role === "resident"
        ? []
        : list(domain(s).points)
            .filter(
              (p) =>
                p["地点状态"] === "启用" &&
                (a.role === "merchant"
                  ? p._shop === a.shop
                  : visible(s, a, "services", p)),
            )
            .map((p) => ({
              ...clone(p),
              value: p["地点业务编号"],
              label: p["地点名称"],
            })),
    approvedCommunities:
      a.role === "merchant"
        ? s.communities
            .filter((c) =>
              list(qualificationFor(s, a.shop)?.["获准社区"]).includes(c._id),
            )
            .map((c) => ({ value: c._id, label: c["社区名称"] }))
        : [],
    approvedEstates:
      a.role === "merchant"
        ? s.estates
            .filter((e) =>
              list(qualificationFor(s, a.shop)?.["获准小区"]).includes(e._id),
            )
            .map((e) => ({
              value: e._id,
              label: e["小区名称"],
              community: e["所属社区"],
            }))
        : [],
    personnel: domain(s)
      .personnel.filter((r) => visible(s, a, "personnel", r))
      .map((x) => ({
        ...project(s, a, "personnel", x),
        value: x._id,
        label: x["姓名"],
      })),
    services: filterRows(s, a, "services").map((x) => ({
      ...project(s, a, "services", x),
      value: x._id,
      label: x["服务名称"],
    })),
    communities: s.communities.map((x) => ({
      value: x._id,
      label: x["社区名称"],
    })),
    estates: s.estates.map((x) => ({
      value: x._id,
      label: x["小区名称"],
      community: x["所属社区"],
    })),
    scenarios: SCENARIOS.map((name) => ({ id: name, name, label: name })),
    fieldTables,
    dictionaries: {
      审核结果: ["通过", "退回修改"],
      资格有效性: ["未获准", "有效", "受限"],
      人员资质有效性: ["有效", "待核实", "已失效", "无专项要求"],
      审核状态筛选: ["草稿", "待审核", "通过", "退回"],
      上架状态筛选: ["未上架", "已上架", "已下架"],
      平台限制筛选: ["无限制", "受限"],
      业务进度筛选: [
        "待付款",
        "待接单",
        "待安排",
        "待居民确认安排",
        "已确认安排",
        "服务中",
        "待居民确认完成",
        "售后处理中",
        "正常完成",
        "未服务取消",
        "部分履行终止",
        "未支付关闭",
      ],
      售后类型筛选: ["核实取消", "申请退款", "服务问题"],
      售后状态筛选: [
        "待处理",
        "协商中",
        "待居民确认方案",
        "待执行",
        "执行中",
        "已解决",
        "已拒绝",
        "已撤回",
      ],
      支付状态筛选: ["待发起", "处理中", "成功", "失败", "结果未知", "已关闭"],
      退款状态筛选: ["待发起", "处理中", "成功", "失败", "结果未知", "受阻"],
      分账状态筛选: [
        "待条件",
        "待处理",
        "处理中",
        "成功",
        "失败",
        "结果未知",
        "受阻",
      ],
      回退状态筛选: ["待发起", "处理中", "成功", "失败", "结果未知", "受阻"],
      评分筛选: [1, 2, 3, 4, 5],
      裁定结果: ["全额退款", "部分退款", "继续或补充履约", "不予退款"],
      方案处理类型: ["全额退款", "部分退款", "补充履约", "不退款"],
      居民方案答复: ["同意", "不同意"],
      居民安排答复: ["接受", "希望调整"],
      服务结果: ["全部完成", "部分完成", "未完成"],
      居民结果答复: ["确认完成", "有异议"],
      绑定流程模板: ["上门", "预约到点"],
      期望时间选择: ["指定日期", "时间可协商"],
      期望时段偏好: ["上午", "下午", "不限"],
      人员状态: ["启用", "停用"],
      状态: ["启用", "停用"],
      接单结果: ["接单", "无法承接"],
    },
  };
}
export function overview(s, ctx, filters = {}) {
  seed(s);
  const a = actor(s, ctx);
  need(a.role !== "resident", "经营查询仅向本商户及授权Web开放");
  const context = {
      merchant: value(filters, "merchant", "经营店铺筛选", "服务商筛选"),
      service: value(filters, "service", "服务项目筛选"),
      category: value(filters, "category", "服务类目筛选"),
    },
    rows = filterRows(s, a, "orders", context),
    funds = filterRows(s, a, "funds", context),
    f = {
      ...context,
      start: filters.start || filters["查询开始日期"] || "2026-11-01",
      end: filters.end || filters["查询结束日期"] || "2026-11-06",
      serviceDate: filters.serviceDate || "2026-11-07",
    },
    metrics = [];
  for (const name of [
    "创建订单数",
    "付款成功订单数",
    "已确认服务安排数",
    "正常完成订单数",
    "未服务取消订单数",
    "部分履行终止订单数",
    "当前待接单数",
    "当前待安排数",
    "当前售后待处理数",
  ])
    metrics.push({
      name,
      value: metricRows(s, rows, "orders", name, f, a).length,
      basis: name.startsWith("当前")
        ? "当前状态"
        : name === "已确认服务安排数"
          ? "当前有效安排的服务日"
          : "对应业务事实发生时间",
      table: "orders",
      filters: { ...f, metric: name },
    });
  for (const name of [
    "期间支付成功金额",
    "期间退款成功金额",
    "期间分账成功金额",
    "期间回退成功金额",
  ])
    metrics.push({
      name,
      value: moneyValue(
        metricRows(s, funds, "funds", name, f, a).reduce(
          (n, r) => n + r._amount,
          0,
        ),
      ),
      basis: "对应资金成功时间",
      table: "funds",
      filters: { ...f, metric: name },
    });
  const total = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  total["期间净收款"] = (
    Number(total["期间支付成功金额"]) - Number(total["期间退款成功金额"])
  ).toFixed(2);
  metrics.push({
    name: "期间净收款",
    value: total["期间净收款"],
    basis: "本期支付成功额减本期退款成功额，允许负数",
    table: "funds",
    filters: { ...f, metric: "期间净收款" },
  });
  return {
    metrics,
    values: total,
    ...total,
    数据更新时间: clock(s),
    period: f,
  };
}
export function command(s, ctx, name, p = {}) {
  seed(s);
  const a = actor(s, ctx),
    d = domain(s);
  const key = p.operationId ? a._id + ":" + name + ":" + p.operationId : null;
  if (key && d.operations[key]) {
    const cached = d.operations[key];
    const r = find(s, cached.table, cached.id);
    need(r && visible(s, a, cached.table, r), "记录不存在或无权访问");
    return {
      ...cached,
      record: project(s, a, cached.table, r),
      replayed: true,
    };
  }
  need(d.outcomes.save !== "failure", "保存失败，输入已保留");
  const work = clone(s),
    wa = actor(work, ctx);
  const result = name.startsWith("order.")
    ? orderCommand(work, wa, name, p)
    : name.startsWith("aftersale.") || name.startsWith("evaluation.")
      ? aftersaleCommand(work, wa, name, p)
      : name.startsWith("fund.")
        ? fundCommand(work, wa, name, p)
        : supplyCommand(work, wa, name, p);
  need(result, "未知便民服务动作");
  const out = {
    id: result.r._id,
    table: result.table,
    message: result.message || "办理已保存",
  };
  if (key) domain(work).operations[key] = clone(out);
  const previous = p.id ? find(s, result.table, p.id) : null;
  if (previous && result.r.history?.length > previous.history?.length) {
    const productNames = new Set(
      fieldTables.flatMap((t) => t.fields.map((f) => f.name)),
    );
    const changes = Object.keys(result.r)
      .filter(
        (k) =>
          productNames.has(k) &&
          JSON.stringify(previous[k]) !== JSON.stringify(result.r[k]),
      )
      .map((k) => ({
        变更字段名称: k,
        变更前值: clone(previous[k] ?? null),
        变更后值: clone(result.r[k] ?? null),
      }));
    result.r.history[result.r.history.length - 1].changes = changes;
  }
  const projection = project(work, wa, result.table, result.r);
  s.service = work.service;
  s.attachments = work.attachments;
  return { ...out, record: projection };
}
export function reset(s, ctx, removeBlob = () => {}) {
  seed(s);
  actor(s, ctx);
  for (const [key, f] of Object.entries(s.attachments || {}))
    if (f.stage02) {
      removeBlob(key);
      delete s.attachments[key];
    }
  for (const key of Object.keys(s.drafts || {}))
    if (key.includes(":service:") || key.startsWith("service:"))
      delete s.drafts[key];
  delete s.service;
  seed(s);
  return true;
}
export function auxiliary(s, ctx, name, p = {}) {
  seed(s);
  actor(s, ctx);
  if (name === "mode") {
    need(
      ["payment", "refund", "split", "rollback", "save", "upload"].includes(
        p.kind,
      ) && ["normal", "failure", "unknown", "pending"].includes(p.outcome),
      "未知辅助返回类型",
    );
    domain(s).outcomes[p.kind] = p.outcome;
    return {
      message: "仅切换后续合法请求的演示返回",
      outcomes: clone(domain(s).outcomes),
    };
  }
  if (name === "rule-version") {
    need(
      ["DEMO-ALLOC-V1", "DEMO-ALLOC-V2"].includes(p.version),
      "未知演示返回版本",
    );
    domain(s).ruleVersion = p.version;
    return {
      ruleVersion: p.version,
      message: "仅后续新订单使用此演示快照版本，原记录保留",
    };
  }
  if (name === "clock") {
    need(Number.isFinite(Date.parse(p.time)), "场景时间无效");
    domain(s).clock = p.time;
    return { clock: clock(s) };
  }
  if (name === "scenario") {
    need(SCENARIOS.includes(p.name), "未知服务场景");
    reset(s, ctx);
    domain(s).scenario = p.name;
    loadScenario(s, p.name);
    for (const order of domain(s).orders) refreshOrder(s, order);
    return {
      scenario: p.name,
      message: "已复位当前会话便民服务场景，其他阶段保留",
    };
  }
  need(false, "未知辅助动作");
}
export function attachmentId(s, ctx, p = {}) {
  seed(s);
  return authorizeAttachment(s, actor(s, ctx), p.attachmentId || p.id, p);
}
