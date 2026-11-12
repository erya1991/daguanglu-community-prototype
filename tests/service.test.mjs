import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../prototype-shared/core.js";
import * as service from "../prototype-shared/service/index.js";
import { SCENARIOS } from "../prototype-shared/service/seed.js";
import {
  allocations,
  refundable,
  staffEligible,
  qualified,
} from "../prototype-shared/service/common.js";
const resident = { app: "resident", account: "resident-a" },
  otherResident = { app: "resident", account: "resident-b" },
  merchant = { app: "merchant", account: "merchant" },
  merchantB = { app: "merchant", account: "service-merchant-b" },
  web = { app: "web", account: "property-admin" },
  platform = { app: "web", account: "platform-admin" },
  limited = { app: "web", account: "service-web-limited" };
let token = 0;
function setup(scene = "S02-BASE") {
  const s = createSeed();
  service.prepare(s);
  if (scene !== "S02-BASE")
    service.auxiliary(s, web, "scenario", { name: scene });
  return s;
}
const raw = (s, id) =>
  Object.values(s.service)
    .filter(Array.isArray)
    .flat()
    .find((x) => x?._id === id);
const rows = (s, t) => s.service[t];
function run(s, ctx, name, r, data = {}, extra = {}) {
  const key = typeof r === "object" ? r?._id : r;
  return service.command(s, ctx, name, {
    id: key,
    revision: raw(s, key)?._rev,
    operationId: "TEST-" + ++token,
    data,
    ...extra,
  }).record;
}
function createData(s, sv = "SV-HOME") {
  const x = rows(s, "services").find((x) => x._id === sv),
    sp = x.published["服务规格集合"][0],
    combo = sp["组合集合"][0];
  return {
    选定服务项目: sv,
    选定服务规格: sp["规格编号"],
    选定履约方式: combo["组合履约方式名称"],
    联系人姓名: "测试居民",
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
function cloneImage(s) {
  return s.service.services.find((x) => x._id === "SV-HOME")["服务主图"];
}
function order(s, sv = "SV-HOME") {
  return run(s, resident, "order.create", null, createData(s, sv));
}
function arrange(s, o, mode = "上门") {
  o = run(s, merchant, "order.accept", o);
  o = run(s, merchant, "order.arrange", o, {
    服务人员: "P-A",
    安排服务日期: "2026-11-07",
    安排开始时间: "09:00",
    安排结束时间: "11:00",
  });
  return run(s, resident, "order.respond", o, {
    安排版本: o.proposal["安排版本"],
    居民安排答复: "接受",
  });
}
function result(s, o, mode = "上门", partial = false) {
  service.auxiliary(s, web, "clock", { time: "2026-11-07T09:00:00+08:00" });
  o = run(
    s,
    merchant,
    mode === "上门" ? "order.arrive" : "order.verify",
    o,
    mode === "上门"
      ? { 到场说明: "已到场" }
      : {
          到点凭证码: o["到点凭证码"],
          当前核验地点: "POINT-A",
          确认到点: true,
        },
  );
  o = run(s, merchant, "order.start", o);
  service.auxiliary(s, web, "clock", { time: "2026-11-07T10:00:00+08:00" });
  o = run(s, merchant, "order.result", o, {
    服务结果: partial ? "部分完成" : "全部完成",
    实际完成内容: "已完成约定内容",
    未完成内容: partial ? "剩余清洁" : "",
    未完成原因: partial ? "现场条件" : "",
    实际服务结束时间: "2026-11-07T10:00:00+08:00",
    结果图片: [],
  });
  return o;
}
function full(s, sv = "SV-HOME") {
  let o = order(s, sv);
  o = run(s, resident, "order.pay", o);
  o = arrange(s, o);
  o = result(s, o, sv === "SV-POINT" ? "预约到点" : "上门");
  return run(s, resident, "order.confirm", o, {
    当前待确认结果版本: o.result["结果版本"],
    居民结果答复: "确认完成",
  });
}
function sale(s, scene = "S02-RULING") {
  if (scene) service.auxiliary(s, web, "scenario", { name: scene });
  return service.query(s, web, "aftersales")[0];
}
function rulingData(type) {
  return {
    裁定结果: type,
    裁定退款金额: "30.00",
    继续或补充履约内容: "完成剩余服务",
    裁定说明: "线下已作出并提供公开结论",
    裁定作出人: "线下裁定负责人",
    裁定作出时间: "2026-11-07T10:00:00+08:00",
    裁定后业务处理:
      type === "继续或补充履约"
        ? "继续／补充履约"
        : type === "不予退款"
          ? "保留原状态"
          : "部分履行终止",
  };
}

test("AC02-001 上门完整链路、两次确认和独立支付分账", () => {
  const s = setup(),
    o = full(s);
  assert.equal(o["结案结果"], "正常完成");
  assert.equal(o["居民完成确认状态"], "已确认");
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "支付").length,
    1,
  );
  assert.equal(
    rows(s, "funds").find((f) => f["资金类型"] === "分账")["资金金额"],
    "89.00",
  );
  assert.ok(o.rounds[0]["到场记录时间"]);
  assert.ok(o.rounds[0]["开始记录时间"]);
});
test("AC02-002 到点查询不推进、核验与完成分离", () => {
  const s = setup();
  let o = order(s, "SV-POINT");
  o = run(s, resident, "order.pay", o);
  o = arrange(s, o);
  const before = raw(s, o._id)._rev;
  const q = run(s, merchant, "order.verify", o, {
    到点凭证码: o["到点凭证码"],
    确认到点: false,
  });
  assert.equal(q._rev, before);
  assert.equal(q["履约状态"], "未开始");
  o = result(s, o, "预约到点");
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "分账").length,
    0,
  );
  o = run(s, resident, "order.confirm", o, {
    当前待确认结果版本: o.result["结果版本"],
    居民结果答复: "确认完成",
  });
  assert.equal(o["结案结果"], "正常完成");
});
test("AC02-003 申请退回不影响原授权、审核不扩大申请范围", () => {
  const s = setup("S02-QUAL");
  let q = service.query(s, merchant, "qualifications")[0];
  q = run(s, merchant, "qualification.submit", q);
  assert.equal(q["服务经营有效性"], "有效");
  assert.throws(
    () =>
      run(s, web, "qualification.review", q, {
        审核结果: "通过",
        批准服务类目: ["CAT-DRAIN"],
      }),
    /不得超过/,
  );
  q = run(s, web, "qualification.review", q, {
    审核结果: "退回修改",
    审核意见: "补充说明",
  });
  assert.equal(q["申请状态"], "已退回");
  assert.equal(q["服务经营有效性"], "有效");
});
test("AC02-004/016 人员停用列影响订单并阻止新安排，不取消旧单", () => {
  const s = setup("S02-HOME-READY"),
    o = rows(s, "orders")[0];
  let p = service.record(s, merchant, "personnel", "P-A");
  assert.equal(p["未完成安排数量"], 1);
  p = run(s, merchant, "personnel.status", p, {
    状态: "停用",
    启停原因: "暂离岗",
  });
  assert.equal(raw(s, o._id)["结案结果"], "进行中");
  assert.throws(() => run(s, merchant, "order.arrive", o), /人员当前不可执行/);
  assert.equal(p["人员状态"], "停用");
});
test("AC02-005 父类停用阻止新交易、配置模板不能任意编排", () => {
  const s = setup();
  run(s, platform, "category.status", "CAT-HOUSE", {
    状态: "停用",
    配置变更原因: "配置核查",
  });
  assert.throws(() => order(s), /类目/);
  assert.throws(
    () =>
      run(s, platform, "method.save", "HOME", {
        履约方式名称: "取送",
        绑定流程模板: "取送",
      }),
    /只支持/,
  );
  assert.throws(
    () =>
      run(s, merchant, "category.status", "CAT-CLEAN", {
        状态: "停用",
        原因说明: "越权",
      }),
    /Web办理权限/,
  );
});
test("AC02-006 双方式固定价格、地点互斥和无数量叠加", () => {
  const s = setup(),
    sv = service.record(s, resident, "services", "SV-FAN"),
    sp = sv["服务规格集合"][0];
  const data = {
    ...createData(s, "SV-FAN"),
    选定履约方式: "预约到点",
    到点服务地点: "POINT-A",
  };
  delete data["上门服务地址"];
  const o = run(s, resident, "order.create", null, data);
  assert.equal(o["订单应付金额"], "59.00");
  assert.equal(sp["组合集合"].length, 2);
  assert.throws(
    () =>
      run(s, resident, "order.create", null, {
        ...data,
        上门服务地址: { 详细地址: "错误" },
      }),
    /不填写上门/,
  );
});
test("AC02-007 新供给审核发布、旧订单快照不可回写", () => {
  const s = setup();
  const old = order(s);
  let sv = service.record(s, merchant, "services", "SV-HOME");
  sv = run(s, merchant, "service.save", sv, {
    ...sv,
    服务名称: "新版家庭保洁",
    服务规格集合: sv["服务规格集合"].map((sp) => ({
      ...sp,
      组合集合: sp["组合集合"].map((c) => ({ ...c, 组合固定价格: "123.45" })),
    })),
  });
  assert.equal(
    service.record(s, resident, "services", "SV-HOME")["服务名称"],
    "家庭保洁",
  );
  sv = run(s, merchant, "service.submit", sv);
  sv = run(s, web, "service.review", sv, { 审核结果: "通过" });
  run(s, merchant, "service.publish", sv);
  assert.equal(order(s)["订单应付金额"], "123.45");
  assert.equal(raw(s, old._id)["订单应付金额"], "99.00");
  assert.equal(raw(s, old._id)["服务项目名称"], "家庭保洁");
});
test("AC02-008 Web强制下架阻止新单并保留已付款订单", () => {
  const s = setup();
  let o = order(s);
  o = run(s, resident, "order.pay", o);
  run(s, web, "service.status", "SV-HOME", {
    状态: "已下架",
    原因说明: "监管核查",
  });
  assert.throws(() => order(s), /未上架/);
  assert.equal(run(s, merchant, "order.accept", o)["接单状态"], "已接单");
});
test("AC02-009/010 发现筛选、覆盖范围和条件地址", () => {
  const s = setup();
  assert.ok(
    service.query(s, resident, "services", { 搜索关键词: "循环扇" }).length >=
      1,
  );
  assert.throws(
    () =>
      run(s, resident, "order.create", null, {
        ...createData(s),
        联系人电话: "1",
      }),
    /联系电话/,
  );
  assert.throws(
    () =>
      run(s, resident, "order.create", null, {
        ...createData(s),
        上门服务地址: { 所属社区: "C-B", 详细地址: "越界" },
      }),
    /覆盖社区/,
  );
  assert.throws(
    () =>
      run(s, resident, "order.create", null, {
        ...createData(s),
        服务约定确认: false,
      }),
    /确认服务约定/,
  );
});
test("AC02-011/012/037 请求幂等、支付未知恢复、任意新增报价正常分账", () => {
  const s = setup();
  let sv = run(s, merchant, "service.save", null, {
    服务名称: "新增有效服务",
    所属服务类目: "CAT-CLEAN",
    服务简介: "完整固定服务",
    服务详细说明: "单次固定规格",
    公开服务电话: "13800001111",
    规格名称: "标准一次",
    规格说明: "一次完整服务",
    服务主图: cloneImage(s),
    包含内容: "完整服务",
    组合履约方式名称: "上门",
    组合固定价格: "67.35",
    上门覆盖社区: ["C-A"],
    上门覆盖小区: ["E-A"],
  });
  sv = run(s, merchant, "service.submit", sv);
  sv = run(s, web, "service.review", sv, { 审核结果: "通过" });
  run(s, merchant, "service.publish", sv);
  let o = full(s, sv._id);
  const f = rows(s, "funds").find(
    (f) => f._order === o._id && f["资金类型"] === "分账",
  );
  assert.equal(f._amount, allocations(6735).merchant);
  assert.equal(f._allocation.merchant + f._allocation.property, 6735);
  run(s, resident, "order.pay", o);
  run(s, resident, "order.confirm", o, {
    当前待确认结果版本: 1,
    居民结果答复: "确认完成",
  });
  assert.equal(rows(s, "funds").filter((f) => f._order === o._id).length, 2);
  const request = { operationId: "CREATE-ONE", data: createData(s) };
  const a = service.command(s, resident, "order.create", request),
    b = service.command(s, resident, "order.create", request);
  assert.equal(a.id, b.id);
  assert.equal(b.replayed, true);
});
test("AC02-012 未知先查原请求，不能直接重试或重新付款", () => {
  const s = setup();
  let o = order(s);
  service.auxiliary(s, web, "mode", { kind: "payment", outcome: "unknown" });
  o = run(s, resident, "order.pay", o);
  const f = rows(s, "funds")[0];
  assert.throws(() => run(s, resident, "order.pay", o), /不可重复/);
  assert.throws(() => run(s, resident, "fund.retry", f), /须先查询/);
  service.auxiliary(s, web, "mode", { kind: "payment", outcome: "normal" });
  run(s, resident, "fund.query", f);
  assert.equal(
    rows(s, "funds").filter((x) => x["资金类型"] === "支付").length,
    1,
  );
  assert.equal(raw(s, o._id)["支付状态"], "成功");
});
test("AC02-013 关闭未知和迟到付款只退款，不重开服务", () => {
  const s = setup();
  let o = order(s);
  service.auxiliary(s, web, "mode", { kind: "payment", outcome: "unknown" });
  o = run(s, resident, "order.pay", o);
  o = run(s, resident, "order.cancel", o, { 申请原因: "取消未明支付" });
  service.auxiliary(s, web, "mode", { kind: "payment", outcome: "normal" });
  run(s, resident, "fund.query", rows(s, "funds")[0]);
  assert.equal(raw(s, o._id)["结案结果"], "未支付关闭");
  assert.equal(
    rows(s, "funds").find((x) => x["资金类型"] === "退款")._amount,
    9900,
  );
});
test("AC02-014/015 原有效安排保留、新提案必须由本人答复、旧版本拒绝", () => {
  const s = setup("S02-HOME-READY");
  let o = service.query(s, resident, "orders")[0],
    old = o.currentArrangement["安排编号"];
  o = run(s, merchant, "order.arrange", o, {
    服务人员: "P-A",
    安排服务日期: "2026-11-08",
    安排开始时间: "09:00",
    安排结束时间: "11:00",
    改期原因: "双方协调",
    原安排仍可履行: true,
  });
  assert.equal(o.currentArrangement["安排编号"], old);
  assert.throws(
    () =>
      run(s, resident, "order.respond", o, {
        安排版本: 1,
        居民安排答复: "接受",
      }),
    /安排已变化/,
  );
  o = run(s, resident, "order.respond", o, {
    安排版本: 2,
    居民安排答复: "希望调整",
    居民答复说明: "时间不合适",
  });
  assert.equal(o.currentArrangement["安排编号"], old);
});
test("AC02-015 原安排无法兑现不伪装仍正常待服务", () => {
  const s = setup("S02-HOME-READY");
  const o = run(s, merchant, "order.arrange", rows(s, "orders")[0], {
    服务人员: "P-A",
    安排服务日期: "2026-11-08",
    安排开始时间: "09:00",
    安排结束时间: "11:00",
    改期原因: "原人员无法到场",
    原安排仍可履行: false,
  });
  assert.equal(o.currentArrangement, null);
  assert.equal(o.proposal["安排状态"], "待确认");
});
test("AC02-017/018 无期限自动关闭或完成、当日安排仅查有效约定", () => {
  const s = setup("S02-HOME-READY");
  service.auxiliary(s, web, "clock", { time: "2027-12-31T10:00:00+08:00" });
  assert.equal(service.query(s, resident, "orders")[0]["结案结果"], "进行中");
  assert.equal(
    service.query(s, merchant, "orders", { 安排查询日期: "2026-11-07" }).length,
    1,
  );
  assert.equal(
    service.query(s, merchant, "orders", { 安排查询日期: "2026-11-08" }).length,
    0,
  );
});
test("AC02-019/020 节点不可跳步、其他主体与旧码不能核验", () => {
  const s = setup("S02-POINT-READY"),
    o = service.query(s, resident, "orders")[0];
  assert.throws(() => run(s, merchant, "order.start", o), /先到场/);
  assert.throws(
    () =>
      run(s, merchantB, "order.verify", o, {
        到点凭证码: o["到点凭证码"],
        当前核验地点: "POINT-A",
        确认到点: true,
      }),
    /无权访问/,
  );
  service.auxiliary(s, web, "clock", { time: "2026-11-08T09:00:00+08:00" });
  assert.throws(
    () =>
      run(s, merchant, "order.verify", o, {
        到点凭证码: o["到点凭证码"],
        当前核验地点: "POINT-A",
        确认到点: true,
      }),
    /先改期/,
  );
});
test("AC02-021 结果时间和版本受校验，商户不得代居民确认", () => {
  const s = setup("S02-IN-SERVICE");
  let o = service.query(s, resident, "orders")[0];
  assert.throws(
    () =>
      run(s, merchant, "order.result", o, {
        服务结果: "全部完成",
        实际完成内容: "完成",
        实际服务结束时间: "2026-11-07T08:00:00+08:00",
      }),
    /早于开始/,
  );
  service.auxiliary(s, web, "clock", { time: "2026-11-07T10:00:00+08:00" });
  o = run(s, merchant, "order.result", o, {
    服务结果: "全部完成",
    实际完成内容: "完成",
    实际服务结束时间: "2026-11-07T10:00:00+08:00",
  });
  assert.throws(
    () =>
      run(s, merchant, "order.confirm", o, {
        当前待确认结果版本: 1,
        居民结果答复: "确认完成",
      }),
    /订单本人/,
  );
  assert.throws(
    () =>
      run(s, resident, "order.confirm", o, {
        当前待确认结果版本: 0,
        居民结果答复: "确认完成",
      }),
    /版本已变化/,
  );
});
test("AC02-022 部分完成不正常结案或分账", () => {
  const s = setup();
  let o = order(s);
  o = run(s, resident, "order.pay", o);
  o = arrange(s, o);
  o = result(s, o, "上门", true);
  assert.throws(
    () =>
      run(s, resident, "order.confirm", o, {
        当前待确认结果版本: 1,
        居民结果答复: "确认完成",
      }),
    /不能正常完成/,
  );
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "分账").length,
    0,
  );
});
test("AC02-023/025 首次未接受取消及商户无法兑现全退", () => {
  for (const reject of [false, true]) {
    const s = setup();
    let o = order(s);
    o = run(s, resident, "order.pay", o);
    o = reject
      ? run(s, merchant, "order.accept", o, {
          接单结果: "无法承接",
          无法承接说明: "本次无法安排",
        })
      : run(s, resident, "order.cancel", o, { 申请原因: "首次未确认取消" });
    assert.equal(o["结案结果"], "未服务取消");
    assert.equal(
      rows(s, "funds").find((f) => f["资金类型"] === "退款")._amount,
      9900,
    );
  }
});
test("AC02-024 已接受取消核实与开始互锁", () => {
  const s = setup("S02-HOME-READY");
  let o = service.query(s, resident, "orders")[0];
  o = run(s, resident, "order.cancel", o, { 申请原因: "申请核实取消" });
  assert.equal(o["结案结果"], "进行中");
  assert.equal(rows(s, "aftersales")[0]["申请类型"], "核实取消");
  assert.throws(() => run(s, merchant, "order.arrive", o), /阻断/);
});
test("AC02-026/027 方案版本、单进行中售后与撤回补证", () => {
  const s = setup("S02-RULING");
  let sale = service.query(s, resident, "aftersales")[0],
    o = rows(s, "orders")[0];
  assert.throws(
    () =>
      run(s, resident, "aftersale.apply", o, {
        申请类型: "申请退款",
        申请原因: "重复",
      }),
    /已有进行中/,
  );
  sale = run(s, merchant, "aftersale.plan", sale, {
    方案处理类型: "部分退款",
    拟退款金额: "20.00",
    金额依据说明: "协商",
    方案说明: "退还部分",
    业务结案方式: "部分履行终止",
  });
  assert.throws(
    () =>
      run(s, resident, "aftersale.respond", sale, {
        方案版本: 0,
        居民方案答复: "同意",
      }),
    /方案已变更/,
  );
  sale = run(s, resident, "aftersale.evidence", sale, { 追加说明: "补充情况" });
  assert.equal(sale.evidence.length, 1);
  sale = run(s, resident, "aftersale.withdraw", sale, { 撤回原因: "继续协调" });
  assert.equal(sale["售后状态"], "已撤回");
});
test("AC02-028 99实付减20成功减10在途得69，未知不释放占用", () => {
  const s = setup("S02-REFUND-LIMIT"),
    o = rows(s, "orders")[0];
  assert.equal(refundable(s, o), 6900);
  assert.throws(
    () =>
      run(s, resident, "aftersale.apply", o, {
        申请类型: "申请退款",
        申请原因: "超额",
        申请退款金额: "69.01",
      }),
    /超过/,
  );
  const f = rows(s, "funds").find(
    (f) => f["资金类型"] === "退款" && f["资金状态"] === "处理中",
  );
  service.auxiliary(s, web, "mode", { kind: "refund", outcome: "unknown" });
  run(s, merchant, "fund.query", f);
  assert.equal(refundable(s, raw(s, o._id)), 6900);
  service.auxiliary(s, web, "mode", { kind: "refund", outcome: "normal" });
  run(s, merchant, "fund.query", f);
  assert.equal(refundable(s, raw(s, o._id)), 6900);
});
test("AC02-029 补充履约新轮次不新增收费", () => {
  const s = setup("S02-REWORK");
  let o = service.query(s, resident, "orders")[0];
  assert.equal(o["履约状态"], "未开始");
  const paid = rows(s, "funds").filter((f) => f["资金类型"] === "支付").length;
  o = run(s, merchant, "order.arrange", o, {
    服务人员: "P-A",
    安排服务日期: "2026-11-07",
    安排开始时间: "10:00",
    安排结束时间: "12:00",
  });
  o = run(s, resident, "order.respond", o, {
    安排版本: o.proposal["安排版本"],
    居民安排答复: "接受",
  });
  assert.equal(o.rounds.length, 2);
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "支付").length,
    paid,
  );
});
test("AC02-030 未到场异常只留事实，不自动完成或扣费", () => {
  const s = setup("S02-NOSHOW"),
    o = run(s, merchant, "order.anomaly", rows(s, "orders")[0], {
      异常类型: "未到场",
      异常发生时间: "2026-11-07T08:00:00+08:00",
      异常事实说明: "按约核实未到场",
    });
  assert.equal(o.anomalies.length, 1);
  assert.equal(o["履约状态"], "未开始");
  assert.equal(o["结案结果"], "进行中");
});
for (const type of ["全额退款", "部分退款", "继续或补充履约", "不予退款"])
  test("AC02-031~034 裁定 " + type + " 独立生效且不代居民确认", () => {
    const s = setup("S02-RULING");
    let sale = service.query(s, web, "aftersales")[0];
    assert.throws(
      () => run(s, limited, "aftersale.ruling", sale, rulingData(type)),
      /Web办理权限/,
    );
    assert.throws(
      () => run(s, merchant, "aftersale.ruling", sale, rulingData(type)),
      /Web办理权限/,
    );
    sale = run(s, web, "aftersale.ruling", sale, rulingData(type));
    assert.equal(sale["执行状态"], "待执行");
    sale = run(s, web, "aftersale.execute", sale);
    const o = rows(s, "orders")[0];
    assert.notEqual(o["居民完成确认状态"], "已确认");
    if (type.includes("退款") && type !== "不予退款")
      assert.equal(
        rows(s, "funds").filter((f) => f["资金类型"] === "退款").length,
        1,
      );
    if (type === "继续或补充履约") assert.equal(o["安排状态"], "待商家安排");
    if (type === "不予退款") assert.equal(o["结案结果"], "进行中");
  });
test("AC02-035 裁定更正保留旧版，执行后不能无痕更正", () => {
  const s = setup("S02-RULING");
  let r = run(
    s,
    web,
    "aftersale.ruling",
    rows(s, "aftersales")[0],
    rulingData("部分退款"),
  );
  assert.throws(
    () => run(s, web, "aftersale.ruling", r, rulingData("全额退款")),
    /更正原因/,
  );
  r = run(s, web, "aftersale.ruling", r, {
    ...rulingData("全额退款"),
    更正原因: "线下结论更正",
  });
  assert.equal(r.rulings[0]["裁定有效状态"], "已更正");
  assert.equal(r.rulings.length, 2);
  r = run(s, web, "aftersale.execute", r);
  assert.throws(
    () =>
      run(s, web, "aftersale.ruling", r, {
        ...rulingData("部分退款"),
        更正原因: "改写",
      }),
    /资金执行事实/,
  );
});
test("AC02-036 一单一评、整星、退款不删评价和低分监管边界", () => {
  const s = setup(),
    o = full(s);
  assert.throws(
    () => run(s, resident, "evaluation.save", o, { 总体评分: 1.5 }),
    /整星/,
  );
  const e = run(s, resident, "evaluation.save", o, {
    总体评分: 1,
    评价内容: "实际反馈",
  });
  assert.throws(
    () => run(s, resident, "evaluation.save", o, { 总体评分: 5 }),
    /已有评价/,
  );
  assert.throws(
    () =>
      run(s, web, "evaluation.status", e, {
        状态: "受限",
        评价限制原因: "低分",
      }),
    /不得仅因低分/,
  );
  run(s, resident, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "后续问题",
    申请退款金额: "10.00",
  });
  assert.equal(rows(s, "evaluations").length, 1);
});
test("AC02-037 1分与多种新金额返回守恒，不硬套89元", () => {
  for (const cents of [1, 2, 99, 5900, 6735, 9900, 123456]) {
    const a = allocations(cents);
    assert.equal(a.merchant + a.property, cents);
    assert.ok(a.merchant >= 0 && a.property >= 0);
  }
  assert.deepEqual(allocations(1), {
    version: "DEMO-ALLOC-V1",
    merchant: 1,
    property: 0,
    amount: 1,
  });
});
test("AC02-038 规则缺失或进行中售后阻断分账，不伪填0", () => {
  const s = setup("S02-FUNDS-RULE");
  let o = service.query(s, resident, "orders")[0];
  run(s, resident, "order.confirm", o, {
    当前待确认结果版本: 1,
    居民结果答复: "确认完成",
  });
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "分账").length,
    0,
  );
  assert.match(rows(s, "orders")[0]["分账阻断原因"], /规则/);
  const b = setup("S02-RULING");
  o = service.query(b, resident, "orders")[0];
  assert.throws(
    () =>
      run(b, resident, "order.confirm", o, {
        当前待确认结果版本: 1,
        居民结果答复: "确认完成",
      }),
    /售后/,
  );
});
test("AC02-039 已分账退款先回退，回退未知不伪造居民退款成功", () => {
  const s = setup("S02-FUNDS-REFUND"),
    o = rows(s, "orders")[0];
  let sale = run(s, resident, "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "服务后问题",
    申请退款金额: "10.00",
  });
  service.auxiliary(s, web, "mode", { kind: "rollback", outcome: "unknown" });
  sale = run(s, merchant, "aftersale.plan", sale, {
    方案处理类型: "全额退款",
    方案说明: "同意退还",
    业务结案方式: "完成后售后解决",
  });
  sale = run(s, resident, "aftersale.respond", sale, {
    方案版本: 1,
    居民方案答复: "同意",
  });
  const f = rows(s, "funds").find((f) => f["资金类型"] === "退款");
  assert.equal(f["资金状态"], "受阻");
  assert.equal(f["成功时间"], "");
  const back = rows(s, "funds").find((f) => f["资金类型"] === "回退");
  service.auxiliary(s, web, "mode", { kind: "rollback", outcome: "normal" });
  run(s, web, "fund.query", back);
  assert.equal(raw(s, f._id)["资金状态"], "成功");
});
test("AC02-040 人工核查说明不能改未知资金终态", () => {
  const s = setup("S02-FUNDS-EXCEPTION"),
    f = rows(s, "funds").find((f) => f["资金类型"] === "分账");
  run(s, web, "fund.note", f, {
    本次核查说明: "保留原单核查",
    资金状态: "成功",
  });
  assert.equal(raw(s, f._id)["资金状态"], "结果未知");
  assert.throws(
    () => run(s, limited, "fund.note", f, { 本次核查说明: "越权" }),
    /Web办理权限/,
  );
});
test("AC02-041 固定统计、跨期退款、负净收和下钻时间口径", () => {
  const s = setup("S02-STATS"),
    m = service.overview(s, web);
  assert.deepEqual(
    [
      m["创建订单数"],
      m["付款成功订单数"],
      m["正常完成订单数"],
      m["未服务取消订单数"],
      m["部分履行终止订单数"],
    ],
    [5, 5, 1, 1, 1],
  );
  assert.deepEqual(
    [
      m["期间支付成功金额"],
      m["期间退款成功金额"],
      m["期间净收款"],
      m["期间分账成功金额"],
      m["期间回退成功金额"],
    ],
    ["495.00", "189.00", "306.00", "89.00", "30.00"],
  );
  assert.equal(service.overview(s, merchantB)["期间净收款"], "-60.00");
  assert.equal(service.overview(s, merchant)["期间净收款"], "366.00");
  assert.equal(
    service.query(s, web, "funds", {
      metric: "期间退款成功金额",
      start: "2026-11-01",
      end: "2026-11-06",
    }).length,
    3,
  );
  assert.equal(m["已确认服务安排数"], 1);
});
test("AC02-042 主体/本人/应用隔离与内部资金投影", () => {
  const s = setup("S02-ISOLATION"),
    o = rows(s, "orders")[0];
  assert.throws(
    () => service.record(s, otherResident, "orders", o._id),
    /无权访问/,
  );
  assert.throws(
    () => service.record(s, merchantB, "orders", o._id),
    /无权访问/,
  );
  assert.throws(
    () =>
      service.query(s, { app: "staff", account: "property-admin" }, "orders"),
    /不办理便民服务/,
  );
  assert.equal(
    service.record(s, resident, "orders", o._id).ruleSnapshot,
    undefined,
  );
  assert.equal(
    service.query(s, merchantB, "orders").every((x) => x._shop === "SHOP-B"),
    true,
  );
});
test("AC02-042/047 附件本人权限、业务对象引用和内部依据隔离", () => {
  const s = setup("S02-RULING"),
    o = rows(s, "orders")[0];
  s.attachments["S02-UP"] = {
    stage02: true,
    owner: "resident-a",
    name: "照片.png",
    type: "image/png",
    size: 50,
    status: "成功",
  };
  assert.equal(
    service.attachmentId(s, resident, { attachmentId: "S02-UP" }),
    "S02-UP",
  );
  assert.throws(
    () => service.attachmentId(s, otherResident, { attachmentId: "S02-UP" }),
    /无权预览/,
  );
  assert.throws(
    () =>
      service.attachmentId(s, resident, {
        table: "orders",
        id: o._id,
        attachmentId: "S02-UP",
      }),
    /不属于/,
  );
  s.attachments["S02-INTERNAL"] = {
    stage02: true,
    owner: "property-admin",
    name: "内部依据.txt",
    type: "text/plain",
    size: 10,
    status: "成功",
    visibility: "internal",
  };
  let sale = run(s, web, "aftersale.ruling", rows(s, "aftersales")[0], {
    ...rulingData("不予退款"),
    裁定依据附件: ["S02-INTERNAL"],
  });
  assert.equal(
    service.record(s, resident, "aftersales", sale._id)["裁定依据附件"],
    undefined,
  );
  assert.throws(
    () =>
      service.attachmentId(s, resident, {
        table: "aftersales",
        id: sale._id,
        field: "裁定依据附件",
        attachmentId: "S02-INTERNAL",
      }),
    /内部裁定/,
  );
});
test("AC02-047/052 专属复位保留Stage00/01和非本阶段附件/草稿", () => {
  const s = setup("S02-STATS");
  s.stage01 = { untouched: "fact" };
  s.attachments.keep = { name: "其他阶段" };
  s.drafts = {
    "resident-a:stage01:edit": { keep: true },
    "resident-a:service:edit": { drop: true },
  };
  const protect = JSON.stringify({
    houses: s.houses,
    relations: s.relations,
    stage01: s.stage01,
  });
  const removed = [];
  service.reset(s, web, (id) => removed.push(id));
  assert.equal(
    JSON.stringify({
      houses: s.houses,
      relations: s.relations,
      stage01: s.stage01,
    }),
    protect,
  );
  assert.ok(s.attachments.keep);
  assert.ok(s.drafts["resident-a:stage01:edit"]);
  assert.equal(s.drafts["resident-a:service:edit"], undefined);
  assert.equal(s.service.orders.length, 0);
  assert.ok(removed.length >= 1);
});
test("AC02-047 全部场景可重放且保留合法业务历史", () => {
  for (const name of SCENARIOS) {
    const s = setup(name);
    for (const o of s.service.orders) {
      assert.ok(o.history.length);
      assert.ok(o["公共交易订单号"]);
    }
    assert.equal(s.service.scenario, name === "S02-BASE" ? "S02-BASE" : name);
  }
});

test("AC02-042 候选选项不返回商户内部资料，受限Web嵌套电话脱敏", () => {
  const s = setup("S02-POINT-READY"),
    opt = service.options(s, resident);
  assert.ok(
    opt.merchants.every(
      (m) => !m["负责人姓名"] && !m["经营联系电话"] && !m["合作协议编号"],
    ),
  );
  assert.ok(!JSON.stringify(opt.categories).includes("商户资质要求说明"));
  const row = service.record(s, limited, "orders", rows(s, "orders")[0]._id);
  assert.ok(!JSON.stringify(row).includes("13800005555"));
  assert.ok(
    !JSON.stringify(service.options(s, limited).personnel).includes(
      "13800004444",
    ),
  );
});
test("AC02-008/042 暂停及失效供给不混入居民可售查询", () => {
  const s = setup();
  run(s, merchant, "service.status", "SV-HOME", {
    状态: "暂停接单",
    暂停原因: "暂不接新预约",
  });
  assert.equal(
    service.query(s, resident, "services").some((x) => x._id === "SV-HOME"),
    false,
  );
});
test("AC02-003/035 失败命令保持原子性，不留审核或裁定半成品", () => {
  const s = setup("S02-QUAL");
  const q = run(
      s,
      merchant,
      "qualification.submit",
      rows(s, "qualifications")[0],
    ),
    before = JSON.stringify(s.service);
  assert.throws(() =>
    run(s, web, "qualification.review", q, {
      审核结果: "通过",
      批准服务类目: ["CAT-DRAIN"],
    }),
  );
  assert.equal(JSON.stringify(s.service), before);
});

test("AC02-003/004 材料开关按末级类目独立生效，虚假_seed不能代替证明", () => {
  const s = setup();
  const o = rows(s, "qualifications").find((q) => q._shop === "SHOP-A");
  run(s, platform, "category.save", "CAT-CLEAN", {
    类目名称: "家庭保洁",
    上级类目: "CAT-HOUSE",
    商户证明是否必需: true,
    人员证明是否必需: false,
    允许履约方式: ["HOME"],
  });
  assert.throws(() => order(s), /资格/);
  let q = run(s, merchant, "qualification.save", o, {
    申请服务类目: ["CAT-CLEAN"],
    申请覆盖社区: ["C-A"],
    申请覆盖小区: ["E-A"],
    服务资质材料: [
      { 材料名称: "伪造无文件", 对应服务类目: ["CAT-CLEAN"], _seed: true },
    ],
  });
  assert.throws(() => run(s, merchant, "qualification.submit", q), /证明材料/);
  assert.equal(rows(s, "personnel")[0]["人员状态"], "启用");
});
test("AC02-021 结果必需图片从本单快照读取，不能缺图提交", () => {
  const s = setup();
  let o = order(s, "SV-AC");
  o = run(s, resident, "order.pay", o);
  o = arrange(s, o);
  service.auxiliary(s, web, "clock", { time: "2026-11-07T09:00:00+08:00" });
  o = run(s, merchant, "order.arrive", o);
  o = run(s, merchant, "order.start", o);
  service.auxiliary(s, web, "clock", { time: "2026-11-07T10:00:00+08:00" });
  assert.throws(
    () =>
      run(s, merchant, "order.result", o, {
        服务结果: "全部完成",
        实际完成内容: "清洗完成",
        实际服务结束时间: "2026-11-07T10:00:00+08:00",
        结果图片: [],
      }),
    /结果图片/,
  );
});
test("AC02-020 重复核验不重复到点，记录人不取表单自填人", () => {
  const s = setup("S02-POINT-READY");
  let o = service.query(s, merchant, "orders")[0];
  service.auxiliary(s, web, "clock", { time: "2026-11-07T09:00:00+08:00" });
  const payload = {
    到点凭证码: o["到点凭证码"],
    当前核验地点: "POINT-A",
    确认到点: true,
    核验操作人: "伪造人",
  };
  o = run(s, merchant, "order.verify", o, payload);
  assert.notEqual(o["核验操作人"], "伪造人");
  assert.equal(o["履约状态"], "已到点");
  assert.throws(
    () => run(s, merchant, "order.verify", o, payload),
    /有效安排|需要有效/,
  );
  assert.equal(o["结案结果"], "进行中");
});
test("AC02-035 在途资金阻断裁定结果更正", () => {
  const s = setup("S02-RULING"),
    sale = rows(s, "aftersales")[0];
  service.auxiliary(s, web, "mode", { kind: "refund", outcome: "unknown" });
  let r = run(s, web, "aftersale.ruling", sale, rulingData("部分退款"));
  r = run(s, web, "aftersale.execute", r);
  assert.throws(
    () =>
      run(s, web, "aftersale.ruling", r, {
        ...rulingData("全额退款"),
        更正原因: "覆盖在途",
      }),
    /资金执行事实|在途/,
  );
  assert.equal(
    rows(s, "funds").filter((f) => f["资金类型"] === "退款").length,
    1,
  );
});
test("AC02-047 失败保留状态与已提交附件说明快照", () => {
  const s = setup("S02-IN-SERVICE");
  s.attachments.img = {
    stage02: true,
    owner: "merchant",
    name: "照片.png",
    type: "image/png",
    size: 10,
    status: "成功",
    description: "初始说明",
  };
  let o = rows(s, "orders")[0];
  service.auxiliary(s, web, "clock", { time: "2026-11-07T10:00:00+08:00" });
  o = run(s, merchant, "order.result", o, {
    服务结果: "全部完成",
    实际完成内容: "已完成",
    实际服务结束时间: "2026-11-07T10:00:00+08:00",
    结果图片: [{ id: "img", description: "本轮说明", order: 1 }],
  });
  s.attachments.img.description = "后续变化";
  assert.equal(raw(s, o._id).results[0]["结果图片"][0].description, "本轮说明");
  service.auxiliary(s, web, "mode", { kind: "save", outcome: "failure" });
  const before = JSON.stringify(s.service);
  assert.throws(
    () =>
      run(s, resident, "order.confirm", o, {
        当前待确认结果版本: 1,
        居民结果答复: "确认完成",
      }),
    /保存失败/,
  );
  assert.equal(JSON.stringify(s.service), before);
  service.auxiliary(s, web, "mode", { kind: "save", outcome: "normal" });
});

test("AC02-005 类目父子循环被Service拒绝", () => {
  const s = setup();
  assert.throws(
    () =>
      run(s, platform, "category.save", "CAT-HOUSE", {
        类目名称: "家政服务",
        上级类目: "CAT-CLEAN",
      }),
    /循环/,
  );
  assert.equal(raw(s, "CAT-HOUSE")["上级类目"], "");
});
test("AC02-003 资格恢复重新核查实际协议与必需证明", () => {
  const s = setup();
  let q = run(s, web, "qualification.status", "Q-A", {
    状态: "暂停",
    暂停或恢复原因: "核查",
  });
  raw(s, q._id)["协议状态"] = "失效";
  assert.throws(
    () =>
      run(s, web, "qualification.status", q, {
        状态: "恢复",
        暂停或恢复原因: "尝试恢复",
      }),
    /协议/,
  );
  assert.equal(raw(s, q._id)["服务经营有效性"], "受限");
});

test("AC02-005/042 类目图标使用本人成功上传附件，不接受他人文件", () => {
  const s = setup();
  s.attachments.icon = {
    stage02: true,
    owner: "merchant",
    status: "成功",
    name: "他人图标.png",
    type: "image/png",
    size: 10,
  };
  assert.throws(
    () =>
      run(s, platform, "category.save", "CAT-CLEAN", {
        类目名称: "家庭保洁",
        类目图标: [{ id: "icon" }],
      }),
    /本人上传/,
  );
  s.attachments.icon.owner = "platform-admin";
  const r = run(s, platform, "category.save", "CAT-CLEAN", {
    类目名称: "家庭保洁",
    类目图标: [{ id: "icon", description: "分类图片" }],
  });
  assert.equal(r["类目图标"][0].description, "分类图片");
});

test("AC02-043/047 产品字段变化保存真实C3前后值，不覆盖旧历史", () => {
  const s = setup(),
    before = raw(s, "CAT-CLEAN").history.length;
  let c = run(s, platform, "category.save", "CAT-CLEAN", {
    类目名称: "家庭深度保洁",
    上级类目: "CAT-HOUSE",
  });
  assert.equal(
    c.history[before].changes.find((x) => x["变更字段名称"] === "类目名称")[
      "变更前值"
    ],
    "家庭保洁",
  );
  assert.equal(
    c.history[before].changes.find((x) => x["变更字段名称"] === "类目名称")[
      "变更后值"
    ],
    "家庭深度保洁",
  );
  const snapshot = JSON.stringify(c.history[before]);
  c = run(s, platform, "category.save", c, {
    类目名称: "家庭精细保洁",
    上级类目: "CAT-HOUSE",
  });
  assert.equal(JSON.stringify(c.history[before]), snapshot);
});

test("AC02-041/043 资金明细时间口径改变实际事实筛选，类型不符不混入", () => {
  const s = setup("S02-STATS"),
    base = { 查询开始日期: "2026-11-01", 查询结束日期: "2026-11-06" };
  const payments = service.query(s, web, "funds", {
      ...base,
      时间口径: "支付成功时间",
    }),
    refunds = service.query(s, web, "funds", {
      ...base,
      时间口径: "退款成功时间",
    }),
    backs = service.query(s, web, "funds", {
      ...base,
      时间口径: "回退成功时间",
    });
  assert.equal(payments.length, 5);
  assert.ok(payments.every((f) => f["资金类型"] === "支付"));
  assert.equal(refunds.length, 3);
  assert.ok(refunds.every((f) => f["资金类型"] === "退款"));
  assert.equal(backs.length, 1);
  assert.equal(backs[0]["资金金额"], "30.00");
  assert.throws(
    () => service.query(s, web, "funds", { ...base, 时间口径: "订单履约时间" }),
    /不适用/,
  );
});

test("AC02-043 结果/过程、售后退款及资金摘要均由真实事实投影可达", () => {
  const s = setup("S02-RULING");
  let sale = service.query(s, web, "aftersales")[0],
    order = service.query(s, web, "orders")[0];
  assert.equal(order.rounds[0]["服务结果"], "全部完成");
  assert.ok(order.rounds[0]["实际完成内容"]);
  sale = run(s, web, "aftersale.ruling", sale, rulingData("部分退款"));
  sale = run(s, web, "aftersale.execute", sale);
  assert.equal(sale["退款状态"], "成功");
  assert.equal(sale["本笔成功退款金额"], "30.00");
  const f = service
    .query(s, web, "funds")
    .find((f) => f["资金类型"] === "退款");
  assert.equal(f["累计成功支付金额"], "99.00");
  assert.equal(f["累计成功退款金额"], "30.00");
});

test("AC02-021/030/031 已发生事实时间不能填写未来，失败不留半成品", () => {
  const s = setup("S02-IN-SERVICE"),
    o = rows(s, "orders")[0];
  assert.throws(
    () =>
      run(s, merchant, "order.result", o, {
        服务结果: "全部完成",
        实际完成内容: "完成",
        实际服务结束时间: "2026-11-07T10:00:00+08:00",
      }),
    /晚于提交/,
  );
  assert.throws(
    () =>
      run(s, merchant, "order.anomaly", o, {
        异常类型: "现场异常",
        异常发生时间: "2026-11-08T10:00:00+08:00",
        异常事实说明: "未来",
      }),
    /晚于登记/,
  );
  const r = setup("S02-RULING"),
    sale = rows(r, "aftersales")[0];
  assert.throws(
    () =>
      run(r, web, "aftersale.ruling", sale, {
        ...rulingData("不予退款"),
        裁定作出时间: "2026-11-08T10:00:00+08:00",
      }),
    /晚于录入/,
  );
  assert.equal(raw(r, sale._id).rulings.length, 0);
});

test("AC02-015/043 改期前后值与生效时间来自真实答复，不覆盖原安排", () => {
  const s = setup("S02-HOME-READY");
  let o = service.query(s, resident, "orders")[0],
    old = o.currentArrangement["安排编号"];
  o = run(s, resident, "order.change", o, {
    改期原因: "居民希望换日",
    期望改期日期: "2026-11-08",
    期望改期时段偏好: "上午",
  });
  assert.equal(o["原开始时间"], "09:00");
  o = run(s, merchant, "order.arrange", o, {
    服务人员: "P-A",
    安排服务日期: "2026-11-08",
    安排开始时间: "10:00",
    安排结束时间: "12:00",
    改期原因: "商户提出可行时间",
    原安排仍可履行: true,
  });
  assert.equal(o.currentArrangement["安排编号"], old);
  o = run(s, resident, "order.respond", o, {
    安排版本: 2,
    居民安排答复: "接受",
  });
  assert.equal(o["改期申请状态"], "已生效");
  assert.ok(o["改期生效时间"]);
  assert.notEqual(o.currentArrangement["安排编号"], old);
  assert.equal(o.changes[0]["原服务日期"], "2026-11-07");
});
test("AC02-007/043 已发布价格及方式协议快照不会随新编辑版变动", () => {
  const s = setup();
  const old = order(s);
  assert.equal(old["选定服务规格"], "SPEC-HOME");
  assert.equal(old["规格包含内容"], "单次2小时基础保洁");
  assert.equal(old["关联合作协议编号"], "PACT-A");
  assert.ok(old["方式说明"]);
  let sv = service.record(s, merchant, "services", "SV-HOME");
  sv = run(s, merchant, "service.save", sv, {
    ...sv,
    服务名称: "新编辑内容",
    服务规格集合: sv["服务规格集合"].map((sp) => ({
      ...sp,
      组合集合: sp["组合集合"].map((c) => ({ ...c, 组合固定价格: "199.00" })),
    })),
  });
  assert.equal(
    service.record(s, resident, "services", "SV-HOME")["当前展示价"],
    "99.00",
  );
  assert.equal(
    service.record(s, resident, "orders", old._id)["规格方式固定价"],
    "99.00",
  );
  const history = service.record(s, merchant, "services", "SV-HOME")[
    "历史版本"
  ];
  assert.equal(history[0]["内容"]["服务名称"], "家庭保洁");
});

test("AC02-042/043 产品历史别名与C3不能泄露住户内部资金或受限Web电话", () => {
  const s = setup(),
    o = full(s);
  const visible = JSON.stringify(service.record(s, resident, "orders", o._id));
  assert.ok(!visible.includes("服务商累计实分金额"));
  assert.ok(!visible.includes("物业应得金额"));
  assert.ok(!visible.includes("资金规则版本"));
  let p = service.record(s, merchant, "personnel", "P-A");
  run(s, merchant, "personnel.save", p, { ...p, 工作联系电话: "13800009999" });
  const restricted = JSON.stringify(
    service.record(s, limited, "personnel", "P-A"),
  );
  assert.ok(!restricted.includes("13800009999"));
  assert.ok(!restricted.includes("13800004444"));
});

test("AC02-003/004/043 资格人员筛选在授权范围内实际生效，电话检索独立验权", () => {
  const s = setup("S02-QUAL");
  assert.equal(
    service.query(s, web, "qualifications", { 申请状态: "草稿" }).length,
    1,
  );
  assert.equal(
    service.query(s, web, "qualifications", { 资格有效性: "受限" }).length,
    0,
  );
  assert.equal(
    service.query(s, web, "qualifications", { 经营店铺: "SHOP-B" })[0]._shop,
    "SHOP-B",
  );
  assert.equal(
    service.query(s, merchant, "personnel", { 人员资质有效性: "待核实" })[0]
      ._id,
    "P-A-MISSING",
  );
  assert.equal(
    service.query(s, merchant, "personnel", { 人员联系电话: "004444" }).length,
    2,
  );
  assert.throws(
    () => service.query(s, limited, "personnel", { 人员联系电话: "138" }),
    /检索权限/,
  );
  assert.equal(
    service.query(s, web, "qualifications", { 服务类目: "CAT-DRAIN" })[0]._shop,
    "SHOP-B",
  );
});
test("AC02-031/041/043 售后和资金条件不是仅UI标签", () => {
  const s = setup("S02-STATS");
  assert.equal(
    service.query(s, web, "aftersales", { 售后类型筛选: "核实取消" }).length,
    1,
  );
  assert.equal(
    service.query(s, web, "aftersales", {
      申请开始日期: "2026-11-06",
      申请结束日期: "2026-11-06",
    }).length,
    1,
  );
  assert.equal(
    service.query(s, web, "aftersales", {
      服务商筛选: "SHOP-B",
      售后类型筛选: "核实取消",
    }).length,
    0,
  );
  assert.equal(
    service.query(s, web, "orders", {
      创建开始日期: "2026-11-01",
      创建结束日期: "2026-11-06",
    }).length,
    5,
  );
  assert.equal(service.query(s, web, "funds", { 仅看异常: true }).length, 0);
});

test("AC02-027/043 已结案售后仍经原订单完整历史访问", () => {
  const s = setup("S02-RULING");
  let sale = service.query(s, web, "aftersales")[0];
  sale = run(s, web, "aftersale.ruling", sale, rulingData("不予退款"));
  run(s, web, "aftersale.execute", sale);
  const o = service.query(s, resident, "orders")[0];
  assert.equal(o.currentAftersale, null);
  assert.equal(o.aftersales.length, 1);
  assert.equal(o.aftersales[0]["售后状态"], "已解决");
  assert.equal(o.aftersales[0]["裁定依据附件"], undefined);
});

function uploaded(s, id, owner, extra = {}) {
  s.attachments[id] = {
    stage02: true,
    owner,
    status: "成功",
    name: "虚构核验材料.txt",
    type: "text/plain",
    size: 12,
    visibility: "business",
    ...extra,
  };
  return id;
}
function materialInput(id, cat = "CAT-AC") {
  return {
    材料名称: "本轮新证明",
    对应服务类目: [cat],
    证明编号: "DEMO-NEW",
    发证机构: "虚构演示",
    生效日期: "2026-01-01",
    长期有效: true,
    有效截止日期: "",
    证明文件: [id],
    核验结论: "认可",
    核验意见: "伪造认可",
    材料有效性: "有效",
    _seed: true,
  };
}
test("AC02-042 内部裁定附件按真实绑定验权，省略和伪造field不降低权限", () => {
  const s = setup("S02-RULING");
  const attachmentId = uploaded(s, "PRIVATE-FACT", "property-admin");
  let a = run(s, web, "aftersale.ruling", rows(s, "aftersales")[0], {
    ...rulingData("部分退款"),
    裁定依据附件: [attachmentId],
  });
  // The same file is also externally referenced: its internal binding still controls.
  raw(s, a._id)["问题证据"] = [attachmentId];
  for (const who of [resident, merchant, limited])
    for (const field of [undefined, "问题证据", "裁定说明", "裁定依据附件"])
      assert.throws(
        () =>
          service.attachmentId(s, who, {
            table: "aftersales",
            id: a._id,
            attachmentId,
            field,
          }),
        /内部裁定/,
      );
  assert.equal(
    service.attachmentId(s, web, {
      table: "aftersales",
      id: a._id,
      attachmentId,
    }),
    attachmentId,
  );
  // Correction preserves the first internal reference and must preserve its ACL.
  a = run(s, web, "aftersale.ruling", a, {
    ...rulingData("不予退款"),
    更正原因: "依据补充",
  });
  assert.equal(raw(s, a._id).rulings[0]["裁定有效状态"], "已更正");
  assert.throws(
    () =>
      service.attachmentId(s, resident, {
        table: "aftersales",
        id: a._id,
        attachmentId,
        field: "问题证据",
      }),
    /内部裁定/,
  );
  for (const permission of ["sensitive", "ruling"]) {
    const before = s.service.grants["property-admin"][permission];
    s.service.grants["property-admin"][permission] = false;
    assert.throws(
      () => service.attachmentId(s, web, { attachmentId }),
      /内部裁定/,
    );
    s.service.grants["property-admin"][permission] = before;
  }
});
test("AC02-042 内部证据藏于变更历史仍拒绝owner兜底，未绑定本人文件可预览", () => {
  const s = setup("S02-RULING"),
    a = rows(s, "aftersales")[0],
    id = uploaded(s, "HIST-PRIVATE", "resident-a");
  a.history.push({
    changes: [{ 变更字段名称: "裁定依据附件", 变更前值: [id], 变更后值: [] }],
  });
  for (const who of [resident, merchant, limited])
    assert.throws(
      () => service.attachmentId(s, who, { attachmentId: id }),
      /内部裁定/,
    );
  const unbound = uploaded(s, "UNBOUND-OWN", "resident-a");
  assert.equal(
    service.attachmentId(s, resident, { attachmentId: unbound }),
    unbound,
  );
  assert.throws(
    () => service.attachmentId(s, otherResident, { attachmentId: unbound }),
    /无权预览/,
  );
});
test("AC02-003/004/042 新材料必须本人成功上传，跨主体及伪造核验不能生效", () => {
  const s = setup(),
    foreign = uploaded(s, "FOREIGN-CERT", "service-merchant-b");
  const person = {
    姓名: "新服务人员",
    工作联系电话: "13800008888",
    可执行服务类目: ["CAT-AC"],
    人员资质材料: [materialInput(foreign)],
  };
  assert.throws(
    () => run(s, merchant, "personnel.save", null, person),
    /本人上传成功/,
  );
  assert.throws(
    () =>
      run(s, merchant, "qualification.save", "Q-A", {
        服务资质材料: [materialInput(foreign)],
      }),
    /本人上传成功/,
  );
  const pending = uploaded(s, "PENDING-CERT", "merchant", { status: "处理中" });
  assert.throws(
    () =>
      run(s, merchant, "personnel.save", null, {
        ...person,
        人员资质材料: [materialInput(pending)],
      }),
    /本人上传成功/,
  );
  const own = uploaded(s, "OWN-CERT", "merchant");
  let p = run(s, merchant, "personnel.save", null, {
    ...person,
    人员资质材料: [materialInput(own)],
  });
  assert.equal(p["人员资质材料"][0]["核验结论"], "待核实");
  assert.equal(p["人员资质材料"][0]["核验意见"], "");
  assert.equal(p["人员资质材料"][0]._seed, undefined);
  assert.equal(staffEligible(s, raw(s, p._id), "SHOP-A", "CAT-AC"), false);
  assert.throws(
    () => run(s, merchant, "personnel.review", p, { 核验结论: "认可" }),
    /Web办理权限/,
  );
  assert.throws(
    () => run(s, limited, "personnel.review", p, { 核验结论: "认可" }),
    /Web办理权限/,
  );
  p = run(s, web, "personnel.review", p, {
    核验结论: "认可",
    核验意见: "Web逐项核验",
  });
  assert.equal(p["资质有效性"], "有效");
  assert.equal(staffEligible(s, raw(s, p._id), "SHOP-A", "CAT-AC"), true);
  assert.equal(
    service.attachmentId(s, merchant, {
      table: "personnel",
      id: p._id,
      attachmentId: own,
    }),
    own,
  );
  assert.throws(
    () => service.attachmentId(s, merchantB, { attachmentId: own }),
    /无权读取资格/,
  );
});
test("AC02-003/004 合法同主体既有有效证明无需重传，变更证书事实需重新核验", () => {
  const s = setup(),
    base = raw(s, "P-A"),
    old = structuredClone(base["人员资质材料"][0]);
  const p = run(s, merchant, "personnel.save", null, {
    姓名: "复用材料人员",
    工作联系电话: "13800008889",
    可执行服务类目: ["CAT-AC"],
    人员资质材料: [{ ...old, 核验结论: "不认可", 材料有效性: "已失效" }],
  });
  assert.equal(p["人员资质材料"][0]["核验结论"], "认可");
  assert.equal(staffEligible(s, raw(s, p._id), "SHOP-A", "CAT-AC"), true);
  const changed = run(s, merchant, "personnel.save", p, {
    姓名: p["姓名"],
    工作联系电话: p["工作联系电话"],
    可执行服务类目: p["可执行服务类目"],
    人员资质材料: [{ ...old, 证明编号: "另一个证书" }],
  });
  assert.equal(changed["人员资质材料"][0]["核验结论"], "待核实");
  assert.equal(staffEligible(s, raw(s, p._id), "SHOP-A", "CAT-AC"), false);
});
test("AC02-003/042 资格新材料由Web审核认可，申请与历史不能泄露给受限Web", () => {
  const s = setup(),
    own = uploaded(s, "NEW-QUAL-CERT", "merchant");
  run(s, platform, "category.save", "CAT-CLEAN", {
    类目名称: "保洁清洗",
    商户证明是否必需: true,
    商户资质要求说明: "演示核验",
  });
  let q = run(s, merchant, "qualification.save", "Q-A", {
    申请服务类目: ["CAT-CLEAN"],
    申请覆盖社区: ["C-A"],
    申请覆盖小区: ["E-A"],
    服务资质材料: [materialInput(own, "CAT-CLEAN")],
  });
  assert.equal(q["服务资质材料"][0]["材料有效性"], "待核实");
  q = run(s, merchant, "qualification.submit", q);
  const hidden = JSON.stringify(
    service.record(s, limited, "qualifications", q._id),
  );
  assert.ok(!hidden.includes(own));
  assert.ok(!hidden.includes("本轮新证明"));
  q = run(s, web, "qualification.review", q, {
    审核结果: "通过",
    审核意见: "核对证书",
  });
  assert.equal(q["服务资质材料"][0]["核验结论"], "认可");
  assert.equal(qualified(s, "SHOP-A", "CAT-CLEAN"), true);
  // Draft replacement cannot revoke the original effective authorization.
  const replacement = uploaded(s, "REPLACEMENT-QUAL", "merchant");
  run(s, merchant, "qualification.save", q, {
    服务资质材料: [
      { ...materialInput(replacement, "CAT-CLEAN"), 证明编号: "新证书" },
    ],
  });
  assert.equal(qualified(s, "SHOP-A", "CAT-CLEAN"), true);
});
test("AC02-005/006/007 类目允许方式同步拦截新交易及送审发布，不回写已付款旧单", () => {
  const s = setup();
  let o = order(s, "SV-POINT");
  o = run(s, resident, "order.pay", o);
  run(s, platform, "category.save", "CAT-FAN", {
    类目名称: "油烟机清洗",
    允许履约方式: ["HOME"],
  });
  assert.throws(() => order(s, "SV-POINT"), /有效规格|类目|方式/);
  o = arrange(s, o);
  assert.equal(o.currentArrangement["安排状态"], "已接受");
  assert.equal(o["选定履约方式"], "预约到点");
  let sv = run(s, merchant, "service.save", "SV-POINT", raw(s, "SV-POINT"));
  assert.throws(() => run(s, merchant, "service.submit", sv), /类目允许/);
  run(s, platform, "category.save", "CAT-FAN", {
    类目名称: "油烟机清洗",
    允许履约方式: ["HOME", "POINT"],
  });
  sv = run(s, merchant, "service.submit", sv);
  run(s, platform, "category.save", "CAT-FAN", {
    类目名称: "油烟机清洗",
    允许履约方式: ["HOME"],
  });
  assert.throws(
    () => run(s, web, "service.review", sv, { 审核结果: "通过" }),
    /类目允许/,
  );
  run(s, platform, "category.save", "CAT-FAN", {
    类目名称: "油烟机清洗",
    允许履约方式: ["HOME", "POINT"],
  });
  sv = run(s, web, "service.review", sv, { 审核结果: "通过" });
  run(s, platform, "category.save", "CAT-FAN", {
    类目名称: "油烟机清洗",
    允许履约方式: ["HOME"],
  });
  assert.throws(() => run(s, merchant, "service.publish", sv), /类目允许/);
});

test("AC02-004/042 本商户保留自己人员内部备注及材料变更历史，受限Web不可读", () => {
  const s = setup(),
    p = run(s, merchant, "personnel.save", "P-A", {
      姓名: "陈师傅",
      工作联系电话: "13800004444",
      可执行服务类目: raw(s, "P-A")["可执行服务类目"],
      内部备注: "本商户可读的内部人员备注",
    });
  assert.equal(p["内部备注"], "本商户可读的内部人员备注");
  assert.ok(JSON.stringify(p["变更历史"]).includes("本商户可读的内部人员备注"));
  assert.ok(
    !JSON.stringify(service.record(s, limited, "personnel", p._id)).includes(
      "本商户可读的内部人员备注",
    ),
  );
  const m = run(s, merchant, "personnel.save", p, {
    姓名: p["姓名"],
    工作联系电话: p["工作联系电话"],
    可执行服务类目: p["可执行服务类目"],
    人员资质材料: [],
  });
  assert.ok(JSON.stringify(m["变更历史"]).includes("人员资质材料"));
  assert.ok(
    !JSON.stringify(service.record(s, limited, "personnel", p._id)).includes(
      "虚构专项服务证明",
    ),
  );
});
