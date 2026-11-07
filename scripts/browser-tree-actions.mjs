import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
if (args.length > 1 || args.some(arg => !/^--only=TA0[1-7]$/.test(arg))) throw Error('仅支持 --only=TA01 至 TA07；无效参数不启动浏览器')
const only = args[0]?.slice(7), root = path.resolve(import.meta.dirname, '..'), base = 'http://127.0.0.1:19201'
const clickOnly = only === 'TA03'
const run = (clickOnly ? 'TREE_CLICK_' : 'TREE_ACTIONS_') + new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid
const out = path.join(root, clickOnly ? '.runtime/tree-actions-click' : '.runtime/tree-actions', run), results = [], observations = [], errors = [], consoleErrors = [], external = []
const selectors = {
  toolbar: '[data-space-tree-toolbar]',
  child: '[data-space-toolbar-child]',
  sibling: '[data-space-toolbar-sibling]',
  context: '[data-space-toolbar-context]',
}
fs.mkdirSync(out, { recursive: true })
const ctx = await chromium.launchPersistentContext(path.join(out, 'profile'), { channel: 'msedge', headless: true, viewport: { width: 1366, height: 900 } })
ctx.setDefaultTimeout(9000)
ctx.on('page', page => {
  page.on('pageerror', error => errors.push({ url: page.url(), error: error.message }))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ url: page.url(), error: message.text() }) })
  page.on('request', request => { if (!request.url().startsWith(base + '/') && !/^(data:|blob:)/.test(request.url())) external.push(request.url()) })
})
await ctx.route('**/*', route => route.request().url().startsWith(base + '/') || /^(data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort())
const harness = await ctx.newPage()
await harness.goto(base + '/?session=' + run)
await harness.evaluate(async () => {
  const { createBrowserAdapter } = await import('/_shared/storage-h5.js')
  window.qa = createBrowserAdapter('web'); await window.qa.start()
})
const call = (method, ...params) => harness.evaluate(({ method, params }) => window.qa[method](...params), { method, params })
const web = await ctx.newPage()
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const button = (parent, text) => parent.locator('button:visible').filter({ hasText: new RegExp('^\\s*' + escape(text) + '\\s*$') })
const node = key => web.locator('[data-space-node="' + key + '"]')
const edit = key => web.locator(key === 'root' ? '[data-space-root-edit="root"]' : '[data-space-edit="' + key + '"]')
const status = key => web.locator('[data-space-status="' + key + '"]')
const modal = title => web.locator('.ivu-modal-wrap:visible').filter({ has: web.locator('.ivu-modal-header-inner').filter({ hasText: title }) }).last()
const field = (parent, table, name) => parent.locator('[data-field="' + table + ':' + name + '"]')
const titleFields = { communities: '社区名称', estates: '小区名称', buildings: '楼栋名称／楼栋号', units: '单元名称／单元号', houses: '房号' }
const parseSelected = url => new URLSearchParams(new URL(url).hash.split('?')[1]).get('node') || 'root'
const selected = () => parseSelected(web.url())
let createdBuilding, createdUnit

function report() { return { run, session: run, base, runtime: path.relative(root, out).replaceAll('\\', '/'), only: only || null, clickOnly, results, observations, errors, consoleErrors, external, note: '独立QA会话；Web树操作布局与必要回归，未替代人工验收或微信验证' } }
async function screenshot(name) { await web.screenshot({ path: path.join(out, name + '.png'), fullPage: true, animations: 'disabled', timeout: 25000 }) }
async function check(id, name, fn) {
  if (only && only !== id) return
  const before = { errors: errors.length, console: consoleErrors.length }
  try {
    await fn(); assert.equal(errors.length, before.errors, '场景无新增页面异常'); assert.equal(consoleErrors.length, before.console, '场景无新增console.error')
    results.push({ id, name, status: 'PASS' }); console.log('PASS ' + id + ' ' + name)
  } catch (error) { results.push({ id, name, status: 'FAIL', error: error.stack }); console.log('FAIL ' + id + ' ' + error.message); try { await screenshot(id + '-failure') } catch {} }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report(), null, 2))
}
async function fresh(key = 'root', identity = 'platform-admin', role = 'platform') {
  await call('identity', identity, role)
  await web.goto(base + '/web/?session=' + run + '#/spaces' + (key === 'root' ? '' : '?node=' + encodeURIComponent(key)))
  await web.reload(); await web.locator('.space-main').waitFor(); await web.locator(selectors.toolbar).waitFor()
}
async function expand(key) {
  const item = node(key).locator('xpath=ancestor::li[1]'), arrow = item.locator(':scope > .ivu-tree-arrow')
  if (!(await arrow.getAttribute('class')).includes('ivu-tree-arrow-open')) { await arrow.click(); await web.waitForTimeout(150) }
}
async function reveal(key) {
  const [table, id] = key.split(':'), row = table === 'root' ? null : await call('record', table, id)
  const ancestors = ['root']
  for (const [parent, name] of [['communities', '所属社区'], ['estates', '所属小区'], ['buildings', '所属楼栋'], ['units', '所属单元']]) {
    if (row?.[name] && parent !== table) ancestors.push(parent + ':' + row[name])
  }
  for (const ancestor of ancestors) { await node(ancestor).waitFor(); if (ancestor !== key) await expand(ancestor) }
  await node(key).waitFor(); await node(key).scrollIntoViewIfNeeded()
}
async function select(key) {
  await reveal(key)
  if (selected() !== key) { await node(key).click(); await web.waitForURL(url => parseSelected(url.href) === key) }
  assert.equal(selected(), key)
  assert(await node(key).evaluate(element => element.closest('.ivu-tree-title').classList.contains('ivu-tree-title-selected')), '名称点击应正确高亮当前节点')
}
async function expansion() {
  return web.locator('[data-space-node]').evaluateAll(nodes => nodes.map(element => ({ key: element.dataset.spaceNode, expanded: element.closest('li').querySelector(':scope > .ivu-tree-arrow')?.classList.contains('ivu-tree-arrow-open') || false })).sort((a, b) => a.key.localeCompare(b.key)))
}
async function locked(parent, table, name, text) {
  const input = field(parent, table, name).locator('input'); await input.waitFor(); assert(await input.isDisabled(), name + '应禁用')
  await web.waitForFunction(({ selector, text }) => [...document.querySelectorAll(selector)].some(input => input.disabled && input.value === text), { selector: '[data-field="' + table + ':' + name + '"] input', text })
  assert.equal(await input.inputValue(), text, name + '应展示实际名称')
}
async function choose(parent, table, name, text) {
  const item = field(parent, table, name); await item.locator('.ivu-select-selection').click(); await item.locator('.ivu-select-item').filter({ hasText: new RegExp('^' + escape(text) + '$') }).click()
}
async function save(title) { const current = modal(title); await button(current, '保存').click(); await current.waitFor({ state: 'hidden' }); await web.waitForTimeout(250) }
async function cancel(title) { const current = modal(title); await current.locator('.ivu-modal-close').click(); await current.waitFor({ state: 'hidden' }); await web.waitForTimeout(350) }
async function focusAndHover(control, key) {
  await select(key)
  const row = control.locator('xpath=ancestor::span[contains(@class,"space-tree-node")][1]')
  await row.scrollIntoViewIfNeeded(); await row.hover(); await control.hover(); assert(await control.isVisible()); assert.equal(await control.isDisabled(), false)
  assert((await control.getAttribute('aria-label') || await control.getAttribute('title') || '').trim(), '图标按钮需有可访问名称')
  await control.focus(); await web.keyboard.press('Shift+Tab'); await web.keyboard.press('Tab'); assert(await control.evaluate(element => element === document.activeElement), '图标按钮应可通过Tab返回焦点')
  assert(await control.evaluate(element => { const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return !!hit && (hit === element || element.contains(hit)) }), '图标按钮不能被名称区遮挡')
}
async function checkActionIsolation(control, title, key) {
  await focusAndHover(control, key)
  const before = { key: selected(), expansion: await expansion() }
  await web.keyboard.press('Enter'); await modal(title).waitFor()
  assert.equal(selected(), before.key, '图标动作不应改变当前选中节点'); assert.deepEqual(await expansion(), before.expansion, '图标动作不应误展开或收起节点')
  await cancel(title); assert.equal(selected(), before.key); assert.deepEqual(await expansion(), before.expansion)
}

await check('TA01', '双视口工具栏与树名称图标区域分离，左右布局可用', async () => {
  await fresh('estates:E-A'); await reveal('houses:H-A')
  for (const width of [1366, 1920]) {
    await web.setViewportSize({ width, height: 900 }); await web.waitForTimeout(250)
    const layout = await web.locator('.space-tree').evaluate((tree, selectors) => {
      const rect = element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width } }
      const toolbar = tree.querySelector(selectors.toolbar), list = tree.querySelector('.ivu-tree'), viewport = tree.querySelector('[data-space-tree-viewport]'), search = tree.querySelector('input')
      return { tree: rect(tree), toolbar: rect(toolbar), list: rect(list), viewport: rect(viewport), search: rect(search), controlsInsideTree: !!toolbar.closest('.ivu-tree'), inlineTextActions: [...list.querySelectorAll('button:not([data-space-node])')].map(button => button.innerText.trim()).filter(Boolean) }
    }, selectors)
    assert.equal(layout.controlsInsideTree, false); assert(layout.search.bottom <= layout.toolbar.top + 1, '新增工具栏应在搜索下面'); assert(layout.toolbar.bottom <= layout.viewport.top + 1, '新增工具栏应位于树滚动区外侧上方'); assert.deepEqual(layout.inlineTextActions, [], '树节点内只保留图标，不混入文字操作')
    const main = await web.locator('.space-main').boundingBox(); assert(main.width >= 550); assert(layout.tree.right + 8 <= main.x)
    const glyphs = []
    for (const key of ['root', 'communities:C-A', 'estates:E-A', 'buildings:B-A', 'units:U-A', 'houses:H-A']) {
      const label = await node(key).boundingBox(), actions = key === 'root' ? edit(key) : edit(key).or(status(key))
      for (const action of await actions.all()) { const box = await action.boundingBox(); assert(box.width >= 24); assert(label.x + label.width <= box.x + 1, key + '名称和操作图标不可重叠') }
      const glyph = await node(key).locator('.space-node-icon').evaluate(element => ({ content: getComputedStyle(element, '::before').content, fontFamily: getComputedStyle(element).fontFamily }))
      assert(glyph.content && !['none', 'normal', '""', "''"].includes(glyph.content) && glyph.content.replace(/["'\s]/g, '').length, key + '图标必须使用本地实际存在的glyph')
      glyphs.push({ key, ...glyph })
    }
    observations.push({ id: 'TA01', width, layout, mainWidth: main.width, glyphs }); await screenshot('tree-actions-' + width)
  }
  await web.setViewportSize({ width: 1366, height: 900 })
})

await check('TA02', '点击名称选中高亮，各层新增按钮及只读权限匹配', async () => {
  await fresh()
  const contexts = [['root', '大光路社区', true, false], ['communities:C-A', '青禾示例社区', true, true], ['estates:E-A', '青禾示例花园', true, true], ['buildings:B-A', '01幢', true, true], ['buildings:B-N', '02幢', true, true], ['units:U-A', '1单元', true, true], ['houses:H-A', '0101', false, true]]
  for (const [key, name, child, sibling] of contexts) {
    await select(key); assert.equal(await web.locator(selectors.child).isDisabled(), !child); assert.equal(await web.locator(selectors.sibling).isDisabled(), !sibling)
    assert.match(await web.locator(selectors.child).innerText(), /新增下级/); assert.match(await web.locator(selectors.sibling).innerText(), /新增同级/); assert.match(await web.locator(selectors.context).innerText(), new RegExp(escape(name)))
    const expanded = await expansion(); await node(key).click(); await node(key).click(); assert.equal(selected(), key, '重复点击当前名称保持选择'); assert(await node(key).evaluate(element => element.closest('.space-tree-node').classList.contains('is-current')), '重复点击仍高亮'); assert.deepEqual(await expansion(), expanded, '名称重复点击不影响展开状态')
    observations.push({ id: 'TA02', key, child, sibling, context: await web.locator(selectors.context).innerText() })
  }
  const detailState = { key: selected(), expansion: await expansion() }; await web.locator('[data-space-current-detail]').click(); const details = modal('房间（房屋）详情'); await details.waitFor(); assert.equal(await details.locator('input,textarea,select').count(), 0); assert.equal(await details.locator('button').filter({ hasText: /编辑|保存|启用|停用|审核|删除/ }).count(), 0); await cancel('房间（房屋）详情'); assert.equal(selected(), detailState.key); assert.deepEqual(await expansion(), detailState.expansion)
  await fresh('estates:E-A', 'staff', 'query'); assert(await web.locator(selectors.child).isDisabled()); assert(await web.locator(selectors.sibling).isDisabled()); assert.equal(await edit('root').count(), 0)
  for (const control of await web.locator('[data-space-edit],[data-space-status]').all()) assert(await control.isDisabled(), '只读身份不能触发节点维护')
  await fresh('estates:E-A')
})

await check('TA03', '仅点击选中节点显示操作，悬停或仅聚焦不显示，选中后键盘操作可用', async () => {
  async function onlyTools(key) {
    const keys = await web.locator('[data-space-edit],[data-space-status],[data-space-root-edit]').evaluateAll(elements => elements.map(element => element.getAttribute('data-space-edit') || element.getAttribute('data-space-status') || 'root'))
    const expected = key.startsWith('houses:') ? [] : Array(key === 'root' ? 1 : 2).fill(key)
    assert.deepEqual(keys, expected, '只能渲染当前选中节点的操作按钮')
    observations.push({ id: 'TA03', selected: selected(), tools: keys })
  }
  await fresh('estates:E-A'); await reveal('buildings:B-A'); await onlyTools('estates:E-A')
  const initialExpansion = await expansion(); await node('communities:C-A').hover(); assert.equal(selected(), 'estates:E-A'); await onlyTools('estates:E-A')
  await node('communities:C-A').focus(); assert(await node('communities:C-A').evaluate(element => element === document.activeElement)); assert.equal(selected(), 'estates:E-A'); await onlyTools('estates:E-A'); assert.deepEqual(await expansion(), initialExpansion)
  await node('buildings:B-A').focus(); const keyboardExpansion = await expansion(); await web.keyboard.press('Enter'); await web.waitForURL(url => parseSelected(url.href) === 'buildings:B-A'); await onlyTools('buildings:B-A'); assert.deepEqual(await expansion(), keyboardExpansion, '键盘选中名称不误展开')
  assert.equal(await edit('estates:E-A').count(), 0); await web.mouse.move(1300, 90); await onlyTools('buildings:B-A'); assert(await edit('buildings:B-A').isVisible(), '移走鼠标后选中节点工具仍显示')
  await checkActionIsolation(edit('buildings:B-A'), '编辑楼栋档案', 'buildings:B-A')
  await checkActionIsolation(status('buildings:B-A'), '受控状态变更', 'buildings:B-A')
  await select('root'); await onlyTools('root'); assert.equal(await edit('buildings:B-A').count(), 0); await checkActionIsolation(edit('root'), '编辑空间目录名称', 'root')
  await select('houses:H-A'); await onlyTools('houses:H-A'); const room = node('houses:H-A').locator('xpath=ancestor::span[contains(@class,"ivu-tree-title")][1]'); assert.equal(await room.locator('button:not([data-space-node])').count(), 0)
  await select('estates:E-A'); await node('communities:C-A').hover(); await onlyTools('estates:E-A'); await screenshot('tree-click-only-1366')
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(external, [])
})

await check('TA04', '根名称图标编辑不改变当前选中和展开，保存后持久且可恢复', async () => {
  await fresh('estates:E-A'); await select('root'); const original = (await call('info')).spaceRootName || '大光路社区', communities = await call('query', 'communities'), before = { key: selected(), expansion: await expansion() }
  await focusAndHover(edit('root'), 'root'); await web.keyboard.press('Enter'); let current = modal('编辑空间目录名称'); await current.waitFor(); assert.equal(selected(), before.key); assert.deepEqual(await expansion(), before.expansion)
  await current.locator('input').fill('树操作验证目录'); await save('编辑空间目录名称'); assert.equal(selected(), before.key); assert.deepEqual(await expansion(), before.expansion); assert.match(await node('root').innerText(), /树操作验证目录/); assert.deepEqual(await call('query', 'communities'), communities)
  await web.reload(); await node('root').waitFor(); assert.match(await node('root').innerText(), /树操作验证目录/)
  await focusAndHover(edit('root'), 'root'); await edit('root').click(); current = modal('编辑空间目录名称'); await current.locator('input').fill(original); await save('编辑空间目录名称'); assert.equal((await call('info')).spaceRootName, original)
})

await check('TA05', '独立新增下级工具栏实际新建楼栋和单元，上级名称仍禁用带入', async () => {
  await fresh('estates:E-A'); await web.locator(selectors.child).click(); let current = modal('新增楼栋档案'); await current.waitFor(); await locked(current, 'buildings', '所属社区', '青禾示例社区'); await locked(current, 'buildings', '所属小区', '青禾示例花园')
  await field(current, 'buildings', '楼栋名称／楼栋号').locator('input').fill('树操作验证楼'); await choose(current, 'buildings', '是否设单元', '是'); await choose(current, 'buildings', '资料来源', '人工维护'); await save('新增楼栋档案')
  createdBuilding = (await call('query', 'buildings')).find(row => row['楼栋名称／楼栋号'] === '树操作验证楼'); assert(createdBuilding); assert.equal(createdBuilding['所属小区'], 'E-A')
  await select('buildings:' + createdBuilding._id); await web.locator(selectors.child).click(); current = modal('新增单元档案'); await current.waitFor(); await locked(current, 'units', '所属社区', '青禾示例社区'); await locked(current, 'units', '所属小区', '青禾示例花园'); await locked(current, 'units', '所属楼栋', '树操作验证楼')
  await field(current, 'units', '单元名称／单元号').locator('input').fill('树操作验证单元'); await choose(current, 'units', '资料来源', '人工维护'); await save('新增单元档案')
  createdUnit = (await call('query', 'units')).find(row => row['单元名称／单元号'] === '树操作验证单元'); assert(createdUnit); assert.equal(createdUnit['所属楼栋'], createdBuilding._id)
  await select('buildings:' + createdBuilding._id); await web.locator(selectors.sibling).click(); current = modal('新增楼栋档案'); await current.waitFor(); await locked(current, 'buildings', '所属小区', '青禾示例花园'); await cancel('新增楼栋档案')
  await select('units:' + createdUnit._id); await web.locator(selectors.sibling).click(); current = modal('新增单元档案'); await current.waitFor(); await locked(current, 'units', '所属楼栋', '树操作验证楼'); await cancel('新增单元档案'); await screenshot('tree-toolbar-created-building-unit')
})

await check('TA06', '图标停用恢复保留历史与下级引用，停用节点可选且新增下级禁用', async () => {
  if (!createdBuilding || !createdUnit) throw Error('依赖TA05实际新建楼栋和单元；单独执行TA06不创建额外数据')
  const key = 'buildings:' + createdBuilding._id; await select(key); const before = { key: selected(), expansion: await expansion(), history: await call('history', 'buildings', createdBuilding._id), unit: await call('record', 'units', createdUnit._id) }
  await focusAndHover(status(key), key); await status(key).click(); let current = modal('受控状态变更'); await current.waitFor(); assert.equal(selected(), before.key); assert.deepEqual(await expansion(), before.expansion)
  await current.locator('textarea').fill('树操作停用验证'); await button(current, '确认').click(); await current.waitFor({ state: 'hidden' }); await web.waitForTimeout(250)
  assert.equal(selected(), before.key); assert.deepEqual(await expansion(), before.expansion); assert.equal((await call('record', 'buildings', createdBuilding._id))['档案状态'], '停用'); assert.deepEqual(await call('record', 'units', createdUnit._id), before.unit)
  await select(key); assert(await web.locator(selectors.child).isDisabled()); assert.equal(await web.locator(selectors.sibling).isDisabled(), false); assert.match(await node(key).innerText(), /已停用/)
  const stoppedExpansion = await expansion(); await focusAndHover(status(key), key); await status(key).click(); current = modal('受控状态变更'); await current.waitFor(); assert.equal(selected(), key); assert.deepEqual(await expansion(), stoppedExpansion); await current.locator('textarea').fill('树操作恢复验证'); await button(current, '确认').click(); await current.waitFor({ state: 'hidden' }); await web.waitForTimeout(250)
  assert.equal(selected(), key); assert.deepEqual(await expansion(), stoppedExpansion); assert.equal((await call('record', 'buildings', createdBuilding._id))['档案状态'], '启用'); assert.deepEqual(await call('record', 'units', createdUnit._id), before.unit); assert.equal(await web.locator(selectors.child).isDisabled(), false)
  const history = await call('history', 'buildings', createdBuilding._id); assert.equal(history.length, before.history.length + 2); assert.deepEqual(history.slice(0, before.history.length), before.history); assert(history.some(row => row['操作说明／原因'] === '树操作停用验证')); assert(history.some(row => row['操作说明／原因'] === '树操作恢复验证'))
  observations.push({ id: 'TA06', building: createdBuilding._id, unit: createdUnit._id, historyBefore: before.history.length, historyAfter: history.length }); await screenshot('tree-status-restored')
})

await check('TA07', '本次浏览器全过程无页面异常、控制台错误或外部请求', async () => { assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(external, []) })
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report(), null, 2))
fs.mkdirSync(path.join(root, 'docs/stages/stage-00/evidence'), { recursive: true })
fs.writeFileSync(path.join(root, 'docs/stages/stage-00/evidence/' + (clickOnly ? 'tree-actions-click-results' : 'tree-actions-browser-results' + (only ? '-' + only : '')) + '.json'), JSON.stringify(report(), null, 2) + '\n')
await ctx.close()
process.exitCode = results.some(result => result.status !== 'PASS') || errors.length || consoleErrors.length || external.length ? 1 : 0
