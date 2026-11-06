import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fields } from "../prototype-shared/stage01/fields.js";
const root = path.resolve(import.meta.dirname, ".."),
  evidence = path.join(root, "docs/stages/stage-01/evidence");
const views = JSON.parse(
    fs.readFileSync(path.join(evidence, "view-results.json"))
  ),
  exceptions = JSON.parse(
    fs.readFileSync(path.join(evidence, "browser-exceptions.json"))
  );
const paths = {
  QF: "各授权列表筛选、分页／空态；停车车辆车场、工单处理轮次",
  BL: "P-A01查看办理→事项信息；P-A02逐行核验；R账单详情与付款时业务快照",
  IM: "P-A02选择文件→校验核对→导入结果（批次）",
  IR: "P-A02逐行校验表→查看原值并匹配；P-A01独立发布确认",
  PY: "P-A03缴费记录→事项信息／操作记录；P-A06本人普通凭证；P-A05原支付结果",
  EX: "P-A03异常核查或P-A08停车核查→事项信息／登记核查意见／操作记录",
  PK: "P-A07停车关系→详情或维护；P-A09本人车辆车场→关系分组",
  MP: "P-A07月租产品→详情或维护；P-A10办理产品与价格快照",
  MO: "P-A07月租订单→事项信息／操作记录；P-A10新办或续费→办理与期间／平台登记",
  TB: "P-A07临停账单→登记或事项信息；P-A11单账单→费用依据／缴费结果",
  XI: "P-A07／A08或移动停车详情底部接入状态",
  AU: "P-A12无感支付→暂未开放说明",
  PT: "积分未启用，保留Stage03条件契约，当前不渲染",
  RP: "P-B01原始上报；P-B04报修；R报修／隐患详情；staff现场上报",
  SP: "P-B02处理与复核→追加补充；R本人补充；staff现场补证",
  EV: "P-B01核实→事项信息／核实动作；P-B02嵌入核实记录；R仅公开EV12／EV13",
  WO: "P-B02工单→事项信息／按状态办理；P-B09管理端工单详情／动作页",
  OP: "P-B02处理与复核→退单与内部转派；P-B09详情展开操作记录",
  PR: "P-B02处理与复核→第N轮处理；P-B09处理动作／展开轮次",
  RV: "P-B02处理与复核→复核记录；P-B09独立复核动作／展开轮次",
  UC: "P-B06本人结果确认及历次确认；P-B02／B04居民反馈只读",
  VA: "P-B06本人确认后服务评价；P-B02／B04居民反馈只读",
  HZ: "P-B05隐患台账→事项信息（隐患整改）；P-B09核实／复核／销号",
  ST: "P-B03状态数量与统计时点；P-B02工单详情→时间事实",
  AT: "已授权照片→附件信息／预览；P-A02导入源文件元数据；失败重试状态",
  HI: "详情→操作记录；移动办理轨迹→展开及查看变更",
};
const mapping = fields.map((f) => {
  const group = f.id.slice(0, 2),
    future = /^XI0[2-8]$/.test(f.id),
    conditional = group === "PT" || f.id === "PY05";
  const observations = [
    ...(views.observed[f.id] || []),
    ...(exceptions.observed?.[f.id] || []),
  ]
    .filter(
      (o, i, a) =>
        a.findIndex((x) => x.url === o.url && x.text === o.text) === i
    )
    .slice(0, 8);
  return {
    id: f.id,
    name: f.name,
    type: f.type,
    source: f.source,
    rule: f.rule,
    visibilityAndEditing: f.condition,
    applicability: future
      ? "FUTURE_RESERVED"
      : conditional
      ? "CONDITION_DISABLED"
      : "CURRENT",
    path: paths[group],
    verification:
      future || conditional
        ? "INTENTIONALLY_NOT_RENDERED"
        : observations.length
        ? "VISIBLE_IN_H5"
        : "NOT_OBSERVED",
    observations,
  };
});
const current = mapping.filter((f) => f.applicability === "CURRENT"),
  missing = current
    .filter((f) => !f.observations.length)
    .map((f) => ({ id: f.id, name: f.name, path: f.path })),
  unwanted = mapping
    .filter((f) => f.applicability !== "CURRENT" && f.observations.length)
    .map((f) => f.id),
  viewIds = [
    ...new Set(
      views.results
        .filter((r) => r.status === "PASS" && /^P-[ABC]\d\d$/.test(r.view))
        .map((r) => r.view)
    ),
  ];
const result = {
  at: new Date().toISOString(),
  total: 294,
  groups: 26,
  current: current.length,
  observed: current.length - missing.length,
  conditionDisabled: 11,
  futureReserved: 7,
  viewCount: viewIds.length,
  viewIds,
  missing,
  unwanted,
  mapping,
  boundary:
    "Visible field observations from actual local H5 controls/detail/history/evidence. Not all permutations or WeChat/device/owner acceptance. Empty optional facts remain conditional; definitions alone do not prove a rendered field.",
};
fs.writeFileSync(
  path.join(evidence, "field-mapping.json"),
  JSON.stringify(result, null, 2) + "\n"
);
console.log(
  JSON.stringify(
    {
      current: result.current,
      observed: result.observed,
      views: viewIds.length,
      missing,
      unwanted,
    },
    null,
    2
  )
);
assert.equal(mapping.length, 294);
assert.equal(viewIds.length, 23);
assert.equal(unwanted.length, 0);
assert.equal(views.results.filter((r) => r.status === "FAIL").length, 0);
assert.ok(exceptions.results.every((r) => r.status === "PASS"));
process.exitCode = missing.length ? 1 : 0;
