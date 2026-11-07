import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { importTemplate, importColumns } from '../prototype-shared/import-houses.js'

const args = process.argv.slice(2)
if (args.some(a => !['--baseline','--followup'].includes(a) && !/^--only=R2-(0[1-9]|1[0-2])$/.test(a)) || args.filter(a => a.startsWith('--only=')).length > 1 || args.filter(a => a==='--baseline').length > 1 || args.filter(a => a==='--followup').length > 1) throw Error('仅支持 --baseline、--followup 和 --only=R2-01 至 R2-12；参数错误时不启动浏览器')
const only = args.find(a => a.startsWith('--only='))?.slice(7), baseline = args.includes('--baseline'), followup = args.includes('--followup')
if(followup&&(!only||baseline))throw Error('--followup 必须指定一个 --only，且不能与 --baseline 混用；参数错误时不启动浏览器')
const root = path.resolve(import.meta.dirname, '..'), base = 'http://127.0.0.1:19201', run = (followup?'R2F_':'R2_') + new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid, session = run
const out = path.join(root, followup?'.runtime/stage00-r2-followup/regression':'.runtime/stage00-r2', run), results = [], errors = [], external = []
fs.mkdirSync(out, { recursive: true })
const ctx = await chromium.launchPersistentContext(path.join(out, 'profile'), { channel: 'msedge', headless: true, viewport: { width: 1366, height: 900 } })
ctx.setDefaultTimeout(7000)
ctx.on('page', p => {
  p.on('pageerror', e => errors.push({ url: p.url(), error: e.message }))
  p.on('console', msg => { if (msg.type()==='error' && /Error in render|TypeError|ReferenceError|Cannot read properties/.test(msg.text())) errors.push({url:p.url(),error:msg.text(),kind:'console-render-error'}) })
  p.on('request', r => { if (!r.url().startsWith(base + '/') && !/^(data:|blob:)/.test(r.url())) external.push(r.url()) })
})
await ctx.route('**/*', r => r.request().url().startsWith(base + '/') || /^(data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort())
const harness = await ctx.newPage(); await harness.goto(base + '/?session=' + session)
await harness.evaluate(async () => {
  const { createBrowserAdapter } = await import('/_shared/storage-h5.js'); window.qa = {}
  for (const app of ['web', 'resident', 'staff', 'merchant']) { window.qa[app] = createBrowserAdapter(app); await window.qa[app].start() }
})
const call = (app, method, ...params) => harness.evaluate(({ app, method, params }) => window.qa[app][method](...params), { app, method, params })
const web = await ctx.newPage(), resident = await ctx.newPage(), staff = await ctx.newPage()
const button = (p, label) => p.locator('button:visible').filter({ hasText: new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') })
const modal = title => web.locator('.ivu-modal-wrap:visible').filter({ has: web.locator('.ivu-modal-header-inner').filter({ hasText: title }) }).last()
const field = (m, table, name) => m.locator('[data-field="' + table + ':' + name + '"]')
const node = key => web.locator('button[data-space-node="' + key + '"]')
async function go(p, app, route) { await p.goto(`${base}/${app}/?session=${session}#${route}`); await p.waitForTimeout(150) }
async function freshWeb(key = 'root') { await go(web, 'web', '/spaces' + (key === 'root' ? '' : '?node=' + encodeURIComponent(key))); await web.reload(); await web.locator('.space-main').waitFor() }
async function choose(m, table, name, label) { const f = field(m, table, name); await f.locator('.ivu-select-selection').click(); await f.locator('.ivu-select-item').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).click() }
async function lockedField(m, table, name, label) {
  const control=field(m,table,name).locator('input');await control.waitFor();assert(await control.isVisible(),name+'应逐字段展示');assert(await control.isDisabled(),name+'应锁定已知上级')
  await web.waitForFunction(({selector,label})=>[...document.querySelectorAll(selector)].some(n=>n.disabled&&n.value===label),{selector:'[data-field="'+table+':'+name+'"] input',label})
  assert.equal(await control.inputValue(),label,name+'应展示档案名称而非内部ID')
}
async function tab(label) { await web.locator('.space-tabs .ivu-tabs-tab').filter({ hasText: label }).click(); await web.waitForTimeout(350) }
async function shoot(name) { await web.screenshot({ path: path.join(out, name + '.png'), fullPage: true, animations: 'disabled', timeout: 20000 }) }
const report = () => ({ run, session, base, baseline, followup, path: path.relative(root, out).replaceAll('\\', '/'), results, errors, external })
async function check(id, name, fn) {
  if (only && only !== id) return
  if (baseline && id !== 'R2-01') return
  try { const priorErrors=errors.length; await fn(); assert.equal(errors.length,priorErrors,'本场景不能新增页面或Vue渲染错误'); results.push({ id, name, status: 'PASS' }); console.log('PASS ' + id + ' ' + name) }
  catch (e) { results.push({ id, name, status: 'FAIL', error: e.stack }); console.log('FAIL ' + id + ' ' + e.message); try { await shoot(id + '-failure'); if(id==='R2-01')fs.writeFileSync(path.join(out,'identity-failure-state.json'),JSON.stringify(await web.evaluate(()=>({actor:document.querySelector('.header-right')?.innerText,app:{control:document.querySelector('.main')?.__vue__?.control,account:document.querySelector('.main')?.__vue__?.info?.actor?._id},wraps:[...document.querySelectorAll('.ivu-modal-wrap')].map(n=>({display:getComputedStyle(n).display,visibility:getComputedStyle(n).visibility,title:n.querySelector('.ivu-modal-header-inner')?.innerText})),bodyOverflow:getComputedStyle(document.body).overflow,transferred:document.querySelectorAll('[data-transfer=true]').length})),null,2)) } catch {} }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report(), null, 2))
}
async function identity(id) {
  await button(web, '演示身份').click(); const m = modal('演示身份与辅助工具'); await m.waitFor()
  await field(m, 'demo', '当前演示账号').locator('.ivu-select-selection').click()
  await field(m, 'demo', '当前演示账号').locator('.ivu-select-item').filter({ hasText: id === 'property-admin' ? /^物业管理员$/ : /^平台管理员$/ }).click()
  await m.waitFor({ state: 'hidden' }); await web.waitForTimeout(400)
}
async function overlayState() { return web.evaluate(() => ({ masks: [...document.querySelectorAll('.ivu-modal-mask')].filter(n => getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden').length, wraps: [...document.querySelectorAll('.ivu-modal-wrap')].filter(n => getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden').length, bodyOverflow: getComputedStyle(document.body).overflow, transferred: document.querySelectorAll('[data-transfer=true]').length })) }
async function overlaysSettled() { await web.waitForFunction(()=>![...document.querySelectorAll('.ivu-modal-wrap,.ivu-modal-mask')].some(n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden')&&getComputedStyle(document.body).overflow!=='hidden',null,{timeout:7000}) }

await check('R2-01', '连续身份切换及关闭按钮、遮罩、Escape后页面仍可操作', async () => {
  await freshWeb('estates:E-A')
  const observed = []
  for (let round = 0; round < 3; round++) {
    for (const id of ['property-admin', 'platform-admin']) {
      await identity(id); const state = await overlayState(); observed.push({ round, id, ...state }); fs.writeFileSync(path.join(out, 'identity-observations.json'), JSON.stringify(observed, null, 2)); assert.equal(state.masks, 0); assert.equal(state.wraps, 0)
      assert.notEqual(state.bodyOverflow, 'hidden'); await web.locator('.sidebar-menu-con').getByText('社区房屋档案', { exact: true }).click(); await web.locator('.space-main').waitFor()
    }
  }
  await button(web, '演示身份').click(); await modal('演示身份与辅助工具').locator('.ivu-modal-close').click(); await overlaysSettled(); assert.equal((await overlayState()).masks, 0)
  await button(web, '演示身份').click(); await modal('演示身份与辅助工具').click({ position: { x: 4, y: 4 } }); await overlaysSettled(); assert.equal((await overlayState()).masks, 0)
  await button(web, '演示身份').click(); await web.keyboard.press('Escape'); await overlaysSettled(); assert.equal((await overlayState()).masks, 0)
  await freshWeb('estates:E-A'); await node('buildings:B-N').click(); assert.match(await web.locator('.space-context').innerText(), /02幢/)
  fs.writeFileSync(path.join(out, 'identity-observations.json'), JSON.stringify(observed, null, 2)); await shoot('identity-usable')
})

let fixture
async function fixtures() {
  if (fixture) return fixture
  await call('web','identity','platform-admin','platform')
  const saveHouse = (number) => call('web','command','save',{table:'houses',data:{所属社区:'C-A',所属小区:'E-A',所属楼栋:'B-N',房号:number,房屋用途:'住宅',资料来源:'人工维护'}})
  const duplicate=await saveHouse('0101')
  const inactiveBuilding=await call('web','command','save',{table:'buildings',data:{所属小区:'E-A','楼栋名称／楼栋号':'R2状态楼','是否设单元':'否',资料来源:'人工维护'}})
  const inactiveHouse=await call('web','command','save',{table:'houses',data:{所属社区:'C-A',所属小区:'E-A',所属楼栋:inactiveBuilding.id,房号:'0001',房屋用途:'住宅',资料来源:'人工维护'}})
  const resources={}
  for(const table of ['facilities','parking']){
    resources[table]={}
    for(const [key,parent,id]of [['estate','estates','E-A'],['building','buildings','B-N'],['outside','estates','E-B']]){
      const data=table==='parking'?{车位编号:'R2-'+key,车位类型:'其他（演示候选）'}:{点位名称:'R2-'+key,点位类别:'消防',具体位置:'虚构北侧',资料来源:'人工维护'}
      resources[table][key]=(await call('web','command','save',{table,space:{table:parent,id},data})).id
    }
  }
  for(let i=0;i<9;i++)await saveHouse('R2-00'+i)
  fixture={duplicate:duplicate.id,inactiveBuilding:inactiveBuilding.id,inactiveHouse:inactiveHouse.id,resources}
  return fixture
}
async function reveal(key) {
  if(key==='root'){await node(key).waitFor();await node(key).scrollIntoViewIfNeeded();return}
  const [table,id]=key.split(':'),row=await call('web','record',table,id),name=row[({communities:'社区名称',estates:'小区名称',buildings:'楼栋名称／楼栋号',units:'单元名称／单元号',houses:'房号'})[table]]
  if(!await node(key).isVisible()) await web.locator('.space-tree input').fill(name)
  await node(key).waitFor();await node(key).scrollIntoViewIfNeeded()
}
async function menu(key,label) {
  await reveal(key);await node(key).click()
  await web.locator('[data-space-toolbar-child][data-space-add-child="'+key+'"]').waitFor()
  const selector=label==='新增下级'?'[data-space-toolbar-child][data-space-add-child="'+key+'"]'
    :label==='新增同级'?'[data-space-toolbar-sibling][data-space-add-sibling="'+key+'"]'
    :label==='编辑节点'?'[data-space-edit="'+key+'"]'
    :['停用','启用'].includes(label)?'[data-space-status="'+key+'"]'
    :label==='查看详情'?'[data-space-current-detail]'
    :key==='root'&&['编辑名称','编辑根名称'].includes(label)?'[data-space-root-edit="root"]':null
  assert(selector,'未定义的树操作：'+label)
  if(['编辑节点','停用','启用'].includes(label))await node(key).hover()
  const action=web.locator(selector)
  if(['停用','启用'].includes(label))assert((await action.getAttribute('aria-label')).startsWith(label),'启停图标应对应当前业务状态')
  await action.click()
}
async function finishSave(title){const m=modal(title);await button(m,'保存').click();await m.waitFor({state:'hidden'});await web.waitForTimeout(200)}
async function rowActions(id){const row=web.locator('.space-main [data-row-id="'+id+'"]:visible').last();await row.waitFor();return row}
async function listIds(){return web.locator('.space-main .ivu-table-body .ivu-table-row [data-row-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-row-id')))}
async function allPageIds(){
  const ids=[];await web.locator('.space-main .list-pagination').waitFor();await web.waitForTimeout(150)
  for(let page=0;page<30;page++){
    const current=await listIds();assert.equal(current.length,new Set(current).size,'同页不能重复房屋ID');for(const id of current){assert(!ids.includes(id),'不同分页重复记录');ids.push(id)}
    const next=web.locator('.space-main .list-pagination .ivu-page-next');if(await next.getAttribute('class').then(c=>c.includes('ivu-page-disabled')))break;await next.click();await web.waitForTimeout(100)
  }
  return ids.sort()
}

await check('R2-02','树层级、展开收起、同名房间与无单元模式',async()=>{
  await fixtures();await freshWeb('estates:E-A');assert.equal(await web.locator('.sidebar-menu-con').getByText('社区房屋档案',{exact:true}).count(),1)
  await reveal('units:U-A');await node('units:U-A').click();assert.match(await web.locator('.space-context').innerText(),/1单元/)
  await freshWeb('buildings:B-N');assert.equal((await call('web','query','units')).filter(u=>u['所属楼栋']==='B-N').length,0)
  await web.locator('.space-tree input').fill('0101');assert(await node('houses:H-A').count());assert(await node('houses:'+fixture.duplicate).count());await shoot('tree-with-and-without-unit')
})
await check('R2-03','结构节点同级下级、禁用上级名称及房间右侧同级新增编辑',async()=>{
  await fixtures();await freshWeb('buildings:B-A');await menu('buildings:B-A','新增下级');let m=modal('新增单元档案');await m.waitFor()
  for(const [name,label]of [['所属社区','青禾示例社区'],['所属小区','青禾示例花园'],['所属楼栋','01幢']])await lockedField(m,'units',name,label)
  await field(m,'units','单元名称／单元号').locator('input').fill('R2第二单元');await choose(m,'units','资料来源','人工维护');await finishSave('新增单元档案')
  const u=(await call('web','query','units')).find(u=>u['单元名称／单元号']==='R2第二单元');assert(u);assert.equal(u['所属楼栋'],'B-A')
  await web.locator('.space-tree input').fill('');await menu('buildings:B-N','新增同级');m=modal('新增楼栋档案');await lockedField(m,'buildings','所属社区','青禾示例社区');await lockedField(m,'buildings','所属小区','青禾示例花园');await field(m,'buildings','楼栋名称／楼栋号').locator('input').fill('R2同级楼');await choose(m,'buildings','是否设单元','否');await choose(m,'buildings','资料来源','人工维护');await finishSave('新增楼栋档案')
  const b=(await call('web','query','buildings')).find(b=>b['楼栋名称／楼栋号']==='R2同级楼');assert(b);assert.equal(b['所属小区'],'E-A')
  await menu('buildings:'+b._id,'编辑节点');m=modal('编辑楼栋档案');await field(m,'buildings','楼栋名称／楼栋号').locator('input').fill('R2同级楼改');await finishSave('编辑楼栋档案');assert.equal((await call('web','record','buildings',b._id))['楼栋名称／楼栋号'],'R2同级楼改')
  await menu('units:'+u._id,'新增下级');m=modal('新增房间（房屋）');for(const [name,label]of [['所属社区','青禾示例社区'],['所属小区','青禾示例花园'],['所属楼栋','01幢'],['所属单元','R2第二单元']])await lockedField(m,'houses',name,label)
  await field(m,'houses','房号').locator('input').fill('0303R2');await choose(m,'houses','房屋用途','住宅');await choose(m,'houses','资料来源','人工维护');await finishSave('新增房间（房屋）')
  const h=(await call('web','query','houses')).find(h=>h['房号']==='0303R2');assert(h);assert.equal(h['所属单元'],u._id)
  await freshWeb('houses:'+h._id);assert.equal(await web.locator('[data-space-edit="houses:'+h._id+'"],[data-space-status="houses:'+h._id+'"]').count(),0,'房间不提供树行编辑或启停操作');await button(web,'新增房间').click();m=modal('新增房间（房屋）')
  for(const [name,label]of [['所属社区','青禾示例社区'],['所属小区','青禾示例花园'],['所属楼栋','01幢'],['所属单元','R2第二单元']])await lockedField(m,'houses',name,label)
  await field(m,'houses','房号').locator('input').fill('0304R2');await choose(m,'houses','房屋用途','住宅');await choose(m,'houses','资料来源','人工维护');await finishSave('新增房间（房屋）')
  await web.waitForURL(url=>new URLSearchParams(url.hash.split('?')[1]).get('node')==='units:'+u._id)
  const sibling=(await call('web','query','houses')).find(row=>row['房号']==='0304R2');assert(sibling);assert.equal(sibling['所属单元'],u._id);assert((await allPageIds()).includes(sibling._id))
  await (await rowActions(sibling._id)).getByText('编辑',{exact:true}).click();m=modal('编辑房间（房屋）');await lockedField(m,'houses','所属单元','R2第二单元');await field(m,'houses','房号').locator('input').fill('0304R2改');await finishSave('编辑房间（房屋）');assert.equal((await call('web','record','houses',sibling._id))['房号'],'0304R2改');await shoot('tree-structural-actions')
})
await check('R2-04','停用节点可选历史并从树重新启用，子孙不级联改变',async()=>{
  await fixtures();await freshWeb('buildings:'+fixture.inactiveBuilding);const oldHouse=await call('web','record','houses',fixture.inactiveHouse)
  await menu('buildings:'+fixture.inactiveBuilding,'停用');let m=modal('受控状态变更');await m.locator('textarea').fill('R2人工停用验证');await button(m,'确认').click();await m.waitFor({state:'hidden'})
  await reveal('buildings:'+fixture.inactiveBuilding);assert.match(await node('buildings:'+fixture.inactiveBuilding).innerText(),/已停用/);await node('buildings:'+fixture.inactiveBuilding).click()
  assert.match(await web.locator('.space-context').innerText(),/已停用/);assert.equal(await button(web,'新增房间').count(),0);assert(await button(web,'房间CSV导入').isDisabled())
  assert((await allPageIds()).includes(fixture.inactiveHouse));assert.equal((await call('web','record','houses',fixture.inactiveHouse))['档案状态'],oldHouse['档案状态']);await shoot('inactive-node-history')
  await menu('buildings:'+fixture.inactiveBuilding,'启用');m=modal('受控状态变更');await m.locator('textarea').fill('R2恢复验证');await button(m,'确认').click();await m.waitFor({state:'hidden'});assert.equal((await call('web','record','buildings',fixture.inactiveBuilding))['档案状态'],'启用')
})
await check('R2-05','每一层始终显示三个资源页签，单元房间可新增且无数据才显示空态',async()=>{
  await fixtures()
  for(const key of ['communities:C-A','estates:E-A','buildings:B-A','units:U-A','houses:H-A']){
    await freshWeb(key);assert.equal(await web.locator('.space-tabs .ivu-tabs-tab').count(),3)
    for(const label of ['房屋空间','设施点位','车位资源']){
      await tab(label);assert.equal(await web.locator('.space-tabs .ivu-tabs-tab-active').innerText(),label)
      if(label!=='房屋空间'&&(key.startsWith('units:')||key.startsWith('houses:'))){
        const [table,id]=key.split(':'),resource=label==='设施点位'?'facilities':'parking',expected=(await call('web','query',resource,{_space:{table,id}})).map(row=>row._id).sort();assert.deepEqual(await allPageIds(),expected)
        if(!expected.length)await web.getByText('当前筛选没有数据',{exact:true}).waitFor()
        const add=button(web,label==='设施点位'?'新增设施':'新增车位');assert.equal(await add.count(),1);assert.equal(await add.isDisabled(),false)
      }
    }
  }
})
await check('R2-06','社区至房间均为全部末级房屋，分页无遗漏无重复且切范围清筛选',async()=>{
  await fixtures();await call('web','identity','platform-admin','platform')
  for(const [table,id]of [['communities','C-A'],['estates','E-A'],['buildings','B-A'],['buildings','B-N'],['units','U-A'],['houses','H-A']]){
    await freshWeb(table+':'+id);const expected=(await call('web','query','houses',{_space:{table,id}})).map(h=>h._id).sort();assert.deepEqual(await allPageIds(),expected);assert.match(await web.locator('.space-main .ivu-table-header').innerText(),/房间号/);assert.doesNotMatch(await web.locator('.space-main .ivu-table-header').innerText(),/是否设单元/)
  }
  await freshWeb('communities:C-A');const filter=web.locator('.space-main .filter-grid label').filter({hasText:'房间号'}).locator('input');await filter.fill('不存在');await button(web,'查询').click();await web.getByText('当前筛选没有数据',{exact:true}).waitFor();await node('buildings:B-N').click();await web.waitForTimeout(200);assert.deepEqual(await allPageIds(),(await call('web','query','houses',{_space:{table:'buildings',id:'B-N'}})).map(h=>h._id).sort());await shoot('all-leaf-rooms')
})
await check('R2-07','设施车位随当前节点汇总，小区包含楼栋且未授权范围拒绝',async()=>{
  await fixtures()
  for(const [table,label]of [['facilities','设施点位'],['parking','车位资源']])for(const [parent,id]of [['communities','C-A'],['estates','E-A'],['buildings','B-N'],['units','U-A'],['houses','H-A']]){
    await freshWeb(parent+':'+id);await tab(label);assert.deepEqual(await allPageIds(),(await call('web','query',table,{_space:{table:parent,id}})).map(r=>r._id).sort())
  }
  await call('web','identity','property-admin','property');for(const table of ['houses','facilities','parking'])await assert.rejects(call('web','query',table,{_space:{table:'estates',id:'E-B'}}),/无权/)
  await freshWeb('estates:E-A');assert.equal(await node('estates:E-B').count(),0);await call('web','identity','platform-admin','platform')
})
await check('R2-08','完整所属路径区分同名房间，无单元不显示假单元',async()=>{
  await fixtures();await freshWeb('communities:C-A');const filter=web.locator('.space-main .filter-grid label').filter({hasText:'房间号'}).locator('input');await filter.fill('0101');await button(web,'查询').click();await web.waitForTimeout(200)
  const body=await web.locator('.space-main .ivu-table-body').innerText();assert.match(body,/青禾示例社区/);assert.match(body,/青禾示例花园/);assert.match(body,/01幢/);assert.match(body,/02幢/);assert.match(body,/1单元/)
  const row=web.locator('.space-main .ivu-table-body .ivu-table-row').filter({has:web.locator('[data-row-id="'+fixture.duplicate+'"]')});assert.doesNotMatch(await row.innerText(),/默认单元|1单元/);await shoot('same-number-full-path')
  const readability=[]
  for(const width of [1366,1920]){
    await web.setViewportSize({width,height:width===1366?900:1080});await web.waitForTimeout(450)
    const tableBody=web.locator('.space-main .ivu-table-body');await tableBody.evaluate(n=>{n.scrollLeft=n.scrollWidth});await web.waitForTimeout(250)
    const observed=await web.locator('.space-main .ivu-table').evaluate((table,width)=>{
      const header=table.querySelector('.ivu-table-header'),body=table.querySelector('.ivu-table-body'),heads=[...header.querySelectorAll('th')],firstRow=body.querySelector('tr'),columns={}
      function inspect(cell){
        const rect=cell.getBoundingClientRect(),label=cell.querySelector('.ivu-table-cell')||cell,range=document.createRange();range.selectNodeContents(label);const textRect=range.getBoundingClientRect()
        const y=rect.top+rect.height/2,points=[rect.left+8,rect.left+rect.width/2,rect.right-8].map(x=>{const hit=document.elementFromPoint(x,y);return{x,y,uncovered:!!hit&&(hit===cell||cell.contains(hit)),hit:hit?.className||null}})
        return{text:label.innerText.trim(),width:rect.width,left:rect.left,right:rect.right,textLeft:textRect.left,textRight:textRect.right,textFits:label.scrollWidth<=label.clientWidth+1,points}
      }
      for(const title of ['建筑面积（㎡）','档案状态']){const index=heads.findIndex(h=>h.innerText.trim()===title);if(index>=0&&firstRow?.children[index])columns[title]={header:inspect(heads[index]),data:inspect(firstRow.children[index])}}
      return{width,body:{scrollLeft:body.scrollLeft,maxScroll:body.scrollWidth-body.clientWidth},headerScroll:header.scrollLeft,columns}
    },width)
    readability.push(observed);fs.writeFileSync(path.join(out,'house-table-readability.json'),JSON.stringify(readability,null,2))
    assert(Math.abs(observed.headerScroll-observed.body.scrollLeft)<=1,'横向滚动后表头与数据必须对齐')
    for(const [title,column]of Object.entries(observed.columns))for(const [kind,cell]of Object.entries(column)){
      assert(cell.text.length>0,`${width}px ${title}${kind}必须保留可读内容`);if(title==='建筑面积（㎡）')assert(cell.width>=88,`${width}px 建筑面积${kind}实际宽度不能小于88px`)
      assert(cell.textFits,`${width}px ${title}${kind}文字不能在单元格内被裁切`);assert(cell.points.every(p=>p.uncovered),`${width}px ${title}${kind}不能被固定操作列或其他层遮盖`)
      assert(cell.textLeft>=cell.left-1&&cell.textRight<=cell.right+1,`${width}px ${title}${kind}文字应完整位于单元格内`)
    }
    assert.equal(Object.keys(observed.columns).length,2,'面积与档案状态字段必须都保留');await shoot('house-columns-'+width)
  }
  assert(readability.some(r=>r.body.maxScroll>1&&r.body.scrollLeft>0),'窄视口必须实际验证横向滚动后的表头和数据可读性')
  await web.setViewportSize({width:1366,height:900})
})
await check('R2-09','右侧逐级选择资源归属，单元与房间上下文新增后回真实父级',async()=>{
  await fixtures();await freshWeb('communities:C-A');assert.equal(await web.locator('.space-main').getByRole('button',{name:/新增社区|新增小区|新增楼栋|新增单元/}).count(),0)
  await button(web,'新增房间').click();let m=modal('新增房间（房屋）');await lockedField(m,'houses','所属社区','青禾示例社区');await choose(m,'houses','所属小区','青禾示例花园');await choose(m,'houses','所属楼栋','02幢');assert.equal(await field(m,'houses','所属单元').isVisible(),false);await field(m,'houses','房号').locator('input').fill('0909R2');await choose(m,'houses','房屋用途','住宅');await choose(m,'houses','资料来源','人工维护');await finishSave('新增房间（房屋）')
  const created=(await call('web','query','houses')).find(h=>h['房号']==='0909R2');assert(created);assert(!created['所属单元'])
  await freshWeb('communities:C-A');await tab('车位资源');const before=(await call('web','query','houses')).length;await button(web,'新增车位').click();m=modal('新增车位资源');await lockedField(m,'parking','所属社区','青禾示例社区');await choose(m,'parking','所属小区','青禾示例花园');await choose(m,'parking','关联楼栋','02幢');assert.equal(await field(m,'parking','所属单元').isVisible(),false);await field(m,'parking','车位编号').locator('input').fill('0099R2');await choose(m,'parking','车位类型','其他（演示候选）');await finishSave('新增车位资源')
  const p=(await call('web','query','parking')).find(p=>p['车位编号']==='0099R2');assert.equal(p._spaceTable,'buildings');assert.equal(p._spaceId,'B-N');assert.equal(p['所属小区'],'E-A');assert.equal(p['关联楼栋'],'B-N');assert(!p['所属单元']);assert.equal((await call('web','query','houses')).length,before)
  await freshWeb('buildings:B-N');await tab('车位资源');assert((await allPageIds()).includes(p._id))
  await freshWeb('units:U-A');await tab('设施点位');await button(web,'新增设施').click();m=modal('新增设施点位')
  for(const [name,label]of [['所属社区','青禾示例社区'],['所属小区','青禾示例花园'],['关联楼栋','01幢'],['所属单元','1单元']])await lockedField(m,'facilities',name,label)
  await field(m,'facilities','点位名称').locator('input').fill('R2单元充电');await choose(m,'facilities','点位类别','充电桩');await field(m,'facilities','具体位置').locator('input').fill('虚构单元入口');await choose(m,'facilities','资料来源','人工维护');await finishSave('新增设施点位')
  const facility=(await call('web','query','facilities')).find(row=>row['点位名称']==='R2单元充电');assert(facility);assert.equal(facility._spaceTable,'units');assert.equal(facility._spaceId,'U-A');assert.equal(facility['关联楼栋'],'B-A');assert.equal(facility['所属单元'],'U-A');assert((await allPageIds()).includes(facility._id));assert.equal((await call('web','query','houses')).length,before)
  await freshWeb('houses:H-A');await tab('车位资源');await button(web,'新增车位').click();m=modal('新增车位资源')
  for(const [name,label]of [['所属社区','青禾示例社区'],['所属小区','青禾示例花园'],['关联楼栋','01幢'],['所属单元','1单元']])await lockedField(m,'parking',name,label)
  await field(m,'parking','车位编号').locator('input').fill('0098R2');await choose(m,'parking','车位类型','其他（演示候选）');await finishSave('新增车位资源');await web.waitForURL(url=>new URLSearchParams(url.hash.split('?')[1]).get('node')==='units:U-A')
  const unitParking=(await call('web','query','parking')).find(row=>row['车位编号']==='0098R2');assert(unitParking);assert.equal(unitParking._spaceTable,'units');assert.equal(unitParking._spaceId,'U-A');assert.equal(unitParking['所属单元'],'U-A');assert((await allPageIds()).includes(unitParking._id));assert.equal((await call('web','query','houses')).length,before)
  await freshWeb('houses:H-A');assert.equal(await web.locator('[data-space-edit="houses:H-A"],[data-space-status="houses:H-A"]').count(),0);assert(await button(web,'房间CSV导入').isDisabled());await button(web,'新增房间').click();m=modal('新增房间（房屋）')
  for(const [name,label]of [['所属社区','青禾示例社区'],['所属小区','青禾示例花园'],['所属楼栋','01幢'],['所属单元','1单元']])await lockedField(m,'houses',name,label)
  await field(m,'houses','房号').locator('input').fill('0102-R2同级');await choose(m,'houses','房屋用途','住宅');await choose(m,'houses','资料来源','人工维护');await finishSave('新增房间（房屋）');await web.waitForURL(url=>new URLSearchParams(url.hash.split('?')[1]).get('node')==='units:U-A')
  const sibling=(await call('web','query','houses')).find(row=>row['房号']==='0102-R2同级');assert(sibling);assert.equal(sibling['所属单元'],'U-A');assert((await allPageIds()).includes(sibling._id));assert.equal((await call('web','query','houses')).length,before+1);await shoot('resource-parent-selection')
})
await check('R2-10','列表操作栏办理、空间详情只读，关闭详情保留范围筛选',async()=>{
  await fixtures();await freshWeb('buildings:B-N');const filter=web.locator('.space-main .filter-grid label').filter({hasText:'房间号'}).locator('input');await filter.fill('0101');await button(web,'查询').click();await web.waitForTimeout(150)
  let action=await rowActions(fixture.duplicate);await action.getByText('详情',{exact:true}).click();let m=modal('房间（房屋）详情');await m.waitFor();assert.equal(await m.locator('input,textarea,select').count(),0);assert.equal(await m.locator('button').filter({hasText:/编辑|保存|启用|停用|审核|删除/}).count(),0);await m.locator('.ivu-modal-close').click();assert.equal(await filter.inputValue(),'0101');assert.match(await web.locator('.space-context').innerText(),/02幢/)
  action=await rowActions(fixture.duplicate);await action.getByText('编辑',{exact:true}).click();m=modal('编辑房间（房屋）');await field(m,'houses','房号').locator('input').fill('0101-R2');await finishSave('编辑房间（房屋）');assert.match(await web.locator('.space-context').innerText(),/02幢/)
  await freshWeb('buildings:B-N');await tab('车位资源');action=await rowActions(fixture.resources.parking.building);await action.getByText('停用',{exact:true}).click();m=modal('受控状态变更');await m.locator('textarea').fill('R2资源行启停');await button(m,'确认').click();await m.waitFor({state:'hidden'});assert.equal((await call('web','record','parking',fixture.resources.parking.building))['档案状态'],'停用');await shoot('resource-row-actions')
})
await check('R2-11','CSV两种楼栋、错误范围、超限清旧文件、失败重选与树表同步',async()=>{
  await fixtures();const before=(await call('web','query','houses')).length,file={name:'R2无单元.csv',mimeType:'text/csv',buffer:Buffer.from(importTemplate)}
  await freshWeb('buildings:B-A');await button(web,'房间CSV导入').click();let m=modal('房间（房屋）导入');await m.locator('textarea').fill('R2虚构台账');await m.locator('input[type=file]').setInputFiles(file);await button(m,'校验预览').click();await m.getByText(/范围不一致/).waitFor();assert(await button(m,'确认整批导入').isDisabled());assert.equal((await call('web','query','houses')).length,before)
  await m.locator('input[type=file]').setInputFiles({name:'R2超限.csv',mimeType:'text/csv',buffer:Buffer.alloc(2*1024*1024+1,65)});await m.getByText('超过本轮2 MiB演示限制',{exact:true}).waitFor();assert(await button(m,'校验预览').isDisabled());assert(await button(m,'确认整批导入').isDisabled());await shoot('csv-too-large-clears-preview');await m.locator('.ivu-modal-close').click()
  await freshWeb('buildings:B-N');await button(web,'房间CSV导入').click();m=modal('房间（房屋）导入');await m.locator('textarea').fill('R2虚构台账');await m.locator('input[type=file]').setInputFiles(file);await button(m,'校验预览').click();await m.getByText('待确认导入',{exact:true}).waitFor();await button(m,'确认整批导入').click();await m.getByText('成功',{exact:true}).waitFor();assert.equal((await call('web','query','houses')).length,before+1)
  await button(m,'校验预览').click();await m.getByText(/重复/).waitFor();assert(await button(m,'确认整批导入').isDisabled());await m.locator('.ivu-modal-close').click();await web.locator('.space-tree input').fill('0202');const h=(await call('web','query','houses')).find(h=>h['房号']==='0202');await node('houses:'+h._id).waitFor()
  await freshWeb('communities:C-A');await button(web,'房间CSV导入').click();m=modal('房间（房屋）导入');await m.locator('textarea').fill('R2有单元台账');const text='\uFEFF'+importColumns.join(',')+'\r\n0000808,青禾示例社区,青禾示例花园,01幢,1单元,8,0808,住宅,,台账导入,R2虚构\r\n';await m.locator('input[type=file]').setInputFiles({name:'R2有单元.csv',mimeType:'text/csv',buffer:Buffer.from(text)});await button(m,'校验预览').click();await m.getByText('待确认导入',{exact:true}).waitFor();await button(m,'确认整批导入').click();await m.getByText('成功',{exact:true}).waitFor()
  for(const [name,bad,reason]of [['缺上级',text.replace('01幢','不存在').replace('0000808','0000809').replace(',0808,',',0809,'),/楼栋|上级/],['非法数值',text.replace('0000808','0000810').replace(',0808,',',0810,').replace('住宅,,','住宅,坏数值,'),/面积|数值/]]){await m.locator('input[type=file]').setInputFiles({name:name+'.csv',mimeType:'text/csv',buffer:Buffer.from(bad)});await button(m,'校验预览').click();await m.getByText(reason).last().waitFor();assert(await button(m,'确认整批导入').isDisabled())}
  assert.equal((await call('web','query','houses')).length,before+2);await m.locator('.ivu-modal-close').click();await freshWeb('communities:C-A');assert((await allPageIds()).includes(h._id));await shoot('csv-success-tree-list')
})
await check('R2-12','物业审核、住户和管理端共享结果、敏感与附件权限保持',async()=>{
  await fixtures();await call('web','identity','property-admin','property');await resident.setViewportSize({width:390,height:844});await staff.setViewportSize({width:390,height:844})
  await go(resident,'resident','/pages/foundation/relations/apply?id=H-N&kind=绑定');await resident.locator('[data-field="applications:申请关系类型"]').click();await resident.locator('.uni-picker-action-confirm:visible').click();await resident.locator('[data-field="applications:申请说明"] textarea').fill('R2跨端实际提交');await resident.getByText('提交绑定申请',{exact:true}).click();await resident.waitForURL(/applications\/detail/)
  const a=(await call('resident','query','applications')).find(a=>a._house==='H-N'&&a['申请状态']==='待审核');assert(a)
  await go(web,'web','/applications?id='+a._id);await web.reload();const detail=modal('房屋绑定详情');await button(detail,'审核申请').click();const m=modal('审核房屋绑定');await m.locator('textarea').nth(0).fill('R2已核验');await m.locator('textarea').nth(1).fill('R2内部核验备注');await button(m,'确认').click();await m.waitFor({state:'hidden'});await resident.reload();await resident.getByText('已通过',{exact:true}).waitFor();assert(!(await resident.locator('body').innerText()).includes('R2内部核验备注'))
  await go(staff,'staff','/pages/foundation/houses/detail?id=H-N');await staff.getByText('完整房屋地址',{exact:true}).waitFor();assert.equal(await staff.getByText('审核申请',{exact:true}).count(),0);assert((await call('resident','query','messages')).length>0)
  await call('resident','identity','resident-b','resident');await assert.rejects(call('resident','record','applications',a._id),/无权/);assert.equal((await call('resident','query','messages')).length,0);await call('resident','identity','resident-a','resident')
  await call('web','identity','file-reader','file-reader');await call('web','attachment',{table:'files',id:'FILE-A',action:'view'});await assert.rejects(call('web','attachment',{table:'files',id:'FILE-A',action:'download'}),/下载权限/);await call('web','identity','platform-admin','platform');assert.deepEqual(errors,[]);assert.deepEqual(external,[])
})
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report(), null, 2))
if (!baseline) { fs.mkdirSync(path.join(root, 'docs/stages/stage-00/evidence'), { recursive: true }); fs.writeFileSync(path.join(root, 'docs/stages/stage-00/evidence/' + (followup?'r2-followup-regression-'+only:'r2-browser-results' + (only ? '-' + only : '')) + '.json'), JSON.stringify(report(), null, 2) + '\n') }
await ctx.close(); process.exitCode = results.some(r => r.status !== 'PASS') || errors.length || external.length ? 1 : 0
