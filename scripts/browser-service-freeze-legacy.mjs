import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs';

const root = path.resolve(import.meta.dirname, '..');
const previous = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const base = process.env.STAGE02_URL || 'http://127.0.0.1:19221';
const origin = new URL(base);
assert.equal(base, previous.base, '复测副本需使用原测试会话所在的同源入口');
const runtime = path.join(root, '.runtime/stage02');
const source = path.resolve(previous.profile, 'Default/IndexedDB');
assert.ok(source.startsWith(runtime + path.sep), '仅复制本项目自动测试会话');
const target = path.join(runtime, 'feedback-list3', 'legacy-' + Date.now());
const profile = path.join(target, 'profile');
const db = origin.protocol.slice(0, -1) + '_' + origin.hostname + '_' + origin.port + '.indexeddb.';
for (const type of ['leveldb', 'blob']) {
  const file = path.join(source, db + type);
  if (fs.existsSync(file)) fs.cpSync(file, path.join(profile,'Default/IndexedDB',db+type), { recursive:true });
}
const context = await chromium.launchPersistentContext(profile, {
  channel: process.env.STAGE02_BROWSER || 'chrome',
  headless: true,
  viewport: { width: 1366, height: 768 },
});
const page = await context.newPage();
const evidence = { base, priorSession: previous.session, checks: [], errors: [] };
page.on('pageerror', e => evidence.errors.push(e.message));
const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function snapshot() {
  return page.evaluate(async session => {
    const open = indexedDB.open('dgl-community-prototype-stage00', 1);
    const db = await new Promise((resolve,reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const request = db.transaction('sessions').objectStore('sessions').get(session);
    const state = await new Promise((resolve,reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    const service = state.service;
    return {
      orderFacts: service.orders,
      moneyFacts: service.funds,
      supply: service.services.find(item => item._id === 'SV-FAN'),
      grant: service.grants['platform-admin'],
      addresses: state.residentAddressBook.items,
    };
  }, previous.session);
}
try {
  await page.goto(base+'/?session='+previous.session);
  const before = await snapshot();
  assert.equal(before.supply.审核状态, '待审核');
  assert.equal(before.supply.上架状态, '已上架');
  assert.ok(before.addresses.some(item=>item.所属小区==='E-A'));
  await page.goto(base+'/web/?session='+previous.session+'#/service/review');
  const row = page.locator('[data-record="SV-FAN"]');
  await row.getByText('已下架', { exact:true }).waitFor();
  await row.getByText('暂停', { exact:true }).waitFor();
  await page.getByText('服务分类',{exact:true}).first().waitFor();
  const after = await snapshot();
  assert.equal(after.supply.审核状态, '待审核');
  assert.equal(after.supply.上架状态, '已下架');
  assert.equal(after.supply.接收新预约状态, '暂停');
  assert.deepEqual(before.supply.published, after.supply.published);
  assert.deepEqual(before.supply.submitted, after.supply.submitted);
  for (const old of before.orderFacts) {
    const next = after.orderFacts.find(o=>o._id === old._id);
    if (old._flowVersion === 2 && old.当前有效安排编号 && old.结案结果 === '进行中' && !old.服务完成时间 && old.credential?.凭证状态 !== '已核验') {
      assert.match(next.credential.服务码, /^\d{6}$/);
      const {credential:priorCode, ...priorFacts}=old;
      const {credential:newCode, ...nextFacts}=next;
      assert.deepEqual(nextFacts,priorFacts);
    } else assert.deepEqual(next,old);
  }
  assert.equal(after.orderFacts.length,before.orderFacts.length);
  assert.deepEqual(before.moneyFacts, after.moneyFacts);
  assert.equal(after.grant.sensitive, true);
  evidence.checks.push({name:'旧会话修复待审上架状态，授权和新旧版本一致',passed:true,
    orders:after.orderFacts.length, orderSha256:digest(after.orderFacts),
    funds:after.moneyFacts.length, fundSha256:digest(after.moneyFacts)});
  await page.screenshot({path:path.join(target,'migrated-pending-review.png')});

  await page.goto(base+'/resident/?session='+previous.session+'#/pages/service/catalog');
  const preflight = await page.evaluate(async () => {
    const { createBrowserAdapter } = await import('/_shared/storage-h5.js');
    const adapter = createBrowserAdapter('resident');
    await adapter.start();
    const address = (await adapter.service.query('addresses')).find(a=>a.所属小区==='E-A');
    const home = await adapter.service.record('services','SV-HOME');
    return adapter.service.preflight({
      选定服务项目:home._id, 选定服务规格:home.服务规格集合[0].规格编号, 选定履约方式:'HOME',
      联系人姓名:address.联系人姓名, 联系人电话:address.联系人电话, 上门服务地址:address,
      期望时间选择:'时间可协商', 服务约定确认:true,
    });
  });
  assert.deepEqual(preflight,{valid:true,amount:'99.00'});
  assert.deepEqual(evidence.errors,[]);
  evidence.checks.push({name:'保留旧地址关联，99 元原服务预校验成功',passed:true, preflight});
} catch (error) {
  evidence.checks.push({passed:false,error:error.message});
  await page.screenshot({path:path.join(target,'failure.png')}).catch(()=>{});
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(target,'results.json'), JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
  await context.close();
}
