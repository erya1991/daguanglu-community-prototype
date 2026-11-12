import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.PREVIEW_BASE||'http://127.0.0.1:9123', session='stage01-detail-audit-'+Date.now();
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}}),web=await context.newPage(),resident=await context.newPage();
await resident.setViewportSize({width:390,height:844});
const root='.runtime/stage01/status-detail-1794385924290/';
const go=async(p,app,route)=>{await p.goto(`${base}/${app}/?session=${session}#${route}`);await p.waitForTimeout(700)};
const noHistory=async(loc)=>{const text=await loc.innerText();assert.doesNotMatch(text,/操作历史|操作记录|办理轨迹|变更历史/)};
try {
 await go(web,'web','/property/bills');await web.locator('[data-record] td a').first().click();let drawer=web.locator('.ivu-drawer-wrap:visible').last();await drawer.locator('[data-field="BL01"]').waitFor();await noHistory(drawer);assert.equal(await drawer.locator('.ivu-tabs-tab').count(),0);assert.ok(await drawer.locator('[data-field="BL16"]').count());await web.screenshot({path:root+'bill-detail.png'});await web.locator('.ivu-drawer-close:visible').last().click();
 await go(web,'web','/parking/business');
 for(const label of ['停车关系','月租产品','临停账单']) {
   await web.getByText(label,{exact:true}).last().click();await web.locator('[data-record] td a').first().click();drawer=web.locator('.ivu-drawer-wrap:visible').last();await drawer.locator('.s1-detail-section').first().waitFor();await noHistory(drawer);assert.equal(await drawer.locator('.ivu-tabs-tab').count(),0);assert.ok((await drawer.innerText()).trim().length>20);await web.locator('.ivu-drawer-close:visible').last().click();
 }
 await go(resident,'resident','/pages/home/index');
 const application=await resident.evaluate(async()=>{
   const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const api=createBrowserAdapter('resident');await api.start();await api.identity('resident-b','resident');
   const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
   const image=await api.upload(new File([bytes],'proof.png',{type:'image/png'}));
   return api.command('apply',{data:{_house:'H-A','申请类型':'变更','申请关系类型':'业主','申请说明':'页面检查用关系申请','联系号码':'13900000002','证明附件':[image.id]}});
 });
 await go(resident,'resident','/pages/foundation/applications/detail?id='+encodeURIComponent(application.id));await resident.getByText('查看材料 1',{exact:true}).waitFor();await noHistory(resident.locator('body'));await resident.getByText('查看材料 1',{exact:true}).click();const photo=resident.locator('img[src^="blob:"]:visible').last();await photo.waitFor();await resident.waitForFunction(el=>el.complete&&el.naturalWidth>0,await photo.elementHandle());await resident.screenshot({path:root+'binding-resident-preview.png'});
 await go(web,'web','/applications');const actions=web.locator('[data-row-id="'+application.id+'"]:visible').first();await actions.waitFor();await actions.getByText('详情',{exact:true}).click();const binding=web.locator('.ivu-modal-wrap:visible').last();await binding.getByText('申请信息',{exact:true}).waitFor();await noHistory(binding);assert.equal(await binding.locator('.ivu-tabs-tab').count(),0);await binding.getByRole('button',{name:'查看材料 1'}).click();const preview=web.locator('.ivu-modal-confirm:visible').last();await preview.locator('img').waitFor();assert.ok(await preview.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));await web.screenshot({path:root+'binding-web-preview.png'});
 console.log('PASS 账单、停车关系／产品／临停详情及房屋绑定 Web／住户详情；材料预览可用');
} catch(e) {await web.screenshot({path:root+'details-web-failure.png'}).catch(()=>{});await resident.screenshot({path:root+'details-resident-failure.png'}).catch(()=>{});throw e} finally {await context.close();await browser.close()}
