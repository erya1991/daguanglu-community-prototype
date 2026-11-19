import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs';

const root = path.resolve(import.meta.dirname, '..');
const base = process.env.STAGE02_URL || 'http://127.0.0.1:19221';
const run = path.join(root, '.runtime/stage02/feedback-list3', 'public-actions-' + Date.now());
fs.mkdirSync(run, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const session = 'stage01-actions-' + Date.now();
const results = { session, base, checks: [], errors: [] };
page.on('pageerror', error => results.errors.push(error.message));
const colors = el => {
  const style = getComputedStyle(el);
  return { text: el.innerText.trim(), fg: style.color, bg: style.backgroundColor, border: style.borderTopColor };
};
const routes = [
  { route:'residents', rows:'.table-actions', open:'新增居民档案' },
  { route:'property/bills', rows:'.s1-list-actions' },
  { route:'parking/business', rows:'.s1-list-actions' },
  { route:'workorders/tasks', open:'登记工单' },
  { route:'service/categories', rows:'.action-column', open:'添加一级分类' },
];
try {
  await page.goto(base+'/web/?session='+session+'#/residents');
  await page.evaluate(async () => {
    const { createBrowserAdapter } = await import('/_shared/storage-h5.js');
    const api = createBrowserAdapter('web');
    await api.start();
    await api.identity('platform-admin');
  });
  for(const width of [1366,1920]) {
    await page.setViewportSize({width,height:width === 1366 ? 768 : 1080});
    for (const item of routes) {
      await page.goto(base+'/web/?session='+session+'#/'+item.route);
      await page.reload({waitUntil:'networkidle'});
      await page.mouse.move(2,2);
      const sample={route:item.route,width};
      if(item.rows) {
        const buttons=page.locator(item.rows+' .ivu-btn:visible:enabled');
        await buttons.first().waitFor();
        sample.rows=[];
        for (const button of (await buttons.all()).slice(0,3)) {
          const actual=await button.evaluate(colors);
          assert.equal(actual.fg,'rgb(23, 102, 191)',item.route+' '+actual.text);
          assert.equal(actual.bg,'rgba(0, 0, 0, 0)');
          assert.equal(actual.border,'rgba(0, 0, 0, 0)');
          sample.rows.push(actual);
        }
      }
      if(item.open) {
        await page.locator('.single-page-con button:visible').filter({hasText:new RegExp(item.open+'$')}).first().click();
        const dialog=page.locator('.ivu-modal:visible,.ivu-drawer:visible').last();
        const primary=dialog.locator('button.ivu-btn-primary:visible').last();
        const secondary=dialog.getByRole('button',{name:'取消',exact:true});
        await primary.waitFor();
        await secondary.waitFor();
        await page.mouse.move(2,2);
        await primary.scrollIntoViewIfNeeded();
        const endGap=await primary.evaluate(el=>{
          const bar=el.parentElement, style=getComputedStyle(bar);
          return bar.getBoundingClientRect().right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight) - el.getBoundingClientRect().right;
        });
        sample.primaryRightGap=Math.round(endGap);
        assert.ok(Math.abs(endGap)<=2,item.route+' 弹窗主按钮距底栏右端 '+endGap+'px');
        sample.primary=await primary.evaluate(colors);
        sample.secondary=await secondary.evaluate(colors);
        const [r,g,b]=sample.primary.bg.match(/[0-9]+/g).map(Number);
        assert.ok(b>r+50 && b>g,'主按钮采用蓝色背景 '+item.route+' '+sample.primary.bg);
        assert.equal(sample.primary.fg,'rgb(255, 255, 255)');
        assert.equal(sample.secondary.bg,'rgb(255, 255, 255)');
        assert.ok(!['rgba(0, 0, 0, 0)','rgb(255, 255, 255)'].includes(sample.secondary.border));
        if(width===1366) await page.screenshot({path:path.join(run,item.route.replaceAll('/','-')+'.png')});
        await secondary.click();
        await dialog.waitFor({state:'hidden'});
      }
      if(item.route==='service/categories') {
        await page.locator('.action-column').getByRole('button',{name:'删除',exact:true}).first().click();
        const dialog=page.locator('.ivu-modal-confirm:visible');
        const confirm=dialog.getByRole('button',{name:'确定',exact:true});
        const cancel=dialog.getByRole('button',{name:'取消',exact:true});
        await confirm.waitFor();
        await page.mouse.move(2,2);
        sample.confirmation={primary:await confirm.evaluate(colors),secondary:await cancel.evaluate(colors)};
        assert.equal(sample.confirmation.primary.bg,sample.primary.bg);
        assert.equal(sample.confirmation.secondary.bg,sample.secondary.bg);
        assert.notEqual(sample.confirmation.secondary.border,'rgba(0, 0, 0, 0)');
        await cancel.click();
        await dialog.waitFor({state:'hidden'});
      }
      results.checks.push(sample);
      console.log(width,item.route);
    }
  }
  assert.deepEqual(results.errors,[]);
} finally {
  fs.writeFileSync(path.join(run,'results.json'),JSON.stringify(results,null,2));
  await browser.close();
}
