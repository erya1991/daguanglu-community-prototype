import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createSeed } from "../prototype-shared/core.js";
import * as api from "../prototype-shared/service/index.js";
import { SCENARIOS } from "../prototype-shared/service/seed.js";
import { tableById } from "../prototype-shared/service/fields.js";
const validated = process.argv.includes("--validated");
if (validated) {
  const report = JSON.parse(
    fs.readFileSync(
      "docs/stages/stage-02/evidence/review-20261109/browser-review.json",
      "utf8",
    ),
  );
  assert.equal(report.results.length, 6);
  assert.ok(report.results.every((r) => r.status === "PASS"));
  assert.equal(report.errors.length, 0);
}
const old = JSON.parse(
  fs.readFileSync(
    "docs/stages/stage-02/evidence/field-runtime-results.json",
    "utf8",
  ),
);
assert.equal(old.valueGaps.length, 117, "Fixed historical audit input");
const W = { app: "web", account: "property-admin" },
  M = { app: "merchant", account: "merchant" },
  R = { app: "resident", account: "resident-a" };
const raw = (s, id) =>
    Object.values(s.service)
      .filter(Array.isArray)
      .flat()
      .find((r) => r?._id === id),
  clone = (x) => structuredClone(x);
let seq = 0;
const checks = [],
  observations = new Map();
function setup(scene) {
  const s = createSeed();
  api.prepare(s);
  if (scene) api.auxiliary(s, W, "scenario", { name: scene });
  return s;
}
function run(s, a, n, r, data = {}) {
  return api.command(s, a, n, {
    id: r?._id,
    revision: raw(s, r?._id)?._rev,
    operationId: "FIELD-REVIEW-" + ++seq,
    data,
  }).record;
}
function capture(table, label, record) {
  function walk(v, p) {
    if (!v || typeof v !== "object") return;
    for (const [k, value] of Object.entries(v)) {
      if (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        (!Array.isArray(value) || value.length)
      ) {
        const key = table + ":" + k,
          items = observations.get(key) || [];
        if (items.length < 6) {
          const serialized = JSON.stringify(value);
          items.push({
            source: label,
            path: p + "." + k,
            value:
              serialized.length < 1100
                ? value
                : {
                    count: Array.isArray(value) ? value.length : undefined,
                    sha256: crypto
                      .createHash("sha256")
                      .update(serialized)
                      .digest("hex"),
                    summary: serialized.slice(0, 220),
                  },
          });
          observations.set(key, items);
        }
      }
      walk(value, p + "." + k);
    }
  }
  walk(record, "record");
}
function check(name, fn) {
  try {
    const result = fn();
    checks.push({ name, status: "PASS", result });
  } catch (e) {
    checks.push({ name, status: "FAIL", error: e.message });
  }
}
for (const scene of SCENARIOS)
  check("Read authorized fixture " + scene, () => {
    const s = setup(scene);
    for (const t of [
      "qualifications",
      "personnel",
      "services",
      "orders",
      "aftersales",
      "evaluations",
      "funds",
    ])
      for (const r of api.query(s, W, t))
        capture(t, scene + ":authorized-web", r);
    return "Seed facts read only; no terminal state injection";
  });
check("New supply review, restriction and pause facts", () => {
  const s = setup();
  let v = run(s, M, "service.save", null, clone(raw(s, "SV-HOME").published));
  v = run(s, M, "service.submit", v);
  capture("services", "new-service-submitted", v);
  v = run(s, W, "service.review", v, {
    审核结果: "通过",
    审核意见: "核对本次规格和合法范围后通过",
  });
  capture("services", "new-service-reviewed", v);
  assert.equal(v["审核轮次"], 1);
  v = run(s, M, "service.status", v, {
    状态: "暂停接单",
    暂停原因: "本周人员已安排其他订单",
  });
  capture("services", "merchant-paused-service", v);
  assert.ok(v["开关变更时间"]);
  v = run(s, W, "service.status", v, {
    状态: "平台限制",
    原因说明: "核实本次经营材料",
  });
  capture("services", "restricted-service", v);
  assert.equal(api.query(s, W, "services", { 平台限制筛选: "受限" }).length, 1);
  run(s, W, "qualification.status", raw(s, "Q-A"), {
    状态: "暂停",
    暂停或恢复原因: "核对协议授权",
  });
  capture(
    "qualifications",
    "qualification-paused",
    api.record(s, W, "qualifications", "Q-A"),
  );
  capture(
    "services",
    "service-qualification-invalid",
    api.record(s, W, "services", v._id),
  );
  return { service: v._id };
});
check("Valid review return feedback and staff stop cause", () => {
  const s = setup();
  let v = run(s, M, "service.save", null, clone(raw(s, "SV-HOME").published));
  v = run(s, M, "service.submit", v);
  v = run(s, W, "service.review", v, {
    审核结果: "退回修改",
    审核意见: "请补充规格排除事项的明确说明",
  });
  capture("services", "returned-supply", v);
  const p = run(s, M, "personnel.status", raw(s, "P-A"), {
    状态: "停用",
    启停原因: "人员已离开当前服务店铺",
  });
  capture("personnel", "personnel-stopped", p);
  return "Persisted action feedback; not a placeholder value";
});
check("Arrangement answer and subsequent accepted change", () => {
  const s = setup("S02-HOME-READY");
  let o = api.query(s, M, "orders")[0];
  o = run(s, R, "order.change", o, {
    改期原因: "居民临时无法在原时间到场",
    期望时间选择: "指定日期",
    期望服务日期: "2026-11-08",
    期望时段偏好: "上午",
  });
  capture("orders", "resident-requested-change", o);
  o = run(s, M, "order.arrange", o, {
    服务人员: "P-A",
    安排服务日期: "2026-11-08",
    安排开始时间: "09:00",
    安排结束时间: "11:00",
    原安排仍可履行: true,
    改期原因: "双方协商变更服务时间",
    安排说明: "按居民提出的次日时间重新安排",
  });
  o = run(s, R, "order.respond", o, {
    安排版本: o.proposal["安排版本"],
    居民安排答复: "希望调整",
    居民答复说明: "希望改为次日下午",
  });
  capture("orders", "resident-requested-adjustment", o);
  o = run(s, M, "order.arrange", o, {
    服务人员: "P-A",
    安排服务日期: "2026-11-08",
    安排开始时间: "14:00",
    安排结束时间: "16:00",
    原安排仍可履行: true,
    改期原因: "双方协商变更服务时间",
    安排说明: "双方已沟通下午安排",
  });
  o = run(s, R, "order.respond", o, {
    安排版本: o.proposal["安排版本"],
    居民安排答复: "接受",
  });
  capture("orders", "accepted-change", o);
  return { changes: o.changes.length };
});
check("Point verification outside arranged window with reason", () => {
  const s = setup("S02-POINT-READY");
  let o = api.query(s, M, "orders")[0];
  api.auxiliary(s, W, "clock", { time: "2026-11-07T13:00:00+08:00" });
  let rejection;
  try {
    run(s, M, "order.verify", o, {
      到点凭证码: "WRONG",
      当前核验地点: "POINT-A",
      确认到点: true,
    });
  } catch (e) {
    rejection = e.message;
  }
  assert.ok(rejection);
  capture("orders", "actual-rejected-verification-error", {
    拒绝核验原因: rejection,
  });
  o = run(s, M, "order.verify", o, {
    到点凭证码: o["到点凭证码"],
    当前核验地点: "POINT-A",
    确认到点: true,
    核验说明: "双方沟通后居民于当日下午到点",
  });
  capture("orders", "actual-point-confirmation", o);
  return { order: o._id };
});
check("Declined aftersale response and valid withdrawal", () => {
  const s = setup("S02-RULING");
  let sale = api.query(s, M, "aftersales")[0];
  sale = run(s, M, "aftersale.plan", sale, {
    方案处理类型: "部分退款",
    拟退款金额: "10.00",
    金额依据说明: "按现场核实的未完成区域",
    方案说明: "提出协商方案供居民答复",
    业务结案方式: "部分履行终止",
  });
  sale = run(s, R, "aftersale.respond", sale, {
    方案版本: sale["方案版本"],
    居民方案答复: "不同意",
    居民方案答复说明: "希望先核对未完成的具体范围",
  });
  assert.ok(sale["居民方案答复时间"]);
  assert.ok(sale["居民方案答复人"]);
  capture("aftersales", "resident-declined-plan", sale);
  sale = run(s, R, "aftersale.withdraw", sale, {
    撤回原因: "双方继续在线下核对，本次申请先撤回",
  });
  capture("aftersales", "resident-withdrew-before-execution", sale);
  return { sale: sale._id };
});
check(
  "After-completion refund, actual rollback and original refund query",
  () => {
    const s = setup("S02-FUNDS-REFUND"),
      o = api.query(s, R, "orders")[0];
    let sale = run(s, R, "aftersale.apply", o, {
      申请类型: "申请退款",
      申请原因: "完成后发现一处约定区域未清洁",
      申请退款金额: "10.00",
    });
    sale = run(s, M, "aftersale.plan", sale, {
      方案处理类型: "部分退款",
      拟退款金额: "10.00",
      金额依据说明: "按已核对的未清洁区域协商",
      方案说明: "返还该部分服务费用",
      业务结案方式: "完成后售后解决",
    });
    api.auxiliary(s, W, "mode", { kind: "refund", outcome: "unknown" });
    sale = run(s, R, "aftersale.respond", sale, {
      方案版本: sale["方案版本"],
      居民方案答复: "同意",
    });
    const f = api.query(s, W, "funds").find((f) => f["资金类型"] === "退款");
    api.auxiliary(s, W, "mode", { kind: "refund", outcome: "normal" });
    run(s, W, "fund.query", f);
    for (const row of api.query(s, W, "funds"))
      capture("funds", "successful-refund-and-rollback", row);
    sale = api.record(s, W, "aftersales", sale._id);
    capture("aftersales", "successful-aftercare-closure", sale);
    assert.ok(sale["售后结案说明"]);
    assert.equal(
      api.record(s, W, "orders", o._id)["分账接收主体名称"],
      o["经营主体名称"],
    );
    return { refund: f._id };
  },
);
check("Cancellation effect and supplemental fulfillment references", () => {
  const s = setup("S02-CANCEL-CONFIRMED");
  let o = api.query(s, R, "orders")[0];
  o = run(s, R, "order.cancel", o, {
    申请原因: "确认安排后居民无法提供服务条件",
  });
  let sale = api.query(s, M, "aftersales")[0];
  sale = run(s, M, "aftersale.plan", sale, {
    方案处理类型: "全额退款",
    方案说明: "核实未提供服务，按原申请全退",
    取消核实结果: "同意取消",
    服务是否已实际开始: false,
    核实依据说明: "本单未开始记录与双方沟通一致",
    业务结案方式: "未服务取消",
  });
  capture("aftersales", "confirmed-cancellation-executed", sale);
  const x = setup("S02-REWORK");
  o = api.query(x, M, "orders")[0];
  o = run(x, M, "order.arrange", o, {
    服务人员: "P-A",
    安排服务日期: "2026-11-08",
    安排开始时间: "09:00",
    安排结束时间: "11:00",
    安排说明: "安排原订单的补充服务",
  });
  o = run(x, R, "order.respond", o, {
    安排版本: o.proposal["安排版本"],
    居民安排答复: "接受",
  });
  capture("orders", "supplemental-round-arranged", o);
  for (const a of api.query(x, W, "aftersales"))
    capture("aftersales", "supplemental-order-association", a);
  return "Normal commands preserve original rounds";
});

check("Rejected acceptance and payment close/query conditions", () => {
  const s = setup("S02-UNABLE");
  let o = api.query(s, R, "orders")[0];
  o = run(s, M, "order.accept", o, {
    接单结果: "无法承接",
    无法承接说明: "当前人员无法满足本单约定服务要求",
  });
  capture("orders", "merchant-unable-to-accept", o);
  const x = setup("S02-PAY-CLOSE");
  o = api.query(x, R, "orders")[0];
  o = run(x, R, "order.pay", o);
  o = run(x, R, "order.cancel", o, { 申请原因: "付款结果未明确，先关闭预约" });
  capture("orders", "payment-close-request", o);
  api.auxiliary(x, W, "mode", { kind: "payment", outcome: "normal" });
  const fund = api.query(x, W, "funds").find((f) => f["资金类型"] === "支付");
  run(x, W, "fund.query", fund);
  for (const f of api.query(x, W, "funds"))
    capture("funds", "payment-original-query", f);
  return "Business cause and channel query are separate actual facts";
});

check("Explicit missing-rule case keeps a real split blocking reason", () => {
  const s = setup("S02-FUNDS-RULE");
  let o = api.query(s, R, "orders")[0];
  o = run(s, R, "order.confirm", o, {
    当前待确认结果版本: o.result["结果版本"],
    居民结果答复: "确认完成",
  });
  capture(
    "orders",
    "completed-with-explicit-rule-block",
    api.record(s, W, "orders", o._id),
  );
  for (const f of api.query(s, W, "funds"))
    capture("funds", "original-payment-and-rule-block", f);
  assert.equal(
    s.service.funds.some((f) => f["资金类型"] === "分账"),
    false,
  );
  return "No rule configured is explicit auxiliary scenario only";
});
const defects = {
  "26-A.11":
    "人员资质筛选依赖缓存状态，补充按当前类目材料事实计算，并保留待核实",
  "27-B.06": "平台限制筛选未接入Service",
  "27-B.07": "供给方式筛选未按组合及稳定引用匹配",
  "27-F.09": "供给审核轮次缺少真实历史投影",
  "28-A.08": "下单约时提示未绑定展示",
  "30-B.17": "核验拒绝仅通用报错，结果字段未显示实际原因",
  "31-A.03": "移动/Web售后类型字典与实际申请类型未对齐",
  "31-B.16": "不同意方案分支未记答复时间",
  "31-B.17": "不同意方案分支未记答复人",
  "31-B.19": "退款结束及原请求恢复完成未带出真实结案说明",
  "31-F.02": "移动评价项目筛选未提供实际项目候选",
  "32-A.02": "商户经营项目筛选与下钻上下文未贯通",
  "32-A.03": "类目统计及下钻未保持订单类目快照条件",
  "32-C.06": "资金摘要未投影已匹配的接收主体名称",
};
const demo = new Set([
  "27-F.03",
  "27-F.04",
  "27-F.07",
  "27-F.08",
  "27-F.10",
  "27-F.11",
  ...Array.from(
    { length: 12 },
    (_, i) => "32-E." + String(i + 2).padStart(2, "0"),
  ),
]);
const legal = new Set([
  "26-D.07",
  "26-E.05",
  "29-E.17",
  "30-E.09",
  "32-C.21",
  "32-C.22",
]);
const conditionReasons = {
  "29-A.07":
    "服务主图已有真实附件绑定；原观察器未进入图像值采样分支，并非缺少主图或未实现。本轮真实上传及图片显示路径核验，保留原观察版本。",
  "C1.08": "上传失败时显示真实错误；原审计为成功附件",
  "26-B.20": "资格受限后才有原因",
  "26-E.12": "人员启停动作后有业务原因",
  "27-C.18": "平台限制后才有原因",
  "27-F.06": "经营条件不满足时才有原因",
  "28-A.02": "暂停接单时才要求填写",
  "28-A.03": "接单开关发生实际变化后自动生成",
  "28-B.02": "明确无法承接时才填写",
  "28-B.19": "居民希望调整安排时才填写",
  "29-F.11": "查询原支付请求后生成",
  "29-F.12": "实际关闭支付时生成",
  "30-A.15": "补充履约轮次关联原售后",
  "30-D.03": "居民反馈异议时填写",
  "31-B.15": "不同意方案时填写",
  "31-B.18": "未服务取消生效后生成",
  "31-C.03": "不可逆动作之前撤回时填写",
  "31-D.11": "查询原退款后生成",
  "31-G.19": "执行继续/补充履约时关联实际轮次",
  "32-C.24": "实际完成、售后或资金条件阻断时才生成",
};
const results = old.valueGaps.map((f) => {
  const meta = tableById[f.table].fields.find((x) => x.id === f.id);
  let classification, basis;
  const optionalFilter = /筛选/.test(f.condition);
  if (defects[f.id]) {
    classification = "实际实现缺陷";
    basis = defects[f.id];
  } else if (legal.has(f.id) || optionalFilter) {
    classification = "合法为空";
    basis = optionalFilter
      ? "未选择该可选筛选条件时为空，表示不额外过滤；不补造查询值"
      : "当前材料为长期有效、未关联账号/处理记录、居民未补充需求或无已确认手续费依据，按各自原字段定义允许空";
  } else if (demo.has(f.id)) {
    classification = "缺少演示数据";
    basis =
      "原观察未进入含本字段事实的对象或控件值；本轮使用合法新审核/上传/退款回退事实核验，不回填原历史或伪造非空值";
  } else if (
    conditionReasons[f.id] ||
    f.table === "28-C" ||
    f.table === "30-B"
  ) {
    classification = "条件未触发";
    basis =
      conditionReasons[f.id] ||
      (f.table === "28-C"
        ? "存在原有效安排并实际提出/接受改期后才生成，历史提案分别保留"
        : "凭证查询、偏离时间核验及确认节点分别生成，不在确认前伪造核验结果");
  } else throw Error("Unclassified original field " + f.id);
  const table = f.table.startsWith("26-")
    ? f.table === "26-E"
      ? "personnel"
      : "qualifications"
    : f.table.startsWith("27-") || f.table === "28-A"
      ? "services"
      : f.table.startsWith("31-")
        ? f.table === "31-D"
          ? "funds"
          : "aftersales"
        : f.table.startsWith("32-")
          ? "funds"
          : "orders";
  const facts = [...(observations.get(table + ":" + f.name) || [])];
  if (f.id === "29-A.07")
    facts.push(...(observations.get("services:服务主图") || []));
  let emptyFilterCheck;
  if (optionalFilter) {
    const t =
      f.table === "26-A"
        ? /人员/.test(f.name)
          ? "personnel"
          : "qualifications"
        : f.table === "27-A"
          ? "categories"
          : f.table === "27-B"
            ? "services"
            : f.table === "29-D"
              ? "orders"
              : f.table === "31-A"
                ? "aftersales"
                : f.table === "31-F"
                  ? "evaluations"
                  : f.table === "32-A"
                    ? "funds"
                    : null;
    if (t) {
      const s = setup(
          t === "personnel"
            ? "S02-QUAL"
            : t === "evaluations"
              ? "S02-EVAL"
              : "S02-STATS",
        ),
        empty = /多选|关联集合/.test(meta.type) ? [] : "";
      const before = api.query(s, W, t).map((r) => r._id),
        after = api.query(s, W, t, { [f.name]: empty }).map((r) => r._id);
      assert.deepEqual(after, before, f.id + " optional empty filter");
      emptyFilterCheck = {
        status: "PASS",
        table: t,
        authorizedRows: before.length,
        input: empty,
      };
    }
  }
  return {
    ...f,
    classification,
    basis,
    requiredAndVisibility: meta.condition,
    rule: meta.rule,
    fixStatus:
      classification === "实际实现缺陷"
        ? validated
          ? "FIXED_TARGETED_VALIDATION_PASSED"
          : "FIXED_PENDING_COMBINED_VALIDATION"
        : undefined,
    observedFacts: facts.slice(0, 3),
    emptyFilterCheck,
    evidence:
      "tests/service-review.test.mjs; review-20261109 checks and browser reports",
    boundary:
      "Classification and specified fact checks; not all device/DOM/permission combinations or owner acceptance",
  };
});
const totals = results.reduce(
  (a, r) => ((a[r.classification] = (a[r.classification] || 0) + 1), a),
  {},
);
assert.equal(results.length, 117);
const report = {
  generatedAt: new Date().toISOString(),
  baseline: "348363b7410ff90f062f75b93242f03bb246d4c1",
  originalAudit: old.summary.run,
  inputCount: 117,
  totals,
  checks,
  fields: results,
  scope:
    "No fake non-empty fee/account/history values; conditional examples use real local Service commands. Original 621/504/117 observation report is unchanged; this report is not full field acceptance or Stage PASS.",
};
fs.mkdirSync("docs/stages/stage-02/evidence/review-20261109", {
  recursive: true,
});
fs.writeFileSync(
  "docs/stages/stage-02/evidence/review-20261109/field-gap-classification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      fields: results.length,
      totals,
      checks: checks.map((c) => ({
        name: c.name,
        status: c.status,
        error: c.error,
      })),
      withFact: results.filter((r) => r.observedFacts.length).length,
      emptyFilterChecks: results.filter((r) => r.emptyFilterCheck).length,
    },
    null,
    2,
  ),
);
process.exitCode = checks.some((c) => c.status !== "PASS") ? 1 : 0;
