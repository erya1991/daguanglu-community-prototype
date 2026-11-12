import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.PREVIEW_BASE||'http://127.0.0.1:9123',session='stage02-detail-r3-'+Date.now();
const browser=await chromium.launch({channel:'msedge',headless:true});const ctx=await browser.newContext({viewport:{width:1366,height:768}}),web=await ctx.newPage(),resident=await ctx.newPage(),merchant=await ctx.newPage();
await resident.setViewportSize({width:390,height:844});await merchant.setViewportSize({width:390,height:844});
const root='.runtime/stage01/status-detail-1794385924290/';
async function go(p,app,route){await p.goto(`${base}/${app}/?session=${session}#${route}`);await p.waitForTimeout(700)}
async function api(p,app,method,args=[]){return p.evaluate(async({app,method,args})=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const a=createBrowserAdapter(app);await a.start();return method==='identity'?a.identity(...args):a.service[method](...args)},{app,method,args})}
async function clean(loc){const text=await loc.innerText();assert.doesNotMatch(text,/操作历史|操作记录|办理轨迹|变更历史/);return text}
try {
 await go(web,'web','/service/orders');await api(web,'web','identity',['property-admin']);await web.reload();await api(web,'web','auxiliary',['scenario',{name:'S02-STATS'}]);
 const orders=await api(web,'web','query',['orders',{}]);assert.ok(orders.length);
 for(const [route,title] of [['orders','服务订单号'],['aftersales','售后'],['funds','资金']]){
   await go(web,'web','/service/'+route);await api(web,'web','identity',['property-admin']);await web.reload();await web.locator('.service-workspace .loading-state').waitFor({state:'hidden'});const row=web.locator('[data-record]').first();await row.waitFor();await row.getByRole('button',{name:'查看详情'}).click();const detail=web.locator('.service-detail-drawer:visible').last();await detail.locator('.service-detail-group').first().waitFor();await web.waitForTimeout(900);const text=await clean(detail);assert.ok(text.includes(title),route+' lacks key business information');assert.equal(await detail.locator('.ivu-tabs-tab').count(),0);assert.equal(await detail.locator('[data-action]').count(),0);await detail.screenshot({path:root+'service-'+route+'-panel.png'});
 }
 const order=orders.find(o=>o._id==='T01')||orders[0];
 for(const [p,app,account] of [[resident,'resident','resident-a'],[merchant,'merchant','merchant']]){
   await go(p,app,'/pages/service/order?id='+encodeURIComponent(order._id));await api(p,app,'identity',[account]);await p.reload();await p.locator('.service-details').waitFor();const text=await clean(p.locator('.service-details'));assert.match(text,/订单|服务/);assert.ok(!text.includes('服务内容快照'));assert.equal(await p.locator('.service-details .uni-tabs').count(),0);await p.screenshot({path:root+'service-order-'+app+'.png'});
 }
 console.log('PASS 服务订单、售后、资金 Web 单页及住户／商户订单详情');
} catch(e){await web.screenshot({path:root+'service-details-failure.png'}).catch(()=>{});throw e} finally {await ctx.close();await browser.close()}
