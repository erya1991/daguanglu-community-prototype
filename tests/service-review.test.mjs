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
  assert.equal(api.overview(s, W).values["期间退款成功金额"], "189.00");
  assert.equal(
    api.overview(s, W, { merchant: "SHOP-B" }).values["期间净收款"],
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
  sale = run(s, R, "aftersale.respond", sale, {
    方案版本: sale["方案版本"],
    居民方案答复: "不同意",
    居民方案答复说明: "请继续协商",
  });
  assert.equal(sale["居民方案答复人"], s.accounts.find(a => a._id === R.account)["人员姓名"]);
  assert.ok(sale["居民方案答复时间"]);
  for (const a of [M, W])
    assert.equal(api.overview(s, a).values["当前售后待处理数"], 1);
  sale = run(s, M, "aftersale.plan", sale, {
    方案处理类型: "部分退款",
    拟退款金额: "10",
    金额依据说明: "重新协商",
    方案说明: "按新方案",
    业务结案方式: "部分履行终止",
  });
  api.auxiliary(s, W, "mode", { kind: "refund", outcome: "pending" });
  run(s, R, "aftersale.respond", sale, {
    方案版本: sale["方案版本"],
    居民方案答复: "同意",
  });
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
test("S02-GAP-06 必填规格配置提示及下单描述分别强制校验", () => {
  const s = setup(),
    d = draft(s);
  Object.assign(d["服务规格集合"][0], {
    服务对象填写要求: "必填",
    服务对象填写提示: "",
  });
  let v = run(s, M, "service.save", null, d);
  assert.throws(() => run(s, M, "service.submit", v), /提示/);
  d["服务规格集合"][0]["服务对象填写提示"] = "请描述需清洁的对象";
  v = publish(s, d);
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
