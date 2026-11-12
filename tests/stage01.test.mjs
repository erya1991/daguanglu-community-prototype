import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../prototype-shared/core.js";
import {
  prepare,
  command,
  query,
  record,
  auxiliary,
  reset,
  attachmentId,
  overview,
} from "../prototype-shared/stage01/index.js";
import { seed } from "../prototype-shared/stage01/seed.js";
import {
  billTemplate,
  importPreview,
} from "../prototype-shared/stage01/billing.js";
const PA = { app: "web", account: "property-admin", role: "property" },
  R = { app: "resident", account: "resident-b", role: "resident" },
  STAFF = { ...PA, app: "staff" };
const fresh = () => {
  const s = createSeed();
  prepare(s, "stage01-test");
  seed(s);
  return s;
};
const run = (s, ctx, name, p = {}) => {
  const next = structuredClone(s),
    result = command(next, ctx, name, p);
  Object.keys(s).forEach((k) => delete s[k]);
  Object.assign(s, next);
  return result;
};
const photos = (s, account = "property-admin") => {
  const id = "photo-" + Object.keys(s.attachments).length;
  s.attachments[id] = {
    stage01: true,
    owner: account,
    name: "现场照片.png",
    type: "image/png",
    status: "成功",
  };
  return [id];
};
function report(s, kind = "报修") {
  return run(s, R, "report", {
    data: {
      RP07: kind,
      RP08: "设施维修",
      RP09: "C-A",
      RP10: "E-A",
      RP11: "公共位置",
      RP13: "1幢入口",
      RP14: "通道灯具损坏，需要处理",
      RP15: "周明",
      RP16: "13900000002",
      RP17: kind === "隐患" ? photos(s, "resident-b") : [],
    },
  }).id;
}
function taskFor(s, id) {
  const r=record(s, PA, 'reports', id);
  assert.ok(r._workorder, '提交上报立即关联工单');
  return r._workorder;
}
function task(s, id, name, data = {}) {
  const r = record(s, PA, "workorders", id);
  return run(s, PA, name, { id, revision: r._rev, data });
}
function process(s, id, hazard = false) {
  task(s, id, "dispatch", { WO04: "P-S01", WO05: "修复", HZ04:"完成整改并保留前后照片" });
  task(s, id, "startProcess");
  task(s, id, "submitProcess", {
    PR02: "已修复",
    PR07: "现场检查正常",
    PR05: hazard ? photos(s) : [],
    PR06: hazard ? photos(s) : [],
  });
}
test("非破坏迁移、两小区范围和住户有效关系隔离", () => {
  const s = fresh();
  assert.equal(s.schemaVersion, 2);
  assert.equal(query(s, PA, "bills").length, 2);
  assert.equal(query(s, R, "bills").length, 1);
  assert.equal(query(s, { ...R, account: "resident-a" }, "bills").length, 0);
  assert.throws(() => record(s, R, "bills", s.stage01.bills[1]._id));
  assert.equal(
    query(
      s,
      { app: "web", account: "platform-admin", role: "platform" },
      "bills"
    ).length,
    s.stage01.bills.length
  );
  const relations = structuredClone(s.relations);
  prepare(s, "stage01-test");
  assert.deepEqual(s.relations, relations);
});
test("CSV真实解析、重复改名、错误行确认和冲突快照", () => {
  const s = fresh(),
    p = { text: billTemplate, source: "物业11月收费台账" };
  assert.equal(importPreview(s, PA, p).IM08, 2);
  const changed = billTemplate.replace("280.00", "281.00");
  assert.equal(
    importPreview(s, PA, { ...p, text: changed }).rows[0].IR04,
    "冲突"
  );
  const b = structuredClone(s.stage01.bills);
  assert.deepEqual(s.stage01.bills, b);
  const text = billTemplate
    .replaceAll("台账-", "新台账-")
    .replace("H-S01", "NO-HOUSE");
  assert.throws(() => run(s, PA, "import", { text, source: "新台账" }));
  const r = run(s, PA, "import", { text, source: "新台账", validOnly: true });
  assert.equal(s.stage01.batches.find((x) => x._id === r.id).IM10, 1);
});
test("物业支付核销、凭证、同房投影与重复回执幂等", () => {
  const s = fresh(),
    b = query(s, R, "bills")[0];
  const p = run(s, R, "pay", {
    id: b._id,
    kind: "物业费",
    revision: b._rev,
    operation: "pay-1",
  });
  assert.equal(record(s, R, "payments", p.id).PY17, "成功");
  assert.ok(record(s, R, "payments", p.id).PY19);
  auxiliary(s, PA, "replay", { id: p.id });
  assert.equal(record(s, R, "bills", b._id).BL15, 28000);
  assert.throws(() =>
    run(s, R, "pay", {
      id: b._id,
      kind: "物业费",
      revision: record(s, R, "bills", b._id)._rev,
    })
  );
  assert.equal(
    run(s, R, "pay", {
      id: b._id,
      kind: "物业费",
      revision: b._rev,
      operation: "pay-1",
    }).id,
    p.id
  );
});
test("未知支付退出恢复、同房互斥、他人付款明细不可读", () => {
  const s = fresh();
  auxiliary(s, PA, "sameHouse");
  auxiliary(s, R, "mode", { mode: "unknown" });
  const b = query(s, R, "bills")[0],
    p = run(s, R, "pay", { id: b._id, kind: "物业费", revision: b._rev });
  assert.equal(record(s, R, "payments", p.id).PY12, "结果待确认");
  const other = { ...R, account: "resident-a" };
  assert.throws(() =>
    run(s, other, "pay", {
      id: b._id,
      kind: "物业费",
      revision: record(s, other, "bills", b._id)._rev,
    })
  );
  assert.throws(() => record(s, other, "payments", p.id));
  run(s, R, "queryPayment", { id: p.id });
  assert.equal(record(s, other, "bills", b._id).relatedPayments.length, 0);
});
test("成功待核销不判欠费、不重付，物业恢复原核销", () => {
  const s = fresh();
  auxiliary(s, R, "mode", { mode: "reconcile" });
  const b = query(s, R, "bills")[0],
    p = run(s, R, "pay", { id: b._id, kind: "物业费", revision: b._rev });
  assert.equal(record(s, R, "payments", p.id).PY17, "异常");
  assert.equal(record(s, R, "bills", b._id).BL21, "已支付待核销");
  assert.throws(() =>
    run(s, R, "pay", { id: b._id, kind: "物业费", revision: b._rev })
  );
  run(s, PA, "recoverPayment", { id: p.id });
  assert.equal(record(s, R, "bills", b._id).BL20, "已结清");
});
test("管理端收费只读与Stage00授权隔离", () => {
  const s = fresh(),
    b = query(s, STAFF, "bills")[0];
  assert.ok(b);
  assert.throws(() =>
    run(s, STAFF, "publish", { id: b._id, revision: b._rev, confirm: true })
  );
  assert.throws(() => run(s, STAFF, "saveProduct", { data: {} }));
  assert.throws(() => run(s, R, "verify", { id: "no" }));
});
test("月租自然月、新办续费与重复登记", () => {
  const s = fresh(),
    rel = query(s, R, "parkingRelations")[0],
    prod = query(s, R, "products")[0];
  const first = run(s, R, "createMonthly", {
    relation: rel._id,
    product: prod._id,
    productVersion: prod.MP08,
    start: "2026-11-01",
    end: "2026-11-30",
    kind: "新办",
  });
  let m = record(s, R, "monthly", first.id);
  const p = run(s, R, "pay", { id: m._id, kind: "停车月租", revision: m._rev });
  m = record(s, R, "monthly", m._id);
  assert.equal(m.MO15, "未接入");
  const right = m.MO11;
  auxiliary(s, PA, "replay", { id: p.id });
  assert.equal(record(s, R, "monthly", m._id).MO11, right);
  assert.throws(() =>
    run(s, R, "createMonthly", {
      relation: rel._id,
      product: prod._id,
      productVersion: prod.MP08,
      start: "2026-11-01",
      end: "2026-11-30",
    })
  );
  assert.ok(
    run(s, R, "createMonthly", {
      relation: rel._id,
      product: prod._id,
      productVersion: prod.MP08,
      start: "2026-12-01",
      end: "2026-12-31",
      kind: "续费",
      prior: m._id,
      priorVersion: m._rev,
    }).id
  );
});
test("临停金额版本确认、零应付与在途报价锁", () => {
  const s = fresh(),
    b = query(s, R, "temporary")[0];
  const update = { ...b, TB06: "15.00" };
  run(s, PA, "saveTemporary", { id: b._id, revision: b._rev, data: update });
  const current = record(s, R, "temporary", b._id);
  assert.throws(() =>
    run(s, R, "pay", {
      id: b._id,
      kind: "临停",
      revision: current._rev,
      quoteVersion: b.TB11,
    })
  );
  auxiliary(s, R, "mode", { mode: "unknown" });
  run(s, R, "pay", {
    id: b._id,
    kind: "临停",
    revision: current._rev,
    quoteVersion: current.TB11,
  });
  assert.throws(() =>
    run(s, PA, "saveTemporary", {
      id: b._id,
      revision: current._rev,
      data: update,
    })
  );
  const rel = query(s, R, "parkingRelations")[0];
  const z = run(s, PA, "saveTemporary", {
    data: {
      TB02: "零费用停车记录",
      TB03: rel._id,
      TB04: "2026-11-05T08:00",
      TB05: "2026-11-05T09:00",
      TB06: "0",
      TB09: "免费事实",
      TB10: "物业台账",
    },
  });
  assert.throws(() =>
    run(s, R, "pay", { id: z.id, kind: "临停", revision: 1, quoteVersion: 1 })
  );
});
test("报修六态流程，各动作留痕，住户确认评价分离",()=>{
 const s=fresh(),id=report(s),w=taskFor(s,id);process(s,w);assert.throws(()=>task(s,w,'closeHazard'));assert.throws(()=>task(s,w,'review',{RV03:'通过',RV04:'旧流程'}));
 let r=record(s,R,'reports',id);assert.ok(r._canConfirm);assert.equal(r._status,'待确认');assert.throws(()=>run(s,PA,'confirm',{id,revision:r._taskRevision,data:{UC01:'已解决'}}));
 run(s,R,'confirm',{id,revision:r._taskRevision,data:{UC01:'已解决'}});r=record(s,R,'reports',id);assert.equal(r._status,'待评价');assert.equal(r.resolution.VA05,'未评价');run(s,R,'evaluate',{id,revision:r._taskRevision,data:{VA01:'满意'}});assert.equal(record(s,R,'reports',id)._status,'已完成');
 assert.deepEqual(record(s,PA,'workorders',w).history.map(h=>h.HI02),['登记工单','人工派单','开始处理','提交验收','居民结果确认','居民评价']);
});

test("居民未解决开启新轮次，旧版本拒绝且保留旧事实",()=>{
 const s=fresh(),id=report(s),w=taskFor(s,id);process(s,w);const old=record(s,PA,'workorders',w),r=record(s,R,'reports',id);
 run(s,R,'confirm',{id,revision:r._taskRevision,data:{UC01:'未解决',UC02:'仍然不亮'}});
 assert.throws(()=>run(s,PA,'dispatch',{id:w,revision:old._rev,data:{WO04:'P-S01',WO05:'旧页'}}));
 task(s,w,'dispatch',{WO04:'P-S01',WO05:'重新检查'});task(s,w,'startProcess');task(s,w,'submitProcess',{PR02:'重新修复',PR07:'已核实'});
 const after=record(s,PA,'workorders',w);assert.equal(after.rounds.length,2);assert.equal(after.confirmations[0].UC01,'未解决');assert.equal(after.WO06,'待确认');
});

test("隐患按统一工单提交，处理证据隔离及住户确认评价",()=>{
 const s=fresh(),id=report(s,'隐患'),w=taskFor(s,id);task(s,w,'dispatch',{WO04:'P-S01',WO05:'整改'});task(s,w,'startProcess');const before=photos(s),after=photos(s);
 task(s,w,'submitProcess',{PR02:'整改完成',PR07:'已清理',PR05:before,PR06:after});assert.throws(()=>task(s,w,'review',{RV03:'通过',RV04:'旧流程'}));assert.throws(()=>task(s,w,'closeHazard'));
 const staff=record(s,PA,'workorders',w);assert.deepEqual(staff.rounds[0].PR05,before);assert.deepEqual(staff.rounds[0].PR06,after);let r=record(s,R,'reports',id);assert.equal(r._status,'待确认');assert.throws(()=>attachmentId(s,R,{table:'reports',id,attachment:before[0]}));assert.throws(()=>attachmentId(s,R,{table:'reports',id,attachment:after[0]}));
 run(s,R,'confirm',{id,revision:r._taskRevision,data:{UC01:'已解决'}});r=record(s,R,'reports',id);run(s,R,'evaluate',{id,revision:r._taskRevision,data:{VA01:'满意'}});assert.equal(record(s,R,'reports',id)._status,'已完成');
});

test("停用补充、误报与重复操作，不泄露他人上报",()=>{
 const s=fresh(),a=report(s),b=report(s);assert.throws(()=>task(s,taskFor(s,a),'requestSupplement',{WO18:'请补照片',WO20:'请说明'}));assert.throws(()=>run(s,R,'supplement',{id:a,revision:record(s,R,'reports',a)._rev,data:{SP02:'位置'}}));assert.throws(()=>task(s,taskFor(s,b),'markDuplicate',{WO18:'重复',WO21:taskFor(s,a)}));assert.throws(()=>task(s,taskFor(s,a),'markFalse',{WO18:'误报'}));
 assert.equal(record(s,R,'reports',b).event,undefined);assert.equal(query(s,R,'reports').length,2);assert.throws(()=>record(s,{app:'resident',account:'resident-a',role:'resident'},'reports',a));
});

test("阶段局部复位保留Stage00档案、关系、历史和附件", () => {
  const s = fresh();
  const before = structuredClone({
    houses: s.houses,
    relations: s.relations,
    history: s.history,
  });
  s.attachments.keep = { owner: "resident-b" };
  const id = report(s);
  reset(s, R);
  assert.deepEqual(
    { houses: s.houses, relations: s.relations, history: s.history },
    before
  );
  assert.ok(s.attachments.keep);
  assert.equal(s.stage01.reports.length, 0);
  assert.equal(s.schemaVersion, 2);
});
test("AC-A07 关单与迟到成功保留事实，授权变化进入核查", () => {
  const s = fresh();
  auxiliary(s, R, "mode", { mode: "unknown" });
  const b = query(s, R, "bills")[0],
    p = run(s, R, "pay", { id: b._id, kind: "物业费", revision: b._rev });
  auxiliary(s, PA, "replay", { id: p.id, outcome: "已关闭" });
  s.relations.find((r) => r._id === "REL-B")["关系状态"] = "已解除";
  auxiliary(s, PA, "replay", { id: p.id, outcome: "成功" });
  const paid = record(s, R, "payments", p.id);
  assert.equal(paid.PY12, "成功");
  assert.equal(paid.PY07, 28000);
  assert.equal(paid.PY17, "异常");
  assert.ok(query(s, PA, "checks").some((r) => r.EX02 === "授权变化后的付款"));
  assert.throws(() => record(s, R, "bills", b._id));
});
test("AC-A11 两笔收款均保留，退款事实不自动重开应收", () => {
  const s = fresh(),
    b = query(s, R, "bills")[0],
    p = run(s, R, "pay", { id: b._id, kind: "物业费", revision: b._rev });
  auxiliary(s, PA, "funds", { id: p.id, kind: "duplicate" });
  assert.equal(query(s, R, "payments").length, 2);
  assert.equal(record(s, R, "bills", b._id).BL15, 28000);
  assert.ok(query(s, PA, "checks").some((r) => r.EX02 === "重复收款"));
  auxiliary(s, PA, "funds", { id: p.id, kind: "refund" });
  assert.equal(record(s, R, "payments", p.id).PY21, 28000);
  assert.equal(record(s, R, "bills", b._id).BL16, 0);
});
test("AC-B08 转派责任人与实际操作者、旧版本和退单拒绝",()=>{
 const s=fresh(),id=report(s),w=taskFor(s,id);task(s,w,'dispatch',{WO04:'P-S01',WO05:'维修'});const old=record(s,PA,'workorders',w);task(s,w,'startProcess');task(s,w,'transfer',{OP03:'P-S02',OP04:'调整内部人员安排'});
 assert.throws(()=>task(s,w,'submitProcess',{PR02:'旧责任人',PR07:'完成'}));const colleague={...PA,account:'property-colleague'};let r=record(s,colleague,'workorders',w);assert.equal(r.WO06,'待处理');run(s,colleague,'startProcess',{id:w,revision:r._rev});r=record(s,colleague,'workorders',w);assert.equal(r.WO04,'陈晓');assert.equal(r.history.slice(-1)[0].HI03,'陈晓');assert.equal(r.WO08,old.WO08);assert.throws(()=>run(s,PA,'startProcess',{id:w,revision:old._rev}));assert.throws(()=>run(s,colleague,'return',{id:w,revision:r._rev,data:{OP01:'旧退单'}}));
});

test("AC-B04 误报不算整改，重复技术提交不再建事件", () => {
  const s = fresh(),
    data = {
      RP07: "报修",
      RP08: "设施维修",
      RP09: "C-A",
      RP10: "E-A",
      RP11: "公共位置",
      RP13: "公共走道",
      RP14: "灯具问题",
      RP15: "周明",
      RP16: "13900000002",
    };
  const a = run(s, R, "report", { data, operation: "same-report" }),
    b = run(s, R, "report", { data, operation: "same-report" });
  assert.equal(a.id, b.id);
  assert.equal(s.stage01.events.length, 1);
  const e = record(s, PA, "reports", a.id).event;
  assert.throws(()=>task(s,taskFor(s,a.id),'markFalse',{WO18:'现场设施正常'}));
  assert.equal(record(s, R, 'reports', a.id).RP19, '待派单');
  assert.equal(s.stage01.workorders.length, 1);
  assert.equal(s.stage01.workorders[0].WO06,'待派单');
});
test("AC-A09/A10 未发布可核验，发布后不可覆盖，截止未知不猜逾期", () => {
  const s = fresh(),
    text = billTemplate
      .replaceAll("台账-", "其他-")
      .replace("2026-11-30,11月物业服务费", "2026-01-01,11月物业服务费");
  run(s, PA, "import", { text, source: "历史补充台账" });
  const drafts = query(s, PA, "bills").filter((b) => b.BL19 === "待发布");
  assert.equal(drafts[0].BL21, "到期未缴");
  assert.equal(drafts[1].BL21, "截止日未明确");
  const b = drafts[0];
  run(s, PA, "publish", { id: b._id, revision: b._rev, confirm: true });
  const published = record(s, PA, "bills", b._id);
  assert.throws(() =>
    run(s, PA, "editBill", { id: b._id, revision: published._rev, data: {} })
  );
  const ex = run(s, PA, "createCheck", { id: b._id, table:"bills", revision:published._rev });
  assert.equal(record(s, PA, "checks", ex.id).EX03, b._id);
});
test("AC-C02/C04 工单与资金不串改，业务流程不依赖新增消息", () => {
  const s = fresh(),
    b = query(s, R, "bills")[0];
  auxiliary(s, R, "mode", { mode: "unknown" });
  const p = run(s, R, "pay", { id: b._id, kind: "物业费", revision: b._rev });
  const messages = structuredClone(s.messages),
    id = report(s),
    w = taskFor(s, id);
  process(s, w);
  assert.equal(record(s, R, "reports", id)._status, "待确认");
  assert.equal(record(s, R, "payments", p.id).PY12, "结果待确认");
  assert.deepEqual(s.messages, messages);
});
test("AC-F03 原始描述与文件证据不可任意替换，旧核实请求拒绝", () => {
  const s = fresh(),
    id = report(s),
    e = record(s, PA, "reports", id).event;
  s.stage01.reports.find((r) => r._id === id).RP08 = "";
  assert.throws(() =>
    run(s, PA, "verify", {
      id: e._id,
      revision: e._rev,
      data: { EV05: "有效", EV06: "没有分类" },
    })
  );
  assert.throws(() =>
    run(s, R, "supplement", {
      id,
      revision: record(s, R, "reports", id)._rev,
      data: { SP02: "增加照片", SP03: ["no-attachment"] },
    })
  );
  assert.equal(record(s, R, "reports", id).RP14, "通道灯具损坏，需要处理");
});
test("支付失败后的合法新尝试可成功，月租失败不锁死订单", () => {
  const s = fresh();
  auxiliary(s, R, "mode", { mode: "failure" });
  const rel = query(s, R, "parkingRelations")[0],
    prod = query(s, R, "products")[0],
    m = run(s, R, "createMonthly", {
      relation: rel._id,
      product: prod._id,
      productVersion: prod.MP08,
      start: "2026-11-01",
      end: "2026-11-30",
    });
  const order = record(s, R, "monthly", m.id);
  run(s, R, "pay", { id: m.id, kind: "停车月租", revision: order._rev });
  assert.equal(record(s, R, "monthly", m.id).MO10, "待支付");
  auxiliary(s, R, "mode", { mode: "normal" });
  run(s, R, "pay", { id: m.id, kind: "停车月租", revision: order._rev });
  assert.equal(record(s, R, "monthly", m.id).MO10, "已登记");
});

test("移动响应式输入转普通数据，处理记录入库不带无关表单字段", () => {
  const s = fresh(),
    id = report(s, "隐患"),
    w = taskFor(s, id);
  task(s, w, "dispatch", { WO04: "P-S01", WO05: "整改", HZ04:"完成整改并保留前后照片" });
  task(s, w, "startProcess");
  const r = record(s, STAFF, "workorders", w),
    data = new Proxy(
      {
        PR02: "已清理",
        PR07: "已恢复",
        PR05: new Proxy(photos(s), {}),
        PR06: new Proxy(photos(s), {}),
        EV13: new Proxy([], {}),
        RP14: "无关输入",
      },
      {}
    );
  command(s, STAFF, "submitProcess", { id: w, revision: r._rev, data });
  assert.doesNotThrow(() => structuredClone(s));
  const saved = s.stage01.workorders.find((r) => r._id === w).rounds[0];
  assert.equal(saved.RP14, undefined);
  assert.equal(saved.EV13, undefined);
  assert.equal(saved.PR05.length, 1);
});

test("附件授权只认业务证据字段，正文不能借附件标识读取内部文件", () => {
  const s = fresh(),
    hidden = photos(s)[0],
    result = run(s, R, "report", {
      data: {
        RP07: "报修",
        RP08: "设施维修",
        RP09: "C-A",
        RP10: "E-A",
        RP11: "公共位置",
        RP13: "公共走道",
        RP14: hidden,
        RP15: "周明",
        RP16: "13900000002",
      },
    });
  assert.throws(() =>
    attachmentId(s, R, { table: "reports", id: result.id, attachment: hidden })
  );
  const r = record(s, R, "reports", result.id);
  assert.throws(() =>
    run(s, R, "supplement", {
      id: r._id,
      revision: r._rev,
      data: { SP02: { PR05: [hidden] } },
    })
  );
  s.stage01.reports
    .find((x) => x._id === r._id)
    .RP18.push({ SP02: { PR05: [hidden] }, SP03: [] });
  assert.throws(() =>
    attachmentId(s, R, { table: "reports", id: r._id, attachment: hidden })
  );
});

test("AC-B16 授权统计随六态变化，未评价不默认满意",()=>{
 const s=fresh(),id=report(s);assert.equal(overview(s,PA).ST02,1);const foreign=structuredClone(s.stage01.events[0]);Object.assign(foreign,{_id:'outside-scope',_org:'ORG-B',_estate:'E-B'});s.stage01.events.push(foreign);assert.equal(overview(s,PA).ST02,1);
 const w=taskFor(s,id);task(s,w,'dispatch',{WO04:'P-S01',WO05:'检查灯具'});assert.equal(overview(s,PA).ST01,1);assert.equal(overview(s,PA).ST03,0);task(s,w,'startProcess');assert.equal(overview(s,PA).ST03,1);task(s,w,'submitProcess',{PR02:'已检修',PR07:'照明正常'});assert.equal(overview(s,PA).ST05,1);
 const r=record(s,R,'reports',id);run(s,R,'confirm',{id,revision:r._taskRevision,data:{UC01:'已解决'}});assert.equal(overview(s,PA).ST05,0);assert.equal(overview(s,PA).ST04,1);assert.equal(record(s,R,'reports',id).resolution.VA05,'未评价');assert.equal(record(s,R,'reports',id).resolution.VA01,undefined);assert.throws(()=>overview(s,R));assert.ok(Date.parse(overview(s,PA).ST09));
});

test("AC-B02/F04 补充操作停用，撤回电话查看权限立即生效",()=>{
 const s=fresh(),id=report(s),w=taskFor(s,id);assert.throws(()=>task(s,w,'requestSupplement',{WO18:'位置不足',WO20:'请补充门牌位置'}));assert.equal(record(s,R,'reports',id).feedback.EV07,'');
 const role=s.roles.find(r=>r._id==='property');role['敏感查看与导出权限']=[];assert.equal(record(s,PA,'reports',id).RP16,undefined);assert.equal(record(s,R,'reports',id).RP16,'13900000002');const r=record(s,R,'reports',id);assert.throws(()=>run(s,R,'supplement',{id,revision:r._rev,data:{SP02:'位于东门外侧'}}));assert.equal(record(s,R,'reports',id).RP18.length,0);
});

test("AC-F03 隐患按统一工单派单，处理人与要求必填",()=>{
 const s=fresh(),id=report(s,'隐患'),w=taskFor(s,id);assert.throws(()=>task(s,w,'dispatch',{WO05:'整改'}));assert.throws(()=>task(s,w,'dispatch',{WO04:'P-S01'}));assert.equal(record(s,PA,'workorders',w).WO06,'待派单');task(s,w,'dispatch',{WO04:'P-S01',WO05:'清理通道'});assert.equal(record(s,PA,'workorders',w).WO06,'待处理');
});

test("AC-F05 停车业务关联锁定及同车场去重，未引用关系更正同步授权范围", () => {
  const s = fresh(),
    pk = record(s, PA, "parkingRelations", s.stage01.parkingRelations[0]._id);
  const data = { ...pk };
  assert.throws(() => run(s, PA, "saveParkingRelation", { data }));
  assert.throws(() =>
    run(s, PA, "saveParkingRelation", {
      id: pk._id,
      revision: pk._rev,
      data: { ...data, PK04: "OTHER-PARK" },
    })
  );
  const v = {
    ...s.vehicles.find((v) => v._id === "V-B"),
    _id: "V-NEW",
    _resident: "R-A",
    车牌号码: "苏A9H286",
    关联房屋: "H-S01",
  };
  s.vehicles.push(v);
  const n = run(s, PA, "saveParkingRelation", {
    data: {
      PK02: v._id,
      PK04: "NEW-PARK",
      PK05: "澄园停车场",
      PK08: "物业核验登记簿",
      PK09: "已核对车辆",
      PK07: "有效",
    },
  });
  let row = record(s, PA, "parkingRelations", n.id);
  assert.equal(
    query(s, { ...R, account: "resident-a" }, "parkingRelations").length,
    1
  );
  run(s, PA, "saveParkingRelation", {
    id: row._id,
    revision: row._rev,
    data: { ...row, PK02: "V-B", PK09: "未发生业务，更正车辆关联" },
  });
  assert.equal(
    query(s, { ...R, account: "resident-a" }, "parkingRelations").length,
    0
  );
  row = record(s, PA, "parkingRelations", n.id);
  assert.equal(row._scope.estate, "E-A");
  assert.equal(row.PK06, "R-B");
  assert.equal(row.history.at(-1).HI05.PK02, "V-NEW");
  assert.equal(row.history.at(-1).HI06.PK02, "V-B");
});
test("AC-F05 已发布临停不能换关系，月租保留停车关系快照", () => {
  const s = fresh(),
    tb = record(s, PA, "temporary", s.stage01.temporary[0]._id);
  const other = run(s, PA, "saveParkingRelation", {
    data: {
      PK02: "V-B",
      PK04: "OTHER-PARK",
      PK05: "另一停车场",
      PK08: "物业台账",
      PK09: "已核验",
      PK07: "有效",
    },
  });
  assert.throws(() =>
    run(s, PA, "saveTemporary", {
      id: tb._id,
      revision: tb._rev,
      data: { ...tb, TB06: "12.00", TB03: other.id },
    })
  );
  const rel = query(s, R, "parkingRelations")[0],
    product = query(s, R, "products")[0],
    m = run(s, R, "createMonthly", {
      relation: rel._id,
      product: product._id,
      productVersion: product.MP08,
      start: "2026-11-01",
      end: "2026-11-30",
    });
  const current = record(s, PA, "parkingRelations", rel._id);
  run(s, PA, "saveParkingRelation", {
    id: rel._id,
    revision: current._rev,
    data: { ...current, PK05: "后续车场名称", PK09: "名称核验变更" },
  });
  assert.equal(record(s, R, "monthly", m.id).relation.PK05, "青禾花园停车场");
  assert.equal(
    record(s, R, "temporary", tb._id).relation.PK05,
    "青禾花园停车场"
  );
});

test("AC-C01 上报权限在Service重查，住户不能伪造上报人或跨社区建事件", () => {
  const s = fresh(),
    data = {
      RP07: "报修",
      RP08: "设施维修",
      RP09: "C-A",
      RP10: "E-A",
      RP11: "公共位置",
      RP13: "东侧入口",
      RP14: "路灯损坏",
      RP15: "周明",
      RP16: "13900000002",
      RP03: "其他居民",
    };
  const r = run(s, R, "report", { data });
  assert.equal(record(s, R, "reports", r.id).RP03, "周明");
  assert.equal(record(s, R, "reports", r.id).RP04, "");
  const count = s.stage01.events.length;
  assert.throws(() =>
    run(s, R, "report", { data: { ...data, RP09: "C-B", RP10: "E-B" } })
  );
  assert.equal(s.stage01.events.length, count);
  const manual = run(s, PA, "report", { data });
  assert.equal(record(s, PA, "reports", manual.id).RP03, "其他居民");
  assert.equal(record(s, PA, "reports", manual.id).RP04, "物业管理员");
});
