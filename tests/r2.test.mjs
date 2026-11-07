import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeed, execute, query, record, dashboard, authorizeAttachment } from '../prototype-shared/core.js'
import { previewImport, commitImport, importTemplate, importColumns } from '../prototype-shared/import-houses.js'

const platform = {app:'web',account:'platform-admin',role:'platform'}
const property = {app:'web',account:'property-admin',role:'property'}
const resident = {app:'resident',account:'resident-a',role:'resident'}
const scope = (table,id) => ({_space:{table,id}})
const ids = rows => rows.map(r=>r._id).sort()
function resource(s,table,parent,id,code){return execute(s,platform,'save',{table,space:{table:parent,id},data:table==='parking'?{车位编号:code,车位类型:'其他（演示候选）'}:{点位名称:code,点位类别:'消防',具体位置:'虚构北侧',资料来源:'人工维护'}}).id}
function house(s,building,number,unit=''){return execute(s,platform,'save',{table:'houses',data:{所属社区:'C-A',所属小区:'E-A',所属楼栋:building,所属单元:unit,房号:number,房屋用途:'住宅',资料来源:'人工维护'}}).id}

test('R2-06 社区、小区、楼栋、单元、房间查询全部末级房间，且不返回中间节点',()=>{
 const s=createSeed()
 for(const [t,id,expected]of [['communities','C-A',['H-A','H-A2','H-N']],['estates','E-A',['H-A','H-A2','H-N']],['buildings','B-A',['H-A','H-A2']],['buildings','B-N',['H-N']],['units','U-A',['H-A','H-A2']],['houses','H-A',['H-A']]])assert.deepEqual(ids(query(s,platform,'houses',scope(t,id))),expected.sort())
 assert.equal(new Set(query(s,platform,'houses',scope('communities','C-A')).map(h=>h._id)).size,3)
})
test('R2-07 小区汇总直属和下属楼栋设施车位，楼栋只查自身，单元房间为空',()=>{
 const s=createSeed()
 for(const t of ['facilities','parking']){
  const estate=resource(s,t,'estates','E-A','R2-E-'+t),building=resource(s,t,'buildings','B-N','R2-B-'+t),outside=resource(s,t,'estates','E-B','R2-X-'+t)
  const inEstate=ids(query(s,platform,t,scope('estates','E-A')))
  assert(inEstate.includes(estate)&&inEstate.includes(building));assert(!inEstate.includes(outside))
  assert.deepEqual(ids(query(s,platform,t,scope('buildings','B-N'))),[building]);assert.equal(query(s,platform,t,scope('units','U-A')).length,0);assert.equal(query(s,platform,t,scope('houses','H-A')).length,0)
  assert.deepEqual(ids(query(s,platform,t,scope('communities','C-A'))),inEstate)
 }
})
test('R2-06/07 Mock在查询层拒绝无权和不存在的空间，不只靠页面隐藏',()=>{
 const s=createSeed();resource(s,'parking','estates','E-B','R2-X');resource(s,'facilities','estates','E-B','R2-XF')
 for(const t of ['houses','facilities','parking']){
  assert.throws(()=>query(s,property,t,scope('estates','E-B')),/无权/)
  assert.throws(()=>query(s,property,t,scope('buildings','missing')),/不存在|未找到/)
  assert(query(s,property,t,scope('root','')).every(r=>r['所属小区']!=='E-B'))
 }
})
test('R2-08 不同楼栋同名房间保持独立引用，范围结果不按房号去重',()=>{
 const s=createSeed(),id=house(s,'B-N','0101')
 const matches=query(s,platform,'houses',scope('communities','C-A')).filter(h=>h['房号']==='0101')
 assert.equal(matches.length,2);assert.equal(new Set(matches.map(h=>h._id)).size,2);assert.notEqual(record(s,platform,'houses',id)['完整房屋地址'],record(s,platform,'houses','H-A')['完整房屋地址']);assert(!record(s,platform,'houses',id)['所属单元'])
})
test('R2-03/09 同级、下级复用保存逻辑，有单元必须选实际单元，无单元不建假节点',()=>{
 const s=createSeed(),before=s.units.length
 const r=house(s,'B-N','0009');assert.equal(record(s,platform,'houses',r)['所属楼栋'],'B-N');assert.equal(s.units.length,before)
 assert.throws(()=>house(s,'B-A','0009'),e=>e.fields?.['所属单元']==='请填写或选择所属单元')
 const u=execute(s,platform,'save',{table:'units',data:{所属楼栋:'B-A','单元名称／单元号':'2单元',资料来源:'人工维护'}}).id
 const h=house(s,'B-A','0009',u);assert.equal(record(s,platform,'houses',h)['所属单元'],u)
 assert.throws(()=>execute(s,platform,'save',{table:'units',data:{所属楼栋:'B-N','单元名称／单元号':'非法单元',资料来源:'人工维护'}}),/无单元/)
})
test('R2-04 停用父级可查历史，禁止新增；子孙和既有编号不级联改变，重新启用可恢复',()=>{
 const s=createSeed(),app=execute(s,resident,'apply',{data:{_house:'H-A',申请类型:'绑定',申请关系类型:'业主'}})
 execute(s,property,'review',{id:app.id,decision:'通过'});const applications=structuredClone(s.applications),relations=structuredClone(s.relations),messages=structuredClone(s.messages),before=query(s,platform,'houses',scope('buildings','B-A')).map(h=>[h._id,h['房屋编号'],h['档案状态']])
 execute(s,platform,'status',{table:'buildings',id:'B-A',reason:'R2停用保护'})
 assert.deepEqual(query(s,platform,'houses',scope('buildings','B-A')).map(h=>[h._id,h['房屋编号'],h['档案状态']]),before)
 assert.throws(()=>house(s,'B-A','9999','U-A'),/停用/);assert.throws(()=>resource(s,'parking','buildings','B-A','R2-DISABLED'),/停用/)
 assert.deepEqual(s.applications,applications);assert.deepEqual(s.relations,relations);assert.deepEqual(s.messages,messages)
 execute(s,platform,'status',{table:'buildings',id:'B-A',reason:'R2重新启用'});assert.equal(record(s,platform,'buildings','B-A')['档案状态'],'启用');assert.equal(query(s,platform,'houses',scope('buildings','B-A')).length,2)
})
test('R2-07 历史社区直属设施保留原编号，社区查看可见，但不迁移到小区',()=>{
 const s=createSeed(),f=s.facilities[0];f._spaceTable='communities';f._spaceId='C-A';f['所属小区']='';f['关联楼栋']='';const original=f['点位编号']
 assert(query(s,platform,'facilities',scope('communities','C-A')).some(r=>r._id===f._id));assert(!query(s,platform,'facilities',scope('estates','E-A')).some(r=>r._id===f._id));assert.equal(record(s,platform,'facilities',f._id)['点位编号'],original)
})
test('R2-09 独立资源新增不增加房屋和人口统计，非法归属仍拒绝',()=>{
 const s=createSeed(),before=dashboard(s,platform).counts
 resource(s,'parking','estates','E-A','R2-PARK');resource(s,'facilities','buildings','B-N','R2-FAC');assert.deepEqual(dashboard(s,platform).counts,before)
 resource(s,'parking','units','U-A','R2-UNIT');assert.deepEqual(dashboard(s,platform).counts,before)
 for(const [t,id] of [['communities','C-A'],['houses','H-A']])assert.throws(()=>resource(s,'parking',t,id,'R2-ILLEGAL'),/只能在小区.*楼栋.*单元/)
})
test('R2-11 上级汇总查询下导入成功同步末级房屋，保留前导零及整批错误保护',()=>{
 const s=createSeed(),text=importTemplate.replace('\r\n,青禾','\r\n0000202,青禾'),before=query(s,platform,'houses',scope('communities','C-A')).length,p=previewImport(s,platform,text,'R2虚构来源',{table:'communities',id:'C-A'})
 assert.equal(p['不通过行数'],0);commitImport(s,platform,text,'R2虚构来源',p.revision,{table:'communities',id:'C-A'});assert.equal(query(s,platform,'houses',scope('estates','E-A')).length,before+1);assert(query(s,platform,'houses',scope('buildings','B-N')).some(h=>h['房屋编号']==='0000202'&&h['房号']==='0202'))
 const n=s.houses.length,retry=previewImport(s,platform,text,'R2虚构来源',{table:'estates',id:'E-A'});assert.equal(retry['不通过行数'],1);assert.throws(()=>commitImport(s,platform,text,'R2虚构来源',retry.revision,{table:'estates',id:'E-A'}),/整批未写入/);assert.equal(s.houses.length,n)
 const wrong=previewImport(s,platform,text.replace('0000202','0000203').replace(',0202,',',0203,'),'R2虚构来源',{table:'buildings',id:'B-A'});assert.equal(wrong['不通过行数'],1);assert.match(wrong.rows[0]['错误原因'].join(),/范围不一致/)
})
test('R2-11 有单元、缺上级及非法数值的混合批次不留下半批',()=>{
 const s=createSeed(),text='\uFEFF'+importColumns.join(',')+'\r\n,青禾示例社区,青禾示例花园,01幢,1单元,3,0303,住宅,,台账导入,R2\r\n,青禾示例社区,青禾示例花园,不存在,,3,0304,住宅,坏数值,台账导入,R2\r\n',n=s.houses.length,p=previewImport(s,platform,text,'R2虚构来源',{table:'communities',id:'C-A'})
 assert.equal(p['通过行数'],1);assert.equal(p['不通过行数'],1);assert.throws(()=>commitImport(s,platform,text,'R2虚构来源',p.revision,{table:'communities',id:'C-A'}),/整批未写入/);assert.equal(s.houses.length,n)
})
test('R2-12 物业审核、本人消息、文件可查不可下载与管理端只读保持',()=>{
 const s=createSeed(),app=execute(s,resident,'apply',{data:{_house:'H-N',申请类型:'绑定',申请关系类型:'租户'}});execute(s,property,'review',{id:app.id,decision:'通过',内部审核备注:'R2内部备注'})
 assert.equal(record(s,resident,'applications',app.id)['申请状态'],'已通过');assert(!('内部审核备注' in record(s,resident,'applications',app.id)));assert(query(s,resident,'messages').length>0)
 assert.throws(()=>record(s,{...resident,account:'resident-b'},'applications',app.id),/无权/);const reader={app:'web',account:'file-reader',role:'file-reader'};assert.equal(authorizeAttachment(s,reader,{table:'files',id:'FILE-A',action:'view'}),'seed-file-v1');assert.throws(()=>authorizeAttachment(s,reader,{table:'files',id:'FILE-A',action:'download'}),/下载权限/)
 assert.throws(()=>execute(s,{...property,app:'staff'},'save',{table:'parking',space:{table:'estates',id:'E-A'},data:{车位编号:'STAFF',车位类型:'其他（演示候选）'}}),/操作权限/)
})
