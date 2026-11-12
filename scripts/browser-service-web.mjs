const evidenceSubdir =
  process.argv.find((a) => a.startsWith("--evidence="))?.slice(11) || "";
if (evidenceSubdir && !/^[a-zA-Z0-9-]+$/.test(evidenceSubdir))
  throw Error("Invalid evidence directory name");
import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  base = JSON.parse(
    fs.readFileSync(path.join(root, ".runtime/stage02/preview.json"), "utf8"),
  ).url;
const run = "WEB-" + new Date().toISOString().replace(/[:.]/g, "-"),
  session = "stage02-" + run,
  out = path.join(root, ".runtime/stage02", run);
fs.mkdirSync(out, { recursive: true });
const sampleImage = path.join(out, "category.png");
fs.writeFileSync(
  sampleImage,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8WQAAAAASUVORK5CYII=",
    "base64",
  ),
);
const onlyArgument = process.argv.find((x) => x.startsWith("--only=")),
  only = onlyArgument ? onlyArgument.slice(7).split(",") : null;
const results = [],
  errors = [],
  observed = {},
  blockedRequests = [];
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 1366, height: 768 } },
);
context.setDefaultTimeout(15000);
context.on("page", (p) =>
  p.on("pageerror", (e) => errors.push({ url: p.url(), message: e.message })),
);
await context.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith(base + "/") || /^(data:|blob:)/.test(u)) return r.continue();
  blockedRequests.push(u);
  return r.abort();
});
const page = await context.newPage();
async function api(method, args = [], { app = "web", account } = {}) {
  return page.evaluate(
    async ({ method, args, app, account }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js"),
        a = createBrowserAdapter(app);
      await a.start();
      if (account) await a.identity(account);
      if (method === "identity") return a.identity(...args);
      return a.service[method](...args);
    },
    { method, args, app, account },
  );
}
async function go(view, account = "property-admin") {
  await page.goto(base + "/web/?session=" + session + "#/service/" + view);
  await api("identity", [account]);
  await page.reload();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".service-workspace .loading-state"),
  );
  assert.ok(
    (await page.locator(".service-workspace").count()) > 0,
    "Service workspace mounted",
  );
}
const actionDrawer = () =>
  page.locator(".service-action-drawer:visible").last();
const field = (name) =>
  actionDrawer()
    .locator(".service-field")
    .filter({
      has: page.locator("label").filter({
        hasText: new RegExp(
          "^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?: \\*)?$",
        ),
      }),
    })
    .first();
async function fill(name, value) {
  const f = field(name);
  await f.waitFor();
  await f
    .locator("input:not([type=radio]),textarea")
    .first()
    .fill(String(value));
}
async function choose(name, value) {
  const f = field(name);
  await f.locator(".ivu-select-selection").click();
  await f
    .locator(".ivu-select-dropdown:visible .ivu-select-item")
    .filter({ hasText: new RegExp("^" + value + "$") })
    .first()
    .click();
}
async function submit(name) {
  await page
    .locator('[data-action="submit:' + name + '"]:visible')
    .last()
    .click();
  await page
    .waitForFunction(
      () =>
        !Array.from(document.querySelectorAll(".service-action-drawer")).some(
          (el) =>
            el.getBoundingClientRect().width > 0 &&
            getComputedStyle(el).visibility !== "hidden" &&
            el.querySelector('[data-action^="submit:"]'),
        ),
      { timeout: 15000 },
    )
    .catch(async () => {
      const text = await actionDrawer().innerText();
      throw Error("Action did not finish: " + text.slice(-1600));
    });
}
async function openRow(id) {
  const row = page.locator('[data-record="' + id + '"]');
  await row.waitFor();
  await row.getByRole("button", { name: "查看详情", exact: true }).click();
  await page.locator(".service-detail-drawer:visible").waitFor();
}
async function clickAction(name, label) {
  const insideDetail = page.locator(
    '.service-detail-drawer:visible [data-action="' + name + '"]',
  );
  let button = (await insideDetail.count())
    ? insideDetail
    : page.locator('[data-action="' + name + '"]:visible');
  if (label) button = button.filter({ hasText: label });
  await button.last().click();
  await actionDrawer().waitFor();
}
async function screenshot(name) {
  const file = path.join(out, name + ".png");
  // View UI closes drawers with a CSS leave transition; capture the settled UI.
  await page.waitForTimeout(450);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  return path.relative(root, file).replaceAll("\\", "/");
}
async function observe(view) {
  const fields = await page.locator("[data-field]:visible").evaluateAll((els) =>
    els.map((el) => ({
      field: el.dataset.field,
      text: el.innerText.slice(0, 500),
    })),
  );
  for (const row of fields) {
    if (!observed[row.field]) observed[row.field] = [];
    observed[row.field].push({ view, url: page.url(), text: row.text });
  }
  return fields.length;
}
async function step(id, acs, fn) {
  if (only && !only.includes(id)) return;
  try {
    const detail = await fn();
    results.push({ id, acs, status: "PASS", detail });
    console.log("PASS " + id);
  } catch (e) {
    const screenshotPath = await screenshot(id + "-failure").catch(() => null);
    results.push({
      id,
      acs,
      status: "FAIL",
      error: e.message,
      screenshot: screenshotPath,
    });
    console.error("FAIL " + id + ": " + e.message);
    console.error((await page.locator("body").innerText()).slice(-1600));
  }
}
try {
  await go("categories", "platform-admin");
  await step(
    "classification-create-edit-and-toggle",
    ["AC02-005", "AC02-044"],
    async () => {
      const name = "家政验收分类-" + run.slice(-8);
      await page
        .getByRole("button", { name: "新增服务类目", exact: true })
        .click();
      await fill("类目名称", name);
      await fill("类目说明", "通过实际Web表单创建的演示类目");
      const icon = field("类目图标");
      await icon.locator("input[type=file]").setInputFiles(sampleImage);
      await icon.locator(".evidence-success").waitFor();
      await icon.getByRole("button", { name: "查看图片", exact: true }).click();
      await page.getByRole("button", { name: "放大", exact: true }).waitFor();
      await page.getByRole("button", { name: "放大", exact: true }).click();
      await page
        .locator(".ivu-modal-wrap:visible .ivu-modal-close")
        .last()
        .click();
      await submit("category.save");
      const record = (await api("query", ["categories", {}])).find(
        (r) => r["类目名称"] === name,
      );
      assert.ok(record, "Created record exists");
      await openRow(record._id);
      await clickAction("category.save");
      await fill("类目说明", "Web修改后的说明");
      await fill("配置变更原因", "修正类目说明，保留原业务快照");
      await submit("category.save");
      let current = await api("record", ["categories", record._id]);
      assert.equal(current["类目说明"], "Web修改后的说明");
      await clickAction("category.status", "停用");
      await fill("配置变更原因", "核对停用对新交易的影响");
      await submit("category.status");
      current = await api("record", ["categories", record._id]);
      assert.equal(current["类目状态"], "停用");
      await clickAction("category.status", "启用");
      await fill("配置变更原因", "完成核对后恢复");
      await submit("category.status");
      current = await api("record", ["categories", record._id]);
      assert.equal(current["类目状态"], "启用");
      assert.ok(current.history.length >= 3);
      return {
        id: record._id,
        history: current.history.length,
        observedFields: await observe("W03"),
        screenshot: await screenshot("classification"),
      };
    },
  );
  await step(
    "qualification-return-and-approved-range",
    ["AC02-003", "AC02-044"],
    async () => {
      await go("qualifications");
      await api("auxiliary", ["scenario", { name: "S02-QUAL" }]);
      await page.getByRole("button", { name: "刷新", exact: true }).click();
      let pending = (await api("query", ["qualifications", {}])).find(
        (r) => r._id === "Q-A",
      );
      if (pending["申请状态"] !== "待审核") {
        await api(
          "command",
          [
            "qualification.submit",
            {
              id: pending._id,
              revision: pending._rev,
              operationId: run + "-initial-qualification",
              data: {},
            },
          ],
          { app: "merchant", account: "merchant" },
        );
        pending = await api("record", ["qualifications", pending._id]);
      }
      assert.equal(pending["申请状态"], "待审核");
      await openRow(pending._id);
      await clickAction("qualification.review");
      await choose("审核结果", "退回修改");
      await fill("审核意见", "请补充本轮申请说明");
      await submit("qualification.review");
      let r = await api("record", ["qualifications", pending._id]);
      assert.equal(r["申请状态"], "已退回");
      assert.equal(r["服务经营有效性"], "有效");
      await api(
        "command",
        [
          "qualification.save",
          {
            id: r._id,
            revision: r._rev,
            operationId: run + "-qual-save",
            data: { 申请说明: "已补充本轮申请说明" },
          },
        ],
        { app: "merchant", account: "merchant" },
      );
      r = await api("record", ["qualifications", pending._id]);
      await api(
        "command",
        [
          "qualification.submit",
          {
            id: r._id,
            revision: r._rev,
            operationId: run + "-qual-submit",
            data: {},
          },
        ],
        { app: "merchant", account: "merchant" },
      );
      await go("qualifications");
      await openRow(pending._id);
      await clickAction("qualification.review");
      await fill("审核意见", "材料与批准范围已核对");
      await submit("qualification.review");
      r = await api("record", ["qualifications", pending._id]);
      assert.equal(r["申请状态"], "已通过");
      return {
        id: r._id,
        authorizedCategories: r["获准服务类目"],
        observedFields: await observe("W01"),
        screenshot: await screenshot("qualification-reviewed"),
      };
    },
  );
  await step("supply-review-version", ["AC02-007", "AC02-044"], async () => {
    await go("review");
    await api("auxiliary", ["scenario", { name: "S02-VERSION" }]);
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    let pending = (await api("query", ["services", {}])).find(
      (r) => r._id === "SV-HOME",
    );
    if (pending["审核状态"] !== "待审核") {
      await api(
        "command",
        [
          "service.submit",
          {
            id: pending._id,
            revision: pending._rev,
            operationId: run + "-initial-supply",
            data: {},
          },
        ],
        { app: "merchant", account: "merchant" },
      );
      pending = await api("record", ["services", pending._id]);
    }
    assert.equal(pending["审核状态"], "待审核");
    await openRow(pending._id);
    await clickAction("service.review");
    await fill("审核意见", "本轮发布内容、规格和地点已核对");
    await submit("service.review");
    const r = await api("record", ["services", pending._id]);
    assert.equal(r["审核状态"], "通过");
    return {
      id: r._id,
      publishedVersion: r["当前发布版本"],
      reviewedVersion: r["送审版本"],
      observedFields: await observe("W04"),
      screenshot: await screenshot("supply-reviewed"),
    };
  });
  for (const kind of ["全额退款", "部分退款", "继续或补充履约", "不予退款"])
    await step(
      "ruling-" + kind,
      ["AC02-031", "AC02-032", "AC02-033", "AC02-034"],
      async () => {
        await go("aftersales");
        await api("auxiliary", ["scenario", { name: "S02-RULING" }]);
        await page.getByRole("button", { name: "刷新", exact: true }).click();
        const record = (await api("query", ["aftersales", {}])).find((r) =>
          (r._actions || []).some((a) => a.name === "aftersale.ruling"),
        );
        assert.ok(record, "Eligible existing after-sale");
        await openRow(record._id);
        await clickAction("aftersale.ruling");
        await choose("裁定结果", kind);
        await choose(
          "裁定后业务处理",
          kind === "继续或补充履约"
            ? "继续／补充履约"
            : kind === "不予退款"
              ? "保留原状态"
              : "部分履行终止",
        );
        if (kind === "部分退款") await fill("裁定退款金额", "10.00");
        if (kind === "继续或补充履约")
          await fill(
            "继续或补充履约内容",
            "按原订单补充完成未处理区域，不增加收费",
          );
        await fill("裁定说明", "线下已核对双方材料，本记录仅保存裁定结果");
        await fill("裁定作出人", "演示线下裁定人");
        await fill("裁定作出时间", "2026-11-06T09:00");
        await submit("aftersale.ruling");
        const current = await api("record", ["aftersales", record._id]);
        const ruling = current.ruling || current;
        assert.equal(ruling["裁定结果"], kind);
        assert.notEqual(current["居民完成确认状态"], "已确认");
        return {
          id: record._id,
          result: ruling["裁定结果"],
          execution: ruling["执行状态"],
          screenshot: await screenshot("ruling-" + kind),
          observedFields: await observe("W06"),
        };
      },
    );
  await step("ruling-correction-version", ["AC02-035"], async () => {
    await go("aftersales");
    await api("auxiliary", ["scenario", { name: "S02-RULING" }]);
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    let r = (await api("query", ["aftersales", {}])).find((x) =>
      (x._actions || []).some((a) => a.name === "aftersale.ruling"),
    );
    assert.ok(r);
    await openRow(r._id);
    await clickAction("aftersale.ruling");
    await choose("裁定结果", "部分退款");
    await fill("裁定退款金额", "10");
    await fill("裁定说明", "首次线下结论");
    await fill("裁定作出人", "演示线下裁定人");
    await fill("裁定作出时间", "2026-11-06T09:00");
    await submit("aftersale.ruling");
    r = await api("record", ["aftersales", r._id]);
    await clickAction("aftersale.ruling");
    await fill("裁定退款金额", "12");
    await fill("裁定说明", "核对后更正金额");
    await fill("更正原因", "录入金额与线下原文不符，执行前更正");
    await fill("裁定作出人", "演示线下裁定人");
    await fill("裁定作出时间", "2026-11-06T09:00");
    await submit("aftersale.ruling");
    const newer = await api("record", ["aftersales", r._id]);
    assert.ok((newer.ruling?.["裁定版本"] || newer["裁定版本"]) >= 2);
    return { id: r._id, screenshot: await screenshot("ruling-corrected") };
  });
  await step(
    "executed-ruling-note-and-rule-version",
    ["AC02-035", "AC02-037", "AC02-042"],
    async () => {
      await go("aftersales");
      await api("auxiliary", ["scenario", { name: "S02-RULING" }]);
      await page.getByRole("button", { name: "刷新", exact: true }).click();
      let row = (await api("query", ["aftersales", {}])).find((x) =>
        x._actions.some((a) => a.name === "aftersale.ruling"),
      );
      assert.ok(row);
      await openRow(row._id);
      await clickAction("aftersale.ruling");
      await choose("裁定结果", "部分退款");
      await fill("裁定退款金额", "10");
      await fill("裁定说明", "线下结论：部分退款，执行后仅追加事实说明");
      await fill("裁定作出人", "演示线下裁定人");
      await fill("裁定作出时间", "2026-11-06T09:00");
      await submit("aftersale.ruling");
      await clickAction("aftersale.execute");
      await submit("aftersale.execute");
      const before = await api("record", ["aftersales", row._id]),
        funds = await api("query", ["funds", {}]);
      assert.ok(before._actions.some((a) => a.name === "aftersale.rulingNote"));
      assert.equal(
        before._actions.some((a) => a.name === "aftersale.ruling"),
        false,
      );
      await clickAction("aftersale.rulingNote");
      await fill(
        "追加说明",
        "已执行后追加：双方已知悉原结论，原金额与资金事实保持",
      );
      assert.equal(
        await actionDrawer().locator('[data-field="31-G.04"]').count(),
        0,
        "No result editing in note action",
      );
      await submit("aftersale.rulingNote");
      const after = await api("record", ["aftersales", row._id]);
      assert.deepEqual(after.ruling, before.ruling);
      assert.deepEqual(await api("query", ["funds", {}]), funds);
      assert.ok(
        JSON.stringify(after).includes("已执行后追加：双方已知悉原结论"),
      );
      await page
        .locator(".service-detail-drawer:visible .ivu-drawer-close")
        .last()
        .click();
      await page.waitForTimeout(450);
      await page.getByRole("button", { name: /演示身份/ }).click();
      const select = page.locator(
        '[data-action="stage02-rule-version"]:visible',
      );
      await select.locator(".ivu-select-selection").click();
      await select
        .locator(".ivu-select-item")
        .filter({ hasText: "演示返回 V2" })
        .click();
      await page.waitForFunction(async () => {
        const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
        return (
          (await createBrowserAdapter("web").service.options()).ruleVersion ===
          "DEMO-ALLOC-V2"
        );
      });
      await page
        .locator(".ivu-modal-wrap:visible .ivu-modal-close")
        .last()
        .click();
      return {
        sale: row._id,
        noteOnly: true,
        fundsUnchanged: true,
        ruleVersion: (await api("options")).ruleVersion,
        screenshot: await screenshot("executed-ruling-note"),
      };
    },
  );
  await step(
    "stats-fixed-values-and-drill",
    ["AC02-041", "AC02-044"],
    async () => {
      await go("overview");
      await api("auxiliary", ["scenario", { name: "S02-STATS" }]);
      await page
        .locator('.query-main input[aria-label="查询开始日期"]')
        .fill("2026-11-01");
      await page
        .locator('.query-main input[aria-label="查询结束日期"]')
        .fill("2026-11-06");
      await page.getByRole("button", { name: "查询", exact: true }).click();
      const result = await api("overview", [
        { start: "2026-11-01", end: "2026-11-06" },
      ]);
      const metrics = result.metrics;
      const values = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
      for (const expected of ["495.00", "189.00", "306.00", "89.00", "30.00"])
        assert.ok(
          Object.values(values).some((v) => String(v) === expected),
          "Observed metric " + expected,
        );
      const payment = metrics.find((m) => /支付成功金额/.test(m.name));
      assert.ok(payment);
      const card = page.locator('[data-metric="' + payment.name + '"]');
      await card.waitFor();
      const image = await screenshot("stats-fixed");
      await card.click();
      await page.waitForURL(/#\/service\/funds/);
      await page.locator("tbody [data-record]").first().waitFor();
      const rows = await page.locator("tbody [data-record]").count();
      assert.ok(rows > 0, "Metric drill has actual records");
      assert.ok(new URL(page.url()).hash.includes("metric="));
      assert.equal(
        await page
          .locator('.query-main input[aria-label="查询开始日期"]')
          .inputValue(),
        "2026-11-01",
      );
      assert.equal(
        await page
          .locator('.query-main input[aria-label="查询结束日期"]')
          .inputValue(),
        "2026-11-06",
      );
      return {
        values,
        drillRows: rows,
        screenshot: image,
        drillScreenshot: await screenshot("stats-drill"),
      };
    },
  );
  await step("funds-time-basis-filter", ["AC02-040", "AC02-041"], async () => {
    await go("funds");
    await api("auxiliary", ["scenario", { name: "S02-STATS" }]);
    await page
      .locator('.query-main input[aria-label="查询开始日期"]')
      .fill("2026-11-01");
    await page
      .locator('.query-main input[aria-label="查询结束日期"]')
      .fill("2026-11-06");
    await page.locator(".more-filter summary").click();
    const control = page.locator('.more-filter [data-field="32-A.06"]');
    await control.locator(".ivu-select-selection").click();
    await control
      .locator(".ivu-select-item")
      .filter({ hasText: /^退款成功时间$/ })
      .click();
    await page.getByRole("button", { name: "查询", exact: true }).click();
    await page.waitForFunction(() => {
      const e = document.querySelector(".service-workspace");
      return (
        e && e.__vue__ && !e.__vue__.loading && e.__vue__.rows.length === 3
      );
    });
    const texts = await page.locator("tbody [data-record]").allInnerTexts();
    assert.equal(texts.length, 3);
    assert.ok(texts.every((t) => t.includes("退款")));
    const rows = await api("query", [
      "funds",
      {
        查询开始日期: "2026-11-01",
        查询结束日期: "2026-11-06",
        时间口径: "退款成功时间",
      },
    ]);
    assert.equal(rows.length, 3);
    assert.equal(
      rows.reduce((n, r) => n + Number(r["资金金额"]), 0),
      189,
    );
    return {
      rows: rows.map((r) => r["资金业务单号"]),
      screenshot: await screenshot("funds-refund-time-basis"),
      observedFields: await observe("W09"),
    };
  });
  await step(
    "web-viewports-and-business-routes",
    ["AC02-044", "AC02-052"],
    async () => {
      const layouts = [];
      for (const view of [
        "qualifications",
        "personnel",
        "categories",
        "review",
        "orders",
        "aftersales",
        "evaluations",
        "overview",
        "funds",
        "exceptions",
      ]) {
        await go(
          view,
          view === "categories" ? "platform-admin" : "property-admin",
        );
        for (const viewport of [
          { width: 1366, height: 768 },
          { width: 1920, height: 1080 },
        ]) {
          await page.setViewportSize(viewport);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
          assert.equal(
            overflow,
            false,
            "Page overflow " + view + " " + viewport.width,
          );
          layouts.push({
            view,
            viewport,
            overflow,
            visibleFields: await observe(view),
            screenshot: await screenshot(view + "-" + viewport.width),
          });
        }
      }
      return layouts;
    },
  );
} finally {
  await context.close();
  const report = {
    run,
    base,
    session,
    selectedChecks: only,
    executedAt: new Date().toISOString(),
    results,
    errors,
    blockedRequests,
    observed,
    scope:
      "Actual Web UI checks; legal Service helpers only prepare fixtures and inspect persisted outcomes. This report is not a full AC pass or owner acceptance.",
  };
  const evidence = path.join(
    root,
    "docs/stages/stage-02/evidence",
    evidenceSubdir,
  );
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(
    path.join(
      evidence,
      only ? "browser-web-followup.json" : "browser-web.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      run,
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").length,
      pageErrors: errors.length,
    }),
  );
  process.exitCode =
    results.some((r) => r.status === "FAIL") || errors.length ? 1 : 0;
}
