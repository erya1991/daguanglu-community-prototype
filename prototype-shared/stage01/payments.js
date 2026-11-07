import {
  domain,
  actor,
  need,
  get,
  makeId,
  history,
  now,
  clone,
  houseFor,
  revision,
  attachments,
  isPropertyOperator,
} from "./common.js";
import { relationFor } from "./parking.js";
import { refreshBill } from "./billing.js";
export const businessTable = {
  物业费: "bills",
  停车月租: "monthly",
  临停: "temporary",
};
export function businessFor(s, a, kind, id, check = true) {
  const table = businessTable[kind];
  need(table, "收费业务类型无效");
  const r = get(s, a, table, id);
  if (check) {
    if (table === "bills") {
      houseFor(s, a, r._house, true);
      need(r.BL19 === "已发布", "账单尚未发布");
    } else {
      const rel = relationFor(s, a, table === "monthly" ? r._relation : r.TB03);
      need(rel, "停车关系已失效");
    }
  }
  return {
    r,
    table,
    amount:
      table === "bills"
        ? refreshBill(r).BL16
        : table === "monthly"
        ? r.MO09
        : r.TB08,
  };
}
function addCheck(s, a, pay, kind, note) {
  const d = domain(s),
    old = d.checks.find((x) => x._payment === pay._id && x.EX02 === kind);
  if (old) return old;
  const id = makeId(s, "EX"),
    r = {
      _id: id,
      _rev: 1,
      _community: pay._community,
      _estate: pay._estate,
      _org: pay._org,
      _payment: pay._id,
      EX01: id,
      EX02: kind,
      EX03: pay._business,
      EX04: pay.PY10,
      EX05: "待核查",
      EX06: note,
      EX07: [],
      EX08: "",
      EX09: "",
      EX10: "",
      history: [],
    };
  d.checks.push(r);
  return r;
}
function reconcile(s, a, p, recovering = false) {
  const d = domain(s),
    r = d[businessTable[p.PY02]].find((r) => r._id === p._business);
  need(r, "原业务单据缺失，请核查");
  if (p.PY17 === "成功") return;
  if (
    !recovering &&
    p.PY02 === "物业费" &&
    !s.relations.some(
      (x) =>
        x._resident === p._resident &&
        x._house === r._house &&
        x["关系状态"] === "有效" &&
        (!x["有效结束日"] ||
          x["有效结束日"] >= new Date().toISOString().slice(0, 10))
    )
  ) {
    p.PY17 = "异常";
    p.PY16 = "付款已确认，原授权发生变化，物业核查中";
    r._pendingReconcile = true;
    addCheck(s, a, p, "授权变化后的付款", p.PY16);
    return;
  }
  if (p._mode === "reconcile" && !recovering) {
    p.PY17 = "异常";
    p.PY16 = "支付成功，业务更新中，请勿重复缴费";
    r._pendingReconcile = true;
    addCheck(s, a, p, "核销登记异常", p.PY16);
    return;
  }
  const other = d.payments.find(
    (x) => x._business === p._business && x._id !== p._id && x.PY17 === "成功"
  );
  if (other) {
    p.PY17 = "异常";
    p.PY16 = "存在另一笔结清记录，已保留收款并进入核查";
    addCheck(s, a, p, "重复收款", p.PY16);
    return;
  }
  if (p.PY02 === "物业费") {
    r.BL15 += p.PY04;
    r._pendingReconcile = false;
    refreshBill(r);
  }
  if (p.PY02 === "临停") {
    r.TB07 += p.PY04;
    r.TB08 = Math.max(0, r.TB06 - r.TB07);
    r.TB14 = r.TB08 === 0 ? "已结清" : "部分结清";
    r.TB15 = "费用已结清；通行信息暂未同步";
  }
  if (p.PY02 === "停车月租") {
    r.MO10 = "已登记";
    r.MO11 = makeId(s, "RIGHT");
    r.MO12 = r.MO07;
    r.MO13 = r.MO08;
    r.MO14 =
      r.MO12 > new Date().toISOString().slice(0, 10)
        ? "待生效"
        : r.MO13 < new Date().toISOString().slice(0, 10)
        ? "已到期"
        : "有效";
    r.MO16 = "平台已登记；通行信息暂未同步";
  }
  p.PY17 = "成功";
  p.PY18 = now();
  p.PY19 = makeId(s, "VOUCHER");
  p.PY16 = "缴费已确认";
  history(
    s,
    a,
    r,
    p.PY02 === "停车月租" ? "平台月租登记" : "账单核销",
    {},
    { 结清金额: p.PY04 },
    "业务结果已更新",
    true
  );
}
function result(s, a, p, outcome, recovering = false) {
  if (p.PY12 === "成功" && outcome !== "成功") return;
  p.PY12 = outcome;
  if (p.PY02 === "停车月租" && ["失败", "已关闭"].includes(outcome)) {
    const order = domain(s).monthly.find((x) => x._id === p._business);
    order.MO10 = outcome === "失败" ? "待支付" : "已关闭";
  }
  if (outcome === "成功") {
    p.PY07 = p.PY06;
    p.PY14 = p.PY14 || now();
    p.PY11 = "";
    p._localReceipt = p._localReceipt || makeId(s, "RECEIPT");
    reconcile(s, a, p, recovering);
  } else
    p.PY16 = {
      处理中: "正在确认付款结果",
      结果待确认: "结果尚未确定，请查询原支付",
      失败: "本次付款未成功，可重新确认后再试",
      已关闭: "已确认未支付并关闭",
    }[outcome];
  history(
    s,
    a,
    p,
    "更新付款结果",
    {},
    { PY12: p.PY12, PY17: p.PY17 },
    p.PY16,
    true
  );
}
export function paymentCommand(s, ctx, command, p) {
  const d = domain(s),
    a = actor(s, ctx, true);
  if (command === "pay") {
    need(a.role === "resident", "请由住户本人确认缴费");
    const { r, table, amount } = businessFor(s, a, p.kind, p.id);
    revision(r, p);
    need(
      amount > 0 && (table !== "monthly" || r.MO10 === "待支付"),
      "该单据无需再次缴费"
    );
    if (table === "temporary")
      need(
        p.quoteVersion === r.TB11 &&
          (!r.TB12 || Date.parse(r.TB12) >= Date.now()),
        "报价已变化或过期，请重新核对金额"
      );
    if (table === "monthly") {
      const current = d.products.find((x) => x._id === r._product);
      need(
        current?.MP07 === "启用" && current.MP08 === r.MO18,
        "产品已变化，请重新办理并确认"
      );
      const other = d.monthly.find(
        (x) =>
          x._id !== r._id &&
          x._relation === r._relation &&
          x.MO10 === "已登记" &&
          x.MO12 <= r.MO08 &&
          x.MO13 >= r.MO07
      );
      need(!other, "原权益已变化，请核对期间");
    }
    need(
      !d.payments.some(
        (x) =>
          x._business === r._id &&
          ["处理中", "结果待确认", "成功"].includes(x.PY12)
      ),
      "原单已有付款处理中或已支付，请查询原记录"
    );
    const id = makeId(s, "PY"),
      pay = {
        _id: id,
        _rev: 1,
        _resident: a.resident,
        _account: a._id,
        _business: r._id,
        _community: r._community,
        _estate: r._estate,
        _org: r._org,
        _snapshot: clone(r),
        _parkingSnapshot:
          table === "bills"
            ? null
            : clone(
                d.parkingRelations.find(
                  (x) => x._id === (table === "monthly" ? r._relation : r.TB03)
                )
              ),
        _mode: d.scenarios.payment || "normal",
        PY01: id,
        PY02: p.kind,
        PY03: r._id,
        PY04: amount,
        PY05: 0,
        PY06: amount,
        PY07: 0,
        PY08: d.config.company,
        PY09: a.name,
        PY10: id,
        PY11: "",
        PY12: "处理中",
        PY13: now(),
        PY14: "",
        PY15: "",
        PY16: "",
        PY17: "未核销",
        PY18: "",
        PY19: "",
        PY20: "",
        PY21: 0,
        PY22: "",
        history: [],
      };
    d.payments.push(pay);
    if (table === "monthly") r.MO10 = "支付确认中";
    history(s, a, pay, "发起缴费", {}, { PY12: "处理中" }, "单笔缴费", true);
    const mode = pay._mode;
    result(
      s,
      a,
      pay,
      mode === "unknown"
        ? "结果待确认"
        : mode === "pending"
        ? "处理中"
        : mode === "failure"
        ? "失败"
        : "成功"
    );
    return { id, message: pay.PY16 };
  }
  if (command === "createCheck") {
    need(isPropertyOperator(a) && ctx.app === "web", "核查在物业Web办理");
    const existing = d.payments.find((x) => x._id === p.id);
    const target = existing
      ? get(s, a, "payments", p.id)
      : get(s, a, "bills", p.id);
    const pay = existing || { ...target, _business: target._id, PY10: "" };
    const r = addCheck(s, a, pay, p.kind || "业务核查", p.note || "");
    return { id: r._id, message: "核查记录已建立" };
  }
  if (command === "saveCheck") {
    need(isPropertyOperator(a) && ctx.app === "web", "核查在物业Web办理");
    const r = get(s, a, "checks", p.id);
    revision(r, p);
    need(p.note?.trim(), "请填写核查说明", { EX06: "此项必填" });
    Object.assign(r, {
      EX05: "已核查",
      EX06: p.note,
      EX07: attachments(s, a, p.photos || []),
      EX08: a.name,
      EX09: now(),
      EX10: p.next || "",
    });
    history(s, a, r, "登记核查意见", {}, { EX06: p.note }, p.note);
    return { id: r._id, message: "意见已保存，资金事实不变" };
  }
  const pay = get(s, a, "payments", p.id);
  if (command === "queryPayment") {
    pay.PY15 = now();
    if (!["失败", "已关闭"].includes(pay.PY12)) result(s, a, pay, "成功");
    return { id: pay._id, message: pay.PY16 };
  }
  if (command === "recoverPayment") {
    need(
      isPropertyOperator(a) && ctx.app === "web" && pay.PY12 === "成功",
      "仅可核对已有成功支付"
    );
    result(s, a, pay, "成功", true);
    return { id: pay._id, message: pay.PY16 };
  }
  need(false, "不支持的支付操作");
}
// Auxiliary delivery events use the same reconciliation path; never directly edit business terminal state.
export function replayPayment(s, ctx, p) {
  const a = actor(s, ctx);
  need(ctx.app === "web" && isPropertyOperator(a), "仅演示辅助入口可回放");
  const r = get(s, a, "payments", p.id);
  result(s, a, r, p.outcome || "成功");
  return { id: r._id, message: "已按原交易处理回执" };
}

export function auxiliaryFunds(s, ctx, p) {
  const a = actor(s, ctx);
  need(
    isPropertyOperator(a) && ctx.app === "web",
    "仅物业演示辅助入口可准备资金场景"
  );
  const d = domain(s),
    r = get(s, a, "payments", p.id);
  if (p.kind === "duplicate") {
    need(r.PY12 === "成功", "先准备成功付款");
    const id = makeId(s, "PY"),
      copy = {
        ...clone(r),
        _id: id,
        PY01: id,
        PY10: id,
        PY19: "",
        PY17: "未核销",
        history: [],
        _localReceipt: "",
      };
    d.payments.push(copy);
    result(s, a, copy, "成功");
    return { id, message: "两笔收款已保留，重复款进入核查" };
  }
  if (p.kind === "refund") {
    need(r.PY12 === "成功", "先准备成功付款");
    r.PY20 = "成功";
    r.PY21 = r.PY07;
    r.PY22 = now();
    history(
      s,
      a,
      r,
      "读取既有退款事实",
      {},
      { PY20: r.PY20, PY21: r.PY21 },
      "仅演示已发生资金结果，不改变应收依据",
      true
    );
    return { id: r._id, message: "只读退款事实已准备" };
  }
  need(false, "未知资金场景");
}
