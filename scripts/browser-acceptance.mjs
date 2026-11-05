import {chromium} from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=path.resolve(import.meta.dirname,'..'),base=JSON.parse(fs.readFileSync(path.join(root,'.runtime/stage00/preview.json'))).url,run='BROWSER_'+new Date().toISOString().replace(/[:.]/g,'-'),session=run.replace(/[^a-zA-Z0-9_-]/g,'')
const out=path.join(root,'.runtime/stage00',run);fs.mkdirSync(out,{recursive:true})
const ctx=await chromium.launchPersistentContext(path.join(out,'profile'),{channel:'msedge',headless:true,viewport:{width:390,height:844}}),results=[],errors=[],external=[],badRequests=[]
ctx.setDefaultTimeout(10000)
ctx.on('page',page=>{page.on('pageerror',e=>errors.push({page:page.url(),message:e.message}));page.on('request',r=>{if(!r.url().startsWith(base)&&!/^data:|^blob:/.test(r.url()))external.push(r.url());if(/\/(api|login|upload|pay|socket)(\/|\?)/i.test(r.url()))badRequests.push(r.url())})})
await ctx.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base)||/^data:|^blob:/.test(url))route.continue();else route.abort()})
const harness=await ctx.newPage();await harness.goto(base+'/?session='+session)
await harness.evaluate(async()=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');window.qa={};for(const app of ['web','resident','merchant','staff']){window.qa[app]=createBrowserAdapter(app);await window.qa[app].start()}})
async function call(app,method,...args){return harness.evaluate(async({app,method,args})=>window.qa[app][method](...args),{app,method,args})}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name)}catch(e){results.push({name,status:'FAIL',error:e.stack});console.log('FAIL '+name+': '+e.message)}fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({run,session,results,errors,external,badRequests},null,2))}
const resident=await ctx.newPage(),web=await ctx.newPage(),staff=await ctx.newPage()
let appId
await check('T04/T24/T28 住户页面提交 → Web页面审核 → 住户与管理端读取',async()=>{
 await call('web','identity','audit','reviewer')
 await resident.goto(base+'/resident/?session='+session+'#/pages/foundation/relations/apply?id=H-A&kind=绑定');await resident.locator('.form-field').filter({hasText:'申请关系类型'}).waitFor()
 await resident.locator('.form-field').filter({hasText:'申请关系类型'}).click();await resident.locator('.uni-picker-action-confirm:visible').click()
 await resident.locator('.form-field').filter({hasText:'申请说明'}).locator('textarea').fill('浏览器实际操作提交的虚构绑定说明')
 await resident.getByText('提交绑定申请',{exact:true}).click();await resident.waitForURL(/applications\/detail/)
 const applications=await call('resident','query','applications');appId=applications.find(r=>r['申请状态']==='待审核')._id
 await web.setViewportSize({width:1366,height:768});await web.goto(base+'/web/?session='+session+'#/applications');await web.getByRole('heading',{name:'关系申请',exact:true}).waitFor()
 const row=web.locator('.ivu-table-fixed-right .ivu-table-row').filter({hasText:appId}).first();if(await row.count())await row.getByText('详情',{exact:true}).click();else await web.locator('a:visible').filter({hasText:/^详情$/}).first().click()
 await web.getByRole('button',{name:'审核申请',exact:true}).click();const modal=web.locator('.ivu-modal-wrap').filter({has:web.getByText('审核关系申请',{exact:true})});await modal.locator('textarea').first().fill('浏览器审核通过，虚构样例');await modal.getByRole('button',{name:'确认模拟操作',exact:true}).click();await modal.waitFor({state:'hidden'})
 await resident.reload();await resident.getByText('已通过',{exact:true}).waitFor();await resident.screenshot({path:path.join(out,'resident-approved-390.png'),fullPage:true})
 await staff.goto(base+'/staff/?session='+session+'#/pages/foundation/houses/detail?id=H-A');await staff.getByText('完整房屋地址',{exact:true}).waitFor();assert.ok((await staff.locator('body').innerText()).includes('受限'))
 assert.equal((await call('resident','query','relations')).filter(r=>r['关系状态']==='有效').length,1)
 assert.equal((await call('resident','query','messages')).length,1)
 await web.screenshot({path:path.join(out,'web-review-1366.png'),fullPage:true})
})
await check('T28 多标签重复审核与撤回竞争不产生重复关系',async()=>{
 const r=await call('resident','command','apply',{data:{_house:'H-A2','申请类型':'绑定','申请关系类型':'租户','联系号码':'13900000001'}})
 const both=await Promise.allSettled([call('web','command','review',{id:r.id,decision:'通过'}),call('resident','command','withdraw',{id:r.id})]);assert.equal(both.filter(r=>r.status==='fulfilled').length,1)
 assert.ok((await call('resident','query','relations')).filter(r=>r._house==='H-A2').length<=1)
})
await check('T16/T28 分端身份、刷新恢复与仅当前会话复位',async()=>{
 const before=await call('resident','info');await call('web','identity','staff','query');assert.equal((await call('resident','info')).actor._id,before.actor._id)
 await resident.reload();await resident.getByText('已通过',{exact:true}).waitFor();assert.ok((await resident.locator('body').innerText()).includes('已通过'))
 const other=await ctx.newPage();await other.goto(base+'/?session=other-session');await other.evaluate(async()=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const x=createBrowserAdapter('resident');await x.start();await x.command('profile',{data:{'姓名':'其他会话示例','手机号':'13900000003'}})})
 await call('web','reset');assert.equal((await call('resident','query','relations')).length,0)
 assert.equal(await other.evaluate(async()=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');return (await createBrowserAdapter('resident').query('residents'))[0]['居民姓名']}),'其他会话示例');await other.close()
})
await check('T03/T13/T20 文件实际字节授权、失败保留与版本独立',async()=>{
 await call('web','identity','file-owner','file-manager')
 const id=await harness.evaluate(async()=>{const f=new File(['虚构版本二字节'],'虚构V2.txt',{type:'text/plain'});return (await window.qa.web.upload(f)).id})
 await call('web','command','fileVersion',{id:'FILE-A',blob:id,reason:'浏览器版本二样例'})
 const versions=await call('web','versions','FILE-A');assert.equal(versions.length,2)
 await call('web','identity','file-reader','file-reader')
 const bytes=await harness.evaluate(async()=>{const r=await window.qa.web.attachment({table:'files',id:'FILE-A',version:'V1',action:'view'});return r.blob.text()});assert.match(bytes,/V1/)
 await assert.rejects(()=>call('web','attachment',{table:'files',id:'FILE-A',action:'download'}),/下载权限/)
 await web.goto(base+'/web/?session='+session+'#/files');await web.reload();await web.locator('a:visible').filter({hasText:/^详情$/}).first().click();await web.getByRole('button',{name:'下载目标版本',exact:true}).click();await web.getByText(/当前身份没有该版本附件的下载权限/).waitFor();await web.screenshot({path:path.join(out,'file-reader-denied.png'),fullPage:true})
})
await check('T02/T03/T20 无权详情、联系方式和导出均由Adapter裁减',async()=>{
 await call('web','identity','staff','query');assert.match((await call('web','query','residents'))[0]['联系电话'],/\*\*\*\*/)
 await assert.rejects(()=>call('web','record','houses','H-B'),/无权/)
 await assert.rejects(()=>call('web','exportRows','residents'),/导出权限/)
 await assert.rejects(()=>call('web','scope','C-B',''),/扩大授权/)
 await staff.goto(base+'/staff/?session='+session+'#/pages/foundation/houses/detail?id=H-B');await staff.reload();await staff.getByText(/无权访问/).waitFor();assert.ok(!(await staff.locator('body').innerText()).includes('演示路20号'))
})
await check('T08 Web实际文件选择、预览、整批导入与重复错误',async()=>{
 await call('web','identity','archive','maintainer');await web.goto(base+'/web/?session='+session+'#/houses');await web.reload();await web.getByRole('button',{name:'房屋导入',exact:true}).click()
 const modal=web.locator('.ivu-modal-wrap').filter({has:web.getByText('房屋导入、预览与结果',{exact:true})}),template=await harness.evaluate(async()=>{const {importTemplate}=await import('/_shared/import-houses.js');return importTemplate})
 await modal.locator('input[type=file]').setInputFiles({name:'演示导入.csv',mimeType:'text/csv',buffer:Buffer.from(template)})
 await modal.locator('textarea').fill('浏览器文件选择的虚构来源');await modal.getByRole('button',{name:'校验预览',exact:true}).click();await modal.getByText('待确认导入',{exact:true}).waitFor();await modal.getByRole('button',{name:'确认整批导入',exact:true}).click();await modal.getByText('成功',{exact:true}).waitFor()
 await modal.getByRole('button',{name:'校验预览',exact:true}).click();await modal.getByText('校验未通过',{exact:true}).waitFor();await web.screenshot({path:path.join(out,'import-duplicate.png'),fullPage:true})
})
await check('T24/T26 四端导航、页面直达与移动视口无横向溢出',async()=>{
 for(const [app,tabs] of [['resident',['首页','服务','商城','我的']],['merchant',['工作台','经营','订单','我的']],['staff',['工作台','档案','我的']]]){
  const page=await ctx.newPage();for(const width of [390,414]){await page.setViewportSize({width,height:width===390?844:896});await page.goto(base+'/'+app+'/?session='+session);await page.locator('.tabbar__item').first().waitFor();assert.deepEqual(await page.locator('.tabbar__label').allTextContents(),tabs);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));for(const tab of tabs){await page.locator('.tabbar__item').filter({hasText:tab}).click();await page.waitForTimeout(150);assert.ok((await page.locator('body').innerText()).includes('演示模式'))}await page.screenshot({path:path.join(out,app+'-profile-'+width+'.png'),fullPage:true})}await page.close()
 }
})
await check('T25 来源框架所需六类画面与两类Web视口截图',async()=>{
 const shots=[['resident','/', 'resident-home'],['resident','/pages/profile/index','resident-profile'],['merchant','/','merchant-workbench'],['merchant','/pages/profile/index','merchant-profile'],['resident','/pages/foundation/vehicles/index','resident-list'],['resident','/pages/foundation/vehicles/edit','resident-form']]
 for(const [app,route,name] of shots){const page=await ctx.newPage();await page.goto(base+'/'+app+'/?session='+session+'#'+route);await page.waitForTimeout(250);await page.screenshot({path:path.join(out,name+'-390.png'),fullPage:true});await page.close()}
 for(const width of [1366,1920]){await web.setViewportSize({width,height:width===1366?768:1080});await web.goto(base+'/web/?session='+session+'#/houses');await web.reload();await web.waitForTimeout(300);await web.screenshot({path:path.join(out,'manager-houses-'+width+'.png'),fullPage:true})}
})
await check('T27 冷启动、保存、附件、失败和消息均无外部业务请求',async()=>{
 await call('resident','identity','resident-a','resident');await assert.rejects(()=>call('resident','command','profile',{data:{'姓名':'失败保留示例'},fail:true}),/失败/)
 assert.equal(external.length,0);assert.equal(badRequests.length,0);assert.deepEqual(errors,[])
})
const evidence={run,session,base,edgeVersion:ctx.browser()?.version(),results,errors,external,badRequests,finished:new Date().toISOString()};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));fs.writeFileSync(path.join(root,'docs/stages/stage-00/evidence/browser-results.json'),JSON.stringify({...evidence,path:path.relative(root,out).replaceAll('\\','/')},null,2));await ctx.close();process.exitCode=results.some(r=>r.status!=='PASS')?1:0
