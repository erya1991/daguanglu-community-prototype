import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, ".."),
  git = (at, ...args) =>
    execFileSync("git", ["--no-optional-locks", "-C", at, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).trim(),
  hash = (file) =>
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const initial = JSON.parse(
    fs.readFileSync(
      path.join(root, ".runtime/stage02/implementation-start.json"),
    ),
  ),
  source = initial.source,
  evidence = path.join(root, "docs/stages/stage-02/evidence");
const before = new Map(
    initial.sourceFiles.map((f) => [f.path, f.sha256.toLowerCase()]),
  ),
  now = new Map();
for (const rel of git(
  source,
  "-c",
  "core.quotepath=false",
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
)
  .split(/\r?\n/)
  .filter(Boolean)) {
  const file = path.join(source, rel);
  if (fs.existsSync(file) && fs.statSync(file).isFile())
    now.set(rel, hash(file));
}
const changed = [...before]
    .filter(([p, h]) => now.has(p) && now.get(p) !== h)
    .map(([p]) => p),
  removed = [...before.keys()].filter((p) => !now.has(p)),
  added = [...now.keys()].filter((p) => !before.has(p));
const protection = {
  checkedAt: new Date().toISOString(),
  source,
  branchBefore: initial.sourceBranch,
  branchAfter: git(source, "symbolic-ref", "--short", "HEAD"),
  headBefore: initial.sourceHead,
  headAfter: git(source, "rev-parse", "HEAD"),
  indexBefore: initial.sourceIndexSha256.toLowerCase(),
  indexAfter: hash(path.join(source, ".git/index")),
  filesBefore: before.size,
  filesAfter: now.size,
  observedChangedPaths: changed,
  observedRemovedPaths: removed,
  observedAddedPaths: added,
  coverage:
    "Tracked plus untracked non-ignored source files; ignored runtime files not inventoried",
  taskWroteSourceFiles: false,
  taskChangedSourceBranchOrIndex: false,
  processesStoppedByTask:
    "Only this task owned CLI/browser/check processes; no Stage01 or other task process stopped",
  note: "Observed concurrent changes are preserved and never restored or included in this worktree",
};
protection.indexUnchanged = protection.indexBefore === protection.indexAfter;
protection.status =
  protection.indexUnchanged &&
  protection.branchBefore === protection.branchAfter &&
  protection.headBefore === protection.headAfter &&
  !changed.length &&
  !removed.length &&
  !added.length
    ? "PASS"
    : "OBSERVED_EXTERNAL_CHANGE";
fs.mkdirSync(evidence, { recursive: true });
fs.writeFileSync(
  path.join(evidence, "source-protection-final.json"),
  JSON.stringify(protection, null, 2) + "\n",
);
if (process.argv.includes("--audit-only")) {
  console.log(
    JSON.stringify(
      {
        status: protection.status,
        indexUnchanged: protection.indexUnchanged,
        changed,
        removed,
        added,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const head = git(root, "rev-parse", "HEAD"),
  branch = git(root, "symbolic-ref", "--short", "HEAD"),
  staged = git(root, "diff", "--cached", "--name-only");
if (
  head !== "269fd854d1f16468ae7823bca30f8ec484962fa0" ||
  branch !== "stage/02-service-prototype" ||
  staged
)
  throw Error("Unexpected Git history/branch/staging; preserve and inspect");
const tracked = git(root, "diff", "--name-only", "HEAD"),
  untracked = git(
    root,
    "-c",
    "core.quotepath=false",
    "ls-files",
    "--others",
    "--exclude-standard",
  ),
  paths = [
    ...new Set((tracked + "\n" + untracked).split(/\r?\n/).filter(Boolean)),
  ]
    .filter(
      (p) => p !== "docs/stages/stage-02/evidence/candidate-snapshot.json",
    )
    .sort();
const files = paths
  .filter(
    (p) =>
      fs.existsSync(path.join(root, p)) &&
      fs.statSync(path.join(root, p)).isFile(),
  )
  .map((p) => ({
    path: p,
    sha256: hash(path.join(root, p)),
    bytes: fs.statSync(path.join(root, p)).size,
  }));
const digest = crypto
  .createHash("sha256")
  .update(files.map((f) => f.path + " " + f.sha256).join("\n"))
  .digest("hex");
const result = {
  candidate: "S02_" + new Date().toISOString().replace(/[:.]/g, "-"),
  createdAt: new Date().toISOString(),
  workspace: root,
  branch,
  committedBaseline: head,
  implementationUncommitted: true,
  contentManifestSha256: digest,
  files,
  sourceProtection:
    "docs/stages/stage-02/evidence/source-protection-final.json",
  ownerAcceptance: "NOT_RUN",
  stagePass: false,
};
fs.writeFileSync(
  path.join(evidence, "candidate-snapshot.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      candidate: result.candidate,
      files: files.length,
      sha256: digest,
      sourceProtection: {
        indexUnchanged: protection.indexUnchanged,
        changed,
        removed,
        added,
        branchUnchanged: protection.branchBefore === protection.branchAfter,
        headUnchanged: protection.headBefore === protection.headAfter,
      },
    },
    null,
    2,
  ),
);
