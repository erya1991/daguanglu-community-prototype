import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../prototype-shared/core.js';
import { prepare, command } from '../prototype-shared/stage01/index.js';
import { seed } from '../prototype-shared/stage01/seed.js';
import { isRequiredField } from '../prototype-shared/stage01/ui.js';
import { requiredServiceField } from '../prototype-shared/service/required.js';

const resident = {app:'resident', account:'resident-b', role:'resident'};
const property = {app:'web', account:'property-admin', role:'property'};
const fresh = () => { const s=createSeed(); prepare(s,'stage01-required-test'); seed(s); return s; };
const report = {RP07:'隐患',RP08:'公共安全',RP09:'C-A',RP10:'E-A',RP11:'公共位置',RP13:'楼道',RP14:'现场隐患'};

test('隐患照片、室内房屋和未解决说明按当前选择显示必填', () => {
  const s=fresh();
  assert.equal(isRequiredField('report','RP17',report),true);
  assert.throws(() => command(s,resident,'report',{data:report}),/照片/);
  assert.equal(isRequiredField('report','RP17',{...report,RP07:'报修'}),false);
  assert.equal(isRequiredField('report','RP12',report),false);
  assert.equal(isRequiredField('report','RP12',{...report,RP11:'房屋内'}),true);
  assert.equal(isRequiredField('confirm','UC02',{UC01:'已解决'}),false);
  assert.equal(isRequiredField('confirm','UC02',{UC01:'未解决'}),true);
});

test('停车产品校验必填项有标识，厂商资料仍可选', () => {
  const s=fresh();
  const product={MP02:'月租',MP03:'PARK-A',MP04:'200',MP05:'自然月',MP07:'启用'};
  assert.equal(isRequiredField('saveProduct','MP06',product),true);
  assert.equal(isRequiredField('saveProduct','MP10',product),false);
  assert.throws(() => command(s,property,'saveProduct',{data:product}),error => error.fields?.MP06 === '此项必填');
});

test('服务预约和售后条件必填随所选内容变化', () => {
  const field=(name,id='')=>({name,id});
  const book=(name,data,opts={})=>requiredServiceField('order.book',field(name),data,opts);
  assert.equal(book('联系人电话',{}),true);
  assert.equal(book('需求说明',{}),false);
  assert.equal(book('期望服务日期',{'期望时间选择':'时间可协商'}),false);
  assert.equal(book('期望服务日期',{'期望时间选择':'指定日期'}),true);
  assert.equal(book('服务对象描述',{}, {selectedSpec:{'服务对象填写要求':'必填'}}),true);
  assert.equal(requiredServiceField('order.book',field('所属小区','29-C.05'),{}, {selectedCombo:{上门覆盖小区:[]}}),false);
  assert.equal(requiredServiceField('order.book',field('所属小区','29-C.05'),{}, {selectedCombo:{上门覆盖小区:['E-A']}}),true);
  assert.equal(requiredServiceField('aftersale.plan',field('拟退款金额'),{'方案处理类型':'全额退款'}),false);
  assert.equal(requiredServiceField('aftersale.plan',field('拟退款金额'),{'方案处理类型':'部分退款'}),true);
  assert.equal(requiredServiceField('order.result',field('结果图片'),{}, {}, {'服务内容快照':{方式:{完成证据要求:'必需图片'}}}),true);
  assert.equal(requiredServiceField('order.result',field('结果图片'),{}, {}, {'服务内容快照':{方式:{完成证据要求:'可选图片'}}}),false);
  assert.equal(requiredServiceField('personnel.status',field('启停原因'),{}),true);
  assert.equal(requiredServiceField('qualification.save',field('材料名称','26-D.01'),{}),true);
  assert.equal(requiredServiceField('personnel.save',field('材料名称','26-D.01'),{}),true);
  assert.equal(requiredServiceField('qualification.save',field('生效日期','26-D.03'),{}),false);
  assert.equal(requiredServiceField('service.status',field('暂停原因'),{状态:'暂停接单'}),true);
  assert.equal(requiredServiceField('service.status',field('暂停原因'),{状态:'恢复接单'}),false);
  assert.equal(requiredServiceField('evaluation.status',field('评价限制原因'),{状态:'显示'}),false);
  assert.equal(requiredServiceField('evaluation.status',field('评价限制原因'),{状态:'受限'}),true);
});
