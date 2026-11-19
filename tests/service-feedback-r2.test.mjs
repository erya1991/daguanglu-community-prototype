import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, query, execute, optionsFor, statistics, actorFor } from "../prototype-shared/core.js";
import { businessDate } from "../prototype-shared/r3-product.js";
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

test('反馈R02 创建日期首尾包含、按创建时间倒序；不同住户隔离',()=>{
 const s=setup();const first=paid(s);api.auxiliary(s,W,'clock',{time:'2026-11-17T23:59:00+08:00'});const last=paid(s,true);
 assert.deepEqual(api.query(s,R,'orders',{start:'2026-11-16',end:'2026-11-17'}).map(x=>x._id),[last._id,first._id]);
 assert.deepEqual(api.query(s,R,'orders',{start:'2026-11-17',end:'2026-11-17'}).map(x=>x._id),[last._id]);
 assert.equal(api.query(s,B,'orders',{start:'2026-11-16',end:'2026-11-17'}).some(x=>[first._id,last._id].includes(x._id)),false);
});
test('反馈R12 资金按订单去重，付款与分账合卡；金额是实际成功累计，权限不扩大',()=>{
 const s=setup(), h=complete(s,ready(s)), p=paid(s,true);
 const filters={groupBy:'order',start:'2026-11-16',end:'2026-11-16'};
 const rows=api.query(s,M,'funds',filters);assert.equal(rows.length,2);
 const a=rows.find(x=>x._id===h._id),b=rows.find(x=>x._id===p._id);
 assert.deepEqual([a._fundSummary.paid,a._fundSummary.split,a._fundSummary.refund,a._fundSummary.splitStatus],[9900,8900,0,'成功']);
 assert.deepEqual([b._fundSummary.paid,b._fundSummary.split,b._fundSummary.splitStatus],[5900,0,'未分账']);
 assert.ok(a.fundRecords.some(x=>x['资金类型']==='支付'));assert.ok(a.fundRecords.some(x=>x['资金类型']==='分账'));
 assert.equal(api.query(s,MB,'funds',filters).some(x=>[h._id,p._id].includes(x._id)),false);
 assert.equal(api.query(s,M,'funds',filters).length,2);
});
test('反馈R06 商户售后待办按办理责任计算；追加命令关闭，历史证据保留',()=>{
 const s=setup(),o=complete(s,ready(s));api.auxiliary(s,W,'clock',{time:'2026-11-17T15:20:00+08:00'});let sale=run(s,R,'aftersale.apply',get(s,o,R),{申请类型:'申请退款',申请原因:'清洁遗漏',申请退款金额:'20.00',期望解决方式:'协商解决',问题说明:'需退部分费用',问题证据:[]});
 const pending=()=>api.query(s,M,'aftersales',{pendingForMerchant:true});
 assert.ok(pending().some(x=>x._id===sale._id));
 const snapshot=JSON.stringify(s.service);
 for(const actor of [R,M])assert.throws(()=>run(s,actor,'aftersale.evidence',sale,{追加说明:'已关闭'}),/不支持追加证据/);
 assert.equal(JSON.stringify(s.service),snapshot);
 assert.ok(!api.record(s,R,'aftersales',sale._id)._actions.some(a=>a.name==='aftersale.evidence'));
 sale=run(s,M,'aftersale.plan',sale,{方案处理类型:'部分退款',拟退款金额:'20.00',金额依据说明:'按申请',方案说明:'同意退还20元',业务结案方式:sale.handlingOptions.plan['部分退款'][0]});
 assert.equal(pending().some(x=>x._id===sale._id),false);
 sale=run(s,R,'aftersale.respond',sale,{方案版本:sale.plans.at(-1)['方案版本'],居民方案答复:'同意'});
 if(sale['售后状态']==='待执行'){assert.ok(pending().some(x=>x._id===sale._id));sale=run(s,M,'aftersale.execute',sale)}
 assert.equal(pending().some(x=>x._id===sale._id),false);
 const row=api.query(s,M,'funds',{groupBy:'order',start:'2026-11-17',end:'2026-11-17'}).find(x=>x._id===o._id);assert.equal(row._fundSummary.refund,2000);assert.ok(row._fundSummary.reversal>0);assert.equal(row._fundSummary.paid,9900);assert.equal(Number(api.overview(s,M,{start:'2026-11-17',end:'2026-11-17'}).values['期间支付成功金额']),0);
});
test('反馈R09 供给可选类目仅为有效获批类目，不能通过选择器扩大经营范围',()=>{
 const s=setup(),o=api.options(s,M);assert.ok(o.approvedCategories.length);
 for(const id of o.approvedCategories)assert.ok(qualified(s,'SHOP-A',id));
 assert.equal(api.options(s,B).approvedCategories.length,0);
});


test('派工必须亲选当前合格的本店人员，已选人员停用后提交失败', () => {
  const s=setup(), o=paid(s), before=get(s,o);
  assert.deepEqual(before.dispatchPersonnel.map(p=>p.value), ['P-A']);
  assert.throws(()=>run(s,M,'order.accept',before,{...dispatch,服务人员:''}));
  const staff=api.record(s,M,'personnel','P-A');
  run(s,M,'personnel.status',staff,{状态:'停用'});
  assert.deepEqual(get(s,o).dispatchPersonnel, []);
  assert.throws(()=>run(s,M,'order.accept',before,dispatch));
  assert.equal(get(s,o).当前业务进度,'待接单');
  assert.throws(()=>api.record(s,MB,'orders',o._id));
  assert.equal(api.record(s,R,'orders',o._id).dispatchPersonnel,undefined);
  run(s,M,'personnel.status',api.record(s,M,'personnel','P-A'),{状态:'启用'});
  const ac=paid(s,false,'SV-AC');
  const person=s.service.personnel.find(p=>p._id==='P-A');
  person.人员资质材料.forEach(material => {material.长期有效=false; material.有效截止日期='2026-11-15'});
  assert.deepEqual(get(s,ac).dispatchPersonnel.map(p=>p.value),['P-A']);
  assert.equal(api.record(s,M,'personnel','P-A').资质有效性,'已失效');
  assert.deepEqual(get(s,o).dispatchPersonnel.map(p=>p.value),['P-A']);
});
test('待答复方案可撤回，拒绝接口和撤回后的重复操作不产生退款或回退', () => {
  const s=setup(), o=complete(s,ready(s));
  let sale=run(s,R,'aftersale.apply',get(s,o,R),{申请类型:'申请退款',申请原因:'部分清洗遗漏',申请退款金额:'20.00',期望解决方式:'协商解决',问题说明:'退还遗漏部分'});
  sale=run(s,M,'aftersale.plan',api.record(s,M,'aftersales',sale._id),{方案处理类型:'部分退款',拟退款金额:'20.00',金额依据说明:'遗漏部分',方案说明:'退20元',业务结案方式:sale.handlingOptions.plan['部分退款'][0]});
  const reply={方案版本:sale.plans.at(-1).方案版本,居民方案答复:'同意'};
  assert.throws(()=>run(s,R,'aftersale.respond',sale,{...reply,居民方案答复:'不同意'}),/确认或撤回/);
  assert.equal(api.record(s,R,'aftersales',sale._id).售后状态,'待居民确认方案');
  const withdrawn=run(s,R,'aftersale.withdraw',sale,{});
  assert.equal(withdrawn.售后状态,'已撤回');
  assert.throws(()=>run(s,R,'aftersale.respond',withdrawn,reply));
  const order=get(s,o);assert.equal(order.fundRecords.filter(f=>['退款','分账回退'].includes(f.资金类型)).length,0);
  assert.throws(()=>api.record(s,B,'aftersales',sale._id));
});
test('共用空间目录和根统计遵守主体范围，指定其他小区不能提交房屋申请',()=>{
  const s=setup();
  for(const [ctx,id] of [[R,'E-A'],[B,'E-A']]){
    assert.deepEqual(optionsFor(s,ctx,'applications','所属小区').map(e=>e.value),[id]);
    assert.ok(query(s,ctx,'houses').every(h=>h.所属小区===id));
  }
  const outside=s.houses.find(h=>h['所属小区']==='E-B');
  assert.ok(outside);
  assert.throws(()=>execute(s,R,'apply',{data:{_house:outside._id,申请类型:'绑定',申请关系类型:'业主',联系号码:'13800000001'}}),/可选小区范围/);
  assert.throws(()=>api.record(s,B,'orders',paid(s)._id));
  const optionsA=api.options(s,M), optionsB=api.options(s,MB);
  assert.deepEqual(optionsA.estates.map(e=>e.value),['E-A']);
  assert.deepEqual(optionsB.estates.map(e=>e.value),['E-A']);
  assert.ok(api.query(s,M,'services').every(x=>x._shop==='SHOP-A'));
  assert.ok(api.query(s,MB,'services').every(x=>x._shop==='SHOP-B'));
  // Exercise distinct estate grants without changing the shared demonstration accounts.
  const shopB=s.service.merchants.find(m=>m._id==='SHOP-B');
  shopB._estate='E-B'; shopB._community='C-B';
  const qualificationB=s.service.qualifications.find(q=>q._shop==='SHOP-B');
  qualificationB.获准小区=['E-B']; qualificationB.获准社区=['C-B'];
  assert.deepEqual(api.options(s,MB).estates.map(e=>e.value),['E-B']);
  assert.deepEqual(api.options(s,M).estates.map(e=>e.value),['E-A']);
  const a=actorFor(s,W);
  assert.ok(a.permissions.includes('read:statistics'));
  const result=statistics(s,{...W,estate:'E-A'},{scopes:[{table:'root',id:''}],metric:'设施类别',date:businessDate()});
  const visible=query(s,{...W,estate:'E-A'},'facilities');
  assert.equal(result[0].数值,new Set(visible.map(f=>f._id)).size);
});
