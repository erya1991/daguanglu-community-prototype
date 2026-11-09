import test from 'node:test'
import assert from 'node:assert/strict'
import {createSeed,execute,query,record} from '../prototype-shared/core.js'
import {countSpaceResources,personnelFromAccounts,upgradeProductState,productMenus,publicField} from '../prototype-shared/r3-product.js'
const admin={app:'web',account:'platform-admin',role:'platform'}

test('R3复验 页签统计按所选节点汇总全部资源，去重且不受分页影响',()=>{
 const s=createSeed(),before=structuredClone(s.houses)
 assert.deepEqual(countSpaceResources(s,{table:'root'}),{houses:4,facilities:4,parking:0})
 const result=execute(s,admin,'save',{table:'parking',space:{table:'units',id:'U-A'},data:{车位编号:'0099',车位类型:'普通车位'}})
 assert.equal(countSpaceResources(s,{table:'units',id:'U-A'}).parking,1)
 assert.equal(countSpaceResources(s,{table:'buildings',id:'B-A'}).parking,1)
 assert.equal(countSpaceResources(s,{table:'estates',id:'E-B'}).parking,0)
 const duplicated={...s,parking:[...s.parking,...s.parking]}
 assert.equal(countSpaceResources(duplicated,{table:'root'}).parking,1)
 assert.deepEqual(countSpaceResources(s,{table:'houses',id:'H-A'}),{houses:1,facilities:0,parking:0})
 execute(s,admin,'delete',{table:'parking',id:result.id})
 assert.equal(countSpaceResources(s,{table:'units',id:'U-A'}).parking,0)
 assert.deepEqual(s.houses,before)
})

test('R3复验 模拟用户及物业名录都有手机号；升级保留已有号码，不给未知账号编号码',()=>{
 const s=createSeed()
 assert(s.accounts.every(a=>/^1[3-9]\d{9}$/.test(a['手机号'])))
 assert(personnelFromAccounts(s).every(p=>/^1[3-9]\d{9}$/.test(p['工作联系电话'])))
 const property=s.accounts.find(a=>a._id==='property-admin')
 property['手机号']='13800001234'
 s.accounts.push({_id:'unknown-account',人员姓名:'未补齐资料',所属组织:'ORG-A',_apps:['web']})
 upgradeProductState(s)
 assert.equal(property['手机号'],'13800001234')
 assert.equal(s.accounts.at(-1)['手机号'],undefined)
 delete property['手机号']
 assert.equal(upgradeProductState(s),true)
 assert.match(property['手机号'],/^1[3-9]\d{9}$/)
 const after=structuredClone(s);assert.equal(upgradeProductState(s),false);assert.deepEqual(s,after)
})

test('R3复验 平台录入用户拒绝缺失及错误手机号，合法号码可保存且组织保持',()=>{
 const s=createSeed(),data={登录账号:'property-new',人员姓名:'新物业人员',所属组织:'ORG-A',授权角色:['property'],授权变更原因:'入职登记',可查看社区:['C-A'],可查看小区:['E-A']}
 for(const phone of [undefined,'','025-00000001','12800001234','139123']){
  const before=s.accounts.length
  assert.throws(()=>execute(s,admin,'save',{table:'accounts',data:{...data,手机号:phone}}),error=>error.name==='DomainError' && typeof error.fields?.['手机号']==='string')
  assert.equal(s.accounts.length,before)
 }
 const result=execute(s,admin,'save',{table:'accounts',data:{...data,手机号:'13800001234'}})
 const saved=record(s,admin,'accounts',result.id)
 assert.equal(saved['手机号'],'13800001234');assert.equal(saved['所属组织'],'ORG-A')
})

test('R3复验 统计独立入口退出；资源不显示社区但内部归属和业务编号保留',()=>{
 const s=createSeed(),resource=query(s,admin,'facilities')[0]
 assert(!productMenus.includes('statistics'))
 for(const table of ['facilities','parking'])assert.equal(publicField(table,'所属社区'),false)
 assert.equal(resource['所属社区'],'C-A');assert(resource['点位编号']);assert(resource._id)
})
