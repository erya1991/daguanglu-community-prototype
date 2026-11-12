// Stage01-only upgrade. Original reports, payment facts and historical reviews stay intact.
export function createTask(d, report, event) {
  const id = "S1-WO-" + String(++d.sequence).padStart(6, "0");
  const row = {
    _id: id,
    _rev: 1,
    _event: event._id,
    _report: report._id,
    _resident: report._resident,
    _community: report._community,
    _estate: report._estate,
    _org: report._org,
    WO01: id,
    WO02: event._id,
    WO03: report._org,
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
    WO15: report.RP07,
    WO16: event.EV03 || report.RP08 || "",
    WO17: event.EV04 || report.RP13,
    WO18: "",
    WO19: [],
    WO20: event.EV07 || "",
    WO21: "",
    WO22: report.RP15 || "",
    WO23: report.RP16 || "",
    rounds: [],
    reviews: [],
    operations: [],
    history: [],
    UC06: "未到确认节点",
    VA05: "未评价",
  };
  if (row.WO15 === "隐患")
    Object.assign(row, {
      HZ01: "S1-HZ-" + String(++d.sequence).padStart(6, "0"),
      HZ02: row.WO16,
      HZ03: event.HZ03 || "",
      HZ04: event.HZ04 || "",
      HZ05: event.HZ05 || "",
      HZ06: "整改中",
      HZ07: "",
      HZ08: "",
      HZ09: event.HZ09 || "",
    });
  d.workorders.push(row);
  event._workorder = id;
  return row;
}

export function upgradeStage01(d, state) {
  if (d.schemaVersion === 4) return;
  const original = new Map((d.workorders || []).map(w => [w._id, w.WO06]));
  const eventStatus = new Map((d.events || []).map(e => [e._id, e.EV09]));
  if (d.schemaVersion === 1) upgradeFirst(d);
  if (d.schemaVersion === 2) upgradeSimplified(d);
  if (d.schemaVersion === 3) upgradeSixStates(d, state, original, eventStatus);
}

function upgradeFirst(d) {
  const time = new Date().toISOString();
  for (const report of d.reports) {
    const event = d.events.find((e) => e._id === report._event);
    if (!event) throw new Error("上报关联资料缺失，原数据已保留");
    let task = d.workorders.find((w) => w._id === event._workorder);
    const created = !task;
    if (!task) task = createTask(d, report, event);
    Object.assign(task, {
      WO15: task.WO15 || report.RP07,
      WO16: task.WO16 || event.EV03 || report.RP08 || "",
      WO17: task.WO17 || event.EV04 || report.RP13,
      WO19: task.WO19 || [],
      WO20: event.EV07 || "",
    });
    const before = task.WO06;
    if (created)
      task.WO06 =
        { 待补充: "待补充", 误报终止: "误报终止", 重复关联: "重复关联" }[
          event.EV09
        ] || "待派单";
    if (before === "待重新核实") {
      task.WO06 = "待派单";
      task.WO12++;
      task._draft = null;
      task._assignee = "";
      task.WO04 = "";
    }
    if (!task.WO16 && task.WO06 === "待派单") {
      task.WO06 = "待补充";
      task.WO20 = "请补全问题类别";
    }
    if (created || before !== task.WO06) {
      task.history.push({
        HI01: "S1-HI-" + String(++d.sequence).padStart(6, "0"),
        HI02: "兼容旧上报流程",
        HI03: "系统",
        HI04: time,
        HI05: { WO06: created ? report.RP19 : before },
        HI06: { WO06: task.WO06 },
        HI07: "保留原上报及历史，关联统一工单；未执行人工核实",
        HI08: "成功",
        _actor: "system-migration",
        _public: false,
      });
      task._rev++;
      report.RP19 = task.WO06;
    }
  }
  for (const task of d.workorders) {
    const e = d.events.find((e) => e._id === task._event);
    if (e?.EV08)
      task.WO21 = d.events.find((x) => x._id === e.EV08)?._workorder || "";
  }
  d.schemaVersion = 2;
}

function upgradeSimplified(d) {
  if (d.schemaVersion !== 2) return;
  for (const task of d.workorders) {
    const before = task.WO06;
    if (["待复核", "待销号"].includes(before) && (task.rounds || []).some(r => r.PR10 === task.WO12))
      task.WO12++;
    if (["待接单", "待复核", "待销号", "退回整改"].includes(before))
      task.WO06 = task._assignee ? "处理中" : "待派单";
    else if (before === "待补充") task.WO06 = "待派单";
    if (task.WO06 !== before) {
      task.history ||= [];
      task.history.push({ HI01: "S1-HI-" + String(++d.sequence).padStart(6, "0"), HI02: "适配工单流程", HI03: "系统", HI04: new Date().toISOString(), HI05: { WO06: before }, HI06: { WO06: task.WO06 }, HI07: "保留原办理记录，需重新办理后提交验收", HI08: "成功", _actor: "system-migration", _public: false });
      task._rev++;
      const report = d.reports.find(r => r._id === task._report);
      if (report) report.RP19 = task.WO06;
    }
  }
  d.schemaVersion = 3;
}

function collectIds(value, ids, out, seen = new Set()) {
  if (typeof value === "string") { if (ids.has(value)) out.add(value); return; }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    if (ids.has(key)) out.add(key);
    collectIds(item, ids, out, seen);
  }
}

// Conservatively keep a file whenever any surviving business object or draft refers to it.
export function attachmentIsReferenced(state, id) {
  const found = new Set();
  for (const [key, value] of Object.entries(state)) {
    if (key === "attachments") continue;
    if (key === "stage01") {
      const { pendingAttachmentCleanup, ...business } = value || {};
      collectIds(business, new Set([id]), found);
    } else collectIds(value, new Set([id]), found);
    if (found.has(id)) return true;
  }
  return false;
}

// H5 calls this within the same IndexedDB transaction as the session upgrade.
export function cleanupStage01Attachments(state, removeBlob) {
  const pending = state.stage01?.pendingAttachmentCleanup || [];
  for (const item of pending) {
    if (!attachmentIsReferenced(state, item.id)) {
      removeBlob(item.id);
      delete state.attachments[item.id];
    }
  }
  if (state.stage01) state.stage01.pendingAttachmentCleanup = [];
}

function upgradeSixStates(d, state, original, eventStatus) {
  if (!state) throw Error("工单迁移需要完整会话，原数据已保留");
  const removed = (d.workorders || []).filter(w => ["误报终止", "重复关联"].includes(original.get(w._id) || eventStatus.get(w._event) || w.WO06));
  const removedTaskIds = new Set(removed.map(w => w._id));
  const survivors = d.workorders.filter(w => !removedTaskIds.has(w._id));
  const reportIds = new Set(removed.map(w => w._report).filter(Boolean));
  const deletedReports = d.reports.filter(r => reportIds.has(r._id) && !survivors.some(w => w._report === r._id));
  const deletedReportIds = new Set(deletedReports.map(r => r._id));
  const keptReports = d.reports.filter(r => !deletedReportIds.has(r._id));
  const eventIds = new Set([...removed.map(w => w._event), ...deletedReports.map(r => r._event)].filter(Boolean));
  const deletedEvents = d.events.filter(e => eventIds.has(e._id) && !survivors.some(w => w._event === e._id) && !keptReports.some(r => r._event === e._id));
  const deletedEventIds = new Set(deletedEvents.map(e => e._id));
  const deletedIds = new Set([...removedTaskIds, ...deletedReportIds, ...deletedEventIds]);
  const removedDrafts = [];
  for (const [key, draft] of Object.entries(state.drafts || {})) {
    if (key.includes(':stage01:') && key.split(':').some(part => deletedIds.has(part))) {
      removedDrafts.push(draft);
      delete state.drafts[key];
    }
  }
  const candidates = new Set(), knownAttachments = new Set(Object.keys(state.attachments || {}));
  collectIds([removed, deletedReports, deletedEvents, removedDrafts], knownAttachments, candidates);
  d.workorders = survivors;
  d.reports = keptReports;
  d.events = d.events.filter(e => !deletedEventIds.has(e._id));
  for (const [key, operation] of Object.entries(d.operations || {})) {
    if (key.split(':').some(part => deletedIds.has(part)) || deletedIds.has(operation.id) || deletedIds.has(operation.result?.id) || deletedIds.has(operation.result?.workorderId)) delete d.operations[key];
  }
  for (const task of survivors) {
    const before = original.get(task._id) || eventStatus.get(task._event) || task.WO06;
    let next = task.WO06;
    if (["待核实", "待补充", "待重新核实"].includes(before)) next = "待派单";
    else if (before === "待接单") next = task._assignee ? "待处理" : "待派单";
    else if (["待复核", "待销号", "退回整改"].includes(before)) next = task._assignee ? "处理中" : "待派单";
    else if (before === "待居民确认") next = "待确认";
    else if (before === "已销号") next = "已完成";
    else if (before === "已完成" && task._resident && task.UC06 === "已确认解决" && task.VA05 !== "已评价") next = "待评价";
    if (!["待派单", "待处理", "处理中", "待确认", "待评价", "已完成"].includes(next)) throw Error("工单状态无法迁移，原数据已保留：" + before);
    if (task.WO06 !== next) {
      task.history ||= [];
      task.history.push({ HI01: "S1-HI-" + String(++d.sequence).padStart(6, "0"), HI02: "适配工单状态", HI03: "系统", HI04: new Date().toISOString(), HI05: { WO06: before }, HI06: { WO06: next }, HI07: "保留既有业务事实", HI08: "成功", _actor: "system-migration", _public: false });
      task.WO06 = next;
      task._rev = (task._rev || 0) + 1;
    }
    const report = d.reports.find(r => r._id === task._report);
    if (report) report.RP19 = next;
  }
  d.pendingAttachmentCleanup ||= [];
  for (const id of candidates) {
    if (!attachmentIsReferenced(state, id) && !d.pendingAttachmentCleanup.some(item => item.id === id))
      d.pendingAttachmentCleanup.push({ id, path: state.attachments[id]?.path || "" });
  }
  d.schemaVersion = 4;
}
