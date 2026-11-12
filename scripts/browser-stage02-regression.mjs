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
    fs.readFileSync(path.join(root, ".runtime/stage02/preview.json")),
  ).url,
  run = "REGRESSION-" + new Date().toISOString().replace(/[:.]/g, "-"),
  session = "stage02-" + run,
  out = path.join(root, ".runtime/stage02", run);
fs.mkdirSync(out, { recursive: true });
const context = await chromium.launchPersistentContext(
    path.join(out, "profile"),
    {
      channel: "msedge",
      headless: true,
      viewport: { width: 1366, height: 768 },
    },
  ),
  results = [],
  errors = [],
  blocked = [];
context.on("page", (p) =>
  p.on("pageerror", (e) => errors.push({ url: p.url(), message: e.message })),
);
await context.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith(base + "/") || /^(blob:|data:)/.test(u)) return r.continue();
  blocked.push(u);
  return r.abort();
});
const page = await context.newPage();
async function step(id, fn) {
  try {
    const detail = await fn();
    results.push({ id, acs: ["AC02-052"], status: "PASS", detail });
    console.log("PASS " + id);
  } catch (e) {
    results.push({ id, acs: ["AC02-052"], status: "FAIL", error: e.message });
    console.error("FAIL " + id + ": " + e.message);
  }
}
try {
  await step("existing-web-routes", async () => {
    const observed = [];
    for (const [route, title] of [
      ["spaces", "社区房屋档案"],
      ["property/bills", "物业费账单"],
      ["property/payments", "缴费记录与异常"],
      ["parking/business", "停车业务"],
      ["workorders/events", "待核实事件"],
      ["workorders/tasks", "工单办理"],
    ]) {
      await page.goto(base + "/web/?session=" + session + "#/" + route);
      await page.evaluate(async () => {
        const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
        const a = createBrowserAdapter("web");
        await a.start();
        await a.identity("property-admin");
      });
      await page.reload();
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.waitForTimeout(400);
      const text = await page.locator("h1").innerText();
      assert.ok(text.includes(title), route + " " + text);
      observed.push({ route, title: text });
    }
    return observed;
  });
  await step(
    "h5-service-reset-preserves-existing-facts",
    async () =>
      await page.evaluate(async () => {
        const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
        const a = createBrowserAdapter("web");
        await a.start();
        const beforeBills = await a.stage01.query("bills"),
          beforeHouses = await a.query("houses");
        await a.service.auxiliary("scenario", { name: "S02-STATS" });
        await a.service.reset();
        const afterBills = await a.stage01.query("bills"),
          afterHouses = await a.query("houses");
        if (JSON.stringify(beforeBills) !== JSON.stringify(afterBills))
          throw Error("Stage01 bills changed");
        if (JSON.stringify(beforeHouses) !== JSON.stringify(afterHouses))
          throw Error("Foundation houses changed");
        return { foundationUnchanged: true, stage01Unchanged: true };
      }),
  );
  await step("three-mobile-home-shells", async () => {
    const observed = [];
    await page.setViewportSize({ width: 414, height: 896 });
    for (const [app, route] of [
      ["resident", "/pages/home/index"],
      ["merchant", "/pages/workbench/index"],
      ["staff", "/pages/workbench/index"],
    ]) {
      await page.goto(base + "/" + app + "/?session=" + session + "#" + route);
      await page.waitForFunction(
        () => document.querySelector("uni-page-body")?.innerText.length > 50,
      );
      const text = await page.locator("uni-page-body").innerText();
      assert.ok(!/Cannot read properties|Unhandled error/.test(text));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2,
      );
      assert.equal(overflow, false, app + " horizontal overflow");
      observed.push({
        app,
        route,
        text: text.slice(0, 240),
        horizontalOverflow: overflow,
      });
    }
    await page.screenshot({
      path: path.join(out, "staff-shell.png"),
      fullPage: true,
    });
    return observed;
  });
} finally {
  await context.close();
  const report = {
    run,
    base,
    session,
    results,
    errors,
    blockedRequests: blocked,
    scope:
      "Actual shared-entry regression in this isolated worktree only; does not import or test uncommitted Stage01 work.",
  };
  fs.writeFileSync(
    path.join(
      root,
      "docs/stages/stage-02/evidence",
      evidenceSubdir,
      "browser-regression.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      pass: results.filter((x) => x.status === "PASS").length,
      fail: results.filter((x) => x.status === "FAIL").length,
      pageErrors: errors.length,
    }),
  );
  if (results.some((x) => x.status === "FAIL") || errors.length)
    process.exitCode = 1;
}
