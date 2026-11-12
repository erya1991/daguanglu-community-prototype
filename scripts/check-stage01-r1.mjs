import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fields } from "../prototype-shared/stage01/fields.js";
import { verifyCurrentStage00Documents } from "./lib/stage00-documents.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  out = path.join(root, "docs/stages/stage-01/evidence/acceptance-r1");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
function check(name, fn) {
  try {
    checks.push({ name, status: "PASS", detail: fn() });
    console.log("PASS " + name);
  } catch (e) {
    checks.push({ name, status: "FAIL", error: e.message });
    console.log("FAIL " + name + ": " + e.message);
  }
}
check("开始基线与其他阶段保护", () => {
  const baseline = JSON.parse(
    read(".runtime/stage01/acceptance-r1/baseline.json")
  );
  assert.equal(
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    baseline.head
  );
  const allowed =
    /^(AGENTS\.md|README\.md|prototype-shared\/(stage01\/|types\.d\.ts)|web\/manager\/src\/(App\.vue|main\.js|components\/stage01\/|views\/stage01\/BillImport\.vue|styles\/stage01\.scss)|miniapp\/packages\/stage01\/|tests\/stage01.*\.mjs|scripts\/(browser-stage01-r1\.mjs|check-stage01-r1\.mjs|check-stage00\.mjs|lib\/stage00-documents\.mjs)|docs\/stages\/stage-01\/)/;
  const changes = [],
    protectedFiles = [];
  for (const [p, hash] of Object.entries(baseline.hashes)) {
    const actual = sha(fs.readFileSync(path.join(root, p)));
    if (actual !== hash) {
      assert(allowed.test(p), "Unexpected changed path " + p);
      changes.push(p);
    } else protectedFiles.push(p);
  }
  assert.equal(
    execFileSync("git", ["diff", "--cached", "--name-only"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    ""
  );
  return {
    head: baseline.head,
    changedWithinAuthorizedScope: changes,
    unchangedFiles: protectedFiles.length,
    stage00DocumentsUnchanged: protectedFiles.filter((p) =>
      /^docs\/stages\/stage-00\//.test(p)
    ).length,
  };
});
check("Stage00当前文档、字段和历史证据回归", () =>
  verifyCurrentStage00Documents(root, { historicalSourceProtection: false })
);
check("Stage01字段311项、原294编号保留、中文字段名及六列定义", () => {
  assert.equal(fields.length, 311);
  assert.equal(new Set(fields.map((f) => f.id)).size, 311);
  const old = execFileSync(
    "git",
    ["show", "HEAD:prototype-shared/stage01/fields.js"],
    { cwd: root, encoding: "utf8" }
  );
  const oldIds = [...old.matchAll(/id: "([A-Z]{2}\d{2})"/g)].map((m) => m[1]);
  assert.equal(oldIds.length, 294);
  assert(oldIds.every((id) => fields.some((f) => f.id === id)));
  const doc = read("docs/stages/stage-01/REQUIREMENTS.md");
  let active = false,
    count = 0,
    groups = 0;
  for (const line of doc.split(/\r?\n/)) {
    if (line.startsWith("| 字段名称 |")) {
      active = true;
      groups++;
    } else if (active && line.startsWith("| ") && !line.startsWith("| ---")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      assert.equal(cells.length, 6);
      assert(!/^[A-Z]{2}\d/.test(cells[0]));
      assert(cells.every(Boolean));
      count++;
    } else if (!line.startsWith("|")) active = false;
  }
  assert.equal(count, 311);
  assert.equal(groups, 26);
  return {
    definitions: fields.length,
    originalIds: oldIds.length,
    documentRows: count,
    groups,
  };
});
check("72条工程验收编号与原人工反馈记录保留", () => {
  const old = execFileSync(
    "git",
    ["show", "HEAD:docs/stages/stage-01/ACCEPTANCE.md"],
    { cwd: root, encoding: "utf8" }
  );
  const ids = (t) => [...new Set(t.match(/AC-[ABCFU]\d{2}/g))].sort();
  assert.equal(ids(old).length, 72);
  assert.deepEqual(ids(read("docs/stages/stage-01/ACCEPTANCE.md")), ids(old));
  const source = JSON.parse(
    read("docs/stages/stage-01/evidence/acceptance-r1/source-feedback.json")
  );
  assert.equal(source.length - 1, 95);
  return {
    engineeringAcceptance: 72,
    originalOwnerRows: 95,
    ownerRetest: "NOT_RUN",
  };
});
check("原生三端产物独立与组件引用完整", () => {
  const walk = (d) =>
    fs
      .readdirSync(d, { withFileTypes: true })
      .flatMap((f) =>
        f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]
      );
  let total = 0;
  for (const app of ["resident", "merchant", "staff"]) {
    const dir = path.join(
      root,
      `miniapp/apps/${app}-miniapp/dist/build/mp-weixin`
    );
    assert(fs.existsSync(path.join(dir, "app.json")));
    assert(!fs.existsSync(path.join(dir, "_core/storage-h5.js")));
    for (const file of walk(dir).filter((f) => f.endsWith(".json"))) {
      const j = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const v of Object.values(j.usingComponents || {})) {
        const target = v.startsWith("/")
          ? path.join(dir, v.slice(1))
          : path.resolve(path.dirname(file), v);
        assert(target.startsWith(dir + path.sep));
        for (const suffix of [".js", ".json", ".wxml"])
          assert(fs.existsSync(target + suffix), target + suffix);
        total++;
      }
    }
  }
  return { apps: 3, componentReferences: total, nativeRuntime: "NOT_RUN" };
});
fs.writeFileSync(
  path.join(out, "static-results.json"),
  JSON.stringify({ date: new Date().toISOString(), checks }, null, 2) + "\n"
);
process.exitCode = checks.some((c) => c.status === "FAIL") ? 1 : 0;
