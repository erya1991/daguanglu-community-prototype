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
  base = JSON.parse(
    fs.readFileSync(path.join(root, ".runtime/stage02/preview.json"), "utf8"),
  ).url,
  run = "SECURITY-" + new Date().toISOString().replace(/[:.]/g, "-"),
  session = "stage02-" + run,
  out = path.join(root, ".runtime/stage02", run);
const artifactPaths = [
  "web/manager/dist/index.html",
  "miniapp/apps/resident-miniapp/dist/build/h5/index.html",
  "miniapp/apps/merchant-miniapp/dist/build/h5/index.html",
];
function artifactHashes() {
  return Object.fromEntries(
    artifactPaths.map((file) => [
      file,
      createHash("sha256")
        .update(fs.readFileSync(path.join(root, file)))
        .digest("hex"),
    ]),
  );
}
const artifactHashesBefore = artifactHashes();
fs.mkdirSync(out, { recursive: true });
const fixture = fs
    .readFileSync(path.join(root, ".runtime/stage02/fixtures/demo-service.png"))
    .toString("base64"),
  results = [],
  errors = [],
  blockedRequests = [],
  steps = [];
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 1366, height: 768 } },
);
context.setDefaultTimeout(15000);
context.on("page", (p) =>
  p.on("pageerror", (e) => errors.push({ url: p.url(), message: e.message })),
);
await context.route("**/*", (r) => {
  const url = r.request().url();
  if (url.startsWith(base + "/") || /^(data:|blob:)/.test(url))
    return r.continue();
  blockedRequests.push(url);
  return r.abort();
});
const page = await context.newPage();
async function call(app, account, method, args = [], baseApi = false) {
  return page.evaluate(
    async ({ app, account, method, args, baseApi }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js"),
        a = createBrowserAdapter(app);
      await a.start();
      await a.identity(account);
      return (baseApi ? a : a.service)[method](...args);
    },
    { app, account, method, args, baseApi },
  );
}
async function upload(app, account, name, visibility = "业务可见") {
  return page.evaluate(
    async ({ app, account, name, visibility, fixture }) => {
      const { createBrowserAdapter } = await import("/_shared/storage-h5.js"),
        a = createBrowserAdapter(app);
      await a.start();
      await a.identity(account);
      const data = Uint8Array.from(atob(fixture), (c) => c.charCodeAt(0));
      return a.service.upload(new File([data], name, { type: "image/png" }), {
        visibility,
      });
    },
    { app, account, name, visibility, fixture },
  );
}
async function access(app, account, kind, params) {
  return page.evaluate(
    async ({ app, account, kind, params }) => {
      try {
        const { createBrowserAdapter } = await import("/_shared/storage-h5.js"),
          a = createBrowserAdapter(app);
        await a.start();
        await a.identity(account);
        const f =
          kind === "service"
            ? await a.service.attachment(params)
            : kind === "owned"
              ? await a.ownedAttachment(params.id)
              : await a.attachment(params);
        return { allowed: true, name: f.name, bytes: f.blob?.size || 0 };
      } catch (e) {
        return { allowed: false, message: e.message };
      }
    },
    { app, account, kind, params },
  );
}
async function legacyFingerprint() {
  return page.evaluate(async () => {
    const q = indexedDB.open("dgl-community-prototype-stage00", 1),
      database = await new Promise((resolve, reject) => {
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      }),
      key = new URL(location.href).searchParams.get("session"),
      get = database.transaction("sessions").objectStore("sessions").get(key),
      s = await new Promise((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
    return JSON.stringify({
      stage01: s.stage01,
      houses: s.houses,
      relations: s.relations,
      applications: s.applications,
      files: s.files,
      attachments: Object.fromEntries(
        Object.entries(s.attachments || {}).filter(([, f]) => !f.stage02),
      ),
    });
  });
}
const hash = (s) => createHash("sha256").update(s).digest("hex");
async function goPersonnel() {
  await page.goto(base + "/web/?session=" + session + "#/service/personnel");
  await call("web", "property-admin", "options");
  await page.reload();
  await page.locator(".service-workspace").waitFor();
}
const drawer = () => page.locator(".service-action-drawer:visible").last();
const field = (name) =>
  drawer()
    .locator(".service-field")
    .filter({
      has: page
        .locator("label")
        .filter({ hasText: new RegExp("^" + name + "(?: \\*)?$") }),
    })
    .first();
async function choose(name, value) {
  const f = field(name);
  await f.locator(".ivu-select-selection").click();
  await f
    .locator(".ivu-select-dropdown:visible .ivu-select-item")
    .filter({ hasText: new RegExp("^\\s*" + value + "\\s*$") })
    .first()
    .click();
}
async function shot(name) {
  const file = path.join(out, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  return path.relative(root, file).replaceAll("\\", "/");
}
async function step(id, acs, fn) {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  if (only && only !== id) return;
  try {
    const detail = await fn();
    results.push({ id, acs, status: "PASS", detail });
    console.log("PASS " + id);
  } catch (error) {
    results.push({
      id,
      acs,
      status: "FAIL",
      error: error.message,
      screenshot: await shot(id + "-failure").catch(() => null),
    });
    console.error("FAIL " + id + ": " + error.message);
    console.error((await page.locator("body").innerText()).slice(-2000));
  }
}
try {
  await goPersonnel();
  await call("web", "property-admin", "auxiliary", [
    "scenario",
    { name: "S02-RULING" },
  ]);
  const legacyBefore = hash(await legacyFingerprint());
  await step(
    "internal-ruling-binding-authority",
    ["AC02-031", "AC02-042"],
    async () => {
      const sale = (
        await call("web", "property-admin", "query", ["aftersales", {}])
      ).find((r) =>
        (r._actions || []).some((a) => a.name === "aftersale.ruling"),
      );
      assert.ok(sale, "Existing legal after-sale");
      const uploaded = await upload(
        "web",
        "property-admin",
        "线下裁定内部依据.png",
      );
      const options = await call("web", "property-admin", "options");
      const ruling = await call("web", "property-admin", "command", [
        "aftersale.ruling",
        {
          id: sale._id,
          revision: sale._rev,
          operationId: run + "-bind-internal-ruling",
          data: {
            裁定结果: "不予退款",
            裁定后业务处理: "保留原状态",
            裁定说明: "线下核查结果；公开结论不公开内部附件",
            裁定作出人: "演示线下裁定人",
            裁定作出时间: options.clock,
            裁定依据附件: [
              {
                id: uploaded.id,
                图片说明: "仅授权Web可见的内部依据",
                显示顺序: 1,
              },
            ],
          },
        },
      ]);
      const attempts = [];
      for (const actor of [
        { app: "resident", account: "resident-a" },
        { app: "merchant", account: "merchant" },
        { app: "staff", account: "property-admin" },
        { app: "web", account: "service-web-limited" },
      ])
        for (const attempt of [
          {
            name: "omitted-field",
            kind: "service",
            p: { table: "aftersales", id: sale._id, attachmentId: uploaded.id },
          },
          {
            name: "forged-public-field",
            kind: "service",
            p: {
              table: "aftersales",
              id: sale._id,
              attachmentId: uploaded.id,
              field: "问题证据",
            },
          },
          {
            name: "no-record-context",
            kind: "service",
            p: { attachmentId: uploaded.id },
          },
          { name: "base-owned", kind: "owned", p: { id: uploaded.id } },
          {
            name: "base-attachment",
            kind: "base",
            p: {
              table: "aftersales",
              id: sale._id,
              blob: uploaded.id,
              attachmentId: uploaded.id,
              field: "问题证据",
            },
          },
        ]) {
          const result = await access(
            actor.app,
            actor.account,
            attempt.kind,
            attempt.p,
          );
          assert.equal(
            result.allowed,
            false,
            actor.app + " " + attempt.name + " denied",
          );
          attempts.push({ ...actor, name: attempt.name, ...result });
        }
      const authorized = await access("web", "property-admin", "service", {
        table: "aftersales",
        id: sale._id,
        attachmentId: uploaded.id,
      });
      assert.equal(authorized.allowed, true);
      assert.ok(authorized.bytes > 0);
      return {
        saleId: sale._id,
        attachmentId: uploaded.id,
        bindingVisibilityWasPublicAtUpload: true,
        attempts,
        authorized,
        rulingVersion: ruling.record?.rulings?.at(-1)?.裁定版本,
        screenshot: await shot("ruling-security-web"),
      };
    },
  );
  await step(
    "owner-cannot-bypass-internal-visibility",
    ["AC02-042"],
    async () => {
      const attempts = [];
      for (const actor of [
        { app: "resident", account: "resident-a" },
        { app: "merchant", account: "merchant" },
      ]) {
        const file = await upload(
          actor.app,
          actor.account,
          actor.app + "本人内部标记.png",
          "internal",
        );
        for (const kind of ["service", "owned", "base"]) {
          const result = await access(actor.app, actor.account, kind, {
            id: file.id,
            attachmentId: file.id,
            blob: file.id,
            field: "需求图片",
          });
          assert.equal(
            result.allowed,
            false,
            actor.app + " owner " + kind + " rejected",
          );
          attempts.push({ ...actor, kind, attachmentId: file.id, ...result });
        }
      }
      return attempts;
    },
  );
  await step(
    "unbound-owner-preview-is-preserved",
    ["AC02-043", "AC02-047"],
    async () => {
      const facts = [];
      for (const actor of [
        { app: "resident", account: "resident-a" },
        { app: "merchant", account: "merchant" },
        { app: "web", account: "property-admin" },
      ]) {
        const file = await upload(
          actor.app,
          actor.account,
          actor.app + "本人未提交图片.png",
        );
        for (const kind of ["service", "owned"]) {
          const result = await access(actor.app, actor.account, kind, {
            id: file.id,
            attachmentId: file.id,
          });
          assert.equal(
            result.allowed,
            true,
            actor.app + " ordinary unbound owner " + kind + " allowed",
          );
          assert.ok(result.bytes > 0);
          facts.push({ ...actor, kind, ...result });
        }
      }
      return facts;
    },
  );
  for (const conclusion of ["不认可", "认可"])
    await step(
      "personnel-material-web-review-" + conclusion,
      ["AC02-004", "AC02-042", "AC02-043"],
      async () => {
        const file = await upload(
            "merchant",
            "merchant",
            "新人员空调证明-" + conclusion + ".png",
          ),
          name = "新材料核验-" + conclusion + "-" + run.slice(-8);
        const created = await call("merchant", "merchant", "command", [
          "personnel.save",
          {
            operationId: run + "-person-" + conclusion,
            data: {
              姓名: name,
              工作联系电话: "13800006666",
              可执行服务类目: ["CAT-AC"],
              技能说明: "仅使用有效核验后的空调清洗证明",
              人员资质材料: [
                {
                  材料名称: "空调清洗示例证明",
                  对应服务类目: ["CAT-AC"],
                  证明编号: "DEMO-" + conclusion,
                  发证机构: "示例培训机构",
                  生效日期: "2026-01-01",
                  长期有效: true,
                  证明文件: [
                    {
                      id: file.id,
                      图片说明: "本轮本人真实上传的新材料",
                      显示顺序: 1,
                    },
                  ],
                },
              ],
            },
          },
        ]);
        assert.notEqual(
          created.record.人员资质材料[0].核验结论,
          "认可",
          "Upload/save does not approve proof",
        );
        await goPersonnel();
        const row = page.locator('[data-record="' + created.id + '"]');
        await row.waitFor();
        await row
          .getByRole("button", { name: "查看详情", exact: true })
          .click();
        await page
          .locator(
            '.service-detail-drawer:visible [data-action="personnel.review"]',
          )
          .last()
          .click();
        await choose("核验结论", conclusion);
        await field("核验意见")
          .locator("input,textarea")
          .first()
          .fill(
            conclusion === "认可"
              ? "已核对本轮上传材料与人员及服务类目，核验认可"
              : "本轮材料无法证明对应能力，核验不认可",
          );
        await page
          .locator('[data-action="submit:personnel.review"]:visible')
          .last()
          .click();
        let current;
        for (let i = 0; i < 25; i++) {
          current = await call("web", "property-admin", "record", [
            "personnel",
            created.id,
          ]);
          if (current.人员资质材料[0].核验结论 === conclusion) break;
          await page.waitForTimeout(200);
        }
        assert.equal(current.人员资质材料[0].核验结论, conclusion);
        assert.ok(current.人员资质材料[0].核验意见);
        assert.equal(
          current.人员资质材料[0].材料有效性,
          conclusion === "认可" ? "有效" : "待核实",
        );
        assert.ok(
          current.history.some((h) => h.动作名称 === "personnel.review"),
        );
        return {
          personId: created.id,
          conclusion,
          material: current.人员资质材料[0],
          screenshot: await shot("personnel-review-" + conclusion),
        };
      },
    );
  await step(
    "mobile-upload-save-failure-retains-form",
    ["AC02-045"],
    async () => {
      await call("merchant", "merchant", "auxiliary", [
        "scenario",
        { name: "S02-BASE" },
      ]);
      const main = await upload("merchant", "merchant", "失败恢复原主图.png");
      const name = "失败恢复新供给-" + run.slice(-8);
      const data = {
        服务名称: name,
        所属服务类目: "CAT-CLEAN",
        服务主图: [{ id: main.id, 图片说明: "原主图", 显示顺序: 1 }],
        介绍图片: [],
        服务简介: "失败前的原服务简介",
        服务详细说明: "本单仅固定范围的清洁服务，失败后保留输入和附件",
        公开服务电话: "13800001111",
        服务规格集合: [
          {
            规格编号: "SPEC-FAILURE",
            规格名称: "失败恢复标准包",
            规格说明: "固定规格",
            包含内容: "本次约定区域基础清洁",
            不包含内容: "额外材料",
            服务对象填写要求: "选填",
            规格启用状态: "启用",
            组合集合: [
              {
                组合履约方式名称: "上门",
                组合流程模板: "上门",
                组合固定价格: "72.38",
                组合启用状态: "启用",
                完成证据要求: "可选图片",
                上门覆盖社区: ["C-A"],
                上门覆盖小区: ["E-A"],
              },
            ],
          },
        ],
      };
      const key = "service:merchant:new:service.save";
      await call(
        "merchant",
        "merchant",
        "draft",
        [key, { data, operationId: run + "-failure-new-supply" }],
        true,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        base +
          "/merchant/?session=" +
          session +
          "#/pages/service/action?table=services&action=service.save",
      );
      const mobileField = (n) =>
        page.locator('[data-field-name="' + n + '"]:visible').first();
      const mobileButton = (scope, label) =>
        scope
          .locator("uni-button:visible,button:visible")
          .filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") })
          .last();
      await mobileField("服务名称").waitFor();
      await page.waitForTimeout(300);
      await mobileField("服务简介")
        .locator("input,textarea")
        .first()
        .fill("真实上传及保存失败后仍保留的输入");
      const pictures = mobileField("介绍图片");
      async function choosePicture() {
        const [chooser] = await Promise.all([
          page.waitForEvent("filechooser"),
          mobileButton(pictures, "上传／拍照").click(),
        ]);
        await chooser.setFiles(
          path.join(root, ".runtime/stage02/fixtures/demo-service.png"),
        );
      }
      await choosePicture();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('[data-field-name="介绍图片"] .file-name')
            .length === 1,
      );
      await call("merchant", "merchant", "auxiliary", [
        "mode",
        { kind: "upload", outcome: "failure" },
      ]);
      await choosePicture();
      await pictures.locator(".error:visible").first().waitFor();
      assert.equal(await pictures.locator(".file-name").count(), 1);
      assert.equal(
        await mobileField("服务主图").locator(".file-name").count(),
        1,
      );
      assert.equal(
        await mobileField("服务简介")
          .locator("input,textarea")
          .first()
          .inputValue(),
        "真实上传及保存失败后仍保留的输入",
      );
      const uploadFailure = await shot("mobile-upload-failure-retains");
      await call("merchant", "merchant", "auxiliary", [
        "mode",
        { kind: "upload", outcome: "normal" },
      ]);
      await mobileButton(pictures, "重试未完成的上传").click();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('[data-field-name="介绍图片"] .file-name')
            .length === 2,
      );
      await page.waitForTimeout(200);
      const before = await call("merchant", "merchant", "draft", [key], true);
      assert.equal(before.data["介绍图片"].length, 2);
      const countBefore = (
        await call("merchant", "merchant", "query", ["services", {}])
      ).length;
      await call("merchant", "merchant", "auxiliary", [
        "mode",
        { kind: "save", outcome: "failure" },
      ]);
      await mobileButton(page, "新增服务项目").click();
      await page
        .locator(".service-page > .message.error:visible")
        .filter({ hasText: "保存失败" })
        .waitFor();
      const failedServices = await call("merchant", "merchant", "query", [
        "services",
        {},
      ]);
      assert.equal(failedServices.length, countBefore);
      assert.equal(
        failedServices.filter((r) => r["服务名称"] === name).length,
        0,
      );
      assert.equal(await pictures.locator(".file-name").count(), 2);
      assert.equal(
        await mobileField("服务简介")
          .locator("input,textarea")
          .first()
          .inputValue(),
        "真实上传及保存失败后仍保留的输入",
      );
      assert.deepEqual(
        (await call("merchant", "merchant", "draft", [key], true)).data[
          "介绍图片"
        ],
        before.data["介绍图片"],
      );
      const saveFailure = await shot("mobile-save-failure-retains");
      await call("merchant", "merchant", "auxiliary", [
        "mode",
        { kind: "save", outcome: "normal" },
      ]);
      await mobileButton(page, "新增服务项目").click();
      let saved;
      for (let i = 0; i < 25; i++) {
        saved = (
          await call("merchant", "merchant", "query", ["services", {}])
        ).filter((r) => r["服务名称"] === name);
        if (saved.length) break;
        await page.waitForTimeout(200);
      }
      assert.equal(saved.length, 1);
      assert.equal(saved[0]["介绍图片"].length, 2);
      assert.equal(saved[0]["服务主图"].length, 1);
      await page.waitForURL((u) => !u.hash.includes("/pages/service/action"));
      await page.locator(".service-page").waitFor();
      await page.waitForTimeout(200);
      await page.reload();
      assert.equal(
        (await call("merchant", "merchant", "query", ["services", {}])).filter(
          (r) => r["服务名称"] === name,
        ).length,
        1,
      );
      return {
        serviceId: saved[0]._id,
        existingMainImageRetained: true,
        successfulPictureRetainedAcrossUploadFailure: true,
        retryPictureCount: 2,
        textRetainedAcrossBothFailures: true,
        noRecordOnFailedSave: true,
        oneRecordAfterRecovery: true,
        screenshots: [
          uploadFailure,
          saveFailure,
          await shot("mobile-failures-recovered"),
        ],
      };
    },
  );
  if (!process.argv.includes("--skip-reentry"))
    await step(
      "aftersale-repeat-and-stale-entry-return-original",
      ["AC02-027", "AC02-045"],
      async () => {
        await call("web", "property-admin", "auxiliary", [
          "scenario",
          { name: "S02-AFTERSALE" },
        ]);
        const original = (
          await call("resident", "resident-a", "query", ["orders", {}])
        ).find((o) => o.currentAftersale);
        assert.ok(original);
        const saleId = original.currentAftersale._id;
        const key = "service:resident:" + original._id + ":aftersale.apply";
        const draft = {
          data: { 申请原因: "未提交草稿应保留，不覆盖原诉求" },
          operationId: run + "-retained-draft",
        };
        await call("resident", "resident-a", "draft", [key, draft], true);
        await page.setViewportSize({ width: 390, height: 844 });
        const entry =
          base +
          "/resident/?session=" +
          session +
          "#/pages/service/action?table=orders&id=" +
          encodeURIComponent(original._id) +
          "&action=aftersale.apply";
        await page.goto(entry);
        await page.waitForURL(
          (u) =>
            u.hash.includes("/pages/service/after-sale") &&
            decodeURIComponent(u.hash).includes(saleId),
        );
        await page.locator(".service-page").waitFor();
        assert.deepEqual(
          await call("resident", "resident-a", "draft", [key], true),
          draft,
        );
        const firstShot = await shot("aftersale-existing-entry-original");
        const firstSales = (
          await call("resident", "resident-a", "query", ["aftersales", {}])
        ).filter((r) => r._order === original._id);
        assert.equal(firstSales.length, 1);
        await call("resident", "resident-a", "auxiliary", [
          "scenario",
          { name: "S02-IN-SERVICE" },
        ]);
        const active = (
          await call("resident", "resident-a", "query", ["orders", {}])
        ).find((o) => o["履约状态"] === "服务中");
        assert.ok(active);
        await page.goto(
          base +
            "/resident/?session=" +
            session +
            "#/pages/service/action?table=orders&id=" +
            encodeURIComponent(active._id) +
            "&action=aftersale.apply",
        );
        await page.locator(".form-card").waitFor();
        const cause = page
          .locator('[data-field-name="申请原因"]:visible')
          .locator("input,textarea")
          .first();
        await cause.fill("当前页未提交诉求保留");
        const amount = page
          .locator('[data-field-name="申请退款金额"]:visible')
          .locator("input")
          .first();
        await amount.fill("10.00");
        const concurrent = await call("resident", "resident-a", "command", [
          "aftersale.apply",
          {
            id: active._id,
            revision: active._rev,
            operationId: run + "-other-tab-apply",
            data: {
              申请类型: "申请退款",
              申请原因: "另一已提交申请的原始诉求",
              申请退款金额: "10.00",
              期望解决方式: "协商解决",
            },
          },
        ]);
        await page
          .locator(
            ".bottom-actions uni-button:visible,.bottom-actions button:visible",
          )
          .filter({ hasText: /^\s*申请售后\s*$/ })
          .last()
          .click();
        await page.waitForURL(
          (u) =>
            u.hash.includes("/pages/service/after-sale") &&
            decodeURIComponent(u.hash).includes(concurrent.id),
        );
        const cases = (
          await call("resident", "resident-a", "query", ["aftersales", {}])
        ).filter((r) => r._order === active._id);
        assert.equal(cases.length, 1);
        assert.equal(cases[0]["申请原因"], "另一已提交申请的原始诉求");
        const retained = await call(
          "resident",
          "resident-a",
          "draft",
          ["service:resident:" + active._id + ":aftersale.apply"],
          true,
        );
        assert.equal(retained.data["申请原因"], "当前页未提交诉求保留");
        return {
          originalSaleId: saleId,
          concurrentSaleId: concurrent.id,
          ongoingCount: cases.length,
          draftRetained: true,
          originalRequestPreserved: true,
          screenshots: [
            firstShot,
            await shot("aftersale-stale-submit-original"),
          ],
        };
      },
    );
  await step(
    "public-review-displays-only-public-fields-and-withdraws-image",
    ["AC02-036", "AC02-042", "AC02-043"],
    async () => {
      await call("web", "property-admin", "auxiliary", [
        "scenario",
        { name: "S02-FUNDS-REFUND" },
      ]);
      const order = (
        await call("resident", "resident-a", "query", ["orders", {}])
      )[0];
      const image = await upload("resident", "resident-a", "公开评价图片.png");
      const created = await call("resident", "resident-a", "command", [
        "evaluation.save",
        {
          id: order._id,
          revision: order._rev,
          operationId: run + "-public-evaluation",
          data: {
            总体评分: 4,
            评价内容: "公开评价内容：已核对服务",
            评价图片: [image.id],
          },
        },
      ]);
      await call("resident", "resident-b", "options", []);
      await page.setViewportSize({ width: 414, height: 896 });
      await page.goto(
        base +
          "/resident/?session=" +
          session +
          "#/pages/service/detail?id=" +
          order._service,
      );
      await page.getByText("居民评价", { exact: true }).click();
      await page.locator('[data-field="31-E.09"]:visible').waitFor();
      const card = page.locator(".public-review").first();
      assert.ok((await card.innerText()).includes("公开评价内容：已核对服务"));
      assert.equal((await card.innerText()).includes(order._id), false);
      assert.equal(
        (await card.innerText()).includes(order["联系人电话"]),
        false,
      );
      const readable = await call("resident", "resident-b", "attachment", [
        { table: "services", id: order._service, attachmentId: image.id },
      ]);
      assert.ok(readable);
      const screenshot = await shot("public-review-privacy");
      const current = await call("web", "property-admin", "record", [
        "evaluations",
        created.id,
      ]);
      await call("web", "property-admin", "command", [
        "evaluation.status",
        {
          id: current._id,
          revision: current._rev,
          operationId: run + "-moderate-public-review",
          data: { 状态: "受限", 评价限制原因: "涉及其他人员隐私" },
        },
      ]);
      await page.reload();
      await page.getByText("居民评价", { exact: true }).click();
      await page.getByText("暂无公开评价", { exact: true }).waitFor();
      let denied = false;
      try {
        await call("resident", "resident-b", "attachment", [
          { table: "services", id: order._service, attachmentId: image.id },
        ]);
      } catch {
        denied = true;
      }
      assert.equal(denied, true);
      return {
        evaluation: created.id,
        publicNameMasked: true,
        noOrderOrContact: true,
        imageWithdrawalDenied: true,
        screenshot,
      };
    },
  );
  await step(
    "refund-recovery-rechecks-current-budget-in-shared-store",
    ["AC02-028", "AC02-039"],
    async () => {
      await call("web", "property-admin", "auxiliary", [
        "scenario",
        { name: "S02-BASE" },
      ]);
      const cmd = async (app, account, name, table, id, data = {}) => {
        const row = id ? await call(app, account, "record", [table, id]) : null;
        return call(app, account, "command", [
          name,
          {
            id,
            revision: row?._rev,
            operationId: run + "-budget-" + name + "-" + Date.now(),
            data,
          },
        ]);
      };
      let o = (
        await cmd("resident", "resident-a", "order.create", "orders", null, {
          选定服务项目: "SV-HOME",
          选定服务规格: "SPEC-HOME",
          选定履约方式: "上门",
          联系人姓名: "回归居民",
          联系人电话: "13800005555",
          期望时间选择: "时间可协商",
          服务约定确认: true,
          上门服务地址: {
            省份: "江苏省",
            城市: "南京市",
            区县: "示例区",
            所属社区: "C-A",
            所属小区: "E-A",
            详细地址: "青禾花园101",
          },
        })
      ).record;
      o = (await cmd("resident", "resident-a", "order.pay", "orders", o._id))
        .record;
      await call("web", "property-admin", "auxiliary", [
        "mode",
        { kind: "refund", outcome: "failure" },
      ]);
      o = (
        await cmd("resident", "resident-a", "order.cancel", "orders", o._id, {
          申请原因: "首次取消",
        })
      ).record;
      const old = (
        await call("web", "property-admin", "query", ["funds", {}])
      ).find((f) => f._order === o._id && f["资金类型"] === "退款");
      assert.equal(old["资金状态"], "失败");
      await call("web", "property-admin", "auxiliary", [
        "mode",
        { kind: "refund", outcome: "normal" },
      ]);
      const sale = (
        await cmd(
          "resident",
          "resident-a",
          "aftersale.apply",
          "orders",
          o._id,
          {
            申请类型: "申请退款",
            申请原因: "核实未到账退款",
            申请退款金额: "99",
          },
        )
      ).record;
      await cmd(
        "merchant",
        "merchant",
        "aftersale.plan",
        "aftersales",
        sale._id,
        {
          方案处理类型: "全额退款",
          方案说明: "核对剩余额度后退还",
          业务结案方式: "未服务取消",
        },
      );
      for (const action of ["fund.retry", "fund.query"]) {
        let denied = false;
        try {
          await cmd("web", "property-admin", action, "funds", old._id);
        } catch (e) {
          assert.match(e.message, /额度|核查/);
          denied = true;
        }
        assert.equal(denied, true);
      }
      const funds = (
        await call("web", "property-admin", "query", ["funds", {}])
      ).filter((f) => f._order === o._id);
      assert.equal(
        funds
          .filter((f) => f["资金类型"] === "退款" && f["资金状态"] === "成功")
          .reduce((n, f) => n + Number(f["资金金额"]), 0),
        99,
      );
      assert.equal(
        (await call("web", "property-admin", "record", ["funds", old._id]))[
          "资金状态"
        ],
        "失败",
      );
      return {
        order: o._id,
        failedRequest: old._id,
        successfulRefund: "99.00",
        noExcessRecovery: true,
      };
    },
  );
  await step(
    "service-security-work-preserves-other-domain-facts",
    ["AC02-047", "AC02-052"],
    async () => {
      const legacyAfter = hash(await legacyFingerprint());
      assert.equal(legacyAfter, legacyBefore);
      return {
        legacyBefore,
        legacyAfter,
        scope:
          "Persisted Stage00 houses/relations/applications/files and non-Stage02 attachments plus Stage01 domain unchanged",
      };
    },
  );
} finally {
  const report = {
    run,
    session,
    base,
    executedAt: new Date().toISOString(),
    skipped: process.argv.includes("--skip-reentry")
      ? [
          {
            id: "aftersale-repeat-and-stale-entry-return-original",
            reason: "Explicit exploration run before AC027 UI rebuild",
          },
        ]
      : [],
    results,
    artifactHashesBefore,
    artifactHashesAfter: artifactHashes(),
    errors,
    blockedRequests,
    scope:
      "Actual H5 adapters and actual Web personnel review controls. Fixture preparation uses authorized Service commands; no direct final-state writes; this is prototype authorization evidence, not production auth acceptance.",
  };
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  fs.mkdirSync(
    path.join(root, "docs/stages/stage-02/evidence", evidenceSubdir),
    {
      recursive: true,
    },
  );
  fs.writeFileSync(
    path.join(
      root,
      "docs/stages/stage-02/evidence",
      evidenceSubdir,
      "security-browser.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  await context.close();
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
