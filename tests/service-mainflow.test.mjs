import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../prototype-shared/core.js";
import * as api from "../prototype-shared/service/index.js";
import {qualified} from "../prototype-shared/service/common.js";
import {moneySections, saleSections} from "../prototype-shared/service/display.js";
const R = { app: "resident", account: "resident-a" },
  B = { app: "resident", account: "resident-b" },
  M = { app: "merchant", account: "service-merchant-a" },
  MB = { app: "merchant", account: "service-merchant-b" },
  W = { app: "web", account: "platform-admin" };
const address = {
  联系人姓名: "林悦",
  联系人电话: "13800005555",
  省份: "江苏省",
  城市: "南京市",
  区县: "秦淮区",
  所属社区: "C-A",
  所属小区: "E-A",
  详细地址: "演示路10号1栋1单元101室",
  默认地址: true,
};
let seq = 0;
function setup() {
  const s = createSeed();
  api.prepare(s);
  api.auxiliary(s, W, "clock", { time: "2026-11-16T15:20:00+08:00" });
  return s;
}
function run(s, a, name, r, data = {}, extra = {}) {
  return api.command(s, a, name, {
    id: r?._id,
    revision: r?._rev,
    operationId: "new-flow-" + ++seq,
    data,
    ...extra,
  }).record;
}
function get(s, o, a = M) {
  return api.record(s, a, "orders", o._id);
}
function book(s, point = false, sv) {
  sv = sv || (point ? "SV-FAN" : "SV-HOME");
  const v = api.record(s, R, "services", sv),
    sp = v["服务规格集合"][0];
  return run(s, R, "order.create", null, {
    选定服务项目: sv,
    选定服务规格: sp["规格编号"],
    选定履约方式: point ? "POINT" : "HOME",
    联系人姓名: "林悦",
    联系人电话: "13800005555",
    期望时间选择: "时间可协商",
    服务约定确认: true,
    服务对象描述: "一台挂机空调",
    ...(point ? { 到点服务地点: "POINT-A" } : { 上门服务地址: address }),
  });
}
function paid(s, point = false, sv) {
  return run(s, R, "order.pay", book(s, point, sv));
}
const dispatch = {
  服务人员: "P-A",
  安排服务日期: "2026-11-16",
  安排开始时间: "15:00",
  安排结束时间: "16:00",
};
function ready(s, point = false, sv) {
  return run(s, M, "order.accept", get(s, paid(s, point, sv)), dispatch);
}
function complete(s, o, extra = {}) {
  return run(s, M, "order.result", o, {
    实际完成内容: "已完成约定内容",
    服务码: get(s, o, R).credential?.服务码,
    ...extra,
  });
}

for (const point of [false, true])
  test(
    "新版主线 " +
      (point ? "到点59元" : "上门99元") +
      " 派工→结果→分账→评价，幂等且不制造旧节点",
    () => {
      const s = setup();
      let o = paid(s, point);
      assert.equal(o["当前业务进度"], "待接单");
      assert.equal(o._flowVersion, 2);
      o = get(s, o);
      assert.equal(o._actions.find((a) => a.primary).label, "接单并派工");
      assert.throws(() => run(s, M, "order.accept", o, {}), /服务人员/);
      o = run(s, M, "order.accept", o, dispatch);
      assert.equal(o["当前业务进度"], "待服务");
      assert.equal(o.currentArrangement["安排状态"], "已生效");
      assert.equal(o.currentArrangement["居民答复人"], undefined);
      assert.equal(
        get(s, o, R)._actions.some((a) => a.name === "aftersale.apply"),
        false,
      );
      for (const name of [
        "order.respond",
        "order.start",
        "order.arrive",
        "order.arrange",
        "order.process",
        "order.confirm",
        "order.anomaly",
      ])
        assert.throws(() => run(s, M, name, o, {}), /此订单使用/);
      const snapshot = JSON.stringify(o["服务内容快照"]);
      o = complete(s, o);
      assert.equal(o["当前业务进度"], "待评价");
      assert.equal(o["居民确认时间"], undefined);
      assert.equal(o.rounds[0]["开始记录时间"], undefined);
      assert.equal(
        o.fundRecords.find((f) => f["资金类型"] === "分账")["本次成功分账金额"],
        point ? "53.04" : "89.00",
      );
      assert.equal(o.credential["凭证状态"], "已核验");
      const repeat = complete(s, o);
      assert.equal(repeat.results.length, 1);
      assert.equal(
        repeat.fundRecords.filter((f) => f["资金类型"] === "分账").length,
        1,
      );
      const residentOrder = get(s, o, R);
      assert.equal(
        residentOrder._actions.find((a) => a.primary).name,
        "evaluation.save",
      );
      const e = run(s, R, "evaluation.save", residentOrder, {
        总体评分: 5,
        评价内容: "满意",
      });
      assert.equal(get(s, o, R)["当前业务进度"], "已完成");
      assert.equal(
        run(s, R, "evaluation.save", residentOrder, { 总体评分: 1 })._id,
        e._id,
      );
      assert.equal(JSON.stringify(get(s, o)["服务内容快照"]), snapshot);
      const stats = api.overview(s, M);
      assert.equal(stats.period.end, "2026-11-16");
      assert.equal(stats.values["服务完成数"], 1);
      assert.equal(stats.values["已完成订单数"], 1);
      assert.equal(stats.values["商户净实分金额"], point ? "53.04" : "89.00");
      assert.equal(
        api.query(
          s,
          M,
          "funds",
          stats.metrics.find((m) => m.name === "商户净实分金额").filters,
        ).length,
        1,
      );
      assert.throws(() => get(s, o, MB), /无权/);
      assert.throws(() => get(s, o, B), /无权/);
    },
  );
test("凭证与图片校验失败保持原事实，取消申请和完成互锁", () => {
  const s = setup();
  let o = ready(s, true);
  const before = JSON.stringify(s.service.orders);
  assert.throws(() => complete(s, o, { 服务码: "WRONG" }), /服务码/);
  assert.equal(JSON.stringify(s.service.orders), before);
  const cancelled = run(s, R, "order.cancel", get(s, o, R), {
    申请原因: "临时有事",
  });
  o = get(s, cancelled);
  assert.equal(
    api.overview(s, M).values["当前售后待处理数"],
    1,
    "取消核实进入商户待办",
  );
  assert.throws(() => complete(s, o), /取消或售后/);
  const sale = o.currentAftersale;
  run(s, M, "aftersale.cancelDecision", sale, {
    取消核实结果: "不同意取消",
    核实依据说明: "已提供服务，按约提交结果",
  });
  o = complete(s, get(s, o));
  assert.equal(o["当前业务进度"], "待评价");
  let ac = ready(s, false, "SV-AC");
  assert.throws(() => complete(s, ac), /图片/);
  s.attachments["FLOW-PHOTO"] = {
    ...s.attachments["S02-IMAGE-SV-HOME"],
    owner: M.account,
    visibility: "业务可见",
    recordId: ac._id,
    table: "orders",
  };
  ac = complete(s, ac, { 结果图片: ["FLOW-PHOTO"] });
  assert.equal(ac["当前业务进度"], "待评价");
});
test("拒单、接单前取消和派工后同意取消均唯一全退", () => {
  for (const mode of ["refuse", "direct", "dispatched"]) {
    const s = setup();
    let o = mode === "dispatched" ? ready(s) : paid(s);
    if (mode === "refuse")
      o = run(s, M, "order.accept", get(s, o), {
        接单结果: "无法承接",
        无法承接说明: "人员不足",
      });
    else {
      o = run(s, R, "order.cancel", get(s, o, R), { 申请原因: "取消测试" });
      if (mode === "dispatched") {
        run(s, M, "aftersale.cancelDecision", get(s, o).currentAftersale, {
          取消核实结果: "同意取消",
          核实依据说明: "尚未服务，同意取消",
        });
        o = get(s, o);
      }
    }
    assert.equal(o["当前业务进度"], "已取消");
    assert.equal(
      s.service.funds.filter((f) => f["资金类型"] === "退款").length,
      1,
    );
    assert.equal(
      s.service.funds.find((f) => f["资金类型"] === "退款")._amount,
      9900,
    );
    assert.equal(
      s.service.funds.some((f) => f["资金类型"] === "分账"),
      false,
    );
  }
});
test("完成后售后与回退，新订单禁止补充履约，评价不改变退款与分账", () => {
  const s = setup();
  let o = ready(s);
  assert.throws(
    () =>
      run(s, R, "aftersale.apply", get(s, o, R), {
        申请类型: "申请退款",
        申请原因: "提前售后",
      }),
    /完成后/,
  );
  o = complete(s, o);
  let sale = run(s, R, "aftersale.apply", get(s, o, R), {
    申请类型: "申请退款",
    申请原因: "服务质量",
    申请退款金额: "99.00",
  });
  assert.throws(
    () =>
      run(s, M, "aftersale.plan", sale, {
        方案处理类型: "补充履约",
        方案说明: "补充",
        业务结案方式: "继续履约／补充履约",
      }),
    /不提供补充/,
  );
  sale = run(s, M, "aftersale.plan", sale, {
    方案处理类型: "全额退款",
    方案说明: "同意全额退款",
    业务结案方式: "完成后售后解决",
  });
  assert.equal(sale["售后状态"], "已解决");
  assert.equal(
    s.service.funds.filter((f) => f["资金类型"] === "回退").length,
    1,
  );
  run(s, R, "evaluation.save", get(s, o, R), { 总体评分: 3 });
  assert.equal(api.overview(s, M).values["商户净实分金额"], "0.00");
  assert.equal(
    api.overview(s, M).values["服务完成数"],
    1,
    "退款不抹除实际服务完成事实",
  );
  assert.equal(api.overview(s, M).values["已完成订单数"], 1);
});
test("个人地址本人权限、默认唯一、地区联动校验、快照与服务复位隔离", () => {
  const s = setup();
  const a = run(s, R, "address.save", null, address);
  const b = run(s, R, "address.save", null, {
    ...address,
    详细地址: "二号测试地址",
  });
  assert.equal(
    api.query(s, R, "addresses").filter((a) => a["默认地址"]).length,
    1,
  );
  assert.equal(api.query(s, B, "addresses").length, 0);
  assert.throws(() => run(s, B, "address.delete", a), /无权/);
  assert.throws(() => api.query(s, M, "addresses"), /住户/);
  assert.throws(
    () => run(s, R, "address.save", null, { ...address, 城市: "杭州市" }),
    /省、市、区/,
  );
  const o = book(s);
  run(s, R, "address.save", api.record(s, R, "addresses", a._id), {
    ...address,
    详细地址: "已修改",
  });
  run(s, R, "address.delete", api.record(s, R, "addresses", b._id));
  assert.equal(get(s, o, R)["地点快照"]["详细地址"], address["详细地址"]);
  const before = api.query(s, R, "addresses");
  api.reset(s, W);
  assert.deepEqual(api.query(s, R, "addresses"), before);
});
test("正常种子使用实时日期，旧记录不迁移或自动分账", () => {
  const s = createSeed();
  api.prepare(s);
  assert.equal(
    api.options(s, R).today,
    new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
  );
  api.auxiliary(s, W, "scenario", { name: "S02-STATS" });
  const before = JSON.stringify(s.service.orders),
    funds = JSON.stringify(s.service.funds);
  api.prepare(s);
  api.query(s, R, "orders");
  assert.equal(JSON.stringify(s.service.orders), before);
  assert.equal(JSON.stringify(s.service.funds), funds);
});

function input(s, serviceId='SV-HOME') {
  const service=api.record(s,R,'services',serviceId);
  return {选定服务项目:serviceId,选定服务规格:service['服务规格集合'][0]['规格编号'],选定履约方式:'HOME',联系人姓名:'林悦',联系人电话:'13800005555',服务约定确认:true,期望时间选择:'时间可协商',上门服务地址:address};
}
test('V1.2复验：预校验无写入，复用条件必填与归属校验，正式提交再次校验',()=>{
 const s=setup(), data=input(s), before=JSON.stringify(s);
 assert.deepEqual(api.preflight(s,R,data),{valid:true,amount:'99.00'});
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>api.preflight(s,R,{...data,联系人电话:''}),e=>!!e.fields?.联系人电话);
 assert.throws(()=>api.preflight(s,R,input(s,'SV-AC')),e=>!!e.fields?.服务对象描述);
 assert.throws(()=>api.preflight(s,M,data),/住户/);
 assert.equal(JSON.stringify(s),before,'成功与失败预校验均不建单、资金、操作号或日志');
 s.service.services.find(r=>r._id==='SV-HOME')['上架状态']='已下架';
 assert.throws(()=>run(s,R,'order.create',null,data),/下架|上架|销售/);
 assert.equal(s.service.orders.length,0);
});
test('V1.2复验：两端订单按创建时间倒序，同时间使用稳定单号次序',()=>{
 const s=setup(), a=paid(s), b=paid(s);
 for(const ctx of [R,M,W])assert.deepEqual(api.query(s,ctx,'orders').map(o=>o._id),[b._id,a._id]);
 assert.equal(api.query(s,B,'orders').length,0);
 assert.equal(api.query(s,MB,'orders').length,0);
});
test('V1.2复验：整份申请材料不绑定类目，提交、审批、恢复和交易一致',()=>{
 const s=setup(), reviewer={app:'web',account:'property-admin'};s.service.categories.find(c=>c._id==='CAT-CLEAN')['商户证明是否必需']=true;
 let q=api.query(s,M,'qualifications')[0];const prior=[...q['获准服务类目']];
 q=run(s,M,'qualification.save',q,{申请服务类目:['CAT-CLEAN'],申请覆盖社区:['C-A'],服务资质材料:[]});
 assert.deepEqual(q['获准服务类目'],prior,'新申请不提前覆盖旧授权');
 q=run(s,M,'qualification.submit',q);
 assert.equal(q.申请状态,'待审核');
 q=run(s,reviewer,'qualification.review',q,{审核结果:'退回修改',审核意见:'核对已提交范围'});
 s.attachments['application-proof']={id:'application-proof',stage02:true,status:'成功',owner:api.options(s,M).actor._id,name:'经营证明.png',type:'image/png',size:10};
 q=run(s,M,'qualification.save',q,{服务资质材料:[{材料名称:'整份申请经营证明',长期有效:true,证明文件:['application-proof']}]});
 assert.deepEqual(q['服务资质材料'][0]['对应服务类目'],[]);
 q=run(s,M,'qualification.submit',q);
 assert.throws(()=>run(s,reviewer,'qualification.review',q,{审核结果:'通过',批准服务类目:['CAT-AC']}),/批准范围/);
 q=run(s,reviewer,'qualification.review',q,{审核结果:'通过',批准服务类目:['CAT-CLEAN'],批准覆盖社区:['C-A']});
 assert.equal(qualified(s,'SHOP-A','CAT-CLEAN'),true);
 assert.equal(qualified(s,'SHOP-A','CAT-AC'),false);
 q=run(s,reviewer,'qualification.status',q,{状态:'暂停',原因说明:'暂停核查'});
 assert.equal(qualified(s,'SHOP-A','CAT-CLEAN'),false);
 q=run(s,reviewer,'qualification.status',q,{状态:'有效',原因说明:'已重新核验整份申请材料'});
 assert.equal(qualified(s,'SHOP-A','CAT-CLEAN'),true);
 assert.throws(()=>api.attachmentId(s,B,{table:'qualifications',id:q._id,attachmentId:'application-proof'}),/无权/);
});
test('V1.2复验：新裁定及更正均被业务层拒绝，协商退款与原资金仍可查',()=>{
 const s=setup();let o=complete(s,ready(s));
 let sale=run(s,R,'aftersale.apply',get(s,o,R),{申请类型:'申请退款',申请原因:'服务问题',申请退款金额:'20.00'});
 assert.equal(api.record(s,W,'aftersales',sale._id)._actions.some(a=>a.name.startsWith('aftersale.ruling')),false);
 const before=JSON.stringify(s.service.funds);
 for(const name of ['aftersale.ruling','aftersale.rulingNote'])assert.throws(()=>run(s,W,name,sale,{}),/仅支持协商/);
 assert.equal(JSON.stringify(s.service.funds),before);
 sale=run(s,M,'aftersale.plan',sale,{方案处理类型:'部分退款',方案说明:'协商退还部分费用',拟退款金额:'10.00',金额依据说明:'未完成部分费用',业务结案方式:'完成后售后解决'});
 assert.equal(sale['售后状态'],'待居民确认方案');
 sale=run(s,R,'aftersale.respond',sale,{方案版本:sale.plans.at(-1)['方案版本'],居民方案答复:'同意'});
 assert.equal(sale['售后状态'],'已解决');
 const summary=saleSections(api.record(s,W,'aftersales',sale._id));
 assert.ok(summary[0].values.some(([k,v])=>k==='住户答复'&&v==='同意'));
 assert.ok(moneySections(api.record(s,W,'aftersales',sale._id)).some(f=>f.kind==='退款'));
 assert.equal(s.service.funds.filter(f=>f['资金类型']==='退款').length,1);
});
test('V1.2复验：资金简表使用真实记录快照，公开评价保留全部可见内容',()=>{
 const s=setup();let o=complete(s,ready(s));
 const sections=moneySections(get(s,o,W));
 const split=sections.find(s=>s.kind==='分账');
 assert.ok(split.values.some(([k,v])=>k==='商户分账金额'&&v==='¥89.00'));
 assert.ok(split.values.some(([k,v])=>k==='物业分账金额'&&v==='¥10.00'));
 assert.ok(split.values.some(([k,v])=>k==='分配规则'&&v.includes('89.00')));
 for(let i=0;i<4;i++){if(i)o=complete(s,ready(s));run(s,R,'evaluation.save',get(s,o,R),{总体评分:4,评价内容:'公开评价 '+i})}
 const service=api.record(s,R,'services','SV-HOME');
 assert.equal(service.evaluations.length,4);
 assert.ok(service.evaluations.every(r=>!r['联系电话']&&!r['联系人电话']));
});

test("评价旧值按隐藏读取，新操作同时控制居民公开内容与附件", () => {
  const s = setup();
  const order = complete(s, ready(s));
  const image = { id:"review-photo", owner:R.account, stage02:true, status:"成功",
    type:"image/png", name:"评价图.png", size:14 };
  s.attachments[image.id] = image;
  const review = run(s,R,"evaluation.save",get(s,order,R),{
    总体评分:5, 评价内容:"上门服务已结束", 评价图片:[image.id],
  });
  const publicPhoto = { table:"services", id:"SV-HOME", attachmentId:image.id };
  assert.equal(api.attachmentId(s,B,publicPhoto),image.id);
  const raw = s.service.evaluations.find(r=>r._id===review._id);
  raw.评价展示状态 = "受限";
  assert.equal(api.record(s,W,"evaluations",review._id).评价展示状态,"隐藏");
  assert.equal(api.record(s,B,"services","SV-HOME").evaluations.length,0);
  assert.throws(()=>api.attachmentId(s,B,publicPhoto),/附件|业务对象/);
  let current = run(s,W,"evaluation.status",review,{状态:"显示"});
  assert.equal(api.attachmentId(s,B,publicPhoto),image.id);
  current = run(s,W,"evaluation.status",current,{状态:"隐藏"});
  assert.equal(current.评价展示状态,"隐藏");
  assert.throws(()=>api.attachmentId(s,B,publicPhoto),/附件|业务对象/);
  assert.equal(api.record(s,R,"evaluations",review._id).评价内容,"上门服务已结束");
});

test("双方式服务码按订单发放，仅本人可看，待服务旧单稳定升级", () => {
  const s = setup(), h = ready(s), p = ready(s, true);
  const code = o => get(s, o, R).credential.服务码;
  assert.match(code(h), /^\d{6}$/);
  assert.match(code(p), /^\d{6}$/);
  assert.notEqual(code(h), code(p));
  assert.equal(get(s, h, M).credential.服务码, undefined);
  assert.equal(get(s, h, W).服务码, undefined);
  assert.deepEqual(api.query(s, MB, "orders", {serviceCode:code(h)}), []);
  assert.deepEqual(api.query(s, M, "orders", {serviceCode:code(h)}).map(r=>r._id), [h._id]);
  assert.throws(() => complete(s, h, {服务码:code(p)}), /服务码/);
  assert.equal(get(s, h).credential.凭证状态, "有效");
  assert.equal(get(s, h).fundRecords.filter(f=>f.资金类型==="分账").length, 0);
  const raw = s.service.orders.find(o=>o._id===h._id);
  delete raw.credential;
  api.prepare(s);
  const upgraded = code(h);
  api.prepare(s);
  assert.equal(code(h), upgraded);
  assert.equal(complete(s,h).服务码状态,"已核验");
  assert.deepEqual(api.query(s,M,"orders",{serviceCode:upgraded}),[]);
});

test("绑定房屋地址只取本人的有效关系、保存真实地址，解绑保留旧单快照", () => {
  const s=setup(), home=api.options(s,B).boundHomes[0];
  assert.ok(home?.绑定房屋);
  const payload={...address,地址来源:"绑定房屋",绑定房屋:home.绑定房屋,详细地址:"由档案覆盖"};
  assert.throws(()=>run(s,R,"address.save",null,payload),/绑定/);
  const saved=run(s,B,"address.save",null,payload);
  assert.equal(saved.详细地址,home.详细地址);
  const booking={选定服务项目:"SV-HOME",选定服务规格:"SP-BASE",选定履约方式:"HOME",联系人姓名:"周宁",联系人电话:address.联系人电话,期望时间选择:"时间可协商",服务约定确认:true,上门服务地址:{_id:saved._id}};
  booking.选定服务规格=api.record(s,B,"services","SV-HOME").服务规格集合[0].规格编号;
  api.preflight(s,B,booking);
  const order=run(s,B,"order.create",null,booking);
  s.relations.find(r=>r._resident==="R-B"&&r._house===home.绑定房屋).关系状态="已解除";
  assert.throws(()=>api.preflight(s,B,booking),/绑定/);
  assert.throws(()=>run(s,B,"order.create",null,booking),/绑定/);
  assert.equal(api.record(s,B,"orders",order._id).地点快照.详细地址,home.详细地址);
});

test("可申请小区目录覆盖全部启用小区，整份批准后才扩大经营范围", () => {
  const s=setup(), opt=api.options(s,M);
  assert.ok(opt.applicationEstates.some(e=>e.value==="E-B"));
  assert.ok(!opt.estates.some(e=>e.value==="E-B"));
  let q=api.record(s,M,"qualifications","Q-A");
  q=run(s,M,"qualification.save",q,{申请服务类目:q.获准服务类目,申请覆盖小区:["E-A","E-B"]});
  q=run(s,M,"qualification.submit",q);
  assert.ok(!api.options(s,M).estates.some(e=>e.value==="E-B"));
  q=run(s,W,"qualification.review",q,{审核结果:"通过"});
  assert.deepEqual(q.获准小区,["E-A","E-B"]);
  assert.ok(api.options(s,M).estates.some(e=>e.value==="E-B"));
});
