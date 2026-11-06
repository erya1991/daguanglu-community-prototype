import { actorFor, inScope, DomainError, clone } from "../core.js";
export { clone, DomainError };
export const now = () => new Date().toISOString();
export const day = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
export const tables = [
  "bills",
  "batches",
  "payments",
  "checks",
  "parkingRelations",
  "products",
  "monthly",
  "temporary",
  "reports",
  "events",
  "workorders",
];
export const need = (ok, message, fields = {}) => {
  if (!ok) throw new DomainError(message, fields);
};
export function domain(s) {
  if (!s.stage01)
    s.stage01 = {
      schemaVersion: 1,
      sequence: 0,
      operations: {},
      scenarios: {},
      config: {
        company: "青禾物业服务有限公司",
        ratings: ["满意", "一般", "不满意"],
        categories: ["设施维修", "环境维护", "公共安全", "其他"],
        risks: ["一般", "较高"],
        pointsEnabled: false,
      },
      ...Object.fromEntries(tables.map((t) => [t, []])),
    };
  need(s.stage01.schemaVersion === 1, "本阶段数据版本不兼容，原数据已保留");
  return s.stage01;
}
export function actor(s, ctx, write = false, finance = false) {
  const a = actorFor(s, ctx);
  need(["property", "resident"].includes(a.role), "当前身份没有本阶段业务权限");
  if (finance)
    need(
      a.role === "property" && ctx.app === "web",
      "该操作仅在物业Web办理，管理端收费只读"
    );
  if (write && a.role === "property")
    need(["web", "staff"].includes(ctx.app), "当前应用不能办理物业业务");
  return a;
}
export const makeId = (s, prefix) =>
  "S1-" + prefix + "-" + String(++domain(s).sequence).padStart(6, "0");
export const find = (s, table, id) =>
  domain(s)[table]?.find((r) => r._id === id);
export function required(data, ids) {
  for (const id of ids)
    need(
      data[id] !== undefined &&
        data[id] !== null &&
        ["string", "number"].includes(typeof data[id]) &&
        String(data[id]).trim() !== "",
      "请填写必填信息",
      { [id]: "此项必填" }
    );
}
export function date(value, id, optional = false) {
  if (optional && !value) return;
  need(
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "请填写有效日期",
    { [id]: "日期无效" }
  );
}
export function fen(value, id = "") {
  need(
    /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(value)),
    "金额须为非负数，最多两位小数",
    { [id]: "请填写精确到分的金额" }
  );
  const [a, b = ""] = String(value).split("."),
    n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  need(Number.isSafeInteger(n), "金额超出可处理范围", { [id]: "金额过大" });
  return n;
}
export const yuan = (n) => (Number(n || 0) / 100).toFixed(2);
export function houseFor(s, a, id, payable = false) {
  const h = s.houses.find((x) => x._id === id);
  need(h && h["档案状态"] !== "停用", "房屋不存在或已停用");
  if (a.role === "resident")
    need(
      s.relations.some(
        (r) =>
          r._resident === a.resident &&
          r._house === id &&
          r["关系状态"] === "有效" &&
          (!r["有效起始日"] || r["有效起始日"] <= day()) &&
          (!r["有效结束日"] || r["有效结束日"] >= day())
      ),
      "当前没有该房屋的有效授权"
    );
  else need(inScope(s, a, h), "房屋不在当前授权范围");
  return h;
}
export function visible(s, a, r, table) {
  if (a.role === "property")
    return inScope(s, a, {
      _community: r._community,
      _estate: r._estate,
      所属组织: r._org,
    });
  if (table === "products")
    return (
      r.MP07 === "启用" &&
      domain(s).parkingRelations.some(
        (x) =>
          x._resident === a.resident && x.PK04 === r.MP03 && x.PK07 === "有效"
      )
    );
  if (table === "bills") {
    try {
      houseFor(s, a, r._house);
      return r.BL19 === "已发布";
    } catch {
      return false;
    }
  }
  return r._resident === a.resident;
}
export function get(s, a, table, id) {
  const r = find(s, table, id);
  need(r && visible(s, a, r, table), "记录不存在或无权访问");
  return r;
}
export function revision(r, p) {
  need(p.revision === r._rev, "记录已更新，请刷新后重新办理");
}
export function history(
  s,
  a,
  r,
  action,
  before = {},
  after = {},
  note = "",
  publicNode = false
) {
  r.history = r.history || [];
  r.history.push({
    HI01: makeId(s, "HI"),
    HI02: action,
    HI03: a.name,
    HI04: now(),
    HI05: clone(before),
    HI06: clone(after),
    HI07: note,
    HI08: "成功",
    _actor: a._id,
    _public: publicNode,
  });
  r._rev = (r._rev || 0) + 1;
}
export function scopeFromHouse(h) {
  return {
    _house: h._id,
    _community: h["所属社区"],
    _estate: h["所属小区"],
    _org: h["所属物业组织"] || "ORG-A",
  };
}
export function attachments(s, a, ids = []) {
  need(Array.isArray(ids), "附件格式错误");
  for (const id of ids) {
    const f = s.attachments[id];
    need(
      f && f.owner === a._id && f.stage01 && f.status !== "失败",
      "请使用本人上传成功的附件"
    );
  }
  return [...ids];
}
export function ownReport(s, a, id) {
  return get(s, a, "reports", id);
}
export function requireProperty(a) {
  need(a.role === "property", "该操作仅由物业管理员办理");
}
export function touch(s) {
  s.revision = (s.revision || 0) + 1;
}
