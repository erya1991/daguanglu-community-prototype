import { actorFor, inScope, clone, DomainError } from "../core.js";
export { clone, DomainError };
export const TABLES = [
  "qualifications",
  "personnel",
  "categories",
  "methods",
  "services",
  "orders",
  "aftersales",
  "evaluations",
  "funds",
  "exceptions",
];
export const list = (v) =>
  Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v];
export const need = (ok, message, fields = {}) => {
  if (!ok) throw new DomainError(message, fields);
};
export const value = (d, ...keys) =>
  keys
    .map((k) => d?.[k])
    .find((v) => v !== undefined && v !== null && v !== "");
export function domain(s) {
  need(s.service?.schemaVersion === 1, "便民服务数据版本不兼容，原数据已保留");
  return s.service;
}
export const clock = (s) => domain(s).clock;
export const day = (s) => clock(s).slice(0, 10);
export const id = (s, prefix) =>
  "S02-" + prefix + "-" + String(++domain(s).sequence).padStart(6, "0");
export const money = (n) => (Number(n || 0) / 100).toFixed(2);
export function fen(v, key = "金额", positive = false) {
  need(
    /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(v ?? "")),
    "金额须为非负数且最多两位小数",
    { [key]: "请填写精确到分的金额" },
  );
  const [a, b = ""] = String(v).split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  need(
    Number.isSafeInteger(n) && (!positive || n > 0),
    positive ? "固定价格须大于0" : "金额超出可处理范围",
    { [key]: "金额无效" },
  );
  return n;
}
export function required(d, keys) {
  for (const k of keys)
    need(
      d[k] !== undefined &&
        d[k] !== null &&
        String(d[k]).trim() !== "" &&
        (!Array.isArray(d[k]) || d[k].length),
      "请填写：" + k,
      { [k]: "此项必填" },
    );
}
export function date(s, v, k, future = false) {
  need(
    /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "请选择有效日期",
    { [k]: "日期无效" },
  );
  if (future)
    need(v >= day(s), "服务日期不能早于当前场景日期", {
      [k]: "请选择今天或之后",
    });
}
export function phone(v, k = "联系人电话") {
  need(
    /^(?:1\d{10}|0\d{2,3}-?\d{7,8})$/.test(String(v || "")),
    "请填写有效联系电话",
    { [k]: "电话号码格式无效" },
  );
}
export function revision(r, p) {
  need(p.revision === r._rev, "记录已更新，请刷新后重新办理");
}
export function actor(s, ctx) {
  const a = actorFor(s, ctx);
  need(
    ["platform", "property", "resident", "merchant"].includes(a.role) &&
      ctx.app !== "staff",
    "当前应用或身份不办理便民服务",
  );
  const d = domain(s);
  const grant = d.grants[a._id];
  if (a.role === "merchant")
    need(d.accountShops[a._id], "该经营账号没有服务店铺授权");
  if (["platform", "property"].includes(a.role))
    need(ctx.app === "web" && grant, "没有便民服务管理授权");
  return {
    ...a,
    app: ctx.app,
    shop: d.accountShops[a._id],
    grant: grant || {},
  };
}
export function admin(a, cap = "manage") {
  need(a.app === "web" && a.grant[cap], "当前账号没有该项Web办理权限");
}
export function merchant(a) {
  need(a.role === "merchant", "该操作由本商户经营账号办理");
}
export function resident(a) {
  need(a.role === "resident", "该操作仅限订单本人在住户端办理");
}
export const find = (s, t, key) => domain(s)[t]?.find((r) => r._id === key);
export const shopFor = (s, a, key) =>
  domain(s).merchants.find(
    (m) => m._id === (a.role === "merchant" ? a.shop : key),
  );
export const shopRecord = (s, key) =>
  domain(s).merchants.find((m) => m._id === key);
export function ownShop(a, r) {
  if (a.role === "merchant")
    need(r._shop === a.shop, "无权操作其他经营主体的数据");
}
export function visible(s, a, t, r) {
  if (["categories", "methods"].includes(t)) return true;
  if (t === "services" && a.role === "resident")
    return !!r.published && r["上架状态"] === "已上架";
  if (a.role === "resident") {
    if (["orders", "aftersales", "evaluations", "funds"].includes(t))
      return (
        r._resident === a.resident &&
        (t !== "funds" || ["支付", "退款"].includes(r["资金类型"]))
      );
    return false;
  }
  if (a.role === "merchant") return r._shop === a.shop;
  if (["platform", "property"].includes(a.role))
    return (
      !r._community ||
      inScope(s, a, { _community: r._community, _estate: r._estate })
    );
  return false;
}
export function get(s, a, t, key) {
  const r = find(s, t, key);
  need(r && visible(s, a, t, r), "记录不存在或无权访问");
  return r;
}
export function append(
  s,
  a,
  r,
  action,
  note = "",
  before = {},
  privateNote = false,
) {
  r.history = r.history || [];
  r.history.push({
    记录编号: id(s, "HI"),
    动作名称: action,
    记录时间: clock(s),
    操作人: a.name,
    操作人业务身份: a.roleName || a.role,
    结果状态: "成功",
    原因说明: note,
    关联凭证: [],
    changes: Object.keys(before).map((k) => ({
      变更字段名称: k,
      变更前值: clone(before[k] ?? null),
      变更后值: clone(r[k] ?? null),
    })),
    _private: privateNote,
  });
  r._rev = (r._rev || 0) + 1;
  r["最近更新时间"] = clock(s);
  domain(s).revision++;
}
export function create(s, a, t, data, prefix) {
  const r = {
    _id: id(s, prefix),
    _rev: 0,
    _shop: a.shop || data._shop,
    _community: "C-A",
    _estate: "E-A",
    创建时间: clock(s),
    history: [],
    ...clone(data),
  };
  domain(s)[t].push(r);
  return r;
}
export function activeAftersale(s, o) {
  return domain(s).aftersales.find(
    (a) =>
      a._order === o._id &&
      !["已解决", "已拒绝", "已撤回"].includes(a["售后状态"]),
  );
}
export function fundsFor(s, o, type) {
  return domain(s).funds.filter(
    (f) => f._order === o._id && (!type || f["资金类型"] === type),
  );
}
export const sum = (rows, key) =>
  rows.reduce((n, r) => n + Number(r[key] || 0), 0);
export const success = (s, o, type) =>
  sum(
    fundsFor(s, o, type).filter((f) => f["资金状态"] === "成功"),
    "_amount",
  );
export const pendingRefund = (s, o) =>
  sum(
    fundsFor(s, o, "退款").filter((f) =>
      ["处理中", "结果未知", "待发起", "受阻"].includes(f["资金状态"]),
    ),
    "_amount",
  );
export const refundable = (s, o) =>
  Math.max(
    0,
    success(s, o, "支付") - success(s, o, "退款") - pendingRefund(s, o),
  );
export function attachmentIds(v) {
  return list(v)
    .map((x) => (typeof x === "string" ? x : x?.id || x?.attachmentId))
    .filter(Boolean);
}
// Only schema attachment paths create bindings. An ID in free text is not a file grant.
function attachmentReferences(s, key) {
  const refs = [];
  const direct = {
    categories: ["类目图标"],
    methods: [],
    services: ["服务主图", "介绍图片"],
    orders: [
      "需求图片",
      "到场图片",
      "过程图片",
      "结果图片",
      "问题图片",
      "异常证据",
    ],
    aftersales: ["问题证据", "核实依据附件", "追加证据", "裁定依据附件"],
    evaluations: ["评价图片", "评价监管证据"],
    funds: ["核查依据", "核查依据附件"],
    exceptions: ["核查依据", "核查依据附件"],
    qualifications: [],
    personnel: [],
  };
  const flags = (field) => ({
    ruling: field === "裁定依据附件",
    funds: ["核查依据", "核查依据附件"].includes(field),
    moderation: field === "评价监管证据",
  });
  for (const table of TABLES)
    for (const record of domain(s)[table] || []) {
      const add = (items, context = {}) => {
        if (attachmentIds(items).includes(key))
          refs.push({ table, record, ...context });
      };
      const materials = (node) => {
        for (const field of [
          "服务资质材料",
          "人员资质材料",
          "authorizationMaterials",
        ])
          for (const m of list(node?.[field]))
            add(m?.["证明文件"], { credential: true });
      };
      const fields = (node, names) => {
        for (const field of names) add(node?.[field], flags(field));
      };
      const history = (node) => {
        for (const h of list(node?.history)) {
          add(h?.["关联凭证"], { internal: !!h?._private });
          for (const change of list(h?.changes)) {
            const field = change?.["变更字段名称"];
            for (const value of [change?.["变更前值"], change?.["变更后值"]]) {
              if ((direct[table] || []).includes(field))
                add(value, { ...flags(field), internal: !!h?._private });
              if (
                [
                  "服务资质材料",
                  "人员资质材料",
                  "authorizationMaterials",
                ].includes(field)
              )
                for (const m of list(value))
                  add(m?.["证明文件"], { credential: true });
            }
          }
        }
      };
      fields(record, direct[table] || []);
      if (
        table === "evaluations" &&
        record["评价展示状态"] === "显示" &&
        attachmentIds(record["评价图片"]).includes(key)
      ) {
        const service = find(s, "services", record._service);
        if (service?.published && service["上架状态"] === "已上架")
          refs.push({ table: "services", record: service });
      }

      history(record);
      if (table === "qualifications" || table === "personnel") {
        materials(record);
        for (const h of list(record["申请历史"])) materials(h);
      }
      if (table === "services")
        for (const content of [
          record.published,
          record.approved,
          record.submitted,
          ...list(record.versions).map((v) => v["内容"]),
        ])
          fields(content, direct.services);
      if (table === "orders") {
        fields(record["服务内容快照"]?.["项目"], direct.services);
        for (const result of list(record.results)) fields(result, ["结果图片"]);
        for (const round of list(record.rounds)) {
          fields(round, ["到场图片"]);
          for (const p of list(round.process)) fields(p, ["过程图片"]);
          for (const r of list(round.results)) fields(r, ["结果图片"]);
        }
        for (const anomaly of list(record.anomalies))
          fields(anomaly, ["异常证据"]);
      }
      if (table === "aftersales") {
        for (const p of list(record.plans)) fields(p, ["核实依据附件"]);
        for (const r of list(record.rulings)) fields(r, ["裁定依据附件"]);
        for (const e of list(record.evidence)) fields(e, ["追加证据"]);
        for (const n of list(record.rulingNotes)) fields(n, ["裁定依据附件"]);
      }
    }
  return refs;
}
export function authorizeAttachment(s, a, key, context = {}) {
  const f = s.attachments[key];
  need(f?.stage02, "服务附件不存在");
  const refs = attachmentReferences(s, key);
  // Classify the real binding, including all prior ruling/certificate snapshots.
  // Caller field names and the upload's visibility cannot downgrade this ACL.
  if (refs.some((r) => r.ruling))
    need(
      a.app === "web" && a.grant.ruling && a.grant.sensitive,
      "内部裁定依据仅授权Web可见",
    );
  if (refs.some((r) => r.funds))
    need(
      a.app === "web" && a.grant.funds && a.grant.sensitive,
      "内部资金核查依据仅授权Web可见",
    );
  if (refs.some((r) => r.moderation))
    need(
      a.app === "web" && a.grant.manage && a.grant.sensitive,
      "评价监管证据仅授权Web可见",
    );
  if (f.visibility === "internal" || refs.some((r) => r.internal))
    need(a.app === "web" && a.grant.sensitive, "内部附件仅授权Web可见");
  const canRead = (ref) =>
    visible(s, a, ref.table, ref.record) &&
    (!ref.credential ||
      (a.role === "merchant" && ref.record._shop === a.shop) ||
      (a.app === "web" && a.grant.sensitive));
  if (refs.some((r) => r.credential))
    need(
      refs.some((r) => r.credential && canRead(r)),
      "无权读取资格或人员证明",
    );
  if (context.table && context.id) {
    const r = get(s, a, context.table, context.id);
    const bound = refs.filter(
      (ref) => ref.table === context.table && ref.record._id === r._id,
    );
    need(bound.length, "附件不属于当前业务对象");
    need(bound.some(canRead), "无权读取该业务附件");
  } else if (refs.length) {
    need(refs.some(canRead), "无权读取已绑定的业务附件");
  } else need(f.owner === a._id, "无权预览他人未绑定附件");
  return key;
}
export function evidence(s, a, v, order = null) {
  return list(v).map((item, i) => {
    const key =
        typeof item === "string" ? item : item?.id || item?.attachmentId,
      f = s.attachments[key];
    need(
      f &&
        f.stage02 &&
        f.status === "成功" &&
        (f.owner === a._id ||
          (order &&
            attachmentReferences(s, key).some(
              (ref) =>
                ref.table === "orders" &&
                ref.record._id === order._id &&
                visible(s, a, "orders", ref.record),
            ))),
      "请使用本人上传成功的服务附件",
    );
    authorizeAttachment(s, a, key);
    return {
      id: key,
      name: f.name,
      type: f.type,
      size: f.size,
      status: f.status || "成功",
      uploader: f.uploader || a.name,
      uploadedAt: f.uploadedAt || clock(s),
      description:
        typeof item === "object"
          ? String(item.description || item["图片说明"] || "")
          : String(f.description || ""),
      order:
        typeof item === "object"
          ? Number(item.order ?? item["显示顺序"] ?? i + 1)
          : i + 1,
    };
  });
}
export function auditEvidence(s, a, d, keys, order = null) {
  for (const k of keys)
    if (d[k] !== undefined) d[k] = evidence(s, a, d[k], order);
}
const materialKeys = [
  "材料名称",
  "对应服务类目",
  "证明编号",
  "发证机构",
  "生效日期",
  "长期有效",
  "有效截止日期",
];
function materialFacts(m) {
  return JSON.stringify({
    ...Object.fromEntries(materialKeys.map((k) => [k, m[k] ?? null])),
    证明文件: attachmentIds(m["证明文件"]),
  });
}
export function materialPresent(s, m) {
  if (m["有效截止日期"] && m["有效截止日期"] < day(s)) return false;
  if (m["生效日期"] && m["生效日期"] > day(s)) return false;
  return attachmentIds(m["证明文件"]).some(
    (key) =>
      s.attachments[key]?.stage02 && s.attachments[key]?.status === "成功",
  );
}
export function materialValid(s, m) {
  return m["核验结论"] === "认可" && materialPresent(s, m);
}
export function materialState(s, m) {
  if (m["核验结论"] !== "认可") return "待核实";
  return materialPresent(s, m) ? "有效" : "已失效";
}
export function materials(s, a, input, shop, allowedCategories) {
  const originals = [
    ...domain(s)
      .qualifications.filter((r) => r._shop === shop)
      .flatMap((r) => [
        ...list(r["服务资质材料"]),
        ...list(r.authorizationMaterials),
      ]),
    ...domain(s)
      .personnel.filter((r) => r._shop === shop)
      .flatMap((r) => list(r["人员资质材料"])),
  ];
  return list(input).map((item) => {
    required(item, ["材料名称"]);
    const m = Object.fromEntries(
      materialKeys
        .filter((k) => item[k] !== undefined)
        .map((k) => [k, clone(item[k])]),
    );
    m["对应服务类目"] = list(m["对应服务类目"]);
    need(
      m["对应服务类目"].every((c) => list(allowedCategories).includes(c)),
      "材料类目不得超出申请或人员范围",
    );
    if (m["生效日期"]) date(s, m["生效日期"], "生效日期");
    if (m["有效截止日期"]) date(s, m["有效截止日期"], "有效截止日期");
    need(!m["长期有效"] || !m["有效截止日期"], "长期有效材料不填写截止日期");
    need(
      !m["生效日期"] ||
        !m["有效截止日期"] ||
        m["生效日期"] <= m["有效截止日期"],
      "生效日期不得晚于截止日期",
    );
    const previous = originals.find(
      (x) => materialFacts(x) === materialFacts(item),
    );
    // Only unchanged same-subject certificate facts may retain their verified state.
    // New or replaced material awaits the authorized Web review.
    m["证明文件"] = previous
      ? clone(previous["证明文件"])
      : evidence(s, a, item["证明文件"]);
    m["核验结论"] = previous?.["核验结论"] || "待核实";
    m["核验意见"] = previous?.["核验意见"] || "";
    m["材料有效性"] = materialState(s, m);
    return m;
  });
}
export function catEnabled(s, key) {
  let c = find(s, "categories", key),
    seen = new Set();
  if (!c) return false;
  while (c) {
    if (c["类目状态"] !== "启用" || seen.has(c._id)) return false;
    seen.add(c._id);
    c = find(s, "categories", c["上级类目"]);
  }
  return true;
}
export function qualificationFor(s, shop) {
  return domain(s).qualifications.find((q) => q._shop === shop);
}
export function qualified(s, shop, cat) {
  const q = qualificationFor(s, shop),
    c = find(s, "categories", cat);
  return (
    !!q &&
    q["服务经营有效性"] === "有效" &&
    q["协议状态"] === "有效" &&
    list(q["获准服务类目"]).includes(cat) &&
    catEnabled(s, cat) &&
    (!c?.["商户证明是否必需"] ||
      list(q.authorizationMaterials || q["服务资质材料"]).some(
        (m) => list(m["对应服务类目"]).includes(cat) && materialValid(s, m),
      ))
  );
}
export function staffEligible(s, p, shop, cat) {
  const c = find(s, "categories", cat);
  return (
    p &&
    p._shop === shop &&
    p["人员状态"] === "启用" &&
    list(p["可执行服务类目"]).includes(cat) &&
    (!c?.["人员证明是否必需"] ||
      list(p["人员资质材料"]).some(
        (m) => list(m["对应服务类目"]).includes(cat) && materialValid(s, m),
      ))
  );
}
export function allocations(amount, version = "DEMO-ALLOC-V1") {
  const q = Math.floor(amount / 99),
    r = amount % 99,
    m = q * 89 + Math.floor((r * 89 + 49) / 99);
  return {
    version,
    merchant: m,
    property: amount - m,
    amount,
  };
}
export function maskPhone(v) {
  return typeof v === "string"
    ? v.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
    : v;
}

export function pickInput(data, fields) {
  return Object.fromEntries(
    fields
      .filter((k) => data?.[k] !== undefined)
      .map((k) => [k, clone(data[k])]),
  );
}
