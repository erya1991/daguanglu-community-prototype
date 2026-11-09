// UI copy is deliberately separate from complete product definitions in catalog.js.
const help = {
  buildings: { 是否设单元: '无单元楼栋可直接新增房间，不会创建默认单元。' },
  houses: { 房屋面积: '未知可留空。' },
  facilities: { 数量: '未知可留空；填写数量时需选择单位。' },
  parking: {},
  applications: { 申请有效起始日: '仅在启用有效期时填写。', 申请说明: '变更或解除关系时需说明原因。' },
  files: { 可下载角色: '下载角色必须同时具有查阅权限。' },
}
export const fieldHelp = (table, name) => help[table]?.[name] || ''
export const fieldLabel = (table, name) => table === 'houses' && name === '房号' ? '房间号' : table === 'houses' && name === '房屋面积' ? '建筑面积（㎡）' : name
