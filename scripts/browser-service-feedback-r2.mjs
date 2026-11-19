// Stage02 V1.2 feedback retest: operate the published H5 pages; API reads verify persisted facts.
import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
const base = process.env.STAGE02_URL || "http://127.0.0.1:19221";
const runDir = '.runtime/stage02/feedback-list3';
const out = path.join(path.resolve(root, runDir), "browser-" + Date.now());
fs.mkdirSync(out, { recursive: true });
const resumeFile=process.env.STAGE02_RESUME_RESULTS;
const previous=resumeFile?JSON.parse(fs.readFileSync(resumeFile,"utf8")):null;
const recheckWeb=process.env.STAGE02_RETEST_WEB==="1";
const retainStep=name=>!recheckWeb||!/^Web |^F04 /.test(name);
const session = previous?.session || "stage02-feedback-" + Date.now();
const context = await chromium.launchPersistentContext(
  previous?(previous.profile||path.join(path.dirname(resumeFile),"profile")):path.join(out, "profile"),
  { channel: process.env.STAGE02_BROWSER || "chrome", headless: true, viewport: { width: 390, height: 844 } },
);
context.setDefaultTimeout(14000);
const steps = previous ? previous.steps.filter(s=>s.status==="PASS"&&retainStep(s.name)) : [],
  errors = [],
  blocked = [];
context.on("page", (p) =>
  { p.on("pageerror", (e) => errors.push({ url: p.url(), error: e.message })); p.on("console",m=>{if(m.type()==="error"&&!m.text().startsWith("Failed to load resource:"))errors.push({url:p.url(),error:m.text()})}); },
);
await context.route("**/*", (route) => {
  const u = route.request().url();
  if (u.startsWith(base + "/") || /^(data:|blob:)/.test(u))
    return route.continue();
  blocked.push(u);
  return route.abort();
});
const resident = await context.newPage(),
  merchant = await context.newPage(),
  web = await context.newPage();
await web.setViewportSize({ width: 1366, height: 768 });
const appFor = (p) =>
  p === resident ? "resident" : p === merchant ? "merchant" : "web";
async function api(p, method, args = []) {
  return p.evaluate(
    async ({ app, method, args }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
      const a = createBrowserAdapter(app);
      await a.start();
      return a.service[method](...args);
    },
    { app: appFor(p), method, args },
  );
}
async function go(p, route, account) {
  await p.bringToFront();
  const app = appFor(p);
  await p.goto(
    `${base}/${app}/?session=${session}#/${app === "web" ? "service/" : "pages/"}${route}`,
  );
  if (account) {
    await p.evaluate(
      async ({ app, account }) => {
        const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
        const a = createBrowserAdapter(app);
        await a.start();
        await a.identity(account);
      },
      { app, account },
    );
  }
  await p.reload();
  await p.waitForFunction(
    () => !document.querySelector(".page-state--loading"),
  );
  await p.waitForTimeout(300);
}
const button = (p, name) =>
  p
    .locator("uni-button:visible,button:visible")
    .filter({ hasText: new RegExp("^\\s*" + name + "\\s*$") })
    .last();
const field = (p, name) =>
  p
    .locator(".form-field:visible")
    .filter({
      has: p
        .locator(".form-field__label")
        .filter({ hasText: new RegExp("^" + name + "(?: \\*)?$") }),
    })
    .first();
async function fill(p, name, v) {
  await p.bringToFront();
  await field(p, name)
    .locator("input:not([type=file]),textarea")
    .first()
    .fill(v);
}
async function pick(p, name, index = 0) {
  await p.bringToFront();
  const picker = field(p, name).locator("uni-picker").first();
  await picker.click();
  const column = p.locator("uni-picker-view-column:visible").first();
  await column.waitFor();
  await p.waitForFunction(() => [...document.querySelectorAll("uni-picker-view-column")].some(wheel => {
    const bounds = wheel.getBoundingClientRect();
    return bounds.height > 0 && Math.abs(bounds.bottom - innerHeight) < 2;
  }), null, {timeout:3500});
  const options = column.locator(".uni-picker-item");
  const expected = (await options.nth(index).innerText()).trim();
  const centered = () => column.evaluate(el => {
    const mid = node => {const r = node.getBoundingClientRect(); return r.top + r.height / 2};
    const y = mid(el.querySelector(".uni-picker-view-indicator"));
    const distances = [...el.querySelectorAll(".uni-picker-item")].map(row => Math.abs(mid(row)-y));
    return distances.indexOf(Math.min(...distances));
  });
  const current = await centered();
  await column.hover();
  for (let i = current; i !== index; i += Math.sign(index-current)) {
    await p.mouse.wheel(0, Math.sign(index-current)*80);
    await p.waitForFunction(({selector, target}) => {
      const el=[...document.querySelectorAll("uni-picker-view-column")].find(e=>e.getBoundingClientRect().height>0);
      const mid = node => {const r=node.getBoundingClientRect();return r.top+r.height/2};
      return el && Math.abs(mid(el.querySelectorAll(selector)[target])-mid(el.querySelector(".uni-picker-view-indicator"))) < 2;
    },{selector:".uni-picker-item", target:i+Math.sign(index-current)},{timeout:3500});
  }
  assert.equal(await centered(),index,name+" 当前居中选项");
  const confirm=p.locator(".uni-picker-action-confirm:visible");
  await confirm.click();
  await confirm.waitFor({state:"hidden"});
  assert.ok((await picker.innerText()).includes(expected),name+" 未保存选项 "+expected+"，当前为 "+await picker.innerText());
}
async function action(p, name) {
  await p.bringToFront();
  await p
    .locator(
      ".bottom-actions uni-button:visible,.bottom-actions button:visible,.secondary-links uni-text:visible",
    )
    .filter({ hasText: new RegExp("^\\s*" + name + "\\s*$") })
    .last()
    .click();
  await p.locator(".form-card:visible").waitFor();
}
async function dismissError(p,expected){
  const modal=p.locator(".uni-modal:visible");
  await modal.waitFor();
  if(expected){const message=await modal.innerText();assert.ok(message.includes(expected), "期望字段 "+expected+"，弹窗实际显示 "+message)}
  await p.locator(".uni-modal__btn_primary:visible").click();
  await modal.waitFor({state:"hidden"});
  await p.waitForTimeout(300);
}
async function submit(p, name) {
  await p.bringToFront();
  await button(p, name).click();
  await p.waitForTimeout(500);
  const errs = await p
    .locator(
      ".service-page>.message.error:visible,.addresses-page>.error:visible",
    )
    .allTextContents();
  assert.deepEqual(errs, [], errs.join(";"));
}
async function waitOrder(p, id, state) {
  for (let i = 0; i < 30; i++) {
    const r = await api(p, "record", ["orders", id]);
    if (r["当前业务进度"] === state) return r;
    await p.waitForTimeout(150);
  }
  throw Error(id + " not " + state);
}
async function shot(p, name) {
  await p.screenshot({ path: path.join(out, name + ".png"), fullPage: false, animations: "disabled" });
}
async function layout(p, name, primary) {
  await p.bringToFront();
  const result = await p.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(result.scroll <= result.width, name + " horizontal overflow");
  if (primary) {
    const b = await button(p, primary).boundingBox();
    assert.ok(
      b && b.y >= 0 && b.y + b.height <= result.height + 1,
      name + " primary visible",
    );
  }
  await shot(p, name);
  return result;
}
async function step(name, fn) {
  const done=previous?.steps.find(s=>s.name===name&&s.status==="PASS"&&retainStep(name));
  if(done){console.log("Retained same-build evidence: "+name);return done.detail;}
  console.log(name);
  try {
    const detail = await fn();
    steps.push({ name, status: "PASS", detail });
    return detail;
  } catch (e) {
    steps.push({ name, status: "FAIL", error: e.message });
    await shot(resident, "failure-resident");
    await shot(merchant, "failure-merchant");
    await shot(web, "failure-web");
    throw e;
  }
}
const artifacts = [
  ...["core.js","storage-h5.js","service/index.js","service/common.js","service/seed.js","service/service-code.js","service/supply.js","service/orders.js","service/aftersale.js","service/addresses.js"].map(file=>"prototype-shared/"+file),
  "web/manager/dist/index.html",
  ...["resident", "merchant", "staff"].map(
    (a) => `miniapp/apps/${a}-miniapp/dist/build/h5/index.html`,
  ),
];
const hashes = Object.fromEntries(
  artifacts.map((f) => [
    f,
    createHash("sha256")
      .update(fs.readFileSync(path.join(root, f)))
      .digest("hex"),
  ]),
);
if(previous){const retainedHashes=h=>Object.fromEntries(Object.entries(h).filter(([k])=>!recheckWeb||!k.startsWith("web/")));assert.deepEqual(retainedHashes(hashes),retainedHashes(previous.hashes),"仅可复用未改变产物的已通过步骤");}
let H=previous?.H, P=previous?.P, statsBefore;
try {
  await go(resident, "profile/index", "resident-a");
  await go(merchant, "workbench/index", "service-merchant-a");
  await go(web, "orders", "platform-admin");
  statsBefore = (await api(merchant, "overview")).values;
  if(previous) assert.ok(previous.steps.some(row=>row.name.startsWith("G08 ") && row.status==="PASS"),"前段主线未全部完成，请使用新测试会话执行整轮回归");
  if(!previous){
  await step("H01 常用地址入口、必填、联动、默认地址", async () => {
    await resident.bringToFront();
    await resident.locator('[data-module="addresses"]').click();
    await button(resident, "新增地址").click();
    assert.equal(
      await field(resident, "联系人电话")
        .locator(".form-field__required")
        .count(),
      1,
    );
    assert.equal(await field(resident,"地址补充说明").count(),0);
    await button(resident, "保存地址").click();
    await resident.locator(".addresses-page>.error:visible").waitFor();
    await dismissError(resident, "联系人电话");
    await resident.waitForTimeout(400);
    const invalidAddressField = await field(
      resident,
      "联系人电话",
    ).boundingBox();
    assert.ok(
      invalidAddressField &&
        invalidAddressField.y >= 56 &&
        invalidAddressField.y + invalidAddressField.height < 760,
      "保存失败后应定位首个必填错误字段，而非停留在表单底部",
    );
    await fill(resident, "联系人电话", "13800000001");
    assert.equal(await field(resident,"小区").count(),0);
    assert.equal(await field(resident,"社区").count(),0);
    await fill(resident, "详细地址", "演示路10号1栋1单元101室");
    await layout(resident, "address-390", "保存地址");
    await submit(resident, "保存地址");
    const rows = await api(resident, "query", ["addresses"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]["默认地址"], true);
    assert.equal(rows[0]["所属社区"], undefined);
    assert.equal(rows[0]["所属小区"], undefined);
    return rows[0]._id;
  });
  async function flow(kind) {
    const home = kind === "H",
      serviceId = home ? "SV-HOME" : "SV-FAN",
      spec = home ? "SPEC-HOME" : "SPEC-FAN",
      method = home ? "HOME" : "POINT";
    let id;
    await step(kind + "02 住户选择服务、方式与付款", async () => {
      await go(resident, "service/detail?id=" + serviceId);
      await button(resident, "选择规格与服务方式").click();
      if (!home)
        await resident
          .locator(".sheet .chip,.sheet-card .chip,.sheet-panel .chip")
          .filter({ hasText: "预约到店" })
          .click();
      await button(resident, "确认选择，去预约").click();
      await resident.waitForURL(/booking/);
      await field(resident, "联系人电话").waitFor();
      if (home)
        assert.ok(
          (await resident.locator(".selected-address").innerText()).includes(
            "演示路10号",
          ),
        );
      else {
        assert.equal(await resident.locator(".address-form").count(), 0);
        await fill(resident, "联系人电话", "13800000001");
        await pick(resident, "到店服务地点", 0);
      }
      if(home){
        await fill(resident,'服务对象描述','地址返回保留的需求');
        await resident.locator('.selected-address').click();
        await resident.locator('.address-sheet').waitFor();
        await layout(resident,'address-sheet-390');
        await resident.locator('.address-edit').first().click();
        await resident.locator('.addresses-page').waitFor();
        await field(resident,'详细地址').waitFor();
        await fill(resident,'详细地址','演示路10号1栋1单元101室（编辑后）');
        await button(resident,'保存地址').click();
        await resident.waitForURL(/service\/booking/);
        await resident.waitForFunction(()=>document.querySelector('.selected-address')?.textContent.includes('编辑后'));
        assert.equal(await field(resident,'服务对象描述').locator('input,textarea').inputValue(),'地址返回保留的需求');
        await resident.locator('.selected-address').click();
        await button(resident,'新增地址').click();
        await field(resident,'联系人电话').waitFor();
        await fill(resident,'联系人电话','13800000001');
        await fill(resident,'详细地址','验收街新地址202室');
        await button(resident,'保存地址').click();await resident.waitForURL(/service\/booking/);
        await resident.waitForFunction(()=>document.querySelector('.selected-address')?.textContent.includes('新地址202室'));
        assert.equal(await field(resident,'服务对象描述').locator('input,textarea').inputValue(),'地址返回保留的需求');
      }
      await resident.locator(".agreement-label").click();
      // This installed uni-app renders a checked SVG, not the old checked CSS class.
      await resident.locator(".agreement .uni-checkbox-input svg").waitFor({state:"visible"});
      await layout(resident, kind + "-booking-390", "提交并付款");
      await button(resident, "提交并付款").click();
      if (home) {
        await dismissError(resident, "履约小区");
        await pick(resident,"履约小区",0);
        await button(resident, "提交并付款").click();
      }
      await resident.locator(".uni-modal__btn_primary:visible").click();
      await resident.waitForURL(/service\/orders(?:$|\?)/);
      id = (await api(resident, "query", ["orders"]))[0]._id;
      assert.ok((await resident.locator(".record-card").first().innerText()).includes(id),"新订单置顶");
      assert.ok(id);
      const r = await waitOrder(resident, id, "待接单");
      assert.equal(
        r.fundRecords.filter((f) => f["资金类型"] === "支付").length,
        1,
      );
      assert.equal(r._flowVersion, 2);
      {await go(resident,'service/order?id='+id);assert.equal(await resident.locator('.voucher-toggle').count(),0)}
      return { id, price: r["订单应付金额"] };
    });
    await step(kind + "03 商户接单派工一次生效", async () => {
      await go(merchant, "service/order?id=" + id);
      await layout(merchant, kind + "-accept-entry", "接单并派工");
      await action(merchant, "接单并派工");
      assert.equal(await field(merchant, "无法承接说明").count(), 0);
      assert.equal(
        await merchant.locator(".form-field--readonly input").count(),
        0,
      );
      assert.ok(!(await field(merchant, "服务人员").innerText()).includes("陈师傅"));
      await pick(merchant,"服务人员",0);
      assert.ok((await field(merchant,"服务人员").innerText()).includes("陈师傅"));
      const startTime = await field(merchant, "安排开始时间").boundingBox(),
        endTime = await field(merchant, "安排结束时间").boundingBox();
      assert.ok(
        Math.abs(startTime.y - endTime.y) < 2 && endTime.x > startTime.x,
        "起止时间紧凑并排",
      );
      await layout(merchant, kind + "-dispatch-390", "确认");
      await submit(merchant, "确认");
      await merchant.waitForURL(/service\/order\?/);
      const r = await waitOrder(merchant, id, "待服务");
      assert.equal(r.currentArrangement["安排状态"], "已生效");
      await resident.bringToFront();
      await resident.reload();
      assert.equal(
        (await api(resident, "record", ["orders", id]))["当前业务进度"],
        "待服务",
      );
      assert.equal(
        await resident.getByText("确认安排", { exact: true }).count(),
        0,
      );
      return { arrangement: r.currentArrangement };
    });
    await step(kind + "04 商户提交结果与资金事实", async () => {
      await go(resident, "service/order?id=" + id);
      await resident.locator('.voucher-toggle').click();
      const cr=(await resident.locator('.voucher-code').innerText()).trim();
      assert.match(cr,/^\d{6}$/);
      assert.equal(await resident.locator('.qr-box').count(),0);
      await resident.locator('.voucher-toggle').click();
      await resident.locator('.voucher-code').waitFor({state:'hidden'});
      await resident.locator('.voucher-toggle').click();
      await shot(resident,kind+'-service-code');
      await action(merchant, "提交服务结果");
      await fill(
        merchant,
        "实际完成内容",
        home ? "已完成约定基础保洁" : "已完成循环扇清洗",
      );
      if (!home) {
        await fill(merchant,"服务码",cr==="999999"?"999998":"999999");
        await button(merchant, "提交服务结果").click();
        await merchant.locator(".message.error:visible").waitFor();
        await dismissError(merchant);
        const before = await api(merchant, "record", ["orders", id]);
        assert.equal(before.credential["凭证状态"], "有效");
        assert.equal(
          before.fundRecords.filter((f) => f["资金类型"] === "分账").length,
          0,
        );
        assert.equal(
          await field(merchant, "实际完成内容")
            .locator("textarea")
            .inputValue(),
          "已完成循环扇清洗",
        );
      }
      await fill(merchant,"服务码",cr);
      await layout(merchant, kind + "-result-390", "提交服务结果");
      await submit(merchant, "提交服务结果");
      await merchant.waitForURL(/service\/order\?/);
      const r = await waitOrder(merchant, id, "待评价");
      assert.equal(
        r.fundRecords.filter((f) => f["资金类型"] === "分账").length,
        1,
      );
      assert.equal(r["居民确认时间"], undefined);
      return {
        funds: r.fundRecords.map((f) => ({
          type: f["资金类型"],
          amount: f._amount,
          status: f["资金状态"],
        })),
      };
    });
    await step(kind + "05 评价主按钮、完成、刷新幂等", async () => {
      await go(resident, "service/orders");
      const card=resident.locator(".record-card").filter({hasText:id});
      await button(card,"评价服务").click();
      await resident.locator(".star-rating").waitFor();
      await resident.locator('.star-rating uni-button[aria-label="5星"],.star-rating button[aria-label="5星"]').last().click();
      await fill(
        resident,
        "评价内容",
        home ? "保洁细致，按约完成" : "到点清洗方便，结果满意",
      );
      await submit(resident, "评价服务");
      await resident.waitForURL(/service\/order\?/);
      const r = await waitOrder(resident, id, "已完成");
      assert.equal(r.evaluation["总体评分"], 5);
      await resident.bringToFront();
      await resident.reload();
      await resident.locator(".order-tabs").waitFor();
      await button(resident, "服务结果").click();
      assert.ok(
        (await resident.locator(".order-panel").innerText()).includes(
          home ? "保洁细致" : "到点清洗",
        ),
      );
      await merchant.bringToFront();
      await merchant.reload();
      const m = await api(merchant, "record", ["orders", id]);
      assert.equal(m["当前业务进度"], "已完成");
      assert.equal(
        m.fundRecords.filter((f) => f["资金类型"] === "分账").length,
        1,
      );
      await shot(resident, kind + "-completed");
      return id;
    });
    return id;
  }
  H = await flow("H");
  await resident.setViewportSize({ width: 414, height: 896 });
  await merchant.setViewportSize({ width: 414, height: 896 });
  P = await flow("P");
  await step("G09 首页统计、下钻与跨端金额", async () => {
    await go(merchant, "workbench/index");
    const stats = (await api(merchant, "overview")).values;
    assert.equal(stats["服务完成数"] - statsBefore["服务完成数"], 2);
    assert.equal(stats["已完成订单数"] - statsBefore["已完成订单数"], 2);
    assert.equal(
      (
        Number(stats["期间支付成功金额"]) -
        Number(statsBefore["期间支付成功金额"])
      ).toFixed(2),
      "158.00",
    );
    assert.equal(
      (
        Number(stats["商户净实分金额"]) - Number(statsBefore["商户净实分金额"])
      ).toFixed(2),
      "142.04",
    );
    for (const key of ["服务完成数", "已完成订单数", "商户净实分金额"]) {
      const card = merchant
        .locator(".metrics uni-button,.metrics button")
        .filter({ hasText: key })
        .first();
      assert.ok((await card.innerText()).includes(String(stats[key])));
    }
    await layout(merchant, "merchant-home-414");
    await merchant
      .locator(".metrics uni-button,.metrics button")
      .filter({ hasText: "已完成订单数" })
      .first()
      .click();
    await merchant.locator(".record-card").filter({ hasText: H }).waitFor();
    return stats;
  });
  // Exception setup uses ordinary Service commands, never fixture state mutation.
  async function fixtureOrder(sv = "SV-HOME", dispatch = false) {
    const v = await api(resident, "record", ["services", sv]);
    let r = (
      await api(resident, "command", [
        "order.create",
        {
          operationId: "ui-fixture-" + Date.now(),
          data: {
            选定服务项目: sv,
            选定服务规格: v["服务规格集合"][0]["规格编号"],
            选定履约方式: "HOME",
            联系人姓名: "林悦",
            联系人电话: "13800000001",
            上门服务地址: (await api(resident, "query", ["addresses"]))[0],
            履约小区: "E-A",
            期望时间选择: "时间可协商",
            服务约定确认: true,
            服务对象描述: "一台挂机空调",
          },
        },
      ])
    ).record;
    r = (
      await api(resident, "command", [
        "order.pay",
        {
          id: r._id,
          revision: r._rev,
          operationId: "ui-pay-" + Date.now(),
          data: {},
        },
      ])
    ).record;
    if (dispatch) {
      const opts = await api(merchant, "options");
      r = (
        await api(merchant, "command", [
          "order.accept",
          {
            id: r._id,
            revision: r._rev,
            operationId: "ui-dispatch-" + Date.now(),
            data: {
              服务人员: "P-A",
              安排服务日期: opts.today,
              安排开始时间: "00:00",
              安排结束时间: "23:59",
            },
          },
        ])
      ).record;
    }
    return r;
  }
  await step("G04 空调条件必填、图片上传与预览", async () => {
    await go(resident, "service/booking?id=SV-AC&spec=SPEC-AC&method=HOME");
    await field(resident, "服务对象描述").waitFor();
    assert.equal(
      await field(resident, "服务对象描述")
        .locator(".form-field__required")
        .count(),
      1,
    );
    const beforeOrders=await api(resident,'query',['orders']);
    await resident.locator('.agreement-label').click();
    await button(resident,'提交并付款').click();
    await dismissError(resident,'服务对象描述');
    assert.deepEqual((await api(resident,'query',['orders'])).map(r=>r._id),beforeOrders.map(r=>r._id),'预校验失败不能创建订单');
    const r = await fixtureOrder("SV-AC", true);
    await go(merchant, "service/order?id=" + r._id);
    await action(merchant, "提交服务结果");
    await fill(merchant, "实际完成内容", "已完成空调清洗");
    await fill(merchant, "服务码", (await api(resident,"record",["orders",r._id])).服务码);
    const photos = merchant.locator('[data-field-name="结果图片"]:visible');
    assert.ok((await photos.innerText()).includes("*"));
    await button(merchant, "提交服务结果").click();
    await merchant.locator(".message.error:visible").waitFor();
    await dismissError(merchant);
    await merchant.waitForTimeout(400);
    const photoError = await photos.boundingBox();
    assert.ok(
      photoError && photoError.y >= 56 && photoError.y < 500,
      "图片校验失败后应定位图片字段并保留已填完成内容",
    );
    assert.equal(
      (await api(merchant, "record", ["orders", r._id]))["当前业务进度"],
      "待服务",
    );
    const [chooser] = await Promise.all([
      merchant.waitForEvent("filechooser"),
      button(photos, "上传／拍照").click(),
    ]);
    await chooser.setFiles(
      path.join(root, ".runtime/stage02/fixtures/demo-service.png"),
    );
    await photos.locator(".file-name").waitFor();
    await photos.locator("uni-image").first().click();
    await merchant.locator("#u-a-p img").first().waitFor();
    await shot(merchant, "result-image-preview");
    await merchant.keyboard.press("Escape");
    await merchant.locator("#u-a-p img").first().waitFor({ state: "hidden" });
    await submit(merchant, "提交服务结果");
    await waitOrder(merchant, r._id, "待评价");
    return r._id;
  });
  await step("G06 拒单独立原因与唯一退款", async () => {
    const r = await fixtureOrder();
    await go(merchant, "service/order?id=" + r._id);
    await action(merchant, "无法接单");
    assert.equal(await field(merchant, "服务人员").count(), 0);
    await button(merchant, "无法接单").click();
    await merchant.locator(".message.error:visible").waitFor();
    await dismissError(merchant);
    await fill(merchant, "无法承接说明", "当天人员无法承接，原单全退");
    await submit(merchant, "无法接单");
    const closed = await waitOrder(merchant, r._id, "已取消");
    assert.equal(
      closed.fundRecords.filter((f) => f["资金类型"] === "退款").length,
      1,
    );
    return r._id;
  });
  await step("G07 派工后取消核实及拒绝恢复", async () => {
    const r = await fixtureOrder("SV-HOME", true);
    await go(resident, "service/order?id=" + r._id);
    assert.equal(
      await resident.getByText("申请售后", { exact: true }).count(),
      0,
    );
    await action(resident, "申请取消");
    await fill(resident, "申请原因", "临时调整需求，申请取消");
    await submit(resident, "申请取消");
    const sale = (await api(merchant, "query", ["aftersales"])).find(
      (s) => s._order === r._id,
    );
    assert.ok(sale);
    await go(merchant, "service/order?id=" + r._id);
    assert.equal(await button(merchant, "提交服务结果").count(), 0);
    await go(merchant, "service/after-sale?id=" + sale._id);
    const a = (
      await api(merchant, "record", ["aftersales", sale._id])
    )._actions.find((a) => a.name === "aftersale.cancelDecision");
    await button(merchant,'处理方案').click();
    await pick(merchant, "取消核实结果", 1);
    await fill(merchant, "核实依据说明", "已经备料，按约继续服务");
    await submit(merchant, a.label);
    await go(merchant, "service/order?id=" + r._id);
    await button(merchant, "提交服务结果").waitFor();
    return r._id;
  });
  await step("G08 完成后退款售后，方案不提供补充履约", async () => {
    const r = (await api(resident, "query", ["orders"])).find(
      (o) =>
        o["服务项目名称"] === "挂式空调清洗" && o["当前业务进度"] === "待评价",
    );
    assert.ok(r);
    await go(resident, "service/order?id=" + r._id);
    await action(resident, "申请售后");
    await fill(resident, "申请原因", "对服务结果有异议，申请退款");
    await fill(resident, "申请退款金额", "129.00");
    await submit(resident, "申请售后");
    const sale = (await api(merchant, "query", ["aftersales"])).find(
      (s) => s._order === r._id,
    );
    await go(merchant, "service/after-sale?id=" + sale._id);
    await button(merchant,'处理方案').click();
    await pick(merchant, "方案处理类型", 0);
    await pick(merchant, "业务结案方式", 0);
    assert.equal(await field(merchant, "补充履约内容").count(), 0);
    assert.equal(await field(merchant, "服务是否已实际开始").count(), 0);
    await fill(merchant, "方案说明", "经核对同意全额退款");
    await submit(merchant, "提交处理方案");
    const done = await api(merchant, "record", ["orders", r._id]);
    assert.equal(
      done.fundRecords.filter(
        (f) => f["资金类型"] === "退款" && f["资金状态"] === "成功",
      ).length,
      1,
    );
    assert.equal(
      done.fundRecords.filter(
        (f) => f["资金类型"] === "回退" && f["资金状态"] === "成功",
      ).length,
      1,
    );
    return sale._id;
  });
  }
  await step("F01 状态页签、即时筛选、订单入口及公开评价",async()=>{
    await go(resident,'service/orders');
    const tabs=resident.locator('.status-tabs');
    await button(tabs,'已完成').click();
    await resident.locator('.record-card').filter({hasText:H}).waitFor();
    for(const c of await resident.locator('.record-card').all()) assert.ok((await c.innerText()).includes('已完成'));
    await resident.locator('.filter-triggers uni-button,.filter-triggers button').filter({hasText:'服务方式'}).click();
    await resident.locator('.filter-options uni-button,.filter-options button').filter({hasText:'预约到店'}).click();
    await resident.locator('.record-card').filter({hasText:P}).waitFor();
    assert.equal(await resident.locator('.record-card').filter({hasText:H}).count(),0);
    await layout(resident,'orders-filter-414');
    await go(resident,'service/catalog');
    await button(resident,'服务订单').waitFor();
    await go(resident,'service/detail?id=SV-HOME');
    assert.equal(await button(resident,'审核结果').count(),0);
    await button(resident,'服务评价').click();
    assert.ok((await resident.locator('.public-review').allTextContents()).join('').includes('保洁细致'));
    assert.ok(!(await resident.locator('.public-review').allTextContents()).join('').includes('13800000001'));
    await go(merchant,'service/evaluations');
    assert.ok((await merchant.locator('.record-card').allTextContents()).join('').includes('保洁细致'));
    assert.ok(await merchant.locator('.star-rating').count()>0);
    await layout(merchant,'merchant-reviews-414');
  });
  await step("F02 规格独立页、方式多选与父草稿恢复",async()=>{
    await api(merchant,'draft',['merchant:SV-FAN:service.save:编辑服务',null]);
    await go(merchant,'service/supply');
    await merchant.locator('[data-record="SV-FAN"]').click();
    await action(merchant,'编辑服务');
    await fill(merchant,'服务简介','子页返回保留供给说明');
    await merchant.locator('.spec-card').first().click();
    await merchant.waitForURL(/service\/spec\?/);
    await merchant.locator('.method-cards').waitFor();
    assert.equal(await merchant.locator('.method-cards .selected').count(),2);
    await merchant.locator('[data-method="POINT"] button,[data-method="POINT"] uni-button').click();
    assert.equal(await field(merchant,'组合固定价格').locator('input').inputValue(),'59.00');
    await fill(merchant,'组合固定价格','60.00');
    await merchant.locator('[data-method="HOME"] button,[data-method="HOME"] uni-button').click();
    assert.equal(await field(merchant,'组合固定价格').locator('input').inputValue(),'89.00');
    await fill(merchant,'组合固定价格','91.00');
    await merchant.locator('[data-method="HOME"] uni-checkbox').click();
    await merchant.locator('[data-method="HOME"] uni-checkbox').click();
    assert.equal(await field(merchant,'组合固定价格').locator('input').inputValue(),'91.00');
    await merchant.locator('[data-method="HOME"] uni-checkbox').click();
    assert.equal(await merchant.locator('.price-section:visible').count(),1);
    await layout(merchant,'spec-editor-414','保存规格');
    await button(merchant,'保存规格').click();
    await merchant.waitForURL(/service\/action/);
    await merchant.waitForFunction(()=>{const card=document.querySelector('.spec-card');return card&&!card.textContent.includes('上门')});
    assert.equal(await field(merchant,'服务简介').locator('input,textarea').first().inputValue(),'子页返回保留供给说明');
    assert.ok((await merchant.locator('.spec-card').first().innerText()).includes('预约到店'));
    assert.ok(!(await merchant.locator('.spec-card').first().innerText()).includes('上门'));
    await merchant.locator('.spec-card').first().click();
    await merchant.waitForURL(/service\/spec\?/);
    assert.equal(await merchant.locator('.method-cards .selected').count(),1);
  });
  await step("F03 资格类目层级多选、材料独立编辑无重复类目",async()=>{
    await go(merchant,'service/qualification');
    await action(merchant,'编辑申请');
    await merchant.locator('.category-picker').waitFor();
    await merchant.locator('.category-trigger').first().click();await merchant.locator('.level-two uni-button').first().click();await button(merchant.locator('.category-panel'),'确定').click();
    await shot(merchant,'qualification-category-picker');
    await button(merchant,'添加材料').click();
    await merchant.waitForURL(/service\/material\?/);
    assert.equal(await field(merchant,'对应服务类目').count(),0);
    await field(merchant,'材料名称').waitFor();
    await layout(merchant,'qualification-material-414','保存材料');
    await fill(merchant,'材料名称','复验服务材料');
    await button(merchant,'保存材料').click();
    await merchant.locator('.material-card').filter({hasText:'复验服务材料'}).waitFor();
  });
  await step("Web 全部服务菜单、新订单页签与双分辨率", async () => {
    for (const menu of [
      "qualifications",
      "personnel",
      "categories",
      "review",
      "orders",
      "aftersales",
      "evaluations",
    ]) {
      await go(web, menu);
      await web.locator(".service-workspace").waitFor();
      assert.equal(await web.locator(".notice.error:visible").count(), 0);
    }
    await go(web, "orders");
    const row = web.locator('[data-record="' + H + '"]');
    await row.getByRole("button", { name: "查看详情", exact: true }).click();
    const drawer = web.locator(".service-detail-drawer:visible");
    await drawer.waitFor();
    const checkVerification = async id => {
      const order = await api(web,"record",["orders",id]);
      assert.equal(order.服务码状态,"已核验");
      assert.equal(order.credential.服务码,undefined);
      for (const name of ["服务码状态","核验操作人","核验时间"]) {
        const field = drawer.locator('[data-field="flow2:'+name+'"] dd:visible').first();
        await field.waitFor();
        assert.equal((await field.innerText()).trim(),order[name]);
      }
    };
    await checkVerification(H);
    for (const t of ["订单信息", "服务结果", "支付结果", "取消与售后"]) {
      await drawer.getByText(t, { exact: true }).first().click();
      await shot(web, "web-" + t);
    }
    await layout(web, "web-1366");
    await web.setViewportSize({ width: 1920, height: 1080 });
    await layout(web, "web-1920");
    await drawer.locator(".ivu-drawer-close").click();
    await web.locator('[data-record="'+P+'"]').getByRole("button",{name:"查看详情",exact:true}).click();
    await drawer.getByText("订单信息",{exact:true}).first().click();
    await checkVerification(P);
    return { H, P };
  });
  await step("F04 Web居中分类、审核分组主图、售后双页签及评价订单链接",async()=>{
    await go(web,'categories');
    const tree=web.locator('.tree-toggle').first();
    await tree.click(); await tree.click();
    await web.getByRole('button',{name:'添加一级分类',exact:true}).click();
    const modal=web.locator('.ivu-modal:visible');
    await modal.waitFor();
    const box=await modal.boundingBox();
    assert.ok(box.width<=700 && box.x>100,'分类使用居中弹窗');
    assert.equal(await modal.getByText('暂存',{exact:true}).count(),0);
    await modal.getByRole('button',{name:'确定',exact:true}).waitFor();
    for (const field of ['类目说明','商户证明是否必需','人员证明是否必需'])
      assert.equal(await modal.getByText(field,{exact:true}).count(),0);
    await shot(web,'category-modal-1920');
    await modal.getByRole('button',{name:'取消',exact:true}).click();
    await go(web,'review');
    await web.locator('[data-record="SV-HOME"]').getByRole('button',{name:'查看详情',exact:true}).click();
    const drawer=web.locator('.service-detail-drawer:visible');
    await drawer.getByText('服务内容',{exact:true}).first().click();
    assert.ok((await drawer.innerText()).includes('2. 服务介绍'));
    assert.equal(await drawer.getByText('关联信息',{exact:true}).count(),0);
    await drawer.locator('.compact-files img').first().waitFor();
    await shot(web,'review-content-thumbnail');
    await go(web,'aftersales');
    assert.equal(await web.locator('[data-action="aftersale.ruling"],[data-action="aftersale.rulingNote"]').count(),0);
    await web.locator('[data-record]').first().getByRole('button',{name:'查看详情',exact:true}).click();
    await web.locator('.service-detail-drawer:visible .ivu-tabs-tab').first().waitFor();
    assert.deepEqual((await web.locator('.service-detail-drawer:visible .ivu-tabs-tab').allTextContents()).map(t=>t.trim()),['售后详情','执行与退款']);
    await shot(web,'aftersale-two-tabs');
    await go(web,'evaluations');
    await web.locator('[data-record] button').filter({hasText:H}).click();
    await web.waitForURL(/service\/orders/);
    await web.locator('.service-detail-drawer:visible').waitFor();
    assert.ok((await web.locator('.service-detail-drawer:visible').innerText()).includes(H));
    await web.goBack();
    await web.waitForURL(/service\/evaluations/);
  });
  await step("F05 商户资金分组及公共查询页面",async()=>{
    await go(merchant,'service/funds');
    await merchant.locator('.fund-summary-grid').first().waitFor();
    const split=(await api(merchant,'query',['funds'])).find(f=>f['资金类型']==='分账'&&f._order===H);
    assert.ok(split);
    await merchant.locator('.record-card').filter({hasText:H}).click();
    await merchant.locator('.fund-details').waitFor();
    assert.ok((await merchant.locator('.fund-details').innerText()).includes('89.00'));
    await layout(merchant,'merchant-funds-414');
    await go(resident,'stage01/fees/index');
    await resident.locator('.filter-bar').waitFor();
    await layout(resident,'resident-fees-filter-414');
  });
  await step("G12 公共只读行、管理端既有入口", async () => {
    const staff = await context.newPage();
    await staff.goto(
      `${base}/staff/?session=${session}#/pages/workbench/index`,
    );
    await staff.locator('.portal[data-app="staff"]').waitFor();
    assert.equal(await staff.locator(".form-field--readonly input").count(), 0);
    await shot(staff, "staff-workbench");
    await staff.goto(`${base}/staff/?session=${session}#/pages/stage01/tasks/index`);
    await staff.locator('.filter-bar').waitFor();
    await staff.locator('.filter-triggers uni-button,.filter-triggers button').filter({hasText:'状态'}).click();
    await staff.locator('.filter-options').waitFor();
    await shot(staff,'staff-workorders-filter');
    await staff.close();
    return "Staff workbench visible";
  });
  await step('R2 日期筛选、七状态单行、人员按钮和资金入口一致',async()=>{
    for (const p of [resident, merchant]) {
      await go(p,'service/orders');
      const tabs=await p.locator('.status-tabs uni-button').evaluateAll(nodes =>
        nodes.map(node => Math.round(node.getBoundingClientRect().y)));
      assert.equal(tabs.length,7);
      assert.equal(new Set(tabs).size,1);
      const dateTrigger=p.locator('.filter-triggers .wide');
      for (const preset of ['近7天','近30天','近90天']) {
        await dateTrigger.click();
        await button(p.locator('.date-panel'),preset).click();
        assert.ok((await dateTrigger.innerText()).includes(preset));
        await p.locator('.record-card').first().waitFor();
      }
      await dateTrigger.click();
      await p.locator('.date-range uni-picker').first().click();
      await p.locator('.uni-picker-action-confirm:visible').click();
      await p.locator('.date-panel').waitFor();
      await button(p.locator('.date-panel'),'确定范围').click();
      assert.match(await dateTrigger.innerText(),/\d{4}-\d{2}-\d{2}\s*至\s*\d{4}-\d{2}-\d{2}/);
      await p.locator('.record-card').first().waitFor();
      await layout(p,'order-filter-'+appFor(p));
    }
    await go(merchant,'service/personnel');assert.ok(await merchant.locator('.card-actions').count()>0);
    await go(merchant,'workbench/index');await merchant.locator('.metrics uni-button').filter({hasText:'期间支付成功金额'}).click();await merchant.waitForURL(/service\/funds/);await merchant.locator('.fund-summary-grid').first().waitFor();const paid=(await merchant.locator('.record-card').allTextContents()).map(t=>t.replace(/\s/g,''));
    await go(merchant,'workbench/index');await merchant.locator('.metrics uni-button').filter({hasText:'商户净实分金额'}).click();await merchant.waitForURL(/service\/funds/);await merchant.locator('.fund-summary-grid').first().waitFor();assert.deepEqual((await merchant.locator('.record-card').allTextContents()).map(t=>t.replace(/\s/g,'')),paid);
  });
  await step('R2 Web审核直接可见送审内容及材料，分类方式多选卡片',async()=>{
    const v=await api(merchant,'record',['services','SV-FAN']);
    const imageBytes=fs.readFileSync(path.join(root,'.runtime/stage02/fixtures/demo-service.png')).toString('base64');
    const owned=await merchant.evaluate(async b64=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const a=createBrowserAdapter('merchant');await a.start();return a.service.upload(new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],'审核主图.png',{type:'image/png'}))},imageBytes);
    v['服务主图']=[owned];v['介绍图片']=[];
    await api(merchant,'command',['service.saveAndSubmit',{id:v._id,revision:v._rev,operationId:'review-context-submit',data:{...v,服务简介:'待审核内容上下文检查'}}]);
    await go(web,'review');await web.locator('[data-record="SV-FAN"] [data-action="service.review"]').click();
    const drawer=web.locator('.service-action-drawer:visible');
    await drawer.getByRole('heading',{name:'基本信息',exact:true}).waitFor();
    assert.deepEqual(await drawer.locator('.action-review-panel h3').allTextContents(),['基本信息','规格与方式']);
    assert.equal(await drawer.locator('.action-review-panel details').count(),0);
    assert.equal(await drawer.getByText('当前送审版本',{exact:true}).count(),0);
    assert.equal(await drawer.locator('.ivu-tabs-tab').count(),0);
    assert.equal(await drawer.locator('.action-review-panel').evaluate(e=>getComputedStyle(e).overflowY),'visible');
    assert.ok((await drawer.innerText()).includes('待审核内容上下文检查'));
    assert.ok((await drawer.innerText()).includes('59.00'));
    assert.equal(await drawer.getByText('规格名称',{exact:true}).count(),1,'同一规格的两种方式只展示一次规格名称');
    assert.equal(await drawer.getByText('报价（元）',{exact:true}).count(),2);
    assert.ok((await drawer.innerText()).includes('青禾社区便民服务点'));
    assert.equal(await drawer.getByText('地点业务编号',{exact:true}).count(),0);
    for (const obsolete of ['当前状态','服务详细说明','包含内容','组合计价方式','规格启用状态'])
      assert.equal(await drawer.getByText(obsolete,{exact:true}).count(),0);
    assert.equal((await api(web,'record',['services','SV-FAN'])).上架状态,'已下架');
    assert.equal((await api(web,'record',['services','SV-FAN'])).接收新预约状态,'暂停');
    assert.ok(!(await api(resident,'query',['services'])).some(row=>row._id==='SV-FAN'));
    await shot(web,'web-review-context');
    await drawer.getByRole('button',{name:'拒绝',exact:true}).click();
    const confirmation=web.locator('.supply-review-confirmation:visible');
    await confirmation.getByRole('button',{name:'取消',exact:true}).click();
    assert.equal((await api(web,'record',['services','SV-FAN'])).审核状态,'待审核');
    await drawer.getByRole('button',{name:'拒绝',exact:true}).click();
    await confirmation.getByRole('button',{name:'确定',exact:true}).click();
    await drawer.waitFor({state:'hidden'});
    const rejected=await api(merchant,'record',['services','SV-FAN']);
    assert.equal(rejected.审核状态,'退回');
    assert.equal(rejected.上架状态,'已下架');
    await api(merchant,'command',['service.saveAndSubmit',{id:rejected._id,revision:rejected._rev,operationId:'review-context-resubmit',data:{...v,服务简介:'重提通过内容'}}]);
    await go(web,'review');await web.locator('[data-record="SV-FAN"] [data-action="service.review"]').click();
    await drawer.getByRole('button',{name:'通过',exact:true}).click();
    await confirmation.getByRole('button',{name:'确定',exact:true}).click();
    await drawer.waitFor({state:'hidden'});
    const published=await api(web,'record',['services','SV-FAN']);
    assert.equal(published.上架状态,'已上架');
    assert.equal(published.接收新预约状态,'接收中');
    assert.equal(published.当前发布版本,published.送审版本);
    assert.equal((await api(resident,'record',['services','SV-FAN'])).服务简介,'重提通过内容');
    await go(web,'categories');await web.getByRole('button',{name:'添加一级分类',exact:true}).click();assert.equal(await web.locator('.ivu-modal:visible .method-options').first().locator('button').count(),2);await shot(web,'category-method-cards');
    const q=(await api(merchant,'query',['qualifications']))[0];
    const qs=await api(merchant,'command',['qualification.save',{id:q._id,revision:q._rev,operationId:'review-qualification-save',data:{申请服务类目:q['申请服务类目'],申请覆盖社区:q['申请覆盖社区'],申请覆盖小区:q['申请覆盖小区'],申请说明:'复验审核上下文'}}]);
    await api(merchant,'command',['qualification.submit',{id:qs.id,revision:qs.record._rev,operationId:'review-qualification-submit',data:{}}]);
    await go(web,'qualifications','property-admin');await web.locator('[data-record="'+q._id+'"] [data-action="qualification.review"]').click();
    await web.locator('.action-review-panel').waitFor();assert.ok((await web.locator('.action-review-panel').innerText()).includes('复验审核上下文'));
    await web.getByRole('button',{name:'确认审核结果'}).waitFor();assert.ok((await web.locator('.action-review-panel').innerText()).includes('材料'));
    await shot(web,'qualification-review-context');
    await go(web,'personnel');await web.locator('[data-record="P-A"] [data-action="personnel.review"]').click();
    await web.locator('.action-review-panel').waitFor();assert.ok((await web.locator('.action-review-panel').innerText()).includes('陈师傅'));
    await web.locator('.review-tabs').getByText('证明材料',{exact:true}).click();await shot(web,'personnel-review-context');
  });
  await step('R2 退款申请金额默认、草稿恢复、首页责任待办与协商完成',async()=>{
    await go(resident,'service/orders','resident-a');
    await go(merchant,'workbench/index','service-merchant-a');
    const options=await api(merchant,'options');
    const before=(await api(merchant,'overview')).values['当前售后待处理数'];
    const command=async(p,name,r,data={})=>(await api(p,'command',[name,{id:r?._id,revision:r?._rev,operationId:'refund-ui-'+name+'-'+Date.now(),data}])).record;
    let order=await command(resident,'order.create',null,{选定服务项目:'SV-HOME',选定服务规格:'SPEC-HOME',选定履约方式:'HOME',联系人姓名:'林悦',联系人电话:'13800000001',上门服务地址:(await api(resident,'query',['addresses']))[0],履约小区:'E-A',期望时间选择:'时间可协商',服务约定确认:true});
    order=await command(resident,'order.pay',order);
    order=await command(merchant,'order.accept',order,{服务人员:'P-A',安排服务日期:options.today,安排开始时间:'00:00',安排结束时间:'23:59'});
    order=await command(merchant,'order.result',order,{实际完成内容:'售后默认值独立验证单已完成',服务码:(await api(resident,'record',['orders',order._id])).服务码});
    let sale=await command(resident,'aftersale.apply',order,{申请类型:'申请退款',申请原因:'清洁遗漏',申请退款金额:'20.00',期望解决方式:'协商解决',问题证据:[]});
    await go(merchant,'workbench/index');
    const todo=merchant.locator('.metrics uni-button').filter({hasText:'售后待办'});
    assert.ok((await todo.innerText()).includes(String(Number(before)+1)));
    await todo.click();await merchant.waitForURL(/service\/aftersales/);
    await button(merchant.locator('[data-record="'+sale._id+'"]'),'去处理').click();await merchant.locator('.sale-tabs .current').filter({hasText:'处理方案'}).waitFor();
    assert.equal(await merchant.getByText('追加证据',{exact:true}).count(),0);
    assert.equal(await merchant.getByText('补充证据',{exact:true}).count(),0);

    assert.equal(Number(await field(merchant,'拟退款金额').locator('input').inputValue()),20);
    await fill(merchant,'拟退款金额','18.00');await fill(merchant,'金额依据说明','扣除已完成部分');await fill(merchant,'方案说明','协商退还18元');
    await merchant.waitForTimeout(300);await merchant.reload();await field(merchant,'拟退款金额').waitFor();
    assert.equal(Number(await field(merchant,'拟退款金额').locator('input').inputValue()),18);
    await fill(merchant,'拟退款金额','20.00');await fill(merchant,'方案说明','协商退还20元');await shot(merchant,'refund-default-draft');await submit(merchant,'提交处理方案');
    assert.equal((await api(merchant,'query',['aftersales',{pendingForMerchant:true}])).some(x=>x._id===sale._id),false);
    await go(resident,'service/after-sale?id='+sale._id);
    sale=await api(resident,'record',['aftersales',sale._id]);
    const respond=sale._actions.find(a=>a.name==='aftersale.respond');assert.ok(respond);
    await button(resident,respond.label).click();await resident.locator('.uni-modal__btn_default').click();assert.equal((await api(resident,'record',['aftersales',sale._id])).售后状态,'待居民确认方案');await button(resident,respond.label).click();await resident.locator('.uni-modal__btn_primary').click();await resident.waitForFunction(()=>!document.querySelector('.sale-buttons'));
    sale=await api(merchant,'record',['aftersales',sale._id]);
    if(sale['售后状态']==='待执行')await command(merchant,'aftersale.execute',sale);
    const done=await api(merchant,'record',['orders',order._id]);
    assert.equal(done.fundRecords.filter(f=>f['资金类型']==='退款'&&f['资金状态']==='成功').reduce((sum,f)=>sum+f._amount,0),2000);
    assert.equal((await api(merchant,'overview')).values['当前售后待处理数'],before);
    return {order:order._id,sale:sale._id,initialAmount:20,restoredDraftAmount:18,refund:20};
  });
  await step('R2 商户文件打开、两类管理员预览材料及平台整份批准',async()=>{
    await go(web,'qualifications','property-admin');
    let q=await api(web,'record',['qualifications','Q-A']);
    if(q['申请状态']==='待审核')q=(await api(web,'command',['qualification.review',{id:q._id,revision:q._rev,operationId:'material-context-return-'+Date.now(),data:{审核结果:'退回修改',审核意见:'测试资料上下文'}}])).record;
    const bytes=fs.readFileSync(path.join(root,'.runtime/stage02/fixtures/demo-service.png')).toString('base64');
    const proof=await merchant.evaluate(async b64=>{const {createBrowserAdapter}=await import('/_shared/storage-h5.js');const a=createBrowserAdapter('merchant');await a.start();return a.service.upload(new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],'审核证明.png',{type:'image/png'}))},bytes);
    const textProof=await merchant.evaluate(async ()=>{
      const {createBrowserAdapter}=await import('/_shared/storage-h5.js');
      const adapter=createBrowserAdapter('merchant');
      return adapter.service.upload(new File(['第19轮验收材料'],'验收证明.txt',{type:'text/plain'}));
    });
    const saved=await api(merchant,'command',['qualification.save',{id:q._id,revision:q._rev,operationId:'material-context-save-'+Date.now(),data:{服务资质材料:[{材料名称:'整份申请证明',长期有效:true,证明文件:[proof,textProof]}]}}]);
    await api(merchant,'command',['qualification.submit',{id:q._id,revision:saved.record._rev,operationId:'material-context-submit-'+Date.now(),data:{}}]);
    await go(merchant,'service/qualification');
    await button(merchant,'资格材料').click();
    const fileRow=merchant.locator('.file-attachment-row').filter({hasText:'验收证明.txt'}).first();
    await fileRow.waitFor();
    assert.match(await fileRow.innerText(), /KB/);
    const [download]=await Promise.all([merchant.waitForEvent('download'),button(fileRow,'打开').click()]);
    assert.equal(download.suggestedFilename(),'验收证明.txt');
    await shot(merchant,'compact-file-row');
    await go(web,'qualifications','property-admin');await web.locator('[data-record="Q-A"] [data-action="qualification.review"]').click();
    await web.getByRole('button',{name:'确认审核结果'}).waitFor();
    const panel=web.locator('.action-review-panel');await panel.getByText('整份申请证明',{exact:true}).first().waitFor();
    const thumb=panel.locator('img').first();await thumb.waitFor();assert.ok(await thumb.evaluate(e=>e.complete&&e.naturalWidth>0));
    await thumb.click();await web.locator('.ivu-modal:visible img').waitFor();await shot(web,'qualification-proof-preview');
    await go(web,'qualifications','platform-admin');
    await web.locator('[data-record="Q-A"] [data-action="qualification.review"]').click();
    const platformPanel=web.locator('.action-review-panel:visible');
    await platformPanel.getByText('整份申请证明',{exact:true}).waitFor();
    assert.deepEqual(await platformPanel.locator('h3').allTextContents(),['基本信息','申请材料','审核处理']);
    for(const label of ['核验结论','核验意见','材料有效性']) assert.equal(await platformPanel.getByText(label,{exact:true}).count(),0);
    assert.equal(await platformPanel.evaluate(e=>getComputedStyle(e).overflowY),'visible');
    for (const extra of ['批准服务类目','批准覆盖小区'])
      assert.equal(await web.locator('.service-action-drawer:visible').getByText(extra,{exact:true}).count(),0);
    const qualification=await api(web,'record',['qualifications','Q-A']);
    const result=web.locator('.service-action-drawer:visible .ivu-select[aria-label="审核结果"]');
    await result.click();
    await web.locator('.ivu-select-dropdown:visible .ivu-select-item').filter({hasText:/^通过$/}).click();
    await web.getByRole('button',{name:'确认审核结果',exact:true}).click();
    const reviewConfirm=web.locator('.ivu-modal:visible').filter({hasText:'确认经营资格审核结果'});
    await reviewConfirm.getByRole('button',{name:'取消',exact:true}).click();
    assert.equal((await api(web,'record',['qualifications','Q-A'])).申请状态,'待审核');
    await web.getByRole('button',{name:'确认审核结果',exact:true}).click();
    await reviewConfirm.getByRole('button',{name:'确定',exact:true}).click();
    await web.locator('.service-action-drawer:visible').waitFor({state:'hidden'});
    const approved=await api(web,'record',['qualifications','Q-A']);
    assert.equal(approved.申请状态,'已通过');
    assert.deepEqual(approved.获准服务类目,qualification.申请服务类目);
    assert.deepEqual(approved.获准小区,qualification.申请覆盖小区);
    return {material:'整份申请证明',authorized:['property-admin','platform-admin'],approvedCategories:approved.获准服务类目,approvedEstates:approved.获准小区};
  });
  await step('评价显示和隐藏同步公开页，Web 详情无监管记录页签',async()=>{
    await go(web,'evaluations','platform-admin');
    const review=web.locator('[data-record]').filter({hasText:H}).first();
    await review.getByRole('button',{name:'查看详情',exact:true}).click();
    const detail=web.locator('.service-detail-drawer:visible');
    await detail.waitFor();
    assert.equal(await detail.getByText('监管记录',{exact:true}).count(),0);
    await detail.locator('.ivu-drawer-close').click();
    const count=async()=>(await api(resident,'record',['services','SV-HOME'])).evaluations.length;
    const before=await count();
    await review.getByRole('button',{name:'限制展示',exact:true}).click();
    const modal=web.locator('.ivu-modal-confirm:visible');
    await modal.getByText(/不得仅因低分/).waitFor();
    await modal.getByRole('button',{name:'确定',exact:true}).click();
    await review.getByText('隐藏',{exact:true}).waitFor();
    assert.equal(await count(),before-1);
    await review.getByRole('button',{name:'恢复展示',exact:true}).click();
    await modal.getByRole('button',{name:'确定',exact:true}).click();
    await review.getByText('显示',{exact:true}).waitFor();
    assert.equal(await count(),before);
  });
  await step('通用 Web 业务按钮、两端排序和紧凑小程序按钮',async()=>{
    await go(web,'orders','property-admin');
    const categoryMenu=web.locator('.sidebar-menu-con .ivu-menu-item').filter({hasText:'服务分类'});
    assert.equal(await categoryMenu.count(),0);
    const header=web.locator('.header-right');
    await header.locator('button').filter({hasText:'切换身份'}).click();
    await header.locator('.ivu-dropdown-item').filter({hasText:'平台管理员'}).click();
    await header.locator(':scope > span').filter({hasText:'平台管理员'}).waitFor();
    await web.waitForTimeout(450);
    await web.waitForFunction(() => {
      const sidebar=document.querySelector('.sidebar-menu-con');
      const category=[...(sidebar?.querySelectorAll('.ivu-menu-item') || [])]
        .find(item=>item.textContent.trim()==='服务分类');
      if(!category)return false;
      const item=category.getBoundingClientRect();
      const menu=sidebar.getBoundingClientRect();
      return item.height>0 && item.top>=menu.top && item.bottom<=menu.bottom;
    });
    await categoryMenu.click();
    await web.waitForURL(/service\/categories/);
    assert.equal((await api(web,'options')).actor.role,'platform');
    await shot(web,'platform-category-entry');
    for (const width of [1366,1920]) {
      await web.setViewportSize({width,height:width===1366?768:1080});
      for (const route of ['spaces','residents','applications','missing','vehicles','facilities','personnel','files',
        'property/bills','property/bills/import','property/payments','parking/business','workorders/tasks',
        'service/categories','service/qualifications','service/personnel','service/review','service/orders','service/aftersales','service/evaluations']) {
        await web.goto(base+'/web/?session='+session+'#/'+route);
        await web.reload({waitUntil:'networkidle'});
        await web.mouse.move(width-2,2);
        await web.locator('.single-page-con .ivu-btn:visible').first().waitFor();
         const errors=await web.evaluate(()=>{
           const visible=selector=>[...document.querySelectorAll(selector)].filter(e=>e.getBoundingClientRect().width>0);
           const issues=[];
           for(const el of visible('.table-actions .ivu-btn:not([disabled]),.s1-list-actions .ivu-btn:not([disabled]),.action-column .ivu-btn:not([disabled])')) {
             const c=getComputedStyle(el);
             if(c.color!=='rgb(23, 102, 191)'||c.backgroundColor!=='rgba(0, 0, 0, 0)'||c.borderTopColor!=='rgba(0, 0, 0, 0)')issues.push(el.textContent);
           }
           for(const el of visible('.single-page-con .ivu-btn-primary:not([disabled])')){
             if(!el.closest('.table-actions,.s1-list-actions,.action-column')&&getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)')issues.push(el.textContent);
           }
           return issues;
         });
         assert.deepEqual(errors,[],route+' 行操作及页面主按钮');
         assert.ok(await web.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route);
      }
    }
    const sorts=['下单从新到旧','下单从旧到新','价格从低到高','价格从高到低'];
    for (const p of [resident,merchant]) {
      await go(p,'service/orders');
      await p.locator('.record-card').first().waitFor();
      const orders=new Map((await api(p,'query',['orders'])).map(row=>[row._id,row]));
      for (const label of sorts) {
        await p.locator('.filter-triggers uni-button').filter({hasText:/排序|下单从|价格从/}).click();
        await button(p.locator('.filter-options'),label).click();
        assert.equal(await p.locator('.filter-triggers uni-button').filter({hasText:label}).count(),1);
        const ids=await p.locator('.record-card').evaluateAll(nodes=>nodes.map(node=>node.dataset.record));
        assert.ok(ids.length>=2);
        const values=ids.map(id=>label.startsWith('价格') ? Number(orders.get(id)._amount||0) : orders.get(id).创建时间);
        const expected=values.slice().sort((a,b)=>typeof a==='number' ? a-b : a.localeCompare(b));
        if(label.endsWith('新到旧')||label.endsWith('高到低'))expected.reverse();
        assert.deepEqual(values,expected,label);
      }
      assert.equal(await p.getByText('服务日期',{exact:true}).count(),0);
      assert.equal(await p.locator('.date-summary').count(),0);
    }
    await go(merchant,'service/supply');
    const newService=button(merchant,'新增服务项目');
    assert.equal(await newService.evaluate(e=>getComputedStyle(e).fontSize),'14px');
    assert.equal(await newService.evaluate(e=>e.getBoundingClientRect().height),44);
    assert.equal(await merchant.locator('.filter-triggers').getByText('服务分类',{exact:true}).count(),0);
    await shot(merchant,'compact-add-service');
    await go(resident,'service/catalog');
    await resident.locator('.filter-triggers uni-button').filter({hasText:'排序'}).click();
    await button(resident.locator('.filter-options'),'价格从低到高').click();
    assert.equal(await resident.locator('.filter-triggers').getByText('价格从低到高',{exact:true}).count(),1);
    await shot(resident,'catalog-sort');
  });
  await step('清单3 住户服务总入口、便民目录及返回',async()=>{
    for(const width of [390,414]){
      await resident.setViewportSize({width,height:width===390?844:896});
      await go(resident,'service/index','resident-a');
      for(const id of ['fees','parking','houses','repair','catalog','service-orders','resident-aftersales'])
        await resident.locator('[data-module="'+id+'"]').waitFor();
      assert.equal(await resident.locator('.service-page').count(),0);
      await resident.locator('[data-module="catalog"]').click();
      await resident.waitForURL(/service\/catalog/);
      await resident.locator('.filter-triggers').waitFor();
      await resident.locator('.navbar__back:visible').click();
      await resident.locator('[data-module="fees"]:visible').waitFor();
    }
    await shot(resident,'resident-service-directory');
    await go(merchant,'order/index','service-merchant-a');
    await button(merchant,'售后处理').waitFor();
    assert.equal(await merchant.locator('.section-heading').filter({hasText:'服务订单'}).count(),0);
    await button(merchant,'售后处理').click();
    await merchant.waitForURL(/service\/aftersales/);
  });
  await step('清单3 有效绑定选房、返回上门下单及本人地址隔离',async()=>{
    await go(resident,'service/booking?id=SV-HOME&spec=SPEC-HOME&method=HOME','resident-b');
    await resident.locator('.selected-address').click();
    await button(resident,'新增地址').click();
    await button(resident,'从我的房屋选择').click();
    await pick(resident,'绑定房屋',0);
    await fill(resident,'联系人电话','13800008888');
    await button(resident,'保存地址').click();
    await resident.waitForURL(/service\/booking/);
    await resident.getByText(/青禾.*101室/).first().waitFor();
    const saved=(await api(resident,'query',['addresses'])).find(a=>a.绑定房屋);
    assert.ok(saved?.所属小区 && saved.所属房屋);
    const preflight=await api(resident,'preflight',[{选定服务项目:'SV-HOME',选定服务规格:'SPEC-HOME',选定履约方式:'HOME',上门服务地址:{_id:saved._id},联系人姓名:'周宁',联系人电话:saved.联系人电话,期望时间选择:'时间可协商',服务约定确认:true}]);
    assert.equal(preflight.amount,'99.00');
    await shot(resident,'bound-address-return');
    await go(resident,'profile/addresses','resident-a');
    assert.ok(!(await api(resident,'query',['addresses'])).some(a=>a._id===saved._id));
  });
  await step('清单3 商户类目标签、全部可申请小区和早期阶段移动页面',async()=>{
    await go(merchant,'service/qualification');
    const approvedTags=merchant.locator('.category-tags:visible').first();
    await approvedTags.waitFor();
    const bounds=await approvedTags.boundingBox();
    const categoryField = merchant.locator('[data-field-name="获准服务类目"]:visible').first();
    const label = await categoryField.locator('.form-field__label-row').boundingBox();
    const fieldBox = await categoryField.locator('.form-field').boundingBox();
    assert.ok(bounds.y >= label.y + label.height && Math.abs(bounds.x-fieldBox.x)<=2 && Math.abs(bounds.width-fieldBox.width)<=2,'获准类目应该在字段名下方占满一行');
    assert.ok(bounds.y >= 0 && bounds.y+bounds.height <= (await merchant.viewportSize()).height-56,'获准类目在首屏可读');
    await shot(merchant,'merchant-qualification-tags');
    await action(merchant,'编辑申请');
    await merchant.locator('.category-trigger').first().click();
    const leafButtons=merchant.locator('.category-grid:visible uni-button');
    assert.ok(await leafButtons.count()>=1);
    await merchant.locator('.level-one:visible uni-button').filter({hasText:'家电清洗'}).first().click();
    const visibleTags=await leafButtons.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,h:r.height}}));
    assert.ok(visibleTags.length>=3 && visibleTags[1].x>visibleTags[0].x && Math.abs(visibleTags[0].y-visibleTags[1].y)<2 && visibleTags[0].h>=44);
    await shot(merchant,'merchant-category-panel');
    await button(merchant.locator('.category-panel:visible'),'确定').click();
    await merchant.locator('[data-field-name="申请覆盖小区"]').getByText('望江公寓',{exact:true}).waitFor();
    const staff=await context.newPage();
    for (const width of [390,414]){
      await staff.setViewportSize({width,height:width===390?844:896});
      for (const route of ['foundation/houses/index','stage01/tasks/index','stage01/charges/index']){
        await staff.goto(base+'/staff/?session='+session+'#/pages/'+route);
        await staff.locator('.navbar:visible').first().waitFor();
        await staff.locator('.filter-bar:visible,.base-card:visible,.empty-copy:visible,.form-field:visible').first().waitFor();
        assert.ok(await staff.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' 横向布局');
      }
    }
    await shot(staff,'staff-charges');
    await staff.close();
  });
  assert.deepEqual(errors, [], "No browser runtime errors");
  assert.deepEqual(blocked, [], "No external business requests");
} catch (error) {
  process.exitCode = 1;
  console.error(error.stack);console.error(JSON.stringify({resident:resident.url(),merchant:merchant.url(),web:web.url()}));
} finally {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(
      { base, session, H, P, hashes, profile:previous?(previous.profile||path.join(path.dirname(resumeFile),"profile")):path.join(out,"profile"), resumeFrom:resumeFile||null, recheckWeb, steps, errors, blocked },
      null,
      2,
    ),
  );
  console.log("Evidence: " + out);
  await context.close();
}



