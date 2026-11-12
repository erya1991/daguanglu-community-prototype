import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  base = JSON.parse(
    fs.readFileSync(path.join(root, ".runtime/stage02/preview.json")),
  ).url;
const run = "REVIEW-" + new Date().toISOString().replace(/[:.]/g, "-"),
  session = "stage02-" + run,
  out = path.join(root, ".runtime/stage02", run),
  evidence = path.join(root, "docs/stages/stage-02/evidence/review-20261109");
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
const hashes = () =>
  Object.fromEntries(
    [
      "web/manager/dist/index.html",
      "miniapp/apps/resident-miniapp/dist/build/h5/index.html",
      "miniapp/apps/merchant-miniapp/dist/build/h5/index.html",
    ].map((p) => [
      p,
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, p)))
        .digest("hex"),
    ]),
  );
const artifactsBefore = hashes(),
  results = [],
  errors = [],
  blockedRequests = [];
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 390, height: 844 } },
);
context.setDefaultTimeout(14000);
context.on("page", (p) =>
  p.on("pageerror", (e) => errors.push({ url: p.url(), message: e.message })),
);
await context.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith(base + "/") || /^(data:|blob:)/.test(url))
    return route.continue();
  blockedRequests.push(url);
  return route.abort();
});
const web = await context.newPage(),
  resident = await context.newPage(),
  merchant = await context.newPage();
await web.setViewportSize({ width: 1366, height: 768 });
let serial = 0;
async function api(page, app, method, args = []) {
  return page.evaluate(
    async ({ app, method, args }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
      const a = createBrowserAdapter(app);
      await a.start();
      return method === "identity"
        ? a.identity(...args)
        : a.service[method](...args);
    },
    { app, method, args },
  );
}
async function go(page, app, route, account) {
  await page.goto(
    base +
      "/" +
      app +
      "/?session=" +
      session +
      (app === "web" ? "#/service/" : "#/pages/service/") +
      route,
  );
  if (account) {
    await api(page, app, "identity", [account]);
  }
  await page.reload();
  await page
    .locator(app === "web" ? ".service-workspace" : ".service-page")
    .waitFor();
  await page.waitForTimeout(350);
  await page.waitForFunction(
    () =>
      !document.querySelector(
        ".service-workspace .loading-state,.page-state--loading",
      ),
  );
}
async function scene(name) {
  await go(web, "web", "orders", "property-admin");
  await api(web, "web", "auxiliary", ["scenario", { name }]);
}
async function command(page, app, name, r, data) {
  return (
    await api(page, app, "command", [
      name,
      {
        id: r?._id,
        revision: r?._rev,
        operationId: run + "-" + ++serial,
        data,
      },
    ])
  ).record;
}
const mf = (p, n) => p.locator('[data-field-name="' + n + '"]:visible').first();
const mb = (p, n) =>
  p
    .locator("uni-button:visible,button:visible")
    .filter({ hasText: new RegExp("^\\s*" + n + "\\s*$") })
    .last();
const drawer = () => web.locator(".service-action-drawer:visible").last();
const wf = (n) =>
  drawer()
    .locator(".service-field")
    .filter({
      has: web
        .locator("label")
        .filter({ hasText: new RegExp("^" + n + "(?: \\*)?$") }),
    })
    .first();
async function fill(n, v) {
  await wf(n).locator("input:not([type=radio]),textarea").first().fill(v);
}
async function submit(action) {
  await web
    .locator('[data-action="submit:' + action + '"]:visible')
    .last()
    .click();
  await drawer().waitFor({ state: "hidden" });
}
async function openRow(id) {
  await web
    .locator('[data-record="' + id + '"]')
    .getByRole("button", { name: "查看详情", exact: true })
    .click();
  await web.locator(".service-detail-drawer:visible").waitFor();
}
async function pickMobile(p, n, i) {
  await mf(p, n).locator("uni-picker").first().click();
  const col = p.locator("uni-picker-view-column:visible").first();
  await col.waitFor();
  await p.waitForTimeout(250);
  const b = await col.boundingBox();
  assert.ok(b);
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  for (let x = 0; x < i; x++) {
    await p.mouse.wheel(0, 34);
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(450);
  await p.locator(".uni-picker-action-confirm:visible").click();
}
async function shot(p, n) {
  const f = path.join(out, n + ".png");
  await p.screenshot({ path: f, fullPage: true, animations: "disabled" });
  return path.relative(root, f).replaceAll("\\", "/");
}
async function step(id, acs, fn) {
  try {
    const detail = await fn();
    results.push({ id, acs, status: "PASS", detail });
    console.log("PASS " + id);
  } catch (e) {
    results.push({
      id,
      acs,
      status: "FAIL",
      error: e.message,
      urls: [web.url(), resident.url(), merchant.url()],
      body: await Promise.all(
        [web, resident, merchant].map((p) =>
          p
            .locator("body")
            .innerText()
            .then((t) => t.slice(-2500))
            .catch(() => ""),
        ),
      ),
      screenshots: await Promise.all(
        [web, resident, merchant].map((p, i) =>
          shot(p, id + "-failure-" + i).catch(() => null),
        ),
      ),
    });
    console.log("FAIL " + id + ": " + e.message);
  }
}
try {
  await step(
    "web-maintained-name-keeps-stable-reference",
    ["AC02-005", "AC02-007"],
    async () => {
      await scene("S02-PAY");
      await api(web, "web", "identity", ["platform-admin"]);
      const old = (await api(web, "web", "query", ["orders", {}]))[0],
        before = old["服务内容快照"];
      await go(web, "web", "categories", "platform-admin");
      await web
        .locator(".ivu-tabs-tab")
        .filter({ hasText: "履约方式" })
        .click();
      await openRow("HOME");
      await web
        .locator('.service-detail-drawer:visible [data-action="method.save"]')
        .last()
        .click();
      await fill("履约方式名称", "预约上门");
      await fill("履约方式说明", "按双方确认的约定安排上门");
      await fill("配置变更原因", "对居民展示更清晰的交付名称");
      await submit("method.save");
      const method = await api(web, "web", "record", ["methods", "HOME"]);
      assert.equal(method["履约方式名称"], "预约上门");
      assert.equal(method._id, "HOME");
      assert.deepEqual(
        (await api(web, "web", "record", ["orders", old._id]))["服务内容快照"],
        before,
      );
      return {
        id: method._id,
        version: method["方式版本"],
        screenshot: await shot(web, "renamed-method"),
      };
    },
  );
  await step(
    "authorized-merchant-coverage-and-point-options",
    ["AC02-006", "AC02-042"],
    async () => {
      await scene("S02-BASE");
      await go(merchant, "merchant", "supply", "merchant");
      await mb(merchant, "新增服务项目").click();
      const opts = await api(merchant, "merchant", "options");
      const cat = opts.categories.findIndex((c) => c._id === "CAT-CLEAN");
      await pickMobile(merchant, "所属服务类目", cat);
      await mb(merchant, "添加规格").click();
      await merchant.locator('[data-method="HOME"]').click();
      const c = await mf(merchant, "上门覆盖社区").innerText(),
        e = await mf(merchant, "上门覆盖小区").innerText();
      assert.ok(c.includes("青禾示例社区") && !c.includes("望江示例社区"));
      assert.ok(
        e.includes(opts.approvedEstates[0].label) &&
          !e.includes(opts.estates.find((v) => v.value === "E-B").label),
      );
      await merchant.locator('[data-method="POINT"]').click();
      assert.equal(await merchant.locator('[data-point="POINT-A"]').count(), 1);
      assert.equal(
        await merchant.locator('[data-point="POINT-A2"]').count(),
        1,
      );
      assert.equal(
        await merchant
          .locator('[data-point="POINT-B"],[data-point="POINT-A-OFF"]')
          .count(),
        0,
      );
      return {
        authorizedCommunities: c,
        authorizedEstates: e,
        screenshot: await shot(merchant, "authorized-range-points"),
      };
    },
  );
  await step(
    "object-requirement-draft-switch-and-required-hint",
    ["AC02-006", "AC02-010", "AC02-043", "AC02-045"],
    async () => {
      await scene("S02-BASE");
      await go(merchant, "merchant", "supply", "merchant");
      let v = await api(merchant, "merchant", "record", [
        "services",
        "SV-HOME",
      ]);
      const data = structuredClone(v.published),
        sp = data["服务规格集合"][0];
      sp["规格编号"] = "REVIEW-OPTIONAL";
      sp["服务对象填写要求"] = "选填";
      const none = structuredClone(sp);
      none["规格编号"] = "REVIEW-NONE";
      none["规格名称"] = "无需对象描述的标准包";
      none["服务对象填写要求"] = "不需要";
      const required = structuredClone(sp);
      required["规格编号"] = "REVIEW-REQUIRED";
      required["规格名称"] = "需要明确清洁对象的标准包";
      required["服务对象填写要求"] = "必填";
      required["服务对象填写提示"] = "请说明需要清洁的设备或部位";
      data["服务规格集合"] = [sp, none, required];
      v = await command(merchant, "merchant", "service.save", null, data);
      v = await command(merchant, "merchant", "service.submit", v, {});
      v = await command(web, "web", "service.review", v, { 审核结果: "通过" });
      v = await command(merchant, "merchant", "service.publish", v, {});
      await go(
        resident,
        "resident",
        "booking?id=" + v._id + "&spec=REVIEW-OPTIONAL&method=HOME",
        "resident-a",
      );
      await mf(resident, "服务对象描述")
        .locator("textarea")
        .fill("上个规格的设备描述");
      await resident.waitForTimeout(500);
      await go(
        resident,
        "resident",
        "booking?id=" + v._id + "&spec=REVIEW-NONE&method=HOME",
      );
      assert.equal(
        await resident
          .locator('[data-field-name="服务对象描述"]:visible')
          .count(),
        0,
      );
      await go(
        resident,
        "resident",
        "booking?id=" + v._id + "&spec=REVIEW-REQUIRED&method=HOME",
      );
      assert.equal(
        await mf(resident, "服务对象描述").locator("textarea").inputValue(),
        "",
      );
      assert.ok(
        (await mf(resident, "服务对象填写提示").innerText()).includes(
          required["服务对象填写提示"],
        ),
      );
      assert.equal(
        await mf(resident, "服务对象描述")
          .locator(".uni-textarea-placeholder")
          .innerText(),
        required["服务对象填写提示"],
      );
      assert.ok(
        (await mf(resident, "约时提示").innerText()).includes(
          "期望时间不代表预约成功",
        ),
      );
      return {
        service: v._id,
        staleDescriptionCleared: true,
        requiredHint: required["服务对象填写提示"],
        screenshot: await shot(resident, "object-requirements"),
      };
    },
  );
  await step(
    "completed-aftercare-ruling-executes-selected-treatment",
    ["AC02-032", "AC02-035", "AC02-038"],
    async () => {
      await scene("S02-EVAL");
      await go(resident, "resident", "orders", "resident-a");
      const o = (await api(resident, "resident", "query", ["orders", {}]))[0];
      let sale = await command(resident, "resident", "aftersale.apply", o, {
        申请类型: "申请退款",
        申请原因: "完成后发现一处区域需退款协商",
        申请退款金额: "10.00",
      });
      await go(web, "web", "aftersales", "property-admin");
      await openRow(sale._id);
      await web
        .locator(
          '.service-detail-drawer:visible [data-action="aftersale.ruling"]',
        )
        .last()
        .click();
      await web.waitForFunction(() =>
        document
          .querySelector('.service-action-drawer [data-field="31-G.08"]')
          ?.textContent.includes("完成后售后解决"),
      );
      const selectedHandling = await wf("裁定后业务处理")
        .locator(".ivu-select-selection")
        .evaluate((el) =>
          (el.querySelector("input")?.value || el.innerText).trim(),
        );
      assert.equal(selectedHandling, "完成后售后解决");
      await wf("裁定后业务处理").locator(".ivu-select-selection").click();
      const choices = await wf("裁定后业务处理")
        .locator(".ivu-select-item")
        .allTextContents();
      console.log("Allowed completed-order choices", JSON.stringify(choices));
      assert.ok(
        !choices.includes("未服务取消") && !choices.includes("正常完成"),
      );
      await wf("裁定后业务处理")
        .locator(".ivu-select-item")
        .filter({ hasText: /^完成后售后解决$/ })
        .click();
      await fill("裁定退款金额", "10.00");
      await fill("裁定说明", "按完成后核实的质量问题退还十元，保留原完成事实");
      await fill("裁定作出人", "线下处理负责人");
      await fill("裁定作出时间", "2026-11-06T09:00");
      await submit("aftersale.ruling");
      await web
        .locator(
          '.service-detail-drawer:visible [data-action="aftersale.execute"]',
        )
        .last()
        .click();
      await submit("aftersale.execute");
      const after = await api(web, "web", "record", ["orders", o._id]);
      for (const k of [
        "结案结果",
        "履约状态",
        "居民完成确认状态",
        "居民确认时间",
      ])
        assert.equal(after[k], o[k], k);
      sale = await api(web, "web", "record", ["aftersales", sale._id]);
      assert.equal(sale["裁定后业务处理"], "完成后售后解决");
      assert.equal(sale["售后状态"], "已解决");
      return {
        sale: sale._id,
        businessTreatment: sale["裁定后业务处理"],
        orderClosure: after["结案结果"],
        screenshot: await shot(web, "completed-aftercare"),
      };
    },
  );
  await step(
    "web-and-merchant-project-category-metric-drill-context",
    ["AC02-041", "AC02-042"],
    async () => {
      await scene("S02-STATS");
      await go(web, "web", "overview", "property-admin");
      await web.locator(".more-filter summary").click();
      for (const [id, label] of [
        ["32-A.02", "家庭保洁"],
        ["32-A.03", "家庭保洁"],
      ]) {
        const field = web.locator('.more-filter [data-field="' + id + '"]');
        await field.locator(".ivu-select-selection").click();
        await field
          .locator(".ivu-select-dropdown:visible .ivu-select-item")
          .filter({ hasText: new RegExp("^" + label + "$") })
          .first()
          .click();
      }
      await web.getByRole("button", { name: "应用条件", exact: true }).click();
      await web.waitForFunction(
        () => !document.querySelector(".service-workspace .loading-state"),
      );
      const expected = await api(web, "web", "overview", [
        { service: "SV-HOME", category: "CAT-CLEAN" },
      ]);
      const card = web.locator('[data-metric="创建订单数"]');
      await web.waitForFunction(
        (v) =>
          document
            .querySelector('[data-metric="创建订单数"] strong')
            ?.textContent.trim() === v,
        String(expected.values["创建订单数"]),
      );
      assert.equal(
        (await card.locator("strong").innerText()).trim(),
        String(expected.values["创建订单数"]),
      );
      await card.click();
      await web.waitForURL(/service\/orders/);
      assert.ok(
        web.url().includes("service=SV-HOME") &&
          web.url().includes("category=CAT-CLEAN"),
      );
      await web.waitForFunction(
        (v) => document.querySelectorAll("[data-record]").length === v,
        expected.values["创建订单数"],
      );
      assert.equal(
        await web.locator("[data-record]").count(),
        expected.values["创建订单数"],
      );
      await go(merchant, "merchant", "overview", "merchant");
      const opts = await api(merchant, "merchant", "options");
      await pickMobile(
        merchant,
        "服务项目筛选",
        opts.services.findIndex((v) => v._id === "SV-HOME"),
      );
      await pickMobile(
        merchant,
        "服务类目筛选",
        opts.categories.findIndex((v) => v._id === "CAT-CLEAN"),
      );
      await mb(merchant, "查询").click();
      await merchant.waitForTimeout(400);
      const m = merchant
        .locator(".metric")
        .filter({ hasText: "创建订单数" })
        .first();
      assert.equal(
        (await m.locator(".metric-value").innerText()).trim(),
        String(expected.values["创建订单数"]),
      );
      await m.click();
      await merchant.waitForURL(/section=/);
      const hash = merchant.url().split("?").at(-1),
        section = new URLSearchParams(hash).get("section"),
        f = JSON.parse(decodeURIComponent(section));
      assert.equal(f.service, "SV-HOME");
      assert.equal(f.category, "CAT-CLEAN");
      return {
        expected: expected.values["创建订单数"],
        webUrl: web.url(),
        merchantFilters: f,
        screenshot: await shot(web, "filtered-drill"),
      };
    },
  );
  await step(
    "actual-upload-and-verification-rejection-field-feedback",
    ["AC02-020", "AC02-045", "AC02-043"],
    async () => {
      await scene("S02-BASE");
      await go(merchant, "merchant", "verify", "merchant");
      await merchant
        .locator(".form-card uni-input input")
        .first()
        .fill("WRONG-CODE");
      await mb(merchant, "查询凭证").click();
      await merchant.locator('[data-field="30-B.17"]').waitFor();
      const rejected = await merchant
        .locator('[data-field="30-B.17"]')
        .innerText();
      assert.ok(rejected.includes("未找到可核验"));
      await go(merchant, "merchant", "supply");
      await mb(merchant, "新增服务项目").click();
      await api(merchant, "merchant", "auxiliary", [
        "mode",
        { kind: "upload", outcome: "failure" },
      ]);
      const f = mf(merchant, "服务主图"),
        chooser = merchant.waitForEvent("filechooser");
      await mb(f, "上传／拍照").click();
      await (
        await chooser
      ).setFiles(path.join(root, ".runtime/stage02/fixtures/demo-service.png"));
      const errorField = f
        .locator('[data-field="C1.08"]')
        .filter({ hasText: /失败/ })
        .first();
      await errorField.waitFor();
      const failure = await errorField.innerText();
      assert.ok(failure.includes("失败"));
      return {
        verificationRejection: rejected,
        uploadFailure: failure,
        screenshot: await shot(merchant, "real-failure-fields"),
      };
    },
  );
} finally {
  const report = {
    run,
    session,
    base,
    results,
    errors,
    blockedRequests,
    artifactHashesBefore: artifactsBefore,
    artifactHashesAfter: hashes(),
    scope:
      "Targeted actual H5/Web controls and persisted Service transactions. Legal fixture preparation is explicitly separate from UI actions. No native-device, owner acceptance or real-money claim.",
  };
  fs.writeFileSync(
    path.join(evidence, "browser-review.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await context.close();
  console.log(
    JSON.stringify({
      run,
      pass: results.filter((r) => r.status === "PASS").length,
      fail: results.filter((r) => r.status === "FAIL").length,
      pageErrors: errors.length,
    }),
  );
  process.exitCode =
    results.some((r) => r.status !== "PASS") || errors.length ? 1 : 0;
}
