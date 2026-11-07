// Stage00 R1 adds presentation identities and spatial resources without resetting a session.
export const R1_SCHEMA = 2
const archives = ['communities', 'estates', 'buildings', 'units', 'houses', 'residents', 'applications', 'relations', 'missing', 'statistics', 'vehicles', 'facilities', 'parking', 'personnel', 'files', 'messages']
const writable = archives.filter(t => !['applications', 'relations', 'messages'].includes(t))
export const DEFAULT_SPACE_ROOT_NAME = '大光路社区'
export const platformMenus = [...archives, 'orgs', 'accounts', 'roles']
export const platformPermissions = [...platformMenus.map(t => 'read:' + t), ...[...writable, 'orgs', 'accounts', 'roles'].map(t => 'write:' + t), 'review:applications']
export const platformSensitive = ['phone', 'proof', 'export']
function upgradeDemoSettings(s) {
  let changed = false
  if (typeof s.spaceRootName !== 'string' || !s.spaceRootName.trim()) { s.spaceRootName = DEFAULT_SPACE_ROOT_NAME; changed = true }
  const role = s.roles.find(r => r._id === 'platform')
  if (role) for (const [field, grants] of [['可见菜单', platformMenus], ['允许操作', platformPermissions], ['敏感查看与导出权限', platformSensitive]]) {
    const current = Array.isArray(role[field]) ? role[field] : []
    const next = [...new Set([...current, ...grants])]
    if (JSON.stringify(current) !== JSON.stringify(next)) { role[field] = next; changed = true }
  }
  return changed
}
export const defaultIdentity = { web: 'platform-admin', staff: 'property-admin', resident: 'resident-a', merchant: 'merchant' }
const addRole = (s, id, name, menus, permissions, sensitive) => {
  if (!s.roles.some(r => r._id === id)) s.roles.push({ _id: id, _rev: 1, 角色名称: name, 角色说明: '当前原型默认身份；生产岗位另行确认', 可见菜单: menus, 允许操作: permissions, 敏感查看与导出权限: sensitive, 角色状态: '启用' })
}
export function upgradeState(s, fresh = false) {
  if (s.schemaVersion > R1_SCHEMA || s.version !== 'stage00-v1') throw Error('演示数据版本不兼容，未修改原数据；请保留当前会话并联系维护人员')
  for (const key of ['accounts', 'roles', 'communities', 'estates', 'buildings', 'units', 'houses', 'applications', 'relations', 'facilities', 'files', 'history'])
    if (!Array.isArray(s[key])) throw Error('演示数据结构不完整，升级未执行；原记录已保留，请勿复位')
  if (s.parking !== undefined && !Array.isArray(s.parking)) throw Error('车位数据结构异常，升级未执行')
  if (s.schemaVersion === R1_SCHEMA) return upgradeDemoSettings(s)
  s.parking = s.parking || []
  const reads = archives.map(t => 'read:' + t), writes = writable.map(t => 'write:' + t)
  addRole(s, 'platform', '平台管理员', [...archives, 'orgs', 'accounts', 'roles'], [...reads, ...writes, 'review:applications', ...['orgs', 'accounts', 'roles'].flatMap(t => ['read:' + t, 'write:' + t])], ['export'])
  addRole(s, 'property', '物业管理员', [...archives, 'orgs'], [...reads, ...writes, 'review:applications', 'read:orgs'], ['phone', 'proof'])
  for (const [id, name, role, source, apps] of [
    ['platform-admin', '平台管理员', 'platform', 'admin', ['web']],
    ['property-admin', '物业管理员', 'property', 'archive', ['web', 'staff']],
  ]) {
    if (s.accounts.some(a => a._id === id)) continue
    const old = s.accounts.find(a => a._id === source)
    const communities = fresh && role === 'platform' ? s.communities.map(c => c._id) : [...(old?.['可查看社区'] || [])]
    const estates = fresh && role === 'platform' ? s.estates.map(e => e._id) : [...(old?.['可查看小区'] || [])]
    s.accounts.push({ _id: id, _rev: 1, 登录账号: id, 人员姓名: name, 所属组织: old?.['所属组织'] || 'ORG-A', 岗位: name, 授权角色: [role], 可查看社区: communities, 可查看小区: estates, 账号状态: '启用', 当前工作身份状态: old?.['当前工作身份状态'] || '在岗', _apps: apps,
      _orgs: fresh && role === 'platform' ? [...new Set(s.accounts.map(a => a['所属组织']).filter(Boolean))] : [old?.['所属组织'] || 'ORG-A'] })
  }
  for (const f of s.facilities) {
    if (!f._spaceTable) {
      f._spaceTable = f['所属单元'] ? 'units' : f['关联楼栋'] ? 'buildings' : f['所属小区'] ? 'estates' : 'communities'
      f._spaceId = f['所属单元'] || f['关联楼栋'] || f['所属小区'] || f['所属社区']
    }
  }
  // Transfer the former file-maintenance capability to the ordinary property role.
  // Restricted fixtures, old versions and all prior grants remain in place.
  for (const f of s.files) for (const version of [f, ...(f._versions || [])])
    for (const field of ['可查阅角色', '可下载角色'])
      if (Array.isArray(version[field]) && version[field].includes('file-manager') && !version[field].includes('property')) version[field].push('property')
  s.schemaVersion = R1_SCHEMA
  s.migrations = [...(s.migrations || []), { id: 'stage00-r1', at: new Date().toISOString(), preserved: 'houses, applications, relations, attachments and history' }]
  upgradeDemoSettings(s)
  return true
}
export function ordinaryAccounts(s, app) {
  const ids = app === 'web' ? ['platform-admin', 'property-admin'] : app === 'staff' ? ['property-admin'] : app === 'resident' ? ['resident-a', 'resident-b'] : ['merchant']
  return s.accounts.filter(a => ids.includes(a._id) && a._apps?.includes(app) && a['账号状态'] === '启用')
}
export function upgradeIdentity(ctx, app) {
  if (ctx.identityVersion === R1_SCHEMA) return { ...ctx, app }
  const ordinary = { ...ctx, app, identityVersion: R1_SCHEMA }
  if (app === 'web' && !['platform-admin', 'property-admin'].includes(ctx.account)) {
    ordinary.account = ['admin'].includes(ctx.account) ? 'platform-admin' : 'property-admin'
    ordinary.role = ordinary.account === 'platform-admin' ? 'platform' : 'property'
  } else if (app === 'staff' && ctx.account !== 'property-admin') { ordinary.account = 'property-admin'; ordinary.role = 'property' }
  return ordinary
}
