import fs from "node:fs";
import path from "node:path";
import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import { fieldTables } from "../prototype-shared/service/fields.js";
const root = path.resolve(import.meta.dirname, "..");
const base = JSON.parse(
  fs.readFileSync(path.join(root, ".runtime/stage02/preview.json"), "utf8"),
).url;
const run = "FIELDS-" + new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(root, ".runtime/stage02", run);
fs.mkdirSync(out, { recursive: true });
const expected = fieldTables.flatMap((t) =>
  t.fields.map((f) => ({ ...f, table: t.id })),
);
const resumeArg = process.argv.find((x) => x.startsWith("--resume="));
const inherited = resumeArg
  ? JSON.parse(fs.readFileSync(path.resolve(root, resumeArg.slice(9)), "utf8"))
  : null;
const jobsArg = process.argv.find((x) => x.startsWith("--jobs="));
const selectedJobs = jobsArg
  ? jobsArg.slice(7) === "none"
    ? []
    : jobsArg.slice(7).split(",").map(Number)
  : null;
if (selectedJobs?.some((n) => !Number.isInteger(n) || n < 0 || n > 13))
  throw Error("Invalid job index");
const expectedById = Object.fromEntries(expected.map((f) => [f.id, f]));
const screenshotWarnings = [];
const observations = inherited
    ? inherited.observations.map((o) => ({
        ...o,
        originRun: o.originRun || inherited.run,
      }))
    : [],
  screens = inherited
    ? inherited.screens.map((o) => ({
        ...o,
        originRun: o.originRun || inherited.run,
      }))
    : [],
  failures = [],
  pageErrors = [];
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 1366, height: 768 } },
);
context.setDefaultTimeout(5000);
await context.route("**/*", (r) =>
  r
    .request()
    .url()
    .startsWith(base + "/") || /^(data:|blob:)/.test(r.request().url())
    ? r.continue()
    : r.abort(),
);
context.on("page", (p) =>
  p.on("pageerror", (e) =>
    pageErrors.push({ url: p.url(), message: e.message }),
  ),
);
const pages = {
  web: await context.newPage(),
  resident: await context.newPage(),
  merchant: await context.newPage(),
};
for (const app of ["resident", "merchant"])
  await pages[app].setViewportSize({ width: 390, height: 844 });
let step = screens.length;
let cancelled = false;
process.on("SIGINT", () => {
  cancelled = true;
  console.log("Audit cancellation requested; preserving observations");
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function navigate(app, session, route) {
  const p = pages[app];
  await p.goto(`${base}/${app}/?session=${session}#${route}`, {
    waitUntil: "domcontentloaded",
  });
  await p.waitForTimeout(450);
  return p;
}
async function collect(app, session, scene, label, screenshot = false) {
  const p = pages[app];
  let scope = p.locator("body");
  if (app === "web") {
    const action = p
        .locator(".service-action-drawer:visible .ivu-drawer-content:visible")
        .last(),
      detail = p
        .locator(".service-detail-drawer:visible .ivu-drawer-content:visible")
        .last();
    if (await action.count()) scope = action;
    else if (await detail.count()) scope = detail;
    else scope = p.locator(".service-workspace").first();
  } else if (await p.locator(".sheet:visible").count())
    scope = p.locator(".sheet:visible").last();
  if (!(await scope.count())) return;
  const values = await scope.locator("[data-field]:visible").evaluateAll(
    (nodes, byId) =>
      nodes
        .map((el) => {
          const id = el.getAttribute("data-field"),
            field = byId[id];
          if (!field) return null;
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height || el.closest('[aria-hidden="true"]'))
            return null;
          const controls = [
            ...(el.matches(
              "input,textarea,select,button,uni-picker,uni-checkbox,uni-switch",
            )
              ? [el]
              : []),
            ...el.querySelectorAll(
              "input,textarea,select,button,uni-picker,uni-checkbox,uni-switch",
            ),
          ].filter((x) => {
            const r = x.getBoundingClientRect();
            return r.width && r.height;
          });
          const control = controls[0];
          const text = (el.innerText || "").trim();
          const dd = el.querySelector(
            "dd,.field-readonly,.read-value,.readonly-value",
          );
          const value =
            controls
              .filter((x) => "value" in x && x.type !== "file")
              .map((x) => (x.type === "checkbox" ? String(x.checked) : x.value))
              .filter((x) => x !== "")
              .join(" | ") ||
            (dd?.innerText || text.replace(field.name, "")).trim();
          const empty =
            !value ||
            /^(暂无此项记录|暂无记录|未设置|未记录|未填写|—|-|请选择|无)$/.test(
              value,
            );
          return {
            id,
            name: field.name,
            text: text.slice(0, 550),
            value: value.slice(0, 550),
            hasValue: !empty,
            controls: controls.map((x) => ({
              tag: x.tagName,
              type: x.type || x.getAttribute("role") || "",
              disabled: !!x.disabled,
              readonly: !!x.readOnly,
              required:
                !!x.required || x.getAttribute("aria-required") === "true",
            })),
            readonly: !controls.some(
              (x) => x.tagName !== "BUTTON" && !x.disabled && !x.readOnly,
            ),
            rect: {
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            container:
              el.closest(
                ".ivu-drawer-content,.section-content,.form-card,.query-panel,.metric-grid",
              )?.className || "",
            url: location.href,
          };
        })
        .filter(Boolean),
    expectedById,
  );
  const identity = await p.evaluate(() => ({
    app: location.pathname,
    session: new URL(location.href).searchParams.get("session"),
  }));
  for (const value of values)
    observations.push({
      ...value,
      app,
      session,
      scene,
      label,
      identity,
      step,
      originRun: run,
    });
  screens.push({
    step: ++step,
    app,
    scene,
    label,
    url: p.url(),
    fieldIds: [...new Set(values.map((v) => v.id))],
  });
  if (screenshot && !screens.some((x) => x.app === app && x.screenshot)) {
    const file = path.join(
      out,
      String(step).padStart(3, "0") +
        "-" +
        app +
        "-" +
        label.replace(/[^a-zA-Z0-9_-]/g, "_") +
        ".png",
    );
    try {
      await p.screenshot({
        path: file,
        fullPage: false,
        animations: "disabled",
        timeout: 15000,
      });
    } catch (error) {
      screenshotWarnings.push({ app, scene, label, message: error.message });
    }
    if (fs.existsSync(file))
      screens[screens.length - 1].screenshot = path
        .relative(root, file)
        .replaceAll("\\", "/");
  }
  fs.writeFileSync(
    path.join(out, "progress.json"),
    JSON.stringify(
      {
        step,
        scene,
        app,
        label,
        observedIds: [...new Set(observations.map((o) => o.id))],
        failures,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(out, "observations-partial.json"),
    JSON.stringify(
      {
        run,
        base,
        cancelled,
        screens,
        observations,
        failures,
        pageErrors,
        screenshotWarnings,
      },
      null,
      2,
    ),
  );
  if (cancelled)
    throw new Error("Audit cancelled; partial observation retained");
  console.log(
    `${step} ${app} ${scene} ${label}: ${values.length} visible fields`,
  );
}
async function expandHtmlDetails(app) {
  const p = pages[app];
  let scope = p.locator("body");
  if (app === "web") {
    const action = p
        .locator(".service-action-drawer:visible .ivu-drawer-content:visible")
        .last(),
      detail = p
        .locator(".service-detail-drawer:visible .ivu-drawer-content:visible")
        .last();
    scope = (await action.count())
      ? action
      : (await detail.count())
        ? detail
        : p.locator(".service-workspace").first();
  }
  for (let i = 0; i < 80; i++) {
    const closed = scope.locator("details:visible:not([open]) > summary");
    if (!(await closed.count())) break;
    try {
      await closed.first().click();
      await p.waitForTimeout(25);
    } catch (error) {
      failures.push({
        phase: "expand-details",
        app,
        url: p.url(),
        message: error.message,
      });
      break;
    }
  }
}
async function bootstrap(session, scene, variant = {}) {
  const p = await navigate("web", session, "/service/orders");
  const setup = await p.evaluate(
    async ({ scene, variant }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
      const apis = {};
      for (const [app, account] of [
        ["web", "property-admin"],
        ["resident", "resident-a"],
        ["merchant", "merchant"],
      ]) {
        apis[app] = createBrowserAdapter(app);
        await apis[app].start();
        await apis[app].identity(account);
      }
      await apis.web.service.auxiliary("scenario", { name: scene });
      const cmd = async (app, name, table, id, data = {}) => {
        const row = id ? await apis[app].service.record(table, id) : null;
        return apis[app].service.command(name, {
          id,
          revision: row?._rev,
          operationId:
            "field-audit-" + name + "-" + Date.now() + "-" + Math.random(),
          data,
        });
      };
      const file = async (app, name = "虚构字段证据.png") => {
        const data = Uint8Array.from(
          atob(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6X8AAAAASUVORK5CYII=",
          ),
          (c) => c.charCodeAt(0),
        );
        return apis[app].service.upload(
          new File([data], name, { type: "image/png" }),
        );
      };
      let orders = await apis.web.service.query("orders"),
        sales = await apis.web.service.query("aftersales");
      if (variant.qualification) {
        const q = (await apis.merchant.service.query("qualifications"))[0];
        await cmd("merchant", "qualification.submit", "qualifications", q._id);
        await cmd("web", "qualification.review", "qualifications", q._id, {
          审核结果: "退回修改",
          审核意见: "请补充本轮经营说明",
        });
        await cmd("merchant", "qualification.save", "qualifications", q._id, {
          申请服务类目: q["获准服务类目"],
          申请覆盖社区: ["C-A"],
          申请覆盖小区: ["E-A"],
          申请说明: "补充经营申请说明",
          服务资质材料: q["服务资质材料"],
        });
        await cmd("merchant", "qualification.submit", "qualifications", q._id);
        await cmd("web", "qualification.review", "qualifications", q._id, {
          审核结果: "通过",
          审核意见: "核对后批准本轮范围",
          批准服务类目: q["获准服务类目"],
          批准覆盖社区: ["C-A"],
          批准覆盖小区: ["E-A"],
        });
      }
      if (variant.category) {
        await apis.web.identity("platform-admin");
        const image = await file("web", "虚构类目图标.png");
        await cmd("web", "category.save", "categories", "CAT-CLEAN", {
          类目名称: "家庭保洁",
          上级类目: "CAT-HOUSE",
          类目图标: [{ ...image, description: "类目服务图标" }],
          类目说明: "为社区居民提供一次固定规格家政服务",
          商户证明是否必需: false,
          人员证明是否必需: false,
          允许履约方式: ["HOME", "POINT"],
          类目排序: 2,
          配置变更原因: "演示类目信息完善",
        });
        await apis.web.identity("property-admin");
      }
      if (variant.result && orders[0]) {
        const o = orders[0],
          img = await file("merchant");
        await cmd("merchant", "order.process", "orders", o._id, {
          过程记录类型: "服务进展",
          过程说明: "按原规格完成可实施部分",
          过程图片: [{ ...img, description: "虚构过程图片" }],
        });
        await apis.web.service.auxiliary("clock", {
          time: "2026-11-07T10:00:00+08:00",
        });
        await cmd("merchant", "order.result", "orders", o._id, {
          服务结果: "部分完成",
          实际完成内容: "已完成主体服务",
          未完成内容: "少量补充事项",
          未完成原因: "需协调后补充履约",
          实际服务结束时间: "2026-11-07T10:00:00+08:00",
          结果图片: [{ ...img, description: "虚构结果图片" }],
          结果补充说明: "请居民核对结果",
        });
        await cmd("merchant", "order.anomaly", "orders", o._id, {
          异常类型: "现场条件异常",
          异常发生时间: "2026-11-07T09:20:00+08:00",
          异常事实说明: "已如实记录本轮现场情况",
          异常证据: [img],
          期望处理方式: "协商补充履约",
        });
        await cmd("resident", "order.confirm", "orders", o._id, {
          当前待确认结果版本: 1,
          居民结果答复: "有异议",
          问题说明: "请补充未完成事项",
          问题图片: [await file("resident")],
        });
      }
      if (variant.plan && sales[0]) {
        const img = await file("merchant");
        await cmd("merchant", "aftersale.plan", "aftersales", sales[0]._id, {
          方案处理类型: "部分退款",
          拟退款金额: "20.00",
          金额依据说明: "按未履行部分协商",
          方案说明: "核实后提出部分退款",
          业务结案方式: "部分履行终止",
        });
        await cmd(
          "resident",
          "aftersale.evidence",
          "aftersales",
          sales[0]._id,
          { 追加说明: "补充服务问题依据", 追加证据: [await file("resident")] },
        );
      }
      if (variant.ruling && sales[0]) {
        const evidence = await file("web", "虚构裁定依据.png");
        await cmd("web", "aftersale.ruling", "aftersales", sales[0]._id, {
          裁定结果: variant.ruling,
          裁定退款金额: "20.00",
          继续或补充履约内容: "按原约定完成剩余服务",
          裁定后业务处理: variant.ruling === "继续或补充履约" ? "继续／补充履约" : variant.ruling === "不予退款" ? "保留原状态" : "部分履行终止",
          裁定说明: "线下核查后作出的公开结论",
          裁定依据附件: [evidence],
          裁定作出人: "线下裁定负责人",
          裁定作出时间: "2026-11-07T10:00:00+08:00",
        });
        if (variant.execute)
          await cmd("web", "aftersale.execute", "aftersales", sales[0]._id);
      }
      if (variant.evaluation && orders[0])
        await cmd("resident", "evaluation.save", "orders", orders[0]._id, {
          总体评分: 4,
          评价内容: "服务过程与结果已核对",
          评价图片: [await file("resident")],
        });
      if (variant.fund) {
        const funds = await apis.web.service.query("funds");
        const f = funds.find((x) =>
          ["结果未知", "失败", "处理中"].includes(x["资金状态"]),
        );
        if (f) {
          await apis.web.service.auxiliary("mode", {
            kind: f["资金类型"] === "分账" ? "split" : "payment",
            outcome: "normal",
          });
          await cmd("web", "fund.query", "funds", f._id);
          await cmd("web", "fund.note", "funds", f._id, {
            本次核查说明: "核对原资金请求与金额",
            核查依据: [await file("web")],
          });
        }
      }
      return {
        orders: await apis.web.service.query("orders"),
        aftersales: await apis.web.service.query("aftersales"),
        evaluations: await apis.web.service.query("evaluations"),
        funds: await apis.web.service.query("funds"),
        personnel: await apis.merchant.service.query("personnel"),
        qualifications: await apis.merchant.service.query("qualifications"),
      };
    },
    { scene, variant },
  );
  return setup;
}
async function webView(
  session,
  scene,
  view,
  { rows = 2, actions = true, onlyIds = [] } = {},
) {
  const p = await navigate(
    "web",
    session,
    "/service/" + (view === "methods" ? "categories" : view),
  );
  await p.evaluate(
    async (account) => {
      const m = await import("/_shared/storage-h5.js");
      const a = m.createBrowserAdapter("web");
      await a.start();
      await a.identity(account);
    },
    ["categories", "methods"].includes(view)
      ? "platform-admin"
      : "property-admin",
  );
  await p.reload();
  await p.waitForTimeout(200);
  if (["categories", "methods"].includes(view)) {
    await p.evaluate(async (account) => {
      const m = await import("/_shared/storage-h5.js");
      const a = m.createBrowserAdapter("web");
      await a.start();
      await a.identity(account);
    }, "platform-admin");
    await p.reload();
    await p.waitForTimeout(300);
    if (view === "methods")
      await p
        .locator(".service-workspace .ivu-tabs-tab")
        .filter({ hasText: "履约方式" })
        .last()
        .click()
        .catch(() => {});
  }
  await expandHtmlDetails("web");
  await collect("web", session, scene, view + "-list", true);
  const ids = await p
    .locator(".service-table tbody tr[data-record]")
    .evaluateAll((es) => es.map((e) => e.dataset.record));
  for (const key of ids
    .filter((key) => !onlyIds.length || onlyIds.includes(key))
    .slice(0, rows)) {
    await p
      .locator(`tr[data-record="${key}"]`)
      .getByText("查看详情", { exact: true })
      .click();
    await p.waitForTimeout(150);
    const tabs = p.locator(".service-detail-drawer:visible .ivu-tabs-tab");
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await p.waitForTimeout(250);
      await expandHtmlDetails("web");
      await collect(
        "web",
        session,
        scene,
        view + "-" + key + "-tab" + i,
        i === 0,
      );
      if (i === 0 && actions) {
        const buttons = p.locator(
          ".service-detail-drawer:visible [data-action]",
        );
        const descriptors = await buttons.evaluateAll((es) =>
          es.map((e) => ({ name: e.dataset.action, label: e.innerText })),
        );
        for (const desc of descriptors) {
          const button = p
            .locator(".service-detail-drawer:visible [data-action]")
            .filter({ hasText: desc.label })
            .first();
          await button.click().catch(() => {});
          await p.waitForTimeout(250);
          if (key === "CAT-AC" && desc.name === "category.save") {
            const drawer = p.locator(".service-action-drawer:visible").last();
            await drawer
              .locator('[data-field="27-A.08"] input[type=radio]')
              .first()
              .check();
            await drawer
              .locator(
                '[data-field="27-A.09"] input,[data-field="27-A.09"] textarea',
              )
              .first()
              .fill("按该类目核对商户有效材料");
            await collect(
              "web",
              session,
              scene,
              "merchant-proof-required-condition",
            );
            await drawer
              .locator('[data-field="27-A.08"] input[type=radio]')
              .last()
              .check();
            if (await drawer.locator('[data-field="27-A.09"]:visible').count())
              throw Error("商户证明关闭后说明未隐藏");
            await drawer
              .locator('[data-field="27-A.08"] input[type=radio]')
              .first()
              .check();
          }
          await collect(
            "web",
            session,
            scene,
            view + "-" + key + "-action-" + desc.name,
          );
          const close = p
            .locator(".service-action-drawer:visible")
            .getByText("保留输入并返回", { exact: true });
          if (await close.count()) await close.click();
          await p.waitForTimeout(60);
        }
      }
    }
    const close = p
      .locator(".service-detail-drawer:visible .ivu-drawer-close")
      .last();
    if (await close.count()) await close.click();
    await p.waitForTimeout(80);
  }
  if (["categories", "methods"].includes(view)) {
    const add = p.locator(".heading-actions [data-action]").first();
    if (await add.count()) {
      await add.click();
      await p.waitForTimeout(250);
      await collect("web", session, scene, view + "-new");
      await p
        .locator(".service-action-drawer:visible")
        .getByText("保留输入并返回", { exact: true })
        .click();
    }
  }
}
async function mobileRoute(app, session, scene, route, label) {
  const p = await navigate(app, session, route);
  await collect(app, session, scene, label + "-initial", true);
  const filter = p.getByText("筛选", { exact: true }).last();
  if (await filter.count()) {
    await filter.click().catch(() => {});
    await collect(app, session, scene, label + "-filter");
  }
  const sections = p.locator(".service-details .section-toggle");
  for (let i = 0; i < (await sections.count()); i++) {
    await sections.nth(i).click();
    await p.waitForTimeout(45);
    await collect(app, session, scene, label + "-section" + i);
    const meta = p.getByText("文件详情", { exact: true });
    for (let j = 0; j < Math.min(await meta.count(), 2); j++) {
      await meta
        .nth(j)
        .click()
        .catch(() => {});
      await collect(app, session, scene, label + "-filemeta" + j);
    }
  }
}
const jobs = [
  {
    scene: "S02-BASE",
    variant: { category: true },
    web: ["categories", "methods", "review"],
    mobile: true,
  },
  {
    scene: "S02-QUAL",
    variant: { qualification: true },
    web: ["qualifications", "personnel"],
    mobile: true,
  },
  { scene: "S02-VERSION", web: ["review"], mobile: true },
  { scene: "S02-HOME-READY", web: ["orders"], mobile: true },
  { scene: "S02-POINT-READY", web: ["orders"], mobile: true },
  {
    scene: "S02-IN-SERVICE",
    variant: { result: true },
    web: ["orders", "aftersales"],
    mobile: true,
  },
  {
    scene: "S02-AFTERSALE",
    variant: { plan: true },
    web: ["aftersales"],
    mobile: true,
  },
  {
    scene: "S02-RULING",
    variant: { ruling: "部分退款" },
    web: ["aftersales"],
    mobile: true,
  },
  {
    scene: "S02-RULING",
    variant: { ruling: "全额退款", execute: true },
    web: ["aftersales", "funds"],
    mobile: true,
  },
  {
    scene: "S02-RULING",
    variant: { ruling: "继续或补充履约" },
    web: ["aftersales"],
  },
  { scene: "S02-RULING", variant: { ruling: "不予退款" }, web: ["aftersales"] },
  {
    scene: "S02-FUNDS-REFUND",
    variant: { evaluation: true },
    web: ["orders", "funds", "evaluations"],
    mobile: true,
  },
  {
    scene: "S02-FUNDS-EXCEPTION",
    variant: { fund: true },
    web: ["exceptions", "funds"],
    mobile: true,
  },
  { scene: "S02-STATS", web: ["overview"], mobile: true },
];
try {
  for (let n = 0; n < jobs.length; n++) {
    if (cancelled) break;
    if (selectedJobs && !selectedJobs.includes(n)) continue;
    const job = jobs[n],
      session = "stage02-fields-" + run.replace(/[^\w-]/g, "") + "-" + n;
    let setup;
    try {
      setup = await bootstrap(session, job.scene, job.variant || {});
    } catch (e) {
      failures.push({ phase: "setup", scene: job.scene, message: e.message });
      console.log("SETUP FAIL " + job.scene + " " + e.message);
      continue;
    }
    for (const view of job.web)
      try {
        await webView(session, job.scene, view, {
          rows: view === "funds" ? 4 : 1,
          actions: true,
        });
      } catch (e) {
        failures.push({
          phase: "web-view",
          scene: job.scene,
          view,
          message: e.message,
        });
        console.log("VIEW FAIL " + view + " " + e.message);
      }
    if (!job.mobile) continue;
    const o = setup.orders[0],
      sale = setup.aftersales[0];
    const routes = [];
    if (n === 0) {
      routes.push(
        ["resident", "/pages/service/catalog", "discover"],
        ["resident", "/pages/service/detail?id=SV-FAN", "service-detail"],
        [
          "resident",
          "/pages/service/booking?id=SV-HOME&spec=SPEC-HOME&method=" +
            encodeURIComponent("上门"),
          "booking-home",
        ],
        [
          "resident",
          "/pages/service/booking?id=SV-POINT&spec=SPEC-POINT&method=" +
            encodeURIComponent("预约到点"),
          "booking-point",
        ],
        [
          "merchant",
          "/pages/service/action?table=services&action=service.save",
          "new-supply",
        ],
        [
          "merchant",
          "/pages/service/action?table=personnel&action=personnel.save",
          "new-personnel",
        ],
      );
    }
    if (job.scene === "S02-QUAL")
      routes.push(
        ["merchant", "/pages/service/qualification", "qualification"],
        [
          "merchant",
          "/pages/service/action?table=qualifications&id=Q-A&action=qualification.save",
          "qualification-edit",
        ],
        ["merchant", "/pages/service/personnel", "personnel"],
      );
    if (o) {
      for (const app of ["merchant", "resident"])
        routes.push([app, "/pages/service/order?id=" + o._id, "order"]);
      if (o._mode === "预约到点")
        routes.push([
          "resident",
          "/pages/service/voucher?id=" + o._id,
          "voucher",
        ]);
      for (const app of ["merchant", "resident"]) {
        const actions = await pages.web.evaluate(
          async ({ app, id, table }) => {
            const { createBrowserAdapter } = await import(
              "/_shared/storage-h5.js"
            );
            const a = createBrowserAdapter(app);
            await a.start();
            return (await a.service.record(table, id))._actions;
          },
          { app, id: o._id, table: "orders" },
        );
        for (const action of actions || [])
          if (!["order.pay", "order.cancel"].includes(action.name))
            routes.push([
              app,
              "/pages/service/action?table=orders&id=" +
                o._id +
                "&action=" +
                action.name +
                "&section=" +
                encodeURIComponent(action.label),
              "action-" + action.name,
            ]);
      }
    }
    if (sale)
      for (const app of ["merchant", "resident"])
        routes.push([
          app,
          "/pages/service/after-sale?id=" + sale._id,
          "after-sale",
        ]);
    if (sale) {
      for (const app of ["merchant", "resident"]) {
        const actions = await pages.web.evaluate(
          async ({ app, id }) => {
            const { createBrowserAdapter } = await import(
              "/_shared/storage-h5.js"
            );
            const a = createBrowserAdapter(app);
            await a.start();
            return (await a.service.record("aftersales", id))._actions;
          },
          { app, id: sale._id },
        );
        for (const action of actions || [])
          routes.push([
            app,
            "/pages/service/action?table=aftersales&id=" +
              sale._id +
              "&action=" +
              action.name +
              "&section=" +
              encodeURIComponent(action.label),
            "action-" + action.name,
          ]);
      }
    }
    if (job.scene === "S02-STATS")
      routes.push(["merchant", "/pages/service/overview", "overview"]);
    for (const [app, route, label] of routes)
      try {
        await mobileRoute(app, session, job.scene, route, label);
      } catch (e) {
        failures.push({
          phase: "mobile-view",
          app,
          scene: job.scene,
          route,
          message: e.message,
        });
      }
  }
  if (process.argv.includes("--supplement")) {
    const session = "stage02-fields-supplement-" + run;
    try {
      await bootstrap(session, "S02-BASE", { category: true });
      await webView(session, "S02-BASE", "review", {
        rows: 1,
        actions: false,
        onlyIds: ["SV-POINT"],
      });
      await webView(session, "S02-BASE", "categories", {
        rows: 1,
        actions: true,
        onlyIds: ["CAT-AC"],
      });
      await mobileRoute(
        "resident",
        session,
        "S02-BASE",
        "/pages/service/catalog",
        "updated-discovery",
      );
      await mobileRoute(
        "resident",
        session,
        "S02-BASE",
        "/pages/service/booking?id=SV-POINT&spec=SPEC-POINT&method=" +
          encodeURIComponent("预约到点"),
        "updated-point-booking",
      );
      await bootstrap(session + "-stats", "S02-STATS");
      await mobileRoute(
        "merchant",
        session + "-stats",
        "S02-STATS",
        "/pages/service/orders",
        "updated-current-arrangements",
      );
      const reviewed = await bootstrap(
        session + "-review",
        "S02-FUNDS-REFUND",
        { evaluation: true },
      );
      await mobileRoute(
        "resident",
        session + "-review",
        "S02-FUNDS-REFUND",
        "/pages/service/detail?id=" + reviewed.orders[0]._service,
        "public-review",
      );
    } catch (e) {
      failures.push({ phase: "supplement", message: e.message });
      console.log("SUPPLEMENT FAIL " + e.message);
    }
  }
} finally {
  const observed = new Set(observations.map((o) => o.id)),
    withValue = new Set(
      observations.filter((o) => o.hasValue).map((o) => o.id),
    ),
    results = expected.map((f) => {
      const seen = observations.filter((o) => o.id === f.id),
        valued = seen.filter((o) => o.hasValue);
      return {
        id: f.id,
        table: f.table,
        name: f.name,
        expectedControl: f.type,
        condition: f.condition,
        plannedPath: f.path,
        status: !seen.length
          ? "NOT_OBSERVED"
          : !valued.length
            ? "VISIBLE_VALUE_NOT_VERIFIED"
            : "VISIBLE_VALUE_OBSERVED",
        observations: seen,
        limitations:
          "Visible reachability/value observation only. Does not independently prove all dictionary, required, permission and lifecycle combinations.",
      };
    }),
    gaps = results
      .filter((r) => r.status === "NOT_OBSERVED")
      .map(({ observations, ...r }) => r),
    valueGaps = results
      .filter((r) => r.status === "VISIBLE_VALUE_NOT_VERIFIED")
      .map(({ observations, ...r }) => r),
    summary = {
      run,
      base,
      cancelled,
      resumedFrom: inherited?.run || null,
      selectedJobs,
      supplementaryOnly: process.argv.includes("--supplement"),
      currentRunObservedFields: new Set(
        observations.filter((o) => o.originRun === run).map((o) => o.id),
      ).size,
      provenance:
        "Prior run observations are retained with originRun; they are not claimed as a repeat on the current build. Current targeted observations are distinct.",
      expectedTables: fieldTables.length,
      expectedFields: expected.length,
      observedVisibleFields: observed.size,
      observedWithValueFields: withValue.size,
      missingFields: gaps.length,
      visibleWithoutVerifiedValue: valueGaps.length,
      screenCount: screens.length,
      failures: failures.length,
      pageErrors: pageErrors.length,
      coverageConclusion:
        cancelled ||
        gaps.length ||
        valueGaps.length ||
        failures.length ||
        pageErrors.length
          ? "PARTIAL_NOT_FULL_FIELD_ACCEPTANCE"
          : "REACHABILITY_OBSERVED_NOT_BUSINESS_ACCEPTANCE",
    };
  const result = {
    summary,
    screens,
    results,
    gaps,
    valueGaps,
    failures,
    pageErrors,
    screenshotWarnings,
  };
  fs.mkdirSync(path.join(root, "docs/stages/stage-02/evidence"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "docs/stages/stage-02/evidence/field-runtime-results.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(out, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(JSON.stringify(summary, null, 2));
  await context.close();
  if (
    cancelled ||
    gaps.length ||
    valueGaps.length ||
    failures.length ||
    pageErrors.length
  )
    process.exitCode = 1;
}
