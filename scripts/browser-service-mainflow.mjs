// Stage02 V1.2: operate the published H5 pages; API reads verify persisted facts.
import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
const base = process.env.STAGE02_URL || "http://127.0.0.1:19221";
const runDir = fs
  .readFileSync(
    path.join(root, ".runtime/stage02/mainflow-current.txt"),
    "utf8",
  )
  .trim()
  .replace(/^\uFEFF/, "");
const out = path.join(path.resolve(root, runDir), "browser-" + Date.now());
fs.mkdirSync(out, { recursive: true });
const session = "stage02-v12-" + Date.now();
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 390, height: 844 } },
);
context.setDefaultTimeout(14000);
const steps = [],
  errors = [],
  blocked = [];
context.on("page", (p) =>
  p.on("pageerror", (e) => errors.push({ url: p.url(), error: e.message })),
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
  await field(p, name).locator("uni-picker").first().click();
  const column = p.locator("uni-picker-view-column:visible").first();
  await column.waitFor();
  const option = column.locator(".uni-picker-item").nth(index);
  const expected = (await option.innerText()).trim();
  await option.click();
  await p.waitForTimeout(350);
  await p.locator(".uni-picker-action-confirm:visible").click();
  assert.ok(
    (await field(p, name).innerText()).includes(expected),
    `选择器 ${name} 应显示实际点击的选项 ${expected}`,
  );
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
  await p.screenshot({ path: path.join(out, name + ".png"), fullPage: false });
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
  console.log(name);
  try {
    const detail = await fn();
    steps.push({ name, status: "PASS", detail });
    return detail;
  } catch (e) {
    steps.push({ name, status: "FAIL", error: e.message });
    await shot(resident, "failure-resident");
    await shot(merchant, "failure-merchant");
    throw e;
  }
}
const artifacts = [
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
let H, P, statsBefore;
try {
  await go(resident, "profile/index", "resident-a");
  await go(merchant, "workbench/index", "service-merchant-a");
  await go(web, "orders", "platform-admin");
  statsBefore = (await api(merchant, "overview")).values;
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
    await field(resident, "地址补充说明").scrollIntoViewIfNeeded();
    await button(resident, "保存地址").click();
    await resident.locator(".addresses-page>.error:visible").waitFor();
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
    await pick(resident, "社区", 0);
    await pick(resident, "小区", 1);
    await fill(resident, "详细地址", "演示路10号1栋1单元101室");
    await layout(resident, "address-390", "保存地址");
    await submit(resident, "保存地址");
    const rows = await api(resident, "query", ["addresses"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]["默认地址"], true);
    assert.equal(rows[0]["所属社区"], "C-A");
    assert.equal(rows[0]["所属小区"], "E-A");
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
          .filter({ hasText: "预约到点" })
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
        await pick(resident, "到点服务地点", 0);
      }
      await resident.locator(".agreement").click();
      await layout(resident, kind + "-booking-390", "提交并付款");
      await button(resident, "提交并付款").click();
      await resident.locator(".uni-modal__btn_primary:visible").click();
      await resident.waitForURL(/service\/order\?/);
      id = new URLSearchParams(resident.url().split("?").at(-1)).get("id");
      assert.ok(id);
      const r = await waitOrder(resident, id, "待接单");
      assert.equal(
        r.fundRecords.filter((f) => f["资金类型"] === "支付").length,
        1,
      );
      assert.equal(r._flowVersion, 2);
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
      assert.ok(
        (await field(merchant, "服务人员").innerText()).includes("陈师傅"),
      );
      const startTime = await field(merchant, "安排开始时间").boundingBox(),
        endTime = await field(merchant, "安排结束时间").boundingBox();
      assert.ok(
        Math.abs(startTime.y - endTime.y) < 2 && endTime.x > startTime.x,
        "起止时间紧凑并排",
      );
      await layout(merchant, kind + "-dispatch-390", "接单并派工");
      await submit(merchant, "接单并派工");
      await merchant.waitForURL(/service\/order\?/);
      const r = await waitOrder(merchant, id, "待服务");
      assert.equal(r.currentArrangement["安排状态"], "已生效");
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
      let cr;
      if (!home) {
        await go(resident, "service/voucher?id=" + id);
        cr = (await api(resident, "record", ["orders", id])).credential[
          "到点凭证码"
        ];
        await resident.locator(".voucher-code").waitFor();
        await shot(resident, "P-voucher");
      }
      await action(merchant, "提交服务结果");
      await fill(
        merchant,
        "实际完成内容",
        home ? "已完成约定基础保洁" : "已完成循环扇清洗",
      );
      if (!home) {
        await fill(merchant, "到点凭证码", "WRONG-CODE");
        await button(merchant, "提交服务结果").click();
        await merchant.locator(".message.error:visible").waitFor();
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
        await fill(merchant, "到点凭证码", cr);
      }
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
      await go(resident, "service/order?id=" + id);
      await layout(resident, kind + "-evaluate-entry", "评价服务");
      await action(resident, "评价服务");
      await fill(
        resident,
        "评价内容",
        home ? "保洁细致，按约完成" : "到点清洗方便，结果满意",
      );
      await submit(resident, "评价服务");
      await resident.waitForURL(/service\/order\?/);
      const r = await waitOrder(resident, id, "已完成");
      assert.equal(r.evaluation["总体评分"], 5);
      await resident.reload();
      await resident.locator(".order-tabs").waitFor();
      await button(resident, "服务结果").click();
      assert.ok(
        (await resident.locator(".order-panel").innerText()).includes(
          home ? "保洁细致" : "到点清洗",
        ),
      );
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
    const r = await fixtureOrder("SV-AC", true);
    await go(merchant, "service/order?id=" + r._id);
    await action(merchant, "提交服务结果");
    await fill(merchant, "实际完成内容", "已完成空调清洗");
    const photos = merchant.locator('[data-field-name="结果图片"]:visible');
    assert.ok((await photos.innerText()).includes("*"));
    await button(merchant, "提交服务结果").click();
    await merchant.locator(".message.error:visible").waitFor();
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
    await action(merchant, a.label);
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
    await action(merchant, "提出处理方案");
    await pick(merchant, "方案处理类型", 0);
    await pick(merchant, "业务结案方式", 0);
    assert.equal(await field(merchant, "补充履约内容").count(), 0);
    assert.equal(await field(merchant, "服务是否已实际开始").count(), 0);
    await fill(merchant, "方案说明", "经核对同意全额退款");
    await submit(merchant, "提出处理方案");
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
    for (const t of ["订单信息", "服务结果", "资金记录", "取消与售后"]) {
      await drawer.getByText(t, { exact: true }).first().click();
      await shot(web, "web-" + t);
    }
    await layout(web, "web-1366");
    await web.setViewportSize({ width: 1920, height: 1080 });
    await layout(web, "web-1920");
    return { H, P };
  });
  await step("G12 公共只读行、管理端既有入口", async () => {
    const staff = await context.newPage();
    await staff.goto(
      `${base}/staff/?session=${session}#/pages/workbench/index`,
    );
    await staff.locator('.portal[data-app="staff"]').waitFor();
    assert.equal(await staff.locator(".form-field--readonly input").count(), 0);
    await shot(staff, "staff-workbench");
    await staff.close();
    return "Staff workbench visible";
  });
  assert.deepEqual(errors, [], "No browser runtime errors");
  assert.deepEqual(blocked, [], "No external business requests");
} catch (error) {
  process.exitCode = 1;
  console.error(error.stack);
} finally {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(
      { base, session, H, P, hashes, steps, errors, blocked },
      null,
      2,
    ),
  );
  console.log("Evidence: " + out);
  await context.close();
}
