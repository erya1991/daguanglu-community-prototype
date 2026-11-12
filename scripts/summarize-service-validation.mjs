import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, ".."),
  evidence = path.join(root, "docs/stages/stage-02/evidence");
const read = (f) => {
  const p = path.join(evidence, f);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
};
const acceptance = fs.readFileSync(
  path.join(root, "docs/stages/stage-02/ACCEPTANCE.md"),
  "utf8",
);
const ids = (text) => [
  ...new Set(
    [...String(text).matchAll(/AC02-(\d{3}(?:\/\d{3})*)/g)].flatMap((m) =>
      m[1].split("/").map((n) => "AC02-" + n),
    ),
  ),
];
const cases = Array.from({ length: 52 }, (_, i) => {
  const id = "AC02-" + String(i + 1).padStart(3, "0"),
    title =
      acceptance
        .match(new RegExp("^\\| " + id + " \\| ([^|]+)", "m"))?.[1]
        .trim() || id;
  return {
    id,
    title,
    variants: [],
    status: "NOT_RUN",
    ownerAcceptance: "NOT_RUN",
    remaining: [],
  };
});
function add(ac, variant) {
  for (const id of ac) {
    const row = cases.find((c) => c.id === id);
    if (row) row.variants.push(variant);
  }
}
const tapPath = path.join(root, ".runtime/stage02/resume-20261107/tests-final.tap");
if (fs.existsSync(tapPath)) {
  const tap = fs.readFileSync(tapPath, "utf8");
  for (const m of tap.matchAll(/^(not ok|ok) \d+ - (.*)$/gm)) {
    add(ids(m[2]), {
      kind: "SERVICE_OR_ADAPTER_ASSERTION",
      name: m[2],
      status: m[1] === "ok" ? "PASS" : "FAIL",
      evidence: ".runtime/stage02/resume-20261107/tests-final.tap",
      boundary:
        "Real assertions in an isolated local state; not DOM, native-device, real-money or owner acceptance.",
    });
  }
}
for (const name of [
  "browser-web.json",
  "browser-flows.json",
  "security-browser.json",
  "browser-regression.json",
]) {
  const report = read(name);
  if (!report) continue;
  for (const r of report.results || []) {
    let ac = [
      ...new Set([
        ...(r.acs || r.acceptance || ids(r.id || r.name || "")),
        ...(r.additional || []),
      ]),
    ];
    if (!ac.length && name === "browser-flows.json")
      ac = [
        /point|到点/i.test(r.id || r.mode || r.name || "")
          ? "AC02-002"
          : "AC02-001",
        "AC02-037",
        "AC02-046",
      ];
    if(name === "browser-flows.json") ac=[...new Set([...ac,"AC02-046"])];
    add(ac, {
      kind: "H5_UI",
      name: r.id || r.name || r.mode || name,
      status: r.status,
      evidence: "docs/stages/stage-02/evidence/" + name,
      run: report.run,
      detail: r.detail || r.observed || null,
    });
  }
  if(report.errors?.length) {
    const affected=[...new Set((report.results||[]).flatMap(r=>r.acs||ids(r.id||r.name||'')))];
    add(affected,{kind:'H5_PAGE_ERRORS',name:'Uncaught browser errors',status:'FAIL',evidence:'docs/stages/stage-02/evidence/'+name,detail:report.errors});
  }
}
const fields = read("field-runtime-results.json");
if (fields)
  add(["AC02-043"], {
    kind: "FIELD_RUNTIME_OBSERVATIONS",
    name: "42表621字段实际前台访问",
    status:
      fields.summary?.missingFields ||
      fields.summary?.visibleWithoutVerifiedValue ||
      fields.summary?.failures ||
      fields.summary?.pageErrors
        ? "PARTIAL"
        : "OBSERVED",
    detail: fields.summary,
    evidence: "docs/stages/stage-02/evidence/field-runtime-results.json",
    boundary:
      "Reachability, observed values and controls; no automatic inference of all permission/condition/required combinations.",
  });
const builds = read("build-results.json");
if (builds)
  for (const r of builds.results || [])
    add(["AC02-048"], {
      kind: "BUILD_OR_TYPECHECK",
      name: r.id,
      status: r.status,
      evidence: r.log,
      run: builds.run,
    });
const native = read("wechat-results.json");
if (native) {
  add(["AC02-049"], {
    kind: "WECHAT_TOOL",
    name: "resident",
    ...native.resident,
    evidence: "docs/stages/stage-02/evidence/wechat-results.json",
  });
  add(["AC02-050"], {
    kind: "WECHAT_TOOL",
    name: "merchant",
    ...native.merchant,
    evidence: "docs/stages/stage-02/evidence/wechat-results.json",
  });
  add(["AC02-050"], {
    kind: "WECHAT_TOOL",
    name: "staff",
    ...native.staff,
    evidence: "docs/stages/stage-02/evidence/wechat-results.json",
  });
  add(["AC02-051"], {
    kind: "REAL_DEVICE",
    name: "conditional real-device check",
    ...native.realDevice,
    evidence: "docs/stages/stage-02/evidence/wechat-results.json",
  });
}
const source = read("source-protection-final.json");
if (source)
  add(["AC02-052"], {
    kind: "SOURCE_PROTECTION",
    name: "原Stage01目录、索引和文件指纹核对",
    status: source.status || "OBSERVED",
    evidence: "docs/stages/stage-02/evidence/source-protection-final.json",
    detail: source,
  });
for (const row of cases) {
  const n = Number(row.id.slice(-3));
  if (row.variants.some((v) => v.status === "FAIL")) row.status = "FAIL";
  else if (
    n === 48 &&
    row.variants.length === 10 &&
    row.variants.every((v) => v.status === "PASS")
  )
    row.status = "PASS";
  else if (n === 51) row.status = "NOT_RUN";
  else if (n === 50) row.status = "BLOCKED";
  else if (row.variants.length) row.status = "PARTIAL";
  if (n <= 42)
    row.remaining.push(
      "已执行的规则或H5变体见逐条证据；未将一个变体通过推定为正文全部状态、角色及异常组合通过。",
    );
  if (n === 43)
    row.remaining.push(
      "逐字段可见性、值与控件观察不等于所有必填、字典、条件切换及编辑权限组合验收，未覆盖组合仍待专项及lee验收。",
    );
  if (n === 44 || n === 45)
    row.remaining.push(
      "H5实际视口和交互以逐项证据为限；微信、软键盘和实际设备体验不由浏览器结果推定。",
    );
  if (n === 46)
    row.remaining.push(
      "H5同源同会话验证；微信各App为独立本端样例，不宣称跨App同步。",
    );
  if (n === 47)
    row.remaining.push(
      "本次复位/附件/历史断言和实际场景重放已执行；生产恢复与长期存储未验证。",
    );
  if (n === 49)
    row.remaining.push(
      "住户工具仅前轮基础观察；此前桌面控制由用户Esc终止。恢复轮CLI仍报告服务端口关闭，最终修复版工具全链未执行。",
    );
  if (n === 50)
    row.remaining.push(
      "恢复轮官方CLI仍报告服务端口关闭，未改安全设置；商户工具完整链受阻，管理端工具交互未执行。",
    );
  if (n === 51) row.remaining.push("没有实际可验设备/体验环境证据。");
  if (n === 52)
    row.remaining.push(
      "Stage01未提交公共更新未复制；本轮仅交付公共增量和语义合并清单，后续整合由lee安排。",
    );
}
const output = {
  generatedAt: new Date().toISOString(),
  scope:
    "52 scenario execution index with each actually executed variant. PASS only closes explicitly evidenced scope; PARTIAL is intentional where the complete acceptance row is not demonstrated. No Stage PASS, owner acceptance, production or real-money claim.",
  cases,
  summary: {
    cases: 52,
    variants: cases.reduce((a, c) => a + c.variants.length, 0),
    statuses: cases.reduce(
      (a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a),
      {},
    ),
    ownerAcceptance: "NOT_RUN",
  },
};
fs.mkdirSync(evidence, { recursive: true });
fs.writeFileSync(
  path.join(evidence, "acceptance-execution.json"),
  JSON.stringify(output, null, 2) + "\n",
);
console.log(JSON.stringify(output.summary));
