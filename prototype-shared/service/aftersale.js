import {
  domain,
  list,
  need,
  value,
  required,
  fen,
  money,
  get,
  find,
  revision,
  create,
  append,
  clock,
  clone,
  id,
  resident,
  merchant,
  admin,
  activeAftersale,
  refundable,
  success,
  pendingRefund,
  fundsFor,
  auditEvidence,
  pickInput,
} from "./common.js";
import { refund, syncOrder } from "./funds.js";
const types = [
  "全额退款",
  "部分退款",
  "补充履约",
  "不退款",
  "继续或补充履约",
  "不予退款",
  "同意取消",
];
function normalize(t) {
  return t === "同意取消"
    ? "全额退款"
    : t === "继续或补充履约"
      ? "补充履约"
      : t === "不予退款"
        ? "不退款"
        : t;
}
export function businessTreatments(o, result, ruling = false) {
  const type = normalize(result),
    completed =
      o["结案结果"] === "正常完成" && o["居民完成确认状态"] === "已确认",
    started = list(o.rounds).some((r) => r["开始记录时间"]);
  if (type === "补充履约")
    return ruling ? ["继续／补充履约"] : ["继续履约／补充履约"];
  if (completed)
    return ruling ? ["完成后售后解决", "保留原状态"] : ["完成后售后解决"];
  if (type === "全额退款") return [started ? "部分履行终止" : "未服务取消"];
  if (type === "部分退款")
    return started
      ? ruling
        ? ["部分履行终止", "保留原状态"]
        : ["部分履行终止", "继续履约"]
      : [];
  if (type === "不退款") return ruling ? ["保留原状态"] : ["继续履约"];
  return [];
}
function treatment(s, o, data, result, ruling = false) {
  const key = ruling ? "裁定后业务处理" : "业务结案方式";
  required(data, [key]);
  const canonical =
    normalize(result) === "补充履约" && value(data, key) === "继续履约"
      ? ruling
        ? "继续／补充履约"
        : "继续履约／补充履约"
      : value(data, key);
  need(
    businessTreatments(o, result, ruling).includes(canonical),
    "后续业务处理与当前服务阶段或处理结果不匹配",
    { [key]: "请按当前履约阶段选择允许的处理方式" },
  );
  data[key] = canonical;
  return canonical;
}
export function executeSale(s, a, sale, o) {
  need(sale["售后状态"] === "待执行", "当前没有可执行的有效方案");
  const ruling = [...(sale.rulings || [])]
      .reverse()
      .find(
        (r) =>
          r["裁定有效状态"] === "生效" &&
          (r._issueVersion || 0) === (sale._issueVersion || 0),
      ),
    plan = ruling || sale.plans[sale.plans.length - 1];
  need(plan, "缺少执行依据");
  const type = normalize(ruling ? plan["裁定结果"] : plan["方案处理类型"]);
  const handling = treatment(s, o, plan, type, !!ruling);
  if (type === "全额退款" || type === "部分退款") {
    const amount =
      type === "全额退款"
        ? refundable(s, o)
        : fen(
            ruling ? plan["裁定退款金额"] : plan["拟退款金额"],
            "拟退款金额",
            true,
          );
    need(amount <= refundable(s, o), "退款金额超过最新可退额度");
    const f = refund(
      s,
      a,
      o,
      amount,
      "AFTERSALE:" +
        sale._id +
        ":" +
        (ruling ? "R" + plan["裁定版本"] : "P" + plan["方案版本"]),
      sale._id,
    );
    sale._refund = f._id;
    sale["关联退款单号"] = f._id;
    sale["售后状态"] = f["资金状态"] === "成功" ? "已解决" : "执行中";
    sale["执行状态"] =
      f["资金状态"] === "成功"
        ? "执行完成"
        : f["资金状态"] === "受阻"
          ? "受阻"
          : "执行中";
    if (["未服务取消", "部分履行终止"].includes(handling)) {
      o["结案结果"] = handling;
      o["结案时间"] = clock(s);
      if (handling === "未服务取消") {
        o["取消生效时间"] = clock(s);
        sale["取消生效时间"] = clock(s);
      }
      o["履约状态"] = "已终止";
      o["安排状态"] = "已终止";
      o["当前有效安排编号"] = "";
      if (o.credential) o.credential["凭证状态"] = "已失效";
    }
    if (f["资金状态"] === "成功") sale["售后结案时间"] = clock(s);
  } else if (type === "补充履约") {
    const content = value(plan, "继续或补充履约内容", "补充履约内容");
    need(content, "请填写继续或补充履约内容");
    for (const r of o.rounds)
      if (r["本轮履约状态"] !== "已确认") r["本轮履约状态"] = "已终止";
    for (const r of o.arrangements)
      if (["待确认", "已接受"].includes(r["安排状态"]))
        r["安排状态"] = "已替代";
    o._reworkSale = sale._id;
    o["结案结果"] = "进行中";
    o["结案时间"] = "";
    o["接单状态"] = "已接单";
    o["当前有效安排编号"] = "";
    o["安排状态"] = "待商家安排";
    o["履约状态"] = "未开始";
    o["居民完成确认状态"] = "待确认";
    if (o.credential) o.credential["凭证状态"] = "已失效";
    sale["售后状态"] = "执行中";
    sale["执行状态"] = "执行中";
    sale["关联履约轮次"] = o.rounds.length + 1;
    sale["补充履约内容"] = content;
  } else {
    sale["售后状态"] = "已解决";
    sale["执行状态"] = "执行完成";
    sale["售后结案时间"] = clock(s);
    sale["售后结案说明"] =
      value(plan, "裁定说明", "方案说明") ||
      "已记录不予退款结论，原履约和居民确认事实保持不变";
  }
  if (sale["售后状态"] === "已解决" && !sale["售后结案说明"])
    sale["售后结案说明"] = value(plan, "裁定说明", "方案说明") || "";
  o["售后状态"] = sale["售后状态"];
  if (ruling) {
    ruling["执行状态"] = sale["执行状态"];
    ruling["关联退款单号"] = sale["关联退款单号"] || "";
    ruling["关联履约轮次"] = sale["关联履约轮次"] || "";
  }
  syncOrder(s, o);
  append(s, a, sale, "执行售后结果", sale["售后结案说明"] || type);
}
export function aftersaleCommand(s, a, name, p) {
  const d = pickInput(
    p.data || {},
    {
      apply: [
        "申请类型",
        "申请原因",
        "申请退款金额",
        "期望解决方式",
        "问题说明",
        "问题证据",
      ],
      plan: [
        "方案处理类型",
        "方案说明",
        "取消核实结果",
        "服务是否已实际开始",
        "核实依据说明",
        "核实依据附件",
        "拟退款金额",
        "金额依据说明",
        "补充履约内容",
        "业务结案方式",
      ],
      respond: ["方案版本", "居民方案答复", "居民方案答复说明"],
      evidence: ["追加说明", "追加证据"],
      withdraw: ["撤回原因"],
      ruling: [
        "裁定结果",
        "裁定退款金额",
        "继续或补充履约内容",
        "裁定后业务处理",
        "裁定说明",
        "裁定依据附件",
        "裁定作出人",
        "裁定作出时间",
        "更正原因",
      ],
      rulingNote: ["追加说明", "裁定依据附件"],
      execute: [],
    }[name.split(".")[1]] || [],
  );
  if (name === "aftersale.apply") {
    resident(a);
    const o = get(s, a, "orders", p.id);
    revision(o, p);
    need(success(s, o, "支付") > 0, "付款尚未成功，不进入已付款售后");
    need(!activeAftersale(s, o), "本单已有进行中售后，请在原记录补证或办理");
    required(d, ["申请类型", "申请原因"]);
    const amount =
      d["申请退款金额"] === undefined || d["申请退款金额"] === ""
        ? refundable(s, o)
        : fen(d["申请退款金额"], "申请退款金额");
    need(amount <= refundable(s, o), "申请退款金额超过当前可退上限");
    auditEvidence(s, a, d, ["问题证据"], o);
    const sale = create(
      s,
      a,
      "aftersales",
      {
        _shop: o._shop,
        _resident: o._resident,
        _order: o._id,
        售后编号: "",
        原服务订单号: o["服务订单号"],
        服务项目名称: o["服务项目名称"],
        服务规格名称: o["服务规格名称"],
        履约方式名称: o["履约方式名称"],
        ...d,
        申请退款金额: money(amount),
        申请时服务阶段: o["履约状态"],
        申请人: a.name,
        申请时间: clock(s),
        售后状态: "待处理",
        方案版本: 0,
        plans: [],
        rulings: [],
        evidence: [],
      },
      "SALE",
    );
    sale["售后编号"] = sale._id;
    o["售后状态"] = "待处理";
    o["当前业务进度"] = "售后处理中";
    append(s, a, sale, "申请售后", d["申请原因"]);
    append(s, a, o, "新增售后申请", sale._id);
    return { table: "aftersales", r: sale };
  }
  if (name.startsWith("evaluation.")) return evaluationCommand(s, a, name, p);
  const sale = get(s, a, "aftersales", p.id),
    o = get(s, a, "orders", sale._order);
  revision(sale, p);
  if (name === "aftersale.plan") {
    merchant(a);
    need(
      ["待处理", "协商中", "待居民确认方案", "已拒绝"].includes(
        sale["售后状态"],
      ),
      "当前售后不可提出新方案",
    );
    required(d, ["方案处理类型", "方案说明"]);
    need(types.includes(d["方案处理类型"]), "方案处理类型无效");
    let type = normalize(d["方案处理类型"]);
    if (sale["申请类型"] === "核实取消") {
      required(d, ["取消核实结果", "服务是否已实际开始", "核实依据说明"]);
      if ([true, "是"].includes(d["服务是否已实际开始"]))
        need(
          type !== "全额退款" || o.rounds.some((r) => r["开始记录时间"]),
          "核实事实与履约记录冲突",
        );
      if (d["取消核实结果"] === "同意取消") type = "全额退款";
    }
    if (type === "部分退款") {
      required(d, ["拟退款金额", "金额依据说明"]);
      need(
        fen(d["拟退款金额"], "拟退款金额", true) <= refundable(s, o),
        "方案金额超过可退额度",
      );
    }
    if (type === "补充履约") required(d, ["补充履约内容"]);
    if (type === "全额退款") d["拟退款金额"] = money(refundable(s, o));
    treatment(s, o, d, type);
    auditEvidence(s, a, d, ["核实依据附件"], o);
    const plan = {
      ...d,
      方案处理类型: type,
      方案版本: (sale["方案版本"] || 0) + 1,
      方案提出人: a.name,
      方案提出时间: clock(s),
    };
    sale.plans.push(plan);
    sale["方案版本"] = plan["方案版本"];
    Object.assign(sale, plan);
    const exactAll =
      type === "全额退款" &&
      Number(sale["申请退款金额"]) === Number(d["拟退款金额"]);
    sale["售后状态"] = exactAll ? "待执行" : "待居民确认方案";
    sale["当前处理说明"] = d["方案说明"];
    if (exactAll) executeSale(s, a, sale, o);
  } else if (name === "aftersale.respond") {
    resident(a);
    need(sale["售后状态"] === "待居民确认方案", "方案不是待答复状态");
    const plan = sale.plans[sale.plans.length - 1];
    need(
      Number(d["方案版本"]) === plan["方案版本"],
      "方案已变更，请核对最新版本",
    );
    required(d, ["居民方案答复"]);
    if (d["居民方案答复"] === "同意") {
      plan["居民方案答复"] = "同意";
      plan["居民方案答复人"] = a.name;
      plan["居民方案答复时间"] = clock(s);
      sale["售后状态"] = "待执行";
      executeSale(s, a, sale, o);
    } else {
      plan["居民方案答复人"] = a.name;
      plan["居民方案答复时间"] = clock(s);
      required(d, ["居民方案答复说明"]);
      plan["居民方案答复"] = "不同意";
      plan["居民方案答复说明"] = d["居民方案答复说明"];
      sale["售后状态"] = "协商中";
    }
  } else if (name === "aftersale.evidence") {
    need(["resident", "merchant"].includes(a.role), "仅售后双方可以追加证据");
    need(!["已解决", "已撤回"].includes(sale["售后状态"]), "当前售后已结束");
    required(d, ["追加说明"]);
    auditEvidence(s, a, d, ["追加证据"]);
    sale.evidence = sale.evidence || [];
    sale.evidence.push({ ...d, 追加人: a.name, 追加时间: clock(s) });
  } else if (name === "aftersale.withdraw") {
    resident(a);
    need(
      ["待处理", "协商中", "待居民确认方案"].includes(sale["售后状态"]) &&
        !sale._refund &&
        !sale.rulings.some((r) => r["裁定有效状态"] === "生效"),
      "结果已生效或执行中，不能撤回",
    );
    required(d, ["撤回原因"]);
    sale["售后状态"] = "已撤回";
    sale["撤回原因"] = d["撤回原因"];
    o["售后状态"] = "已撤回";
  } else if (name === "aftersale.ruling") {
    admin(a, "ruling");
    need(
      !sale._refund &&
        !fundsFor(s, o, "退款").some((f) => f["关联售后编号"] === sale._id),
      "已有资金执行事实，不可更正裁定",
    );
    need(
      !["已解决", "已撤回"].includes(sale["售后状态"]),
      "售后已结束，不可录入裁定",
    );
    need(
      !fundsFor(s, o).some((f) =>
        ["处理中", "结果未知", "受阻"].includes(f["资金状态"]),
      ),
      "存在在途或未知资金，请先核查，不可录入或更正裁定",
    );
    required(d, ["裁定结果", "裁定说明", "裁定作出人", "裁定作出时间"]);
    need(
      ["全额退款", "部分退款", "继续或补充履约", "不予退款"].includes(
        d["裁定结果"],
      ),
      "裁定结果无效",
    );
    need(Number.isFinite(Date.parse(d["裁定作出时间"])), "裁定作出时间无效");
    need(
      Date.parse(d["裁定作出时间"]) <= Date.parse(clock(s)),
      "裁定作出时间不能晚于录入时间",
      { 裁定作出时间: "请核对线下事实时间" },
    );
    const old = sale.rulings.find(
      (r) =>
        r["裁定有效状态"] === "生效" &&
        (r._issueVersion || 0) === (sale._issueVersion || 0),
    );
    if (old) {
      required(d, ["更正原因"]);
      need(old["执行状态"] === "待执行", "已执行裁定不可更正，仅可补充说明");
      old["裁定有效状态"] = "已更正";
    }
    if (d["裁定结果"] === "全额退款")
      d["裁定退款金额"] = money(refundable(s, o));
    if (d["裁定结果"] === "部分退款") {
      required(d, ["裁定退款金额"]);
      need(
        fen(d["裁定退款金额"], "裁定退款金额", true) <= refundable(s, o),
        "裁定金额超过最新剩余可退金额",
      );
    }
    if (d["裁定结果"] === "继续或补充履约") required(d, ["继续或补充履约内容"]);
    treatment(s, o, d, d["裁定结果"], true);
    auditEvidence(s, a, d, ["裁定依据附件"], o);
    const ruling = {
      ...d,
      _issueVersion: sale._issueVersion || 0,
      裁定记录编号: id(s, "RULING"),
      关联售后编号: sale._id,
      裁定版本: sale.rulings.length + 1,
      剩余可退金额: money(refundable(s, o)),
      录入操作人: a.name,
      录入时间: clock(s),
      裁定有效状态: "生效",
      执行状态: "待执行",
    };
    sale.rulings.push(ruling);
    sale["售后状态"] = "待执行";
    sale["执行状态"] = "待执行";
    sale["当前处理说明"] = d["裁定说明"];
    for (const plan of sale.plans)
      if (!plan["居民方案答复"]) plan["执行有效性"] = "被生效裁定替代";
  } else if (name === "aftersale.rulingNote") {
    admin(a, "ruling");
    need(a.grant.sensitive, "没有内部裁定资料权限");
    need(sale.rulings?.length, "没有已有裁定可追加说明");
    required(d, ["追加说明"]);
    auditEvidence(s, a, d, ["裁定依据附件"], o);
    sale.rulingNotes = sale.rulingNotes || [];
    sale.rulingNotes.push({
      ...d,
      录入操作人: a.name,
      录入时间: clock(s),
      裁定版本: sale.rulings[sale.rulings.length - 1]["裁定版本"],
    });
    sale["追加说明"] = d["追加说明"];
    append(s, a, sale, name, d["追加说明"]);
    return { table: "aftersales", r: sale };
  } else if (name === "aftersale.execute") {
    if (a.app === "web") admin(a, "ruling");
    else merchant(a);
    executeSale(s, a, sale, o);
  } else need(false, "不支持的售后动作");
  o["售后状态"] = sale["售后状态"];
  append(
    s,
    a,
    sale,
    name,
    value(d, "方案说明", "裁定说明", "追加说明", "撤回原因") || "",
  );
  append(s, a, o, "售后进度更新", sale["售后状态"]);
  return { table: "aftersales", r: sale };
}
function evaluationCommand(s, a, name, p) {
  const d = clone(p.data || {});
  if (name === "evaluation.save") {
    resident(a);
    const o = get(s, a, "orders", p.id);
    revision(o, p);
    need(
      ["正常完成", "部分履行终止"].includes(o["结案结果"]),
      "仅实际服务结案可评价，未服务取消请反馈问题",
    );
    need(
      !domain(s).evaluations.some((e) => e._order === o._id),
      "本单已有评价，不可重复评分",
    );
    const rating = Number(d["总体评分"]);
    need(
      Number.isInteger(rating) && rating >= 1 && rating <= 5,
      "评分须为1至5整星",
      { 总体评分: "请选择整星评分" },
    );
    auditEvidence(s, a, d, ["评价图片"]);
    const r = create(
      s,
      a,
      "evaluations",
      {
        _shop: o._shop,
        _resident: o._resident,
        _order: o._id,
        _service: o._service,
        评价编号: "",
        关联服务订单号: o["服务订单号"],
        服务项目名称: o["服务项目名称"],
        服务规格名称: o["服务规格名称"],
        履约方式名称: o["履约方式名称"],
        总体评分: rating,
        评价内容: d["评价内容"] || "",
        评价图片: d["评价图片"] || [],
        评价人公开名称: a.name.slice(0, 1) + "**",
        评价时间: clock(s),
        评价展示状态: "显示",
      },
      "EVAL",
    );
    r["评价编号"] = r._id;
    append(s, a, r, "提交评价");
    return { table: "evaluations", r };
  }
  const r = get(s, a, "evaluations", p.id);
  admin(a, "manage");
  revision(r, p);
  need(["显示", "受限"].includes(d["状态"]), "评价展示状态无效");
  if (d["状态"] === "受限") {
    required(d, ["评价限制原因"]);
    need(
      !/^(低分|评分低|不满意|差评)$/.test(d["评价限制原因"]),
      "不得仅因低分限制评价",
    );
  }
  if (d["评价监管证据"] !== undefined) {
    need(a.grant.sensitive, "没有内部监管资料权限");
    auditEvidence(s, a, d, ["评价监管证据"]);
  }
  r["评价展示状态"] = d["状态"];
  r["评价限制原因"] = d["评价限制原因"] || "";
  if (d["评价监管证据"] !== undefined) r["评价监管证据"] = d["评价监管证据"];
  append(s, a, r, "评价监管", r["评价限制原因"]);
  return { table: "evaluations", r };
}
