import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { fields } from "../prototype-shared/stage01/fields.js";
const root = path.resolve(import.meta.dirname, ".."),
  evidence = path.join(root, "docs/stages/stage-01/evidence"),
  results = [];
const read = (p) => fs.readFileSync(path.join(root, p), "utf8"),
  hash = (p) =>
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, p)))
      .digest("hex");
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, status: "PASS", detail });
    console.log("PASS " + name);
  } catch (e) {
    results.push({ name, status: "FAIL", error: e.message });
    console.log("FAIL " + name + " " + e.message);
  }
}
const req = read("docs/stages/stage-01/REQUIREMENTS.md"),
  start = JSON.parse(
    read("docs/stages/stage-01/evidence/implementation-start.json")
  );
check("294项六列字段及26组与V0.3原文一致", () => {
  const rows = req
    .split(/\r?\n/)
    .filter((l) => /^\| `[A-Z]{2}\d\d`/.test(l))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((v) => v.trim())
    );
  assert.equal(rows.length, 294);
  assert.equal(new Set(fields.map((f) => f.id)).size, 294);
  for (const [i, r] of rows.entries()) {
    assert.equal(r.length, 6);
    const f = fields[i];
    assert.deepEqual(
      [f.id, f.name, f.type, f.meaning, f.source, f.rule, f.condition],
      [...r[0].match(/^`(\w+)`\s*(.*)/).slice(1), ...r.slice(1)]
    );
  }
  assert.equal(new Set(fields.map((f) => f.id.slice(0, 2))).size, 26);
  return { definitions: 294, groups: 26 };
});
check("23视图和72验收编号稳定", () => {
  const ids = [...req.matchAll(/^### (P-[ABC]\d\d)｜/gm)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 23);
  const ac = read("docs/stages/stage-01/ACCEPTANCE.md"),
    cases = [...ac.matchAll(/^### (AC-[ABCFU]\d\d)｜/gm)].map((m) => m[1]);
  assert.equal(new Set(cases).size, 72);
  return { views: ids, cases: cases.length };
});
check("Stage00目录、原始锁文件及R1未触碰文件保护", () => {
  const protectedFiles = Object.keys(start.files).filter(
    (p) =>
      p.startsWith("docs/stages/stage-00/") ||
      /^(prototype-shared\/(core|catalog|r1-migration|spaces|import-houses|field-help)\.js|web\/manager\/src\/(views\/(SpaceArchive|Workspace)\.vue|components\/(BindingDetail|FieldEditor|HistoryPanel|ImportPanel)\.vue|styles\/stage00.scss)|miniapp\/packages\/foundation\/MobileFields.vue|tests\/(business|r1)\.test.mjs|web\/manager\/yarn.lock|miniapp\/package-lock.json)$/.test(
        p
      )
  );
  for (const p of protectedFiles)
    assert.equal(hash(p), start.files[p], p + " changed");
  return { files: protectedFiles.length };
});
check("现有与新增规则测试的实际退出码", () => {
  const files = fs
    .readdirSync(path.join(root, "tests"))
    .filter((f) => f.endsWith(".test.mjs"))
    .map((f) => "tests/" + f);
  const r = spawnSync(process.execPath, ["--test", ...files], {
      cwd: root,
      encoding: "utf8",
    }),
    log = (r.stdout || "") + "\n" + (r.stderr || "");
  fs.mkdirSync(path.join(root, ".runtime/stage01"), { recursive: true });
  fs.writeFileSync(path.join(root, ".runtime/stage01/tests-final.log"), log);
  assert.equal(r.status, 0, log.slice(-3000));
  const total = Number(log.match(/(?:ℹ|#) tests (\d+)/)?.[1]),
    pass = Number(log.match(/(?:ℹ|#) pass (\d+)/)?.[1]);
  assert.ok(total >= 63 && pass === total);
  return {
    command: "node --test " + files.join(" "),
    exit: r.status,
    total,
    pass,
    log: ".runtime/stage01/tests-final.log",
  };
});
check("七构建与三类型检查分项记录", () => {
  const b = JSON.parse(
    read("docs/stages/stage-01/evidence/build-results.json")
  );
  assert.equal(b.results.length, 10);
  for (const r of b.results) assert.equal(r.exit, 0, r.id);
  return {
    run: b.run,
    results: b.results.map((r) => ({ id: r.id, exit: r.exit })),
  };
});
check("分支、HEAD及暂存边界", () => {
  const git = (...args) =>
    execFileSync("git", ["--no-optional-locks", ...args], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  assert.equal(
    git("branch", "--show-current"),
    "stage/01-property-parking-workorder"
  );
  assert.equal(git("rev-parse", "HEAD"), start.head);
  assert.equal(git("diff", "--cached", "--name-only"), "");
  return {
    branch: git("branch", "--show-current"),
    head: start.head,
    index: "EMPTY",
  };
});
fs.writeFileSync(
  path.join(evidence, "static-results.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      node: process.version,
      results,
      boundary:
        "Static and rule checks only; UI/tool/owner evidence is separate.",
    },
    null,
    2
  ) + "\n"
);
process.exitCode = results.some((r) => r.status !== "PASS") ? 1 : 0;
