// Browser review of the published local candidate using a copy of a previous Stage02 QA session.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs';

const root = path.resolve(import.meta.dirname, '..');
const base = process.env.STAGE02_URL || 'http://127.0.0.1:19221';
const sourceReport = process.argv[2];
if (!sourceReport) throw Error('请提供上一轮本地浏览器 results.json');
const old = JSON.parse(fs.readFileSync(sourceReport, 'utf8'));
const src = path.resolve(old.profile, 'Default/IndexedDB');
if (!src.startsWith(path.resolve(root, '.runtime/stage02') + path.sep)) throw Error('只读取本项目既有测试会话');
const run = path.resolve(root, '.runtime/stage02/feedback-20261118', 'legacy-' + Date.now());
const profile = path.join(run,'profile');
const origin = new URL(base);
const dbDir = origin.protocol.slice(0,-1) + '_' + origin.hostname + '_' + origin.port + '.indexeddb.';
for (const type of ['leveldb','blob']) {
  const file = path.join(src, dbDir+type);
  if (fs.existsSync(file)) fs.cpSync(file,path.join(profile,'Default/IndexedDB',dbDir+type),{recursive:true});
}
const context = await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:390,height:844}});
const results = {base, sourceSession:old.session, H:old.H, P:old.P, checks:[], errors:[]};
context.on('page', p=>p.on('pageerror', e=>results.errors.push(e.message)));
const p = await context.newPage();
p.setDefaultTimeout(9000);
const route = async(app, location='') => {
  await p.goto(base+'/'+app+'/?session='+old.session+'#/'+location);
  await p.waitForLoadState('domcontentloaded');
};
const btn = (scope,title) => scope.locator('uni-button:visible,button:visible').filter({hasText:new RegExp('^\\s*'+title+'\\s*$')}).first();
const capture = title => p.screenshot({path:path.join(run,title+'.png')});
async function snapshot() {
  return p.evaluate(async session => {
    const request = q => new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
    const db=await request(indexedDB.open('dgl-community-prototype-stage00',1));
    const state=await request(db.transaction('sessions').objectStore('sessions').get(session));db.close();
    const service=state.service, categories=service.categories;
    const leaf=categories.find(c=>c.类目名称==='挂机空调清洗');
    const names=[]; for(let c=leaf;c;c=categories.find(parent=>parent._id===c.上级类目)) names.unshift(c.类目名称);
    const facts={};for(const key of ['orders','funds','services','qualifications','aftersales','evaluations']) {
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(service[key])));
      facts[key]={count:service[key].length,sha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')};
    }
    return {leaf:leaf._id,names,version:service.categorySamplesVersion,facts};
  },old.session);
}
async function check(name,fn) {
  try { const detail=await fn();results.checks.push({name,pass:true,detail});console.log(name+' OK') }
  catch(e){results.checks.push({name,pass:false,message:e.message});await capture('failure');throw e}
}
async function target(app,account){
  await p.evaluate(async({app,account})=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const a=createBrowserAdapter(app);await a.start();await a.identity(account)}, {app,account});
  await p.reload();
}
try {
  await p.goto(base+'/?session='+old.session);
  const ticket = (app, method, ...args) => p.evaluate(async ({app,method,args})=>{
    const {createBrowserAdapter}=await import('/_shared/storage-h5.js');return createBrowserAdapter(app).service[method](...args);
  },{app,method,args});
  await check('原会话升级保持末级、已有订单、授权、供给和资金事实',async()=>{
    const before=await snapshot();
    assert.equal(before.version,1);assert.deepEqual(before.names,['家电清洗','空调清洗','挂机空调清洗']);
    assert.ok(before.facts.orders.count>=2);
    await route('resident','pages/service/catalog');
    await p.locator('.filter-triggers').waitFor();
    const after=await snapshot();
    assert.equal(after.version,2);assert.equal(before.leaf,after.leaf);
    assert.deepEqual(after.names,['家电清洗','挂机空调清洗']);
    assert.deepEqual(before.facts,after.facts);
    return {before,after};
  });
  await check('双列服务卡片与图片点击、两级分类和可见范围',async()=>{
    for(const [app,location,account] of [['resident','pages/service/index','resident-a'],['merchant','pages/operation/index','service-merchant-a']]){
      await route(app,location);await target(app,account);
      for(const width of [390,414]){
        await p.setViewportSize({width,height:width===390?844:896});
        const cards=p.locator('.service-grid .record-card');await cards.nth(1).waitFor();
        const [a,b]=await Promise.all([cards.nth(0).boundingBox(),cards.nth(1).boundingBox()]);
        assert.ok(Math.abs(a.y-b.y)<2 && b.x>=a.x+a.width-1);
        assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        const prices=await cards.locator('.tile-footer .amount').evaluateAll(nodes=>nodes.map(node=>({
          height:node.getBoundingClientRect().height, line:parseFloat(getComputedStyle(node).lineHeight)
        })));
        assert.ok(prices.length && prices.every(price=>price.height<=price.line+2),'金额和“起”须在同一行');
        await capture(app+'-cards-'+width);
      }
      const trigger=p.locator('.filter-triggers uni-button').filter({hasText:'服务分类'});
      await trigger.click();
      await btn(p.locator('.level-one'),'家电清洗').click();
      await btn(p.locator('.level-two'),'挂机空调清洗').click();
      await p.locator('.filter-triggers').getByText('挂机空调清洗',{exact:true}).waitFor();
      await p.getByText('清除筛选',{exact:true}).click();
      await p.locator('.service-grid .record-card .service-picture').first().click();
      await p.waitForURL(/pages\/service\/(detail|action)\?/);
      assert.equal(await p.locator('.uni-image-viewer:visible').count(),0);
    }
  });
  await check('日期预设与自定义首尾、住户售后两个入口',async()=>{
    await route('resident','pages/service/orders');await target('resident','resident-a');
    await btn(p,'服务售后').click();await p.waitForURL(/pages\/service\/aftersales/);
    await p.locator('.filter-triggers').getByText('申请日期',{exact:true}).waitFor();
    await route('resident','pages/profile/index');await p.locator('[data-module="resident-aftersales"]').click();await p.waitForURL(/pages\/service\/aftersales/);
    for(const [app,account] of [['resident','resident-a'],['merchant','service-merchant-a']]){
      await route(app,'pages/service/orders');await target(app,account);
      const date=p.locator('.filter-triggers uni-button').nth(1);await date.click();
      for(const label of ['近7天','近30天','近90天'])await btn(p.locator('.date-presets'),label).waitFor();
      for(const field of await p.locator('.date-range uni-picker').all()){
        await field.click();await p.locator('.uni-picker-container:visible,.uni-picker-view-wrapper:visible,.uni-picker-action-confirm:visible').first().waitFor();
        await p.locator('.uni-picker-action-confirm:visible').click();
        await p.locator('.date-range').waitFor();
      }
      await btn(p,'确定范围').click();const summary=await p.locator('.date-summary').innerText();
      assert.match(summary,/\d{4}-\d{2}-\d{2}\s+至\s+\d{4}-\d{2}-\d{2}/);
      await date.click();await btn(p,'近90天').click();
      await p.locator('.order-time').first().waitFor();await capture(app+'-dates');
    }
  });
  await check('物业档案空间根与下钻',async()=>{
    await route('staff','pages/foundation/communities/index');await target('staff','property-admin');
    await p.getByText('大光路社区',{exact:true}).first().waitFor();
    await p.locator('.control-row').filter({hasText:'青禾花园'}).click();
    await btn(p,'返回上级').waitFor();
    await capture('staff-estates');await btn(p,'返回上级').click();
  });
  await check('Web限评恢复二次确认，关闭弹窗保留公开评价',async()=>{
    await route('web','service/evaluations');await target('web','platform-admin');
    await p.setViewportSize({width:1366,height:768});
    const row=p.locator('[data-record]').filter({hasText:old.H}).first();
    await row.waitFor();const id=await row.getAttribute('data-record');
    const status=async()=>p.evaluate(async(id)=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');return(await createBrowserAdapter('web').service.record('evaluations',id)).评价展示状态},id);
    const count=async()=>(await ticket('resident','record','services','SV-HOME')).evaluations.length;
    const initialCount=await count();const start=await status();assert.equal(start,'显示');const trigger=row.locator('[data-action="evaluation.status"]');
    await trigger.click();const modal=p.locator('.ivu-modal-confirm:visible');
    await modal.getByText(/低分/).waitFor();await modal.getByRole('button',{name:'取消'}).click();assert.equal(await status(),start);
    await trigger.click();await modal.getByRole('button',{name:/确定|确认/}).click();await p.waitForFunction(()=>!document.querySelector('.ivu-modal-confirm'));
    assert.notEqual(await status(),start);assert.equal(await count(),initialCount-1);
    await trigger.click();await modal.getByRole('button',{name:/确定|确认/}).click();
    await p.waitForFunction(()=>!document.querySelector('.ivu-modal-confirm'));assert.equal(await status(),start);
    assert.equal(await count(),initialCount);return {evaluation:id};
  });
  await check('供给编辑一次提交、当前发布版与原单价格保留',async()=>{
    await p.setViewportSize({width:390,height:844});
    await route('merchant','pages/service/action?table=services&id=SV-HOME');await target('merchant','service-merchant-a');
    const details = () => p.evaluate(async() => {
      const {createBrowserAdapter}=await import('/_shared/storage-h5.js'); const a=createBrowserAdapter('merchant');
      const item=await a.service.record('services','SV-HOME');
      return {state:item.审核状态,version:item.当前编辑版本,live:item.当前发布版本};
    });
    const before=await details();
    await btn(p,'编辑服务').click();
    await p.locator('[data-field-name="服务简介"] input,[data-field-name="服务简介"] textarea').first().fill('本次验收服务说明');
    await btn(p,'保存并提交审核').click();
    await p.waitForURL(/pages\/service\/supply/);
    const after=await details();assert.equal(after.state,'待审核');assert.equal(after.version,before.version+1);assert.equal(after.live,before.live);
    return {before,after};
  });
  await check('陈师傅停用与恢复、派工须主动选择',async()=>{
    await route('resident','pages/service/catalog');await target('resident','resident-a');
    const order=await p.evaluate(async()=>{
      const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const a=createBrowserAdapter('resident');
      const address=(await a.service.query('addresses'))[0];
      const created=await a.service.command('order.create',{operationId:'qa-explicit-worker-order',data:{选定服务项目:'SV-HOME',选定服务规格:'SPEC-HOME',选定履约方式:'HOME',联系人姓名:'林悦',联系人电话:'13800000001',上门服务地址:address,期望时间选择:'时间可协商',服务约定确认:true}});
      const paid=await a.service.command('order.pay',{id:created.id,revision:created.record._rev,operationId:'qa-explicit-worker-pay',data:{}});return paid.id;
    });
    for(const next of ['停用人员','启用人员']){
      await route('merchant','pages/service/personnel');await target('merchant','service-merchant-a');
      const row=p.locator('[data-record="P-A"]');
      await btn(row,next).click();const dlg=p.locator('.uni-modal:visible');await dlg.waitFor();assert.equal(await dlg.locator('input,textarea').count(),0);
      await dlg.locator('.uni-modal__btn_primary').click();await btn(row,next==='停用人员'?'启用人员':'停用人员').waitFor();
      await route('merchant','pages/service/order?id='+order);await btn(p,'接单并派工').click();
      const selector=p.locator('[data-field-name="服务人员"]');await selector.waitFor();
      if(next==='停用人员')await selector.getByText('暂无符合本单条件的已启用人员').waitFor();
      else{assert.ok(!(await selector.innerText()).includes('陈师傅'));await selector.locator('uni-picker').click();const column=p.locator('uni-picker-view-column:visible').first();await column.locator('.uni-picker-item').filter({hasText:'陈师傅'}).first().waitFor()}
    }
    return {order};
  });
  await check('住户撤回待答复申请，取消弹窗和重复进入均不退款',async()=>{
    await route('resident','pages/service/orders');await target('resident','resident-a');
    const sale=await p.evaluate(async()=>{
      const {createBrowserAdapter}=await import('/_shared/storage-h5.js');
      const r=createBrowserAdapter('resident'),m=createBrowserAdapter('merchant');await m.identity('service-merchant-a');
      let seq=0;
      const cmd=async(a,name,rec,data={})=>(await a.service.command(name,{id:rec?._id,revision:rec?._rev,data,operationId:'qa-withdraw-'+(++seq)})).record;
      const addresses=await r.service.query('addresses'),options=await m.service.options();
      let order=await cmd(r,'order.create',null,{选定服务项目:'SV-HOME',选定服务规格:'SPEC-HOME',选定履约方式:'HOME',上门服务地址:addresses[0],联系人姓名:'林悦',联系人电话:'13800000001',期望时间选择:'时间可协商',服务约定确认:true});
      order=await cmd(r,'order.pay',order);
      order=await cmd(m,'order.accept',await m.service.record('orders',order._id),{服务人员:'P-A',安排服务日期:options.today,安排开始时间:'00:00',安排结束时间:'23:59'});
      order=await cmd(m,'order.result',order,{实际完成内容:'完成约定清洁'});
      let record=await cmd(r,'aftersale.apply',await r.service.record('orders',order._id),{申请类型:'申请退款',申请原因:'部分清洁遗漏',申请退款金额:'20.00',期望解决方式:'协商解决',问题说明:'申请退还遗漏部分'});
      record=await m.service.record('aftersales',record._id);
      await cmd(m,'aftersale.plan',record,{方案处理类型:'部分退款',拟退款金额:'20.00',金额依据说明:'按遗漏部分计算',方案说明:'协商退20元',业务结案方式:record.handlingOptions.plan['部分退款'][0]});
      return {id:record._id,order:order._id};
    });
    await route('resident','pages/service/after-sale?id='+sale.id);
    const withdraw=btn(p,'撤回申请'),agree=btn(p,'确认方案');
    const [left,right]=await Promise.all([withdraw.boundingBox(),agree.boundingBox()]);
    assert.ok(left && right && left.x<right.x && Math.abs(left.y-right.y)<3);
    await agree.click();await p.locator('.uni-modal:visible').getByText(/20/).waitFor();
    await p.locator('.uni-modal__btn_default:visible').click();
    assert.equal((await ticket('resident','record','aftersales',sale.id)).售后状态,'待居民确认方案');
    await withdraw.click();await p.locator('.uni-modal__btn_primary:visible').click();
    await p.locator('.sale-buttons').waitFor({state:'hidden'});await p.reload();
    assert.equal((await ticket('resident','record','aftersales',sale.id)).售后状态,'已撤回');
    const order=await ticket('merchant','record','orders',sale.order);
    assert.equal(order.fundRecords.filter(f=>['退款','分账回退'].includes(f.资金类型)).length,0);
    return sale;
  });
  assert.deepEqual(results.errors,[]);
} catch(e){console.error(e.stack);console.error(p.url());process.exitCode=1}
finally{fs.writeFileSync(path.join(run,'results.json'),JSON.stringify(results,null,2));console.log(run);await context.close()}
