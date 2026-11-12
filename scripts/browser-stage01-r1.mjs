import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { billTemplate } from "../prototype-shared/stage01/billing.js";
const root = path.resolve(import.meta.dirname, ".."),
  base = JSON.parse(
    fs.readFileSync(path.join(root, ".runtime/stage01/preview.json"))
  ).url;
const run = "R1-FLOW-" + new Date().toISOString().replace(/[:.]/g, "-"),
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
    await resident
      .locator(".s1-mobile .card")
      .filter({ hasText: "280.00" })
      .first()
      .click();
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
    await button(resident, "确认登记工单").click();
    await resident.getByText("待派单", { exact: true }).first().waitFor();
    return {
      url: resident.url(),
      screenshot: await screenshot(resident, "repair-submitted"),
    };
  });
  await step("repair-property-work", async () => {
    await go(web, "web", "/workorders/tasks");
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
    await button(resident, "确认登记工单").click();
    await resident.getByText("待派单", { exact: true }).first().waitFor();
    const residentUrl = resident.url();
    await go(staff, "staff", "/pages/stage01/tasks/index");
    await staff
      .locator(".s1-mobile .card")
      .filter({ hasText: "消防通道有堆放物" })
      .first()
      .click();
    await button(staff, "人工派单").click();
    await fill(staff, "HZ04", "清理通道并保留整改前后照片");
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
  await step("r1-import-publish-manual-check", async () => {
    await go(web, "web", "/property/bills/import");
    await web.getByLabel("来源名称").fill("R1复验导入");
    const file = path.join(out, "r1-bills.csv");
    fs.writeFileSync(file, billTemplate.replaceAll("台账-", "R1复验-"));
    await web.getByLabel("选择账单文件").setInputFiles(file);
    await web.locator('[data-field="IR03"]').first().waitFor();
    assert.ok(
      (await web.locator('[data-field="IR03"]').first().innerText()).includes(
        "青禾"
      )
    );
    await web.locator("input[type=checkbox]").first().check();
    await button(web, "确认导入有效行").click();
    await web.getByText("导入结果", { exact: true }).first().waitFor();
    await go(web, "web", "/property/bills");
    await web.getByLabel("状态", { exact: true }).selectOption("待发布");
    await button(web, "发布账单").first().click();
    await modal().waitFor();
    await modal().locator("input[type=checkbox]").check();
    await button(modal(), "确认发布账单").click();
    await modal().waitFor({ state: "hidden" });
    await go(web, "web", "/property/payments");
    await web.locator("[data-record]").first().waitFor();
    await button(web, "登记核对事项").first().click();
    await modal().waitFor();
    await fill(modal(), "EX06", "金额与原单核对一致，保留渠道结果");
    await button(modal(), "确认登记核对事项").click();
    await modal().waitFor({ state: "hidden" });
    await web.getByText("待处理", { exact: true }).click();
    await web
      .getByRole("cell", {
        name: "金额与原单核对一致，保留渠道结果",
        exact: true,
      })
      .waitFor();
    return { screenshot: await screenshot(web, "merged-payment-check") };
  });
  await step("r1-manual-task-classification-and-cancel", async () => {
    await go(web, "web", "/workorders/tasks");
    await button(web, "登记工单").click();
    await modal().waitFor();
    for (const [id, value] of Object.entries({
      RP13: "北门岗亭",
      RP14: "R1人工登记门锁故障",
      RP15: "值班人员",
      RP16: "13900000002",
    }))
      await fill(modal(), id, value);
    await button(modal(), "确认登记工单").click();
    await modal().waitFor({ state: "hidden" });
    await web.getByLabel("关键字").fill("R1人工登记门锁故障");
    await web.locator("[data-record]").first().waitFor();
    await button(web, "更正工单").click();
    await modal().waitFor();
    await modal().locator("#s1-WO16").selectOption("公共安全");
    await fill(modal(), "WO18", "检查锁具后修正类别");
    await button(modal(), "确认更正工单").click();
    await modal().waitFor({ state: "hidden" });
    await web.getByRole("cell", { name: "公共安全", exact: true }).waitFor();
    await button(web, "人工派单").click();
    await modal().waitFor();
    await fill(modal(), "WO05", "取消本次派单");
    await button(modal(), "取消").click();
    await modal().waitFor({ state: "hidden" });
    await web.getByRole("cell", { name: "待派单", exact: true }).waitFor();
    await webAction("人工派单", { WO05: "修复门锁并检查" });
    await webAction("接单");
    await button(web, "更正工单").click();
    await modal().waitFor();
    assert.ok(await modal().locator("#s1-WO15").isDisabled());
    await button(modal(), "取消").click();
    await web.locator("[data-record] td a").first().click();
    const drawer = web.locator(".ivu-drawer-wrap:visible");
    await drawer.getByText("原始上报", { exact: true }).click();
    await drawer.locator('[data-field="RP08"]').waitFor({ state: "visible" });
    assert.equal(
      await drawer.locator('[data-field="RP08"]').innerText(),
      "设施维修"
    );
    assert.equal(
      await drawer.locator("button").filter({ hasText: "人工派单" }).count(),
      0
    );
    return { screenshot: await screenshot(web, "manual-task-original-report") };
  });
  await step("stage00-affected-readonly-regression", async () => {
    await go(web, "web", "/spaces");
    await web.getByText("社区房屋档案", { exact: true }).first().waitFor();
    await web.getByText("青禾花园", { exact: true }).first().waitFor();
    await screenshot(web, "stage00-spaces");
    await go(web, "web", "/applications?tab=bindings");
    assert.ok((await web.locator("body").innerText()).includes("房屋绑定"));
    await go(staff, "staff", "/pages/stage01/charges/index");
    assert.equal(await button(staff, "发布账单").count(), 0);
    assert.equal(await button(staff, "登记临停费用").count(), 0);
    await go(resident, "resident", "/pages/profile/index");
    await resident.getByText("周明", { exact: true }).first().waitFor();
    return {
      checks: "Stage00空间入口与绑定可达；住户身份保留；管理端收费只读",
    };
  });
  await step("r1-list-detail-filters", async () => {
    await go(web, "web", "/property/bills");
    assert.equal(await web.locator(".header-context").count(), 0);
    await web.getByText("澄园小区", { exact: true }).click();
    await web.locator("[data-record]").first().waitFor();
    assert.ok(await web.locator('[data-record]').count()>=1);
    assert.ok((await web.locator('[data-record]').allInnerTexts()).every(text=>text.includes('澄园')), '树筛选所有结果均属所选小区，包括新导入账单');
    await web.locator("[data-record] td a").first().click();
    const drawer = web.locator(".ivu-drawer-wrap:visible");
    await drawer.getByText("费用明细", { exact: true }).waitFor();
    assert.equal(
      await drawer
        .getByRole("button", { name: "登记核对事项", exact: true })
        .count(),
      0
    );
    await screenshot(web, "bill-tabs");
    await web.locator(".ivu-drawer-close:visible").click();
    await web.getByText("全部授权房屋", { exact: true }).click();
    const states = await web
      .locator('select[aria-label="状态"] option')
      .allTextContents();
    assert.ok(states.includes("待发布"));
    assert.ok(states.includes("部分结清"));
    await go(web, "web", "/parking/business");
    await web.getByText("月租产品", { exact: true }).last().click();
    await web
      .getByRole("cell", { name: "青禾花园停车场", exact: true })
      .waitFor();
    await web
      .getByRole("cell", { name: "青禾停车科技", exact: true })
      .waitFor();
    await web.getByText("临停账单", { exact: true }).last().click();
    await web.getByRole("cell", { name: "2小时0分钟", exact: true }).waitFor();
    await web.getByRole("cell", {name:"苏A8K268",exact:true}).waitFor();
    await screenshot(web, "parking-details-list");
    await go(web, "web", "/workorders/events");
    assert.ok(web.url().includes("/workorders/tasks"));
    await go(web, "web", "/parking/checks");
    assert.ok(web.url().includes("/parking/business"));
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1024, height: 768 },
    ]) {
      await web.setViewportSize(size);
      await go(web, "web", "/workorders/tasks");
      assert.ok(
        await web.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      );
      await screenshot(web, "web-" + size.width);
    }
    for (const size of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await resident.setViewportSize(size);
      await go(resident, "resident", "/pages/stage01/repairs/index");
      assert.ok(
        await resident.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      );
      await screenshot(resident, "resident-" + size.width);
    }
    return { checks: "空间树、只读详情、完整状态、停车资料、旧链接、四种视口" };
  });
} catch (e) {
  console.error(e.message);
} finally {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify({ run, session, base, results, errors }, null, 2)
  );
  fs.writeFileSync(
    path.join(
      root,
      process.argv.some(arg=>arg.startsWith("--only=")) ? "docs/stages/stage-01/evidence/acceptance-r1/browser-layout.json" : "docs/stages/stage-01/evidence/acceptance-r1/browser-flows.json"
    ),
    JSON.stringify({ run, session, base, results, errors }, null, 2) + "\n"
  );
  await context.close();
}
process.exitCode =
  results.some((r) => r.status === "FAIL") || errors.length ? 1 : 0;
