import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../prototype-shared/core.js";
import * as api from "../prototype-shared/service/index.js";
const M = { app: "merchant", account: "merchant" },
  B = { app: "merchant", account: "service-merchant-b" },
  R = { app: "resident", account: "resident-a" },
  W = { app: "web", account: "property-admin" },
  P = { app: "web", account: "platform-admin" },
  L = { app: "web", account: "service-web-limited" };
let sequence = 0;
const copy = (x) => structuredClone(x),
  raw = (s, id) =>
    Object.values(s.service)
      .filter(Array.isArray)
      .flat()
      .find((r) => r?._id === id);
function setup(scene) {
  const s = createSeed();
  api.prepare(s);
  // These review fixtures exercise existing V1.1 records without migrating them.
  s.service.fixtureLegacyOrders = true;
  s.service.clockMode = "fixed";
  if (scene) api.auxiliary(s, W, "scenario", { name: scene });
  return s;
}
function run(s, a, name, r, data = {}, extra = {}) {
  const id = r?._id;
  return api.command(s, a, name, {
    id,
    revision: raw(s, id)?._rev,
    operationId: "REVIEW-" + ++sequence,
    data,
    ...extra,
  }).record;
}
function draft(s, key = "SV-HOME") {
  return copy(raw(s, key).published);
}
function booking(s, key = "SV-HOME", method) {
  const v = raw(s, key),
    sp = v.published["服务规格集合"][0],
    c = sp["组合集合"][0];
  return {
    选定服务项目: key,
    选定服务规格: sp["规格编号"],
    选定履约方式: method || c._method || c["组合履约方式名称"],
    联系人姓名: "复核居民",
    联系人电话: "13800005555",
    期望时间选择: "时间可协商",
    服务约定确认: true,
    ...(c["组合流程模板"] === "上门"
      ? {
          上门服务地址: {
            所属社区: "C-A",
            所属小区: "E-A",
            详细地址: "青禾花园1栋101室",
          },
        }
      : { 到点服务地点: c["可服务门店或服务点"][0]["地点业务编号"] }),
  };
}
function publish(s, d) {
  let v = run(s, M, "service.save", null, d);
  v = run(s, M, "service.submit", v);
  v = run(s, W, "service.review", v, { 审核结果: "通过" });
  return run(s, M, "service.publish", v);
}
function ruling(s, sale, type, handling, extra = {}) {
  return run(s, W, "aftersale.ruling", sale, {
    裁定结果: type,
    裁定后业务处理: handling,
    裁定退款金额: "10.00",
    裁定说明: "根据本次线下实际核实结果处理",
    裁定作出人: "线下负责人",
    裁定作出时间: s.service.clock,
    ...extra,
  });
}
function apply(s, o, amount = "10.00") {
  return run(s, R, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "本单质量问题",
    申请退款金额: amount,
  });
}

test("S02-GAP-01 更名稳定引用贯通编辑和新单，旧订单名称及模板快照保留", () => {
  const s = setup(),
    old = run(s, R, "order.create", null, booking(s));
  const before = copy(raw(s, old._id)["服务内容快照"]);
  assert.throws(
    () =>
      run(s, P, "method.save", raw(s, "HOME"), {
        履约方式名称: "预约上门",
        履约方式说明: "上门交付说明",
        绑定流程模板: "上门",
      }),
    /配置变更原因/,
  );
  run(s, P, "method.save", raw(s, "HOME"), {
    配置变更原因: "明确居民可见的方式名称",
    履约方式名称: "预约上门",
    履约方式说明: "按约定上门办理",
    绑定流程模板: "上门",
  });
  let v = run(s, M, "service.save", raw(s, "SV-HOME"), draft(s));
  assert.equal(v["服务规格集合"][0]["组合集合"][0]._method, "HOME");
  v = run(s, M, "service.submit", v);
  v = run(s, W, "service.review", v, { 审核结果: "通过" });
  run(s, M, "service.publish", v);
  const visible = api.record(s, R, "services", "SV-HOME");
  assert.equal(
    visible["服务规格集合"][0]["组合集合"][0]["组合履约方式名称"],
    "预约上门",
  );
  const o = run(s, R, "order.create", null, booking(s));
  assert.equal(o["履约方式名称"], "预约上门");
  assert.equal(o._mode, "上门");
  assert.deepEqual(raw(s, old._id)["服务内容快照"], before);
});
test("S02-GAP-01 新方式必须由类目明确允许，模板不可伪造或改绑", () => {
  const s = setup();
  const method = run(s, P, "method.save", null, {
    履约方式名称: "到家专业保洁",
    履约方式说明: "上门模板的实际方式",
    绑定流程模板: "上门",
  });
  const d = draft(s),
    c = d["服务规格集合"][0]["组合集合"][0];
  c._method = method._id;
  c["组合履约方式名称"] = "到家专业保洁";
  let v = run(s, M, "service.save", null, d);
  assert.throws(() => run(s, M, "service.submit", v), /方式|固定价格/);
  run(s, P, "category.save", raw(s, "CAT-CLEAN"), {
    类目名称: "家庭保洁",
    允许履约方式: ["HOME", method._id],
  });
  v = run(s, M, "service.submit", v);
  v = run(s, W, "service.review", v, { 审核结果: "通过" });
  v = run(s, M, "service.publish", v);
  assert.equal(
    run(s, R, "order.create", null, booking(s, v._id, method._id))._mode,
    "上门",
  );
  assert.throws(
    () =>
      run(s, P, "method.save", method, {
        履约方式名称: "到家专业保洁",
        履约方式说明: "试图改流程",
        绑定流程模板: "预约到点",
      }),
    /模板/,
  );
});
test("S02-GAP-01 停用方式阻断新单，已付旧单仍可安排", () => {
  const s = setup();
  let o = run(s, R, "order.create", null, booking(s));
  o = run(s, R, "order.pay", o);
  run(s, P, "method.status", raw(s, "HOME"), {
    状态: "停用",
    配置变更原因: "暂停新预约",
  });
  assert.throws(
    () => run(s, R, "order.create", null, booking(s)),
    /有效|方式|资格/,
  );
  assert.equal(run(s, M, "order.accept", o)["接单状态"], "已接单");
});
test("S02-GAP-02 越授权、父子错配范围均不可送审，合法范围可发布", () => {
  for (const mismatch of [false, true]) {
    const s = setup(),
      d = draft(s),
      c = d["服务规格集合"][0]["组合集合"][0];
    if (mismatch) {
      const q = s.service.qualifications.find((q) => q._shop === "SHOP-A");
      q["获准社区"] = ["C-A", "C-B"];
      q["获准小区"] = ["E-A", "E-B"];
      Object.assign(c, { 上门覆盖社区: ["C-A"], 上门覆盖小区: ["E-B"] });
    } else Object.assign(c, { 上门覆盖社区: ["C-B"], 上门覆盖小区: ["E-B"] });
    const v = run(s, M, "service.save", null, d);
    assert.throws(() => run(s, M, "service.submit", v), /范围|方式|价格/);
  }
  const s = setup();
  assert.equal(publish(s, draft(s))["上架状态"], "已上架");
  assert.deepEqual(
    api.options(s, M).approvedEstates.map((e) => e.value),
    ["E-A"],
  );
});
test("S02-GAP-02 审核、发布和下单重新校验当前范围，旧单快照不回写", () => {
  for (const action of ["review", "publish", "order"]) {
    const s = setup(),
      old = run(s, R, "order.create", null, booking(s)),
      before = copy(raw(s, old._id)["地点快照"]);
    let v = run(s, M, "service.save", null, draft(s));
    v = run(s, M, "service.submit", v);
    if (action !== "review")
      v = run(s, W, "service.review", v, { 审核结果: "通过" });
    if (action === "order") v = run(s, M, "service.publish", v);
    s.service.qualifications.find((q) => q._shop === "SHOP-A")["获准小区"] = [];
    assert.throws(
      () =>
        action === "review"
          ? run(s, W, "service.review", v, { 审核结果: "通过" })
          : action === "publish"
            ? run(s, M, "service.publish", v)
            : run(s, R, "order.create", null, booking(s, v._id)),
      /范围|方式|有效|价格/,
    );
    assert.deepEqual(raw(s, old._id)["地点快照"], before);
  }
});
test("S02-GAP-03 点位候选仅本商户有效数据，支持多个实际地点", () => {
  const s = setup();
  assert.deepEqual(
    api.options(s, M).points.map((p) => p.value),
    ["POINT-A", "POINT-A2"],
  );
  assert.deepEqual(
    api.options(s, B).points.map((p) => p.value),
    ["POINT-B"],
  );
  const d = draft(s, "SV-POINT");
  d["服务规格集合"][0]["组合集合"][0]["可服务门店或服务点"] = api.options(
    s,
    M,
  ).points;
  const v = publish(s, d);
  for (const code of ["POINT-A", "POINT-A2"]) {
    const data = booking(s, v._id);
    data["到点服务地点"] = code;
    const o = run(s, R, "order.create", null, data);
    assert.equal(o["地点快照"]["地点业务编号"], code);
    assert.ok(o["地点快照"]["联系号码"]);
  }
});
test("S02-GAP-03 伪造归属、停用、快照字段篡改不能绕过点位原资料", () => {
  const s = setup();
  for (const code of ["FORGED", "POINT-B"]) {
    const d = draft(s, "SV-POINT");
    d["服务规格集合"][0]["组合集合"][0]["可服务门店或服务点"] = [
      { 地点业务编号: code, 地点状态: "启用" },
    ];
    assert.throws(() => run(s, M, "service.save", null, d), /本商户|点位/);
  }
  const d = draft(s, "SV-POINT");
  d["服务规格集合"][0]["组合集合"][0]["可服务门店或服务点"] = [
    { 地点业务编号: "POINT-A", 地点名称: "伪造名称", 地点状态: "启用" },
  ];
  const v = publish(s, d),
    o = run(s, R, "order.create", null, booking(s, v._id)),
    before = copy(raw(s, o._id)["地点快照"]);
  s.service.points.find((p) => p["地点业务编号"] === "POINT-A")["地点状态"] =
    "停用";
  assert.throws(
    () => run(s, R, "order.create", null, booking(s, v._id)),
    /地点|方式|有效/,
  );
  assert.deepEqual(raw(s, o._id)["地点快照"], before);
  assert.notEqual(before["地点名称"], "伪造名称");
});
test("S02-GAP-03 点位增量迁移幂等且不覆盖旧订单及其他阶段", () => {
  const s = setup("S02-POINT-READY"),
    old = copy(s.service.orders),
    foundation = copy(s.communities);
  delete s.service.points;
  assert.equal(api.prepare(s), true);
  assert.equal(api.prepare(s), false);
  assert.deepEqual(s.service.orders, old);
  assert.deepEqual(s.communities, foundation);
});
test("S02-GAP-04 完成后部分退款只处理售后资金，保留居民确认和原履约事实", () => {
  const s = setup("S02-EVAL"),
    o = s.service.orders[0],
    before = copy(o);
  let sale = apply(s, o);
  sale = ruling(s, sale, "部分退款", "完成后售后解决");
  run(s, W, "aftersale.execute", sale);
  const after = raw(s, o._id);
  for (const k of [
    "结案结果",
    "结案时间",
    "履约状态",
    "安排状态",
    "当前有效安排编号",
    "居民完成确认状态",
    "居民确认时间",
    "居民确认人",
  ])
    assert.deepEqual(after[k], before[k], k);
  assert.deepEqual(after.rounds, before.rounds);
  assert.equal(
    s.service.funds.filter((f) => f["资金类型"] === "退款").length,
    1,
  );
  assert.ok(api.record(s, W, "aftersales", sale._id)["售后结案说明"]);
});
test("S02-GAP-04 不合法或缺少后续处理被事务拒绝，不能伪造正常完成", () => {
  for (const handling of [undefined, "未服务取消", "正常完成", "按结果执行"]) {
    const s = setup("S02-EVAL"),
      o = s.service.orders[0],
      sale = apply(s, o),
      before = copy(s.service);
    assert.throws(() => ruling(s, sale, "部分退款", handling), /处理|填写/);
    assert.deepEqual(s.service, before);
  }
});
test("S02-GAP-04 部分退款可继续当前履约，资金事实不等于居民完成或新轮次", () => {
  const s = setup("S02-RULING"),
    o = s.service.orders[0],
    rounds = copy(o.rounds),
    arrangement = o["当前有效安排编号"];
  let sale = api.query(s, M, "aftersales")[0];
  sale = run(s, M, "aftersale.plan", sale, {
    方案处理类型: "部分退款",
    拟退款金额: "10",
    金额依据说明: "协商退还部分金额并继续剩余约定",
    方案说明: "继续原服务",
    业务结案方式: "继续履约",
  });
  run(s, R, "aftersale.respond", sale, {
    方案版本: sale["方案版本"],
    居民方案答复: "同意",
  });
  const after = raw(s, o._id);
  assert.equal(after["结案结果"], "进行中");
  assert.equal(after["当前有效安排编号"], arrangement);
  assert.deepEqual(after.rounds, rounds);
  assert.notEqual(after["居民完成确认状态"], "已确认");
  assert.equal(
    s.service.funds.filter((f) => f["资金类型"] === "分账").length,
    0,
  );
});
test("S02-GAP-04 未服务取消只可全退，补充履约及不予退款均不代居民确认", () => {
  const s = setup("S02-CANCEL-CONFIRMED");
  run(s, R, "order.cancel", s.service.orders[0], {
    申请原因: "已确认但未开始，申请取消",
  });
  let sale = api.query(s, W, "aftersales")[0];
  assert.throws(() => ruling(s, sale, "部分退款", "保留原状态"), /处理/);
  sale = ruling(s, sale, "全额退款", "未服务取消");
  run(s, W, "aftersale.execute", sale);
  assert.equal(s.service.orders[0]["结案结果"], "未服务取消");
  for (const type of ["继续或补充履约", "不予退款"]) {
    const x = setup("S02-RULING"),
      o = x.service.orders[0],
      before = o.rounds.length;
    let a = api.query(x, W, "aftersales")[0];
    a = ruling(
      x,
      a,
      type,
      type === "不予退款" ? "保留原状态" : "继续／补充履约",
      { 继续或补充履约内容: "补充原约定内容" },
    );
    a = run(x, W, "aftersale.execute", a);
    assert.notEqual(raw(x, o._id)["居民完成确认状态"], "已确认");
    assert.equal(
      x.service.funds.filter((f) => f["资金类型"] === "分账").length,
      0,
    );
    assert.throws(() => run(x, W, "aftersale.execute", a), /可执行/);
    assert.equal(raw(x, o._id).rounds.length, before);
  }
});
test("S02-GAP-05 项目类目主体及各指标时间上下文在汇总与下钻一致", () => {
  const s = setup("S02-STATS");
  for (const actor of [M, W])
    for (const filters of [
      { service: "SV-HOME" },
      { category: "CAT-FAN" },
      { merchant: "SHOP-A", category: "CAT-CLEAN" },
      { service: "SV-HOME", category: "CAT-FAN" },
    ]) {
      const r = api.overview(s, actor, filters);
      for (const metric of r.metrics) {
        const rows = api.query(s, actor, metric.table, metric.filters);
        for (const [k, v] of Object.entries(filters))
          assert.equal(metric.filters[k], v);
        if (metric.table === "orders")
          assert.equal(rows.length, metric.value, metric.name);
        else {
          const n = rows.reduce(
            (sum, f) =>
              sum +
              f._amount *
                (metric.name === "期间净收款" && f["资金类型"] === "退款"
                  ? -1
                  : 1),
            0,
          );
          assert.equal((n / 100).toFixed(2), metric.value, metric.name);
        }
      }
    }
  assert.equal(
    api.overview(s, W, { category: "NO-SUCH-CATEGORY" }).values["创建订单数"],
    0,
  );
  assert.equal(api.overview(s, W, {start:"2026-11-01",end:"2026-11-06"}).values["期间退款成功金额"], "189.00");
  assert.equal(
    api.overview(s, W, { merchant: "SHOP-B", start:"2026-11-01",end:"2026-11-06" }).values["期间净收款"],
    "-60.00",
  );
});
test("S02-GAP-05 待居民答复及资金执行中不计商户或Web售后待办", () => {
  const s = setup("S02-RULING");
  let sale = api.query(s, M, "aftersales")[0];
  for (const a of [M, W])
    assert.equal(api.overview(s, a).values["当前售后待处理数"], 1);
  assert.equal(api.overview(s, L).values["当前售后待处理数"], 0);
  sale = run(s, M, "aftersale.plan", sale, {
    方案处理类型: "部分退款",
    拟退款金额: "10",
    金额依据说明: "按已核实部分",
    方案说明: "请居民答复",
    业务结案方式: "部分履行终止",
  });
  for (const a of [M, W])
    assert.equal(api.overview(s, a).values["当前售后待处理数"], 0);
  assert.throws(()=>run(s,R,"aftersale.respond",sale,{方案版本:sale.方案版本,居民方案答复:"不同意"}),/仅支持确认或撤回/);
  assert.equal(api.record(s,R,"aftersales",sale._id).售后状态,"待居民确认方案");
  api.auxiliary(s, W, "mode", { kind: "refund", outcome: "pending" });
  sale = run(s, R, "aftersale.respond", sale, {
    方案版本: sale["方案版本"],
    居民方案答复: "同意",
  });
  assert.equal(sale.plans.at(-1).居民方案答复人, s.accounts.find(a=>a._id===R.account).人员姓名);
  assert.ok(sale.plans.at(-1).居民方案答复时间);
  for (const a of [M, W])
    assert.equal(api.overview(s, a).values["当前售后待处理数"], 0);
});
test("S02-GAP-06 不需要与选填均可空，隐藏旧输入不会进入不需要规格订单", () => {
  for (const requirement of ["不需要", "选填"]) {
    const s = setup(),
      d = draft(s);
    d["服务规格集合"][0]["服务对象填写要求"] = requirement;
    const v = publish(s, d),
      data = booking(s, v._id);
    if (requirement === "不需要")
      data["服务对象描述"] = "上一规格残留的设备描述";
    const o = run(s, R, "order.create", null, data);
    assert.equal(o["服务对象描述"], "");
  }
});
test("S02-GAP-06 规格无需配置提示，下单仍校验服务对象描述", () => {
  const s = setup(),
    d = draft(s);
  Object.assign(d["服务规格集合"][0], {
    服务对象填写要求: "必填",
    服务对象填写提示: "",
  });
  const v = publish(s, d);
  assert.throws(
    () => run(s, R, "order.create", null, booking(s, v._id)),
    /对象描述/,
  );
  const data = booking(s, v._id);
  data["服务对象描述"] = "一台可拆卸循环扇";
  assert.equal(
    run(s, R, "order.create", null, data)["服务对象描述"],
    data["服务对象描述"],
  );
  assert.ok(api.record(s, W, "services", v._id)["审核轮次"]);
});

test("S02-117 人员资质按当前材料日期筛选，不能沿用保存时有效缓存", () => {
  const s = setup(),
    person = raw(s, "P-A"),
    proof = person["人员资质材料"][0];
  Object.assign(proof, {
    长期有效: false,
    生效日期: "2026-01-01",
    有效截止日期: "2026-11-07",
  });
  api.auxiliary(s, W, "clock", { time: "2026-11-08T08:00:00+08:00" });
  assert.equal(
    api
      .query(s, M, "personnel", { 人员资质有效性: "有效" })
      .some((p) => p._id === "P-A"),
    false,
  );
  assert.equal(
    api.query(s, M, "personnel", { 人员资质有效性: "已失效" })[0]._id,
    "P-A",
  );
  assert.equal(api.record(s, M, "personnel", "P-A")["资质有效性"], "已失效");
});
test("S02-117 方式和平台限制筛选读取真实组合，未知手续费与账号不补值", () => {
  const s = setup();
  assert.ok(
    api
      .query(s, W, "services", { 履约方式筛选: "HOME" })
      .some((v) => v._id === "SV-HOME"),
  );
  assert.equal(
    api
      .query(s, W, "services", { 履约方式筛选: "POINT" })
      .some((v) => v._id === "SV-HOME"),
    false,
  );
  assert.ok(
    api
      .query(s, W, "services", { 履约方式筛选: "POINT" })
      .some((v) => v._id === "SV-POINT"),
  );
  assert.deepEqual(
    api.query(s, W, "services", { 服务类目筛选: [] }).map((v) => v._id),
    api.query(s, W, "services").map((v) => v._id),
  );
  assert.equal(api.record(s, W, "personnel", "P-A")["关联工作人员账号"], "");
  const x = setup("S02-EVAL"),
    o = api.query(x, W, "orders")[0];
  assert.equal(o["分账接收主体名称"], o["经营主体名称"]);
  assert.ok(o["手续费金额"] == null);
  assert.ok(o["手续费承担主体"] == null);
});

test("S02-GAP-01 停用方式不再进入居民规格、范围说明及起步价", () => {
  const s = setup();
  run(s, P, "method.status", raw(s, "POINT"), {
    状态: "停用",
    配置变更原因: "停止新的到点预约",
  });
  const v = api.record(s, R, "services", "SV-FAN");
  assert.equal(v["当前展示价"], "89.00");
  assert.deepEqual(v["适用履约方式"], ["上门"]);
  assert.equal(v["服务规格集合"][0]["组合集合"].length, 1);
  assert.equal(v["服务规格集合"][0]["组合集合"][0]._method, "HOME");
});


test("平台管理员可办理全部服务Web菜单和授权材料，旧会话升级保留其他授权", () => {
  const s = setup();
  const grant = s.service.grants["platform-admin"];
  for (const cap of ["read", "config", "manage", "review", "ruling", "funds", "sensitive"]) assert.equal(grant[cap], true);
  const baseline = structuredClone(s.service.orders);
  Object.assign(grant, {config: false, manage: false, review: false, ruling: false, funds: false, sensitive: false});
  assert.equal(api.prepare(s), true);
  assert.deepEqual(s.service.orders, baseline);
  assert.equal(api.prepare(s), false);
  for (const table of ["qualifications", "personnel", "categories", "methods", "services", "orders", "aftersales", "evaluations", "funds", "exceptions"]) assert.doesNotThrow(() => api.query(s, P, table, {}), table);
  assert.doesNotThrow(() => api.overview(s, P, {}));
  assert.equal(grant.sensitive, true);
  assert.equal(s.service.grants["service-web-limited"].sensitive, false);
  assert.equal(s.service.grants["service-web-limited"].funds, false);
  assert.ok(api.query(s, P, "qualifications", {}).some(r => r._actions.some(a => a.name === "qualification.status")));
});


test('二级服务分类创建、层级校验和无原因启停', () => {
  const s=setup();
  const root=run(s,P,'category.save',null,{类目名称:'测试一级'});
  const leaf=run(s,P,'category.save',null,{类目名称:'测试二级',上级类目:root._id});
  assert.throws(()=>run(s,P,'category.save',null,{类目名称:'测试三级',上级类目:leaf._id}),/最多支持二级/);
  assert.throws(()=>run(s,P,'category.save',raw(s,root._id),{类目名称:'测试一级',上级类目:leaf._id}),/循环/);
  run(s,P,'category.status',raw(s,leaf._id),{状态:'停用'});
  assert.equal(raw(s,leaf._id)['类目状态'],'停用');
  run(s,P,'category.status',raw(s,leaf._id),{状态:'启用'});
  assert.equal(raw(s,leaf._id)['类目状态'],'启用');
  assert.throws(()=>run(s,L,'category.status',raw(s,leaf._id),{状态:'停用'}),/权限/);
});

test('分类删除保护子类与业务引用，未引用分类删除后不再可选', () => {
  const s=setup();
  const root=run(s,P,'category.save',null,{类目名称:'可删除一级'});
  const child=run(s,P,'category.save',null,{类目名称:'可删除子类',上级类目:root._id});
  assert.throws(()=>run(s,P,'category.delete',raw(s,root._id)),/下级分类/);
  assert.throws(()=>run(s,P,'category.delete',raw(s,'CAT-CLEAN')),/业务引用/);
  run(s,P,'category.delete',raw(s,child._id));
  assert.equal(api.query(s,P,'categories',{}).some(v=>v._id===child._id),false);
  assert.equal(api.options(s,P).categories.some(v=>v._id===child._id),false);
  assert.equal(raw(s,child._id)._deleted,true);
  run(s,P,'category.delete',raw(s,root._id));
  assert.equal(api.query(s,P,'categories',{}).some(v=>v._id===root._id),false);
});


test('常见服务分类样例二级结构与旧会话增量迁移不覆盖已有数据', () => {
  const s=setup();
  const samples=s.service.categories.filter(c=>c._id.startsWith('S02-SAMPLE-'));
  assert.equal(samples.length,20);
  for(const c of samples) { let depth=1,p=c;while(p['上级类目']){p=s.service.categories.find(x=>x._id===p['上级类目']);assert.ok(p);depth++;assert.ok(depth<=2);} }
  const original=structuredClone(s.service.categories.find(c=>c._id==='CAT-CLEAN'));
  const orders=structuredClone(s.service.orders),qualifications=structuredClone(s.service.qualifications);
  s.service.categories=s.service.categories.filter(c=>!c._id.startsWith('S02-SAMPLE-'));
  s.service.categories.push({_id:'USER-PET',类目名称:'宠物服务',上级类目:'',类目状态:'启用'});
  delete s.service.categorySamplesVersion;
  assert.equal(api.prepare(s),true);
  assert.equal(s.service.categories.filter(c=>c._id.startsWith('S02-SAMPLE-')).length,15);
  assert.deepEqual(s.service.categories.find(c=>c._id==='CAT-CLEAN'),original);
  assert.deepEqual(s.service.orders,orders);assert.deepEqual(s.service.qualifications,qualifications);
  assert.equal(api.prepare(s),false);
  const sample=s.service.categories.find(c=>c._id==='S02-SAMPLE-LIFE-LAUNDRY-1');
  run(s,P,'category.delete',sample);
  api.prepare(s);
  assert.equal(api.query(s,P,'categories',{}).some(c=>c._id===sample._id),false);
});

test('既有会话的末级上提保留 ID、授权、历史与停用效果',()=>{
  const s=setup(),root='S02-SAMPLE-APPLIANCE',id=root+'-AC-1',mid=root+'-AC';
  const leaf=raw(s,id); s.service.categorySamplesVersion=1;
  s.service.categories.push({...leaf,_id:mid,类目名称:'空调清洗',上级类目:root,类目状态:'停用'}); leaf.上级类目=mid;
  const q=s.service.qualifications[0];q.获准服务类目.push(id);
  const orders=structuredClone(s.service.orders);
  assert.equal(api.prepare(s),true);assert.equal(api.prepare(s),false);
  assert.equal(raw(s,id).上级类目,root);assert.equal(raw(s,id).类目状态,'停用');
  assert.ok(q.获准服务类目.includes(id));assert.ok(api.options(s,M).categories.every(c=>c._id!==mid));
  assert.deepEqual(s.service.orders,orders);
});
test('保存并送审在同一事务内校验，重复请求保留同一送审版和原发布价',()=>{
  const s=setup(),shopAccount={app:'merchant',account:'service-merchant-a'},record=api.record(s,shopAccount,'services','SV-HOME');
  const previous=structuredClone(raw(s,record._id));
  const payload={id:record._id,revision:record._rev,operationId:'joint-submit',data:{...record,服务名称:'新名称'}};
  assert.throws(()=>api.command(s,shopAccount,'service.saveAndSubmit',{...payload,data:{...payload.data,服务主图:[]}}));
  assert.deepEqual(raw(s,record._id),previous);
  const foreignImage=raw(s,'SV-FAN')['服务主图'];
  assert.throws(()=>api.command(s,shopAccount,'service.saveAndSubmit',{...payload,data:{...payload.data,服务主图:foreignImage}}),/本人上传/);
  assert.deepEqual(raw(s,record._id),previous);
  const result=api.command(s,shopAccount,'service.saveAndSubmit',payload).record;
  assert.equal(result.审核状态,'待审核');assert.equal(raw(s,record._id).submitted.服务名称,'新名称');
  assert.deepEqual(raw(s,record._id).published,previous.published);
  assert.ok(api.command(s,shopAccount,'service.saveAndSubmit',payload).replayed);
});
test('地址簿免选小区，上门预校验和建单共同验证履约范围', () => {
  const s=setup(), opts=api.options(s,R);
  s.service.fixtureLegacyOrders=false;
  assert.equal(opts.spaceRootName,'大光路社区');
  assert.deepEqual(opts.estates.map(e=>e.value),['E-A']);
  const data={联系人姓名:'林悦',联系人电话:'13800000001',省份:'江苏省',城市:'南京市',区县:'秦淮区',详细地址:'某街12号'};
  const item=api.command(s,R,'address.save',{data:{...data,所属小区:'E-B'}}).record;
  assert.equal(item.所属小区,undefined);
  const book={...booking(s),上门服务地址:item};
  assert.throws(()=>api.preflight(s,R,book),e=>!!e.fields?.履约小区);
  assert.throws(()=>api.preflight(s,R,{...book,履约小区:'E-B'}),e=>!!e.fields?.履约小区);
  assert.deepEqual(api.preflight(s,R,{...book,履约小区:'E-A'}),{valid:true,amount:'99.00'});
  const order=run(s,R,'order.create',null,{...book,履约小区:'E-A'});
  assert.equal(order.地点快照.所属小区,'E-A');
  assert.equal(order.地点快照.详细地址,data.详细地址);
  const typed=api.command(s,R,'address.save',{data:{...data,详细地址:'青禾花园 1栋101'}}).record;
  assert.equal(api.preflight(s,R,{...book,上门服务地址:typed}).valid,true);
  const other=api.command(s,R,'address.save',{data:{...data,城市:'苏州市',区县:'吴中区'}}).record;
  for(const method of [x=>api.preflight(s,R,x),x=>run(s,R,'order.create',null,x)]) {
    assert.throws(()=>method({...book,上门服务地址:other,履约小区:'E-A'}),/覆盖小区/);
    assert.throws(()=>method({...book,上门服务地址:{...data,详细地址:'望江公寓 1栋101'},履约小区:'E-A'}),/覆盖小区/);
  }
});

test("既有待审供给经迁移下架，拒绝保持下架，通过发布当前送审版", () => {
  const s = setup();
  const service = raw(s, "SV-HOME");
  const old = run(s, R, "order.create", null, booking(s, service._id));
  const purchased = run(s, R, "order.pay", old);
  const historical = structuredClone(purchased["服务内容快照"]);
  const current = structuredClone(service.published);
  const save = () => run(s, M, "service.saveAndSubmit", raw(s, service._id), {
    ...current, 服务名称: "新版本保洁",
    服务规格集合: [{ ...current.服务规格集合[0],
      组合集合: [{ ...current.服务规格集合[0].组合集合[0], 组合固定价格: "109.00" }] }],
  });
  let pending = save();
  assert.equal(pending.上架状态, "已下架");
  assert.equal(pending.接收新预约状态, "暂停");
  const rawPending = raw(s, service._id);
  delete rawPending._merchantPaused;
  rawPending.上架状态 = "已上架";
  rawPending.接收新预约状态 = "接收中";
  assert.equal(api.prepare(s), true);
  assert.equal(api.prepare(s), false);
  assert.equal(raw(s, service._id).上架状态, "已下架");
  assert.ok(!api.query(s, R, "services", {}).some(x => x._id === service._id));
  assert.throws(() => run(s, R, "order.create", null, booking(s, service._id)), /审核/);
  assert.throws(() => run(s, M, "service.status", pending, { 状态: "已上架" }), /审核/);
  assert.throws(() => run(s, M, "service.status", pending, { 状态: "恢复接单" }), /当前不可/);
  const denied = run(s, P, "service.review", pending, { 审核结果: "退回" });
  assert.equal(denied.上架状态, "已下架");
  assert.equal(denied.接收新预约状态, "暂停");
  pending = save();
  const approved = run(s, P, "service.review", pending, { 审核结果: "通过" });
  assert.equal(approved.当前发布版本, pending.送审版本);
  assert.equal(approved.上架状态, "已上架");
  assert.equal(approved.接收新预约状态, "接收中");
  assert.equal(api.record(s, R, "services", service._id).服务名称, "新版本保洁");
  const newer = run(s, R, "order.create", null, booking(s, service._id));
  assert.equal(newer._amount, 10900);
  assert.equal(api.record(s, R, "orders", old._id)._amount, 9900);
  assert.deepEqual(api.record(s, R, "orders", old._id)["服务内容快照"], historical);
});
test("通过复审保留商户主动暂停，平台限制优先", () => {
  const s = setup();
  let service = run(s, M, "service.status", raw(s,"SV-HOME"), { 状态: "暂停接单", 暂停原因: "门店休息" });
  service = run(s, M, "service.saveAndSubmit", service, { ...service, 服务简介: "更新时间" });
  service = run(s, P, "service.review", service, { 审核结果: "通过" });
  assert.equal(service.上架状态, "已上架");
  assert.equal(service.接收新预约状态, "暂停");
  service = run(s, M, "service.status", service, { 状态: "恢复接单" });
  assert.equal(service.接收新预约状态, "接收中");
  service = run(s, P, "service.status", service, { 状态: "平台限制", 原因说明: "平台核验" });
  service = run(s, M, "service.saveAndSubmit", service, { ...service, 服务简介: "复审描述" });
  service = run(s, P, "service.review", service, { 审核结果: "通过" });
  assert.equal(service.上架状态, "已下架");
  assert.equal(service.接收新预约状态, "暂停");
  assert.throws(() => run(s,M,"service.status",service,{状态:"已上架"}), /平台限制/);
});
