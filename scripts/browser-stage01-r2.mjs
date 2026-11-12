import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const ctx=await browser.newContext({viewport:{width:1366,height:768}}), web=await ctx.newPage(), resident=await ctx.newPage(), staff=await ctx.newPage();
await resident.setViewportSize({width:390,height:844});await staff.setViewportSize({width:390,height:844});
const session='stage01-r2-browser-'+Date.now(), base=process.env.PREVIEW_BASE||'http://127.0.0.1:19202';
const go=async(p,app,route)=>{await p.goto(`${base}/${app}/?session=${session}#${route}`);await p.waitForTimeout(800)};
const btn=(p,t)=>p.locator('button:visible,uni-button:visible').filter({hasText:new RegExp('^\\s*'+t+'\\s*$')}).last();
const field=(p,id)=>p.locator(`[data-field="${id}"]:visible`).last();
const fill=async(p,id,v)=>field(p,id).locator('input:not([type=file]),textarea').first().fill(v);
const modal=()=>web.locator('.ivu-modal-wrap:visible').last();
try {
 await go(resident,'resident','/pages/stage01/repairs/create');
 await field(resident,'RP07').waitFor();
 await fill(resident,'RP13','东门走廊');await fill(resident,'RP14','R2验收测试照明故障');await btn(resident,'确认登记工单').click();await resident.getByText('待派单',{exact:true}).first().waitFor();
 await go(web,'web','/workorders/tasks'); const row=web.locator('tr').filter({hasText:'R2验收测试照明故障'}).first();await row.waitFor();await row.getByRole('button',{name:'人工派单'}).click();await modal().waitFor();await fill(modal(),'WO05','检查照明');await btn(modal(),'确认人工派单').click();await modal().waitFor({state:'hidden'});await row.getByRole('button',{name:'提交验收'}).waitFor();assert.equal(await row.getByRole('button',{name:'接单',exact:true}).count(),0);
 await go(staff,'staff','/pages/stage01/tasks/index');await staff.locator('.s1-mobile .card').filter({hasText:'R2验收测试照明故障'}).first().click();await btn(staff,'提交验收').waitFor();assert.equal(await btn(staff,'接单').count(),0);
 await row.getByRole('button',{name:'提交验收'}).click();await fill(modal(),'PR02','已更换灯具');await fill(modal(),'PR07','照明正常');await btn(modal(),'确认提交验收').click();await modal().waitFor({state:'hidden'});
 await resident.reload();await btn(resident,'确认处理结果').click();await btn(resident,'确认确认处理结果').click();await btn(resident,'服务评价').click();await field(resident,'VA01').click();await resident.locator('.uni-picker-action-confirm:visible').click();await btn(resident,'确认服务评价').click();await resident.getByText('已评价',{exact:true}).waitFor();
 console.log('PASS: 住户上报、Web派单与提交验收、管理端待办、住户确认评价');
} finally {await ctx.close();await browser.close()}
