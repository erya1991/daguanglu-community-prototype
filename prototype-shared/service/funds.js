import {
  domain,
  need,
  value,
  fen,
  money,
  get,
  create,
  append,
  clock,
  clone,
  id,
  success,
  pendingRefund,
  refundable,
  fundsFor,
  activeAftersale,
  allocations,
  admin,
  resident,
  revision,
  auditEvidence,
} from "./common.js";
const modeKind = {
  支付: "payment",
  退款: "refund",
  分账: "split",
  回退: "rollback",
};
export function outcome(s, type) {
  return domain(s).outcomes[modeKind[type]] || "normal";
}
const finalStatus = (m) =>
  ({ normal: "成功", failure: "失败", unknown: "结果未知", pending: "处理中" })[
    m
  ] || "成功";
export function fund(s, a, o, type, amount, basis, extra = {}) {
  const old = fundsFor(s, o, type).find((f) => f._basis === basis);
  if (old) return old;
  const r = create(
    s,
    a,
    "funds",
    {
      _shop: o._shop,
      _resident: o._resident,
      _order: o._id,
      _service: o._service,
      _category: o._category,
      _amount: amount,
      _basis: basis,
      资金类型: type,
      资金业务单号: "",
      服务订单号: o["服务订单号"],
      原服务订单号: o["服务订单号"],
      公共交易订单号: o["公共交易订单号"],
      经营主体名称: o["经营主体名称"],
      经营店铺名称: o["经营店铺名称"],
      收款主体名称: "青禾物业服务有限公司",
      资金金额: money(amount),
      资金状态: "待发起",
      发生时间: clock(s),
      成功时间: "",
      请求次数: 1,
      ...extra,
    },
    type === "支付"
      ? "PAY"
      : type === "退款"
        ? "REF"
        : type === "分账"
          ? "SPLIT"
          : "BACK",
  );
  r["资金业务单号"] = r._id;
  r[type + "业务单号"] = r._id;
  r[type + "金额"] = money(amount);
  r[type + "发起时间"] = clock(s);
  finish(s, a, r, extra._initialStatus || finalStatus(outcome(s, type)));
  return r;
}
export function finish(s, a, f, status) {
  f["资金状态"] = status;
  const type = f["资金类型"];
  f[type + "状态"] = status;
  f["资金结果更新时间"] = clock(s);
  f[type + "结果说明"] =
    status === "成功"
      ? "隔离演示结果已确认"
      : status === "失败"
        ? "演示请求失败，可核验后重试"
        : status === "结果未知"
          ? "请查询原请求，不能另起重复交易"
          : "请求处理中，请查询原请求";
  if (status === "成功") {
    f["成功时间"] = f["成功时间"] || clock(s);
    f[type + "成功时间"] = f["成功时间"];
    f["渠道" + (type === "支付" ? "交易" : type) + "号"] = "DEMO-" + f._id;
    f["本笔成功退款金额"] = type === "退款" ? money(f._amount) : undefined;
    f["本次成功分账金额"] = type === "分账" ? money(f._amount) : undefined;
    f["成功回退金额"] = type === "回退" ? money(f._amount) : undefined;
  }
  append(s, a, f, type + "结果核实", f[type + "结果说明"]);
  if (
    ["失败", "结果未知"].includes(status) &&
    !domain(s).exceptions.some((e) => e._fund === f._id)
  ) {
    create(
      s,
      a,
      "exceptions",
      {
        _shop: f._shop,
        _resident: f._resident,
        _order: f._order,
        _fund: f._id,
        异常记录编号: id(s, "EX"),
        异常业务类型: type,
        关联资金单据号: f._id,
        关联服务订单号: f["服务订单号"],
        业务记录金额: money(f._amount),
        渠道确认金额: status === "结果未知" ? null : money(0),
        金额差异: null,
        异常说明: f[type + "结果说明"],
        核查结论: "待核查",
      },
      "EX",
    );
  }
  return f;
}
export function splitIfReady(s, a, o) {
  if (o["结案结果"] !== "正常完成" || o["居民完成确认状态"] !== "已确认")
    return null;
  if (activeAftersale(s, o) || pendingRefund(s, o) > 0) {
    o["分账阻断原因"] = "存在进行中售后或退款";
    return null;
  }
  if (success(s, o, "支付") <= 0) {
    o["分账阻断原因"] = "付款结果未明确";
    return null;
  }
  if (
    !o.ruleSnapshot ||
    o.ruleSnapshot.status !== "有效" ||
    !domain(s).receivers[o._shop]
  ) {
    o["分账阻断原因"] = "规则缺失、冲突或接收关系未就绪";
    return null;
  }
  const existing = fundsFor(s, o, "分账")[0];
  if (existing) return existing;
  const amount = success(s, o, "支付") - success(s, o, "退款"),
    allocation =
      o.ruleSnapshot.historyReturn ||
      allocations(amount, o.ruleSnapshot.version);
  o["分账阻断原因"] = "";
  const f = fund(s, a, o, "分账", allocation.merchant, "COMPLETE:" + o._id, {
    原支付业务单号: fundsFor(s, o, "支付").find((p) => p["资金状态"] === "成功")
      ?._id,
    完成确认依据: {
      结果版本: o["结果版本"],
      确认人: o["居民确认人"],
      确认时间: o["居民确认时间"],
    },
    接收主体名称: o["经营主体名称"],
    接收账户标识: domain(s).receivers[o._shop],
    本次应分金额: money(allocation.merchant),
    本次请求分账金额: money(allocation.merchant),
    _allocation: allocation,
    ruleSnapshot: clone(o.ruleSnapshot),
  });
  return f;
}
export function refund(s, a, o, amount, basis, afterId) {
  need(amount > 0, "退款金额须大于0");
  const old = fundsFor(s, o, "退款").find((f) => f._basis === basis);
  if (old) return old;
  need(amount <= refundable(s, o), "退款金额超过当前可退额度");
  const splits = fundsFor(s, o, "分账");
  need(
    !splits.some((f) => ["处理中", "结果未知"].includes(f["资金状态"])),
    "原分账结果未明确，请先核查原单",
  );
  const split = splits.find((f) => f["资金状态"] === "成功");
  let back = null;
  if (split) {
    const already = success(s, o, "回退");
    const part = Math.min(
      split._amount - already,
      Math.round((amount * split._amount) / (success(s, o, "支付") || 1)),
    );
    if (part > 0)
      back = fund(s, a, o, "回退", part, "REFUND-BACK:" + basis, {
        原分账业务单号: split._id,
        回退主体名称: o["经营主体名称"],
        需回退金额: money(part),
        请求回退金额: money(part),
        ruleSnapshot: clone(split.ruleSnapshot),
      });
  }
  const r = fund(s, a, o, "退款", amount, basis, {
    关联售后编号: afterId || "",
    批准退款金额: money(amount),
    提交退款金额: money(amount),
    退款去向: "原支付渠道",
    原支付业务单号: fundsFor(s, o, "支付").find((f) => f["资金状态"] === "成功")
      ?._id,
    资金退款路径: split ? "原分账回退后退款" : "未分账原支付退款",
    _dependency: back?._id || null,
    _initialStatus: back && back["资金状态"] !== "成功" ? "受阻" : undefined,
  });
  if (back && back["资金状态"] !== "成功") {
    r["资金状态"] = "受阻";
    r["退款状态"] = "受阻";
    r["成功时间"] = "";
    r["退款成功时间"] = "";
    r["本笔成功退款金额"] = "0.00";
    r["退款结果说明"] = "原分账回退尚未成功，退款保持受阻";
    append(s, a, r, "等待回退", r["退款结果说明"]);
  }
  return r;
}
export function syncOrder(s, o) {
  o["累计实付金额"] = money(success(s, o, "支付"));
  o["累计成功支付金额"] = o["累计实付金额"];
  o["累计成功退款金额"] = money(success(s, o, "退款"));
  o["退款中占用金额"] = money(pendingRefund(s, o));
  o["在途退款占用金额"] = o["退款中占用金额"];
  o["剩余可退金额"] = money(refundable(s, o));
  o["本次可申请退款上限"] = o["剩余可退金额"];
  const pay = fundsFor(s, o, "支付")[0];
  o["支付状态"] = pay?.["资金状态"] || "待发起";
  o["订单净收款"] = money(success(s, o, "支付") - success(s, o, "退款"));
  o["服务商累计实分金额"] = money(success(s, o, "分账"));
  o["服务商累计回退金额"] = money(success(s, o, "回退"));
  o["服务商净实分金额"] = money(success(s, o, "分账") - success(s, o, "回退"));
  if (o.ruleSnapshot?.allocation) {
    o["服务商应结金额"] = money(o.ruleSnapshot.allocation.merchant);
    o["物业应得金额"] = money(o.ruleSnapshot.allocation.property);
  }
  o["实结金额"] = null;
  o["结算结果时间"] = null;
  o["资金规则业务编号"] = o.ruleSnapshot?.id || null;
  o["资金规则名称"] = "便民服务只读演示快照";
  o["规则适用业务"] = "便民服务";
  o["规则适用主体名称"] = o["经营主体名称"];
  o["规则适用店铺名称"] = o["经营店铺名称"];
  o["资金规则版本"] = o.ruleSnapshot?.version || null;
  o["分账业务条件"] =
    o["居民完成确认状态"] === "已确认"
      ? "居民已确认，继续核对售后与资金条件"
      : "待居民本人确认完成";
  return o;
}
export function fundCommand(s, a, name, p) {
  const data = p.data || {},
    table =
      name === "fund.note" && domain(s).exceptions.some((e) => e._id === p.id)
        ? "exceptions"
        : "funds",
    r = get(s, a, table, p.id);
  if (name === "fund.note") {
    admin(a, "funds");
    revision(r, p);
    need(value(data, "本次核查说明", "核查说明"), "请填写本次核查说明");
    const clean = { 核查依据: data["核查依据"] || data["核查依据附件"] || [] };
    auditEvidence(s, a, clean, ["核查依据"]);
    r["本次核查说明"] = value(data, "本次核查说明", "核查说明");
    r["核查依据"] = clean["核查依据"];
    r["核查操作人"] = a.name;
    r["核查时间"] = clock(s);
    r["核查结论"] = "仍受阻";
    append(s, a, r, "人工核查说明", r["本次核查说明"]);
    return { table, r };
  }
  const o = get(s, a, "orders", r._order);
  if (a.role === "resident")
    need(["支付", "退款"].includes(r["资金类型"]), "居民无权查询内部资金");
  else if (a.app === "web") admin(a, "funds");
  revision(r, p);
  if (["fund.retry", "fund.query"].includes(name) && r["资金状态"] !== "成功") {
    if (r["资金类型"] === "退款") {
      const otherOccupied = fundsFor(s, o, "退款")
        .filter(
          (f) =>
            f._id !== r._id &&
            ["处理中", "结果未知", "待发起", "受阻"].includes(f["资金状态"]),
        )
        .reduce((n, f) => n + f._amount, 0);
      const available =
        success(s, o, "支付") - success(s, o, "退款") - otherOccupied;
      need(
        r._amount <= available,
        "原退款金额超过最新可退额度，请先核查资金差异",
      );
    }
    if (
      r["资金类型"] === "分账" &&
      (name === "fund.retry" || r["资金状态"] === "失败")
    ) {
      need(
        o["结案结果"] === "正常完成" &&
          o["居民完成确认状态"] === "已确认" &&
          !activeAftersale(s, o) &&
          pendingRefund(s, o) === 0,
        "当前售后或完成条件不满足，原分账不可恢复，请先核查",
      );
      const basis = r._allocation?.amount ?? r.ruleSnapshot?.allocation?.amount;
      need(
        basis === success(s, o, "支付") - success(s, o, "退款"),
        "原分账依据金额已变化，请先核查原请求",
      );
      need(
        r.ruleSnapshot?.status === "有效" && domain(s).receivers[o._shop],
        "原分账规则或接收条件不满足，请先核查",
      );
    }
  }
  if (name === "fund.retry") {
    need(
      r["资金状态"] === "失败",
      "只有已明确失败的原请求可以重试，未知须先查询",
    );
    need(
      !r._dependency ||
        get(s, a, "funds", r._dependency)["资金状态"] === "成功",
      "原回退未成功",
    );
    r["请求次数"]++;
    finish(s, a, r, finalStatus(outcome(s, r["资金类型"])));
  } else if (name === "fund.query") {
    need(
      ["处理中", "结果未知", "失败", "受阻"].includes(r["资金状态"]),
      "原请求结果已明确",
    );
    if (
      r._dependency &&
      get(s, a, "funds", r._dependency)["资金状态"] !== "成功"
    ) {
      r["最近查询时间"] = clock(s);
      append(s, a, r, "查询原请求", "原回退结果未成功，退款仍受阻");
    } else {
      r["最近查询时间"] = clock(s);
      finish(s, a, r, finalStatus(outcome(s, r["资金类型"])));
    }
  } else need(false, "不支持的资金动作");
  if (r["资金类型"] === "支付" && r["资金状态"] === "成功") {
    if (o["结案结果"] === "未支付关闭")
      refund(s, a, o, r._amount, "LATE-PAY:" + r._id);
    else if (o["当前业务进度"] === "待付款") o["当前业务进度"] = "待接单";
  }
  if (r["资金类型"] === "回退" && r["资金状态"] === "成功")
    for (const f of fundsFor(s, o, "退款").filter(
      (f) => f._dependency === r._id && f["资金状态"] === "受阻",
    ))
      finish(s, a, f, finalStatus(outcome(s, "退款")));
  for (const sale of domain(s).aftersales.filter(
    (x) => x._order === o._id && x._refund,
  )) {
    const originalRefund = fundsFor(s, o, "退款").find(
      (f) => f._id === sale._refund,
    );
    if (
      originalRefund?.["资金状态"] === "成功" &&
      sale["执行状态"] !== "执行完成"
    ) {
      sale["售后状态"] = "已解决";
      sale["售后结案时间"] = clock(s);
      sale["执行状态"] = "执行完成";
      for (const ruling of sale.rulings || [])
        if (ruling["关联退款单号"] === originalRefund._id)
          ruling["执行状态"] = "执行完成";
      o["售后状态"] = "已解决";
      append(s, a, sale, "退款执行完成", originalRefund._id);
    }
  }
  syncOrder(s, o);
  return { table, r };
}
