import {
  domain,
  actor,
  need,
  required,
  get,
  revision,
  makeId,
  history,
  now,
  day,
  clone,
  attachments,
  houseFor,
  requireProperty,
  isPropertyOperator,
} from "./common.js";
import { createTask } from "./upgrade.js";
export const allowedActions = (s, a, r) => {
  if (!isPropertyOperator(a)) return [];
  const status = r.WO06,
    owner = r._assignee === a._id;
  return [
    ...(status !== "已完成"
      ? ["editTask"]
      : []),
    ...(status === "待派单" ? ["dispatch"] : []),
    ...(["待处理", "处理中"].includes(status) ? ["transfer"] : []),
    ...(status === "待处理" && owner ? ["startProcess"] : []),
    ...(status === "处理中" && owner
      ? ["saveProcess", "submitProcess"]
      : []),
  ];
};
function personnel(s, a, id) {
  const p = s.personnel.find((x) => x._id === id),
    account = s.accounts.find((x) => x._id === p?.["关联账号"]);
  need(
    p &&
      p["在岗状态"] === "在岗" &&
      (a.role === "platform" || p["所属物业组织"] === a.org) &&
      account?.["账号状态"] === "启用" &&
      (account["授权角色"].includes("property") ||
        (a.role === "platform" && account["授权角色"].includes("platform"))),
    "请选择本物业有效在岗且关联账号的人员"
  );
  return p;
}
function reportStatus(s, a, report, status, note) {
  report.RP19 = status;
  history(s, a, report, status, {}, { RP19: status }, note || "", true);
}
function newWorkorder(s, a, event, report) {
  return createTask(domain(s), report, event);
}
export function workorderCommand(s, ctx, command, p) {
  const d = domain(s),
    a = actor(s, ctx, true);
  if (command === "report") {
    const data = p.data || {};
    required(data, ["RP07", "RP08", "RP09", "RP10", "RP11", "RP13", "RP14"]);
    need(d.config.categories.includes(data.RP08), "请选择有效问题类别", {
      RP08: "请选择问题类别",
    });
    need(["报修", "隐患"].includes(data.RP07), "事项类型无效");
    const estate = s.estates.find(
      (x) =>
        x._id === data.RP10 &&
        x["所属社区"] === data.RP09 &&
        x["档案状态"] !== "停用"
    );
    need(estate, "请核对社区与小区");
    if (isPropertyOperator(a))
      need(a["可查看小区"].includes(estate._id), "上报位置不在授权范围");
    else
      need(
        (
          s.residents.find((r) => r._id === a.resident)?._communities || []
        ).includes(estate["所属社区"]),
        "上报位置不在本人授权社区"
      );
    if (data.RP11 === "房屋内") {
      required(data, ["RP12"]);
      const h = houseFor(s, a, data.RP12);
      need(h["所属小区"] === estate._id, "房屋和所选位置不一致");
    } else need(data.RP11 === "公共位置", "请选择位置类型");
    if (data.RP07 === "报修") required(data, ["RP15", "RP16"]);
    if (data.RP06)
      need(
        Number.isFinite(Date.parse(data.RP06)) &&
          Date.parse(data.RP06) <= Date.now(),
        "发现时间无效或晚于当前时间"
      );
    const photos = attachments(s, a, data.RP17 || []);
    if (data.RP07 === "隐患")
      need(photos.length, "请上传隐患现场照片", { RP17: "至少保留现场证据" });
    const id = makeId(s, "RP"),
      eventId = makeId(s, "EV"),
      r = {
        _id: id,
        _rev: 1,
        _resident: a.role === "resident" ? a.resident : "",
        _account: a._id,
        _community: estate["所属社区"],
        _estate: estate._id,
        _org: estate["所属物业组织"] || a.org || "ORG-A",
        RP01: id,
        RP02:
          ctx.app === "resident"
            ? "住户小程序"
            : ctx.app === "staff"
            ? "管理端现场上报"
            : "Web人工登记",
        RP03: isPropertyOperator(a) && data.RP03 ? data.RP03 : a.name,
        RP04:
          isPropertyOperator(a) && data.RP03 && data.RP03 !== a.name
            ? a.name
            : "",
        RP05: now(),
        RP06: data.RP06 || "",
        RP07: data.RP07,
        RP08: data.RP08 || "",
        RP09: estate["所属社区"],
        RP10: estate._id,
        RP11: data.RP11,
        RP12: data.RP11 === "房屋内" ? data.RP12 : "",
        RP13: data.RP13,
        RP14: data.RP14,
        RP15: data.RP15 || "",
        RP16: data.RP16 || "",
        RP17: photos,
        RP18: [],
        RP19: "待派单",
        _event: eventId,
        history: [],
      };
    const e = {
      _id: eventId,
      _rev: 1,
      _report: id,
      _resident: r._resident,
      _community: r._community,
      _estate: r._estate,
      _org: r._org,
      EV01: eventId,
      EV02: id,
      EV03: r.RP08,
      EV04: r.RP13,
      EV05: "",
      EV06: "",
      EV07: "",
      EV08: "",
      EV09: "已受理",
      EV10: "",
      EV11: "",
      EV12: "",
      EV13: [],
      history: [],
    };
    d.reports.push(r);
    d.events.push(e);
    const task = newWorkorder(s, a, e, r);
    history(
      s,
      a,
      task,
      "登记工单",
      {},
      { WO06: task.WO06, WO15: task.WO15 },
      "",
      false
    );
    history(
      s,
      a,
      r,
      "提交上报",
      {},
      { RP19: "待派单" },
      "上报已受理，等待物业派单",
      true
    );
    return { id, workorderId: task._id, message: "上报已提交，工单待派单" };
  }
  if (["supplement", "requestSupplement", "markDuplicate", "markFalse", "verify", "accept", "return", "review", "closeHazard"].includes(command))
    need(false, "工单流程已调整，请刷新后按当前操作办理");
  if (["confirm", "evaluate"].includes(command)) {
    need(a.role === "resident", "仅上报住户本人可确认和评价");
    const report = get(s, a, "reports", p.id),
      r = get(
        s,
        a,
        "workorders",
        d.events.find((e) => e._id === report._event)?._workorder
      );
    revision(r, p);
    if (command === "confirm") {
      need(r.WO06 === "待确认", "尚未到居民确认节点");
      required(p.data || {}, ["UC01"]);
      need(["已解决", "未解决"].includes(p.data.UC01), "确认结论无效");
      if (p.data.UC01 === "未解决") required(p.data, ["UC02"]);
      Object.assign(r, {
        UC01: p.data.UC01,
        UC02: p.data.UC02 || "",
        UC03: attachments(s, a, p.data.UC03 || []),
        UC04: a.name,
        UC05: now(),
        UC06: p.data.UC01 === "已解决" ? "已确认解决" : "反馈未解决",
      });
      r.confirmations = [
        ...(r.confirmations || []),
        {
          UC01: r.UC01,
          UC02: r.UC02,
          UC03: r.UC03,
          UC04: r.UC04,
          UC05: r.UC05,
          UC06: r.UC06,
        },
      ];
      r.WO06 = r.UC01 === "已解决" ? "待评价" : "待派单";
      if (r.UC01 === "未解决") {
        const e = d.events.find((e) => e._id === r._event);
        e.EV09 = "已受理";
        r.WO12++;
        r._draft = null;
        r._assignee = "";
        r.WO04 = "";
        history(s, a, e, "居民反馈未解决", {}, {}, r.UC02);
      }
      history(s, a, r, "居民结果确认", {}, { UC01: r.UC01 }, r.UC02, true);
      reportStatus(s, a, report, r.WO06, r.UC02);
    } else {
      need(
        r.WO06 === "待评价" && r.UC06 === "已确认解决" && r.VA05 === "未评价",
        "需本人确认解决且尚未评价"
      );
      need(d.config.ratings.includes(p.data?.VA01), "请选择有效评价", {
        VA01: "请选择服务评价",
      });
      Object.assign(r, {
        VA01: p.data.VA01,
        VA02: p.data.VA02 || "",
        VA03: a.name,
        VA04: now(),
        VA05: "已评价",
        WO06: "已完成",
      });
      history(s, a, r, "居民评价", {}, { VA01: r.VA01 }, r.VA02, true);
      reportStatus(s, a, report, r.WO06, "居民评价已完成");
    }
    return {
      id: report._id,
      message: command === "confirm" ? "确认已保存" : "评价已保存",
    };
  }
  requireProperty(a);
  const r = get(s, a, "workorders", p.id),
    report = get(s, a, "reports", r._report),
    e = get(s, a, "events", r._event);
  revision(r, p);
  need(
    allowedActions(s, a, r).includes(command),
    "当前状态或处理人不允许此操作"
  );
  const data = p.data || {},
    before = {
      WO06: r.WO06,
      WO04: r.WO04,
      WO15: r.WO15,
      WO16: r.WO16,
      WO17: r.WO17,
    };
  if (command === "editTask") {
    required(data, ["WO15", "WO16", "WO17", "WO18"]);
    need(["报修", "隐患"].includes(data.WO15), "工单类型无效");
    need(d.config.categories.includes(data.WO16), "请选择有效问题类别");
    need(
      data.WO15 === r.WO15 || (r.WO06 === "待派单" && !r.WO10),
      "派单后不能改变工单类型"
    );
    const newPhotos = attachments(s, a, data.WO19 || []);
    if (data.WO15 === "隐患")
      need(
        (report.RP17 || []).length + (r.WO19 || []).length + newPhotos.length,
        "隐患须补充现场证据",
        { WO19: "请补充现场照片" }
      );
    if (data.WO15 === "报修")
      required(
        {
          WO22: data.WO22 || r.WO22 || report.RP15,
          WO23: data.WO23 || r.WO23 || report.RP16,
        },
        ["WO22", "WO23"]
      );
    Object.assign(r, {
      WO15: data.WO15,
      WO16: data.WO16,
      WO17: data.WO17,
      WO18: data.WO18,
      WO19: [...(r.WO19 || []), ...newPhotos],
      WO22: data.WO22 || r.WO22 || report.RP15 || "",
      WO23: data.WO23 || r.WO23 || report.RP16 || "",
    });
    if (r.WO15 === "隐患")
      Object.assign(r, {
        HZ01: r.HZ01 || makeId(s, "HZ"),
        HZ02: r.WO16,
        HZ06: r.HZ06 || "整改中",
      });
  }
  if (["dispatch", "transfer"].includes(command)) {
    required(
      data,
      command === "dispatch" ? ["WO04", "WO05"] : ["OP03", "OP04"]
    );
    const person = personnel(
      s,
      a,
      command === "dispatch" ? data.WO04 : data.OP03
    );
    if (command === "transfer")
      need(person["关联账号"] !== r._assignee, "请选择另一位有效处理人");
    const op = {
      OP01: "",
      OP02: r.WO04,
      OP03: person["人员姓名"],
      OP04: data.OP04 || "",
      OP05: "派给" + person["人员姓名"],
      OP06: "已指派处理人",
    };
    r.operations.push(op);
    r._assignee = person["关联账号"];
    r.WO04 = person["人员姓名"];
    r.WO05 = data.WO05 || r.WO05;
    r.WO06 = "待处理";
    r.WO07 = a.name;
    r.WO08 = r.WO08 || now();
    r.WO09 = now();
    r.WO10 = r.WO10 || now();
    r.WO11 = "";
  }
  if (command === "startProcess") {
    r.WO06 = "处理中";
    r.WO10 = r.WO10 || now();
    r.WO11 = now();
  }
  if (["saveProcess", "submitProcess"].includes(command)) {
    const merged = { ...(r._draft || {}), ...data };
    const draft = Object.fromEntries(
      ["PR02", "PR03", "PR04", "PR05", "PR06", "PR07", "PR11"]
        .filter((k) => merged[k] !== undefined)
        .map((k) => [k, merged[k]])
    );
    required(draft, ["PR02", "PR07"]);
    for (const id of ["PR05", "PR06"]) {
      const previous = r._draft?.[id] || [];
      need(Array.isArray(draft[id] || []), "附件格式错误");
      draft[id] = (draft[id] || []).map(photo => {
        if (previous.includes(photo) && s.attachments[photo]?.stage01 && s.attachments[photo].status !== "失败") return photo;
        return attachments(s, a, [photo])[0];
      });
    }
    for (const id of ["PR03", "PR04"])
      if (draft[id])
        need(
          Number.isFinite(Date.parse(draft[id])) &&
            Date.parse(draft[id]) <= Date.now(),
          "现场实际时间无效或晚于当前时间",
          { [id]: "请核对实际时间" }
        );
    if (draft.PR03 && draft.PR04)
      need(
        Date.parse(draft.PR03) <= Date.parse(draft.PR04),
        "开始时间不能早于到场时间"
      );
    if (command === "submitProcess") {
      const round = {
        ...draft,
        PR01: makeId(s, "PR"),
        PR08: now(),
        PR09: a.name,
        PR10: r.WO12,
      };
      r.rounds.push(round);
      r._draft = null;
      r.WO06 = r._resident ? "待确认" : "已完成";
      r.UC06 = r._resident ? "待确认" : "无住户确认对象";
      e.EV12 = draft.PR07;
      e.EV13 = [];
    } else r._draft = draft;
  }
  history(
    s,
    a,
    r,
    {
      editTask: "更正工单分类",
      dispatch: "人工派单",
      transfer: "内部转派",
      startProcess: "开始处理",
      saveProcess: "保存处理记录",
      submitProcess: "提交验收",
    }[command],
    before,
    { WO06: r.WO06, WO04: r.WO04, WO15: r.WO15, WO16: r.WO16, WO17: r.WO17 },
    data.WO18 || data.RV04 || data.OP04 || data.OP01 || "",
    false
  );
  reportStatus(
    s,
    a,
    report,
    r.WO06,
    ["待确认", "待评价", "已完成"].includes(r.WO06) ? e.EV12 : ""
  );
  return { id: r._id, message: "办理已保存" };
}
