import {chromium} from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.PREVIEW_BASE||'http://127.0.0.1:19213',session='stage01-required-'+Date.now();
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}}),web=await context.newPage(),resident=await context.newPage(),staff=await context.newPage(),merchant=await context.newPage();
for(const p of [resident,staff,merchant])await p.setViewportSize({width:390,height:844});
const field=(p,id)=>p.locator(`[data-field="${id}"]:visible`).last();
const mobileName=(p,name)=>p.locator(`[data-field-name="${name}"]:visible`).last();
async function marked(field,expected=true,selector='.form-field__required'){
 await field.waitFor();const marker=field.locator(selector);if(expected)await marker.waitFor();assert.equal(await marker.count(),expected?1:0,await field.innerText());
 if(expected){const color=await marker.evaluate(e=>getComputedStyle(e).color),rgb=color.match(/\d+/g).map(Number);assert.ok(rgb[0]>130&&rgb[1]<110&&rgb[2]<110,'红色标识: '+color)}
}
async function go(p,app,route){await p.goto(`${base}/${app}/?session=${session}#${route}`);await p.waitForTimeout(700)}
try{
 await go(resident,'resident','/pages/stage01/repairs/create');await field(resident,'RP14').waitFor();
 for(const id of ['RP07','RP08','RP09','RP10','RP11','RP13','RP14','RP15','RP16'])await marked(field(resident,id));
 await marked(field(resident,'RP06'),false);await marked(field(resident,'RP17'),false);
 await field(resident,'RP07').click();await resident.locator('uni-picker-view').hover();await resident.mouse.wheel(0,40);await resident.waitForTimeout(700);await resident.locator('.uni-picker-action-confirm:visible').click();
 await marked(field(resident,'RP17'));assert.equal(await field(resident,'RP15').count(),0);
 await resident.screenshot({path:'.runtime/stage01/required-markers-20261112/resident-required.png'});

 await go(staff,'staff','/pages/stage01/reports/create');await field(staff,'RP14').waitFor();await marked(field(staff,'RP14'));await marked(field(staff,'RP06'),false);
 await go(web,'web','/workorders/tasks');await web.getByRole('button',{name:'登记工单',exact:true}).click();const modal=web.locator('.ivu-modal-wrap:visible').last();
 for(const id of ['RP07','RP08','RP09','RP10','RP11','RP13','RP14','RP15','RP16'])await marked(field(modal,id),true,'.s1-required');
 await marked(field(modal,'RP06'),false,'.s1-required');await marked(field(modal,'RP17'),false,'.s1-required');
 await field(modal,'RP07').locator('select').selectOption('隐患');await marked(field(modal,'RP17'),true,'.s1-required');assert.equal(await field(modal,'RP15').count(),0);
 assert.equal(await field(modal,'RP14').locator('textarea').getAttribute('aria-required'),'true');await web.waitForTimeout(700);await modal.locator('.ivu-modal').screenshot({path:'.runtime/stage01/required-markers-20261112/web-required.png'});
 await go(web,'web','/property/bills/import');await marked(field(web,'IM02'),true,'.s1-required');assert.equal(await web.locator('label').filter({has:web.locator('[data-field="IM01"]')}).locator('.s1-required').count(),1);

 await go(merchant,'merchant','/pages/service/action?table=services&action=service.save');await mobileName(merchant,'服务名称').waitFor();
 for(const name of ['服务名称','所属服务类目','服务主图','服务简介','服务详细说明','公开服务电话']){
   const marker=name==='服务主图'?'.required':'.form-field__required';await marked(mobileName(merchant,name),true,marker);
 }
 await marked(mobileName(merchant,'介绍图片'),false,'.required');await merchant.getByText('添加规格',{exact:true}).click();await marked(mobileName(merchant,'规格说明'));await merchant.screenshot({path:'.runtime/stage01/required-markers-20261112/merchant-required.png'});
 await go(merchant,'merchant','/pages/service/action?table=qualifications&id=Q-A&action=qualification.save');await merchant.reload();await merchant.getByText('添加服务资质材料',{exact:true}).click();await marked(mobileName(merchant,'材料名称'));await marked(mobileName(merchant,'生效日期'),false);

 await go(resident,'resident','/pages/service/booking?id=SV-HOME');await mobileName(resident,'联系人姓名').waitFor();await marked(mobileName(resident,'联系人姓名'));await marked(mobileName(resident,'联系人电话'));await marked(mobileName(resident,'需求补充说明'),false);await marked(mobileName(resident,'详细地址'));assert.ok(await resident.locator('.agreement .required-mark').count());
 await go(resident,'resident','/pages/foundation/relations/apply');await marked(resident.locator('.control-row').filter({hasText:'房号'}),true,'.required-mark');
 await go(resident,'resident','/pages/stage01/parking/monthly');await marked(resident.locator('.choice-label').filter({hasText:'月租产品'}),true,'.required-mark');await marked(field(resident,'MO07'),true,'.required-mark');await marked(field(resident,'MO08'),true,'.required-mark');

 await go(web,'web','/service/categories');await web.evaluate(async()=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const a=createBrowserAdapter('web');await a.start();await a.identity('platform-admin','platform')});await web.reload();await web.getByRole('button',{name:'新增服务类目'}).click();const action=web.locator('.service-action-drawer:visible').last();
 const category=action.locator('.service-field').filter({has:web.locator('label').filter({hasText:/^类目名称/})}).first();await marked(category,true,'.required');const parent=action.locator('.service-field').filter({has:web.locator('label').filter({hasText:/^上级类目/})}).first();await marked(parent,false,'.required');
 await web.evaluate(async()=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const a=createBrowserAdapter('web');await a.start();await a.identity('property-admin','property');await a.service.auxiliary('scenario',{name:'S02-IN-SERVICE'})});
 await go(merchant,'merchant','/pages/service/action?table=orders&id=S02-DEMO-ORDER&action=order.result');await merchant.reload();await mobileName(merchant,'服务结果').waitFor();await marked(mobileName(merchant,'服务结果'));await marked(mobileName(merchant,'实际完成内容'));assert.equal(await mobileName(merchant,'未完成原因').count(),0);
 await mobileName(merchant,'服务结果').locator('uni-picker').click();await merchant.locator('uni-picker-view').hover();await merchant.mouse.wheel(0,40);await merchant.waitForTimeout(700);await merchant.locator('.uni-picker-action-confirm:visible').click();await marked(mobileName(merchant,'未完成内容'));await marked(mobileName(merchant,'未完成原因'));
 console.log('PASS Web、住户、物业管理及商户表单：必填红色、可选无标记、条件切换和服务预约');
}finally{await context.close();await browser.close()}
