import { query, execute, clone, DomainError, record, actorFor, permitted } from './core.js'
import { houseInSpace, spaceTables } from './spaces.js'
export const importColumns = [
  '房屋编号',
  '所属社区',
  '所属小区',
  '所属楼栋',
  '所属单元',
  '楼层',
  '房号',
  '房屋用途',
  '房屋面积',
  '资料来源',
  '来源说明',
]
export const importTemplate =
  '\uFEFF' +
  importColumns.join(',') +
  '\r\n,青禾示例社区,青禾示例花园,02幢,,2,0202,住宅,,台账导入,虚构示例台账\r\n'
export function parseCSV(text) {
  const rows = []
  let cells = [],
    cell = '',
    quoted = false,
    line = 1,
    rowStart = 1
  function pushRow() {
    Object.defineProperty(cells, '_line', { value: rowStart })
    rows.push(cells)
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = !quoted
    } else if (c === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else if (c === '\n' && !quoted) {
      cells.push(cell.replace(/\r$/, ''))
      pushRow()
      cells = []
      cell = ''
      rowStart = line + 1
    } else cell += c
    if (c === '\n') line++
  }
  if (quoted) throw new DomainError('CSV引号未闭合，请修正文件')
  if (cell || cells.length) {
    cells.push(cell.replace(/\r$/, ''))
    pushRow()
  }
  return rows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const normalized = r.map((v) => v.replace(/^\uFEFF/, '').trim())
      Object.defineProperty(normalized, '_line', { value: r._line })
      return normalized
    })
}
export function previewImport(state, ctx, text, source, scope) {
  if (!permitted(actorFor(state, ctx), 'write', 'houses')) throw new DomainError('当前身份无房屋导入权限')
  if (scope && scope.table !== 'root') {
    if (!spaceTables.includes(scope.table) || scope.table === 'houses') throw new DomainError('当前节点不支持导入下级房间')
    record(state, ctx, scope.table, scope.id)
  }
  const parsed = parseCSV(text),
    headers = parsed.shift() || []
  if (!source) throw new DomainError('请填写台账来源说明')
  if (importColumns.some((c) => !headers.includes(c)))
    throw new DomainError('模板缺少字段，请下载本轮演示模板')
  const draft = clone(state),
    rows = []
  const nameKey = {
    communities: '社区名称',
    estates: '小区名称',
    buildings: '楼栋名称／楼栋号',
    units: '单元名称／单元号',
  }
  for (let i = 0; i < parsed.length; i++) {
    const raw = Object.fromEntries(headers.map((h, j) => [h, parsed[i][j] || ''])),
      data = { ...raw, 资料来源: '台账导入', 来源说明: source },
      errors = []
    for (const [f, t] of [
      ['所属社区', 'communities'],
      ['所属小区', 'estates'],
      ['所属楼栋', 'buildings'],
      ['所属单元', 'units'],
    ]) {
      if (!raw[f]) continue
      const found = query(draft, ctx, t).filter(
        (r) =>
          r[nameKey[t]] === raw[f] &&
          (t === 'communities' || !data['所属社区'] || r['所属社区'] === data['所属社区']) &&
          (t !== 'buildings' || r['所属小区'] === data['所属小区']) &&
          (t !== 'units' || r['所属楼栋'] === data['所属楼栋']),
      )
      if (found.length !== 1) errors.push(f + '没有唯一可用上级档案')
      else data[f] = found[0]._id
    }
    if (raw['房屋编号'] && draft.houses.some((h) => h['房屋编号'] === raw['房屋编号']))
      errors.push('房屋编号重复')
    if (!errors.length && !houseInSpace(data, scope)) errors.push('文件房屋归属与当前导入范围不一致')
    if (!errors.length)
      try {
        const r = execute(draft, ctx, 'save', { table: 'houses', data })
        if (raw['房屋编号']) {
          const h = draft.houses.find((h) => h._id === r.id)
          h['房屋编号'] = raw['房屋编号']
        }
      } catch (e) {
        errors.push(e.message)
      }
    rows.push({
      数据行号: parsed[i]._line,
      待导入房屋资料: raw,
      校验结果: errors.length ? '不通过' : '通过',
      错误原因: errors,
      _data: data,
    })
  }
  return {
    rows,
    总行数: rows.length,
    通过行数: rows.filter((r) => r['校验结果'] === '通过').length,
    不通过行数: rows.filter((r) => r['校验结果'] !== '通过').length,
    导入处理状态: rows.length && !rows.some((r) => r['错误原因'].length) ? '待确认导入' : '校验未通过',
    revision: state.revision,
    scope: scope || { table: 'root' },
  }
}
export function commitImport(state, ctx, text, source, revision, scope) {
  if (state.revision !== revision) throw new DomainError('预览后数据已变化，请重新校验')
  const preview = previewImport(state, ctx, text, source, scope)
  if (preview['导入处理状态'] !== '待确认导入') throw new DomainError('存在错误，整批未写入')
  const draft = clone(state)
  for (const r of preview.rows) {
    const x = execute(draft, ctx, 'save', { table: 'houses', data: r._data })
    if (r['待导入房屋资料']['房屋编号'])
      draft.houses.find((h) => h._id === x.id)['房屋编号'] = r['待导入房屋资料']['房屋编号']
  }
  Object.assign(state, draft)
  return { ...preview, 导入处理状态: '成功', 提交时间: new Date().toISOString(), 提交人: ctx.account }
}
