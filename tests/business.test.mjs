import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSeed,
  clone,
  execute,
  query,
  record,
  historyFor,
  dashboard,
  authorizeAttachment,
  fileVersions,
  validity,
  actorFor,
  optionsFor,
} from '../prototype-shared/core.js'
import { previewImport, commitImport, parseCSV, importTemplate } from '../prototype-shared/import-houses.js'
const resident = { app: 'resident', account: 'resident-a', role: 'resident' },
  audit = { app: 'web', account: 'audit', role: 'reviewer' },
  archive = { app: 'web', account: 'archive', role: 'maintainer' },
  staff = { app: 'staff', account: 'staff', role: 'query' },
  sensitive = { app: 'staff', account: 'sensitive', role: 'sensitive' },
  owner = { app: 'web', account: 'file-owner', role: 'file-manager' },
  reader = { app: 'web', account: 'file-reader', role: 'file-reader' },
  admin = { app: 'web', account: 'admin', role: 'config' }
const application = (house = 'H-A', type = '绑定') => ({
  data: { _house: house, 申请类型: type, 申请关系类型: '业主', 申请说明: '虚构本人申请，仅用于测试' },
})
function fixture() {
  let state = createSeed()
  return {
    get s() {
      return state
    },
    run(ctx, c, p) {
      const next = clone(state),
        result = execute(next, ctx, c, p)
      state = next
      return result
    },
  }
}
test('T01/T14 空间层级、前导零、无单元、未知面积及父停用', () => {
  const f = fixture()
  assert.equal(f.s.houses.find((r) => r._id === 'H-N')['房号'], '001')
  assert.equal(f.s.houses[0]['房屋面积'], '')
  assert.throws(
    () =>
      f.run(archive, 'save', { table: 'units', data: { 所属楼栋: 'B-N', '单元名称／单元号': '虚构单元' } }),
    /无单元/,
  )
  assert.throws(
    () =>
      f.run(archive, 'save', {
        table: 'houses',
        data: { 所属社区: 'C-A', 所属小区: 'E-A', 所属楼栋: 'B-N', 房号: '003', 房屋面积: 0 },
      }),
    /大于0/,
  )
  f.run(archive, 'status', { table: 'buildings', id: 'B-N', reason: '受控停用演示' })
  assert.throws(
    () =>
      f.run(archive, 'save', {
        table: 'houses',
        data: { 所属社区: 'C-A', 所属小区: 'E-A', 所属楼栋: 'B-N', 房号: '003' },
      }),
    /停用/,
  )
  assert.equal(f.s.houses.find((r) => r._id === 'H-N')['档案状态'], '启用')
})
test('T02/T03 按范围查询、上下文不授予权限、不同角色不无条件合并', () => {
  const f = fixture()
  assert.equal(query(f.s, staff, 'communities').length, 1)
  assert.throws(() => record(f.s, staff, 'houses', 'H-B'), /无权/)
  const ordinary = query(f.s, staff, 'residents')[0],
    allowed = query(f.s, sensitive, 'residents')[0]
  assert.match(ordinary['联系电话'], /\*\*\*\*/)
  assert.equal(allowed['联系电话'], '13900000001')
  assert.throws(() => query(f.s, admin, 'residents'), /无权/)
  assert.throws(() => actorFor(f.s, { ...resident, role: 'reviewer' }), /当前应用入口/)
})
test('T04/T06 审核生成正式关系且多端投影一致；重复提交或重复审核不重复创建', () => {
  const f = fixture(),
    app = f.run(resident, 'apply', application())
  assert.equal(query(f.s, audit, 'applications').find((r) => r._id === app.id)['申请状态'], '待审核')
  assert.throws(() => f.run(resident, 'apply', application()), /待审核/)
  f.run(audit, 'review', {
    id: app.id,
    decision: '通过',
    对外审核说明: '样例核验通过',
    operation: 'review-one',
  })
  f.run(audit, 'review', { id: app.id, decision: '通过', operation: 'review-one' })
  assert.throws(() => f.run(audit, 'review', { id: app.id, decision: '通过' }), /已变化/)
  assert.equal(query(f.s, resident, 'relations').filter((r) => r['关系状态'] === '有效').length, 1)
  assert.equal(query(f.s, staff, 'relations').filter((r) => r._resident === 'R-A').length, 1)
  assert.equal(query(f.s, resident, 'messages').length, 1)
  assert.equal(query(f.s, resident, 'houses').find((r) => r._id === 'H-A')['关联居民'].length, 0)
  assert.throws(() => f.run(resident, 'apply', application()), /有效关系/)
})
test('T05/T19/T20 驳回必填原因、重新提交保留轮次和旧证据、内部备注不对居民返回', () => {
  const f = fixture(),
    app = f.run(resident, 'apply', application())
  assert.throws(() => f.run(audit, 'review', { id: app.id, decision: '驳回' }), /必填/)
  f.run(audit, 'review', {
    id: app.id,
    decision: '驳回',
    对外审核说明: '请补充说明',
    内部审核备注: '不向居民公开',
  })
  assert.equal(record(f.s, resident, 'applications', app.id)['内部审核备注'], undefined)
  const next = f.run(resident, 'apply', { ...application(), previous: app.id })
  assert.equal(record(f.s, resident, 'applications', next.id)['审核轮次'], 2)
  assert.equal(record(f.s, resident, 'applications', app.id)['申请状态'], '已驳回')
  assert.ok(historyFor(f.s, resident, 'applications', app.id).every((h) => !h['变更前值'] && !h['变更后值']))
})
test('T07 解除审核只终止目标关系，驳回不影响当前关系和他人', () => {
  const f = fixture()
  const first = f.run(resident, 'apply', application())
  f.run(audit, 'review', { id: first.id, decision: '通过' })
  const rel = query(f.s, resident, 'relations')[0],
    end = f.run(resident, 'apply', application('H-A', '解除'))
  f.run(audit, 'review', { id: end.id, decision: '驳回', 对外审核说明: '补充解除原因' })
  assert.equal(record(f.s, resident, 'relations', rel._id)['关系状态'], '有效')
  const next = f.run(resident, 'apply', { ...application('H-A', '解除'), previous: end.id })
  f.run(audit, 'review', { id: next.id, decision: '通过' })
  assert.equal(record(f.s, resident, 'relations', rel._id)['关系状态'], '已解除')
  assert.equal(f.s.relations.find((r) => r._id === 'REL-B')['关系状态'], '有效')
  assert.equal(f.s.applications.find((r) => r._id === first.id)['申请状态'], '已通过')
})
test('T08 实际CSV解析、错误批次阻止、修正后导入、重复和过期预览', () => {
  const f = fixture(),
    text = importTemplate.replace('0202', '0303'),
    preview = previewImport(f.s, archive, text, '虚构导入来源')
  assert.equal(preview['导入处理状态'], '待确认导入')
  commitImport(f.s, archive, text, '虚构导入来源', preview.revision)
  assert.equal(f.s.houses.at(-1)['房号'], '0303')
  assert.equal(previewImport(f.s, archive, text, '同一来源')['不通过行数'], 1)
  assert.throws(() => commitImport(f.s, archive, text, '虚构导入来源', preview.revision), /变化/)
  const bad = previewImport(f.s, archive, importTemplate.replace('02幢', '不存在楼栋'), '虚构来源')
  assert.equal(bad['导入处理状态'], '校验未通过')
  assert.equal(parseCSV('a,b\n"含,逗号","含""引号"\n')[1][0], '含,逗号')
})
test('T09 离岗只禁用工作身份，无账号名录可建立，居民身份保留', {skip:'R3负责人取消人员维护、离岗及手工指标；历史断言保留，当前只读名录和自动统计见r3.test.mjs'}, () => {
  const f = fixture()
  const r = f.run(archive, 'save', {
    table: 'personnel',
    data: { 人员姓名: '无账号示例', 所属物业组织: 'ORG-A', 岗位: '客服' },
  })
  assert.equal(f.s.personnel.find((x) => x._id === r.id)['关联账号'], '')
  f.run(archive, 'status', { table: 'personnel', id: 'P-DUAL', date: '2026-11-04', reason: '离岗样例' })
  assert.throws(() => actorFor(f.s, { app: 'staff', account: 'dual', role: 'query' }), /离岗/)
  assert.equal(actorFor(f.s, { app: 'resident', account: 'dual', role: 'resident' }).resident, 'R-C')
})
test('T10 来源统计与档案去重分开，未知来源不伪造0', {skip:'R3负责人取消人员维护、离岗及手工指标；历史断言保留，当前只读名录和自动统计见r3.test.mjs'}, () => {
  const f = fixture(),
    counts = dashboard(f.s, archive).counts
  assert.equal(counts['居民档案人数'], 3)
  assert.equal(f.s.statistics.length, 0)
  f.run(archive, 'save', {
    table: 'statistics',
    data: {
      统计范围: 'C-A',
      指标名称: '人口',
      指标数值: 0,
      统计口径说明: '权威提供方明确为零的虚构样例',
      统计日期: '2026-11-01',
      数据来源: '虚构台账',
      提供单位: '示例单位',
    },
  })
  assert.equal(f.s.statistics[0]['计量单位'], '人')
  assert.equal(f.s.statistics[0]['指标数值'], 0)
})
test('T11 车辆规范化、本人重复返回、他人冲突不泄露、核实及解绑不注销', () => {
  const f = fixture(),
    d = { 车牌号码: ' 苏Ademo3 ', 车辆类型: '小型汽车（样例）' }
  const car = f.run(resident, 'save', { table: 'vehicles', data: d })
  assert.equal(f.s.vehicles.find((r) => r._id === car.id)['车牌号码'], '苏ADEMO3')
  const again = f.run(resident, 'save', { table: 'vehicles', data: d })
  assert.equal(again.id, car.id)
  assert.throws(
    () => f.run(resident, 'save', { table: 'vehicles', data: { 车牌号码: '苏A32018' } }),
    (e) => e.message.includes('需进一步核实') && !e.message.includes('周'),
  )
  f.run(archive, 'verifyVehicle', { id: car.id, decision: '退回', feedback: '请核对资料' })
  assert.equal(record(f.s, resident, 'vehicles', car.id)['核实状态'], '已退回')
})
test('T12 数量未知与0分开，单位条件必填，点位不推导设备在线', () => {
  const f = fixture()
  assert.equal(f.s.facilities[0]['数量'], '')
  assert.equal(f.s.facilities[0]['接入状态'], '未接入')
  assert.throws(
    () =>
      f.run(archive, 'save', {
        table: 'facilities',
        data: { 点位名称: '数量例', 点位类别: '消防', 所属社区: 'C-A', 所属小区: 'E-A', 关联楼栋: 'B-N', 具体位置: '示例位置', 数量: 2 },
      }),
    /必填/,
  )
  const r = f.run(archive, 'save', {
    table: 'facilities',
    data: {
      点位名称: '数量例',
      点位类别: '消防',
      所属社区: 'C-A',
      所属小区: 'E-A',
      关联楼栋: 'B-N',
      具体位置: '示例位置',
      数量: 2,
      数量单位: '个',
    },
  })
  assert.equal(f.s.facilities.find((x) => x._id === r.id)['接入状态'], '未接入')
})
test('T13 文件版本和字节授权分开，失败不增加版本，无日期无提醒', () => {
  const f = fixture()
  assert.equal(
    authorizeAttachment(f.s, reader, { table: 'files', id: 'FILE-A', action: 'view' }),
    'seed-file-v1',
  )
  assert.throws(
    () => authorizeAttachment(f.s, reader, { table: 'files', id: 'FILE-A', action: 'download' }),
    /下载权限/,
  )
  assert.throws(
    () => f.run(owner, 'fileVersion', { id: 'FILE-A', blob: 'none', reason: '新版本', fail: true }),
    /失败/,
  )
  assert.equal(fileVersions(f.s, reader, 'FILE-A').length, 1)
  f.s.attachments['v2'] = { name: '版本2.txt', size: 10, type: 'text/plain', text: '虚构V2' }
  f.run(owner, 'fileVersion', { id: 'FILE-A', blob: 'v2', reason: '样例内容更新' })
  assert.equal(fileVersions(f.s, reader, 'FILE-A').length, 2)
  assert.equal(
    authorizeAttachment(f.s, owner, { table: 'files', id: 'FILE-A', version: 'V1', action: 'download' }),
    'seed-file-v1',
  )
  assert.throws(() => f.run(owner, 'remind', { id: 'FILE-A' }), /未启用/)
})
test('T14 地址编辑保留稳定引用与申请快照，迁移受阻', () => {
  const f = fixture(),
    app = f.run(resident, 'apply', application()),
    snapshot = record(f.s, resident, 'applications', app.id)['房屋地址']
  const h = clone(f.s.houses.find((r) => r._id === 'H-A'))
  h['房号'] = '0103'
  f.run(archive, 'save', { table: 'houses', id: 'H-A', data: h })
  assert.equal(record(f.s, resident, 'applications', app.id)['房屋地址'], snapshot)
  assert.equal(f.s.houses.find((r) => r._id === 'H-A')['房屋编号'], 'H-A')
  const current = clone(f.s.houses.find((r) => r._id === 'H-A'))
  assert.throws(
    () =>
      f.run(archive, 'save', {
        table: 'houses',
        id: 'H-A',
        data: { ...current, 所属楼栋: 'B-N', 所属单元: '' },
      }),
    /迁移/,
  )
})
test('T15 消息按接收身份隔离，已读不等于模拟发送成功', () => {
  const f = fixture(),
    app = f.run(resident, 'apply', application())
  f.run(audit, 'review', { id: app.id, decision: '通过' })
  const m = query(f.s, resident, 'messages')[0]
  assert.equal(m['模拟发送状态'], '待处理')
  f.run(resident, 'messageRead', { id: m._id })
  assert.equal(record(f.s, resident, 'messages', m._id)['模拟发送状态'], '待处理')
  f.run(resident, 'messageSend', { id: m._id, failed: true })
  assert.equal(record(f.s, resident, 'messages', m._id)['模拟发送状态'], '模拟失败')
  assert.equal(query(f.s, { ...resident, account: 'resident-b' }, 'messages').length, 0)
})
test('T19 有效期日期顺序、可查与可下载角色子集、组织循环校验', () => {
  const f = fixture()
  assert.equal(validity({ 生效日期: '2027-01-01' }, '2026-11-04'), '未生效')
  assert.throws(
    () =>
      f.run(resident, 'apply', {
        data: {
          ...application().data,
          _validity: true,
          申请有效起始日: '2026-11-04',
          申请有效结束日: '2026-01-01',
        },
      }),
    /不得早于/,
  )
  assert.throws(
    () => f.run(admin, 'save', { table: 'orgs', id: 'ORG-A', data: { ...f.s.orgs[0], 上级组织: 'ORG-A' } }),
    /循环/,
  )
})
test('T20 撤回与审核冲突只保留一个合法终态', () => {
  const f = fixture(),
    r = f.run(resident, 'apply', application())
  f.run(resident, 'withdraw', { id: r.id })
  assert.throws(() => f.run(audit, 'review', { id: r.id, decision: '通过' }), /已变化/)
  assert.equal(query(f.s, resident, 'relations').length, 0)
})
test('T20 停用账号和权限撤回即刻生效', () => {
  const f = fixture()
  f.run(admin, 'status', { table: 'accounts', id: 'staff', reason: '演示停用' })
  assert.throws(() => query(f.s, staff, 'houses'), /身份不可用/)
})
test('T18 保留23表287行历史基线；R1定义295行及R3新增账号手机号，全部表单字段有定义', async () => {
  const { catalog } = await import('../prototype-shared/catalog.js')
  const { readFileSync } = await import('node:fs')
  const old = JSON.parse(readFileSync(new URL('../docs/stages/stage-00/evidence/field-baseline.json', import.meta.url)))
  assert.equal(old.length, 23)
  assert.equal(old.reduce((n,t)=>n+t.rows.length,0),287)
  assert.equal(Object.keys(catalog).length, 24)
  assert.equal(
    Object.values(catalog).reduce((n, t) => n + t.fields.length, 0),
    296,
  )
  assert.equal(Object.entries(catalog).reduce((n,[table,t])=>n+t.fields.filter(f=>!(table==='accounts'&&f.name==='手机号')).length,0),295)
  for (const t of Object.values(catalog))
    for (const name of t.form)
      assert.ok(
        t.fields.some((f) => f.name === name),
        t.key + ':' + name,
      )
})
test('T19 绑定说明可空、有效期结束日可空、联系号码必填，日期拒绝非法值', () => {
  const f = fixture()
  const r = f.run(resident, 'apply', {
    data: {
      _house: 'H-A',
      申请类型: '绑定',
      申请关系类型: '业主',
      _validity: true,
      申请有效起始日: '2026-01-01',
    },
  })
  assert.equal(record(f.s, resident, 'applications', r.id)['申请有效结束日'], '')
  assert.throws(
    () =>
      f.run(resident, 'apply', {
        data: {
          _house: 'H-A2',
          申请类型: '绑定',
          申请关系类型: '业主',
          _validity: true,
          申请有效起始日: '2026-02-30',
        },
      }),
    /有效日期/,
  )
  const other = fixture()
  other.run(resident, 'profile', { data: { 姓名: '', 手机号: '' } })
  assert.throws(() => other.run(resident, 'apply', application()), /姓名/)
})
test('T02/T09/T23 同一账号在住户与管理App仅可使用对应身份', () => {
  const f = fixture()
  assert.equal(actorFor(f.s, { app: 'resident', account: 'dual' }).role, 'resident')
  assert.equal(actorFor(f.s, { app: 'staff', account: 'dual' }).role, 'query')
  assert.throws(() => actorFor(f.s, { app: 'resident', account: 'dual', role: 'query' }), /当前应用入口/)
})
test('T08 含引号和多行文本的CSV保留原文件物理行号', () => {
  const text = 'a,b\n"含\n换行",x\ny,z\n',
    rows = parseCSV(text)
  assert.equal(rows[1]._line, 2)
  assert.equal(rows[2]._line, 4)
})
test('T13 种子附件大小匹配真实虚构字节；文件提醒保持可选', () => {
  const s = createSeed()
  assert.equal(s.files[0]['文件大小'], Buffer.byteLength(s.attachments['seed-file-v1'].text, 'utf8'))
  assert.equal(validity(s.files[0]), '未设置')
})
test('T19 到期样例不再进入有效关系和关联居民投影', () => {
  const f = fixture()
  f.s.relations.find((r) => r._id === 'REL-B')['有效结束日'] = '2000-01-01'
  const r = query(f.s, staff, 'relations').find((r) => r._id === 'REL-B')
  assert.equal(r['关系状态'], '已到期')
  assert.equal(f.s.houses.find((r) => r._id === 'H-A')['关联居民'].length, 0)
})
test('T02/T20 社区授权不隐式授予全部小区，空小区清单返回无权', () => {
  const f = fixture()
  f.s.accounts.find((a) => a._id === 'staff')['可查看小区'] = []
  assert.equal(query(f.s, staff, 'houses').length, 0)
  assert.equal(query(f.s, staff, 'estates').length, 0)
  assert.equal(query(f.s, staff, 'relations').length, 0)
  assert.throws(() => record(f.s, staff, 'houses', 'H-A'), /无权/)
  const actor = f.s.accounts.find((a) => a._id === 'staff')
  assert.throws(
    () =>
      f.run(admin, 'save', {
        table: 'accounts',
        id: 'staff',
        data: {
          ...actor,
          可查看社区: ['C-NOT-IN-PROJECT'],
          可查看小区: [],
          授权变更原因: '测试未建档范围赋权',
        },
      }),
    /不能授予/,
  )
})
test('T09/T13/T20 人员重要变更和文件权限修改必须有本次原因', {skip:'R3负责人取消人员维护、离岗及手工指标；历史断言保留，当前只读名录和自动统计见r3.test.mjs'}, () => {
  const f = fixture(),
    person = clone(f.s.personnel.find((p) => p._id === 'P-A'))
  person['岗位'] = '新岗位（样例）'
  assert.throws(() => f.run(archive, 'save', { table: 'personnel', id: person._id, data: person }), /必填/)
  person['变更说明'] = '有依据的岗位调整样例'
  f.run(archive, 'save', { table: 'personnel', id: person._id, data: person })
  assert.equal(f.s.history.at(-1)['操作说明／原因'], '有依据的岗位调整样例')
  const file = clone(f.s.files[0])
  file['可下载角色'] = []
  assert.throws(() => f.run(owner, 'save', { table: 'files', id: file._id, data: file }), /必填/)
  f.run(owner, 'save', { table: 'files', id: file._id, data: file, reason: '收回下载权限的样例依据' })
  assert.equal(f.s.history.at(-1)['操作说明／原因'], '收回下载权限的样例依据')
})
test('T01/T02 新社区小区保存后由演示配置动作显式授权，不从上下文自动继承', () => {
  const f = fixture(),
    c = f.run(archive, 'save', {
      table: 'communities',
      data: { 社区名称: '新增虚构社区', 社区地址: '虚构地址3号' },
    }).id
  assert.throws(() => record(f.s, archive, 'communities', c), /无权/)
  let account = clone(f.s.accounts.find((r) => r._id === 'archive'))
  account['可查看社区'].push(c)
  account['授权变更原因'] = '演示明确授予新增社区'
  f.run(admin, 'save', { table: 'accounts', id: account._id, data: account })
  assert.equal(record(f.s, archive, 'communities', c)['社区名称'], '新增虚构社区')
  const e = f.run(archive, 'save', {
    table: 'estates',
    data: { 小区名称: '新增虚构小区', 所属社区: c, 小区地址: '虚构路4号' },
  }).id
  assert.equal(
    query(f.s, archive, 'estates').some((r) => r._id === e),
    false,
  )
  account = clone(f.s.accounts.find((r) => r._id === 'archive'))
  account['可查看小区'].push(e)
  account['授权变更原因'] = '演示明确授予新增小区'
  f.run(admin, 'save', { table: 'accounts', id: account._id, data: account })
  assert.equal(record(f.s, archive, 'estates', e)['小区名称'], '新增虚构小区')
})
test('T09/T19 离岗操作拒绝非法日期并保留原工作身份', {skip:'R3负责人取消人员维护、离岗及手工指标；历史断言保留，当前只读名录和自动统计见r3.test.mjs'}, () => {
  const f = fixture()
  assert.throws(
    () =>
      f.run(archive, 'status', {
        table: 'personnel',
        id: 'P-DUAL',
        date: 'not-a-date',
        reason: '虚构离岗测试',
      }),
    /有效日期/,
  )
  assert.equal(actorFor(f.s, { app: 'staff', account: 'dual', role: 'query' }).role, 'query')
})
