import {chromium} from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=path.resolve(import.meta.dirname,'..'),base=JSON.parse(fs.readFileSync(path.join(root,'.runtime/stage00/preview.json'))).url,run='INTERACTION_'+Date.now(),out=path.join(root,'.runtime/stage00',run),results=[]
fs.mkdirSync(out,{recursive:true});const context=await chromium.launchPersistentContext(path.join(out,'profile'),{channel:'msedge',headless:true,viewport:{width:390,height:844}});context.setDefaultTimeout(10000);const page=await context.newPage()
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name)}catch(e){results.push({name,status:'FAIL',error:e.stack});console.log('FAIL '+name+': '+e.message)}}
await check('T11/T26 车辆表单模拟失败保留输入并可重试',async()=>{
 await page.goto(base+'/resident/?session='+run+'#/pages/foundation/vehicles/edit');const plate=page.locator('.form-field').filter({hasText:'车牌号码'}).locator('input');await plate.fill('苏AUI001');await page.locator('.form-field').filter({hasText:'车辆颜色'}).locator('input').fill('灰色');await page.locator('.failure-control uni-switch').click();await page.getByText('保存模拟资料',{exact:true}).click();await page.locator('.form-error').filter({hasText:/模拟处理失败/}).waitFor();assert.equal(await plate.inputValue(),'苏AUI001');await page.screenshot({path:path.join(out,'form-failure-retained.png'),fullPage:true});await page.locator('.failure-control uni-switch').click();await page.getByText('保存模拟资料',{exact:true}).click();await page.waitForURL(/vehicles\/detail/);await page.getByText('待核实',{exact:true}).waitFor()
})
await check('T19 无单元楼栋不显示虚构单元控件',async()=>{
 await page.goto(base+'/resident/?session='+run+'#/pages/foundation/relations/apply?id=H-N&kind=绑定');await page.reload();await page.locator('.form-field').filter({hasText:'申请关系类型'}).waitFor();assert.equal(await page.locator('[data-field="applications:所属单元"]').count(),0);await page.screenshot({path:path.join(out,'without-unit.png'),fullPage:true})
})
await check('T24 详情直达无返回栈时回本端我的入口',async()=>{
 await page.goto(base+'/staff/?session='+run+'#/pages/foundation/houses/detail?id=H-A');await page.reload();await page.getByText('完整房屋地址',{exact:true}).waitFor();await page.locator('.navbar__back').click();await page.waitForURL(/staff\/.*pages\/profile\/index/);await page.getByText('当前主体与范围',{exact:true}).waitFor()
})
fs.writeFileSync(path.join(root,'docs/stages/stage-00/evidence/interaction-results.json'),JSON.stringify({run,path:path.relative(root,out).replaceAll('\\','/'),results},null,2)+'\n');await context.close();process.exitCode=results.some(r=>r.status==='FAIL')?1:0
