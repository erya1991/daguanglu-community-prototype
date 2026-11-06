import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import zlib from "node:zlib";
const root = path.resolve(import.meta.dirname, ".."),
  base = JSON.parse(
    fs.readFileSync(path.join(root, ".runtime/stage01/preview.json"))
  ).url;
const run = "FLOW-" + new Date().toISOString().replace(/[:.]/g, "-"),
  session = "stage01-" + run,
  out = path.join(root, ".runtime/stage01", run),
  results = [],
  errors = [];
fs.mkdirSync(out, { recursive: true });
function png(file, after) {
  const w = 320,
    h = 180,
    raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const k = y * (w * 3 + 1) + 1 + x * 3,
        object = y > 85 && x > 95 && x < 225;
      const c = object
        ? after
          ? [77, 145, 103]
          : [193, 100, 66]
        : [225, 233, 227];
      c.forEach((v, i) => (raw[k + i] = v));
    }
  }
  const crc = (b) => {
      let n = -1;
      for (const v of b) {
        n ^= v;
        for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
      }
      return (n ^ -1) >>> 0;
    },
    chunk = (type, data) => {
      const t = Buffer.from(type),
        size = Buffer.alloc(4),
        c = Buffer.alloc(4);
      size.writeUInt32BE(data.length);
      c.writeUInt32BE(crc(Buffer.concat([t, data])));
      return Buffer.concat([size, t, data, c]);
    },
    ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ])
  );
}
const before = path.join(out, "before.png"),
  after = path.join(out, "after.png");
png(before, false);
png(after, true);
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
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
  await p.waitForTimeout(500);
}
const button = (p, text) =>
  p
    .locator("button:visible,uni-button:visible")
    .filter({ hasText: new RegExp("^\\s*" + text + "\\s*$") })
    .last();
const field = (p, id) => p.locator('[data-field="' + id + '"]:visible').last();
const modal = () => web.locator(".ivu-modal-wrap:visible").last();
async function fill(p, id, value) {
  await field(p, id)
    .locator("input:not([type=file]),textarea")
    .first()
    .fill(value);
}
async function webAction(name, values = {}) {
  await button(web, name).click();
  await modal().waitFor();
  for (const [id, value] of Object.entries(values))
    await fill(modal(), id, value);
  await button(modal(), "确认" + name).click();
  await modal().waitFor({ state: "hidden" });
  await web.waitForTimeout(250);
}
async function uploadPhoto(p, id, file) {
  const selected = p.waitForEvent("filechooser");
  await field(p, id).getByText("选择／拍摄照片", { exact: true }).click();
  await (await selected).setFiles(file);
  await field(p, id).locator(".photo").first().waitFor();
}
async function screenshot(p, id) {
  const file = path.join(out, id + ".png");
  await p.waitForTimeout(350);
  await p.screenshot({ path: file, fullPage: true });
  return path.relative(root, file).replaceAll("\\", "/");
}
async function step(id, fn) {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  if (only && !id.includes(only)) return;
  try {
    const detail = await fn();
    results.push({ id, status: "PASS", detail, at: new Date().toISOString() });
    console.log("PASS " + id);
  } catch (e) {
    const shot = await screenshot(resident, id + "-resident-failure").catch(
      () => null
    );
    console.log(
      "RESIDENT " +
        resident.url() +
        " " +
        (await resident.locator("body").innerText()).slice(0, 1600)
    );
    console.log("WEB " + (await web.locator("body").innerText()).slice(-2200));
    console.log(
      "STAFF " +
        staff.url() +
        " " +
        (await staff.locator("body").innerText()).slice(0, 3000)
    );
    await screenshot(staff, id + "-staff-failure").catch(() => null);
    results.push({ id, status: "FAIL", error: e.message, screenshot: shot });
    console.log("FAIL " + id + " " + e.message);
    throw e;
  }
}
try {
  await step("property-pay", async () => {
    await go(resident, "resident", "/pages/stage01/fees/index");
    await resident.locator(".s1-mobile .card").filter({hasText:'280.00'}).first().click();
    await button(resident, "去缴费").click();
    await button(resident, "确认缴费").click();
    await resident.locator(".uni-modal__btn_primary:visible").click();
    await resident.getByText("缴费已确认", { exact: true }).waitFor();
    const shot = await screenshot(resident, "property-paid");
    await button(resident, "查看付款记录").click();
    await resident.getByText("普通业务凭证号", { exact: true }).count();
    return { screenshot: shot, url: resident.url() };
  });
  await step("repair-submit", async () => {
    await go(resident, "resident", "/pages/stage01/repairs/create");
    await fill(resident, "RP13", "青禾花园1幢东侧入口");
    await fill(
      resident,
      "RP14",
      "东侧走廊照明不亮，夜间通行不便，请安排检修。"
    );
    await button(resident, "确认登记事项").click();
    await resident.getByText("待核实", { exact: true }).first().waitFor();
    return {
      url: resident.url(),
      screenshot: await screenshot(resident, "repair-submitted"),
    };
  });
  await step("repair-property-work", async () => {
    await go(web, "web", "/workorders/events");
    await button(web, "查看办理").first().click();
    await webAction("核实事项", { EV06: "现场核实灯具损坏，应由本物业维修" });
    await go(web, "web", "/workorders/tasks");
    await button(web, "查看办理").first().click();
    await webAction("人工派单", { WO05: "更换损坏灯具并核对照明" });
    await button(web, "接单").click();
    await button(modal(), "确认接单").click();
    await web.waitForTimeout(350);
    await webAction("提交复核", {
      PR02: "已更换灯具并检查线路",
      PR07: "照明已恢复正常",
    });
    await webAction("复核", {
      RV04: "现场复查照明正常",
      EV12: "灯具已修复，欢迎确认处理结果",
    });
    return { screenshot: await screenshot(web, "repair-review") };
  });
  await step("repair-resident-confirm-evaluate", async () => {
    await resident.reload();
    await button(resident, "确认处理结果").click();
    await button(resident, "确认确认处理结果").click();
    await button(resident, "服务评价").click();
    await field(resident, "VA01").click();
    await resident.locator(".uni-picker-action-confirm:visible").click();
    await button(resident, "确认服务评价").click();
    await resident.getByText("已评价", { exact: true }).waitFor();
    return { screenshot: await screenshot(resident, "repair-evaluated") };
  });
  await step("monthly-new-and-renewal", async () => {
    await go(resident, "resident", "/pages/stage01/parking/monthly");
    await button(resident, "确认期间并创建订单").click();
    await button(resident, "确认缴费").click();
    await resident.locator(".uni-modal__btn_primary:visible").click();
    await resident.getByText("缴费已确认", { exact: true }).waitFor();
    await go(resident, "resident", "/pages/stage01/parking/monthly");
    await button(resident, "续费").click();
    await button(resident, "确认期间并创建订单").click();
    await button(resident, "确认缴费").click();
    await resident.locator(".uni-modal__btn_primary:visible").click();
    await resident.getByText("缴费已确认", { exact: true }).waitFor();
    return { screenshot: await screenshot(resident, "monthly-renewed") };
  });
  await step("temporary-payment", async () => {
    await go(resident, "resident", "/pages/stage01/parking/temporary");
    await resident.getByText("PARK-20261105-018", { exact: true }).click();
    await button(resident, "确认缴费").click();
    await button(resident, "确认缴费").click();
    await resident.locator(".uni-modal__btn_primary:visible").click();
    await resident.getByText("缴费已确认", { exact: true }).waitFor();
    return { screenshot: await screenshot(resident, "temporary-paid") };
  });
  await step("hazard-resident-to-staff-close", async () => {
    await go(resident, "resident", "/pages/stage01/hazards/create");
    await fill(resident, "RP13", "1幢消防通道");
    await fill(resident, "RP14", "消防通道有堆放物，请核实清理并保持通畅。");
    await uploadPhoto(resident, "RP17", before);
    await field(resident, "RP17").locator(".photo").first().waitFor();
    await button(resident, "确认登记事项").click();
    await resident.getByText("待核实", { exact: true }).first().waitFor();
    const residentUrl = resident.url();
    await go(staff, "staff", "/pages/stage01/tasks/index");
    await staff
      .locator(".s1-mobile .card")
      .filter({ hasText: "消防通道有堆放物" })
      .first()
      .click();
    await button(staff, "核实事项").click();
    await fill(staff, "EV06", "现场核实通道堆放物影响通行");
    await fill(staff, "HZ04", "清理通道并保留整改前后照片");
    await button(staff, "确认核实事项").click();
    await go(staff, "staff", "/pages/stage01/tasks/index");
    await staff
      .locator(".s1-mobile .card")
      .filter({ hasText: "消防通道有堆放物" })
      .first()
      .click();
    await button(staff, "人工派单").click();
    await fill(staff, "WO05", "清理堆放物并复查通行条件");
    await button(staff, "确认人工派单").click();
    await button(staff, "接单").click();
    await staff.locator(".uni-modal__btn_primary:visible").click();
    await button(staff, "提交复核").click();
    await fill(staff, "PR02", "已清理堆放物，通道恢复通畅");
    await fill(staff, "PR07", "现场核对整改完成");
    await uploadPhoto(staff, "PR05", before);
    await field(staff, "PR05").locator(".photo").first().waitFor();
    await uploadPhoto(staff, "PR06", after);
    await field(staff, "PR06").locator(".photo").first().waitFor();
    await button(staff, "确认提交复核").click();
    await button(staff, "复核").click();
    await fill(staff, "RV04", "通道通畅，前后证据核验一致");
    await fill(staff, "EV12", "堆放物已清理，通道恢复通畅");
    await staff.getByText("公开处理照片 1", { exact: false }).click();
    await button(staff, "确认复核").click();
    await button(staff, "确认销号").click();
    await staff.locator(".uni-modal__btn_primary:visible").click();
    await resident.goto(residentUrl);
    await resident.getByText("已销号", { exact: true }).first().waitFor();
    return {
      screenshot: await screenshot(resident, "hazard-public-result"),
      staff: await screenshot(staff, "hazard-closed"),
    };
  });
} catch (e) {
  console.error(e.message);
} finally {
  fs.writeFileSync(
    path.join(root, "docs/stages/stage-01/evidence/browser-flows.json"),
    JSON.stringify({ run, session, base, results, errors }, null, 2) + "\n"
  );
  await context.close();
}
process.exitCode =
  results.some((r) => r.status === "FAIL") || errors.length ? 1 : 0;
