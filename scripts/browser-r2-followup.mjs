import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
if (args.some(a => !/^--only=R2-F0[1-7]$/.test(a)) || args.length > 1) throw Error('仅支持 --only=R2-F01 至 R2-F07；无效参数不启动浏览器')
const only = args[0]?.slice(7), root = path.resolve(import.meta.dirname, '..'), base = 'http://127.0.0.1:19201'
const run = 'R2_FOLLOWUP_' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid, session = run
const out = path.join(root, '.runtime/stage00-r2', run), results = [], errors = [], consoleErrors = [], external = [], observations = []
fs.mkdirSync(out, { recursive: true })
const ctx = await chromium.launchPersistentContext(path.join(out, 'profile'), { channel: 'msedge', headless: true, viewport: { width: 1366, height: 900 } })
ctx.setDefaultTimeout(9000)
ctx.on('page', p => {
  p.on('pageerror', e => errors.push({ url: p.url(), error: e.message }))
  p.on('console', m => { if (m.type() === 'error') consoleErrors.push({ url: p.url(), error: m.text() }) })
  p.on('request', r => { if (!r.url().startsWith(base + '/') && !/^(data:|blob:)/.test(r.url())) external.push(r.url()) })
})
await ctx.route('**/*', r => r.request().url().startsWith(base + '/') || /^(data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort())
const harness = await ctx.newPage(); await harness.goto(base + '/?session=' + session)
await harness.evaluate(async () => {
  const { createBrowserAdapter } = await import('/_shared/storage-h5.js'); window.qa = {}
  for (const app of ['web', 'resident', 'staff']) { window.qa[app] = createBrowserAdapter(app); await window.qa[app].start() }
})
const call = (app, method, ...params) => harness.evaluate(({ app, method, params }) => {
  const parts = method.split('.'), owner = parts.length > 1 ? window.qa[app][parts[0]] : window.qa[app]
  return owner[parts.at(-1)](...params)
}, { app, method, params })
const web = await ctx.newPage(), esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const button = (p, label) => p.locator('button:visible').filter({ hasText: new RegExp('^\\s*' + esc(label) + '\\s*$') })
const modal = title => web.locator('.ivu-modal-wrap:visible').filter({ has: web.locator('.ivu-modal-header-inner').filter({ hasText: title }) }).last()
const field = (m, table, name) => m.locator('[data-field="' + table + ':' + name + '"]')
const node = key => web.locator('button[data-space-node="' + key + '"]')
const titles = { communities: '社区档案', estates: '小区档案', buildings: '楼栋档案', units: '单元档案', houses: '房间（房屋）', facilities: '设施点位', parking: '车位资源' }
async function fresh(key = 'root', category = '房屋空间') {
  await call('web', 'identity', 'platform-admin', 'platform')
  await web.goto(base + '/web/?session=' + session + '#/spaces' + (key === 'root' ? '' : '?node=' + encodeURIComponent(key)))
  await web.reload(); await web.locator('.space-main').waitFor()
  if (category !== '房屋空间') await tab(category)
}
async function tab(label) { await web.locator('.space-tabs .ivu-tabs-tab').filter({ hasText: label }).click(); await web.waitForTimeout(380); assert.match(await web.locator('.space-tabs .ivu-tabs-tab-active').innerText(), new RegExp(label)) }
async function choose(m, t, n, text) {
  const f = field(m, t, n); await f.locator('.ivu-select-selection').click()
  await f.locator('.ivu-select-item').filter({ hasText: new RegExp('^' + esc(text) + '$') }).click()
  await web.waitForTimeout(90)
}
async function locked(m, t, n, text) {
  const f = field(m, t, n), input = f.locator('input'); await f.waitFor()
  assert(await f.isVisible(), n + '逐字段可见'); assert(await input.isDisabled(), n + '锁定')
  await web.waitForFunction(({ s, text }) => [...document.querySelectorAll(s)].some(x => x.disabled && x.value === text), { s: '[data-field="' + t + ':' + n + '"] input', text })
  assert.equal(await input.inputValue(), text, n + '展示真实档案名称')
}
async function editable(m, t, n) { const f = field(m, t, n); await f.waitFor(); assert(await f.isVisible(), n + '可见'); assert.equal(await f.locator('input:disabled').count(), 0, n + '可选') }
async function fill(m, t, n, v) { await field(m, t, n).locator('input:not([type=file]),textarea').first().fill(v) }
async function save(t, title = '新增' + titles[t]) {
  const m = modal(title); await button(m, '保存').click(); await m.waitFor({ state: 'hidden' }); await web.waitForTimeout(170)
}
async function screenshot(name) { await web.screenshot({ path: path.join(out, name + '.png'), fullPage: true, animations: 'disabled', timeout: 25000 }) }
function report() { return { run, session, base, runtime: path.relative(root, out).replaceAll('\\', '/'), only: only || null, results, observations, errors, consoleErrors, external, note: '独立QA会话；自动浏览器验证不代替负责人或微信人工验收' } }
async function check(id, name, fn) {
  if (only && only !== id) return
  const before = errors.length, renderBefore = consoleErrors.filter(e => /Error in render|TypeError|ReferenceError|Cannot read properties/.test(e.error)).length
  try {
    await fn(); assert.equal(errors.length, before, '无新增页面异常'); assert.equal(consoleErrors.filter(e => /Error in render|TypeError|ReferenceError|Cannot read properties/.test(e.error)).length, renderBefore, '无新增Vue渲染异常')
    results.push({ id, name, status: 'PASS' }); console.log('PASS ' + id + ' ' + name)
  } catch (e) { results.push({ id, name, status: 'FAIL', error: e.stack }); console.log('FAIL ' + id + ' ' + e.message); try { await screenshot(id + '-failure') } catch {} }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report(), null, 2))
}
async function reveal(key) {
  if (!await node(key).isVisible()) {
    const [t, id] = key.split(':'), r = await call('web', 'record', t, id), name = r[({ communities: '社区名称', estates: '小区名称', buildings: '楼栋名称／楼栋号', units: '单元名称／单元号', houses: '房号' })[t]]
    await web.locator('.space-tree input').fill(name)
  }
  await node(key).waitFor(); await node(key).scrollIntoViewIfNeeded()
}
async function selectTreeNode(key) {
  await reveal(key);await node(key).click()
  await web.locator('[data-space-toolbar-child][data-space-add-child="'+key+'"]').waitFor()
}
async function treeMenu(key, text) {
  await selectTreeNode(key)
  const selector=text==='新增下级'?'[data-space-toolbar-child][data-space-add-child="'+key+'"]'
    :text==='新增同级'?'[data-space-toolbar-sibling][data-space-add-sibling="'+key+'"]'
    :text==='编辑节点'?'[data-space-edit="'+key+'"]'
    :['停用','启用'].includes(text)?'[data-space-status="'+key+'"]'
    :text==='查看详情'?'[data-space-current-detail]'
    :key==='root'&&['编辑名称','编辑根名称'].includes(text)?'[data-space-root-edit="root"]':null
  assert(selector,'未定义的树操作：'+text)
  if(['编辑节点','停用','启用'].includes(text))await node(key).hover()
  const action=web.locator(selector)
  if(['停用','启用'].includes(text))assert((await action.getAttribute('aria-label')).startsWith(text),'启停图标应对应当前业务状态')
  await action.click()
}
async function directChild(key) { await treeMenu(key,'新增下级') }
async function rowActions(id) { const row = web.locator('.space-main [data-row-id="' + id + '"]:visible').last(); await row.waitFor(); await row.scrollIntoViewIfNeeded(); return row }
async function ids() {
  const found = []; await web.locator('.space-main .list-pagination').waitFor()
  for (let n = 0; n < 40; n++) {
    found.push(...await web.locator('.space-main .ivu-table-body [data-row-id]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-row-id'))))
    const next = web.locator('.space-main .ivu-page-next'); if ((await next.getAttribute('class')).includes('ivu-page-disabled')) break
    await next.click(); await web.waitForTimeout(100)
  }
  assert.equal(found.length, new Set(found).size, '分页无重复'); return found
}
const names = { C: '青禾示例社区', E: '青禾示例花园', B: '01幢', N: '02幢', U: '1单元' }
let fixture
async function fixtures() {
  if (fixture) return fixture
  await call('web', 'identity', 'platform-admin', 'platform')
  const u = await call('web', 'command', 'save', { table: 'units', data: { 所属楼栋: 'B-A', '单元名称／单元号': 'R2F第二单元', 资料来源: '人工维护' } })
  const uploaded = await harness.evaluate(() => window.qa.resident.upload(new File(['R2 followup virtual proof'], 'R2F虚构证明.txt', { type: 'text/plain' })))
  const app = await call('resident', 'command', 'apply', { data: { _house: 'H-N', 申请类型: '绑定', 申请关系类型: '业主', 申请说明: 'R2F权限验证', 证明附件: [uploaded.id] } })
  fixture = { u: u.id, proof: uploaded.id, app: app.id, relations: await call('web', 'query', 'relations') }
  return fixture
}
async function basicForm(t, suffix) {
  const m = modal('新增' + titles[t]); await m.waitFor()
  if (t === 'communities') { await fill(m, t, '社区名称', 'R2F社区' + suffix); await fill(m, t, '社区地址', '虚构社区地址' + suffix) }
  if (t === 'estates') { await fill(m, t, '小区名称', 'R2F小区' + suffix); await fill(m, t, '小区地址', '虚构小区地址' + suffix) }
  if (t === 'buildings') { await fill(m, t, '楼栋名称／楼栋号', 'R2F楼' + suffix); await choose(m, t, '是否设单元', '否') }
  if (t === 'units') await fill(m, t, '单元名称／单元号', 'R2F单元' + suffix)
  if (t === 'houses') { await fill(m, t, '房号', 'R2F' + suffix); await choose(m, t, '房屋用途', '住宅') }
  if (t === 'facilities') { await fill(m, t, '点位名称', 'R2F设施' + suffix); await choose(m, t, '点位类别', '充电桩'); await fill(m, t, '具体位置', '虚构空间' + suffix) }
  if (t === 'parking') { await fill(m, t, '车位编号', 'R2F-' + suffix); await choose(m, t, '车位类型', '其他（演示候选）') }
  else await choose(m, t, '资料来源', '人工维护')
  return m
}
async function findNamed(t, suffix) { const f = ({ communities: '社区名称', estates: '小区名称', buildings: '楼栋名称／楼栋号', units: '单元名称／单元号', houses: '房号', facilities: '点位名称', parking: '车位编号' })[t]; const r = (await call('web', 'query', t)).find(r => String(r[f]).endsWith(suffix)); assert(r, t + '保存后可查询' + suffix); return r }

await check('R2-F01', '平台完整菜单、跨范围新档案与附件；受限身份服务拒绝', async () => {
  await fixtures(); await fresh()
  const menuNames = ['社区房屋档案', '基础概况来源', '居民档案', '房屋绑定', '正式人房关系', '房屋缺失反馈', '车辆档案', '设施点位', '物业人员', '文件资料', '组织资料', '账号与授权', '角色权限', '结果消息', '物业费账单', '缴费记录与异常', '停车业务', '停车核查', '待核实事件', '工单办理', '工单概况', '报修反馈', '隐患台账']
  for (const label of menuNames) assert.equal(await web.locator('.sidebar-menu-con').getByText(label, { exact: true }).count(), 1, '平台菜单:' + label)
  const info = await call('web', 'info'); for (const t of ['orgs', 'accounts', 'roles', 'communities', 'estates', 'buildings', 'units', 'houses', 'statistics', 'residents', 'applications', 'relations', 'missing', 'vehicles', 'facilities', 'parking', 'personnel', 'files', 'messages']) { assert(info.actor.permissions.includes('read:' + t), t + '权限'); await call('web', 'query', t) }
  for (const [route, t] of [['property/bills', 'bills'], ['property/payments', 'payments'], ['parking/business', 'parkingRelations'], ['parking/checks', 'checks'], ['workorders/events', 'events'], ['workorders/tasks', 'workorders'], ['workorders/overview', null], ['workorders/repairs', 'reports'], ['workorders/hazards', 'workorders']]) {
    await web.locator('.sidebar-menu-con').getByText(menuNames[['property/bills','property/payments','parking/business','parking/checks','workorders/events','workorders/tasks','workorders/overview','workorders/repairs','workorders/hazards'].indexOf(route) + 14], { exact: true }).click()
    await web.waitForURL(url => url.hash === '#/' + route); await web.waitForTimeout(180); assert(!(await web.locator('main').innerText()).includes('无权访问'))
    if (t) await call('web', 'stage01.query', t); else await call('web', 'stage01.overview')
  }
  const contents = await harness.evaluate(async ({ app, proof }) => { const a = await window.qa.web.attachment({ table: 'applications', id: app, blob: proof, action: 'view' }); const b = await window.qa.web.attachment({ table: 'files', id: 'FILE-A', action: 'download' }); return [await a.blob.text(), await b.blob.text()] }, fixture)
  assert.match(contents[0], /virtual proof/); assert.match(contents[1], /虚构物业文件/)
  await web.goto(base+'/web/?session='+session+'#/files?id=FILE-A');await web.reload();const fileModal=modal('文件资料详情');await fileModal.waitFor()
  await button(fileModal,'预览目标版本').click();await fileModal.locator('[data-field="fileFeedback:预览内容"]').filter({hasText:/虚构物业文件/}).waitFor()
  const downloaded=web.waitForEvent('download');await button(fileModal,'下载目标版本').click();const download=await downloaded;assert.equal(download.suggestedFilename(),'虚构说明-v1.txt');await download.saveAs(path.join(out,'virtual-file-download.txt'));assert.match(fs.readFileSync(path.join(out,'virtual-file-download.txt'),'utf8'),/虚构物业文件/)
  await call('web', 'identity', 'staff', 'query'); await assert.rejects(call('web', 'attachment', { table: 'applications', id: fixture.app, blob: fixture.proof, action: 'view' }), /无权/)
  await assert.rejects(call('web', 'attachment', { table: 'files', id: 'FILE-A', action: 'download' }), /下载权限/)
  await assert.rejects(call('web', 'stage01.query', 'workorders'), /无权|身份|物业/)
  await assert.rejects(call('resident', 'stage01.query', 'workorders'), /住户|无权/)
  await assert.rejects(call('resident', 'attachment', { table: 'files', id: 'FILE-A', action: 'download' }), /下载权限/)
  await fresh(); await screenshot('F01-platform-menus')
})
await check('R2-F02', '空间树独立宽度与直接添加下级可见可点击', async () => {
  await fixtures(); await fresh('buildings:B-A'); await reveal('buildings:B-A')
  for (const width of [1366, 1920]) {
    await web.setViewportSize({ width, height: 900 }); const box = await web.locator('.space-tree').boundingBox(), right = await web.locator('.space-main').boundingBox()
    assert(box.width >= 330 && box.width <= 365, '树宽合适'); assert(right.width > 550, '右区可用')
    await selectTreeNode('buildings:B-A');const direct = web.locator('[data-space-toolbar-child][data-space-add-child="buildings:B-A"]'); assert(await direct.isVisible()); await direct.click(); await modal('新增单元档案').waitFor(); await modal('新增单元档案').locator('.ivu-modal-close').click()
    observations.push({ id: 'R2-F02', width, treeWidth: box.width, rightWidth: right.width }); await screenshot('F02-tree-' + width)
  }
  await web.setViewportSize({ width: 1366, height: 900 })
})
await check('R2-F03', '虚拟根默认名称、空值校验、保存刷新持久且社区记录不变', async () => {
  await fixtures(); await fresh(); const before = await call('web', 'query', 'communities'); assert.match(await node('root').innerText(), /大光路社区/)
  await treeMenu('root','编辑根名称'); let m = modal('编辑空间目录名称'); await m.locator('input').fill(''); await button(m, '保存').click(); await m.getByText(/请填写1～30/).waitFor(); assert.equal(await m.locator('input').inputValue(), '')
  await m.locator('input').fill('R2F演示空间目录'); await button(m, '保存').click(); await m.waitFor({ state: 'hidden' }); await web.reload(); await node('root').waitFor(); assert.match(await node('root').innerText(), /R2F演示空间目录/); assert.equal((await call('web', 'info')).spaceRootName, 'R2F演示空间目录'); assert.deepEqual(await call('web', 'query', 'communities'), before)
  await screenshot('F03-root-persistence'); await treeMenu('root','编辑根名称'); m = modal('编辑空间目录名称'); await m.locator('input').fill('大光路社区'); await button(m, '保存').click(); await m.waitFor({ state: 'hidden' })
})
await check('R2-F04', '结构同级下级保存，C/E/B逐字段真实名称且已知上级禁用', async () => {
  await fixtures()
  for (const spec of [
    ['root', 'direct', 'communities', 'rootC', []], ['communities:C-A', '新增同级', 'communities', 'peerC', []],
    ['communities:C-A', 'direct', 'estates', 'childE', [['所属社区', names.C]]], ['estates:E-A', '新增同级', 'estates', 'peerE', [['所属社区', names.C]]],
    ['estates:E-A', 'direct', 'buildings', 'childB', [['所属社区', names.C], ['所属小区', names.E]]], ['buildings:B-N', '新增同级', 'buildings', 'peerB', [['所属社区', names.C], ['所属小区', names.E]]],
    ['buildings:B-A', 'direct', 'units', 'childU', [['所属社区', names.C], ['所属小区', names.E], ['所属楼栋', names.B]]], ['units:U-A', '新增同级', 'units', 'peerU', [['所属社区', names.C], ['所属小区', names.E], ['所属楼栋', names.B]]],
  ]) {
    const [key, action, t, suffix, parents] = spec; await fresh(key); if (action === 'direct') await directChild(key); else await treeMenu(key, action)
    const m = await basicForm(t, suffix); for (const [n, label] of parents) await locked(m, t, n, label)
    if(suffix==='childB'||suffix==='childU')await screenshot('F04-locked-parents-'+suffix)
    await save(t); const r = await findNamed(t, suffix); await reveal(t+':'+r._id);assert(await node(t+':'+r._id).isVisible(),'树展示已新增档案');observations.push({ id: 'R2-F04', action, table: t, record: r._id, parents })
    if (suffix === 'childB' || suffix === 'childU') await screenshot('F04-' + suffix)
  }
  await fresh(); assert((await ids()).includes('H-A')); const newC = await findNamed('communities', 'rootC'), newE = await findNamed('estates', 'childE');for(const key of ['communities:'+newC._id,'estates:'+newE._id]){await reveal(key);await node(key).click();assert(!(await web.locator('.space-context').innerText()).includes('没有可见空间'))}
})
await check('R2-F05', '末级房间无更多且右列表编辑、停用、启用可办', async () => {
  await fixtures(); await fresh('houses:H-A2'); await selectTreeNode('houses:H-A2'); assert.equal(await web.locator('[data-space-edit="houses:H-A2"],[data-space-status="houses:H-A2"]').count(), 0); assert(await web.locator('[data-space-toolbar-child][data-space-add-child="houses:H-A2"]').isDisabled(),'房间不能新增下级节点')
  await (await rowActions('H-A2')).getByText('编辑', { exact: true }).click(); let m = modal('编辑房间（房屋）'); for (const [n, text] of [['所属社区', names.C], ['所属小区', names.E], ['所属楼栋', names.B], ['所属单元', names.U]]) await locked(m, 'houses', n, text)
  await fill(m, 'houses', '楼层', '2'); await save('houses', '编辑房间（房屋）'); assert.equal((await call('web', 'record', 'houses', 'H-A2'))['楼层'], '2')
  for (const [label, state] of [['停用', '停用'], ['启用', '启用']]) { await (await rowActions('H-A2')).getByText(label, { exact: true }).click(); m = modal('受控状态变更'); assert.match(await m.locator('[data-testid="space-status-target"]').innerText(), /0102/); await m.locator('textarea').fill('R2F房间行启停'); await button(m, '确认').click(); await m.waitFor({ state: 'hidden' }); assert.equal((await call('web', 'record', 'houses', 'H-A2'))['档案状态'], state) }
  await screenshot('F05-house-row-actions')
})
await check('R2-F06', '根及C/E/B/U/H创建房间，按层锁定、选择单元和H回父可见', async () => {
  await fixtures()
  for (const [key, suffix, lockedParents, chooseParents] of [
    ['root', 'hRoot', [], [['所属社区', names.C], ['所属小区', names.E], ['所属楼栋', names.N]]],
    ['communities:C-A', 'hC', [['所属社区', names.C]], [['所属小区', names.E], ['所属楼栋', names.N]]],
    ['estates:E-A', 'hE', [['所属社区', names.C], ['所属小区', names.E]], [['所属楼栋', names.N]]],
    ['buildings:B-A', 'hB', [['所属社区', names.C], ['所属小区', names.E], ['所属楼栋', names.B]], [['所属单元', 'R2F第二单元']]],
    ['units:U-A', 'hU', [['所属社区', names.C], ['所属小区', names.E], ['所属楼栋', names.B], ['所属单元', names.U]], []],
    ['houses:H-A', 'hH', [['所属社区', names.C], ['所属小区', names.E], ['所属楼栋', names.B], ['所属单元', names.U]], []],
    ['houses:H-N', 'hNoU', [['所属社区', names.C], ['所属小区', names.E], ['所属楼栋', names.N]], []],
  ]) {
    await fresh(key); await button(web, '新增房间').click(); const m = await basicForm('houses', suffix)
    for (const [n, text] of lockedParents) await locked(m, 'houses', n, text)
    for (const [n, text] of chooseParents) { await editable(m, 'houses', n); await choose(m, 'houses', n, text) }
    const noUnit = ['hRoot','hC','hE','hNoU'].includes(suffix); if (noUnit) assert.equal(await field(m,'houses','所属单元').isVisible(), false, '无单元楼栋不造假单元')
    await save('houses'); const h = await findNamed('houses', suffix); assert.equal(h['所属楼栋'], noUnit ? 'B-N' : 'B-A'); if (suffix === 'hB') assert.equal(h['所属单元'], fixture.u); if (['hU','hH'].includes(suffix)) assert.equal(h['所属单元'], 'U-A')
    if (key.startsWith('houses:')) await web.waitForURL(url => new URLSearchParams(url.hash.split('?')[1]).get('node') === (suffix === 'hNoU' ? 'buildings:B-N' : 'units:U-A'))
    assert((await ids()).includes(h._id), '新增房间在实际范围列表可见'); observations.push({ id: 'R2-F06', key, room: h._id, building: h['所属楼栋'], unit: h['所属单元'] || null }); if (suffix === 'hB' || suffix === 'hH') await screenshot('F06-' + suffix)
  }
})
await check('R2-F07', '设施车位实际E/B/U归属、B下选U、聚合查询与编辑不迁移', async () => {
  await fixtures(); const made = []
  for (const t of ['facilities', 'parking']) for (const [key, suffix, parents, down, expected] of [
    ['units:U-A', 'directU', [['所属社区',names.C],['所属小区',names.E],['关联楼栋',names.B],['所属单元',names.U]], [], ['units','U-A']],
    ['buildings:B-A', 'BtoU', [['所属社区',names.C],['所属小区',names.E],['关联楼栋',names.B]], [['所属单元','R2F第二单元']], ['units',fixture.u]],
    ['estates:E-A', 'directE', [['所属社区',names.C],['所属小区',names.E]], [], ['estates','E-A']],
    ['buildings:B-N', 'directB', [['所属社区',names.C],['所属小区',names.E],['关联楼栋',names.N]], [], ['buildings','B-N']],
    ['houses:H-A', 'HtoU', [['所属社区',names.C],['所属小区',names.E],['关联楼栋',names.B],['所属单元',names.U]], [], ['units','U-A']],
  ]) {
    const suffixId=t+'-'+suffix; await fresh(key,t==='facilities'?'设施点位':'车位资源'); await button(web,t==='facilities'?'新增设施':'新增车位').click(); const m=await basicForm(t,suffixId)
    for(const[n,text]of parents)await locked(m,t,n,text);for(const[n,text]of down){await editable(m,t,n);await choose(m,t,n,text)}
    await save(t);const r=await findNamed(t,suffixId);assert.equal(r._spaceTable,expected[0]);assert.equal(r._spaceId,expected[1]);assert.equal(r['所属单元']||'',expected[0]==='units'?expected[1]:'')
    if(key.startsWith('houses:'))await web.waitForURL(url=>new URLSearchParams(url.hash.split('?')[1]).get('node')==='units:U-A')
    assert((await ids()).includes(r._id),'新增资源在真实父范围可见');made.push({t,id:r._id,parent:expected});observations.push({id:'R2-F07',table:t,key,record:r._id,parent:expected})
  }
  for(const t of ['facilities','parking'])for(const key of ['communities:C-A','estates:E-A','buildings:B-A','units:U-A','houses:H-A']){
    await fresh(key,t==='facilities'?'设施点位':'车位资源');const current=await ids(), wanted=made.filter(x=>x.t===t&&(key.startsWith('communities:')||key.startsWith('estates:')||(key==='buildings:B-A'&&x.parent[0]==='units')||(key==='units:U-A'&&x.parent[0]==='units'&&x.parent[1]==='U-A'))).map(x=>x.id)
    for(const id of wanted)assert(current.includes(id),key+'应聚合'+id);for(const r of made.filter(x=>x.t===t&&!wanted.includes(x.id)))assert(!current.includes(r.id),key+'不纳入无关归属'+r.id)
  }
  for(const t of ['facilities','parking']){
    const target=made.find(x=>x.t===t&&x.parent[0]==='units'&&x.parent[1]==='U-A');await fresh('units:U-A',t==='facilities'?'设施点位':'车位资源');await(await rowActions(target.id)).getByText('编辑',{exact:true}).click();const m=modal('编辑'+titles[t]);for(const[n,text]of [['所属社区',names.C],['所属小区',names.E],['关联楼栋',names.B],['所属单元',names.U]])await locked(m,t,n,text);await fill(m,t,'备注','R2F只改备注不迁移');await save(t,'编辑'+titles[t]);const row=await call('web','record',t,target.id);assert.equal(row._spaceTable,'units');assert.equal(row._spaceId,'U-A')
  }
  assert.deepEqual(await call('web','query','relations'),fixture.relations,'空间重构不能更改人房关系');await screenshot('F07-unit-resource-location')
})
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report(),null,2)+'\n')
const evidence=path.join(root,'docs/stages/stage-00/evidence');fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'r2-followup-browser-results'+(only?'-'+only:'')+'.json'),JSON.stringify(report(),null,2)+'\n')
await ctx.close();process.exitCode=results.some(r=>r.status!=='PASS')||errors.length||external.length||consoleErrors.some(e=>/Error in render|TypeError|ReferenceError|Cannot read properties/.test(e.error))?1:0
