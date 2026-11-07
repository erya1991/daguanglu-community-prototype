import { actorFor, inScope, execute, sensitive } from "../core.js";
import {
  actor,
  domain,
  need,
  tables,
  get,
  visible,
  houseFor,
  clone,
  now,
  day,
  touch,
  required,
  makeId,
  history,
  isPropertyOperator,
} from "./common.js";
import { billingCommand, importPreview, refreshBill } from "./billing.js";
import { parkingCommand } from "./parking.js";
import { paymentCommand, replayPayment, auxiliaryFunds } from "./payments.js";
import { workorderCommand, allowedActions } from "./workorders.js";
import { prepare } from "./migration.js";
export { prepare, importPreview };
const residentTables = [
  "bills",
  "payments",
  "parkingRelations",
  "products",
  "monthly",
  "temporary",
  "reports",
];
const historyKeys = {
  bills: "BL24",
  payments: "PY23",
  checks: "EX11",
  parkingRelations: "PK12",
  monthly: "MO19",
  temporary: "TB16",
  events: "EV14",
  workorders: "WO14",
  reports: "RP20",
};
export function fieldLabels(s) {
  const pairs = [
    ...s.communities.map((r) => [r._id, r["社区名称"]]),
    ...s.estates.map((r) => [r._id, r["小区名称"]]),
    ...s.buildings.map((r) => [r._id, r["楼栋名称／楼栋号"]]),
    ...s.units.map((r) => [r._id, r["单元名称／单元号"]]),
    ...s.houses.map((r) => [r._id, r["完整房屋地址"]]),
    ...s.vehicles.map((r) => [r._id, r["车牌号码"]]),
    ...s.residents.map((r) => [r._id, r["居民姓名"]]),
    ...s.orgs.map((r) => [r._id, r["组织名称"]]),
  ];
  return Object.fromEntries(pairs);
}
function projection(s, a, table, row) {
  const d = domain(s),
    labels = fieldLabels(s),
    r = clone(row);
  if (table === "bills") refreshBill(r);
  for (const key of Object.keys(r))
    if (
      key.startsWith("_") &&
      !["_id", "_rev", "_relation", "_product"].includes(key)
    )
      delete r[key];
  r.history = clone(
    (row.history || []).filter((h) => isPropertyOperator(a) || h._public)
  ).map((h) => {
    delete h._actor;
    delete h._public;
    return h;
  });
  if (historyKeys[table]) r[historyKeys[table]] = r.history;
  if (a.role === "resident") {
    if (table === "bills") {
      delete r.BL02;
      delete r.BL22;
    }
    if (table === "parkingRelations")
      for (const k of ["PK08", "PK09", "PK10", "PK11"]) delete r[k];
  }
  if (table === "reports" && isPropertyOperator(a) && !sensitive(a, "phone"))
    delete r.RP16;
  if (table === "bills") {
    r.relatedPayments = d.payments
      .filter(
        (p) =>
          p._business === row._id &&
          (isPropertyOperator(a) || p._resident === a.resident)
      )
      .map((p) => projection(s, a, "payments", p));
    r._title = r.BL08;
    const activePayment = d.payments.find(
      (p) =>
        p._business === row._id &&
        ["处理中", "结果待确认", "成功"].includes(p.PY12)
    );
    r._paymentPending = !!activePayment;
    r._status =
      r.BL19 === "待发布"
        ? r.BL19
        : activePayment && activePayment.PY17 !== "成功"
        ? activePayment.PY12 === "成功"
          ? "已支付待核销"
          : "付款结果确认中"
        : r.BL20;
    r._subtitle = r.BL10 + " 至 " + r.BL11;
    r._amount = r.BL16;
    r._date = r.BL10;
  }
  if (table === "batches") {
    r._title = r.IM02;
    r._status = r.IM04;
    r._date = r.IM12;
  }
  if (table === "payments") {
    const source = row._snapshot || {},
      parking = row._parkingSnapshot || {};
    const keys =
      row.PY02 === "物业费"
        ? ["BL07", "BL08", "BL09", "BL10", "BL11", "BL13", "BL18"]
        : row.PY02 === "停车月租"
        ? ["MO02", "MO03", "MO07", "MO08", "MO09", "MO18"]
        : ["TB02", "TB04", "TB05", "TB06", "TB09", "TB10", "TB11"];
    r.businessSummary = Object.fromEntries(
      keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]])
    );
    if (row.PY02 !== "物业费")
      for (const k of ["PK03", "PK04", "PK05"])
        if (parking[k]) r.businessSummary[k] = parking[k];
    r._title = r.PY02 + " · " + r.PY03;
    r._status = r.PY12 + "／" + r.PY17;
    r._amount = r.PY06;
    r._date = r.PY14 || r.PY13;
  }
  if (table === "checks") {
    r._title = r.EX02;
    r._status = r.EX05;
    r._date = r.EX09;
  }
  if (table === "parkingRelations") {
    r._identityLocked =
      d.monthly.some((x) => x._relation === row._id) ||
      d.temporary.some((x) => x.TB03 === row._id);
    r._title = r.PK03 + " · " + r.PK05;
    r._status = r.PK07;
  }
  if (table === "products") {
    r._title = r.MP02;
    r._status = r.MP07;
    r._amount = r.MP04;
  }
  if (table === "monthly") {
    r._title = r.MO03;
    r._status = r.MO10;
    r._subtitle = r.MO07 + " 至 " + r.MO08;
    r._amount = r.MO09;
    r._date = r.MO17;
    r.relation = projection(
      s,
      a,
      "parkingRelations",
      row._relationSnapshot ||
        d.parkingRelations.find((x) => x._id === row._relation)
    );
    r.payments = d.payments
      .filter((p) => p._business === row._id && visible(s, a, p, "payments"))
      .map((p) => projection(s, a, "payments", p));
  }
  if (table === "temporary") {
    r._title = r.TB02;
    r._status = r.TB14;
    r._amount = r.TB08;
    r._date = r.TB04;
    r.relation = projection(
      s,
      a,
      "parkingRelations",
      row._relationSnapshot ||
        d.parkingRelations.find((x) => x._id === row.TB03)
    );
    r.payments = d.payments
      .filter((p) => p._business === row._id && visible(s, a, p, "payments"))
      .map((p) => projection(s, a, "payments", p));
  }
  if (["reports", "events", "workorders"].includes(table)) {
    const report =
        table === "reports"
          ? row
          : d.reports.find((x) => x._id === row._report),
      event = d.events.find((x) => x._id === report._event),
      task = d.workorders.find((x) => x._id === event?._workorder);
    r._title = report.RP14;
    r._subtitle = report.RP13;
    r._date = report.RP05;
    r._status =
      table === "events"
        ? row.EV09
        : table === "workorders"
        ? row.WO06
        : report.RP19;
    r._kind = report.RP07;
    if (table === "reports") {
      if (a.role === "resident")
        r.RP18 = r.RP18.filter((x) => x._public !== false);
      r.feedback = {
        EV07: event?.EV09 === "待补充" ? event.EV07 : "",
        EV12: event?.EV12 || "",
        EV13: clone(event?.EV13 || []),
      };
      r.resolution = task
        ? Object.fromEntries(
            Object.entries(task).filter(([k]) => /^(UC|VA)\d\d$/.test(k))
          )
        : { UC06: "未到确认节点", VA05: "未评价" };
      r.confirmations = clone(task?.confirmations || []);
      r._taskRevision = task?._rev;
      r._canConfirm = !!(task && task.WO06 === "待居民确认");
      r._canEvaluate = !!(
        task?.UC06 === "已确认解决" && task.VA05 === "未评价"
      );
      if (isPropertyOperator(a) && event) {
        r.event = projection(s, a, "events", event);
        r._workorder = task?._id;
      }
    } else {
      r.report = projection(s, a, "reports", { ...report, _event: "" });
      delete r.report.event;
      if (table === "workorders") {
        r._date = row.WO08 || "";
        r.event = clone(event);
        r._actions = allowedActions(s, a, row);
        r.draft = row._assignee === a._id ? clone(row._draft || {}) : {};
        r.WO14 = r.history;
        r._assignee = row._assignee;
        const interval = (x, y) =>
          x && y
            ? Math.max(0, Math.round((Date.parse(y) - Date.parse(x)) / 1000)) +
              "秒（时间间隔，非考核结论）"
            : "";
        r.ST06 = interval(report.RP05, row.WO10);
        r.ST07 = interval(row.WO10, row.rounds.slice(-1)[0]?.PR08);
        r.ST08 = interval(report.RP05, row.UC05);
      }
    }
  }
  if (isPropertyOperator(a))
    r._scope = { community: row._community, estate: row._estate };
  r._labels = Object.fromEntries(
    Object.entries(r)
      .filter(
        ([k, v]) =>
          /^[A-Z]{2}\d\d$/.test(k) &&
          k !== "BL07" &&
          typeof v === "string" &&
          labels[v]
      )
      .map(([k, v]) => [k, labels[v]])
  );
  return r;
}
export function query(s, ctx, table, filters = {}) {
  const a = actor(s, ctx),
    d = domain(s);
  need(tables.includes(table), "未知查询对象");
  if (a.role === "resident")
    need(residentTables.includes(table), "住户不能查询内部办理记录");
  let rows = d[table].filter((r) => visible(s, a, r, table));
  if (ctx.community && isPropertyOperator(a))
    rows = rows.filter((r) => r._community === ctx.community);
  if (ctx.estate && isPropertyOperator(a))
    rows = rows.filter((r) => r._estate === ctx.estate);
  rows = rows.map((r) => projection(s, a, table, r));
  if (filters.keyword)
    rows = rows.filter((r) =>
      Object.entries(r).some(
        ([k, v]) =>
          !k.startsWith("_") &&
          typeof v !== "object" &&
          String(v).includes(filters.keyword)
      )
    );
  if (filters.status)
    rows = rows.filter(
      (r) => r._status === filters.status || r.WO06 === filters.status
    );
  for (const k of [
    "BL07",
    "PK02",
    "PK04",
    "TB03",
    "RP07",
    "PY02",
    "BL21",
    "BL19",
  ])
    if (filters[k]) rows = rows.filter((r) => r[k] === filters[k]);
  if (filters.start)
    rows = rows.filter((r) => r._date?.slice(0, 10) >= filters.start);
  if (filters.end)
    rows = rows.filter((r) => r._date?.slice(0, 10) <= filters.end);
  return rows;
}
export function record(s, ctx, table, id) {
  const a = actor(s, ctx);
  if (a.role === "resident")
    need(residentTables.includes(table), "无权查看内部详情");
  return projection(s, a, table, get(s, a, table, id));
}
export function options(s, ctx) {
  const a = actor(s, ctx),
    d = domain(s);
  const houses = s.houses.filter((h) => {
    try {
      houseFor(s, a, h._id);
      return true;
    } catch {
      return false;
    }
  });
  return {
    houses: houses.map((h) => ({
      value: h._id,
      label: h["完整房屋地址"],
      community: h["所属社区"],
      estate: h["所属小区"],
    })),
    communities: s.communities
      .filter((c) =>
        a.role === "resident"
          ? (
              s.residents.find((r) => r._id === a.resident)?._communities || []
            ).includes(c._id)
          : a["可查看社区"].includes(c._id)
      )
      .map((c) => ({ value: c._id, label: c["社区名称"] })),
    estates: s.estates
      .filter((e) =>
        a.role === "resident"
          ? (
              s.residents.find((r) => r._id === a.resident)?._communities || []
            ).includes(e["所属社区"])
          : a["可查看小区"].includes(e._id)
      )
      .map((e) => ({
        value: e._id,
        label: e["小区名称"],
        community: e["所属社区"],
      })),
    vehicles: s.vehicles
      .filter((v) =>
        a.role === "resident"
          ? v._resident === a.resident
          : houses.some((h) => h._id === v["关联房屋"])
      )
      .map((v) => ({ value: v._id, label: v["车牌号码"] })),
    personnel:
      isPropertyOperator(a)
        ? s.personnel
            .filter(
              (p) =>
                (a.role === "platform" || p["所属物业组织"] === a.org) &&
                p["在岗状态"] === "在岗" &&
                s.accounts.some(
                  (x) =>
                    x._id === p["关联账号"] &&
                    x["账号状态"] === "启用" &&
                    (x["授权角色"].includes("property") || (a.role === "platform" && x["授权角色"].includes("platform")))
                )
            )
            .map((p) => ({
              value: p._id,
              label: p["人员姓名"],
              account: p["关联账号"],
            }))
        : [],
    scenarios: clone(d.scenarios),
    relations: query(s, ctx, "parkingRelations"),
    products: query(s, ctx, "products"),
    config: clone(d.config),
    actor: {
      id: a._id,
      name: a.name,
      role: a.role,
      resident: a.resident,
      phone: s.residents.find((r) => r._id === a.resident)?.["联系电话"] || "",
    },
  };
}
export function overview(s, ctx) {
  const a = actor(s, ctx);
  need(isPropertyOperator(a), "无权查看内部概况");
  const events = query(s, ctx, "events"),
    tasks = query(s, ctx, "workorders");
  return {
    ST01: events.filter((r) => ["待核实", "待重新核实"].includes(r.EV09))
      .length,
    ST02: tasks.filter((r) => r.WO06 === "待派单").length,
    ST03: tasks.filter((r) => ["待接单", "处理中", "退回整改"].includes(r.WO06))
      .length,
    ST04: tasks.filter((r) => r.WO06 === "待复核").length,
    ST05: tasks.filter((r) => r.WO06 === "待居民确认").length,
    ST09: now(),
  };
}
const financeCommands = [
  "import",
  "editBill",
  "publish",
  "saveParkingRelation",
  "saveProduct",
  "saveTemporary",
  "createCheck",
  "saveCheck",
  "recoverPayment",
];
export function command(s, ctx, name, p = {}) {
  // Vue 3 callers may pass reactive proxies. Persist only plain product data.
  p = clone(p);
  const a = actor(s, ctx, true, financeCommands.includes(name)),
    d = domain(s);
  if (ctx.app === "staff")
    need(
      [
        "report",
        "supplement",
        "verify",
        "dispatch",
        "accept",
        "return",
        "transfer",
        "saveProcess",
        "submitProcess",
        "review",
        "closeHazard",
      ].includes(name),
      "管理端收费仅可查询"
    );
  const key = [a._id, ctx.app, name, p.id || "", p.operation || ""].join(":");
  if (p.operation && d.operations[key]) {
    const old = d.operations[key];
    if (old.table) get(s, a, old.table, old.id);
    return clone(old.result);
  }
  let result;
  if (["import", "editBill", "publish"].includes(name))
    result = billingCommand(s, ctx, name, p);
  else if (
    [
      "saveParkingRelation",
      "saveProduct",
      "saveTemporary",
      "createMonthly",
    ].includes(name)
  )
    result = parkingCommand(s, ctx, name, p);
  else if (
    [
      "pay",
      "queryPayment",
      "recoverPayment",
      "createCheck",
      "saveCheck",
    ].includes(name)
  )
    result = paymentCommand(s, ctx, name, p);
  else result = workorderCommand(s, ctx, name, p);
  if (p.operation) {
    const table = tables.find((t) => d[t].some((r) => r._id === result.id));
    d.operations[key] = { table, id: result.id, result: clone(result) };
  }
  touch(s);
  return result;
}
export function reset(s, ctx, blobs) {
  actor(s, ctx);
  for (const [id, meta] of Object.entries(s.attachments))
    if (meta.stage01) {
      blobs?.(id);
      delete s.attachments[id];
    }
  const sequence = domain(s).sequence;
  const config = clone(domain(s).config),
    prepared = s.stage01.prepared;
  delete s.stage01;
  const d = domain(s);
  d.sequence = sequence;
  d.config = config;
  d.prepared = prepared;
  touch(s);
  for (const k of Object.keys(s.drafts || {}))
    if (k.includes(":stage01:")) delete s.drafts[k];
}
export function attachmentId(s, ctx, p) {
  const a = actor(s, ctx),
    r = record(s, ctx, p.table, p.id),
    ids = new Set();
  const visit = (x) => {
    if (!x || typeof x !== "object") return;
    for (const key of [
      "RP17",
      "SP03",
      "EX07",
      "EV13",
      "PR05",
      "PR06",
      "RV05",
      "UC03",
    ])
      for (const id of Array.isArray(x[key]) ? x[key] : [])
        if (typeof id === "string" && s.attachments[id]?.stage01) ids.add(id);
    for (const key of ["report", "event", "feedback", "resolution"])
      visit(x[key]);
    for (const key of ["rounds", "reviews", "confirmations", "RP18"])
      if (Array.isArray(x[key])) x[key].forEach(visit);
  };
  visit(r);
  need(ids.has(p.attachment), "无权访问此业务附件");
  return p.attachment;
}
export function auxiliary(s, ctx, name, p = {}) {
  const a = actor(s, ctx);
  const d = domain(s);
  if (name === "uploadFailure") {
    d.scenarios.uploadFailure = !!p.fail;
    return { message: "上传场景已保存" };
  }
  if (name === "mode") {
    need(
      ["normal", "unknown", "pending", "failure", "reconcile"].includes(p.mode),
      "未知场景"
    );
    d.scenarios.payment = p.mode;
    return { message: "下次缴费场景已选择" };
  }
  if (name === "funds") return auxiliaryFunds(s, ctx, p);
  if (name === "replay") return replayPayment(s, ctx, p);
  if (name === "sameHouse") {
    need(isPropertyOperator(a) && ctx.app === "web", "由物业辅助入口准备专项");
    const c = { app: "resident", account: "resident-a", role: "resident" };
    const existing = s.relations.find(
      (r) =>
        r._resident === "R-A" && r._house === "H-A" && r["关系状态"] === "有效"
    );
    if (!existing) {
      const applied = execute(s, c, "apply", {
        data: {
          _house: "H-A",
          申请类型: "绑定",
          申请关系类型: "家庭成员",
          联系号码: "13900000001",
          申请说明: "同房多人演示关系",
        },
      });
      execute(s, ctx, "review", {
        id: applied.id,
        decision: "通过",
        对外审核说明: "演示关系核验通过",
      });
    }
    return { message: "同房另一住户关系已按申请审核建立" };
  }
  need(false, "未知辅助操作");
}
