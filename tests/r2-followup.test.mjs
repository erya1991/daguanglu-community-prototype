import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeed, actorFor, execute, query, record, authorizeAttachment, optionsFor, tableOrder } from '../prototype-shared/core.js'

const admin={app:'web',account:'platform-admin',role:'platform'}, property={app:'web',account:'property-admin',role:'property'}, resident={app:'resident',account:'resident-a',role:'resident'}
const save=(s,table,data,space,id)=>execute(s,admin,'save',{table,data,space,id})
const resource=(s,table,space,code)=>save(s,table,table==='parking'?{车位编号:code,车位类型:'其他（演示候选）'}:{点位名称:code,点位类别:'充电',具体位置:'虚构单元门厅',资料来源:'人工维护'},space)
const scope=(table,id)=>({_space:{table,id}})

test('补充F01 平台全后台管理及敏感权限动态覆盖新组织空间，R3物业默认全范围且夹具独立',()=>{
 const s=createSeed(),a=actorFor(s,admin)
 for(const t of tableOrder){assert(a.menus.includes(t));assert(a.permissions.includes('read:'+t))}
 for(const key of ['phone','proof','export'])assert(a.sensitive.includes(key))
 const c=save(s,'communities',{社区名称:'新演示社区',社区地址:'虚构新社区'}).id
 const e=save(s,'estates',{小区名称:'新演示小区',所属社区:c,小区地址:'虚构新小区'}).id
 const b=save(s,'buildings',{所属小区:e,'楼栋名称／楼栋号':'01栋',是否设单元:'否'}).id
 const h=save(s,'houses',{所属社区:c,所属小区:e,所属楼栋:b,房号:'0001'}).id
 assert(query(s,admin,'houses').some(r=>r._id===h));assert.equal(record(s,admin,'communities',c)['社区名称'],'新演示社区')
 assert(optionsFor(s,admin,'houses','所属小区',{所属社区:c}).some(r=>r.value===e))
 const p=s.accounts.find(r=>r._id==='property-admin');p['可查看小区']=[]
 assert(query(s,property,'houses').some(r=>r._id===h));assert.throws(()=>record(s,{app:'web',account:'archive',role:'maintainer'},'houses',h),/无权/)
})
test('补充F01 平台查看下载所有既有文件版本，不顺带开放受限账号',()=>{
 const s=createSeed(),f=s.files.find(r=>r._id==='FILE-A')
 for(const v of [f,...f._versions]){v['可查阅角色']=['file-reader'];v['可下载角色']=['file-manager']}
 for(const action of ['view','download'])assert.equal(authorizeAttachment(s,admin,{table:'files',id:f._id,action}),'seed-file-v1')
 assert.throws(()=>authorizeAttachment(s,{app:'web',account:'file-reader',role:'file-reader'},{table:'files',id:f._id,action:'download'}),/下载权限/)
})
test('补充F03 根名称只改汇总容器，不重命名社区或关系，非平台不能修改',()=>{
 const s=createSeed(),before=structuredClone({communities:s.communities,houses:s.houses,relations:s.relations})
 execute(s,admin,'space-root',{name:'  大光路社区演示  '});assert.equal(s.spaceRootName,'大光路社区演示')
 assert.deepEqual({communities:s.communities,houses:s.houses,relations:s.relations},before)
 assert.throws(()=>execute(s,property,'space-root',{name:'越权'}),/权限|平台/)
 for(const name of [' ','超'.repeat(31)])assert.throws(()=>execute(s,admin,'space-root',{name}),/名称|字符/)
 assert.equal(s.spaceRootName,'大光路社区演示')
})
test('补充F07 单元资源实际归属，社区小区楼栋聚合且不同单元不混入',()=>{
 const s=createSeed(),u2=save(s,'units',{所属楼栋:'B-A','单元名称／单元号':'2单元'}).id
 for(const t of ['facilities','parking']){
  const own=resource(s,t,{table:'units',id:'U-A'},'FU-0001-'+t).id,other=resource(s,t,{table:'units',id:u2},'FU-0001-'+t).id
  const r=record(s,admin,t,own)
  assert.equal(r._spaceTable,'units');assert.equal(r._spaceId,'U-A');assert.equal(r['所属单元'],'U-A');assert.equal(r['关联楼栋'],'B-A');assert.equal(r['所属社区'],'C-A');assert.equal(r['所属小区'],'E-A')
  for(const [parent,id]of [['communities','C-A'],['estates','E-A'],['buildings','B-A']]){const ids=query(s,admin,t,scope(parent,id)).map(r=>r._id);assert(ids.includes(own)&&ids.includes(other));assert.equal(ids.filter(id=>id===own).length,1)}
  assert.deepEqual(query(s,admin,t,scope('units','U-A')).map(r=>r._id),[own]);assert.equal(query(s,admin,t,scope('houses','H-A')).length,0)
 }
})
test('补充F07 单元资源保留独立ID和旧归属，R3可明确重新定位，房屋统计不变',()=>{
 const s=createSeed(),before=structuredClone({houses:s.houses,relations:s.relations}),r=resource(s,'parking',{table:'units',id:'U-A'},'00009')
 const p=record(s,admin,'parking',r.id);save(s,'parking',{...p,备注:'位置补充'},undefined,p._id)
 const after=record(s,admin,'parking',r.id);assert.equal(after['车位编号'],'00009');assert.equal(after._spaceId,'U-A')
 save(s,'parking',{...after}, {table:'buildings',id:'B-A'},r.id);assert.equal(record(s,admin,'parking',r.id)._spaceId,'B-A')
 assert.deepEqual({houses:s.houses,relations:s.relations},before)
})
test('补充F07 祖先停用、非法空间和关联房屋越单元仍拒绝',()=>{
 const s=createSeed()
 for(const table of ['communities','houses'])assert.throws(()=>resource(s,'parking',{table,id:table==='houses'?'H-A':'C-A'},'非法'),/楼栋或单元/)
 assert.throws(()=>save(s,'facilities',{点位名称:'不匹配',点位类别:'消防',具体位置:'虚构',关联房屋:'H-N'},{table:'units',id:'U-A'}),/房屋|范围|单元/)
 execute(s,admin,'status',{table:'units',id:'U-A',reason:'单元停用保护'})
 assert.throws(()=>resource(s,'parking',{table:'units',id:'U-A'},'停用'),/停用/)
 assert.equal(s.units.find(r=>r._id==='U-A')['档案状态'],'停用')
})
test('补充F06 房间在不同上级上下文同一保存规则，单元楼必须选实际单元',()=>{
 const s=createSeed();assert.throws(()=>save(s,'houses',{所属社区:'C-A',所属小区:'E-A',所属楼栋:'B-A',房号:'0900'}),e=>e.fields?.['所属单元']==='请填写或选择所属单元')
 const unit=save(s,'houses',{所属社区:'C-A',所属小区:'E-A',所属楼栋:'B-A',所属单元:'U-A',房号:'0900'}).id
 const direct=save(s,'houses',{所属社区:'C-A',所属小区:'E-A',所属楼栋:'B-N',房号:'0900'}).id
 assert.equal(record(s,admin,'houses',unit)['所属单元'],'U-A');assert(!record(s,admin,'houses',direct)['所属单元'])
 const r=execute(s,resident,'apply',{data:{_house:unit,申请类型:'绑定',申请关系类型:'业主'}})
 execute(s,admin,'review',{id:r.id,decision:'通过',对外审核说明:'平台演示核验'})
 assert.equal(record(s,resident,'applications',r.id)['申请状态'],'已通过')
 assert.throws(()=>execute(s,{...property,app:'staff'},'review',{id:r.id,decision:'通过'}),/操作权限|状态已变化/)
})
