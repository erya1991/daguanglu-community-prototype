import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../prototype-shared/core.js";
import {
  prepare,
  command,
  query,
  record,
  options,
  attachmentId,
} from "../prototype-shared/stage01/index.js";
import { seed } from "../prototype-shared/stage01/seed.js";
import {
  listStates,
  paymentStates,
  settlementStates,
  rowActions,
} from "../prototype-shared/stage01/ui.js";
const PA = { app: "web", account: "property-admin", role: "property" },
  R = { app: "resident", account: "resident-b", role: "resident" };
function fresh() {
  const s = createSeed();
  prepare(s, "stage01-r1");
  seed(s);
  return s;
}
function run(s, ctx, name, p = {}) {
  const next = structuredClone(s),
    result = command(next, ctx, name, p);
  Object.assign(s, next);
  return result;
}
function act(s, id, name, data = {}) {
  const r = record(s, PA, "workorders", id);
  return run(s, PA, name, { id, revision: r._rev, data });
}
function photo(s, owner = "property-admin") {
  const id = "r1-photo-" + Object.keys(s.attachments).length;
  s.attachments[id] = {
    stage01: true,
    owner,
    status: "成功",
    name: "现场.png",
    type: "image/png",
  };
  return id;
}
function report(s, ctx = R) {
  return run(s, ctx, "report", {
    data: {
      RP07: "报修",
      RP08: "设施维修",
      RP09: "C-A",
      RP10: "E-A",
      RP11: "公共位置",
      RP13: "1幢东门",
      RP14: "门灯不亮",
      RP15: "周明",
      RP16: "13900000002",
    },
  });
}
function edit(s, id, extra = {}) {
  const r = record(s, PA, "workorders", id);
  return act(s, id, "editTask", {
    WO15: r.WO15,
    WO16: r.WO16,
    WO17: r.WO17,
    WO18: "现场更正",
    ...extra,
  });
}

test("R1 上报三端直接成单，原始分类位置不可被更正覆盖，旧请求拒绝", () => {
  const s = fresh();
  for (const ctx of [R, PA, { ...PA, app: "staff" }]) {
    const x = report(s, ctx);
    assert.ok(x.workorderId);
    const w = record(s, PA, "workorders", x.workorderId);
    assert.equal(w.WO06, "待派单");
    assert.equal(w.WO15, "报修");
    assert.equal(s.stage01.events.find((e) => e._id === w.WO02).EV10, "");
    edit(s, w._id, { WO17: "更正后的西门" });
    assert.equal(record(s, PA, "reports", x.id).RP13, "1幢东门");
    assert.throws(() => run(s, PA, "verify", { id: w.WO02 }), /流程已调整/);
  }
});
test("工单派单前类型转换补证，派单后锁定类型但可改类别，旧版本不能覆盖", () => {
  const s=fresh(), x=report(s), id=x.workorderId;
  assert.throws(()=>edit(s,id,{WO15:'隐患'}),/现场证据/);
  edit(s,id,{WO15:'隐患',WO19:[photo(s)]});
  assert.equal(record(s,PA,'reports',x.id).RP07,'报修');
  act(s,id,'dispatch',{WO04:'P-S01',WO05:'整改'});
  assert.equal(record(s,PA,'workorders',id).WO06,'待处理');
  assert.throws(()=>edit(s,id,{WO15:'报修'}),/派单后/);
  const before=record(s,PA,'workorders',id);edit(s,id,{WO16:'公共安全'});
  assert.equal(record(s,PA,'workorders',id).WO16,'公共安全');
  assert.throws(()=>run(s,PA,'editTask',{id,revision:before._rev,data:{WO15:'隐患',WO16:'设施维修',WO17:'门口',WO18:'旧页'}}));
});

test("旧补充、重复与误报操作已停用，不改变原工单",()=>{
  const s=fresh(),a=report(s),b=report(s);const before=structuredClone(s.stage01.workorders);
  assert.throws(()=>act(s,a.workorderId,'requestSupplement',{WO18:'位置不足',WO20:'请补门牌'}),/流程已调整/);
  assert.throws(()=>run(s,R,'supplement',{id:a.id,revision:record(s,R,'reports',a.id)._rev,data:{SP02:'101门口'}}),/流程已调整/);
  assert.throws(()=>act(s,b.workorderId,'markDuplicate',{WO18:'同一灯具',WO21:a.workorderId}),/流程已调整/);
  assert.throws(()=>act(s,a.workorderId,'markFalse',{WO18:'设施正常'}),/流程已调整/);
  assert.deepEqual(s.stage01.workorders,before);
  assert.equal(record(s,R,'reports',a.id)._status,'待派单');assert.equal(query(s,R,'reports').length,2);
});

test("v1迁移保留有效单与支付，清理旧误报重复且不伪造核实",()=>{
  const s=fresh();for(let i=0;i<4;i++)report(s);
  s.stage01.schemaVersion=1;s.stage01.workorders=[];
  const statuses=['待核实','待补充','误报终止','重复关联'];
  s.stage01.events.forEach((e,i)=>{delete e._workorder;e.EV09=statuses[i];e.EV07=i===1?'补充位置':'';e.EV08=i===3?s.stage01.events[0]._id:'';s.stage01.reports[i].RP19=statuses[i]});
  const houses=structuredClone(s.houses),payments=structuredClone(s.stage01.payments),original=s.stage01.reports.slice(0,2).map(r=>r.RP14);
  prepare(s,'existing-session');const w=query(s,PA,'workorders');
  assert.deepEqual(w.map(r=>r.WO06),['待派单','待派单']);assert.equal(s.stage01.schemaVersion,4);
  assert.equal(s.stage01.reports.length,2);assert.equal(s.stage01.events.length,2);
  assert.deepEqual(s.houses,houses);assert.deepEqual(s.stage01.payments,payments);assert.deepEqual(s.stage01.reports.map(r=>r.RP14),original);
  assert.ok(s.stage01.events.every(e=>!e.EV10&&!e.EV11));const once=structuredClone(s);prepare(s,'existing-session');assert.deepEqual(s,once);
});

test("R1 v1已存在工单编号、处理及居民未解决确认保留，新轮次待派单", () => {
  const s = fresh(),
    x = report(s),
    w = s.stage01.workorders[0];
  w.WO06 = "待重新核实";
  w.WO12 = 2;
  w.rounds = [{ PR01: "original-round", PR10: 2 }];
  w.confirmations = [{ UC01: "未解决", UC02: "仍有问题" }];
  s.stage01.schemaVersion = 1;
  prepare(s, "old");
  const migrated = record(s, PA, "workorders", x.workorderId);
  assert.equal(migrated.WO12, 3);
  assert.equal(migrated.WO06, "待派单");
  assert.equal(migrated.rounds[0].PR01, "original-round");
  assert.equal(migrated.confirmations[0].UC01, "未解决");
});
test("R1 空间树与付款类型查询受权限约束，租户不冒充业主", () => {
  const s = fresh(),
    sc = options(s, PA).spaces;
  assert.ok(sc.estates.some((e) => e._id === "E-S01"));
  assert.ok(!sc.estates.some((e) => e._id === "E-B"));
  assert.equal(
    query(s, { ...PA, estate: "E-A" }, "bills", {
      space: { level: "estate", id: "E-S01" },
      allScope: true,
    }).length,
    1
  );
  assert.equal(
    query(s, PA, "bills", {
      space: { level: "estate", id: "E-B" },
      allScope: true,
    }).length,
    0
  );
  assert.equal(query(s, PA, "parkingRelations")[0].PK14, "未登记");
  const rel = structuredClone(s.relations[0]);
  Object.assign(rel, { _id: "owner", 关系类型: "业主" });
  s.relations.push(rel);
  assert.equal(query(s, PA, "parkingRelations")[0].PK14, "周明");
  assert.equal(query(s, R, "parkingRelations")[0].PK14, undefined);
  assert.deepEqual(
    new Set(query(s, PA, "dues").map((r) => r._businessType)),
    new Set(["物业费", "临停"])
  );
  assert.throws(() => query(s, R, "dues"));
});
test("R1 厂商及期间订单快照保护，临停时长不参与自动计费", () => {
  const s = fresh(),
    rel = query(s, R, "parkingRelations")[0],
    p = query(s, R, "products")[0];
  const x = run(s, R, "createMonthly", {
    relation: rel._id,
    product: p._id,
    productVersion: p.MP08,
    start: "2026-12-01",
    end: "2026-12-31",
  });
  run(s, PA, "saveProduct", {
    id: p._id,
    revision: p._rev,
    data: { ...p, MP04: "222", MP10: "新的厂商名称" },
  });
  assert.equal(record(s, R, "monthly", x.id).MO20, "青禾停车科技");
  assert.equal(record(s, R, "monthly", x.id).MO09, 20000);
  const monthly = record(s, PA, "monthly", x.id);
  assert.equal(monthly._residentName, "周明");
  assert.equal(monthly._ownerName, "未登记");
  assert.ok(monthly._houseName);
  assert.equal(record(s, R, "monthly", x.id)._ownerName, undefined);
  const t = query(s, PA, "temporary")[0];
  assert.equal(t.TB18, "2小时0分钟");
  assert.equal(t.TB06, 1200);
  assert.equal(t.TB17, "青禾停车科技");
  assert.ok(
    query(s, PA, "dues").some(
      (r) => r._id === x.id && r._businessType === "停车月租"
    )
  );
});
test("R1 合并核对保留记录与版本校验，不允许核对意见改写资金事实", () => {
  const s = fresh(),
    bill = query(s, R, "bills")[0],
    p = run(s, R, "pay", { id: bill._id, kind: "物业费", revision: bill._rev }),
    r = record(s, PA, "payments", p.id);
  assert.throws(() =>
    run(s, PA, "createCheck", { id: r._id, table: "payments", revision: 0 })
  );
  const c = run(s, PA, "createCheck", {
    id: r._id,
    table: "payments",
    revision: r._rev,
  });
  const check = record(s, PA, "checks", c.id);
  run(s, PA, "saveCheck", {
    id: c.id,
    revision: check._rev,
    note: "与原单核对一致",
    next: "无需处理",
    data: { PY12: "失败" },
  });
  assert.equal(record(s, PA, "payments", p.id).PY12, "成功");
  assert.equal(record(s, PA, "payments", p.id).relatedChecks.length, 1);
  assert.equal(record(s, PA, "checks", c.id)._businessTable, "bills");
});
test("R1 完整状态字典及列表按钮按实际状态列示", () => {
  assert.deepEqual(listStates.workorders, ["待派单", "待处理", "处理中", "待确认", "待评价", "已完成"]);
  assert.ok(listStates.monthly.includes("已登记"));
  assert.ok(paymentStates.includes("结果待确认"));
  assert.ok(settlementStates.includes("异常"));
  assert.deepEqual(rowActions({ _table: "bills", BL19: "待发布" }), [
    "editBill",
    "publish",
  ]);
  assert.ok(
    rowActions({
      _table: "payments",
      _paymentState: "成功",
      _settlementState: "异常",
    }).includes("recoverPayment")
  );
  assert.ok(
    !rowActions({
      _table: "payments",
      _paymentState: "成功",
      _settlementState: "成功",
    }).includes("recoverPayment")
  );
});
