import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  base = JSON.parse(
    fs.readFileSync(path.join(root, ".runtime/stage01/preview.json"))
  ).url;
const run = "EXCEPT-" + Date.now(),
  session = "stage01-" + run,
  out = path.join(root, ".runtime/stage01", run),
  results = [],
  observed = {},
  errors = [];
fs.mkdirSync(out, { recursive: true });
const last = JSON.parse(
    fs.readFileSync(
      path.join(root, "docs/stages/stage-01/evidence/browser-flows.json")
    )
  ),
  photo = path.join(root, ".runtime/stage01", last.run, "before.png");
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 390, height: 844 } }
);
context.setDefaultTimeout(10000);
context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
await context.route("**/*", (r) =>
  r
    .request()
    .url()
    .startsWith(base + "/") || /^(data:|blob:)/.test(r.request().url())
    ? r.continue()
    : r.abort()
);
const web = await context.newPage(),
  r = await context.newPage();
const button = (p, name) =>
  p
    .locator("button:visible,uni-button:visible")
    .filter({ hasText: new RegExp("^\\s*" + name + "\\s*$") })
    .last();
const field = (id) => r.locator('[data-field="' + id + '"]:visible').last();
async function go(route) {
  await r.goto(base + "/resident/?session=" + session + "#" + route);
  await r.waitForTimeout(400);
}
async function aux(name, params) {
  return web.evaluate(
    async ({ name, params }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js");
      const w = createBrowserAdapter("web");
      await w.start();
      return w.stage01.auxiliary(name, params);
    },
    { name, params }
  );
}
async function step(id, fn) {
  try {
    const detail = await fn();
    results.push({ id, status: "PASS", detail });
    console.log("PASS " + id);
  } catch (e) {
    await r.screenshot({
      path: path.join(out, id + "-failure.png"),
      fullPage: true,
    });
    console.log((await r.locator("body").innerText()).slice(-5000));
    results.push({ id, status: "FAIL", error: e.message });
    console.error("FAIL " + id + " " + e.message);
    throw e;
  }
}
try {
  await web.goto(base + "/web/?session=" + session + "#/property/bills");
  await web.getByText("物业费账单", { exact: true }).last().waitFor();
  await step("unknown-payment-reload-query", async () => {
    await aux("mode", { mode: "unknown" });
    await go("/pages/stage01/fees/index");
    await r
      .locator(".s1-mobile .card")
      .filter({ hasText: "280.00" })
      .first()
      .click();
    await button(r, "去缴费").click();
    await button(r, "确认缴费").click();
    await r.locator(".uni-modal__btn_primary:visible").click();
    await r.getByText("结果待确认", { exact: true }).first().waitFor();
    const url = r.url();
    await r.reload();
    await r.getByText("结果待确认", { exact: true }).first().waitFor();
    assert.equal(await button(r, "确认缴费").count(), 0);
    await button(r, "查询原支付").click();
    await r.getByText("缴费已确认", { exact: true }).waitFor();
    const file = path.join(out, "payment-recovered.png");
    await r.screenshot({ path: file, fullPage: true });
    return { url, screenshot: path.relative(root, file).replaceAll("\\", "/") };
  });
  await step("photo-failure-retry-preserves-input", async () => {
    await aux("uploadFailure", { fail: true });
    await go("/pages/stage01/repairs/create");
    const text = "楼梯扶手松动，上传失败后保留此说明。";
    await field("RP13").locator("input,textarea").fill("2幢公共楼梯");
    await field("RP14").locator("input,textarea").fill(text);
    const chooser = r.waitForEvent("filechooser");
    await field("RP17").getByText("选择／拍摄照片", { exact: true }).click();
    await (await chooser).setFiles(photo);
    await button(r, "重试上传").waitFor();
    observed.AT08 = [
      {
        view: "P-B06",
        url: r.url(),
        text: await field("AT08").innerText(),
        screenshot: path
          .relative(root, path.join(out, "upload-failed.png"))
          .replaceAll("\\", "/"),
      },
    ];
    assert.equal(
      await field("RP14").locator("textarea,input").inputValue(),
      text
    );
    await r.screenshot({
      path: path.join(out, "upload-failed.png"),
      fullPage: true,
    });
    await aux("uploadFailure", { fail: false });
    await button(r, "重试上传").click();
    await field("RP17").locator(".photo").first().waitFor();
    assert.equal(
      await field("RP14").locator("textarea,input").inputValue(),
      text
    );
    await button(r, "确认登记事项").click();
    await r.getByText("待核实", { exact: true }).first().waitFor();
    const file = path.join(out, "upload-retried.png");
    await r.screenshot({ path: file, fullPage: true });
    return {
      screenshot: path.relative(root, file).replaceAll("\\", "/"),
      retainedText: text,
    };
  });
} catch (e) {
  console.error(e.stack);
} finally {
  fs.writeFileSync(
    path.join(root, "docs/stages/stage-01/evidence/browser-exceptions.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        run,
        session,
        base,
        results,
        errors,
        observed,
        boundary:
          "Auxiliary modes prepare local failure conditions; remaining actions use actual product UI. Not real payment or WeChat evidence.",
      },
      null,
      2
    ) + "\n"
  );
  await context.close();
}
process.exitCode =
  results.some((r) => r.status === "FAIL") || errors.length ? 1 : 0;
