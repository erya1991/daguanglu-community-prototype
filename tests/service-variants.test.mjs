import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../prototype-shared/core.js";
import * as service from "../prototype-shared/service/index.js";
const resident = { app: "resident", account: "resident-a" },
  otherResident = { app: "resident", account: "resident-b" },
  merchant = { app: "merchant", account: "merchant" },
  web = { app: "web", account: "property-admin" },
  limited = { app: "web", account: "service-web-limited" };
let token = 0;
const raw = (s, id) =>
  Object.values(s.service)
    .filter(Array.isArray)
    .flat()
    .find((x) => x?._id === id);
const rows = (s, t) => s.service[t];
function setup(scene = "S02-BASE") {
  const s = createSeed();
  service.prepare(s);
  if (scene !== "S02-BASE")
    service.auxiliary(s, web, "scenario", { name: scene });
  return s;
}
function run(s, ctx, name, r, data = {}) {
  const id = typeof r === "object" ? r?._id : r;
  return service.command(s, ctx, name, {
    id,
    revision: raw(s, id)?._rev,
    operationId: "VARIANT-" + ++token,
    data,
  }).record;
}
function createData(s, sv = "SV-HOME") {
  const v = rows(s, "services").find((v) => v._id === sv),
    sp = v.published["服务规格集合"][0],
    combo = sp["组合集合"][0];
  return {
    选定服务项目: sv,
    选定服务规格: sp["规格编号"],
    选定履约方式: combo["组合履约方式名称"],
    联系人姓名: "回归居民",
    联系人电话: "13800005555",
    期望时间选择: "时间可协商",
    服务约定确认: true,
    服务对象描述: "一台演示设备",
    ...(combo["组合流程模板"] === "上门"
      ? {
          上门服务地址: {
            省份: "江苏省",
            城市: "南京市",
            区县: "示例区",
            所属社区: "C-A",
            所属小区: "E-A",
            详细地址: "青禾花园101室",
          },
        }
      : { 到点服务地点: "POINT-A" }),
  };
}
const clock = (s, time) => service.auxiliary(s, web, "clock", { time });
function paid(s, sv = "SV-HOME") {
  return run(
    s,
    resident,
    "order.pay",
    run(s, resident, "order.create", null, createData(s, sv)),
  );
}
const schedule = {
  服务人员: "P-A",
  安排服务日期: "2026-11-07",
  安排开始时间: "09:00",
  安排结束时间: "11:00",
};
function acceptProposal(s, o) {
  return run(s, resident, "order.respond", o, {
    安排版本: o.proposal["安排版本"],
    居民安排答复: "接受",
  });
}
function arrange(s, o) {
  o = run(s, merchant, "order.accept", o, schedule);
  return acceptProposal(s, o);
}
function result(
  s,
  o,
  { mode = "上门", partial = false, begin = "09:00", end = "10:00" } = {},
) {
  clock(s, "2026-11-07T" + begin + ":00+08:00");
  o = run(
    s,
    merchant,
    mode === "上门" ? "order.arrive" : "order.verify",
    o,
    mode === "上门"
      ? { 到场说明: "按安排到场" }
      : {
          到点凭证码: o["到点凭证码"],
          当前核验地点: "POINT-A",
          确认到点: true,
        },
  );
  o = run(s, merchant, "order.start", o);
  clock(s, "2026-11-07T" + end + ":00+08:00");
  return run(s, merchant, "order.result", o, {
    服务结果: partial ? "部分完成" : "全部完成",
    实际完成内容: "按约定清洁",
    未完成内容: partial ? "剩余清洁" : "",
    未完成原因: partial ? "现场条件" : "",
    实际服务结束时间: "2026-11-07T" + end + ":00+08:00",
    结果图片: [],
  });
}
function complete(s) {
  let o = result(s, arrange(s, paid(s)));
  return run(s, resident, "order.confirm", o, {
    当前待确认结果版本: o.result["结果版本"],
    居民结果答复: "确认完成",
  });
}

test("AC02-014 两条接单入口落同一待确认事实，提案调整后拒绝旧版接受", () => {
  const s = setup();
  let first = paid(s),
    second = paid(s);
  first = run(s, merchant, "order.accept", first);
  assert.equal(first["接单状态"], "已接单");
  assert.equal(first.arrangements.length, 0);
  first = run(s, merchant, "order.arrange", first, schedule);
  second = run(s, merchant, "order.accept", second, schedule);
  for (const o of [first, second]) {
    assert.equal(o["接单状态"], "已接单");
    assert.equal(o.proposal["安排状态"], "待确认");
    assert.equal(o.currentArrangement, null);
    assert.equal(o.arrangements.length, 1);
  }
  const v1 = first.proposal["安排版本"];
  first = run(s, resident, "order.respond", first, {
    安排版本: v1,
    居民安排答复: "希望调整",
    居民答复说明: "希望晚半小时",
  });
  first = run(s, merchant, "order.arrange", first, {
    ...schedule,
    安排开始时间: "09:30",
    安排结束时间: "11:30",
  });
  assert.throws(
    () =>
      run(s, resident, "order.respond", first, {
        安排版本: v1,
        居民安排答复: "接受",
      }),
    /安排已变化/,
  );
  first = acceptProposal(s, first);
  assert.equal(first.currentArrangement["安排开始时间"], "09:30");
  assert.equal(first.arrangements.length, 2);
  assert.equal(first.arrangements[0]["居民安排答复"], "希望调整");
});

test("AC02-016 换人不静默生效，居民第二次接受后旧码失效且实际履约取新人员", () => {
  const s = setup("S02-POINT-READY");
  let o = service.query(s, resident, "orders")[0];
  const oldCode = o["到点凭证码"];
  const person = run(s, merchant, "personnel.save", null, {
    姓名: "李师傅",
    工作联系电话: "13800006666",
    可执行服务类目: [raw(s, o._id)._category],
    技能说明: "按本单服务类目执行",
  });
  o = run(s, merchant, "order.arrange", o, {
    ...schedule,
    服务人员: person._id,
    改期原因: "原人员需换班",
    原安排仍可履行: true,
  });
  assert.equal(o.currentArrangement["服务人员"], "P-A");
  assert.equal(o["到点凭证码"], oldCode);
  o = acceptProposal(s, o);
  assert.equal(o.currentArrangement["服务人员"], person._id);
  assert.notEqual(o["到点凭证码"], oldCode);
  assert.equal(o.arrangements[0]["安排状态"], "已替代");
  clock(s, "2026-11-07T09:00:00+08:00");
  assert.throws(
    () =>
      run(s, merchant, "order.verify", o, {
        到点凭证码: oldCode,
        当前核验地点: "POINT-A",
        确认到点: true,
      }),
    /旧安排/,
  );
  o = run(s, merchant, "order.verify", o, {
    到点凭证码: o["到点凭证码"],
    当前核验地点: "POINT-A",
    确认到点: true,
  });
  o = run(s, merchant, "order.start", o);
  assert.equal(o.currentArrangement["服务人员"], person._id);
  assert.equal(o.rounds.at(-1)["实际执行人员姓名"], "李师傅");
  assert.ok(o.rounds.at(-1)["开始记录操作人"]);
  assert.notEqual(o.rounds.at(-1)["开始记录操作人"], "李师傅");
});

test("AC02-018 同人员同时间可有两单，有效安排查询不将第三单未接受提案算库存", () => {
  const s = setup();
  let a = arrange(s, paid(s)),
    b = arrange(s, paid(s)),
    c = run(s, merchant, "order.accept", paid(s), schedule);
  const result = service.query(s, merchant, "orders", {
    安排查询日期: "2026-11-07",
  });
  assert.deepEqual(result.map((o) => o._id).sort(), [a._id, b._id].sort());
  assert.equal(c.proposal["安排状态"], "待确认");
  assert.equal(c.currentArrangement, null);
  assert.equal(
    a.currentArrangement["服务人员"],
    b.currentArrangement["服务人员"],
  );
});

test("AC02-020 到点当日偏时须说明，跨日必须先改期并由居民接受", () => {
  const s = setup("S02-POINT-READY");
  let o = service.query(s, resident, "orders")[0];
  const payload = {
    到点凭证码: o["到点凭证码"],
    当前核验地点: "POINT-A",
    确认到点: true,
  };
  clock(s, "2026-11-08T09:30:00+08:00");
  assert.throws(
    () =>
      run(s, merchant, "order.verify", o, { ...payload, 核验说明: "隔日到达" }),
    /服务日期不符/,
  );
  assert.equal(raw(s, o._id).credential["凭证状态"], "有效");
  clock(s, "2026-11-07T12:00:00+08:00");
  assert.throws(() => run(s, merchant, "order.verify", o, payload), /核验说明/);
  assert.equal(raw(s, o._id).credential["凭证状态"], "有效");
  o = run(s, merchant, "order.verify", o, {
    ...payload,
    核验说明: "双方确认当日晚到接待",
  });
  assert.equal(o["履约状态"], "已到点");
  assert.equal(o.credential["核验说明"], "双方确认当日晚到接待");
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "分账").length,
    0,
  );
});

test("AC02-017 正常完成一年后有额度仍可申请售后，不因完成天数关闭", () => {
  const s = setup(),
    o = complete(s);
  clock(s, "2028-01-01T10:00:00+08:00");
  const sale = run(s, resident, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "较早服务的问题",
    申请退款金额: "10.00",
  });
  assert.equal(sale["售后状态"], "待处理");
  assert.equal(raw(s, o._id)["结案结果"], "正常完成");
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "支付").length,
    1,
  );
});

test("AC02-036 评价在本人、商户和公开项目入口分权，公开评价不泄露订单联系人", () => {
  const s = setup(),
    o = complete(s),
    e = run(s, resident, "evaluation.save", o, {
      总体评分: 4,
      评价内容: "清洁完成情况的公开反馈",
    });
  assert.equal(
    service.record(s, resident, "evaluations", e._id)["总体评分"],
    4,
  );
  assert.equal(
    service.record(s, merchant, "evaluations", e._id)["总体评分"],
    4,
  );
  assert.throws(
    () => service.record(s, otherResident, "evaluations", e._id),
    /无权访问/,
  );
  const publicEntries = [
    service.record(s, otherResident, "services", "SV-HOME"),
    ...service
      .query(s, otherResident, "services")
      .filter((v) => v._id === "SV-HOME"),
  ];
  for (const p of publicEntries) {
    assert.equal(p.evaluations.length, 1);
    const row = p.evaluations[0];
    assert.match(row["评价人公开名称"], /\*\*/);
    for (const k of [
      "联系人姓名",
      "联系人电话",
      "服务订单号",
      "上门服务地址",
      "所属房屋",
    ])
      assert.equal(row[k], undefined);
    assert.ok(!JSON.stringify(row).includes("13800005555"));
  }
});

test("AC02-039 回退失败后原请求合法重试成功才退款，退款与售后完成分别可追溯", () => {
  const s = setup("S02-FUNDS-REFUND"),
    o = service.query(s, resident, "orders")[0];
  let sale = run(s, resident, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "后续服务问题",
    申请退款金额: "10.00",
  });
  service.auxiliary(s, web, "mode", { kind: "rollback", outcome: "failure" });
  sale = run(s, merchant, "aftersale.plan", sale, {
    方案处理类型: "全额退款",
    方案说明: "同意退还",
  });
  sale = run(s, resident, "aftersale.respond", sale, {
    方案版本: 1,
    居民方案答复: "同意",
  });
  const back = rows(s, "funds").find((f) => f["资金类型"] === "回退"),
    refund = rows(s, "funds").find((f) => f["资金类型"] === "退款");
  assert.equal(back["资金状态"], "失败");
  assert.equal(refund["资金状态"], "受阻");
  const backId = back._id,
    refundId = refund._id;
  service.auxiliary(s, web, "mode", { kind: "rollback", outcome: "normal" });
  run(s, web, "fund.retry", back);
  assert.equal(raw(s, backId)["资金状态"], "成功");
  assert.equal(raw(s, backId)["请求次数"], 2);
  assert.equal(raw(s, refundId)["资金状态"], "成功");
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "回退").length,
    1,
  );
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "退款").length,
    1,
  );
  assert.equal(raw(s, sale._id)["执行状态"], "执行完成");
  assert.equal(raw(s, sale._id)["售后状态"], "已解决");
});

test("AC02-040 未知差异不按0计算，核查和原请求查询不能靠表单伪造终态", () => {
  const s = setup("S02-FUNDS-EXCEPTION"),
    f = rows(s, "funds").find((f) => f["资金类型"] === "分账"),
    e = rows(s, "exceptions").find((e) => e._fund === f._id),
    before = structuredClone(f);
  assert.equal(e["渠道确认金额"], null);
  assert.equal(e["金额差异"], null);
  run(s, web, "fund.note", e, {
    本次核查说明: "待渠道进一步核验",
    渠道确认金额: "89.00",
    金额差异: "0.00",
    资金状态: "成功",
  });
  assert.equal(raw(s, e._id)["渠道确认金额"], null);
  assert.equal(raw(s, e._id)["金额差异"], null);
  assert.equal(raw(s, f._id)["资金状态"], "结果未知");
  assert.equal(raw(s, f._id)["资金金额"], before["资金金额"]);
  run(s, web, "fund.query", f, { 资金状态: "成功" });
  assert.equal(raw(s, f._id)["资金状态"], "结果未知");
  assert.equal(
    rows(s, "funds").filter((x) => x["资金类型"] === "分账").length,
    1,
  );
  assert.throws(
    () => run(s, limited, "fund.note", e, { 本次核查说明: "越权核查" }),
    /Web办理权限/,
  );
  assert.equal(
    service.query(s, resident, "funds").some((x) => x._id === f._id),
    false,
  );
});

test("AC02-029 补充履约后二次异议保留原问题记录且一单只一个进行中售后", () => {
  const s = setup("S02-REWORK");
  let o = service.query(s, resident, "orders")[0],
    sale = service.query(s, resident, "aftersales")[0];
  o = run(s, merchant, "order.arrange", o, {
    ...schedule,
    安排开始时间: "10:00",
    安排结束时间: "12:00",
  });
  o = acceptProposal(s, o);
  o = result(s, o, { begin: "10:00", end: "11:00" });
  o = run(s, resident, "order.confirm", o, {
    当前待确认结果版本: o.result["结果版本"],
    居民结果答复: "有异议",
    问题说明: "补充履约仍未达约定",
  });
  const active = rows(s, "aftersales").filter(
    (x) => x._order === o._id && !["已解决", "已撤回"].includes(x["售后状态"]),
  );
  assert.equal(active.length, 1);
  assert.equal(active[0]._id, sale._id);
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "支付").length,
    1,
  );
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "分账").length,
    0,
  );
  assert.equal(o.rounds.length, 2);
});

test("AC02-037 辅助规则版本仅影响新单，旧单规则和金额快照保留且专属复位回V1", () => {
  const s = setup(),
    old = paid(s),
    original = structuredClone(raw(s, old._id).ruleSnapshot);
  service.auxiliary(s, web, "rule-version", { version: "DEMO-ALLOC-V2" });
  const next = paid(s);
  assert.equal(raw(s, old._id).ruleSnapshot.version, "DEMO-ALLOC-V1");
  assert.deepEqual(raw(s, old._id).ruleSnapshot, original);
  assert.equal(raw(s, next._id).ruleSnapshot.version, "DEMO-ALLOC-V2");
  assert.equal(
    raw(s, next._id).ruleSnapshot.allocation.version,
    "DEMO-ALLOC-V2",
  );
  assert.equal(raw(s, next._id).ruleSnapshot.allocation.amount, 9900);
  assert.equal(
    service.record(s, web, "orders", old._id)["资金规则版本"],
    "DEMO-ALLOC-V1",
  );
  assert.equal(
    service.record(s, web, "orders", next._id)["资金规则版本"],
    "DEMO-ALLOC-V2",
  );
  service.reset(s, web);
  const afterReset = paid(s);
  assert.equal(raw(s, afterReset._id).ruleSnapshot.version, "DEMO-ALLOC-V1");
});

test("AC02-035 已执行裁定仅追加说明，旧结论及资金事实不变且同请求不重复追加", () => {
  const s = setup("S02-RULING");
  let sale = service.query(s, web, "aftersales")[0];
  sale = run(s, web, "aftersale.ruling", sale, {
    裁定结果: "不予退款",
    裁定说明: "原已核实公开结论",
    裁定作出人: "线下负责人",
    裁定作出时间: "2026-11-07T10:00:00+08:00",
  });
  sale = run(s, web, "aftersale.execute", sale);
  const rulingBefore = structuredClone(raw(s, sale._id).rulings),
    fundsBefore = structuredClone(rows(s, "funds")),
    historyBefore = raw(s, sale._id).history.length;
  assert.throws(
    () =>
      run(s, merchant, "aftersale.rulingNote", sale, { 追加说明: "商户越权" }),
    /Web办理权限/,
  );
  assert.throws(
    () =>
      run(s, limited, "aftersale.rulingNote", sale, {
        追加说明: "受限Web越权",
      }),
    /Web办理权限/,
  );
  assert.throws(
    () => run(s, web, "aftersale.rulingNote", sale, { 追加说明: "" }),
    /追加说明/,
  );
  const payload = {
    id: sale._id,
    revision: raw(s, sale._id)._rev,
    operationId: "VARIANT-NOTE-ONE",
    data: {
      追加说明: "执行后补充线下查明事实",
      裁定结果: "全额退款",
      裁定退款金额: "99.00",
      资金状态: "成功",
    },
  };
  service.command(s, web, "aftersale.rulingNote", payload);
  const afterFirst = structuredClone(raw(s, sale._id));
  service.command(s, web, "aftersale.rulingNote", payload);
  assert.deepEqual(raw(s, sale._id), afterFirst);
  assert.deepEqual(raw(s, sale._id).rulings, rulingBefore);
  assert.deepEqual(rows(s, "funds"), fundsBefore);
  assert.equal(raw(s, sale._id).history.length, historyBefore + 1);
  assert.ok(
    JSON.stringify(service.record(s, web, "aftersales", sale._id)).includes(
      "执行后补充线下查明事实",
    ),
  );
});

test("AC02-016 到场后人员被停用仍须在开始服务时重查，不能凭旧到场状态绕过", () => {
  const s = setup("S02-HOME-READY");
  let o = service.query(s, resident, "orders")[0];
  clock(s, "2026-11-07T09:00:00+08:00");
  o = run(s, merchant, "order.arrive", o, { 到场说明: "已到场待开始" });
  run(s, merchant, "personnel.status", "P-A", {
    状态: "停用",
    启停原因: "临时无法服务",
  });
  assert.throws(() => run(s, merchant, "order.start", o), /人员|资质/);
  assert.equal(raw(s, o._id)["履约状态"], "已到场");
  assert.equal(raw(s, o._id).rounds.at(-1)["开始记录时间"], undefined);
});

test("AC02-035 退款在途的生效裁定只可补说明，不能改结论或另起退款", () => {
  const s = setup("S02-RULING");
  let sale = service.query(s, web, "aftersales")[0];
  sale = run(s, web, "aftersale.ruling", sale, {
    裁定结果: "部分退款",
    裁定退款金额: "30.00",
    裁定说明: "按实际部分退款",
    裁定作出人: "线下负责人",
    裁定作出时间: "2026-11-07T10:00:00+08:00",
  });
  service.auxiliary(s, web, "mode", { kind: "refund", outcome: "pending" });
  sale = run(s, web, "aftersale.execute", sale);
  assert.equal(sale["执行状态"], "执行中");
  const beforeFunds = structuredClone(rows(s, "funds")),
    beforeRulings = structuredClone(raw(s, sale._id).rulings);
  assert.throws(
    () =>
      run(s, web, "aftersale.ruling", sale, {
        裁定结果: "全额退款",
        裁定说明: "尝试改写",
        更正原因: "渠道仍在途",
        裁定作出人: "线下负责人",
        裁定作出时间: "2026-11-07T10:00:00+08:00",
      }),
    /资金执行事实|在途/,
  );
  run(s, web, "aftersale.rulingNote", sale, {
    追加说明: "仅说明已向渠道查询，等待原退款结果",
  });
  assert.deepEqual(rows(s, "funds"), beforeFunds);
  assert.deepEqual(raw(s, sale._id).rulings, beforeRulings);
  assert.equal(raw(s, sale._id)["执行状态"], "执行中");
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "退款").length,
    1,
  );
});

test("AC02-021/042 居民结果异议不能借用其他住户成功上传的图片变成可读售后证据", () => {
  const s = setup();
  let o = result(s, arrange(s, paid(s)));
  s.attachments["S02-OTHER-RESIDENT-PHOTO"] = {
    stage02: true,
    owner: "resident-b",
    name: "他人照片.png",
    type: "image/png",
    size: 50,
    status: "成功",
  };
  assert.throws(
    () =>
      service.attachmentId(s, resident, {
        attachmentId: "S02-OTHER-RESIDENT-PHOTO",
      }),
    /无权预览/,
  );
  let rejected = false,
    readable = false;
  try {
    o = run(s, resident, "order.confirm", o, {
      当前待确认结果版本: o.result["结果版本"],
      居民结果答复: "有异议",
      问题说明: "借用他人证据的非法提交",
      问题图片: ["S02-OTHER-RESIDENT-PHOTO"],
    });
    const sale = rows(s, "aftersales").find((x) => x._order === o._id);
    readable =
      service.attachmentId(s, resident, {
        table: "aftersales",
        id: sale._id,
        attachmentId: "S02-OTHER-RESIDENT-PHOTO",
      }) === "S02-OTHER-RESIDENT-PHOTO";
  } catch (e) {
    assert.match(e.message, /本人|上传|附件/);
    rejected = true;
  }
  assert.equal(
    rejected,
    true,
    "结果异议接受了非本人附件，绑定后可读=" + readable,
  );
  assert.equal(rows(s, "aftersales").length, 0);
});

test("AC02-027/042 商户方案额外字段不能改售后归属、伪造裁定或注入执行事实", () => {
  const s = setup("S02-RULING"),
    sale = service.query(s, merchant, "aftersales")[0],
    before = structuredClone(raw(s, sale._id));
  let rejected = false;
  try {
    run(s, merchant, "aftersale.plan", sale, {
      方案处理类型: "部分退款",
      拟退款金额: "10.00",
      金额依据说明: "按实际未履行部分",
      方案说明: "合法产品字段附带恶意内部字段",
      _shop: "SHOP-B",
      _resident: "resident-b",
      _order: "FAKE-OTHER-ORDER",
      _refund: "FAKE-REFUND",
      rulings: [
        { 裁定结果: "全额退款", 裁定有效状态: "生效", 执行状态: "待执行" },
      ],
      history: [],
    });
  } catch (e) {
    assert.match(e.message, /字段|无权|输入|方案|归属/);
    rejected = true;
  }
  const after = raw(s, sale._id);
  assert.equal(after._shop, before._shop, "商户方案改写了售后商户归属");
  assert.equal(after._resident, before._resident);
  assert.equal(after._order, before._order);
  assert.equal(after._refund, before._refund);
  assert.deepEqual(after.rulings, before.rulings);
  assert.ok(after.history.length >= before.history.length);
  if (rejected) assert.deepEqual(after, before);
});

test("AC02-036/042 评价监管证据只授予Web，双方及受限Web不能由投影历史或附件别名读取", () => {
  const s = setup(),
    o = complete(s);
  let e = run(s, resident, "evaluation.save", o, {
    总体评分: 3,
    评价内容: "正常评价内容",
  });
  const proof = "S02-REGULATORY-PROOF";
  s.attachments[proof] = {
    stage02: true,
    owner: "property-admin",
    name: "监管依据.png",
    type: "image/png",
    size: 50,
    status: "成功",
    visibility: "business",
  };
  e = run(s, web, "evaluation.status", e, {
    状态: "受限",
    评价限制原因: "涉及他人隐私",
    评价监管证据: [proof],
  });
  for (const ctx of [resident, merchant, limited]) {
    const projected = [
      service.record(s, ctx, "evaluations", e._id),
      ...service.query(s, ctx, "evaluations").filter((x) => x._id === e._id),
    ];
    for (const row of projected) {
      assert.ok(
        !JSON.stringify(row).includes(proof),
        "评价投影或监管历史泄露内部证据给" + ctx.account,
      );
      assert.equal(row["评价监管证据"], undefined);
    }
    for (const field of [undefined, "评价图片", "评价监管证据"])
      assert.throws(() =>
        service.attachmentId(s, ctx, {
          table: "evaluations",
          id: e._id,
          attachmentId: proof,
          field,
        }),
      );
    assert.throws(() => service.attachmentId(s, ctx, { attachmentId: proof }));
  }
  assert.equal(
    service.attachmentId(s, web, {
      table: "evaluations",
      id: e._id,
      attachmentId: proof,
    }),
    proof,
  );
  assert.equal(service.attachmentId(s, web, { attachmentId: proof }), proof);
  s.attachments["S02-FOREIGN-RESTORE-PROOF"] = {
    stage02: true,
    owner: "resident-b",
    name: "别人文件.png",
    type: "image/png",
    size: 50,
    status: "成功",
  };
  const original = structuredClone(raw(s, e._id));
  assert.throws(
    () =>
      run(s, web, "evaluation.status", e, {
        状态: "显示",
        评价监管证据: ["S02-FOREIGN-RESTORE-PROOF"],
      }),
    /本人|上传|附件/,
  );
  assert.deepEqual(raw(s, e._id), original);
});

test("AC02-042 纯文本附件编号和未知附件字段不能建立读取授权", () => {
  const s = setup("S02-IN-SERVICE"),
    o = service.query(s, merchant, "orders")[0],
    key = "S02-FOREIGN-UNBOUND";
  s.attachments[key] = {
    stage02: true,
    owner: "resident-b",
    name: "不属于本单.png",
    type: "image/png",
    status: "成功",
    size: 30,
  };
  run(s, merchant, "order.process", o, {
    过程说明: key,
    过程图片: [],
    未知附件: [key],
  });
  const saved = raw(s, o._id).rounds.at(-1).process.at(-1);
  assert.equal(saved["未知附件"], undefined);
  for (const ctx of [resident, merchant])
    assert.throws(
      () => service.attachmentId(s, ctx, { attachmentId: key }),
      /无权预览/,
    );
});

test("AC02-027/042 允许复用本单真实结果证据，拒绝同居民另一单证据", () => {
  const s = setup();
  let o = result(s, arrange(s, paid(s))),
    another = paid(s);
  const key = "S02-ORIGINAL-RESULT";
  s.attachments[key] = {
    stage02: true,
    owner: "merchant",
    name: "原结果.png",
    type: "image/png",
    status: "成功",
    size: 30,
  };
  o = run(s, merchant, "order.result", o, {
    服务结果: "全部完成",
    实际完成内容: "已完成",
    实际服务结束时间: "2026-11-07T10:00:00+08:00",
    结果图片: [key],
  });
  assert.throws(
    () =>
      run(s, resident, "aftersale.apply", another, {
        申请类型: "申请退款",
        申请原因: "不能借另单附件",
        申请退款金额: "10",
        问题证据: [key],
      }),
    /本人|上传|附件/,
  );
  assert.equal(rows(s, "aftersales").length, 0);
  const sale = run(s, resident, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "复用本单结果",
    申请退款金额: "10",
    问题证据: [key],
  });
  assert.equal(sale["问题证据"][0].id, key);
  assert.equal(
    service.attachmentId(s, resident, {
      table: "aftersales",
      id: sale._id,
      attachmentId: key,
    }),
    key,
  );
});

test("AC02-035/042 追加裁定依据保留原结论且按实际备注绑定限Web读取", () => {
  const s = setup("S02-RULING");
  let sale = service.query(s, web, "aftersales")[0];
  sale = run(s, web, "aftersale.ruling", sale, {
    裁定结果: "不予退款",
    裁定说明: "原结论",
    裁定作出人: "负责人",
    裁定作出时间: "2026-11-07T10:00:00+08:00",
  });
  sale = run(s, web, "aftersale.execute", sale);
  const before = structuredClone(raw(s, sale._id).rulings),
    key = "S02-RULING-NOTE-FILE";
  s.attachments[key] = {
    stage02: true,
    owner: "property-admin",
    name: "追加内部材料.png",
    type: "image/png",
    status: "成功",
    visibility: "business",
    size: 30,
  };
  sale = run(s, web, "aftersale.rulingNote", sale, {
    追加说明: "公开补充说明",
    裁定依据附件: [key],
  });
  assert.deepEqual(raw(s, sale._id).rulings, before);
  assert.ok(sale["裁定依据附件"].some((f) => f.id === key));
  for (const ctx of [resident, merchant, limited]) {
    assert.ok(
      !JSON.stringify(service.record(s, ctx, "aftersales", sale._id)).includes(
        key,
      ),
    );
    assert.throws(() => service.attachmentId(s, ctx, { attachmentId: key }));
  }
  assert.equal(service.attachmentId(s, web, { attachmentId: key }), key);
});

test("AC02-021 居民未明确答复不能因空输入被自动完成和分账", () => {
  const s = setup(),
    o = result(s, arrange(s, paid(s))),
    before = structuredClone(raw(s, o._id));
  assert.throws(
    () =>
      run(s, resident, "order.confirm", o, {
        当前待确认结果版本: o.result["结果版本"],
      }),
    /居民结果答复/,
  );
  assert.deepEqual(raw(s, o._id), before);
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "分账").length,
    0,
  );
});

test("AC02-036/042 公开评价图片经本项目入口可读，限制展示后撤销公开读取且保留本人凭证", () => {
  const s = setup(),
    o = complete(s),
    key = "S02-PUBLIC-EVALUATION-IMAGE";
  s.attachments[key] = {
    stage02: true,
    owner: "resident-a",
    name: "公开服务评价.png",
    type: "image/png",
    size: 80,
    status: "成功",
  };
  let e = run(s, resident, "evaluation.save", o, {
    总体评分: 5,
    评价内容: "公开反馈",
    评价图片: [key],
  });
  assert.equal(
    service.attachmentId(s, otherResident, {
      table: "services",
      id: o._service,
      attachmentId: key,
    }),
    key,
  );
  assert.ok(
    !JSON.stringify(
      service.record(s, otherResident, "services", o._service).evaluations,
    ).includes(o._id),
  );
  e = run(s, web, "evaluation.status", e, {
    状态: "受限",
    评价限制原因: "涉及其他人员隐私",
  });
  assert.equal(
    service.record(s, otherResident, "services", o._service).evaluations.length,
    0,
  );
  assert.throws(() =>
    service.attachmentId(s, otherResident, {
      table: "services",
      id: o._service,
      attachmentId: key,
    }),
  );
  assert.equal(
    service.attachmentId(s, resident, {
      table: "evaluations",
      id: e._id,
      attachmentId: key,
    }),
    key,
  );
});

test("AC02-035 正在执行补充履约的原裁定仅给追加说明动作，不给更正入口", () => {
  const s = setup("S02-RULING");
  let sale = service.query(s, web, "aftersales")[0];
  sale = run(s, web, "aftersale.ruling", sale, {
    裁定结果: "继续或补充履约",
    继续或补充履约内容: "补充完成约定区域",
    裁定说明: "按原约定补充",
    裁定作出人: "负责人",
    裁定作出时间: "2026-11-07T10:00:00+08:00",
  });
  sale = run(s, web, "aftersale.execute", sale);
  assert.ok(sale._actions.some((a) => a.name === "aftersale.rulingNote"));
  assert.equal(
    sale._actions.some((a) => a.name === "aftersale.ruling"),
    false,
  );
});

test("AC02-042 资金账户按敏感权限投影，回退渠道号只限授权Web", () => {
  const s = setup("S02-FUNDS-REFUND"),
    o = service.query(s, resident, "orders")[0];
  const split = rows(s, "funds").find((f) => f["资金类型"] === "分账");
  assert.ok(service.record(s, web, "funds", split._id)["接收账户标识"]);
  assert.ok(service.record(s, merchant, "funds", split._id)["接收账户标识"]);
  assert.equal(
    service.record(s, limited, "funds", split._id)["接收账户标识"],
    undefined,
  );
  let sale = run(s, resident, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "后续服务问题",
    申请退款金额: "10",
  });
  sale = run(s, merchant, "aftersale.plan", sale, {
    方案处理类型: "部分退款",
    拟退款金额: "10",
    金额依据说明: "按未履行部分",
    方案说明: "退还该部分",
  });
  run(s, resident, "aftersale.respond", sale, {
    方案版本: 1,
    居民方案答复: "同意",
  });
  const back = rows(s, "funds").find((f) => f["资金类型"] === "回退");
  assert.ok(service.record(s, web, "funds", back._id)["渠道回退单号"]);
  for (const ctx of [merchant, limited])
    for (const key of ["渠道回退单号", "渠道回退号"])
      assert.equal(service.record(s, ctx, "funds", back._id)[key], undefined);
});

test("AC02-028/039 失败退款释放占用后另一次退款成功，旧失败请求不能再超额恢复", () => {
  const s = setup();
  let o = paid(s);
  service.auxiliary(s, web, "mode", { kind: "refund", outcome: "failure" });
  o = run(s, resident, "order.cancel", o, { 申请原因: "首次取消" });
  const old = rows(s, "funds").find((f) => f["资金类型"] === "退款");
  assert.equal(old["资金状态"], "失败");
  service.auxiliary(s, web, "mode", { kind: "refund", outcome: "normal" });
  let sale = run(s, resident, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "退款未到账核实处理",
    申请退款金额: "99",
  });
  run(s, merchant, "aftersale.plan", sale, {
    方案处理类型: "全额退款",
    方案说明: "按剩余额度退还",
  });
  const successful = rows(s, "funds").filter(
    (f) => f["资金类型"] === "退款" && f["资金状态"] === "成功",
  );
  assert.equal(
    successful.reduce((n, f) => n + f._amount, 0),
    9900,
  );
  const before = structuredClone(s.service);
  for (const action of ["fund.retry", "fund.query"]) {
    assert.throws(() => run(s, web, action, old), /额度|可退|金额|核查/);
    assert.deepEqual(s.service, before);
  }
});

test("AC02-037/038/039 原分账明确失败后发生售后退款，不能用旧金额依据恢复", () => {
  const s = setup("S02-FUNDS-EXCEPTION"),
    o = service.query(s, resident, "orders")[0];
  let split = rows(s, "funds").find((f) => f["资金类型"] === "分账");
  service.auxiliary(s, web, "mode", { kind: "split", outcome: "failure" });
  run(s, web, "fund.query", split);
  split = raw(s, split._id);
  assert.equal(split["资金状态"], "失败");
  service.auxiliary(s, web, "mode", { kind: "split", outcome: "normal" });
  let sale = run(s, resident, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "部分服务问题",
    申请退款金额: "20",
  });
  assert.throws(() => run(s, web, "fund.retry", split), /售后|核查/);
  sale = run(s, merchant, "aftersale.plan", sale, {
    方案处理类型: "部分退款",
    拟退款金额: "20",
    金额依据说明: "按未履行部分",
    方案说明: "退还未履行部分",
  });
  run(s, resident, "aftersale.respond", sale, {
    方案版本: 1,
    居民方案答复: "同意",
  });
  assert.equal(
    rows(s, "funds")
      .filter((f) => f["资金类型"] === "退款" && f["资金状态"] === "成功")
      .reduce((n, f) => n + f._amount, 0),
    2000,
  );
  const before = structuredClone(s.service);
  for (const action of ["fund.retry", "fund.query"]) {
    assert.throws(() => run(s, web, action, split), /依据金额|核查/);
    assert.deepEqual(s.service, before);
  }
});
