import { houseInSpace, resourceInSpace, spaceKey, spaceTitle } from './spaces.js'

export const productMenus = ['spaces', 'residents', 'applications', 'missing', 'vehicles', 'facilities', 'personnel', 'files']
export const removedMenus = ['relations', 'orgs', 'accounts', 'roles', 'messages']
export const businessDate = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
export const hiddenFields = {
  estates: ['小区编号', '所属社区', '档案状态'], buildings: ['所属社区', '档案状态'], units: ['所属社区', '档案状态'],
  houses: ['所属社区', '房屋编号', '档案状态'],
  facilities: ['所属社区', '档案状态', '接入说明'], parking: ['所属社区', '档案状态'],
  personnel: ['人员编号', '关联账号', '在岗状态', '入岗日期', '离岗日期', '变更说明'],
  files: ['版本号', '变更说明', '生效日期', '到期日期', '提前提醒天数', '到期提醒接收人', '有效期提示', '可查阅角色', '可下载角色', '资料使用状态'],
}
export const publicField = (table, name) => !(hiddenFields[table] || []).includes(name)
// Known seed display aliases only. Original application snapshots and audit facts stay intact.
export function productText(value) {
  if(typeof value !== 'string') return value
  const names={'林示例':'林悦','周示例':'周宁','演示审核员':'物业管理员','演示资料员':'资料维护人员','演示配置员':'平台管理员','演示种子':'平台管理员','Mock资料更正；保留历史，不修改真实商城账号':'本人资料更正','虚构演示样例，非正式台账':''}
  if(Object.prototype.hasOwnProperty.call(names,value))return names[value]
  return value.replace(/^演示路10号(?=\s|$)/,'青禾路10号').replace(/^演示路20号(?=\s|$)/,'望江路20号').replace(/^演示路1号(?=\s|$)/,'青禾路1号').replace(/^演示路2号(?=\s|$)/,'望江路2号')
}

// Presentation changes preserve existing IDs, attachment bytes and historical facts.
export function upgradeProductState(s) {
  const normaliseKnownSeed = () => {
    let changed = false
    const vehicle=s.vehicles?.find(r=>r._id==='V-B'), attachment=s.attachments?.['seed-file-v1'], file=s.files?.find(r=>r._id==='FILE-A'), role=s.roles?.find(r=>r._id==='merchant')
    for (const [row, field, oldValue, value] of [[vehicle,'车牌号码','苏ADEMO2','苏A32018'],[attachment,'name','虚构说明-v1.txt','物业管理制度.txt'],[file,'附件文件名','虚构说明-v1.txt','物业管理制度.txt'],[role,'角色名称','商户框架','商户']]) if(row?.[field]===oldValue){row[field]=value;changed=true}
    for(const table of ['communities','estates','buildings','units','houses','facilities','parking','files','vehicles','residents'])for(const row of s[table]||[])for(const [field,oldValue,value]of [['来源说明','虚构演示样例，非正式台账',''],['维护人','演示种子','平台管理员']])if(row[field]===oldValue){row[field]=value;changed=true}
    const knownAccounts=['admin','archive','audit','staff','sensitive','file-owner','file-reader','dual','merchant','platform-admin','property-admin']
    for(const [index,id] of knownAccounts.entries()){
      const account=s.accounts?.find(row=>row._id===id)
      if(account && ![account['手机号'],account['工作联系电话'],account['联系电话']].some(value=>/^1[3-9]\d{9}$/.test(value||''))){account['手机号']='1390001'+String(index+1).padStart(4,'0');changed=true}
    }
    for(const id of ['resident-a','resident-b']){
      const account=s.accounts?.find(row=>row._id===id),resident=s.residents?.find(row=>row['关联账号']===id)
      if(account && !account['手机号'] && /^1[3-9]\d{9}$/.test(resident?.['联系电话']||'')){account['手机号']=resident['联系电话'];changed=true}
    }
    return changed
  }
  if (s.productRevision === 3) return normaliseKnownSeed()
  normaliseKnownSeed()
  const replacements = new Map([
    ['青禾示例社区', '青禾社区'], ['望江示例社区', '望江社区'], ['青禾示例花园', '青禾花园'], ['望江示例公寓', '望江公寓'],
    ['林示例', '林悦'], ['周示例', '周宁'], ['兼有居民身份的示例', '陈晨'], ['兼有居民身份的离岗样例', '陈晨'],
    ['青禾物业（虚构）', '青禾物业'], ['望江物业（虚构）', '望江物业'], ['示例工作联系人', '张敏'],
    ['演示路1号', '青禾路1号'], ['演示路2号', '望江路2号'], ['演示路10号', '青禾路10号'], ['演示路20号', '望江路20号'],
    ['演示商户', '邻里生活馆'], ['小型汽车（样例）', '小型汽车'], ['其他（样例）', '其他'],
    ['普通车位（演示候选）', '普通车位'], ['无障碍车位（演示候选）', '无障碍车位'], ['其他（演示候选）', '其他'],
    ['示例公共通道', '公共通道'], ['用于驳回重提的独立样例', '补充房屋关系资料'], ['样例：请补充说明', '请补充房屋关系说明'],
    ['仅审核岗可见的内部示例', '材料待补充'], ['演示审核员', '物业管理员'], ['仅供原型验证的虚构社区', '居民生活服务社区'],
    ['演示种子', '平台管理员'], ['虚构演示样例，非正式台账', ''], ['虚构物业资料示例', '物业服务管理制度'],
  ])
  for (const table of ['communities', 'estates', 'buildings', 'units', 'houses', 'residents', 'accounts', 'orgs', 'applications', 'relations', 'facilities', 'parking', 'vehicles', 'files']) {
    for (const r of s[table] || []) for (const key of Object.keys(r)) {
      if (replacements.has(r[key])) r[key] = replacements.get(r[key])
      if (key === '点位名称' && /^(车棚|监控|充电|消防)示例点位$/.test(r[key])) r[key] = r[key].replace('示例', '')
    }
  }
  s.productRevision = 3
  s.migrations = [...(s.migrations || []), { id: 'stage00-r3', at: new Date().toISOString(), preserved: 'IDs, relationships, prior attachments and Stage01 facts', excludedPersonnel: (s.personnel || []).filter(p => !p['关联账号']).map(p => p._id), unlocatedResources: [...(s.facilities || []), ...(s.parking || [])].filter(r => !['buildings', 'units'].includes(r._spaceTable)).map(r => r._id) }]
  captureStatistics(s)
  return true
}

export function personnelFromAccounts(s) {
  return s.accounts.filter(a => s.orgs.some(o => o._id === a['所属组织'] && o['组织类型'] === '物业企业') && a._apps?.some(app => ['web', 'staff'].includes(app)))
    .map(a => ({ _id: a._id, _rev: a._rev, 人员姓名: a['人员姓名'], 所属物业组织: a['所属组织'], 岗位: a['岗位'], 工作联系电话: a['手机号'] || a['工作联系电话'] || a['联系电话'] || '', 关联账号: a._id }))
    .filter(a => !['admin', 'archive', 'audit', 'staff', 'sensitive', 'file-owner', 'file-reader', 'dual'].includes(a._id))
}

export function countSpaceResources(graph, scope) {
  const count=(table,predicate)=>new Set((graph[table]||[]).filter(row=>predicate(row,scope)).map(row=>row._id)).size
  return { houses:count('houses',houseInSpace), facilities:count('facilities',resourceInSpace), parking:count('parking',resourceInSpace) }
}

export function captureStatistics(s) {
  s.resourceSnapshots = s.resourceSnapshots || {}
  s.resourceSnapshots[businessDate()] = { capturedAt: new Date().toISOString(), facilities: JSON.parse(JSON.stringify(s.facilities || [])), parking: JSON.parse(JSON.stringify(s.parking || [])) }
}

export function calculateStatistics(s, { scopes = [], metric, category = '', date }) {
  if (!scopes.length || !['人口', '户数', '设施类别', '车位'].includes(metric) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw Error('请选择统计范围、指标和有效统计日期')
  const names = scopes.map(scope => scope.table === 'root' ? s.spaceRootName : spaceTitle(scope.table, s[scope.table]?.find(r => r._id === scope.id)))
  if (names.some(n => !n)) throw Error('所选统计范围已变化，请重新选择')
  const common = { 范围: [...new Set(names)].join('、'), 统计日期: date, 指标: metric === '设施类别' ? (category || '全部设施') : metric }
  if (['人口', '户数'].includes(metric)) return [{ ...common, 数值: null, 单位: metric === '人口' ? '人' : '户', 状态: '统计口径待确认' }]
  const snapshot = date === businessDate() ? s : s.resourceSnapshots?.[date]
  if (!snapshot) return [{ ...common, 数值: null, 单位: metric === '车位' ? '个' : '处', 状态: '暂无该日期数据' }]
  const rows = (metric === '车位' ? snapshot.parking : snapshot.facilities) || []
  const matching = rows.filter(r => scopes.some(scope => resourceInSpace(r, scope)) && (!category || metric !== '设施类别' || r['点位类别'] === category))
  return [{ ...common, 数值: new Set(matching.map(r => r._id)).size, 单位: metric === '车位' ? '个' : '处', 状态: '已统计' }]
}

const contains = (value, ids) => typeof value === 'string' ? ids.includes(value) : Array.isArray(value) ? value.some(v => contains(v, ids)) : value && typeof value === 'object' ? Object.values(value).some(v => contains(v, ids)) : false
export function deletionBlockers(s, table, id) {
  const scope = { table, id }, row = s[table]?.find(r => r._id === id)
  if (!row) return ['档案不存在']
  const references = []
  if (table !== 'houses') {
    if (s.houses.some(h => houseInSpace(h, scope))) references.push('房间')
    if (s.facilities.some(r => resourceInSpace(r, scope))) references.push('设施')
    if ((s.parking || []).some(r => resourceInSpace(r, scope))) references.push('车位')
    const child = { estates: ['buildings', '所属小区'], buildings: ['units', '所属楼栋'] }[table]
    if (child && s[child[0]].some(r => r[child[1]] === id)) references.push('下级结构节点')
  }
  if (table === 'houses') {
    if (s.applications.some(r => r._house === id)) references.push('房屋申请')
    if (s.relations.some(r => r._house === id)) references.push('人房关系')
    if (s.vehicles.some(r => r['关联房屋'] === id)) references.push('车辆')
    if (s.facilities.some(r => r['关联房屋'] === id)) references.push('关联设施')
  }
  if (contains(s.stage01, [id, row['房屋编号']].filter(Boolean))) references.push('收费、停车或工单业务')
  if (s.messages?.some(m => m._table === table && m._object === id)) references.push('关联业务记录')
  return [...new Set(references)]
}

export function spatialTree(s) {
  const nodes = new Map([['root', { title: s.spaceRootName || '大光路社区', key: 'root', table: 'root', id: '', expand: true, children: [] }]])
  for (const table of ['estates', 'buildings', 'units', 'houses']) for (const r of s[table] || []) {
    const parent = table === 'estates' ? 'root' : table === 'buildings' ? spaceKey('estates', r['所属小区']) : table === 'units' ? spaceKey('buildings', r['所属楼栋']) : spaceKey(r['所属单元'] ? 'units' : 'buildings', r['所属单元'] || r['所属楼栋'])
    const node = { title: spaceTitle(table, r), key: spaceKey(table, r._id), table, id: r._id, expand: true, children: [] }
    nodes.set(node.key, node)
    nodes.get(parent)?.children.push(node)
  }
  return [nodes.get('root')]
}
