import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { importTemplate } from '../prototype-shared/import-houses.js'

const root = path.resolve(import.meta.dirname, '..')
const stage01=process.argv.includes('--stage01')
const flag = process.argv.slice(2).filter(a=>a!=='--stage01')
if (flag.length > 1 || (flag.length && !/^--only=R1-(0[1-9]|10)$/.test(flag[0]))) throw Error('只支持 --only=R1-01 至 R1-10；参数错误时不启动浏览器或会话')
const only = flag[0]?.slice(7)
const base = JSON.parse(fs.readFileSync(path.join(root, stage01?'.runtime/stage01/preview.json':'.runtime/stage00/preview.json'))).url
const run = 'R1_' + new Date().toISOString().replace(/[:.]/g, '-'), session = run
const out = path.join(root, stage01?'.runtime/stage01/regression':'.runtime/stage00-r1', run), results = [], errors = [], external = []
fs.mkdirSync(out, { recursive: true })
const ctx = await chromium.launchPersistentContext(path.join(out, 'profile'), { channel: 'msedge', headless: true, viewport: { width: 1366, height: 768 } })
ctx.setDefaultTimeout(8000)
ctx.on('page', p => {
  p.on('pageerror', e => errors.push({ url: p.url(), error: e.message }))
  p.on('request', r => { if (!r.url().startsWith(base + '/') && !/^(data:|blob:)/.test(r.url())) external.push(r.url()) })
})
await ctx.route('**/*', route => /^(data:|blob:)/.test(route.request().url()) || route.request().url().startsWith(base + '/') ? route.continue() : route.abort())
const harness = await ctx.newPage()
await harness.goto(base + '/?session=' + session)
await harness.evaluate(async () => {
  const { createBrowserAdapter } = await import('/_shared/storage-h5.js'); window.qa = {}
  for (const app of ['web', 'resident', 'staff', 'merchant']) { window.qa[app] = createBrowserAdapter(app); await window.qa[app].start() }
})
const call = (app, method, ...args) => harness.evaluate(async ({ app, method, args }) => window.qa[app][method](...args), { app, method, args })
const web = await ctx.newPage(), resident = await ctx.newPage(), staff = await ctx.newPage()
const go = async (p, app, hash) => { await p.goto(base + '/' + app + '/?session=' + session + '#' + hash); await p.reload(); await p.waitForTimeout(250) }
const modal = (title) => web.locator('.ivu-modal-wrap:visible').filter({ has: web.locator('.ivu-modal-header-inner').filter({ hasText: title }) }).last()
const field = (m, table, name) => m.locator('[data-field="' + table + ':' + name + '"]')
async function option(m, table, name, label) {
  const f = field(m, table, name); await f.locator('.ivu-select-selection').click()
  await f.locator('.ivu-select-item').filter({ hasText: new RegExp('^' + label + '$') }).click()
}
async function node(key) { await web.locator('[data-space-node="' + key + '"]').click(); await web.waitForTimeout(200) }
async function chooseWeb(id) {
  if (!web.url().startsWith(base + '/web/')) await go(web, 'web', '/dashboard')
  await web.locator('button:visible').filter({ hasText: /^\s*演示身份\s*$/ }).click()
  const m = modal('演示身份与辅助工具'); await field(m, 'demo', '当前演示账号').locator('.ivu-select-selection').click()
  await field(m, 'demo', '当前演示账号').locator('.ivu-select-item').filter({ hasText: id === 'property-admin' ? '物业管理员' : '平台管理员' }).click()
  await web.waitForTimeout(350)
  if (await m.isVisible()) await m.locator('.ivu-modal-close').click()
}
async function screenshot(p, name) { await p.screenshot({ path: path.join(out, name + '.png'), fullPage: true, animations: 'disabled', timeout: 25000 }) }
async function check(id, name, fn) {
  if (only && only !== id) return
  try { await fn(); results.push({ id, name, status: 'PASS' }); console.log('PASS ' + id + ' ' + name) }
  catch (e) {
    results.push({ id, name, status: 'FAIL', error: e.stack }); console.log('FAIL ' + id + ' ' + e.message)
    try { await screenshot(web, id + '-failure'); for (let i = 0; i < 5; i++) { const close = web.locator('.ivu-modal-wrap:visible .ivu-modal-close').last(); if (!await close.count()) break; await close.click(); await web.waitForTimeout(180) } } catch {}
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ run, session, base, results, errors, external }, null, 2))
}
let newHouse, application, relation
await check('R1-01', '单一菜单、树选中与直属层级、搜索及空态', async () => {
  await go(web, 'web', '/spaces'); await web.getByRole('heading', { name: '社区房屋档案', exact: true }).waitFor()
  assert.equal(await web.locator('.sidebar-menu-con').getByText('社区房屋档案', { exact: true }).count(), 1)
  for (const title of ['社区档案', '小区档案', '楼栋档案', '单元档案', '房屋档案']) assert.equal(await web.locator('.sidebar-menu-con').getByText(title, { exact: true }).count(), 0)
  await node('estates:E-A'); assert.match(await web.locator('.space-main .ivu-table-header').innerText(), /楼栋名称/)
  await node('buildings:B-A'); assert.match(await web.locator('.space-main .ivu-table-header').innerText(), /单元名称/)
  const arrow = web.locator('[data-space-node="buildings:B-A"]').locator('xpath=ancestor::li[1]').locator(':scope > .ivu-tree-arrow'); await arrow.click()
  await node('units:U-A'); assert.match(await web.locator('.space-main .ivu-table-header').innerText(), /房间号/)
  assert.equal(await web.locator('.space-tabs').getByText('车位资源', { exact: true }).count(), 0)
  await node('buildings:B-N'); assert.match(await web.locator('.space-main .ivu-table-header').innerText(), /房间号/)
  assert.equal((await call('web', 'query', 'units')).filter(u => u['所属楼栋'] === 'B-N').length, 0)
  await web.locator('.space-tree input').fill('不存在的空间'); await web.getByText('当前没有可见空间', { exact: true }).waitFor()
  await web.locator('.space-tree input').fill(''); await screenshot(web, 'spaces-1366')
  assert.ok(await web.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
})
await check('R1-02', '无单元房间新增编辑、上级锁定、同步与分页', async () => {
  await go(web, 'web', '/spaces?node=buildings:B-N'); await web.locator('button:visible').filter({ hasText: /^\s*新增房间\s*$/ }).click()
  const m = modal('新增房间（房屋）'); await m.waitFor(); assert.match(await m.locator('.form-context').innerText(), /02幢/)
  assert.equal(await field(m, 'houses', '所属单元').isVisible(), false)
  await m.locator('button:visible').filter({ hasText: /^\s*保存\s*$/ }).click(); await m.locator('.ivu-alert-error').waitFor()
  await field(m, 'houses', '房号').locator('input').fill('0008')
  await option(m, 'houses', '房屋用途', '住宅'); await option(m, 'houses', '资料来源', '人工维护')
  await m.locator('button:visible').filter({ hasText: /^\s*保存\s*$/ }).click(); await m.waitFor({ state: 'hidden' })
  newHouse = (await call('web', 'query', 'houses')).find(h => h['房号'] === '0008'); assert(newHouse); assert.equal(newHouse['所属楼栋'], 'B-N'); assert(!newHouse['所属单元'])
  await web.locator('.space-tree input').fill('0008'); await web.locator('[data-space-node="houses:' + newHouse._id + '"]').waitFor()
  await node('houses:' + newHouse._id); await web.locator('button:visible').filter({ hasText: /^\s*编辑当前房间\s*$/ }).click()
  const edit = modal('编辑房间（房屋）'); await field(edit, 'houses', '房号').locator('input').fill('0008改')
  await edit.locator('button:visible').filter({ hasText: /^\s*保存\s*$/ }).click(); await edit.waitFor({ state: 'hidden' })
  const changed = await call('web', 'record', 'houses', newHouse._id); assert.equal(changed['房屋编号'], newHouse['房屋编号']); assert.equal(changed['房号'], '0008改')
  assert.match(await web.locator('.space-context').innerText(), /0008改/); await screenshot(web, 'room-selected')
  // Seed enough virtual records through the normal validated service to exercise paging.
  for (let i = 20; i < 30; i++) await call('web', 'command', 'save', { table: 'houses', data: { 所属社区: 'C-A', 所属小区: 'E-A', 所属楼栋: 'B-N', 房号: '00' + i, 房屋用途: '住宅', 资料来源: '人工维护' } })
  await go(web, 'web', '/spaces?node=buildings:B-N'); await web.locator('.list-pagination .ivu-page-item').filter({ hasText: /^2$/ }).click()
  assert.ok(await web.locator('.space-main .ivu-table-body .ivu-table-row').count() > 0); assert.ok(await web.locator('.space-main .ivu-table-body .ivu-table-row').count() <= 10)
  await call('web','command','status',{table:'houses',id:newHouse._id,reason:'R1停用节点回退验证'})
  await go(web,'web','/spaces?node=houses:'+newHouse._id); await web.getByText('所选位置已停用或不可访问，已返回可用的上级位置。',{exact:true}).waitFor(); assert.match(await web.locator('.space-context h2').innerText(),/02幢/)
})
await check('R1-03', '独立设施与车位在小区楼栋创建、社区只汇总', async () => {
  await go(web, 'web', '/spaces?node=buildings:B-N'); const before = (await call('web', 'query', 'houses')).length
  await web.locator('.space-tabs').getByText('车位资源', { exact: true }).click(); await web.locator('button:visible').filter({ hasText: /^\s*新增车位\s*$/ }).click()
  const m = modal('新增车位资源'); await field(m, 'parking', '车位编号').locator('input').fill('0007'); await option(m, 'parking', '车位类型', '普通车位（演示候选）')
  await field(m, 'parking', '备注').locator('textarea').fill('R1虚构基础档案'); await m.locator('button:visible').filter({ hasText: /^\s*保存\s*$/ }).click(); await m.waitFor({ state: 'hidden' })
  const p = (await call('web', 'query', 'parking')).find(p => p['车位编号'] === '0007'); assert(p); assert.equal(p._spaceId, 'B-N'); assert.equal((await call('web', 'query', 'houses')).length, before)
  await screenshot(web, 'parking-building')
  await web.locator('.space-tabs').getByText('设施点位', { exact: true }).click(); await web.locator('button:visible').filter({ hasText: /^\s*新增设施\s*$/ }).click()
  const f = modal('新增设施点位'); await field(f, 'facilities', '点位名称').locator('input').fill('R1楼栋充电桩'); await option(f, 'facilities', '点位类别', '充电桩')
  await field(f, 'facilities', '具体位置').locator('input').fill('北侧通道'); await option(f, 'facilities', '资料来源', '人工维护')
  await f.locator('button:visible').filter({ hasText: /^\s*保存\s*$/ }).click(); await f.waitFor({ state: 'hidden' })
  const facilities = await call('web', 'query', 'facilities'); assert.equal(facilities.filter(f => f['点位名称'] === 'R1楼栋充电桩').length, 1)
  await go(web, 'web', '/facilities'); await web.getByText('R1楼栋充电桩', { exact: true }).first().waitFor()
  await go(web, 'web', '/spaces?node=communities:C-A'); await web.locator('.space-tabs').getByText('车位资源', { exact: true }).click()
  assert.equal(await web.locator('button:visible').filter({ hasText: /^\s*新增车位\s*$/ }).count(), 0); await web.getByText('0007', { exact: true }).first().waitFor()
})
await check('R1-04', '实际CSV选取、错误范围不写入、修正重试与选择器更新', async () => {
  await go(web, 'web', '/spaces?node=buildings:B-A'); await web.locator('button:visible').filter({ hasText: /^\s*房间（房屋）导入\s*$/ }).click()
  const m = modal('房间（房屋）导入'); await m.locator('textarea').fill('R1虚构台账')
  const file = { name: 'R1无单元.csv', mimeType: 'text/csv', buffer: Buffer.from(importTemplate) }
  const before = (await call('web', 'query', 'houses')).length
  await m.locator('input[type=file]').setInputFiles(file); await m.locator('button:visible').filter({ hasText: /^\s*校验预览\s*$/ }).click(); await m.getByText(/范围不一致/).waitFor()
  assert(await m.locator('button:visible').filter({ hasText: /^\s*确认整批导入\s*$/ }).isDisabled()); assert.equal((await call('web', 'query', 'houses')).length, before)
  await screenshot(web, 'import-wrong-scope')
  await m.locator('input[type=file]').setInputFiles({name:'超限文件.csv',mimeType:'text/csv',buffer:Buffer.alloc(2*1024*1024+1,65)})
  await m.getByText('超过本轮2 MiB演示限制',{exact:true}).waitFor(); assert(await m.locator('button:visible').filter({hasText:/^\s*校验预览\s*$/}).isDisabled()); assert(await m.locator('button:visible').filter({hasText:/^\s*确认整批导入\s*$/}).isDisabled());assert.equal((await call('web','query','houses')).length,before)
  await m.locator('.ivu-modal-close').click()
  await go(web, 'web', '/spaces?node=buildings:B-N'); await web.locator('button:visible').filter({ hasText: /^\s*房间（房屋）导入\s*$/ }).click()
  const good = modal('房间（房屋）导入'); await good.locator('textarea').fill('R1虚构台账'); await good.locator('input[type=file]').setInputFiles(file)
  await good.locator('button:visible').filter({ hasText: /^\s*校验预览\s*$/ }).click(); await good.getByText('待确认导入', { exact: true }).waitFor()
  await good.locator('button:visible').filter({ hasText: /^\s*确认整批导入\s*$/ }).click(); await good.getByText('成功', { exact: true }).waitFor()
  assert.equal((await call('web', 'query', 'houses')).length, before + 1)
  const house = (await call('web', 'query', 'houses')).find(h => h['房号'] === '0202'); assert(house); assert(!house['所属单元'])
  await good.locator('button:visible').filter({ hasText: /^\s*校验预览\s*$/ }).click(); await good.getByText(/重复/).waitFor(); assert.equal((await call('web', 'query', 'houses')).length, before + 1)
  await screenshot(web, 'import-duplicate'); await good.locator('.ivu-modal-close').click()
  await web.locator('.space-tree input').fill('0202'); await web.locator('[data-space-node="houses:' + house._id + '"]').waitFor()
  await go(resident, 'resident', '/pages/foundation/relations/apply?kind=绑定'); await resident.waitForTimeout(300)
  const choices = await call('resident', 'query', 'houses', { 所属楼栋: 'B-N' }); assert(choices.some(h => h._id === house._id && h['房号'] === '0202'))
})
await check('R1-05', '旧会话持久化升级不清档案、申请、附件与历史', async () => {
  const legacy = await ctx.newPage(); await legacy.goto(base + '/?session=' + session + '_old')
  const receipt = await legacy.evaluate(async () => {
    const { createSeed, execute } = await import('/_shared/core.js'); const s = createSeed()
    const app = execute(s, { app: 'resident', account: 'resident-a', role: 'resident' }, 'apply', { data: { _house: 'H-A', 申请类型: '绑定', 申请关系类型: '业主' } })
    delete s.schemaVersion; delete s.migrations; delete s.parking; s.accounts = s.accounts.filter(a => !['platform-admin', 'property-admin'].includes(a._id)); s.roles = s.roles.filter(r => !['platform', 'property'].includes(r._id))
    const keys = ['houses', 'applications', 'relations', 'attachments', 'history', 'messages'], before = JSON.stringify(keys.map(k => s[k]))
    const request = indexedDB.open('dgl-community-prototype-stage00', 1); const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = reject })
    const key = new URL(location.href).searchParams.get('session'); await new Promise((resolve, reject) => { const tx = database.transaction(['sessions', 'blobs'], 'readwrite'); tx.objectStore('sessions').put(s, key); tx.objectStore('blobs').put(new Blob(['R1旧会话附件']), key + ':old-proof'); tx.oncomplete = resolve; tx.onerror = reject })
    const { createBrowserAdapter } = await import('/_shared/storage-h5.js'); const adapter = createBrowserAdapter('web'); await adapter.start()
    const read = database.transaction(['sessions', 'blobs']); const current = await new Promise(r => { const q = read.objectStore('sessions').get(key); q.onsuccess = () => r(q.result) })
    const blob = await new Promise(r => { const q = database.transaction('blobs').objectStore('blobs').get(key + ':old-proof'); q.onsuccess = () => r(q.result) })
    return { unchanged: JSON.stringify(keys.map(k => current[k])) === before, schema: current.schemaVersion, attachment: await blob.text(), app: (await adapter.record('applications', app.id))._id }
  })
  assert.equal(receipt.unchanged, true); assert.equal(receipt.schema, 2); assert.equal(receipt.attachment, 'R1旧会话附件'); assert(receipt.app); await legacy.close()
})
await check('R1-06', '房屋绑定旧详情链接、四页签与固定主操作', async () => {
  await chooseWeb('property-admin')
  application = (await call('resident', 'command', 'apply', { data: { _house: 'H-A', 申请类型: '绑定', 申请关系类型: '业主', 申请说明: 'R1跨端绑定' } })).id
  await go(web, 'web', '/applications?id=' + application); const m = modal('房屋绑定详情'); await m.waitFor()
  assert.equal(await m.locator('.ivu-tabs-tab').count(), 4); assert.match(await m.locator('.ivu-tabs-tab-active').innerText(), /绑定信息/)
  for (const tab of ['居民信息', '房屋信息', '审核记录', '绑定信息']) { await m.locator('.ivu-tabs-tab').filter({ hasText: tab }).click(); await web.waitForTimeout(350); assert.equal(await m.locator('.ivu-tabs-tab-active').innerText(),tab) }
  assert.equal(await m.locator('[data-field="applications:内部审核备注"]:visible').count(), 0)
  assert.equal(await m.locator('pre').count(), 0); await m.locator('button:visible').filter({ hasText: /^\s*审核申请\s*$/ }).waitFor(); await screenshot(web, 'binding-four-tabs')
})
async function review(id, decision = '通过', reason = 'R1已核验', internal = '仅物业可见的R1内部备注') {
  await go(web, 'web', '/applications?id=' + id); const detail = modal('房屋绑定详情'); await detail.locator('button:visible').filter({ hasText: /^\s*审核申请\s*$/ }).click()
  const m = modal('审核房屋绑定'); await m.waitFor(); if (decision === '驳回') await m.locator('.ivu-radio-wrapper').filter({ hasText: '驳回' }).click()
  await m.locator('textarea').nth(0).fill(reason); await m.locator('textarea').nth(1).fill(internal); await m.locator('button:visible').filter({ hasText: /^\s*确认\s*$/ }).click(); await m.waitFor({ state: 'hidden' })
}
await check('R1-07', '住户实际提交、物业审核、驳回重提变更解除与跨端结果', async () => {
  await resident.setViewportSize({width:390,height:844}); await staff.setViewportSize({width:390,height:844})
  if (!application) { await call('web','identity','property-admin','property'); application=(await call('resident','command','apply',{data:{_house:'H-A',申请类型:'绑定',申请关系类型:'业主',申请说明:'R1定向复验'}})).id }
  // First approval is handled by the property account through the real Web modal.
  await review(application)
  await go(resident, 'resident', '/pages/foundation/applications/detail?id=' + application); await resident.getByText('已通过', { exact: true }).waitFor()
  assert(!/仅物业可见的R1内部备注/.test(await resident.locator('body').innerText()))
  relation = (await call('resident', 'query', 'relations')).find(r => r._house === 'H-A' && r['关系状态'] === '有效'); assert(relation)
  const oldApplication = await call('resident','record','applications',application), oldHouse = await call('web','record','houses','H-A')
  await call('web','command','save',{table:'houses',id:oldHouse._id,data:{...oldHouse,房号:'0101甲'}})
  assert.equal((await call('resident','record','relations',relation._id))._house,'H-A'); assert.equal((await call('resident','record','applications',application))['房屋地址'],oldApplication['房屋地址'])
  await go(staff, 'staff', '/pages/foundation/houses/detail?id=H-A'); await staff.getByText('完整房屋地址', { exact: true }).waitFor(); assert.equal((await call('staff', 'info')).actor.role, 'property')
  assert((await call('resident', 'query', 'messages')).some(m => m['业务对象编号'] === application || JSON.stringify(m).includes(application)))
  // The resident form is exercised rather than replacing submission with a success popup.
  await go(resident, 'resident', '/pages/foundation/relations/apply?id=H-A2&kind=绑定'); await resident.locator('.form-field').filter({ hasText: '申请关系类型' }).click(); await resident.locator('.uni-picker-action-confirm:visible').click()
  await resident.locator('.form-field').filter({ hasText: '申请说明' }).locator('textarea').fill('R1住户表单实际提交')
  await resident.getByText('提交绑定申请', { exact: true }).click(); await resident.waitForURL(/applications\/detail/)
  const pending = (await call('resident', 'query', 'applications')).find(a => a._house === 'H-A2' && a['申请状态'] === '待审核'); assert(pending)
  await review(pending._id, '驳回', '请补充居住说明'); const rejected = await call('resident', 'record', 'applications', pending._id); assert.equal(rejected['申请状态'], '已驳回')
  const retry = await call('resident', 'command', 'apply', { previous: pending._id, data: { _house: 'H-A2', 申请类型: '绑定', 申请关系类型: '租户', 申请说明: '补充后的说明' } }); await review(retry.id)
  const change = await call('resident', 'command', 'apply', { data: { _house: 'H-A', _relation: relation._id, 申请类型: '变更', 申请关系类型: '家庭成员', 申请说明: 'R1关系变更' } }); await review(change.id)
  const active = (await call('resident', 'query', 'relations')).find(r => r._house === 'H-A' && r['关系状态'] === '有效'); assert(active)
  const end = await call('resident', 'command', 'apply', { data: { _house: 'H-A', _relation: active._id, 申请类型: '解除', 申请关系类型: active['关系类型'], 申请说明: 'R1解除说明' } }); await review(end.id)
  assert.equal((await call('resident', 'record', 'applications', application))['申请状态'], '已通过'); assert.equal((await call('resident', 'record', 'relations', active._id))['关系状态'], '已解除')
  assert((await call('resident', 'query', 'relations')).some(r => r._house === 'H-A2' && r['关系状态'] === '有效')); await screenshot(resident, 'resident-binding-result')
})
await check('R1-08', '分端身份、无权空间与材料消息拒绝、文件可查不可下载', async () => {
  await call('web','identity','platform-admin','platform')
  const outsideParking=await call('web','command','save',{table:'parking',space:{table:'estates',id:'E-B'},data:{车位编号:'OUT01',车位类型:'其他（演示候选）'}})
  const outsideFacility=await call('web','command','save',{table:'facilities',space:{table:'estates',id:'E-B'},data:{点位名称:'范围外虚构点位',点位类别:'消防',具体位置:'虚构北门',资料来源:'人工维护'}})
  await call('web','identity','property-admin','property')
  assert.equal((await call('web', 'info')).actor._id, 'property-admin'); assert.equal((await call('resident', 'info')).actor._id, 'resident-a')
  await go(web, 'web', '/spaces'); assert.equal(await web.locator('[data-space-node="estates:E-B"]').count(), 0)
  for (const table of ['houses', 'facilities', 'parking']) assert((await call('web', 'query', table)).every(r => r['所属小区'] !== 'E-B'))
  await assert.rejects(call('web','record','parking',outsideParking.id),/无权/); await assert.rejects(call('web','record','facilities',outsideFacility.id),/无权/)
  const proof=await harness.evaluate(()=>window.qa.resident.upload(new File(['R1虚构证明'],'R1证明.txt',{type:'text/plain'})))
  const protectedApplication=await call('resident','command','apply',{data:{_house:'H-N',申请类型:'绑定',申请关系类型:'租户',证明附件:[proof.id],证明说明:'仅当前住户可用的虚构证明'}})
  const other = (await call('resident', 'query', 'applications'))[0]; await call('resident', 'identity', 'resident-b', 'resident')
  await assert.rejects(call('resident', 'record', 'applications', other._id), /无权/); assert.equal((await call('resident', 'query', 'messages')).length, 0)
  await assert.rejects(call('resident','attachment',{table:'applications',id:protectedApplication.id,blob:proof.id,action:'view'}),/无权/)
  await call('resident', 'identity', 'resident-a', 'resident')
  await call('web', 'identity', 'file-reader', 'file-reader'); const file = await call('web', 'attachment', { table: 'files', id: 'FILE-A', action: 'view' }); assert(file)
  await assert.rejects(call('web', 'attachment', { table: 'files', id: 'FILE-A', action: 'download' }), /下载权限/)
  await call('web', 'identity', 'property-admin', 'property'); await go(web, 'web', '/spaces')
  await web.locator('button:visible').filter({ hasText: /^\s*演示身份\s*$/ }).click(); const m = modal('演示身份与辅助工具'); assert.equal(await field(m, 'demo', '当前演示账号').locator('.ivu-select-item').count(), 2); await m.locator('.ivu-modal-close').click()
})
await check('R1-09', '普通字段不渲染规则、特殊帮助、必填错误和保存重试', async () => {
  await go(web, 'web', '/spaces?node=buildings:B-N'); await web.locator('button:visible').filter({ hasText: /^\s*新增房间\s*$/ }).click(); const m = modal('新增房间（房屋）')
  assert.equal(await field(m, 'houses', '房号').locator('.field-help').count(), 0); assert.equal(await field(m, 'houses', '房屋面积').locator('.field-help').count(), 1)
  assert.equal(await field(m, 'houses', '房号').locator('input').getAttribute('placeholder'), '请输入房间号')
  await field(m, 'houses', '房号').locator('input').fill('0099'); await option(m, 'houses', '房屋用途', '住宅'); await option(m, 'houses', '资料来源', '人工维护')
  await m.locator('summary').filter({ hasText: '演示辅助' }).click(); await m.locator('.ivu-checkbox-wrapper').filter({ hasText: '下一次保存失败' }).click(); await m.locator('button:visible').filter({ hasText: /^\s*保存\s*$/ }).click()
  await m.locator('.ivu-alert-error').waitFor(); assert.equal(await field(m, 'houses', '房号').locator('input').inputValue(), '0099')
  await m.locator('.ivu-checkbox-wrapper').filter({ hasText: '下一次保存失败' }).click(); await m.locator('button:visible').filter({ hasText: /^\s*保存\s*$/ }).click(); await m.waitFor({ state: 'hidden' })
})
await check('R1-10', '四端导航及390/414/1920视口、实际网络隔离', async () => {
  for (const app of ['resident', 'merchant', 'staff']) {
    const p = await ctx.newPage(); for (const width of [390, 414]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 896 }); await go(p, app, app === 'merchant' ? '/pages/workbench/index' : app === 'staff' ? '/pages/workbench/index' : '/pages/home/index')
      await p.locator('.tabbar').waitFor(); assert.equal(await p.locator('.tabbar__item').count(), app === 'staff' ? 3 : 4)
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await screenshot(p, app + '-' + width)
    }
    await go(p, app, '/pages/profile/index'); await p.getByText('演示身份与辅助工具', { exact: true }).click(); assert.equal(await p.getByText('复位当前会话', { exact: true }).count(), 1); await screenshot(p, app + '-identity'); await p.close()
  }
  await web.setViewportSize({ width: 1920, height: 1080 }); await go(web, 'web', '/spaces?node=estates:E-A'); await screenshot(web, 'spaces-1920'); assert.ok(await web.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
})
const report = { run, session, base, selected: only || 'all', path: path.relative(root, out).replaceAll('\\', '/'), results, errors, external, completed: new Date().toISOString() }
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(root, (stage01?'docs/stages/stage-01/evidence/stage00-browser-results':'docs/stages/stage-00/evidence/r1-browser-results') + (only ? '-' + only : '') + '.json'), JSON.stringify(report, null, 2) + '\n')
await ctx.close(); process.exitCode = results.some(r => r.status !== 'PASS') ? 1 : 0
