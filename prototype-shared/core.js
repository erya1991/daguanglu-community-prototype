import { catalog } from './catalog.js'
import { houseInSpace, resourceInSpace, spaceTables } from './spaces.js'
import { upgradeState } from './r1-migration.js'
export { upgradeState } from './r1-migration.js'
export const SEED_VERSION = 'stage00-v1'
export const clone = (v) => JSON.parse(JSON.stringify(v))
export const roleInApp = (app, id) =>
  app === 'resident'
    ? id === 'resident'
    : app === 'merchant'
      ? id === 'merchant'
      : !['resident', 'merchant'].includes(id)
export class DomainError extends Error {
  constructor(message, fields = {}) {
    super(message)
    this.name = 'DomainError'
    this.fields = fields
  }
}
const fail = (message, fields) => {
  throw new DomainError(message, fields)
}
const now = () => new Date().toISOString()
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const blank = (v) =>
  v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
const list = (v) => (Array.isArray(v) ? v : blank(v) ? [] : [v])
function validateDates(data) {
  for (const [key, value] of Object.entries(data)) {
    if (blank(value) || !/(日期|起始日|结束日)$/.test(key)) continue
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      fail('请填写有效日期', { [key]: '请选择实际有效的日期' })
  }
}
export const tableOrder = [
  'communities',
  'estates',
  'buildings',
  'units',
  'houses',
  'residents',
  'applications',
  'relations',
  'missing',
  'statistics',
  'vehicles',
  'facilities',
  'parking',
  'personnel',
  'files',
  'orgs',
  'accounts',
  'roles',
  'messages',
]
const idNames = {
  communities: '社区编号',
  estates: '小区编号',
  buildings: '楼栋编号',
  units: '单元编号',
  houses: '房屋编号',
  residents: '居民编号',
  applications: '申请编号',
  vehicles: '车辆档案编号',
  facilities: '点位编号',
  personnel: '人员编号',
  files: '文件编号',
}
const titleNames = {
  orgs: '组织名称',
  accounts: '登录账号',
  roles: '角色名称',
  communities: '社区名称',
  estates: '小区名称',
  buildings: '楼栋名称／楼栋号',
  units: '单元名称／单元号',
  houses: '完整房屋地址',
  residents: '居民姓名',
  applications: '申请编号',
  relations: '房屋地址',
  missing: '具体房屋描述',
  statistics: '指标名称',
  vehicles: '车牌号码',
  facilities: '点位名称',
  parking: '车位编号',
  personnel: '人员姓名',
  files: '文件名称',
  messages: '消息标题',
}
export const titleOf = (table, row) => row?.[titleNames[table]] || '未维护'
const stateKey = {
  orgs: '组织状态',
  accounts: '账号状态',
  roles: '角色状态',
  personnel: '在岗状态',
  files: '资料使用状态',
}
const find = (s, t, id) => s[t]?.find((r) => r._id === id)
const active = (r) =>
  r &&
  !['停用', '离岗'].includes(
    r['档案状态'] || r['组织状态'] || r['账号状态'] || r['角色状态'] || r['在岗状态'],
  )
const code = (s, t) => t.slice(0, 3).toUpperCase() + '-' + String(++s.sequence).padStart(5, '0')
function row(table, id, data) {
  const r = {
    _id: id,
    _rev: 1,
    ...Object.fromEntries((catalog[table]?.fields || []).map((f) => [f.name, ''])),
    ...data,
  }
  if (idNames[table]) r[idNames[table]] = id
  if (catalog[table]?.fields.some((f) => f.name === '资料来源'))
    r['资料来源'] = data['资料来源'] || '人工维护'
  if (catalog[table]?.fields.some((f) => f.name === '来源说明'))
    r['来源说明'] = data['来源说明'] || '虚构演示样例，非正式台账'
  if (catalog[table]?.fields.some((f) => f.name === '维护人')) r['维护人'] = '演示种子'
  if (catalog[table]?.fields.some((f) => f.name === '更新时间')) r['更新时间'] = now()
  return r
}
export function createSeed() {
  const s = {
    version: SEED_VERSION,
    generation: 1,
    revision: 0,
    sequence: 100,
    operations: {},
    history: [],
    attachments: {},
  }
  for (const k of tableOrder) s[k] = []
  const add = (t, id, d) => s[t].push(row(t, id, d))
  add('orgs', 'ORG-A', {
    组织名称: '青禾物业（虚构）',
    组织类型: '物业企业',
    组织状态: '启用',
    工作联系人: '示例工作联系人',
    工作联系电话: '025-00000001',
  })
  add('orgs', 'ORG-B', { 组织名称: '望江物业（虚构）', 组织类型: '物业企业', 组织状态: '启用' })
  const role = (id, name, menus, actions, sensitive = []) =>
    add('roles', id, {
      角色名称: name,
      角色说明: '仅用于Stage00权限演示；正式岗位待Q03',
      可见菜单: menus,
      允许操作: actions,
      敏感查看与导出权限: sensitive,
      角色状态: '启用',
    })
  const archives = [
    'communities',
    'estates',
    'buildings',
    'units',
    'houses',
    'residents',
    'statistics',
    'vehicles',
    'facilities',
    'personnel',
    'missing',
    'relations',
    'applications',
    'messages',
  ]
  role(
    'config',
    '配置管理员',
    ['orgs', 'accounts', 'roles'],
    ['read:orgs', 'read:accounts', 'read:roles', 'write:orgs', 'write:accounts', 'write:roles'],
  )
  role(
    'maintainer',
    '基础资料维护岗',
    archives,
    archives
      .map((t) => 'read:' + t)
      .concat(
        archives
          .filter((t) => !['applications', 'relations', 'messages'].includes(t))
          .map((t) => 'write:' + t),
      ),
    ['export'],
  )
  role(
    'reviewer',
    '人房审核岗',
    [
      'applications',
      'relations',
      'residents',
      'houses',
      'communities',
      'estates',
      'buildings',
      'units',
      'messages',
    ],
    [
      'read:applications',
      'read:relations',
      'read:residents',
      'read:houses',
      'read:communities',
      'read:estates',
      'read:buildings',
      'read:units',
      'read:messages',
      'review:applications',
      'write:residents',
    ],
    ['phone', 'proof'],
  )
  role(
    'query',
    '受限查询岗',
    archives.filter((t) => !['applications', 'missing'].includes(t)),
    archives.filter((t) => !['applications', 'missing'].includes(t)).map((t) => 'read:' + t),
  )
  role(
    'sensitive',
    '获准敏感查询岗',
    archives,
    archives.map((t) => 'read:' + t),
    ['phone', 'proof', 'export'],
  )
  role(
    'file-manager',
    '文件维护岗',
    ['files', 'orgs', 'messages'],
    ['read:files', 'write:files', 'read:orgs', 'read:messages'],
  )
  role('file-reader', '文件查阅岗', ['files', 'messages'], ['read:files', 'read:messages'])
  role(
    'resident',
    '住户',
    ['houses', 'applications', 'relations', 'vehicles', 'messages', 'missing'],
    ['resident'],
  )
  role('merchant', '商户框架', [], ['merchant'])
  const account = (id, name, roles, org, communities, apps, resident) =>
    add('accounts', id, {
      登录账号: id,
      人员姓名: name,
      所属组织: org,
      岗位: '演示身份',
      授权角色: roles,
      可查看社区: communities,
      可查看小区: communities.includes('C-A') ? ['E-A'] : communities.includes('C-B') ? ['E-B'] : [],
      账号状态: '启用',
      当前工作身份状态: '在岗',
      _apps: apps,
      _resident: resident || '',
    })
  account('admin', '演示配置员', ['config'], 'ORG-A', ['C-A'], ['web'])
  account('archive', '演示资料员', ['maintainer'], 'ORG-A', ['C-A'], ['web'])
  account('audit', '演示审核员', ['reviewer'], 'ORG-A', ['C-A'], ['web'])
  account('staff', '演示查询员', ['query'], 'ORG-A', ['C-A'], ['web', 'staff'])
  account('sensitive', '演示敏感查询员', ['sensitive'], 'ORG-A', ['C-A'], ['web', 'staff'])
  account('file-owner', '演示文件员', ['file-manager'], 'ORG-A', ['C-A'], ['web'])
  account('file-reader', '演示文件读者', ['file-reader'], 'ORG-A', ['C-A'], ['web'])
  account('resident-a', '林示例', ['resident'], '', [], ['resident'], 'R-A')
  account('resident-b', '周示例', ['resident'], '', [], ['resident'], 'R-B')
  account(
    'dual',
    '兼有居民身份的离岗样例',
    ['query', 'resident'],
    'ORG-A',
    ['C-A'],
    ['resident', 'staff'],
    'R-C',
  )
  account('merchant', '演示商户', ['merchant'], 'ORG-B', [], ['merchant'])
  add('communities', 'C-A', {
    社区名称: '青禾示例社区',
    社区地址: '演示路1号',
    社区简介: '仅供原型验证的虚构社区',
    维护单位: 'ORG-A',
    档案状态: '启用',
  })
  add('communities', 'C-B', {
    社区名称: '望江示例社区',
    社区地址: '演示路2号',
    维护单位: 'ORG-B',
    档案状态: '启用',
  })
  add('estates', 'E-A', {
    小区名称: '青禾示例花园',
    所属社区: 'C-A',
    小区地址: '演示路10号',
    物业管理单位: 'ORG-A',
    档案状态: '启用',
  })
  add('estates', 'E-B', {
    小区名称: '望江示例公寓',
    所属社区: 'C-B',
    小区地址: '演示路20号',
    物业管理单位: 'ORG-B',
    档案状态: '启用',
  })
  add('buildings', 'B-A', {
    '楼栋名称／楼栋号': '01幢',
    所属社区: 'C-A',
    所属小区: 'E-A',
    是否设单元: '是',
    档案状态: '启用',
  })
  add('buildings', 'B-N', {
    '楼栋名称／楼栋号': '02幢',
    所属社区: 'C-A',
    所属小区: 'E-A',
    是否设单元: '否',
    档案状态: '启用',
  })
  add('buildings', 'B-B', {
    '楼栋名称／楼栋号': '01幢',
    所属社区: 'C-B',
    所属小区: 'E-B',
    是否设单元: '否',
    档案状态: '启用',
  })
  add('units', 'U-A', {
    '单元名称／单元号': '1单元',
    所属社区: 'C-A',
    所属小区: 'E-A',
    所属楼栋: 'B-A',
    档案状态: '启用',
  })
  for (const [id, c, e, b, u, number] of [
    ['H-A', 'C-A', 'E-A', 'B-A', 'U-A', '0101'],
    ['H-A2', 'C-A', 'E-A', 'B-A', 'U-A', '0102'],
    ['H-N', 'C-A', 'E-A', 'B-N', '', '001'],
    ['H-B', 'C-B', 'E-B', 'B-B', '', '0101'],
  ])
    add('houses', id, {
      所属社区: c,
      所属小区: e,
      所属楼栋: b,
      所属单元: u,
      房号: number,
      楼层: '1',
      房屋用途: '住宅',
      房屋面积: '',
      档案状态: '启用',
    })
  for (const [id, name, acc] of [
    ['R-A', '林示例', 'resident-a'],
    ['R-B', '周示例', 'resident-b'],
    ['R-C', '兼有居民身份的示例', 'dual'],
  ])
    add('residents', id, {
      居民姓名: name,
      联系电话: id === 'R-A' ? '13900000001' : '13900000002',
      关联账号: acc,
      账号关联情况: '已核验关联',
      _communities: ['C-A'],
    })
  add('relations', 'REL-B', {
    居民姓名: '周示例',
    房屋地址: '',
    关系类型: '租户',
    关系状态: '有效',
    有效起始日: '2026-01-01',
    来源申请编号: 'APP-HISTORY',
    建立时间: now(),
    _resident: 'R-B',
    _house: 'H-A',
  })
  add('relations', 'REL-C', {
    居民姓名: '兼有居民身份的示例',
    关系类型: '家庭成员',
    关系状态: '有效',
    建立时间: now(),
    _resident: 'R-C',
    _house: 'H-N',
  })
  add('applications', 'APP-REJECT', {
    申请类型: '绑定',
    申请人姓名: '林示例',
    联系号码: '13900000001',
    申请关系类型: '业主',
    申请说明: '用于驳回重提的独立样例',
    申请状态: '已驳回',
    审核轮次: 1,
    提交时间: now(),
    对外审核说明: '样例：请补充说明',
    内部审核备注: '仅审核岗可见的内部示例',
    审核人: '演示审核员',
    审核时间: now(),
    _resident: 'R-A',
    _house: 'H-A2',
  })
  add('vehicles', 'V-B', {
    车牌号码: '苏ADEMO2',
    车辆类型: '小型汽车（样例）',
    车辆颜色: '白色',
    关联居民: 'R-B',
    关联房屋: 'H-A',
    核实状态: '已确认',
    _resident: 'R-B',
    _community: 'C-A',
  })
  for (const [id, type] of [
    ['F-1', '车棚'],
    ['F-2', '监控'],
    ['F-3', '充电'],
    ['F-4', '消防'],
  ])
    add('facilities', id, {
      点位名称: type + '示例点位',
      点位类别: type,
      所属社区: 'C-A',
      所属小区: 'E-A',
      具体位置: '示例公共通道',
      数量: '',
      档案状态: '启用',
      接入状态: '未接入',
      接入说明: '仅基础档案，无实时设备服务',
      维护单位: 'ORG-A',
    })
  add('personnel', 'P-A', {
    人员姓名: '物业联系示例',
    所属物业组织: 'ORG-A',
    岗位: '客服（样例）',
    工作联系电话: '025-00000001',
    在岗状态: '在岗',
    入岗日期: '2026-01-01',
  })
  add('personnel', 'P-DUAL', {
    人员姓名: '兼有居民身份的示例',
    所属物业组织: 'ORG-A',
    岗位: '资料查询（样例）',
    在岗状态: '在岗',
    关联账号: 'dual',
    入岗日期: '2026-01-01',
  })
  const file = {
    文件名称: '虚构物业资料示例',
    文件分类: '制度规程',
    所属组织: 'ORG-A',
    适用社区: ['C-A'],
    适用小区: ['E-A'],
    文件附件: 'seed-file-v1',
    附件文件名: '虚构说明-v1.txt',
    文件格式: 'txt',
    文件大小: 54,
    版本号: 'V1',
    资料使用状态: '使用中',
    可查阅角色: ['file-manager', 'file-reader'],
    可下载角色: ['file-manager'],
    上传人: '演示种子',
    上传时间: now(),
  }
  add('files', 'FILE-A', { ...file, _versions: [{ ...file, 变更说明: '初始版本', _blob: 'seed-file-v1' }] })
  s.attachments['seed-file-v1'] = {
    name: '虚构说明-v1.txt',
    type: 'text/plain',
    size: 54,
    text: '这是虚构物业文件 V1，仅用于原型演示。',
  }
  upgradeState(s, true)
  hydrate(s)
  return s
}
export function actorFor(s, ctx) {
  const a = find(s, 'accounts', ctx.account)
  if (!active(a) || !a._apps?.includes(ctx.app)) fail('当前演示身份不可用，请重新选择')
  const allowedRole = (id) => roleInApp(ctx.app, id)
  const rid = ctx.role || a['授权角色'].find(allowedRole),
    role = find(s, 'roles', rid)
  if (!allowedRole(rid)) fail('该角色不属于当前应用入口')
  if (!list(a['授权角色']).includes(rid) || !active(role)) fail('当前角色已被收回或停用')
  if (rid !== 'resident' && a['当前工作身份状态'] === '离岗') fail('当前工作身份已离岗')
  return {
    ...a,
    role: rid,
    menus: role['可见菜单'] || [],
    permissions: ctx.app === 'staff' ? (role['允许操作'] || []).filter(p => p.startsWith('read:')) : role['允许操作'] || [],
    sensitive: role['敏感查看与导出权限'] || [],
    name: a['人员姓名'],
    org: a['所属组织'],
    resident: a._resident,
    orgName: find(s, 'orgs', a['所属组织'])?.['组织名称'] || '本人',
    roleName: role['角色名称'],
    scopeLabel:
      list(a['可查看社区'])
        .map((c) => find(s, 'communities', c)?.['社区名称'] || '待维护')
        .join('、') || '本人／本主体',
  }
}
export const permitted = (a, action, table) =>
  a.permissions.includes(`${action}:${table}`) && a.menus.includes(table)
export const sensitive = (a, kind) => a.sensitive.includes(kind)
export function inScope(s, a, r) {
  if (a.role === 'resident') return r._resident === a.resident
  const communities = list(r['适用社区'])
    .concat(list(r['所属社区'] || r._community))
    .concat(r._communities || [])
  if (s.communities.some((c) => c._id === r._id)) communities.push(r._id)
  const estates = list(r['适用小区'])
    .concat(list(r['所属小区'] || r._estate))
    .concat(r._estates || [])
  if (s.estates.some((e) => e._id === r._id)) estates.push(r._id)
  if (communities.length && !communities.some((c) => list(a['可查看社区']).includes(c))) return false
  if (estates.length && !estates.some((e) => list(a['可查看小区']).includes(e))) return false
  const org = r['所属组织'] || r['所属物业组织']
  return !org || (a._orgs || [a.org]).includes(org)
}
function hydrate(s) {
  for (const b of s.buildings)
    b['所属社区'] = find(s, 'estates', b['所属小区'])?.['所属社区'] || b['所属社区']
  for (const u of s.units) {
    const b = find(s, 'buildings', u['所属楼栋'])
    if (b) {
      u['所属社区'] = b['所属社区']
      u['所属小区'] = b['所属小区']
    }
  }
  for (const h of s.houses) {
    const e = find(s, 'estates', h['所属小区']),
      b = find(s, 'buildings', h['所属楼栋']),
      u = find(s, 'units', h['所属单元'])
    h['完整房屋地址'] = [e?.['小区地址'], b?.['楼栋名称／楼栋号'], u?.['单元名称／单元号'], h['房号'] + '室']
      .filter(Boolean)
      .join(' ')
  }
  for (const t of ['relations', 'applications'])
    for (const r of s[t]) {
      const h = find(s, 'houses', r._house)
      if (h) {
        r._addressSnapshot = r._addressSnapshot || h['完整房屋地址']
        r['房屋地址'] = r._addressSnapshot
        r._community = h['所属社区']
        r._estate = h['所属小区']
        if (t === 'applications')
          for (const f of ['所属社区', '所属小区', '所属楼栋', '所属单元', '房号']) r[f] = h[f]
      }
    }
  for (const r of s.relations)
    if (r['关系状态'] === '有效' && r['有效结束日'] && r['有效结束日'] < today()) {
      r['关系状态'] = '已到期'
      r['失效原因'] = '已启用的有效期样例到期'
      r['失效时间'] = r['有效结束日'] + 'T23:59:59+08:00'
    }
  for (const r of s.residents) {
    r['关联房屋'] = s.relations
      .filter((x) => x._resident === r._id && x['关系状态'] === '有效')
      .map((x) => x['房屋地址'])
    r['账号关联情况'] = r['关联账号'] ? '已核验关联' : '未关联'
  }
  for (const h of s.houses)
    h['关联居民'] = s.relations
      .filter((x) => x._house === h._id && x['关系状态'] === '有效')
      .map((x) => x['居民姓名'])
  for (const f of [...s.facilities, ...(s.parking || [])]) {
    const table = f._spaceTable || (f['关联楼栋'] ? 'buildings' : f['所属小区'] ? 'estates' : 'communities')
    const id = f._spaceId || f['关联楼栋'] || f['所属小区'] || f['所属社区']
    f['所属空间'] = titleOf(table, find(s, table, id))
    f._spaceTable = table
    f._spaceId = id
  }
  for (const f of s.files) f['有效期提示'] = validity(f)
  for (const stat of s.statistics) {
    const c = stat['统计范围'],
      people = s.residents.filter((r) => (r._communities || []).includes(c))
    Object.assign(stat, {
      已建档房屋数: s.houses.filter((h) => h['所属社区'] === c && h['档案状态'] === '启用').length,
      居民档案人数: new Set(people.map((r) => r._id)).size,
      有效人房关系数: s.relations.filter((r) => r._community === c && r['关系状态'] === '有效').length,
      已关联账号人数: new Set(people.filter((r) => r['关联账号']).map((r) => r._id)).size,
    })
  }
}
export function validity(f, date = today()) {
  if (!f['到期日期'] && !f['生效日期']) return '未设置'
  if (f['生效日期'] && f['生效日期'] > date) return '未生效'
  if (f['到期日期'] && f['到期日期'] < date) return '已到期'
  if (
    f._reminder &&
    f['到期日期'] &&
    Date.parse(f['到期日期']) - Date.parse(date) <= Number(f['提前提醒天数']) * 86400000
  )
    return '临近到期'
  return '有效'
}
export function fileAllowed(s, a, f, action = 'view') {
  return (
    permitted(a, 'read', 'files') &&
    inScope(s, a, f) &&
    list(f[action === 'download' ? '可下载角色' : '可查阅角色']).includes(a.role)
  )
}
export function query(s, ctx, table, filters = {}) {
  hydrate(s)
  const a = actorFor(s, ctx)
  if (!catalog[table]) fail('不存在的业务页面')
  let items = s[table] || []
  if (a.role === 'resident') {
    if (['houses', 'communities', 'estates', 'buildings', 'units'].includes(table))
      items = items.filter(active)
    else if (table === 'residents') items = items.filter((r) => r._id === a.resident)
    else if (table === 'vehicles') items = items.filter((r) => r._resident === a.resident)
    else if (table === 'missing') items = items.filter((r) => r._resident === a.resident)
    else if (['applications', 'relations'].includes(table))
      items = items.filter((r) => r._resident === a.resident)
    else if (table !== 'messages') fail('当前身份无权查询此页面')
  } else if (!permitted(a, 'read', table)) fail('当前角色无权访问此页面')
  if (table === 'messages')
    items = items.filter((r) => r._recipient === a._id && (!r._role || r._role === a.role))
  else if (a.role !== 'resident') items = items.filter((r) => inScope(s, a, r))
  if (table === 'files') items = items.filter((f) => fileAllowed(s, a, f))
  if (
    a.role !== 'resident' &&
    !sensitive(a, 'phone') &&
    Object.entries(filters).some(([k, v]) => ['联系电话', '联系号码'].includes(k) && !blank(v))
  )
    fail('完整联系方式筛选需要单独敏感查询权限')
  if (ctx.community)
    items = items.filter((r) => {
      if (table === 'communities') return r._id === ctx.community
      const communities = list(r['适用社区'])
        .concat(list(r['所属社区'] || r._community))
        .concat(r._communities || [])
      return !communities.length || communities.includes(ctx.community)
    })
  if (ctx.estate)
    items = items.filter((r) => {
      if (table === 'estates') return r._id === ctx.estate
      const estates = list(r['适用小区']).concat(list(r['所属小区'] || r._estate))
      return !estates.length || estates.includes(ctx.estate)
    })
  if (filters._space) {
    const scope = filters._space
    if (!['houses', 'facilities', 'parking'].includes(table) || !['root', ...spaceTables].includes(scope.table)) fail('当前空间查询范围无效')
    if (scope.table !== 'root') record(s, ctx, scope.table, scope.id)
    items = items.filter(r => table === 'houses' ? houseInSpace(r, scope) : resourceInSpace(r, scope))
  }
  const result = items
    .filter((r) =>
      Object.entries(filters).every(([k, v]) => {
        if (k === '_space') return true
        if (blank(v)) return true
        if (table === 'applications' && k === '申请人姓名') {
          const text = [r['申请人姓名'], r['申请编号'], ...(sensitive(a, 'phone') ? [r['联系号码']] : [])].join(' ')
          return text.toLowerCase().includes(String(v).toLowerCase())
        }
        if (k === '提交时间' && Array.isArray(v)) {
          const date = String(r[k] || '').slice(0, 10)
          return (!v[0] || date >= v[0]) && (!v[1] || date <= v[1])
        }
        return String(r[k] ?? '')
          .toLowerCase()
          .includes(String(v).toLowerCase())
      }),
    )
    .map((r) => {
      const out = clone(r)
      if (table === 'applications') {
        if (!permitted(a, 'review', 'applications')) {
          delete out['内部审核备注']
          delete out['审核人']
        }
        if (a.role !== 'resident' && !sensitive(a, 'proof')) out['证明附件'] = []
      }
      if (a.role !== 'resident' && !sensitive(a, 'phone'))
        for (const k of ['联系电话', '联系号码'])
          if (out[k]) out[k] = String(out[k]).slice(0, 3) + '****' + String(out[k]).slice(-4)
      if (table === 'houses' && (a.role === 'resident' || !sensitive(a, 'phone')))
        out['关联居民'] = a.role === 'resident' ? [] : (r['关联居民'] || []).map(() => '已关联居民（受限）')
      if (table === 'files' && !permitted(a, 'write', 'files')) {
        delete out['可查阅角色']
        delete out['可下载角色']
        delete out['到期提醒接收人']
      }
      delete out._versions
      return out
    })
  return result
}
export function record(s, ctx, table, id) {
  const r = query(s, ctx, table).find((x) => x._id === id)
  if (!r) fail('记录不存在或当前身份无权访问')
  return r
}
export function historyFor(s, ctx, table, id) {
  record(s, ctx, table, id)
  const a = actorFor(s, ctx)
  return s.history
    .filter((h) => h._table === table && h._object === id)
    .map((h) => {
      const out = clone(h)
      if (a.role === 'resident') {
        delete out['变更前值']
        delete out['变更后值']
        delete out['操作组织']
        out['变更字段'] = (out['变更字段'] || []).filter((f) => f !== '内部审核备注')
      }
      if (!sensitive(a, 'phone'))
        for (const k of ['变更前值', '变更后值'])
          if (out[k]) for (const f of ['联系电话', '联系号码', '内部审核备注', '证明附件']) delete out[k][f]
      return out
    })
}
function audit(s, a, t, id, action, before, after, reason, result = '成功') {
  const fields = Object.keys(after || {}).filter(
    (k) => !k.startsWith('_') && JSON.stringify(before?.[k]) !== JSON.stringify(after[k]),
  )
  s.history.push({
    _table: t,
    _object: id,
    操作时间: now(),
    操作人: a.name,
    操作组织: a.orgName,
    操作名称: action,
    操作对象: titleOf(t, after || before),
    变更字段: fields,
    变更前值: Object.fromEntries(fields.map((k) => [k, before?.[k] ?? '未维护'])),
    变更后值: Object.fromEntries(fields.map((k) => [k, after?.[k] ?? '未维护'])),
    '操作说明／原因': reason || '',
    操作结果: result,
  })
}
function message(s, recipient, role, type, content, table, id) {
  s.messages.push(
    row('messages', code(s, 'messages'), {
      消息标题: type,
      消息类型: type,
      消息内容: content,
      接收身份: find(s, 'accounts', recipient)?.['人员姓名'] || recipient,
      关联业务名称: titleOf(table, find(s, table, id)),
      发生时间: now(),
      阅读状态: '未读',
      模拟发送状态: '待处理',
      _recipient: recipient,
      _role: role,
      _table: table,
      _object: id,
    }),
  )
}
function requirePermission(a, act, table) {
  if (!permitted(a, act, table)) fail('当前角色无此操作权限')
}
function required(d, names) {
  const errors = {}
  const labels = { reason: '操作原因', date: '操作日期', blob: '文件附件', feedback: '核实反馈' }
  for (const f of names) if (blank(d[f])) errors[f] = '请填写或选择' + (labels[f] || f)
  if (Object.keys(errors).length) fail('请检查标记的必填字段', errors)
}
function scopeWrite(s, a, t, d) {
  if (!inScope(s, a, d)) fail('不能维护当前组织或数据范围之外的记录')
}
function validateParents(s, t, d) {
  const links = {
    estates: [['所属社区', 'communities']],
    buildings: [['所属小区', 'estates']],
    units: [['所属楼栋', 'buildings']],
    houses: [
      ['所属社区', 'communities'],
      ['所属小区', 'estates'],
      ['所属楼栋', 'buildings'],
    ],
    facilities: [['所属社区', 'communities']],
    parking: [['所属社区', 'communities']],
  }
  for (const [field, tab] of links[t] || []) {
    const p = find(s, tab, d[field])
    if (!active(p)) fail('上级档案不存在或已停用', { [field]: '请选择启用的上级档案' })
  }
  if (t === 'units' && find(s, 'buildings', d['所属楼栋'])?.['是否设单元'] !== '是')
    fail('无单元楼栋不能建立单元')
  if (['buildings', 'units', 'houses'].includes(t)) {
    const building = t === 'buildings' ? d : find(s, 'buildings', d['所属楼栋']),
      estate = find(s, 'estates', building?.['所属小区'] || d['所属小区'])
    if (estate && (!active(estate) || !active(find(s, 'communities', estate['所属社区']))))
      fail('上级社区或小区已停用，不能新增或调整下级档案')
  }
  if (['houses', 'facilities', 'parking'].includes(t)) {
    const e = find(s, 'estates', d['所属小区']),
      b = find(s, 'buildings', d['所属楼栋'] || d['关联楼栋'])
    if (e && e['所属社区'] !== d['所属社区']) fail('小区与社区不匹配')
    if (b && b['所属小区'] !== d['所属小区']) fail('楼栋与小区不匹配')
    if (t !== 'houses' && ((e && !active(e)) || (b && !active(b)))) fail('归属小区或楼栋已停用，不能新增或调整资源')
    if (t === 'houses' && b?.['是否设单元'] === '是') {
      required(d, ['所属单元'])
      const u = find(s, 'units', d['所属单元'])
      if (!active(u) || u['所属楼栋'] !== b._id) fail('单元与楼栋不匹配')
    }
    if (t === 'houses' && b?.['是否设单元'] === '否') d['所属单元'] = ''
  }
}
const requiredByTable = {
  orgs: ['组织名称', '组织类型'],
  accounts: ['登录账号', '人员姓名', '所属组织', '授权角色', '授权变更原因'],
  roles: ['角色名称', '角色说明', '可见菜单', '允许操作'],
  communities: ['社区名称', '社区地址'],
  estates: ['小区名称', '所属社区', '小区地址'],
  buildings: ['所属小区', '楼栋名称／楼栋号', '是否设单元'],
  units: ['所属楼栋', '单元名称／单元号'],
  houses: ['所属社区', '所属小区', '所属楼栋', '房号'],
  residents: ['居民姓名'],
  missing: ['小区名称或地址', '具体房屋描述', '联系号码'],
  statistics: ['统计范围', '指标名称', '指标数值', '统计口径说明', '统计日期', '数据来源', '提供单位'],
  vehicles: ['车牌号码', '关联居民'],
  facilities: ['点位名称', '点位类别', '所属社区', '具体位置'],
  parking: ['车位编号', '车位类型', '所属社区'],
  personnel: ['人员姓名', '所属物业组织', '岗位'],
  files: ['文件名称', '文件分类', '所属组织', '文件附件', '可查阅角色'],
}
export function validateSave(s, ctx, table, input, id) {
  const a = actorFor(s, ctx),
    d = clone(input),
    old = find(s, table, id)
  if (a.role === 'resident' && !['vehicles', 'missing', 'profile'].includes(table))
    fail('住户不能直接维护该档案')
  if (a.role !== 'resident') requirePermission(a, 'write', table)
  if (['facilities', 'parking'].includes(table)) {
    const building = find(s, 'buildings', d['关联楼栋'])
    if (d['关联楼栋'] && !building) fail('归属楼栋不存在', { 关联楼栋: '请选择有效楼栋' })
    const estate = find(s, 'estates', building?.['所属小区'] || d['所属小区'])
    const legacy = table === 'facilities' && old?._spaceTable === 'communities' && !d['所属小区'] && !d['关联楼栋']
    if (!estate && !legacy) fail('新增资源必须归属小区或楼栋', { 所属小区: '请选择小区或从楼栋新增资源' })
    if (building && d['所属小区'] && d['所属小区'] !== building['所属小区']) fail('楼栋与小区不匹配')
    if (estate && d['所属社区'] && d['所属社区'] !== estate['所属社区']) fail('资源与所属社区不匹配')
    if (estate) { d['所属小区'] = estate._id; d['所属社区'] = estate['所属社区'] }
    d._spaceTable = building ? 'buildings' : estate ? 'estates' : 'communities'
    d._spaceId = building?._id || estate?._id || old?._spaceId
    if (old && old._spaceId && (old._spaceId !== d._spaceId || old._spaceTable !== d._spaceTable)) fail('资源归属不能通过普通编辑迁移')
  }
  if (old) {
    record(s, ctx, table, id)
    if (input._rev !== undefined && old._rev !== input._rev) fail('记录已更新，请保留输入并重新核对')
  }
  required(d, requiredByTable[table] || [])
  validateDates(d)
  if (d['资料来源'] && d['资料来源'] !== '人工维护') required(d, ['来源说明'])
  validateParents(s, table, d)
  if (table === 'buildings') {
    d['所属社区'] = find(s, 'estates', d['所属小区'])['所属社区']
    if (old && old['是否设单元'] !== d['是否设单元'] && s.houses.some((h) => h['所属楼栋'] === id))
      fail('已有房屋，不可直接改变单元结构')
  }
  if (table === 'units') {
    const b = find(s, 'buildings', d['所属楼栋'])
    d['所属社区'] = b['所属社区']
    d['所属小区'] = b['所属小区']
  }
  if (table === 'orgs') {
    let p = d['上级组织'],
      visited = new Set([id])
    while (p) {
      if (visited.has(p)) fail('上级组织不能形成循环')
      visited.add(p)
      p = find(s, 'orgs', p)?.['上级组织']
    }
  }
  if (table === 'houses') {
    if (!blank(d['房屋面积']) && !(Number(d['房屋面积']) > 0))
      fail('已知房屋面积必须大于0', { 房屋面积: '未知请留空，已知值应大于0' })
    if (
      s.houses.some(
        (h) =>
          h._id !== id &&
          h['所属楼栋'] === d['所属楼栋'] &&
          h['所属单元'] === d['所属单元'] &&
          h['房号'] === d['房号'],
      )
    )
      fail('房号与已有档案重复，请核实')
  }
  if (old && ['estates', 'buildings', 'units', 'houses'].includes(table))
    for (const f of ['所属社区', '所属小区', '所属楼栋', '所属单元'])
      if (old[f] && old[f] !== d[f]) fail('归属迁移需另行核验，本轮不能通过普通编辑迁移')
  if (table === 'accounts') {
    // Demo configuration role may grant known communities in this single prototype project.
    // This is a labelled Q03 example, separate from permission to read business/sensitive data.
    const grantable =
      ['config', 'platform'].includes(a.role) ? s.communities.filter(active).map((c) => c._id) : list(a['可查看社区'])
    if (list(d['可查看社区']).some((c) => !grantable.includes(c)))
      fail('不能授予当前身份可授予社区范围之外的权限')
    if (s.accounts.some((r) => r._id !== id && r['登录账号'] === d['登录账号']))
      fail('登录账号已存在，不按姓名合并')
    for (const rid of list(d['授权角色'])) if (!active(find(s, 'roles', rid))) fail('授权角色不存在或已停用')
    if (
      list(d['可查看小区']).some((e) => !list(d['可查看社区']).includes(find(s, 'estates', e)?.['所属社区']))
    )
      fail('小区授权须在已授权社区内')
    if (a._id === id && !list(d['授权角色']).includes(a.role))
      fail('不能移除当前操作者自身正在使用的管理角色')
  }
  if (table === 'statistics') {
    if (!/^\d+$/.test(String(d['指标数值'])))
      fail('指标数值须为非负整数', { 指标数值: '来源未知时不要建立数值为0的记录' })
    d['计量单位'] = d['指标名称'] === '人口' ? '人' : '户'
    d._community = d['统计范围']
  }
  if (table === 'vehicles') {
    d['车牌号码'] = String(d['车牌号码']).trim().toUpperCase()
    if (a.role === 'resident') {
      d['关联居民'] = a.resident
      d._resident = a.resident
    } else d._resident = d['关联居民']
    if (
      d['关联房屋'] &&
      !s.relations.some(
        (r) => r._resident === d._resident && r._house === d['关联房屋'] && r['关系状态'] === '有效',
      )
    )
      fail('仅可选择该居民有效人房关系中的房屋')
    if (
      old &&
      (old['车牌号码'] !== d['车牌号码'] ||
        old['关联居民'] !== d['关联居民'] ||
        old['关联房屋'] !== d['关联房屋'])
    )
      required(d, ['登记说明'])
    d._community = find(s, 'houses', d['关联房屋'])?.['所属社区'] || old?._community || 'C-A'
    d['核实状态'] = '待核实'
  }
  if (table === 'facilities') {
    if (!blank(d['数量'])) {
      if (!/^\d+$/.test(String(d['数量']))) fail('数量须为非负整数')
      required(d, ['数量单位'])
    }
    if (d['关联房屋'] && find(s, 'houses', d['关联房屋'])?.['所属社区'] !== d['所属社区'])
      fail('关联房屋与点位所属社区不一致')
    if (d['关联房屋']) {
      const h = find(s, 'houses', d['关联房屋'])
      if (!h || (d['所属小区'] && h['所属小区'] !== d['所属小区']) || (d['关联楼栋'] && h['所属楼栋'] !== d['关联楼栋'])) fail('关联房屋不在当前设施所属空间内')
    }
    d['接入状态'] = old?.['接入状态'] || '未接入'
  }
  if (table === 'parking') {
    d['车位编号'] = String(d['车位编号']).trim()
    if (old && old['车位编号'] !== d['车位编号']) fail('已有车位编号不可通过普通编辑修改')
    if (s.parking.some(r => r._id !== id && r._spaceId === d._spaceId && r['车位编号'] === d['车位编号'])) fail('当前空间已有相同车位编号', { 车位编号: '请使用当前空间内唯一的编号' })
  }
  if (table === 'personnel' && old && ['所属物业组织', '岗位', '关联账号'].some((k) => old[k] !== d[k]))
    required(d, ['变更说明'])
  if (table === 'personnel' && d['离岗日期'] && d['入岗日期'] && d['离岗日期'] < d['入岗日期'])
    fail('离岗日期不得早于入岗日期')
  if (table === 'files') {
    if (list(d['可下载角色']).some((r) => !list(d['可查阅角色']).includes(r)))
      fail('可下载角色必须属于可查阅角色')
    if (d['到期日期'] && d['生效日期'] && d['到期日期'] < d['生效日期']) fail('到期日期不得早于生效日期')
    if (d._reminder) {
      required(d, ['到期日期', '到期提醒接收人', '提前提醒天数'])
      if (!/^\d+$/.test(String(d['提前提醒天数']))) fail('提醒天数须为非负整数')
    } else {
      d['到期提醒接收人'] = []
      d['提前提醒天数'] = ''
    }
  }
  if (table === 'missing') {
    d._resident = a.resident
    d._community = d['社区']
    d['提交时间'] = now()
  }
  if (a.role !== 'resident') scopeWrite(s, a, table, d)
  return d
}
// Legal business transitions. The persistence adapter commits the resulting graph atomically.
export function execute(s, ctx, command, p = {}) {
  const a = actorFor(s, ctx)
  if (p.operation && s.operations[p.operation]) return clone(s.operations[p.operation])
  if (p.fail) fail('模拟处理失败；输入已保留，可重试')
  let result
  if (command === 'save') {
    const { table, id } = p,
      old = find(s, table, id)
    const data = Object.fromEntries(
      (catalog[table]?.form || []).filter((k) => k in p.data).map((k) => [k, p.data[k]]),
    )
    if (['facilities', 'parking'].includes(table)) {
      if (p.space) {
        if (!['estates', 'buildings'].includes(p.space.table)) fail('设施和车位只能在小区或楼栋下新增')
        const parent = record(s, ctx, p.space.table, p.space.id)
        data['所属社区'] = parent['所属社区']
        data['所属小区'] = p.space.table === 'estates' ? parent._id : parent['所属小区']
        data['关联楼栋'] = p.space.table === 'buildings' ? parent._id : ''
      } else if (old) for (const key of ['所属社区', '所属小区', '关联楼栋']) if (!(key in data)) data[key] = old[key] || ''
    }
    if (table === 'files') data._reminder = !!p.data._reminder
    if (old) data._rev = p.data._rev
    if (a.role === 'resident' && table === 'vehicles') data['关联居民'] = a.resident
    const d = validateSave(s, ctx, table, data, id)
    if (
      table === 'files' &&
      old &&
      ['所属组织', '适用社区', '适用小区', '可查阅角色', '可下载角色'].some(
        (k) => JSON.stringify(old[k] || []) !== JSON.stringify(d[k] || []),
      )
    )
      required(p, ['reason'])
    if (table === 'vehicles') {
      const duplicate = s.vehicles.find((v) => v._id !== id && v['车牌号码'] === d['车牌号码'])
      if (duplicate) {
        if (duplicate._resident === d._resident)
          return { id: duplicate._id, message: '本人已登记该车辆，已返回原记录' }
        fail('该车牌需进一步核实，不会转移其他记录或公开他人资料')
      }
    }
    if (table === 'files' && !old)
      Object.assign(d, {
        版本号: 'V1',
        资料使用状态: '使用中',
        上传人: a.name,
        上传时间: now(),
        _versions: [],
      })
    if (table === 'files' && old) {
      d['文件附件'] = old['文件附件']
      for (const k of ['附件文件名', '文件格式', '文件大小']) d[k] = old[k]
    }
    const after = row(table, id || code(s, table), {
      ...(old || {}),
      ...d,
      _rev: (old?._rev || 0) + 1,
      维护人: a.name,
      更新时间: now(),
    })
    if (table === 'accounts' && !old)
      Object.assign(after, { _apps: ['web', 'staff'], 账号状态: '启用', 当前工作身份状态: '在岗' })
    if (!old && ['orgs', 'roles', 'communities', 'estates', 'buildings', 'units', 'houses', 'facilities', 'parking'].includes(table))
      after[stateKey[table] || '档案状态'] = '启用'
    if (!old && table === 'personnel') after['在岗状态'] = '在岗'
    if (table === 'files' && !old) {
      const blob = s.attachments[after['文件附件']]
      if (!blob) fail('请先完成本地附件处理')
      after['附件文件名'] = blob.name
      after['文件格式'] = blob.name.split('.').pop()
      after['文件大小'] = blob.size
      after._versions = [{ ...clone(after), _versions: undefined, _blob: after['文件附件'] }]
    }
    if (old) s[table][s[table].indexOf(old)] = after
    else s[table].push(after)
    audit(
      s,
      a,
      table,
      after._id,
      old ? '编辑' : '新增',
      old,
      after,
      p.reason || d['授权变更原因'] || d['变更说明'],
    )
    result = {
      id: after._id,
      message:
        ['communities', 'estates'].includes(table) && !old
          ? '新档案已保存；请由配置演示身份分配社区/小区访问清单后查询'
          : '已保存模拟资料',
    }
  } else if (command === 'apply') {
    if (a.role !== 'resident') fail('仅住户本人可以提交关系申请')
    const d = clone(p.data),
      resident = find(s, 'residents', a.resident),
      house = find(s, 'houses', d._house)
    if (!d._house) fail('请选择有效房屋', { 房号: '请选择实际房屋；找不到时可反馈地址缺失' })
    required(d, ['申请类型'])
    validateDates(d)
    if (!['绑定', '变更', '解除'].includes(d['申请类型'])) fail('申请类型无效')
    if (d['申请类型'] !== '绑定') required(d, ['申请说明'])
    if (!resident?.['居民姓名']) fail('请先补充本人姓名')
    d['联系号码'] = d['联系号码'] || resident['联系电话']
    required(d, ['联系号码'])
    if (!active(house)) fail('房屋不存在或已停用')
    if (
      s.applications.some(
        (r) => r._resident === a.resident && r._house === house._id && r['申请状态'] === '待审核',
      )
    )
      fail('该房屋已有待审核申请，请查看原申请')
    const relation = s.relations.find(
      (r) => r._resident === a.resident && r._house === house._id && r['关系状态'] === '有效',
    )
    if (d['申请类型'] === '绑定' && relation) fail('本人已存在有效关系，无需重复绑定')
    if (d['申请类型'] !== '绑定' && !relation) fail('变更或解除须有本人有效关系')
    if (d['申请类型'] !== '解除') required(d, ['申请关系类型'])
    if (d._validity) {
      required(d, ['申请有效起始日'])
      if (d['申请有效结束日'] && d['申请有效结束日'] < d['申请有效起始日']) fail('有效结束日不得早于起始日')
    } else {
      d['申请有效起始日'] = ''
      d['申请有效结束日'] = ''
    }
    const previous = p.previous ? find(s, 'applications', p.previous) : null
    if (
      previous &&
      (previous._resident !== a.resident || !['已驳回', '已撤回'].includes(previous['申请状态']))
    )
      fail('该申请不可重新提交')
    const r = row('applications', code(s, 'applications'), {
      ...d,
      _resident: a.resident,
      _house: house._id,
      _relation: relation?._id,
      申请人姓名: resident['居民姓名'],
      联系号码: d['联系号码'],
      当前关系类型: relation?.['关系类型'] || '',
      申请状态: '待审核',
      审核轮次: previous ? Number(previous['审核轮次']) + 1 : 1,
      提交时间: now(),
      _previous: previous?._id,
      _addressSnapshot: house['完整房屋地址'],
    })
    s.applications.push(r)
    audit(s, a, 'applications', r._id, '提交申请', null, r, d['申请说明'])
    result = { id: r._id, message: '已提交模拟申请，等待Web审核' }
  } else if (command === 'withdraw' || command === 'review') {
    const r = find(s, 'applications', p.id)
    if (!r) fail('申请不存在')
    record(s, ctx, 'applications', p.id)
    if (r['申请状态'] !== '待审核') fail('申请状态已变化，请刷新查看最新结果')
    const before = clone(r)
    if (command === 'withdraw') {
      if (a.role !== 'resident' || r._resident !== a.resident) fail('只能撤回本人待审申请')
      r['申请状态'] = '已撤回'
      r['撤回时间'] = now()
    } else {
      requirePermission(a, 'review', 'applications')
      if (!['通过', '驳回'].includes(p.decision)) fail('请选择审核操作')
      if (p.decision === '驳回') required(p, ['对外审核说明'])
      Object.assign(r, {
        申请状态: p.decision === '通过' ? '已通过' : '已驳回',
        审核操作: p.decision,
        对外审核说明: p['对外审核说明'] || '',
        内部审核备注: p['内部审核备注'] || '',
        审核人: a.name,
        审核时间: now(),
      })
      if (p.decision === '通过') {
        const h = find(s, 'houses', r._house)
        if (!active(h)) fail('房屋已停用，不能建立或变更有效关系')
        const rel = s.relations.find(
          (x) => x._resident === r._resident && x._house === r._house && x['关系状态'] === '有效',
        )
        if (r['申请类型'] === '绑定') {
          if (rel) fail('已有有效关系，不能重复建立')
          s.relations.push(
            row('relations', code(s, 'relations'), {
              居民姓名: r['申请人姓名'],
              房屋地址: r['房屋地址'],
              关系类型: r['申请关系类型'],
              关系状态: '有效',
              有效起始日: r['申请有效起始日'],
              有效结束日: r['申请有效结束日'],
              来源申请编号: r['申请编号'],
              建立时间: now(),
              _resident: r._resident,
              _house: r._house,
              _addressSnapshot: r['房屋地址'],
            }),
          )
        } else {
          if (!rel || rel._id !== r._relation) fail('原关系已变化，请重新核对')
          const prev = clone(rel)
          if (r['申请类型'] === '解除')
            Object.assign(rel, { 关系状态: '已解除', 失效原因: r['申请说明'], 失效时间: now() })
          else
            Object.assign(rel, {
              关系类型: r['申请关系类型'],
              有效起始日: r['申请有效起始日'],
              有效结束日: r['申请有效结束日'],
            })
          rel._rev++
          audit(s, a, 'relations', rel._id, r['申请类型'], prev, rel, r['申请说明'])
        }
      }
      const recipient = s.accounts.find((x) => x._resident === r._resident)
      if (recipient)
        message(
          s,
          recipient._id,
          'resident',
          r['申请类型'] + '结果',
          r['申请状态'] + '：' + r['对外审核说明'],
          'applications',
          r._id,
        )
    }
    r._rev++
    audit(s, a, 'applications', r._id, command === 'withdraw' ? '撤回' : '审核', before, r, p['对外审核说明'])
    result = { id: r._id, message: '模拟状态已更新' }
  } else if (command === 'profile') {
    if (a.role !== 'resident') fail('仅住户本人可修改本人资料')
    const r = find(s, 'residents', a.resident),
      before = clone(r)
    if (s.relations.some((rel) => rel._resident === a.resident && rel['关系状态'] === '有效'))
      required(p.data, ['姓名'])
    Object.assign(r, {
      居民姓名: p.data['姓名'] || '',
      联系电话: p.data['手机号'] || '',
      _avatar: p.data['头像'] || '',
      _nickname: p.data['昵称'] || '',
      维护人: a.name,
      更新时间: now(),
    })
    r._rev++
    audit(s, a, 'residents', r._id, '本人资料更正', before, r, 'Mock资料更正；保留历史，不修改真实商城账号')
    result = { id: r._id, message: '已保存本人模拟资料' }
  } else if (command === 'status') {
    const r = find(s, p.table, p.id)
    record(s, ctx, p.table, p.id)
    requirePermission(a, 'write', p.table)
    required(p, ['reason'])
    const before = clone(r),
      k = stateKey[p.table] || '档案状态'
    if (p.table === 'personnel') {
      required(p, ['date'])
      validateDates({ 离岗日期: p.date })
      if (r['入岗日期'] && p.date < r['入岗日期']) fail('离岗日期不得早于入岗日期')
      r['在岗状态'] = r['在岗状态'] === '在岗' ? '离岗' : '在岗'
      r['离岗日期'] = r['在岗状态'] === '离岗' ? p.date : ''
      r['变更说明'] = p.reason
      if (r['在岗状态'] === '在岗') r['入岗日期'] = p.date
      const ac = find(s, 'accounts', r['关联账号'])
      if (ac) {
        ac['当前工作身份状态'] = r['在岗状态']
        ac._rev++
      }
    } else
      r[k] = r[k] === '启用' ? '停用' : r[k] === '使用中' ? '已归档' : r[k] === '已归档' ? '使用中' : '启用'
    r._rev++
    r['维护人'] = a.name
    r['更新时间'] = now()
    audit(s, a, p.table, r._id, '受控状态变更', before, r, p.reason)
    result = { id: r._id, message: '状态已更新，历史保留' }
  } else if (command === 'verifyVehicle') {
    requirePermission(a, 'write', 'vehicles')
    const r = find(s, 'vehicles', p.id)
    record(s, ctx, 'vehicles', p.id)
    if (r['核实状态'] !== '待核实') fail('当前车辆不在待核实状态')
    if (!['确认', '退回'].includes(p.decision)) fail('请选择核实操作')
    if (p.decision === '退回') required(p, ['feedback'])
    const before = clone(r)
    Object.assign(r, {
      核实状态: p.decision === '确认' ? '已确认' : '已退回',
      核实操作: p.decision,
      核实反馈: p.feedback || '',
      核实人: a.name,
      核实时间: now(),
    })
    r._rev++
    audit(s, a, 'vehicles', r._id, '核实', before, r, p.feedback)
    const ac = s.accounts.find((x) => x._resident === r._resident)
    if (ac)
      message(s, ac._id, 'resident', '车辆核实结果', r['核实状态'] + '：' + r['核实反馈'], 'vehicles', r._id)
    result = { id: r._id, message: '已记录模拟核实结果；不产生停车权益' }
  } else if (command === 'fileVersion') {
    requirePermission(a, 'write', 'files')
    const r = find(s, 'files', p.id)
    record(s, ctx, 'files', p.id)
    required(p, ['blob', 'reason'])
    const blob = s.attachments[p.blob]
    if (!blob) fail('本地附件不存在')
    const before = clone(r)
    r['文件附件'] = p.blob
    r['附件文件名'] = blob.name
    r['文件格式'] = blob.name.split('.').pop()
    r['文件大小'] = blob.size
    r['版本号'] = 'V' + (r._versions.length + 1)
    r['变更说明'] = p.reason
    r['上传人'] = a.name
    r['上传时间'] = now()
    r._rev++
    r._versions.push({ ...clone(r), _versions: undefined, _blob: p.blob })
    audit(s, a, 'files', r._id, '上传新版本', before, r, p.reason)
    result = { id: r._id, message: '新版本已保存，旧版保留' }
  } else if (command === 'messageRead' || command === 'messageSend') {
    const r = record(s, ctx, 'messages', p.id),
      raw = find(s, 'messages', r._id)
    if (command === 'messageRead') raw['阅读状态'] = '已读'
    else raw['模拟发送状态'] = p.failed ? '模拟失败' : '模拟成功'
    raw._rev++
    result = { id: r._id, message: '已更新本地消息状态，未发送真实通知' }
  } else if (command === 'remind') {
    requirePermission(a, 'write', 'files')
    const f = find(s, 'files', p.id)
    record(s, ctx, 'files', p.id)
    if (!f._reminder || !f['到期日期']) fail('未启用到期提醒，不生成消息')
    for (const id of list(f['到期提醒接收人'])) {
      const ac = find(s, 'accounts', id)
      const role = ac?.['授权角色']?.find((r) => list(f['可查阅角色']).includes(r))
      if (!ac || !role) fail('提醒接收人须具有该资料的查阅角色')
      const receiver = actorFor(s, { account: id, role, app: 'web' })
      if (!fileAllowed(s, receiver, f)) fail('提醒接收人不在资料范围')
      message(
        s,
        id,
        role,
        '文件到期提示',
        '样例提醒：' + f['文件名称'] + '，到期日' + f['到期日期'],
        'files',
        f._id,
      )
    }
    result = { id: f._id, message: '已生成本地样例提醒，未发送真实消息' }
  } else fail('未定义的原型动作')
  hydrate(s)
  s.revision++
  if (p.operation) s.operations[p.operation] = clone(result)
  return result
}
export function dashboard(s, ctx) {
  const a = actorFor(s, ctx),
    safe = (t) => {
      try {
        return query(s, ctx, t)
      } catch {
        return []
      }
    },
    houses = safe('houses'),
    relations = safe('relations').filter((r) => r['关系状态'] === '有效'),
    residents = safe('residents')
  return {
    actor: a,
    counts: {
      已建档房屋数: houses.filter(active).length,
      居民档案人数: new Set(residents.map((r) => r._id)).size,
      有效人房关系数: relations.length,
      已关联账号人数: new Set(residents.filter((r) => r['关联账号']).map((r) => r._id)).size,
      待审核申请数: permitted(a, 'review', 'applications')
        ? safe('applications').filter((r) => r['申请状态'] === '待审核').length
        : null,
      未读结果消息数: safe('messages').filter((r) => r['阅读状态'] === '未读').length,
    },
  }
}
export function fileVersions(s, ctx, id) {
  const a = actorFor(s, ctx),
    f = find(s, 'files', id)
  if (!f || !fileAllowed(s, a, f)) fail('无权查阅该文件')
  return f._versions.map((v) =>
    Object.fromEntries(
      ['版本号', '附件文件名', '文件大小', '上传人', '上传时间', '变更说明', '生效日期', '到期日期'].map(
        (k) => [k, v[k] || '未维护'],
      ),
    ),
  )
}
export function authorizeAttachment(s, ctx, p) {
  const a = actorFor(s, ctx)
  if (p.table === 'files') {
    const f = find(s, 'files', p.id)
    if (!f || !fileAllowed(s, a, f, p.action))
      fail('当前身份没有该版本附件的' + (p.action === 'download' ? '下载' : '查阅') + '权限')
    const v = f._versions.find((v) => v['版本号'] === (p.version || f['版本号']))
    if (!v) fail('目标版本不存在')
    return v._blob
  }
  if (p.table === 'applications') {
    const r = record(s, ctx, 'applications', p.id)
    if (a.role !== 'resident' && !sensitive(a, 'proof')) fail('无权查看证明材料')
    if (!list(r['证明附件']).includes(p.blob)) fail('附件不属于该申请')
    return p.blob
  }
  fail('未获准的附件访问')
}
export function display(s, table, key, value) {
  if (blank(value)) return '未维护／不适用'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))
    return (
      new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') + '（北京时间）'
    )
  if (['文件附件', '证明附件', '点位照片', '头像'].includes(key))
    return list(value)
      .map((id) => s.attachments[id]?.name || '本地演示附件')
      .join('、')
  const refs = {
    所属社区: 'communities',
    社区: 'communities',
    当前社区: 'communities',
    统计范围: 'communities',
    所属小区: 'estates',
    所属楼栋: 'buildings',
    关联楼栋: 'buildings',
    所属单元: 'units',
    关联房屋: 'houses',
    所属组织: 'orgs',
    所属物业组织: 'orgs',
    上级组织: 'orgs',
    维护单位: 'orgs',
    物业管理单位: 'orgs',
    关联居民: 'residents',
    关联账号: 'accounts',
    授权角色: 'roles',
    可查阅角色: 'roles',
    可下载角色: 'roles',
    可查看社区: 'communities',
    适用社区: 'communities',
    可查看小区: 'estates',
    适用小区: 'estates',
    到期提醒接收人: 'accounts',
  }
  const values = list(value).map((v) => {
    const t = refs[key]
    return t && find(s, t, v)
      ? titleOf(t, find(s, t, v))
      : typeof v === 'object'
        ? Object.entries(v)
            .filter(([k]) => !k.startsWith('_'))
            .map(([k, x]) => k + '：' + list(x).join('、'))
            .join('；')
        : String(v)
  })
  return values.join('、')
}
export const optionsFor = (s, ctx, table, field, data = {}) => {
  const enums = {
    组织类型: ['社区组织', '物业企业', '其他（样例）'],
    资料来源: ['人工维护', '台账导入', '外部来源'],
    是否设单元: ['是', '否'],
    房屋用途: ['住宅', '商用', '其他'],
    申请类型: ['绑定', '变更', '解除'],
    申请关系类型: ['业主', '租户', '家庭成员'],
    指标名称: ['人口', '户数'],
    车辆类型: ['小型汽车（样例）', '其他（样例）'],
    点位类别: ['车棚', '监控', '充电', '消防'],
    数量单位: ['台', '个', '处'],
    车位类型: ['普通车位（演示候选）', '无障碍车位（演示候选）', '其他（演示候选）'],
    文件分类: ['制度规程', '图纸', '合同资料', '资质', '巡检/整改报告', '其他'],
    组织状态: ['启用', '停用'],
    角色状态: ['启用', '停用'],
    档案状态: ['启用', '停用'],
    账号状态: ['启用', '停用'],
    在岗状态: ['在岗', '离岗'],
    核实状态: ['待核实', '已确认', '已退回'],
    申请状态: ['待审核', '已通过', '已驳回', '已撤回'],
    关系状态: ['有效', '已解除', '已到期'],
    资料使用状态: ['使用中', '已归档'],
    阅读状态: ['未读', '已读'],
    模拟发送状态: ['待处理', '模拟成功', '模拟失败'],
    接入状态: ['未接入', '待确认'],
    有效期提示: ['未设置', '未生效', '有效', '临近到期', '已到期'],
    关系类型: ['业主', '租户', '家庭成员'],
    账号关联情况: ['已核验关联', '未关联'],
  }
  if (enums[field]) return enums[field].map((v) => ({ value: v, label: field === '点位类别' && v === '充电' ? '充电桩' : v }))
  if (field === '可见菜单') return tableOrder.map((t) => ({ value: t, label: catalog[t].title }))
  if (field === '允许操作')
    return tableOrder
      .flatMap((t) =>
        ['read', 'write'].map((action) => ({
          value: action + ':' + t,
          label: (action === 'read' ? '查询' : '维护') + catalog[t].title,
        })),
      )
      .concat([{ value: 'review:applications', label: '审核关系申请' }])
  if (field === '敏感查看与导出权限')
    return [
      { value: 'phone', label: '完整联系方式' },
      { value: 'proof', label: '证明材料' },
      { value: 'export', label: '导出' },
    ]
  const refs = {
    所属社区: 'communities',
    社区: 'communities',
    统计范围: 'communities',
    可查看社区: 'communities',
    适用社区: 'communities',
    所属小区: 'estates',
    可查看小区: 'estates',
    适用小区: 'estates',
    所属楼栋: 'buildings',
    关联楼栋: 'buildings',
    所属单元: 'units',
    所属组织: 'orgs',
    所属物业组织: 'orgs',
    上级组织: 'orgs',
    维护单位: 'orgs',
    物业管理单位: 'orgs',
    关联居民: 'residents',
    关联房屋: 'houses',
    关联账号: 'accounts',
    授权角色: 'roles',
    可查阅角色: 'roles',
    可下载角色: 'roles',
    到期提醒接收人: 'accounts',
  }
  const t = refs[field]
  if (!t) return []
  const a = actorFor(s, ctx)
  return (s[t] || [])
    .filter(active)
    .filter((r) => {
      if (['communities', 'estates', 'buildings', 'units', 'houses'].includes(t)) {
        if (field === '可查看社区' && ['config', 'platform'].includes(a.role)) return true
        if (field === '可查看小区' && ['config', 'platform'].includes(a.role))
          return list(data['可查看社区']).includes(r['所属社区'])
        if (a.role !== 'resident' && !inScope(s, a, t === 'communities' ? { _community: r._id } : r))
          return false
        if (t === 'estates' && data['所属社区'] && r['所属社区'] !== data['所属社区']) return false
        if (t === 'buildings' && data['所属小区'] && r['所属小区'] !== data['所属小区']) return false
        if (t === 'units' && r['所属楼栋'] !== data['所属楼栋']) return false
        if (t === 'houses' && field === '关联房屋') {
          const resident = a.role === 'resident' ? a.resident : data['关联居民']
          return s.relations.some(
            (x) => x._resident === resident && x._house === r._id && x['关系状态'] === '有效',
          )
        }
      }
      if (t === 'orgs') return (a._orgs || [a.org]).includes(r._id) || a.role === 'config'
      if (t === 'residents') return a.role === 'resident' ? r._id === a.resident : inScope(s, a, r)
      if (t === 'accounts') return r['所属组织'] === a.org || r._id === a._id
      return true
    })
    .map((r) => ({ value: r._id, label: titleOf(t, r) }))
}
export function fieldVisible(s, table, f, d) {
  if (f === '所属单元') return find(s, 'buildings', d['所属楼栋'])?.['是否设单元'] === '是'
  if (table === 'files' && ['提前提醒天数', '到期提醒接收人'].includes(f))
    return !!d._reminder && !!d['到期日期']
  return true
}
export function detailVisible(table, row, field) {
  if (table === 'applications') {
    if (field === '当前关系类型') return row['申请类型'] !== '绑定'
    if (field === '申请关系类型') return row['申请类型'] !== '解除'
    if (['申请有效起始日', '申请有效结束日'].includes(field)) return !!row._validity
    if (field === '撤回时间') return row['申请状态'] === '已撤回'
    if (['审核人', '审核时间', '审核操作', '对外审核说明'].includes(field))
      return ['已通过', '已驳回'].includes(row['申请状态'])
  }
  if (table === 'relations') {
    if (['失效原因', '失效时间'].includes(field)) return row['关系状态'] !== '有效'
    if (['有效起始日', '有效结束日'].includes(field)) return !!row['有效起始日'] || !!row['有效结束日']
  }
  if (table === 'files' && ['提前提醒天数', '到期提醒接收人'].includes(field))
    return !!row._reminder && !!row['到期日期']
  if (table === 'personnel' && field === '离岗日期') return row['在岗状态'] === '离岗'
  if (table === 'vehicles' && ['核实人', '核实时间', '核实操作', '核实反馈'].includes(field))
    return row['核实状态'] !== '待核实'
  return true
}
export function exportData(s, ctx, table, filters) {
  const a = actorFor(s, ctx)
  if (!sensitive(a, 'export')) fail('当前角色无导出权限')
  return query(s, ctx, table, filters)
}
export function scopeOptions(s, ctx) {
  const a = actorFor(s, ctx)
  return {
    communities: s.communities
      .filter((c) => a['可查看社区'].includes(c._id))
      .map((c) => ({ value: c._id, label: c['社区名称'] })),
    estates: s.estates
      .filter(
        (e) =>
          a['可查看社区'].includes(e['所属社区']) &&
          (!ctx.community || e['所属社区'] === ctx.community) &&
          a['可查看小区'].includes(e._id),
      )
      .map((e) => ({ value: e._id, label: e['小区名称'] })),
  }
}
export function communitySummary(s, ctx, id) {
  record(s, ctx, 'communities', id)
  const houses = query(s, ctx, 'houses').filter((h) => h['所属社区'] === id && h['档案状态'] === '启用'),
    residents = query(s, ctx, 'residents').filter((r) => (r._communities || []).includes(id)),
    relations = query(s, ctx, 'relations').filter((r) => r._community === id && r['关系状态'] === '有效')
  return {
    counts: {
      已建档房屋数: houses.length,
      居民档案人数: new Set(residents.map((r) => r._id)).size,
      有效人房关系数: relations.length,
      已关联账号人数: new Set(residents.filter((r) => r['关联账号']).map((r) => r._id)).size,
    },
    sources: query(s, ctx, 'statistics').filter((r) => r['统计范围'] === id),
  }
}
