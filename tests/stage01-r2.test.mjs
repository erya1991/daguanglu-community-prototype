import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../prototype-shared/core.js';
import { prepare, command, record } from '../prototype-shared/stage01/index.js';
import { seed } from '../prototype-shared/stage01/seed.js';
const PA={app:'web',account:'property-admin',role:'property'}, R={app:'resident',account:'resident-b',role:'resident'};
function fresh(){ const s=createSeed(); prepare(s,'stage01-r2'); seed(s); return s; }
function run(s,c,n,p){return command(s,c,n,p);}
function task(s,id,n,data={}){const w=record(s,PA,'workorders',id);return run(s,PA,n,{id,revision:w._rev,data});}
function make(s,kind){let data={RP07:kind,RP08:'设施维修',RP09:'C-A',RP10:'E-A',RP11:'公共位置',RP13:'楼门',RP14:'设施损坏',RP15:'周明',RP16:'13900000002'}; if(kind==='隐患'){s.attachments.photo={stage01:true,owner:'resident-b',status:'成功',name:'现场.png',type:'image/png'};data.RP17=['photo'];} return run(s,R,'report',{data});}
for(const kind of ['报修','隐患']) test(`R2 ${kind} 指派后处理、住户验收评价与未解决重办`,()=>{
  const s=fresh(), x=make(s,kind), id=x.workorderId;
  let w=record(s,PA,'workorders',id); assert.equal(w.WO06,'待派单'); assert.ok(!w._actions.includes('requestSupplement'));
  task(s,id,'dispatch',{WO04:'P-S01',WO05:'安排处理'}); w=record(s,PA,'workorders',id); assert.equal(w.WO06,'待处理'); assert.ok(w._actions.includes('startProcess')); task(s,id,'startProcess'); w=record(s,PA,'workorders',id); assert.ok(w._actions.includes('submitProcess')); assert.ok(!w._actions.includes('accept')); assert.ok(!w._actions.includes('return'));
  assert.throws(()=>task(s,id,'editTask',{WO15:kind==='报修'?'隐患':'报修',WO16:'设施维修',WO17:'楼门',WO18:'更正'}));
  task(s,id,'submitProcess',{PR02:'完成处理',PR07:'已处理'}); w=record(s,PA,'workorders',id); assert.equal(w.WO06,'待确认'); assert.ok(!w._actions.includes('review'));
  let rr=record(s,R,'reports',x.id); assert.ok(rr._canConfirm); run(s,R,'confirm',{id:x.id,revision:rr._taskRevision,data:{UC01:'未解决',UC02:'仍有问题'}});
  w=record(s,PA,'workorders',id); assert.equal(w.WO06,'待派单'); assert.equal(w.rounds.length,1); assert.equal(w.WO12,2);
  task(s,id,'dispatch',{WO04:'P-S01',WO05:'再次处理'});task(s,id,'startProcess');task(s,id,'submitProcess',{PR02:'再次处理',PR07:'已完成'});
  rr=record(s,R,'reports',x.id);run(s,R,'confirm',{id:x.id,revision:rr._taskRevision,data:{UC01:'已解决'}});rr=record(s,R,'reports',x.id);assert.ok(rr._canEvaluate);run(s,R,'evaluate',{id:x.id,revision:rr._taskRevision,data:{VA01:'满意'}});w=record(s,PA,'workorders',id);assert.equal(w.WO06,'已完成');assert.equal(w.rounds.length,2);assert.equal(w.confirmations.length,2);
});
test('R2 旧流程迁移保留处理事实，不代替住户验收',()=>{const s=fresh(),x=make(s,'报修');task(s,x.workorderId,'dispatch',{WO04:'P-S01',WO05:'处理'});const raw=s.stage01.workorders.find(w=>w._id===x.workorderId);raw.WO06='待复核';raw.rounds.push({PR01:'old',PR10:1,PR07:'旧记录'});s.stage01.schemaVersion=2;const w=record(s,PA,'workorders',x.workorderId);assert.equal(s.stage01.schemaVersion,4);assert.equal(w.WO06,'处理中');assert.equal(w.rounds[0].PR01,'old');assert.equal(w.WO12,2);assert.ok(!record(s,R,'reports',x.id)._canConfirm);assert.equal(w.history.filter(h=>h.HI02==='适配工单流程').length,1);const again=record(s,PA,'workorders',x.workorderId);assert.equal(again.history.filter(h=>h.HI02==='适配工单流程').length,1);});
test('R2 转派后只有当前处理人可提交，旧版本受保护',()=>{const s=fresh(),x=make(s,'报修'),id=x.workorderId;task(s,id,'dispatch',{WO04:'P-S01',WO05:'处理'});const old=record(s,PA,'workorders',id);task(s,id,'transfer',{OP03:'P-S02',OP04:'调整人员'});assert.throws(()=>task(s,id,'submitProcess',{PR02:'旧人',PR07:'完成'}));assert.throws(()=>run(s,PA,'transfer',{id,revision:old._rev,data:{OP03:'P-S02',OP04:'旧页面'}}));const colleague={...PA,account:'property-colleague'},w=record(s,colleague,'workorders',id);assert.equal(w.WO06,'待处理');run(s,colleague,'startProcess',{id,revision:w._rev});const started=record(s,colleague,'workorders',id);run(s,colleague,'submitProcess',{id,revision:started._rev,data:{PR02:'已修复',PR07:'完成'}});assert.equal(record(s,PA,'workorders',id).WO06,'待确认');});
test('R2 管理端处理提交只保存业务字段且可持久化',()=>{const s=fresh(),x=make(s,'报修');task(s,x.workorderId,'dispatch',{WO04:'P-S01',WO05:'处理'});task(s,x.workorderId,'startProcess');const staff={...PA,app:'staff'},w=record(s,staff,'workorders',x.workorderId);const data=new Proxy({PR02:'更换部件',PR07:'已恢复',RP14:'不应写入处理记录'},{});run(s,staff,'submitProcess',{id:w._id,revision:w._rev,data});const round=s.stage01.workorders.find(r=>r._id===w._id).rounds[0];assert.equal(round.RP14,undefined);assert.doesNotThrow(()=>structuredClone(s));});
