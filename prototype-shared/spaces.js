export const spaceTables = ['communities', 'estates', 'buildings', 'units', 'houses']
export const spaceNames = { communities: '社区', estates: '小区', buildings: '楼栋', units: '单元', houses: '房间' }
export const spaceTitle = (table, row) => row?.[{ communities: '社区名称', estates: '小区名称', buildings: '楼栋名称／楼栋号', units: '单元名称／单元号', houses: '房号' }[table]] || ''
export const spaceKey = (table, id) => table + ':' + id
export function spaceParents(table, row) {
  if (!row) return {}
  const context = {}
  if (table === 'communities') context['所属社区'] = row._id
  else context['所属社区'] = row['所属社区']
  if (table === 'estates') context['所属小区'] = row._id
  else if (row['所属小区']) context['所属小区'] = row['所属小区']
  if (table === 'buildings') context['所属楼栋'] = row._id
  else if (row['所属楼栋']) context['所属楼栋'] = row['所属楼栋']
  if (table === 'units') context['所属单元'] = row._id
  return context
}
export function houseInSpace(house, scope) {
  if (!scope || scope.table === 'root') return true
  if (scope.table === 'houses') return house._id === scope.id
  const key = { communities: '所属社区', estates: '所属小区', buildings: '所属楼栋', units: '所属单元' }[scope.table]
  return !!key && house[key] === scope.id
}
export function resourceInSpace(resource, scope) {
  if (!scope || scope.table === 'root') return true
  if (scope?.table === 'communities') return resource['所属社区'] === scope.id
  if (scope.table === 'estates') return resource['所属小区'] === scope.id
  if (scope.table === 'buildings') return (resource._spaceTable === 'buildings' && resource._spaceId === scope.id) || resource['关联楼栋'] === scope.id
  return false
}
