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
  date,
  clone,
  attachments,
  houseFor,
  requireProperty,
} from "./common.js";
export const allowedActions = (s, a, r) => {
  if (a.role !== "property") return [];
  const status = r.WO06,
    owner = r._assignee === a._id;
  return [
    ...(status === "待派单" ? ["dispatch"] : []),
    ...(status === "待接单" && owner ? ["accept", "return"] : []),
    ...(["待接单", "处理中", "退回整改"].includes(status) ? ["transfer"] : []),
    ...(["处理中", "退回整改"].includes(status) && owner
      ? ["saveProcess", "submitProcess"]
      : []),
    ...(status === "待复核" ? ["review"] : []),
    ...(status === "待销号" ? ["closeHazard"] : []),
  ];
};
function personnel(s, a, id) {
  const p = s.personnel.find((x) => x._id === id),
    account = s.accounts.find((x) => x._id === p?.["关联账号"]);
  need(
    p &&
      p["在岗状态"] === "在岗" &&
      p["所属物业组织"] === a.org &&
      account?.["账号状态"] === "启用" &&
      account["授权角色"].includes("property"),
    "请选择本物业有效在岗且关联账号的人员"
  );
  return p;
}
function reportStatus(s, a, report, status, note) {
  report.RP19 = status;
  history(s, a, report, status, {}, { RP19: status }, note || "", true);
}
function newWorkorder(s, a, event, report) {
  const id = makeId(s, "WO"),
    r = {
      _id: id,
      _rev: 1,
      _event: event._id,
      _report: report._id,
      _resident: report._resident,
      _community: report._community,
      _estate: report._estate,
      _org: report._org,
      WO01: id,
      WO02: event.EV01,
      WO03: a.org,
      WO04: "",
      WO05: "",
      WO06: "待派单",
      WO07: "",
      WO08: "",
      WO09: "",
      WO10: "",
      WO11: "",
      WO12: 1,
      WO13: "物业管理员",
      rounds: [],
      reviews: [],
      operations: [],
      history: [],
      UC06: "未到确认节点",
      VA05: "未评价",
    };
  if (report.RP07 === "隐患")
    Object.assign(r, {
      HZ01: makeId(s, "HZ"),
      HZ02: event.EV03,
      HZ03: event.HZ03 || "",
      HZ04: event.HZ04 || "",
      HZ05: event.HZ05 || "",
      HZ06: "整改中",
      HZ07: "",
      HZ08: "",
      HZ09: event.HZ09 || "",
    });
  domain(s).workorders.push(r);
  event._workorder = id;
  return r;
}
export function workorderCommand(s, ctx, command, p) {
  const d = domain(s),
    a = actor(s, ctx, true);
  if (command === "report") {
    const data = p.data || {};
    required(data, ["RP07", "RP09", "RP10", "RP11", "RP13", "RP14"]);
    need(["报修", "隐患"].includes(data.RP07), "事项类型无效");
    const estate = s.estates.find(
      (x) =>
        x._id === data.RP10 &&
        x["所属社区"] === data.RP09 &&
        x["档案状态"] !== "停用"
    );
    need(estate, "请核对社区与小区");
    if (a.role === "property")
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
        RP03: a.role === "property" && data.RP03 ? data.RP03 : a.name,
        RP04:
          a.role === "property" && data.RP03 && data.RP03 !== a.name
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
        RP19: "待核实",
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
      EV09: "待核实",
      EV10: "",
      EV11: "",
      EV12: "",
      EV13: [],
      history: [],
    };
    d.reports.push(r);
    d.events.push(e);
    history(
      s,
      a,
      r,
      "提交上报",
      {},
      { RP19: "待核实" },
      "上报已受理，等待人工核实",
      true
    );
    return { id, message: "上报已提交" };
  }
  if (command === "supplement") {
    const report = get(s, a, "reports", p.id);
    revision(report, p);
    required(p.data || {}, ["SP02"]);
    const r = {
      SP01: makeId(s, "SP"),
      _public: a.role === "resident",
      SP02: p.data.SP02,
      SP03: attachments(s, a, p.data.SP03 || []),
      SP04: a.name,
      SP05: now(),
      SP06: ctx.app === "resident" ? "住户补充" : "物业现场补证",
    };
    report.RP18.push(r);
    history(
      s,
      a,
      report,
      "追加补充",
      {},
      { SP02: r.SP02 },
      r.SP02,
      a.role === "resident"
    );
    const e = d.events.find((x) => x._id === report._event);
    if (e.EV09 === "待补充") e.EV09 = "待核实";
    return { id: report._id, message: "补充已保存，原始记录保持" };
  }
  if (command === "verify") {
    requireProperty(a);
    const e = get(s, a, "events", p.id),
      report = get(s, a, "reports", e._report);
    revision(e, p);
    need(
      ["待核实", "待补充", "待重新核实"].includes(e.EV09),
      "该事件当前不能核实"
    );
    const data = p.data || {};
    required(data, ["EV05", "EV06"]);
    need(
      ["有效", "需补充", "误报", "重复"].includes(data.EV05),
      "核实结论无效"
    );
    if (data.EV05 === "有效")
      required({ EV03: data.EV03 || report.RP08 }, ["EV03"]);
    if (data.EV05 === "需补充") required(data, ["EV07"]);
    if (data.EV05 === "重复") {
      const main = get(s, a, "events", data.EV08);
      need(
        main._id !== e._id && main.EV09 !== "重复关联" && !main.EV08,
        "请选择独立的有效主事件，不能自关联或循环关联"
      );
    }
    Object.assign(e, {
      EV03: data.EV03 || report.RP08,
      EV04: data.EV04 || report.RP13,
      EV05: data.EV05,
      EV06: data.EV06,
      EV07: data.EV07 || "",
      EV08: data.EV08 || "",
      EV10: a.name,
      EV11: now(),
      EV12: data.EV12 || "",
      EV13: attachments(s, a, data.EV13 || []),
    });
    if (report.RP07 === "隐患" && data.EV05 === "有效") {
      required(data, ["HZ04"]);
      date(data.HZ05, "HZ05", true);
      Object.assign(e, {
        HZ03: data.HZ03 || "",
        HZ04: data.HZ04,
        HZ05: data.HZ05 || "",
        HZ09: data.HZ09 || "",
      });
    }
    e.EV09 = {
      有效: "已核实",
      需补充: "待补充",
      误报: "误报终止",
      重复: "重复关联",
    }[data.EV05];
    if (data.EV05 === "有效") {
      const w = e._workorder
        ? get(s, a, "workorders", e._workorder)
        : newWorkorder(s, a, e, report);
      if (w.WO06 === "待重新核实") {
        w.WO06 = "待派单";
        w.WO12++;
        w._draft = null;
      }
    }
    history(s, a, e, "人工核实", {}, { EV05: e.EV05, EV09: e.EV09 }, e.EV06);
    reportStatus(
      s,
      a,
      report,
      data.EV05 === "有效" ? "待派单" : e.EV09,
      e.EV12 || (data.EV05 === "需补充" ? e.EV07 : "核实结果已更新")
    );
    return { id: e._id, message: "核实已记录，派单仍需手工办理" };
  }
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
    need(report.RP07 === "报修", "隐患由物业有效复核销号");
    if (command === "confirm") {
      need(r.WO06 === "待居民确认", "尚未到居民确认节点");
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
      r.WO06 = r.UC01 === "已解决" ? "已完成" : "待重新核实";
      if (r.UC01 === "未解决") {
        const e = d.events.find((e) => e._id === r._event);
        e.EV09 = "待重新核实";
        history(s, a, e, "居民反馈未解决", {}, {}, r.UC02);
      }
      history(s, a, r, "居民结果确认", {}, { UC01: r.UC01 }, r.UC02, true);
      reportStatus(s, a, report, r.WO06, r.UC02);
    } else {
      need(
        r.UC06 === "已确认解决" && r.VA05 === "未评价",
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
      });
      history(s, a, r, "居民评价", {}, { VA01: r.VA01 }, r.VA02, true);
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
    before = { WO06: r.WO06, WO04: r.WO04 };
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
      OP06: "已派单，等待本人接单",
    };
    r.operations.push(op);
    r._assignee = person["关联账号"];
    r.WO04 = person["人员姓名"];
    r.WO05 = data.WO05 || r.WO05;
    r.WO06 = "待接单";
    r.WO07 = a.name;
    r.WO08 = r.WO08 || now();
    r.WO09 = now();
    r.WO11 = "";
    r._draft = null;
  }
  if (command === "accept") {
    r.WO06 = "处理中";
    r.WO10 = r.WO10 || now();
    r.WO11 = now();
  }
  if (command === "return") {
    required(data, ["OP01"]);
    r.operations.push({
      OP01: data.OP01,
      OP02: r.WO04,
      OP03: "",
      OP04: "",
      OP05: "退回待派单",
      OP06: "退单已保存",
    });
    r.WO06 = "待派单";
    r._assignee = "";
    r.WO04 = "";
  }
  if (["saveProcess", "submitProcess"].includes(command)) {
    const merged = { ...(r._draft || {}), ...data };
    const draft = Object.fromEntries(
      ["PR02", "PR03", "PR04", "PR05", "PR06", "PR07", "PR11"]
        .filter((k) => merged[k] !== undefined)
        .map((k) => [k, merged[k]])
    );
    required(draft, ["PR02", "PR07"]);
    draft.PR05 = attachments(s, a, draft.PR05 || []);
    draft.PR06 = attachments(s, a, draft.PR06 || []);
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
      if (report.RP07 === "隐患")
        need(
          draft.PR05.length && draft.PR06.length,
          "隐患整改须分别上传前后证据",
          { PR05: "整改前证据", PR06: "整改后证据" }
        );
      const round = {
        ...draft,
        PR01: makeId(s, "PR"),
        PR08: now(),
        PR09: a.name,
        PR10: r.WO12,
      };
      r.rounds.push(round);
      r._draft = null;
      r.WO06 = "待复核";
    } else r._draft = draft;
  }
  if (command === "review") {
    required(data, ["RV03", "RV04"]);
    need(["通过", "退回"].includes(data.RV03), "复核结论无效");
    const round = r.rounds[r.rounds.length - 1];
    need(
      round?.PR10 === r.WO12 && (!data.RV02 || data.RV02 === r.WO12),
      "处理轮次已变化"
    );
    const review = {
      RV01: makeId(s, "RV"),
      RV02: r.WO12,
      RV03: data.RV03,
      RV04: data.RV04,
      RV05: attachments(s, a, data.RV05 || []),
      RV06: a.name,
      RV07: now(),
      RV08: "复核已记录",
    };
    r.reviews.push(review);
    if (data.RV03 === "退回") {
      r.WO06 = "退回整改";
      r.WO12++;
      r._draft = null;
    } else {
      r.WO06 = report.RP07 === "隐患" ? "待销号" : "待居民确认";
      if (report.RP07 === "报修") r.UC06 = "待确认";
      const permittedPhotos = new Set([
        ...(report.RP17 || []),
        ...(round.PR05 || []),
        ...(round.PR06 || []),
        ...review.RV05,
      ]);
      need(
        (data.EV13 || []).every((id) => permittedPhotos.has(id)),
        "公开照片不属于本事项已核验证据"
      );
      e.EV12 = data.EV12 || "处理结果已通过内部复核";
      e.EV13 = [...(data.EV13 || [])];
    }
  }
  if (command === "closeHazard") {
    const review = r.reviews[r.reviews.length - 1];
    need(
      report.RP07 === "隐患" &&
        review?.RV03 === "通过" &&
        review.RV02 === r.WO12,
      "必须有本轮有效复核才能销号"
    );
    r.HZ06 = "已销号";
    r.HZ07 = review.RV01;
    r.HZ08 = now();
    r.WO06 = "已销号";
  }
  history(
    s,
    a,
    r,
    {
      dispatch: "人工派单",
      transfer: "内部转派",
      accept: "接单",
      return: "退单",
      saveProcess: "保存处理记录",
      submitProcess: "提交复核",
      review: "内部复核",
      closeHazard: "隐患销号",
    }[command],
    before,
    { WO06: r.WO06, WO04: r.WO04 },
    data.RV04 || data.OP04 || data.OP01 || "",
    false
  );
  reportStatus(
    s,
    a,
    report,
    r.WO06,
    ["待居民确认", "待销号", "已销号"].includes(r.WO06) ? e.EV12 : ""
  );
  return { id: r._id, message: "办理已保存" };
}
