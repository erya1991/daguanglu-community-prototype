import {chromium} from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
import {catalog} from '../prototype-shared/catalog.js'
const root=path.resolve(import.meta.dirname,'..'),base=JSON.parse(fs.readFileSync(path.join(root,'.runtime/stage00/preview.json'))).url,run='FIELDS_'+Date.now(),out=path.join(root,'.runtime/stage00',run)
fs.mkdirSync(out,{recursive:true})
const context=await chromium.launchPersistentContext(path.join(out,'profile'),{channel:'msedge',headless:true,viewport:{width:1366,height:768}});context.setDefaultTimeout(8000)
const harness=await context.newPage(),page=await context.newPage(),observations={},errors=[]
page.on('pageerror',e=>errors.push(e.message))
await harness.goto(base+'/?session='+run)
await harness.evaluate(async()=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');window.qa={};for(const app of ['web','resident','staff']){window.qa[app]=createBrowserAdapter(app);await window.qa[app].start()}})
const call=(app,method,...args)=>harness.evaluate(({app,method,args})=>window.qa[app][method](...args),{app,method,args})
await call('resident','command','save',{table:'missing',data:{'小区名称或地址':'虚构缺失地址','具体房屋描述':'门牌未收录的示例','联系号码':'13900000001'}})
await call('web','identity','archive','maintainer')
await call('web','command','save',{table:'statistics',data:{'统计范围':'C-A','指标名称':'人口','指标数值':0,'统计口径说明':'来源明确零值的虚构样例','统计日期':'2026-11-01','数据来源':'虚构资料','提供单位':'虚构单位'}})
const vehicle=await call('resident','command','save',{table:'vehicles',data:{'车牌号码':'苏AQA001','车辆类型':'小型汽车（样例）'}})
await call('web','command','verifyVehicle',{id:vehicle.id,decision:'确认'})
await call('web','command','status',{table:'personnel',id:'P-DUAL',date:'2026-11-04',reason:'虚构离岗核验'})
const app=await call('resident','command','apply',{data:{_house:'H-A','申请类型':'绑定','申请关系类型':'业主','联系号码':'13900000001','申请说明':'有效期字段样例',_validity:true,'申请有效起始日':'2026-01-01','申请有效结束日':'2026-12-31'}})
await call('web','identity','audit','reviewer');await call('web','command','review',{id:app.id,decision:'通过','对外审核说明':'字段核验样例','内部审核备注':'仅内部示例'})
const end=await call('resident','command','apply',{data:{_house:'H-A','申请类型':'解除','申请说明':'解除字段样例','联系号码':'13900000001'}});await call('web','command','review',{id:end.id,decision:'通过'})
const withdraw=await call('resident','command','apply',{data:{_house:'H-A2','申请类型':'绑定','申请关系类型':'租户','联系号码':'13900000001'}});await call('resident','command','withdraw',{id:withdraw.id})
await call('web','identity','file-owner','file-manager');const file=await call('web','record','files','FILE-A');await call('web','command','save',{table:'files',id:file._id,data:{...file,_reminder:true,'到期日期':'2026-11-20','提前提醒天数':10,'到期提醒接收人':['file-reader']}})
const assign={orgs:['admin','config'],accounts:['admin','config'],roles:['admin','config'],communities:['archive','maintainer'],estates:['archive','maintainer'],buildings:['archive','maintainer'],units:['archive','maintainer'],houses:['archive','maintainer'],residents:['audit','reviewer'],applications:['audit','reviewer'],relations:['audit','reviewer'],missing:['archive','maintainer'],statistics:['archive','maintainer'],vehicles:['archive','maintainer'],facilities:['archive','maintainer'],personnel:['archive','maintainer'],files:['file-owner','file-manager']}
async function collect(table,location){
 const seen=await page.locator('[data-field]').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height>0&&getComputedStyle(n).display!=='none').map(n=>n.getAttribute('data-field')))
 for(const key of seen){const [t,...name]=key.split(':');if(t!==table)continue;observations[t]??={};observations[t][name.join(':')]??=[];if(!observations[t][name.join(':')].includes(location))observations[t][name.join(':')].push(location)}
}
for(const [table,[account,role]] of Object.entries(assign)){
 try{
  await call('web','identity',account,role);await page.goto(base+'/web/?session='+run+'#/'+table);await page.reload();await page.locator('a:visible').filter({hasText:/^详情$/}).first().waitFor()
  const count=await page.locator('a:visible').filter({hasText:/^详情$/}).count()
  for(let i=0;i<count;i++){await page.locator('a:visible').filter({hasText:/^详情$/}).nth(i).click();await page.locator('.detail-grid').waitFor();await collect(table,'Web详情，角色 '+role);await collect('history','Web授权操作记录');await page.locator('.ivu-modal-wrap:visible .ivu-modal-close').last().click();await page.waitForTimeout(120)}
  const button=page.getByRole('button',{name:'新增'+catalog[table].title,exact:true});if(await button.count()){await button.click();await page.waitForTimeout(150);await collect(table,'Web新增表单');await page.locator('.ivu-modal-wrap:visible .ivu-modal-close').last().click()}
  await page.screenshot({path:path.join(out,table+'.png'),fullPage:true});console.log('AUDITED '+table)
 }catch(e){errors.push(table+': '+e.message);console.log('FAILED '+table+': '+e.message)}
}
await page.setViewportSize({width:390,height:844});await page.goto(base+'/resident/?session='+run+'#/pages/profile/edit');await page.waitForTimeout(300);await collect('profile','住户本人资料表单')
async function mark(table,field,locator,location){await locator.first().waitFor({state:'visible'});observations[table]??={};observations[table][field]=[location]}
try{
 await call('web','identity','audit','reviewer');await page.setViewportSize({width:1366,height:768});await page.goto(base+'/web/?session='+run+'#/dashboard');await page.reload();await page.getByRole('heading',{name:'基础工作台'}).waitFor();await collect('demo','Web工作台与当前查询上下文');await page.locator('.header-right button').click();await page.getByText('演示控制（非生产授权）',{exact:true}).waitFor();await collect('demo','Web演示控制、分端身份与会话复位说明');await page.locator('.ivu-modal-wrap:visible .ivu-modal-close').last().click()
 const messages=await call('resident','query','messages');await page.setViewportSize({width:390,height:844});await page.goto(base+'/resident/?session='+run+'#/pages/foundation/messages/detail?id='+messages[0]._id);await page.locator('[data-field="messages:消息标题"]').waitFor();await collect('messages','住户本人结果消息详情')
 console.log('AUDITED demo/messages/history')
}catch(e){errors.push('demo/messages/history: '+e.message)}
try{
 await call('web','identity','archive','maintainer');await page.setViewportSize({width:1366,height:768});await page.goto(base+'/web/?session='+run+'#/houses');await page.reload();await page.getByRole('button',{name:'房屋导入',exact:true}).click();const modal=page.locator('.ivu-modal-wrap:visible').last()
 const template=await harness.evaluate(async()=>{const {importTemplate}=await import('/_shared/import-houses.js');return importTemplate})
 await modal.locator('input[type=file]').setInputFiles({name:'字段核验.csv',mimeType:'text/csv',buffer:Buffer.from(template)});await modal.locator('textarea').fill('字段核验虚构来源');await modal.getByRole('button',{name:'校验预览',exact:true}).click();await modal.getByText('待确认导入',{exact:true}).waitFor()
 const anchors={'导入文件':'input[type=file]','文件名称':'.ivu-form-item','模板说明':'button','资料来源':'.ivu-form-item','来源说明':'textarea','数据行号':'.ivu-table-header','待导入房屋资料':'.ivu-table','校验结果':'.ivu-table-header','错误原因':'.ivu-table-header','总行数':'.metric','通过行数':'.metric','不通过行数':'.metric','导入处理状态':'.metric'}
 for(const [field,selector]of Object.entries(anchors))await mark('imports',field,modal.locator(selector),'Web实际CSV选择、预览与结构化结果：'+selector)
 await modal.getByRole('button',{name:'确认整批导入',exact:true}).click();await modal.getByText('成功',{exact:true}).waitFor();for(const f of ['提交人','提交时间'])await mark('imports',f,modal.locator('.source-note'),'Web确认导入后的提交记录')
 await page.screenshot({path:path.join(out,'import-fields.png'),fullPage:true});console.log('AUDITED import feedback')
}catch(e){errors.push('imports: '+e.message)}
try{
 await call('web','identity','file-owner','file-manager');await page.goto(base+'/web/?session='+run+'#/files');await page.reload();await page.locator('a:visible').filter({hasText:/^详情$/}).first().click();const detail=page.locator('.ivu-modal-wrap').filter({has:page.locator('.ivu-modal-header').filter({hasText:'文件资料详情'})})
 await mark('fileFeedback','目标版本',detail.locator('.ivu-select'),'Web历史版本显式选择');await detail.getByRole('button',{name:'预览目标版本',exact:true}).click();await detail.locator('pre.native-text').waitFor();await mark('fileFeedback','预览内容',detail.locator('pre.native-text'),'Web受控读取的本地文本字节')
 await detail.getByRole('button',{name:'上传新版本',exact:true}).click();const action=page.locator('.ivu-modal-wrap').filter({has:page.locator('.ivu-modal-header').filter({hasText:'上传新版本'})});await mark('fileFeedback','操作原因',action.locator('textarea'),'Web文件操作原因与版本变更说明');await action.locator('textarea').fill('版本字段核验，不含真实资料');await action.locator('.ivu-checkbox-wrapper').filter({hasText:'本次模拟失败'}).click();await action.locator('input[type=file]').setInputFiles({name:'虚构失败.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('虚构样例字节')});await action.locator('[data-field="fileFeedback:上传失败原因"]').waitFor()
 await mark('fileFeedback','上传进度或状态',action.locator('[data-field="fileFeedback:上传进度或状态"]'),'Web实际本地附件处理状态');await mark('fileFeedback','上传失败原因',action.locator('[data-field="fileFeedback:上传失败原因"]'),'Web模拟失败原因，表单仍保留')
 await action.locator('.ivu-checkbox-wrapper').filter({hasText:'本次模拟失败'}).click();await action.locator('input[type=file]').setInputFiles({name:'虚构无预览.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('虚构样例版本，不是实际合同')});await action.getByText(/成功：虚构无预览/).waitFor();await action.getByRole('button',{name:'确认模拟操作',exact:true}).click();await action.waitFor({state:'hidden'});await detail.getByRole('button',{name:'预览目标版本',exact:true}).click();await detail.getByText(/当前格式不支持浏览器预览/).waitFor();await mark('fileFeedback','预览结果说明',detail.getByText(/当前格式不支持浏览器预览/),'Web不支持格式时的真实反馈与受控下载边界');console.log('AUDITED file feedback')
}catch(e){errors.push('fileFeedback: '+e.message)}
const mapping=Object.values(catalog).flatMap(t=>t.fields.map(f=>({section:t.section,table:t.key,field:f.name,type:f.type,source:f.source,rule:f.rule,conditions:f.condition,implementation:t.key==='profile'?'miniapp/packages/foundation/MobileFields.vue':t.key==='imports'?'web/manager/src/components/ImportPanel.vue':['fileFeedback','demo','messages','history'].includes(t.key)?'specialized surface':'web/manager/src/components/FieldEditor.vue + web/manager/src/views/Workspace.vue',rendered:observations[t.key]?.[f.name]||[],status:observations[t.key]?.[f.name]?'PASS':'NOT_RUN'})))
fs.writeFileSync(path.join(out,'field-dom-results.json'),JSON.stringify({run,observations,errors},null,2));fs.writeFileSync(path.join(root,'docs/stages/stage-00/evidence/field-mapping.json'),JSON.stringify({run,path:path.relative(root,out).replaceAll('\\','/'),mapping,errors},null,2)+'\n')
console.log(JSON.stringify({rendered:mapping.filter(m=>m.status==='PASS').length,total:mapping.length,errors},null,2));await context.close();process.exitCode=errors.length?1:0
