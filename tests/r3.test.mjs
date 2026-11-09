import test from 'node:test'
import assert from 'node:assert/strict'
import {createSeed, execute, query, record, statistics, authorizeAttachment, display, optionsFor} from '../prototype-shared/core.js'
import {businessDate, spatialTree, upgradeProductState, personnelFromAccounts} from '../prototype-shared/r3-product.js'
import {previewImport, commitImport, importTemplate} from '../prototype-shared/import-houses.js'
const admin={app:'web',account:'platform-admin',role:'platform'}, property={app:'web',account:'property-admin',role:'property'}, resident={app:'resident',account:'resident-a',role:'resident'}
const save=(s,table,data,space,id)=>execute(s,admin,'save',{table,data,space,id})
const park=(s,space,number='0001')=>save(s,'parking',{车位编号:number,车位类型:'普通车位'},space)
const stats=(s,metric='设施类别',scopes=[{table:'root',id:''}],date=businessDate(),category='')=>statistics(s,admin,{metric,scopes,date,category})[0]
test('R3 W02 扁平树保留ID、有无单元、同号房间及原社区归属',()=>{
 const s=createSeed(),tree=spatialTree(s)[0];assert.deepEqual(tree.children.map(n=>n.key),['estates:E-A','estates:E-B']);assert(!JSON.stringify(tree).includes('communities:'));assert.equal(record(s,admin,'estates','E-B')['所属社区'],'C-B');assert.equal(s.houses.length,4)
})
test('R3 W02-04 人工来源自动带入；导入仍是台账来源且旧模板可读',()=>{
 const s=createSeed(),r=save(s,'houses',{所属小区:'E-A',所属楼栋:'B-N',房号:'006'});assert.equal(record(s,admin,'houses',r.id)['资料来源'],'人工维护');assert.equal(record(s,admin,'houses',r.id)['所属社区'],'C-A')
 for(const text of [importTemplate, '\uFEFF房屋编号,所属社区,所属小区,所属楼栋,所属单元,楼层,房号,房屋用途,房屋面积,资料来源,来源说明\r\n,青禾示例社区,青禾示例花园,01幢,1单元,3,0303,住宅,,台账导入,物业台账\r\n', '\uFEFF房屋编号,所属社区,所属小区,所属楼栋,所属单元,楼层,房号,房屋用途,房屋面积,资料来源,来源说明\r\n,C-A,E-A,B-N,,3,0306,住宅,,台账导入,物业台账\r\n']){
  const p=previewImport(s,admin,text,'物业台账');assert.equal(p['不通过行数'],0,JSON.stringify(p));commitImport(s,admin,text,'物业台账',p.revision)
 }
 assert.equal(s.houses.find(h=>h['房号']==='0303')['资料来源'],'台账导入')
})
test('R3 写入后来源说明不回退演示文案，维护人为实际操作者',()=>{
 const s=createSeed(),id=save(s,'houses',{所属小区:'E-A',所属楼栋:'B-N',房号:'0006'}).id
 let house=record(s,admin,'houses',id);assert.equal(house['维护人'],'平台管理员');assert.equal(house['来源说明'],'')
 execute(s,property,'save',{table:'houses',id,data:{...house,房号:'0007'}});house=record(s,property,'houses',id);assert.equal(house['维护人'],'物业管理员');assert.equal(house['来源说明'],'');assert.equal(house['资料来源'],'人工维护')
})
test('R3 W02-07 只归属楼栋或单元；旧设施保留并可明确定位且编号不变',()=>{
 const s=createSeed(),before=structuredClone(s.facilities);assert.equal(before[0]._spaceTable,'estates');assert.throws(()=>park(s,{table:'estates',id:'E-A'}),/楼栋或单元/)
 for(const space of [{table:'buildings',id:'B-N'},{table:'units',id:'U-A'}]){const p=park(s,space);assert.equal(record(s,admin,'parking',p.id)._spaceId,space.id)}
 const id=s.facilities[0]._id;save(s,'facilities',{...s.facilities[0],关联楼栋:'B-N'},{table:'buildings',id:'B-N'},id);assert.equal(s.facilities[0]._id,id);assert.equal(s.facilities[0]['点位编号'],before[0]['点位编号']);assert.equal(s.facilities[0]._spaceId,'B-N')
 assert.deepEqual(optionsFor(s,admin,'facilities','关联房屋',{所属小区:'E-A',关联楼栋:'B-N'}).map(r=>r.value),['H-N']);assert.deepEqual(optionsFor(s,admin,'facilities','关联房屋',{所属小区:'E-A',关联楼栋:'B-A',所属单元:'U-A'}).map(r=>r.value),['H-A','H-A2'])
})
test('R3 W02-05/12 删除检查全后代、下级结构、申请关系及Stage01引用',()=>{
 const s=createSeed();assert.throws(()=>execute(s,admin,'delete',{table:'estates',id:'E-A'}),/房间.*设施/);assert.throws(()=>execute(s,admin,'delete',{table:'houses',id:'H-A'}),/人房关系/);assert.throws(()=>execute(s,admin,'delete',{table:'houses',id:'H-A2'}),/房屋申请/)
 const h=save(s,'houses',{所属小区:'E-A',所属楼栋:'B-N',房号:'0900'}).id;s.stage01={bills:[{_house:h}]};assert.throws(()=>execute(s,admin,'delete',{table:'houses',id:h}),/收费、停车或工单/);s.stage01={};execute(s,admin,'delete',{table:'houses',id:h});assert(!s.houses.some(r=>r._id===h));assert(s.history.some(r=>r['操作名称']==='删除'))
 const b=save(s,'buildings',{所属小区:'E-A','楼栋名称／楼栋号':'空楼栋',是否设单元:'是'}).id,u=save(s,'units',{所属楼栋:b,'单元名称／单元号':'1单元'}).id;assert.throws(()=>execute(s,admin,'delete',{table:'buildings',id:b}),/下级结构/);execute(s,admin,'delete',{table:'units',id:u});execute(s,admin,'delete',{table:'buildings',id:b});assert(!s.buildings.some(r=>r._id===b));assert.throws(()=>execute(s,admin,'delete',{table:'root',id:''}),/不支持/)
})
test('R3 W03 多选并集、设施按档案条目去重、分类、删除更新及历史无数据',()=>{
 const s=createSeed();park(s,{table:'units',id:'U-A'});park(s,{table:'buildings',id:'B-N'},'0002');assert.equal(stats(s,'车位',[{table:'root',id:''},{table:'estates',id:'E-A'},{table:'units',id:'U-A'}]).数值,2)
 assert.equal(stats(s,'设施类别',undefined,undefined,'消防').数值,1);assert.equal(stats(s).数值,4);s.facilities[0]['数量']=500;assert.equal(stats(s).数值,4)
 execute(s,admin,'delete',{table:'parking',id:s.parking[0]._id});assert.equal(stats(s,'车位').数值,1);const historical=stats(s,'车位',undefined,'2020-01-01');assert.equal(historical.数值,null);assert.equal(historical.状态,'暂无该日期数据')
 for(const metric of ['人口','户数']){const r=stats(s,metric);assert.equal(r.数值,null);assert.equal(r.状态,'统计口径待确认')}
 assert.throws(()=>stats(s,'车位',undefined,'2026-02-30'),/有效统计日期/)
})
test('R3 W10 名录投影来自账号组织，原无账号名录不补账号，变更实时反映',()=>{
 const s=createSeed(),accounts=structuredClone(s.accounts),list=personnelFromAccounts(s);assert(list.some(r=>r._id==='property-admin'));assert(!list.some(r=>r._id==='P-A'));assert.deepEqual(s.accounts,accounts);s.accounts.find(a=>a._id==='property-admin')['所属组织']='';assert(!query(s,admin,'personnel').some(r=>r._id==='property-admin'));assert.throws(()=>save(s,'personnel',{人员姓名:'错误新增'}),/只能查看/)
})
test('R3 W11 简单文件编辑可替换当前附件、旧字节保留；物业默认可下载',()=>{
 const s=createSeed(),old=structuredClone(s.attachments),f=record(s,admin,'files','FILE-A');s.attachments.new={name:'制度修订.txt',text:'物业制度',type:'text/plain',size:12};save(s,'files',{...f,文件附件:'new'},undefined,f._id);assert.equal(authorizeAttachment(s,property,{table:'files',id:f._id,action:'download'}),'new');assert.deepEqual(s.attachments['seed-file-v1'],old['seed-file-v1'])
})
test('R3 X01 保留本人归属及绑定→审核→变更→解除一致性；不能读他人申请',()=>{
 const s=createSeed(),apply=kind=>execute(s,resident,'apply',{data:{_house:'H-N',申请类型:kind,申请关系类型:'业主',申请说明:'房屋关系办理'}});for(const kind of ['绑定','变更','解除']){const r=apply(kind);execute(s,property,'review',{id:r.id,decision:'通过'});assert.equal(record(s,resident,'applications',r.id)['申请状态'],'已通过');assert.throws(()=>record(s,{...resident,account:'resident-b'},'applications',r.id),/无权/)}assert(!query(s,resident,'relations').some(r=>r._house==='H-N'&&r['关系状态']==='有效'))
})
test('R3 兼容升级幂等并保持已有Stage01、Stage02文档无数据迁移副作用',()=>{
 const s=createSeed();delete s.productRevision;s.stage01={payments:[{_house:'H-A',amount:100}]};s.applications[0]._addressSnapshot='演示路10号 01幢 1单元 0102室';const before=structuredClone({stage01:s.stage01,houses:s.houses,applications:s.applications,relations:s.relations,attachments:s.attachments});upgradeProductState(s);assert.deepEqual({stage01:s.stage01,houses:s.houses,applications:s.applications,relations:s.relations,attachments:s.attachments},before);assert.equal(display(s,'applications','房屋地址',s.applications[0]._addressSnapshot),'青禾路10号 01幢 1单元 0102室');const after=structuredClone(s);assert.equal(upgradeProductState(s),false);assert.deepEqual(s,after)
})
