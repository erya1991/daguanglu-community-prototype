import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const narrow=process.env.AUDIT_NARROW==='1';
const ctx=await browser.newContext({viewport:{width:narrow?1024:1366,height:768}}), web=await ctx.newPage(), resident=await ctx.newPage(), staff=await ctx.newPage();
await resident.setViewportSize({width:narrow?320:390,height:narrow?568:844});await staff.setViewportSize({width:narrow?320:390,height:narrow?568:844});
const session='stage01-hazard-r3-'+Date.now(), base=process.env.PREVIEW_BASE||'http://127.0.0.1:9123';
const go=async(p,app,route)=>{await p.goto(`${base}/${app}/?session=${session}#${route}`);await p.waitForTimeout(800)};
const btn=(p,t)=>p.locator('button:visible,uni-button:visible').filter({hasText:new RegExp('^\\s*'+t+'\\s*$')}).last();
const field=(p,id)=>p.locator(`[data-field="${id}"]:visible`).last();
const fill=async(p,id,v)=>field(p,id).locator('input:not([type=file]),textarea').first().fill(v);
const modal=()=>web.locator('.ivu-modal-wrap:visible').last();
try {
 await go(resident,'resident','/pages/stage01/repairs/create');
 await field(resident,'RP07').click();await resident.locator('uni-picker-view').hover();await resident.mouse.wheel(0,40);await resident.waitForTimeout(700);await resident.locator('.uni-picker-action-confirm:visible').click();assert.match(await field(resident,'RP07').innerText(),/隐患/);
 const chooser=resident.waitForEvent('filechooser');await field(resident,'RP17').getByText('选择／拍摄照片',{exact:true}).click();await (await chooser).setFiles('docs/stages/stage-01/evidence/acceptance-r1/screenshots/bill-tabs.png');await field(resident,'RP17').locator('.photo').first().waitFor();
 await fill(resident,'RP13','东门走廊');await fill(resident,'RP14','六态隐患统一工单测试');await btn(resident,'确认登记工单').click();await resident.getByText('待派单',{exact:true}).first().waitFor();const residentPhoto=field(resident,'RP17').locator('img').first();await residentPhoto.waitFor();await resident.waitForFunction(el=>el.complete&&el.naturalWidth>0,await residentPhoto.elementHandle());
 await go(web,'web','/workorders/tasks');const row=web.locator('tr').filter({hasText:'六态隐患统一工单测试'}).first();await row.waitFor();await row.locator('td a').first().click();const detail=web.locator('.ivu-drawer:visible').last(),photo=detail.locator('[data-field="RP17"] img').first();await photo.waitFor();await web.waitForFunction(el=>el.complete&&el.naturalWidth>0,await photo.elementHandle());await photo.click();const preview=web.locator('.ivu-modal-wrap:visible').last();await preview.locator('img').waitFor();await preview.locator('.ivu-modal-close').click();await detail.locator('.ivu-drawer-close').click();await row.getByRole('button',{name:'人工派单'}).click();await fill(modal(),'WO05','移除隐患');await btn(modal(),'确认人工派单').click();await modal().waitFor({state:'hidden'});await row.getByRole('button',{name:'开始处理'}).waitFor();
 await go(staff,'staff','/pages/stage01/tasks/index');await staff.locator('.s1-mobile .card').filter({hasText:'六态隐患统一工单测试'}).first().click();const staffPhoto=field(staff,'RP17').locator('img').first();await staffPhoto.waitFor();await staff.waitForFunction(el=>el.complete&&el.naturalWidth>0,await staffPhoto.elementHandle());if(narrow){for(const p of [web,resident,staff])assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'页面不能整体横向溢出');await staff.screenshot({path:'.runtime/stage01/status-detail-1794385924290/workorder-staff-narrow.png'})}await btn(staff,'开始处理').click();await staff.locator('.uni-modal__btn_primary:visible').click();await btn(staff,'提交验收').waitFor();assert.equal(await btn(staff,'补充现场证据').count(),0);
 await btn(staff,'提交验收').click();await fill(staff,'PR02','已消除隐患');await fill(staff,'PR07','现场安全');await btn(staff,'确认提交验收').click();await staff.getByText('待确认',{exact:true}).first().waitFor();
 await resident.reload();await btn(resident,'确认处理结果').waitFor();await btn(resident,'确认处理结果').click();await btn(resident,'确认确认处理结果').click();await resident.getByText('待评价',{exact:true}).first().waitFor();await btn(resident,'服务评价').click();await field(resident,'VA01').click();await resident.locator('.uni-picker-action-confirm:visible').click();await btn(resident,'确认服务评价').click();await resident.getByText('已完成',{exact:true}).first().waitFor();
 console.log('PASS: 住户隐患带图上报、三端图片展示、Web预览与派单、管理端处理、住户确认评价');
} finally {await ctx.close();await browser.close()}
