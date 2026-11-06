import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { billTemplate } from "../prototype-shared/stage01/billing.js";
const root = path.resolve(import.meta.dirname, ".."),
  last = JSON.parse(
    fs.readFileSync(
      path.join(root, "docs/stages/stage-01/evidence/browser-flows.json")
    )
  ),
  base = last.base,
  session = last.session;
const out = path.join(root, ".runtime/stage01", "VIEWS-" + Date.now());
const importPrefix = "页面核验-" + Date.now() + "-";
fs.mkdirSync(out, { recursive: true });
const finishViews = process.argv.includes("--finish-views");
const previous = finishViews
  ? JSON.parse(
      fs.readFileSync(
        path.join(root, "docs/stages/stage-01/evidence/view-results.json")
      )
    )
  : null;
const results = [],
  observed = {},
  errors = [];
if (previous) {
  results.push(...previous.results.filter((r) => r.status === "PASS"));
  Object.assign(observed, previous.observed);
  errors.push(...previous.errors);
}
const context = await chromium.launchPersistentContext(
  path.join(root, ".runtime/stage01", last.run, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 1366, height: 768 } }
);
context.setDefaultTimeout(10000);
context.on("page", (p) =>
  p.on("pageerror", (e) => errors.push({ url: p.url(), message: e.message }))
);
await context.route("**/*", (r) =>
  r
    .request()
    .url()
    .startsWith(base + "/") || /^(data:|blob:)/.test(r.request().url())
    ? r.continue()
    : r.abort()
);
const web = await context.newPage(),
  resident = await context.newPage(),
  staff = await context.newPage();
await resident.setViewportSize({ width: 390, height: 844 });
await staff.setViewportSize({ width: 390, height: 844 });
async function go(p, app, route) {
  await p.goto(base + "/" + app + "/?session=" + session + "#" + route);
  await p.waitForTimeout(400);
}
const button = (p, text) =>
  p
    .locator("button:visible,uni-button:visible")
    .filter({ hasText: new RegExp("^\\s*" + text + "\\s*$") })
    .last();
async function collect(p, id) {
  const values = await p.locator("[data-field]:visible").evaluateAll((es) =>
    es
      .map((e) => ({
        id: e.getAttribute("data-field"),
        text: ((e.innerText || e.value || "") + "").slice(0, 240),
      }))
      .filter((v) => /^[A-Z]{2}\d\d$/.test(v.id || ""))
  );
  for (const value of values) {
    observed[value.id] ??= [];
    observed[value.id].push({ view: id, url: p.url(), text: value.text });
  }
}
async function expand(p) {
  for (const el of await p.locator(".group-title:visible").all()) {
    const text = await el.innerText();
    if (/查看|展开/.test(text)) {
      await el.click();
      await p.waitForTimeout(30);
    }
  }
  for (const el of await p.locator("summary:visible").all()) {
    if (!(await el.evaluate((e) => e.parentElement.open))) await el.click();
  }
  for (const el of await p
    .locator(".timeline .hint:visible")
    .filter({ hasText: /^查看变更$/ })
    .all())
    await el.click();
}
async function capture(p, id) {
  await p.waitForTimeout(350);
  await collect(p, id);
  console.log("Checked " + id);
  const file = path.join(out, id.replace(/[^A-Za-z0-9-]/g, "_") + ".png");
  await p.screenshot({ path: file, fullPage: true });
  const pageErrors = await p
    .locator(".s1-mobile > .error:visible,.s1 > .ivu-alert-error:visible")
    .allTextContents();
  assert.equal(
    pageErrors.length,
    0,
    id + " page error " + pageErrors.join(";")
  );
  const overflow = await p.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1
  );
  results.push({
    view: id,
    status: overflow ? "FAIL" : "PASS",
    url: p.url(),
    viewport: p.viewportSize(),
    overflow,
    screenshot: path.relative(root, file).replaceAll("\\", "/"),
  });
  assert.equal(overflow, false, id + " overflow");
}
async function inspectWeb(id, route, table, recordId) {
  await go(web, "web", route + (recordId ? "?id=" + recordId : ""));
  if (recordId) {
    const drawer = web.locator(".ivu-drawer-wrap:visible").last();
    await drawer.locator(".ivu-tabs-tab").first().waitFor();
    await web.waitForTimeout(350);
    for (const tab of await drawer.locator(".ivu-tabs-tab").all()) {
      await tab.click();
      await web.waitForTimeout(180);
      await expand(drawer);
      await collect(web, id);
      const image = drawer.locator(".s1-photo img:visible").first();
      if (await image.count()) {
        await image.click();
        await web.locator("[data-field=AT04]:visible").waitFor();
        await collect(web, id);
        await web
          .locator(".ivu-modal-wrap:visible .ivu-modal-close")
          .last()
          .click();
      }
    }
    await capture(web, id);
  } else await capture(web, id);
}
if (process.argv.includes("--filters-only")) {
  try {
    await go(web, "web", "/property/payments");
    await web.locator("[data-field=QF07]").selectOption("停车月租");
    await web
      .locator(".s1 > .ivu-tabs .ivu-tabs-tab")
      .filter({ hasText: "未缴费用" })
      .click();
    await web.locator(".s1-table tbody tr").first().waitFor();
    assert.ok(await web.locator(".s1-table tbody tr").count());
    assert.equal(await web.locator("[data-field=QF07]:visible").count(), 0);
    await capture(web, "P-A03-filter");
  } catch (e) {
    results.push({ status: "FAIL", error: e.message });
    console.error(e.stack);
  }
  fs.writeFileSync(
    path.join(
      root,
      "docs/stages/stage-01/evidence/browser-filter-results.json"
    ),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base,
        session,
        results,
        errors,
        boundary:
          "Actual local Web: switching to unpaid bills clears the now-hidden business-type filter.",
      },
      null,
      2
    ) + "\n"
  );
  await context.close();
  process.exit(
    results.some((r) => r.status === "FAIL") || errors.length ? 1 : 0
  );
}
try {
  await go(web, "web", "/property/bills");
  const setup = await web.evaluate(
    async ({ photoBytes, reuse }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
      const w = createBrowserAdapter("web"),
        r = createBrowserAdapter("resident");
      await w.start();
      await r.start();
      window.fieldQa = { w, r };
      if (reuse) {
        const recordIds = {};
        for (const t of [
          "bills",
          "payments",
          "checks",
          "parkingRelations",
          "products",
          "monthly",
          "temporary",
          "reports",
          "events",
          "workorders",
        ])
          recordIds[t] = await w.stage01.query(t);
        const branch = recordIds.reports.find(
            (x) => x.RP14 === "灯具反复闪烁，请核实修复。"
          ),
          rp = recordIds.reports.find((x) => x.RP14 === "现场核查补充记录");
        if (!branch || !rp) throw Error("No prepared view conditions");
        return {
          recordIds,
          rp: rp._id,
          branch: branch._id,
          branchTask: branch._workorder,
        };
      }
      const photo = new File(
        [Uint8Array.from(atob(photoBytes), (c) => c.charCodeAt(0))],
        "现场记录.png",
        { type: "image/png" }
      );
      const paPhoto = (await w.stage01.upload(photo)).id,
        residentPhoto = (await r.stage01.upload(photo)).id;
      const pays = await w.stage01.query("payments");
      if (pays.length) {
        await w.stage01.auxiliary("funds", { id: pays[0]._id, kind: "refund" });
        const ex = await w.stage01.command("createCheck", { id: pays[0]._id });
        const e = await w.stage01.record("checks", ex.id);
        await w.stage01.command("saveCheck", {
          id: e._id,
          revision: e._rev,
          note: "已核对原业务与付款，保留资金事实",
          next: "正式更正办理待后续政策",
        });
      }
      const parkingPay = pays.find((p) => p.PY02 !== "物业费");
      if (parkingPay) {
        const ex = await w.stage01.command("createCheck", {
          id: parkingPay._id,
        });
        const e = await w.stage01.record("checks", ex.id);
        await w.stage01.command("saveCheck", {
          id: e._id,
          revision: e._rev,
          note: "平台登记及原支付事实已逐项核对",
          next: "厂商通行结果仍未接入",
          photos: [paPhoto],
        });
      }
      const rp = await r.stage01.command("report", {
        data: {
          RP07: "报修",
          RP08: "设施维修",
          RP09: "C-A",
          RP10: "E-A",
          RP11: "公共位置",
          RP13: "东门公共走廊",
          RP14: "现场核查补充记录",
          RP15: "周明",
          RP16: "13900000002",
          RP06: new Date(Date.now() - 3600000).toISOString(),
        },
      });
      let report = await r.stage01.record("reports", rp.id);
      await r.stage01.command("supplement", {
        id: report._id,
        revision: report._rev,
        data: { SP02: "补充：灯具位于东侧门口", SP03: [residentPhoto] },
      });
      report = await w.stage01.record("reports", rp.id);
      let e = report.event;
      await w.stage01.command("verify", {
        id: e._id,
        revision: e._rev,
        data: {
          EV03: "设施维修",
          EV05: "需补充",
          EV06: "请进一步确认位置",
          EV07: "请补充楼栋入口",
        },
      });
      const baseReport = {
        RP07: "报修",
        RP08: "设施维修",
        RP09: "C-A",
        RP10: "E-A",
        RP11: "房屋内",
        RP12: "H-A",
        RP13: "厨房窗边",
        RP14: "灯具反复闪烁，请核实修复。",
        RP15: "周明",
        RP16: "13900000002",
        RP17: [residentPhoto],
      };
      const branch = await r.stage01.command("report", { data: baseReport });
      const verify = async (id, extra = {}) => {
        const e = (await w.stage01.record("reports", id)).event;
        await w.stage01.command("verify", {
          id: e._id,
          revision: e._rev,
          data: {
            EV03: "设施维修",
            EV04: "厨房窗边",
            EV05: "有效",
            EV06: "现场已核对",
            ...extra,
          },
        });
        return (await w.stage01.record("reports", id))._workorder;
      };
      const wId = await verify(branch.id);
      const task = async (name, data = {}) => {
        const t = await w.stage01.record("workorders", wId);
        return w.stage01.command(name, { id: wId, revision: t._rev, data });
      };
      await task("dispatch", { WO04: "P-S01", WO05: "检查灯具接线" });
      await task("return", { OP01: "需重新准备检修工具" });
      await task("dispatch", { WO04: "P-S01", WO05: "检修灯具" });
      await task("transfer", { OP03: "P-S02", OP04: "同物业人员协助接续" });
      await task("transfer", {
        OP03: "P-S01",
        OP04: "工具准备齐全，由当前人员办理",
      });
      await task("accept");
      const process = {
        PR02: "检查线路并更换接头",
        PR03: new Date(Date.now() - 120000).toISOString(),
        PR04: new Date(Date.now() - 60000).toISOString(),
        PR05: [paPhoto],
        PR06: [paPhoto],
        PR07: "照明恢复",
        PR11: "现场断电后作业",
      };
      await task("submitProcess", process);
      await task("review", {
        RV03: "退回",
        RV04: "请补充稳定性观察",
        RV05: [paPhoto],
      });
      await task("submitProcess", { ...process, PR07: "持续观察后照明稳定" });
      await task("review", {
        RV03: "通过",
        RV04: "现场已复测",
        RV05: [paPhoto],
        EV12: "灯具已检修，请本人确认",
        EV13: [paPhoto],
      });
      const residentTask = await r.stage01.record("reports", branch.id);
      await r.stage01.command("confirm", {
        id: branch.id,
        revision: residentTask._taskRevision,
        data: {
          UC01: "未解决",
          UC02: "夜间仍偶尔闪烁，请再次核实",
          UC03: [residentPhoto],
        },
      });
      const manual = await w.stage01.command("report", {
        data: {
          ...baseReport,
          RP17: [paPhoto],
          RP03: "王女士",
          RP13: "厨房窗边",
          RP11: "公共位置",
          RP14: "物业电话代登记：同一厨房灯具闪烁",
        },
      });
      await verify(manual.id, {
        EV05: "重复",
        EV08: (await w.stage01.record("reports", branch.id)).event.EV01,
        EV06: "与已登记灯具事项关联核查，仅演示重复关联分支",
      });
      const hz = await w.stage01.command("report", {
        data: {
          ...baseReport,
          RP17: [paPhoto],
          RP07: "隐患",
          RP11: "公共位置",
          RP13: "北侧通道",
          RP14: "通道积水影响通行",
        },
      });
      await verify(hz.id, {
        EV03: "公共安全",
        HZ03: "较高",
        HZ04: "清理积水并检查漏点",
        HZ05: "2026-11-10",
        HZ09: "演示证据要求：整改前后照片及现场复查",
      });
      const recordIds = {};
      for (const t of [
        "bills",
        "payments",
        "checks",
        "parkingRelations",
        "products",
        "monthly",
        "temporary",
        "reports",
        "events",
        "workorders",
      ])
        recordIds[t] = await w.stage01.query(t);
      return { recordIds, rp: rp.id, branch: branch.id, branchTask: wId };
    },
    {
      photoBytes: fs
        .readFileSync(
          path.join(root, ".runtime/stage01", last.run, "before.png")
        )
        .toString("base64"),
      reuse: finishViews || process.argv.includes("--reuse-fixtures"),
    }
  );
  const data = setup.recordIds;
  if (!finishViews) {
    await inspectWeb("P-A01", "/property/bills", "bills", data.bills[0]?._id);
    await go(web, "web", "/property/bills/import");
    const csv = path.join(out, "bills.csv");
    fs.writeFileSync(
      csv,
      billTemplate
        .replaceAll("台账-", importPrefix)
        .replaceAll("2026-11-", "2026-12-") +
        "错误行,NO-HOUSE,2026-12-01,2026-12-31,abc,0,,待核验\r\n"
    );
    await web.locator("input[type=file]").setInputFiles(csv);
    await web
      .locator("[data-field=IR04]")
      .filter({ hasText: /^有效$/ })
      .first()
      .waitFor();
    await web.locator("[data-field=IM09] input").check();
    await button(web, "确认导入有效行").click();
    await web.getByText("导入结果", { exact: true }).waitFor();
    await web.screenshot({
      path: path.join(out, "import-result-default.png"),
      fullPage: true,
    });
    await expand(web);
    await collect(web, "P-A02");
    await button(web, "查看本次行结果").click();
    await button(web, "查看原值并匹配").last().click();
    await collect(web, "P-A02");
    await web.locator(".ivu-modal-close:visible").last().click();
    await capture(web, "P-A02");
    const imported = await web.evaluate(
      async (prefix) =>
        (
          await window.fieldQa.w.stage01.query("bills")
        ).find(
          (b) =>
            b.BL19 === "待发布" && b.BL07 === "H-A" && b.BL02.startsWith(prefix)
        ),
      importPrefix
    );
    assert.ok(imported, "CSV produced a verifiable bill");
    await go(web, "web", "/property/bills");
    await web
      .locator(".s1-table tbody tr")
      .filter({ hasText: imported._id })
      .locator("button")
      .click();
    await button(web, "发布账单").click();
    await web.locator("[data-field=IR09] input").check();
    await collect(web, "P-A01");
    await button(web, "确认发布账单").click();
    await web.getByText("已发布", { exact: true }).last().waitFor();
    await go(
      resident,
      "resident",
      "/pages/stage01/fees/detail?id=" + imported._id
    );
    await button(resident, "去缴费").click();
    await button(resident, "确认缴费").click();
    await resident.locator(".uni-modal__btn_primary:visible").click();
    await resident.getByText("缴费已确认", { exact: true }).waitFor();
    await capture(resident, "P-A02-published-paid");
    for (const [id, route, table] of [
      ["P-A03", "/property/payments", "payments"],
      ["P-A08", "/parking/checks", "checks"],
      ["P-B01", "/workorders/events", "events"],
      ["P-B02", "/workorders/tasks", "workorders"],
      ["P-B03", "/workorders/overview", null],
      ["P-B04", "/workorders/repairs", "reports"],
      ["P-B05", "/workorders/hazards", "workorders"],
    ]) {
      let row = data[table]?.[0];
      if (id === "P-A08")
        row = data.checks.find((r) =>
          data.payments.some((p) => p.PY03 === r.EX03 && p.PY02 !== "物业费")
        );
      if (id === "P-B05") row = data.workorders.find((r) => r._kind === "隐患");
      await inspectWeb(id, route, table, row?._id);
      if (table && id !== "P-A08")
        for (const other of [
          ...new Map(
            data[table].map((r) => [[r._title, r._status, r.EV05].join("|"), r])
          ).values(),
        ].filter(
          (x) =>
            x._id !== row?._id &&
            (id !== "P-B05" || x._kind === "隐患") &&
            (id !== "P-B04" || x.RP07 === "报修")
        ))
          await inspectWeb(id, route, table, other._id);
    }
    await go(web, "web", "/parking/business");
    for (const [table, label] of [
      ["parkingRelations", "停车关系"],
      ["products", "月租产品"],
      ["monthly", "月租订单"],
      ["temporary", "临停账单"],
    ]) {
      await web
        .locator(".s1 > .ivu-tabs .ivu-tabs-tab")
        .filter({ hasText: label })
        .first()
        .click();
      for (const record of data[table] || []) {
        await web
          .locator(".s1-table tbody tr")
          .filter({ hasText: record._id })
          .locator("button")
          .click();
        const drawer = web.locator(".ivu-drawer-wrap:visible").last();
        await drawer.locator(".ivu-tabs-tab").first().waitFor();
        await web.waitForTimeout(350);
        for (const tab of await drawer.locator(".ivu-tabs-tab").all()) {
          await tab.click();
          await web.waitForTimeout(180);
          await expand(drawer);
          await collect(web, "P-A07");
        }
        await web.locator(".ivu-drawer-close:visible").last().click();
      }
    }
    await capture(web, "P-A07");
    const residentViews = [
      ["P-A04", "fees/index"],
      [
        "P-A05",
        "fees/pay?id=" +
          data.bills[0]._id +
          "&kind=" +
          encodeURIComponent("物业费"),
      ],
      ["P-A06", "payments/detail?id=" + (data.payments[0]?._id || "")],
      ["P-A09", "parking/index"],
      [
        "P-A10",
        "parking/monthly" +
          (data.monthly.length ? "?id=" + data.monthly.slice(-1)[0]._id : ""),
      ],
      ["P-A11", "parking/temporary?id=" + data.temporary[0]._id],
      ["P-A12", "parking/contactless"],
      ["P-B06", "repairs/detail?id=" + setup.branch],
      [
        "P-B07",
        "hazards/detail?id=" +
          (data.reports.find((r) => r.RP07 === "隐患")?._id || ""),
      ],
      ["P-C01", "records/index"],
    ];
    for (const [id, route] of residentViews) {
      await go(resident, "resident", "/pages/stage01/" + route);
      await expand(resident);
      await capture(resident, id);
    }
  }
  await go(
    resident,
    "resident",
    "/pages/stage01/repairs/detail?id=" + setup.rp
  );
  await resident.reload();
  await resident
    .locator("[data-field=EV07]:visible")
    .filter({ hasText: "请补充楼栋入口" })
    .waitFor();
  await expand(resident);
  await collect(resident, "P-B06");
  for (const [id, route] of [
    ["P-A13", "charges/index"],
    ["P-B08", "reports/create"],
    ["P-B09", "tasks/index"],
  ]) {
    await go(staff, "staff", "/pages/stage01/" + route);
    await expand(staff);
    await capture(staff, id);
  }
  await go(
    staff,
    "staff",
    "/pages/stage01/tasks/detail?id=" + setup.branchTask + "&table=workorders"
  );
  await expand(staff);
  await capture(staff, "P-B09-history");
  await go(web, "web", "/property/bills");
  await web.locator("[data-field=QF01]").fill("不存在的账单");
  await web.getByText("当前条件下暂无记录", { exact: true }).waitFor();
  await collect(web, "P-A01");
  await go(web, "web", "/workorders/overview");
  await web.locator("[data-field=ST01]").click();
  await web.waitForURL(/states=/);
  await capture(web, "P-B03-drill");
  // Narrow viewports and a completed business detail; actual render, not source inspection.
  for (const [p, app, width, height, route] of [
    [web, "web", 1024, 768, "/property/bills"],
    [resident, "resident", 320, 568, "/pages/stage01/repairs/create"],
    [staff, "staff", 320, 568, "/pages/stage01/charges/index"],
  ]) {
    await p.setViewportSize({ width, height });
    await go(p, app, route);
    await capture(p, app + "-narrow");
  }
} catch (e) {
  results.push({ status: "FAIL", error: e.message });
  console.error(e.stack);
} finally {
  const result = {
    at: new Date().toISOString(),
    base,
    session,
    results,
    observed,
    errors,
    resumedFrom: previous
      ? {
          at: previous.at,
          retestedFailures: previous.results.filter((r) => r.status === "FAIL"),
          note: "Successful view observations retained; mobile deep link is reloaded and verified before continuing remaining views.",
        }
      : null,
    boundary:
      "Additional conditions prepared through the same local Service; screenshots and field observations are actual UI. Not WeChat or owner acceptance.",
  };
  fs.writeFileSync(
    path.join(root, "docs/stages/stage-01/evidence/view-results.json"),
    JSON.stringify(result, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(result, null, 2) + "\n"
  );
  await context.close();
}
console.log(
  "Views " +
    results.filter((r) => r.status === "PASS").length +
    ", observed fields " +
    Object.keys(observed).length
);
process.exitCode =
  results.some((r) => r.status === "FAIL") || errors.length ? 1 : 0;
