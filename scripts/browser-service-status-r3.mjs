const evidenceSubdir =
  process.argv.find((a) => a.startsWith("--evidence="))?.slice(11) || "";
if (evidenceSubdir && !/^[a-zA-Z0-9-]+$/.test(evidenceSubdir))
  throw Error("Invalid evidence directory name");
import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  base = process.env.PREVIEW_BASE || 'http://127.0.0.1:19213';
const run =
    (process.argv.includes("--review-supply") ? "FLOWS-CUSTOM-" : "FLOWS-") +
    new Date().toISOString().replace(/[:.]/g, "-"),
  out = path.join(root, ".runtime/stage02", run),
  session = "stage02-" + run;
const artifactPaths = [
  "web/manager/dist/index.html",
  "miniapp/apps/resident-miniapp/dist/build/h5/index.html",
  "miniapp/apps/merchant-miniapp/dist/build/h5/index.html",
];
function artifactHashes() {
  return Object.fromEntries(
    artifactPaths.map((file) => [
      file,
      fs.existsSync(path.join(root, file))
        ? createHash("sha256")
            .update(fs.readFileSync(path.join(root, file)))
            .digest("hex")
        : null,
    ]),
  );
}
const artifactsBefore = artifactHashes();
const only = process.argv.find((x) => x.startsWith("--only="))?.slice(7);
const reviewSupply = process.argv.includes("--review-supply");
fs.mkdirSync(out, { recursive: true });
const image = path.join(root, ".runtime/stage02/fixtures/demo-service.png");
assert.ok(fs.existsSync(image), "Existing virtual image fixture");
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 390, height: 844 } },
);
context.setDefaultTimeout(14000);
const errors = [],
  blockedRequests = [],
  results = [],
  steps = [],
  artifacts = [];
context.on("page", (page) =>
  page.on("pageerror", (error) =>
    errors.push({ url: page.url(), message: error.message }),
  ),
);
await context.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith(base + "/") || /^(data:|blob:)/.test(url))
    return route.continue();
  blockedRequests.push(url);
  return route.abort();
});
const merchant = await context.newPage(),
  resident = await context.newPage(),
  web = await context.newPage();
await web.setViewportSize({ width: 1366, height: 768 });
async function checkDashboard(state, orderId) {
  if (!process.argv.includes('--integrated')) return;
  const dashboard = await context.newPage();
  try {
    await dashboard.goto(base + '/merchant/?session=' + session + '#/pages/workbench/index');
    await dashboard.locator('.metrics .metric-number').first().waitFor();
    await dashboard.waitForTimeout(250);
    const orders = await api(dashboard, 'query', ['orders', {}], 'merchant');
    const expected = orders.filter(r => r['当前业务进度'] === state).length;
    assert.ok(expected > 0, 'Expected live order at ' + state);
    const metric = dashboard.locator('.metrics button,.metrics uni-button').filter({hasText:state}).first();
    assert.equal(Number(await metric.locator('.metric-number').innerText()), expected);
    await metric.click();
    await dashboard.locator('.record-card').filter({hasText:orderId}).waitFor();
    assert.ok(dashboard.url().includes('/pages/order/index'));
  } finally { await dashboard.close(); }
}
async function api(page, method, args = [], app, account) {
  return page.evaluate(
    async ({ method, args, app, account }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js"),
        a = createBrowserAdapter(app);
      await a.start();
      if (account) await a.identity(account);
      return a.service[method](...args);
    },
    { method, args, app, account },
  );
}
async function go(page, app, name, account) {
  const integrated=process.argv.includes('--integrated');
  const portal=integrated&&app==='merchant'&&(name==='orders'||name==='supply');
  const catalog=integrated&&app==='resident'&&name==='catalog';
  const hash=app==='web'?'#/service/'+name:portal?'#/pages/'+(name==='orders'?'order':'operation')+'/index':catalog?'#/pages/home/index':'#/pages/service/'+name;
  await page.goto(base + "/" + app + "/?session=" + session + hash);
  if (account) {
    await api(page, "options", [], app, account);
    await page.reload();
  }
  if(catalog){await page.locator('[data-module="catalog"]').click();await page.waitForURL(/pages\/service\/catalog/)}
  await page.waitForTimeout(350);
  await page.waitForFunction(
    () => !document.querySelector(".page-state--loading"),
  );
  await page
    .locator(app === "web" ? ".service-workspace" : ".service-page")
    .waitFor();
}
const mb = (scope, label) =>
  scope
    .locator("uni-button:visible,button:visible")
    .filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") })
    .last();
const mf = (page, name) =>
  page.locator('[data-field-name="' + name + '"]:visible').first();
async function fill(page, name, value) {
  const f = mf(page, name);
  await f.waitFor();
  await f
    .locator("input:not([type=file]),textarea")
    .first()
    .fill(String(value));
}
async function pick(page, name, index, expected) {
  const picker = mf(page, name).locator("uni-picker").first();
  await picker.click();
  const column = page.locator("uni-picker-view-column:visible").first();
  await column.waitFor();
  const box = await column.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < index; i++) {
    await page.mouse.wheel(0, 34);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(450);
  await page.locator(".uni-picker-action-confirm:visible").click();
  if (expected)
    assert.ok(
      (await mf(page, name).innerText()).includes(expected),
      "Picker " + name + " selected " + expected,
    );
}
async function upload(page, name) {
  const field = mf(page, name);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    mb(field, "上传／拍照").click(),
  ]);
  await chooser.setFiles(image);
  await field.locator(".file-name").first().waitFor();
  await page.waitForTimeout(200);
  assert.equal(
    await field.locator(".error:visible").count(),
    0,
    "Upload success " + name,
  );
}
async function clickMobileAction(page, label) {
  const old = page.url();
  await page
    .locator(
      ".bottom-actions uni-button:visible,.bottom-actions button:visible,.secondary-links uni-text:visible",
    )
    .filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") })
    .last()
    .click();
  await page.waitForFunction(
    (old) =>
      location.href !== old ||
      Array.from(document.querySelectorAll(".uni-modal__btn_primary")).some(
        (x) => x.getBoundingClientRect().width > 0,
      ),
    old,
  );
  if (!(await page.locator(".uni-modal__btn_primary:visible").count()))
    await page.locator(".service-page .form-card:visible").waitFor();
}
async function submitMobile(page, label) {
  await page
    .locator(
      ".bottom-actions uni-button:visible,.bottom-actions button:visible",
    )
    .filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") })
    .last()
    .click();
  await page.waitForTimeout(500);
  const err = await page
    .locator(".service-page>.message.error:visible")
    .allTextContents();
  assert.deepEqual(err, [], "Form submission " + label + ": " + err.join(";"));
}
async function shot(page, name) {
  const file = path.join(out, name + ".png");
  await page.screenshot({ path: file, fullPage: !name.endsWith("-layout") });
  const relative = path.relative(root, file).replaceAll("\\", "/");
  artifacts.push(relative);
  return relative;
}
async function layout(page, name) {
  const field = page.locator(".form-card [data-field-name]:visible").last();
  // Sticky actions are already visible and do not move the form when scrolled.
  // Reach the last actual field first, just as the user scrolls through a long form.
  await field.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page
    .locator(".bottom-actions")
    .evaluate((el) => el.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(180);
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    viewportHeight: innerHeight,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.content <= dimensions.viewport,
    name + " no horizontal overflow",
  );
  const last = await field.boundingBox(),
    button = await page.locator(".bottom-actions").boundingBox();
  assert.ok(
    button &&
      button.y >= 0 &&
      button.y + button.height <= dimensions.viewportHeight + 1,
    name + " action visible inside viewport",
  );
  assert.ok(
    last && button && last.y >= 0 && last.y + last.height <= button.y + 1,
    name + " last field clear of fixed action",
  );
  return {
    dimensions,
    lastField: await field.getAttribute("data-field-name"),
    last,
    button,
    screenshot: await shot(page, name),
  };
}
async function record(page, table, id, app = "merchant") {
  return api(page, "record", [table, id], app);
}
async function waitRecord(page, table, id, predicate, app = "merchant") {
  let r;
  for (let i = 0; i < 25; i++) {
    r = await record(page, table, id, app);
    if (predicate(r)) return r;
    await page.waitForTimeout(200);
  }
  throw Error(
    "Persisted record expectation failed " + JSON.stringify(r).slice(0, 1800),
  );
}
async function step(flow, name, fn) {
  console.log(flow + " " + name);
  const started = new Date().toISOString();
  try {
    const detail = await fn();
    steps.push({ flow, name, status: "PASS", started, detail });
    return detail;
  } catch (error) {
    steps.push({ flow, name, status: "FAIL", started, error: error.message });
    throw error;
  }
}
function webField(name) {
  const drawer = web.locator(".service-action-drawer:visible").last();
  return drawer
    .locator(".service-field")
    .filter({
      has: web
        .locator("label")
        .filter({ hasText: new RegExp("^" + name + "(?: \\*)?$") }),
    })
    .first();
}
async function webReview(id) {
  await go(web, "web", "review", "property-admin");
  const r = web.locator('[data-record="' + id + '"]');
  await r.waitFor();
  await r.locator('[data-action="service.review"]').click();
  await webField("审核意见")
    .locator("textarea,input")
    .first()
    .fill("已按本次新建服务内容、规格、固定报价和资质审核");
  await web
    .locator('[data-action="submit:service.review"]:visible')
    .last()
    .click();
  await waitRecord(web, "services", id, (r) => r["审核状态"] === "通过", "web");
}
async function openMerchantService(id, name) {
  await go(merchant, "merchant", "supply");
  await merchant
    .locator(".record-card")
    .filter({ hasText: name })
    .first()
    .locator(".card-title")
    .click();
  await merchant.waitForTimeout(250);
  assert.ok(
    merchant.url().includes(encodeURIComponent(id)) ||
      merchant.url().includes(id),
  );
}
async function flow(mode, price) {
  const name = "主线验收" + mode + "-" + run.slice(-10),
    entry = { mode, price, name, session };
  let serviceId, orderId, configuredMethod;
  if (reviewSupply) {
    await go(web, "web", "categories", "platform-admin");
    const opts = await api(web, "options", [], "web");
    if (mode === "上门") {
      const home = (await api(web, "query", ["methods", {}], "web")).find(
        (m) => m._id === "HOME",
      );
      await api(
        web,
        "command",
        [
          "method.save",
          {
            id: home._id,
            revision: home._rev,
            operationId: run + "-rename-home",
            data: {
              履约方式名称: "预约上门",
              配置变更原因: "统一居民可见的上门名称",
              履约方式说明: "按双方确认安排上门",
              绑定流程模板: "上门",
            },
          },
        ],
        "web",
      );
    }
    const created = await api(
      web,
      "command",
      [
        "method.save",
        {
          operationId: run + "-new-" + mode,
          data: {
            履约方式名称: mode === "上门" ? "专业到家清洁" : "社区到站清洁",
            履约方式说明: "引用既有受控模板",
            绑定流程模板: mode,
          },
        },
      ],
      "web",
    );
    configuredMethod = created.record;
    const category = (await api(web, "query", ["categories", {}], "web")).find(
      (c) => c._id === "CAT-CLEAN",
    );
    await api(
      web,
      "command",
      [
        "category.save",
        {
          id: category._id,
          revision: category._rev,
          operationId: run + "-category-" + mode,
          data: {
            类目名称: category["类目名称"],
            允许履约方式: [...category["允许履约方式"], configuredMethod._id],
          },
        },
      ],
      "web",
    );
    entry.configurationFixture = {
      method: configuredMethod._id,
      name: configuredMethod["履约方式名称"],
      template: mode,
      preparation:
        "Legal platform Service commands only; supply/order/fulfillment performed through UI",
    };
  }
  const viewport =
    mode === "上门" ? { width: 390, height: 844 } : { width: 414, height: 896 };
  await merchant.setViewportSize(viewport);
  await resident.setViewportSize(viewport);
  entry.viewport = viewport;
  await step(mode, "new-supply-ui", async () => {
    await go(merchant, "merchant", "supply", "merchant");
    await mb(merchant, "新增服务项目").click();
    await fill(merchant, "服务名称", name);
    const o = await api(merchant, "options", [], "merchant");
    const index = o.categories.findIndex((c) => c._id === "CAT-CLEAN");
    assert.ok(index >= 0);
    await pick(merchant, "所属服务类目", index, "家庭保洁");
    await fill(merchant, "服务简介", "新建固定规格报价的真实UI验收服务");
    await fill(
      merchant,
      "服务详细说明",
      "本次服务在约定时间完成指定区域清洁，人员与时间另行确认。",
    );
    await fill(merchant, "公开服务电话", "13800001111");
    await upload(merchant, "服务主图");
    await mb(merchant, "添加规格").click();
    await fill(merchant, "规格名称", "新建标准包");
    await fill(merchant, "规格说明", "一次预约仅本规格，价格固定");
    await fill(merchant, "包含内容", "本单约定区域的基础清洁与整理");
    await fill(merchant, "不包含内容", "高空作业、设备拆装和额外材料");
    if (reviewSupply) {
      if (mode === "上门")
        assert.ok(
          await merchant
            .locator("[data-method=HOME]")
            .innerText()
            .then((t) => t.includes("预约上门")),
          "Renamed method is selectable by stable ID",
        );
      await merchant
        .locator('[data-method="' + configuredMethod._id + '"]')
        .click();
      await pick(
        merchant,
        "服务对象填写要求",
        mode === "上门" ? 0 : 2,
        mode === "上门" ? "不需要" : "必填",
      );
      if (mode !== "上门")
        await fill(merchant, "服务对象填写提示", "请说明本次到点清洁对象");
    } else
      await mb(
        merchant,
        mode === "上门" ? "添加上门报价" : "添加到点报价",
      ).click();
    await fill(merchant, "组合固定价格", price);
    if (mode === "预约到点") {
      await merchant.locator('[data-point="POINT-A"]').click();
      if (reviewSupply)
        await merchant.locator('[data-point="POINT-A2"]').click();
      assert.equal(
        await merchant.locator('[data-point="POINT-B"]').count(),
        0,
        "Other merchant point is not offered",
      );
      assert.equal(
        await merchant.locator('[data-point="POINT-A-OFF"]').count(),
        0,
        "Disabled point is not offered",
      );
    }
    await shot(merchant, mode + "-new-supply-form");
    if (mode === "上门") {
      await fill(merchant, "服务名称", "");
      await mb(merchant, "新增服务项目").click();
      await merchant
        .locator(".service-page > .message.error:visible")
        .waitFor();
      assert.equal(
        await mf(merchant, "组合固定价格").locator("input").inputValue(),
        price,
      );
      assert.equal(
        await mf(merchant, "规格名称").locator("input").inputValue(),
        "新建标准包",
      );
      assert.equal(
        await mf(merchant, "服务主图").locator(".file-name").count(),
        1,
        "Failed submit retains uploaded picture",
      );
      await shot(merchant, mode + "-validation-preserves-input");
      await fill(merchant, "服务名称", name);
      entry.validationRetained = true;
    }
    await submitMobile(merchant, "新增服务项目");
    const found = (
      await api(merchant, "query", ["services", {}], "merchant")
    ).find((r) => r["服务名称"] === name);
    assert.ok(found);
    serviceId = found._id;
    entry.serviceId = serviceId;
    return { id: serviceId, price, mainImage: found["服务主图"] };
  });
  await step(mode, "submit-review-ui", async () => {
    await openMerchantService(serviceId, name);
    await clickMobileAction(merchant, "提交审核");
    await submitMobile(merchant, "提交审核");
    await waitRecord(
      merchant,
      "services",
      serviceId,
      (r) => r["审核状态"] === "待审核",
    );
    return shot(merchant, mode + "-submitted-review");
  });
  await step(mode, "web-review-ui", async () => {
    await webReview(serviceId);
    return shot(web, mode + "-web-reviewed");
  });
  await step(mode, "publish-and-list-ui", async () => {
    await openMerchantService(serviceId, name);
    await clickMobileAction(merchant, "发布已审核版本");
    await submitMobile(merchant, "发布已审核版本");
    let r = await record(merchant, "services", serviceId);
    if (r["上架状态"] !== "已上架") {
      await openMerchantService(serviceId, name);
      await clickMobileAction(merchant, "上架服务");
      await submitMobile(merchant, "上架服务");
    }
    r = await waitRecord(
      merchant,
      "services",
      serviceId,
      (r) => r["上架状态"] === "已上架" && r.published,
    );
    assert.equal(r["服务规格集合"][0]["组合集合"][0]["组合固定价格"], price);
    return shot(merchant, mode + "-published");
  });
  await step(mode, "resident-book-and-pay-ui", async () => {
    await go(resident, "resident", "catalog", "resident-a");
    await resident
      .locator(".record-card")
      .filter({ hasText: name })
      .first()
      .locator(".card-title")
      .click();
    await mb(resident, "选择规格与服务方式").click();
    await mb(resident, "确认选择，去预约").click();
    await fill(resident, "联系人姓名", "林示例");
    await fill(resident, "联系人电话", "13800005555");
    await pick(resident, "期望时段偏好", 0, "上午");
    if (reviewSupply) {
      if (mode === "上门")
        assert.equal(
          await resident
            .locator('[data-field-name="服务对象描述"]:visible')
            .count(),
          0,
          "Not-needed object input is hidden",
        );
      else {
        await fill(resident, "服务对象描述", "本次一台可拆洗循环扇");
        await pick(resident, "到点服务地点", 1, "青禾东侧便民服务点");
      }
    }
    if (mode === "上门") {
      for (const [k, v] of Object.entries({
        省份: "江苏省",
        城市: "南京市",
        区县: "江宁区",
        楼栋: "1栋",
        单元: "1单元",
        门牌房号: "101",
        详细地址: "青禾花园1栋1单元101",
      }))
        await fill(resident, k, v);
    }
    entry.bookingLayout = await layout(resident, mode + "-booking-layout");
    if (mode === "上门") {
      await resident.locator(".navbar__back").click();
      await mb(resident, "选择规格与服务方式").click();
      await mb(resident, "确认选择，去预约").click();
      await mf(resident, "联系人姓名").waitFor();
      await resident.waitForTimeout(300);
      assert.equal(
        await mf(resident, "联系人姓名").locator("input").inputValue(),
        "林示例",
      );
      assert.equal(
        await mf(resident, "联系人电话").locator("input").inputValue(),
        "13800005555",
      );
      assert.equal(
        await mf(resident, "详细地址")
          .locator("input,textarea")
          .first()
          .inputValue(),
        "青禾花园1栋1单元101",
      );
      entry.bookingDraftRestored = true;
      await shot(resident, mode + "-booking-draft-restored");
    }
    await resident.locator(".agreement").click();
    await mb(resident, "提交并付款").click();
    await resident.locator(".uni-modal__btn_primary:visible").click();
    let found;
    for (let attempt = 0; attempt < 25; attempt++) {
      const orders = await api(resident, "query", ["orders", {}], "resident");
      found = orders.find((r) => r._service === serviceId);
      if (found) break;
      const messages = await resident
        .locator(".service-page > .message.error:visible")
        .allTextContents();
      if (messages.length)
        throw Error("Order form validation: " + messages.join(";"));
      await resident.waitForTimeout(200);
    }
    assert.ok(found, "Visible order submission created a persisted record");
    orderId = found._id;
    entry.orderId = orderId;
    const paid = await waitRecord(
      resident,
      "orders",
      orderId,
      (r) => r["支付状态"] === "成功",
      "resident",
    );
    assert.equal(paid._amount, Math.round(Number(price) * 100));
    if (reviewSupply) {
      assert.equal(paid._combo._method, configuredMethod._id);
      assert.equal(paid["履约方式名称"], configuredMethod["履约方式名称"]);
      assert.equal(paid._mode, mode);
      if (mode === "预约到点")
        assert.equal(paid["地点快照"]["地点业务编号"], "POINT-A2");
      else assert.equal(paid["服务对象描述"], "");
    }
    assert.equal(
      paid.fundRecords.filter((f) => f["资金类型"] === "支付").length,
      1,
    );
    await checkDashboard("待接单", orderId);
    return shot(resident, mode + "-payment-success");
  });
  await step(mode, "merchant-accept-and-arrange-ui", async () => {
    await go(merchant, "merchant", "orders");
    await merchant
      .locator(".record-card")
      .filter({ hasText: orderId })
      .first()
      .locator(".card-title")
      .click();
    await clickMobileAction(merchant, "接单并安排");
    await fill(merchant, "安排说明", "已联系居民，按本次人员与时间范围履行");
    await submitMobile(merchant, "接单并安排");
    const r = await waitRecord(
      merchant,
      "orders",
      orderId,
      (r) => r["安排状态"] === "待居民确认",
    );
    assert.ok(r.proposal);
    await checkDashboard("待确认安排", orderId);
    return shot(merchant, mode + "-arranged");
  });
  await step(mode, "resident-accept-arrangement-ui", async () => {
    await go(resident, "resident", "orders");
    await resident
      .locator(".record-card")
      .filter({ hasText: orderId })
      .first()
      .locator(".card-title")
      .click();
    await clickMobileAction(resident, "答复服务安排");
    await submitMobile(resident, "答复服务安排");
    const r = await waitRecord(
      resident,
      "orders",
      orderId,
      (r) => r["安排状态"] === "已确认",
      "resident",
    );
    assert.equal(r["结案结果"], "进行中");
    assert.equal(
      (await api(merchant, "query", ["funds", {}], "merchant")).filter(
        (f) => f._order === orderId && f["资金类型"] === "分账",
      ).length,
      0,
    );
    await api(
      merchant,
      "auxiliary",
      [
        "clock",
        { time: r.currentArrangement["安排服务日期"] + "T09:15:00+08:00" },
      ],
      "merchant",
    );
    await checkDashboard("预约已确认", orderId);
    return shot(resident, mode + "-resident-accepted");
  });
  await step(
    mode,
    mode === "上门" ? "arrive-ui" : "query-and-verify-ui",
    async () => {
      await go(merchant, "merchant", "orders");
      await merchant
        .locator(".record-card")
        .filter({ hasText: orderId })
        .first()
        .locator(".card-title")
        .click();
      if (mode === "上门") {
        await clickMobileAction(merchant, "记录到场");
        await fill(merchant, "到场说明", "已到达约定服务位置");
        await submitMobile(merchant, "记录到场");
      } else {
        const r = await record(merchant, "orders", orderId);
        await go(
          resident,
          "resident",
          "voucher?id=" + encodeURIComponent(orderId),
        );
        assert.ok(
          await resident.locator(".qr-box").count(),
          "Actual QR matrix rendered",
        );
        await shot(resident, mode + "-voucher-qr");
        await clickMobileAction(merchant, "到点核验");
        await merchant
          .locator(".form-field")
          .filter({ hasText: "凭证码" })
          .locator("input")
          .fill(r.credential["到点凭证码"]);
        await mb(merchant, "查询凭证").click();
        await mb(merchant, "确认到点").click();
        await merchant.locator(".uni-modal__btn_primary:visible").click();
      }
      const r = await waitRecord(merchant, "orders", orderId, (r) =>
        ["已到场", "已到点"].includes(r["履约状态"]),
      );
      assert.equal(r["结案结果"], "进行中");
      return shot(merchant, mode + "-arrived");
    },
  );
  await step(mode, "start-and-result-ui", async () => {
    await go(merchant, "merchant", "orders");
    await merchant
      .locator(".record-card")
      .filter({ hasText: orderId })
      .first()
      .locator(".card-title")
      .click();
    await clickMobileAction(merchant, "开始服务");
    await fill(merchant, "开始说明", "按本单规格开始执行");
    await submitMobile(merchant, "开始服务");
    await waitRecord(
      merchant,
      "orders",
      orderId,
      (r) => r["履约状态"] === "服务中",
    );
    await clickMobileAction(merchant, "追加过程");
    await pick(merchant, "过程记录类型", 0, "进度说明");
    await fill(
      merchant,
      "过程说明",
      "本单基础清洁已完成，正在检查约定区域与收尾整理",
    );
    await upload(merchant, "过程图片");
    await submitMobile(merchant, "追加过程");
    const progressed = await waitRecord(merchant, "orders", orderId, (r) =>
      r.rounds.some((round) => (round.process || []).length === 1),
    );
    entry.process = progressed.rounds.flatMap((round) => round.process || []);
    assert.equal(entry.process.length, 1);
    assert.equal(entry.process[0]["过程图片"].length, 1);
    await shot(merchant, mode + "-process-recorded");
    await clickMobileAction(merchant, "提交服务结果");
    await fill(
      merchant,
      "实际完成内容",
      "本单约定区域基础清洁与整理已全部完成",
    );
    await upload(merchant, "结果图片");
    await submitMobile(merchant, "提交服务结果");
    const r = await waitRecord(
      merchant,
      "orders",
      orderId,
      (r) => r["履约状态"] === "结果已提交",
    );
    assert.notEqual(r["居民完成确认状态"], "已确认");
    return shot(merchant, mode + "-result-submitted");
  });
  await step(mode, "resident-complete-and-split-ui", async () => {
    await go(resident, "resident", "orders");
    await resident
      .locator(".record-card")
      .filter({ hasText: orderId })
      .first()
      .locator(".card-title")
      .click();
    await clickMobileAction(resident, "确认履约结果");
    await resident.locator(".uni-modal__btn_primary:visible").click();
    const r = await waitRecord(
      merchant,
      "orders",
      orderId,
      (r) => r["结案结果"] === "正常完成",
    );
    const funds = r.fundRecords,
      pay = funds.filter((f) => f["资金类型"] === "支付"),
      split = funds.filter((f) => f["资金类型"] === "分账");
    assert.equal(pay.length, 1);
    assert.equal(split.length, 1);
    assert.equal(split[0]["资金状态"], "成功");
    assert.ok(r.ruleSnapshot);
    const alloc = r.ruleSnapshot.allocation;
    assert.equal(alloc.merchant + alloc.property, r._amount);
    assert.equal(alloc.amount, r._amount);
    assert.notEqual(alloc.merchant, 8900, "New price not hardcoded to89");
    entry.funds = { payment: pay[0], split: split[0], allocation: alloc };
    await shot(resident, mode + "-completed");
    await go(merchant, "merchant", "funds");
    return shot(merchant, mode + "-independent-funds");
  });
  await step(mode, "resident-evaluate-ui", async () => {
    await go(resident, "resident", "orders");
    await resident
      .locator(".record-card")
      .filter({ hasText: orderId })
      .first()
      .locator(".card-title")
      .click();
    await clickMobileAction(resident, "评价服务");
    await fill(
      resident,
      "评价内容",
      "按本单规格完成服务，过程有记录，人员与时间已事先确认。",
    );
    await upload(resident, "评价图片");
    entry.evaluationLayout = await layout(
      resident,
      mode + "-evaluation-layout",
    );
    await submitMobile(resident, "评价服务");
    let evaluations;
    for (let i = 0; i < 25; i++) {
      evaluations = (
        await api(resident, "query", ["evaluations", {}], "resident")
      ).filter((e) => e._order === orderId);
      if (evaluations.length) break;
      await resident.waitForTimeout(200);
    }
    assert.equal(evaluations.length, 1);
    assert.equal(evaluations[0]["总体评分"], 5);
    assert.equal(evaluations[0]["评价图片"].length, 1);
    entry.evaluationId = evaluations[0]._id;
    await resident.waitForURL(
      (u) =>
        u.hash.startsWith("#/pages/service/order?") &&
        decodeURIComponent(u.hash).includes(orderId),
    );
    await resident.locator(".service-page").waitFor();
    entry.evaluationReturnedToOrder = true;
    return {
      evaluationId: entry.evaluationId,
      screenshot: await shot(resident, mode + "-evaluation-submitted"),
    };
  });
  await step(mode, "refresh-and-reentry-no-duplicates", async () => {
    const before = await record(merchant, "orders", orderId);
    await resident.reload();
    await merchant.reload();
    await go(resident, "resident", "orders");
    await resident
      .locator(".record-card")
      .filter({ hasText: orderId })
      .first()
      .locator(".card-title")
      .click();
    const after = await record(merchant, "orders", orderId);
    assert.equal(after.fundRecords.length, before.fundRecords.length);
    assert.deepEqual(
      after.fundRecords.map((f) => f._id).sort(),
      before.fundRecords.map((f) => f._id).sort(),
    );
    assert.equal(after._amount, before._amount);
    assert.equal(after["结案结果"], "正常完成");
    entry.persistedAfterReentry = after;
    const evaluations = (
      await api(resident, "query", ["evaluations", {}], "resident")
    ).filter((e) => e._order === orderId);
    assert.equal(evaluations.length, 1);
    assert.equal(evaluations[0]._id, entry.evaluationId);
    assert.equal(
      (
        (await record(resident, "orders", orderId, "resident"))._actions || []
      ).filter((a) => a.name === "evaluation.save").length,
      0,
    );
    return {
      paymentCount: after.fundRecords.filter((f) => f["资金类型"] === "支付")
        .length,
      splitCount: after.fundRecords.filter((f) => f["资金类型"] === "分账")
        .length,
      screenshot: await shot(resident, mode + "-reentry"),
    };
  });
  return entry;
}
try {
  await go(merchant, "merchant", "supply", "merchant");
  await go(resident, "resident", "catalog", "resident-a");
  for (const [mode, price] of [
    ["上门", "137.35"],
    ["预约到点", "63.28"],
  ]) {
    if (only && only !== (mode === "上门" ? "home" : "point")) continue;
    try {
      const detail = await flow(mode, price);
      results.push({
        id: mode === "上门" ? "AC02-001" : "AC02-002",
        additional: ["AC02-037"],
        status: "PASS",
        detail,
      });
      console.log("PASS " + mode);
    } catch (error) {
      const screenshot = await shot(merchant, mode + "-failure").catch(
        () => null,
      );
      await shot(resident, mode + "-resident-failure").catch(() => null);
      await shot(web, mode + "-web-failure").catch(() => null);
      results.push({
        id: mode === "上门" ? "AC02-001" : "AC02-002",
        additional: ["AC02-037"],
        status: "FAIL",
        error: error.message,
        screenshot,
      });
      console.error(error.stack);
      console.error(
        "Merchant UI: " +
          (await merchant.locator("body").innerText()).slice(-3500),
      );
      console.error(
        "Resident UI: " +
          (await resident.locator("body").innerText()).slice(-1800),
      );
    }
  }
} finally {
  const report = {
    run,
    session,
    base,
    executedAt: new Date().toISOString(),
    results,
    steps,
    errors,
    blockedRequests,
    artifacts,
    artifactHashesBefore: artifactsBefore,
    artifactHashesAfter: artifactHashes(),
    configurationFixtureUsed: reviewSupply,
    scope:
      "Actual UI new supply, retained failed input and restored booking draft, default payment, arrangement, process with evidence, fulfillment, resident completion, independent split and one evaluation. 390/414 form layout checks. Read-only helpers inspect; only identity and legal scene clock are prepared. No real payment, owner acceptance, WeChat-tool or real-device claim.",
  };
  fs.mkdirSync(
    path.join(root, "docs/stages/stage-02/evidence", evidenceSubdir),
    {
      recursive: true,
    },
  );
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(
      root,
      "docs/stages/stage-02/evidence",
      evidenceSubdir,
      reviewSupply ? "browser-custom-supply-flows.json" : "browser-flows.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  await context.close();
  console.log(
    JSON.stringify({
      run,
      passed: results.filter((x) => x.status === "PASS").length,
      failed: results.filter((x) => x.status === "FAIL").length,
      pageErrors: errors.length,
    }),
  );
  process.exitCode =
    results.some((x) => x.status === "FAIL") || errors.length ? 1 : 0;
}
