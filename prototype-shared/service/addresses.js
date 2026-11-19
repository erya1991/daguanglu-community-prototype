import { businessDate } from "../r3-product.js";
import {
  resident,
  serviceEstates,
  list,
  need,
  required,
  phone,
  clone,
  revision,
  clock,
  pickInput,
} from "./common.js";

// Local prototype regions. Community coverage remains a separate business check.
export const addressRegions = [
  {
    name: "江苏省",
    cities: [
      { name: "南京市", districts: ["秦淮区", "玄武区", "建邺区", "鼓楼区"] },
      { name: "苏州市", districts: ["姑苏区", "吴中区"] },
    ],
  },
  {
    name: "浙江省",
    cities: [{ name: "杭州市", districts: ["上城区", "西湖区"] }],
  },
];
const regionFields = ["省份", "城市", "区县"];
const addressFields = [...regionFields, "详细地址"];
function validateAddress(data, contact = true) {
  required(data, [...(contact ? ["联系人姓名", "联系人电话"] : []), ...addressFields]);
  if (contact) phone(data["联系人电话"]);
  need(
    addressRegions.find((p) => p.name === data["省份"])?.cities
      .find((c) => c.name === data["城市"])?.districts.includes(data["区县"]),
    "请选择有效的省、市、区",
    { 区县: "请重新选择省市区" },
  );
}
const compact = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, "");
function estateAddressMatches(estate, detail) {
  const address = compact(detail);
  return [estate["小区名称"], estate["小区地址"]]
    .some((value) => value && address.includes(compact(value)));
}
function inAddressRegion(estate, address) {
  // E-A is the prototype's Qinhuai demonstration estate. Other estates may carry their own region.
  const sample = estate._id === "E-A" ? { 省份: "江苏省", 城市: "南京市", 区县: "秦淮区" } : {};
  return regionFields.every((field) => {
    const expected = estate[field] || sample[field];
    return !expected || expected === address[field];
  });
}
export function boundHomes(s, a) {
  resident(a);
  const active = new Set(s.relations.filter(r => r._resident === a.resident && r.关系状态 === "有效" &&
    (!r.有效结束日 || r.有效结束日 >= businessDate())).map(r => r._house));
  return s.houses.filter(h => active.has(h._id) && h.档案状态 !== "停用").flatMap(h => {
    const e = s.estates.find(e => e._id === h.所属小区 && e.档案状态 !== "停用");
    if (!e) return [];
    const region = e._id === "E-A" ? { 省份: "江苏省", 城市: "南京市", 区县: "秦淮区" } : {};
    for (const field of regionFields) if (e[field]) region[field] = e[field];
    return [{ ...region, 绑定房屋: h._id, 所属小区: e._id, 所属社区: e.所属社区,
      所属楼栋: h.所属楼栋, 所属单元: h.所属单元, 所属房屋: h._id,
      详细地址: [e.小区名称, h.完整房屋地址].filter(Boolean).join(" ") }];
  });
}
function boundAddress(s, a, id) {
  const home = boundHomes(s, a).find(h => h.绑定房屋 === id);
  need(home, "房屋绑定已失效或无权使用，请重新选择地址", { 绑定房屋: "请选择本人有效绑定的房屋" });
  return home;
}
export function resolveHomeAddress(s, a, data, combo) {
  const input = data["上门服务地址"] || {};
  const saved = input._id ? addressQuery(s, a, input._id) : null;
  const source = saved || input;
  const home = source.绑定房屋 ? boundAddress(s, a, source.绑定房屋) : null;
  const location = pickInput(home ? { ...source, ...home } : source, [
    ...addressFields, "所属楼栋", "所属单元", "所属房屋", "楼栋", "单元", "门牌房号",
    "地址补充说明", "联系人姓名", "联系人电话",
  ]);
  validateAddress(location, false);
  const allowed = serviceEstates(s, a).filter((estate) =>
    list(combo["上门覆盖小区"]).includes(estate._id) &&
    list(combo["上门覆盖社区"]).includes(estate["所属社区"]) &&
    inAddressRegion(estate, location));
  if (home) {
    need(allowed.some(e => e._id === home.所属小区), "绑定房屋不在本服务覆盖小区");
    return { ...location, 所属小区: home.所属小区, 所属社区: home.所属社区 };
  }
  const matches = s.estates.filter((estate) => estateAddressMatches(estate, location["详细地址"]));
  const candidates = matches.length
    ? allowed.filter((estate) => matches.some((match) => match._id === estate._id))
    : allowed;
  need(candidates.length, "上门地址不在服务覆盖小区，请修改地址");
  const confirmed = data["履约小区"] || (!saved && input["所属小区"]);
  const savedEstate = saved?.["所属小区"];
  const estate = confirmed
    ? candidates.find((candidate) => candidate._id === confirmed)
    : candidates.find((candidate) => candidate._id === savedEstate) ||
      (matches.length && candidates.length === 1 ? candidates[0] : null);
  need(estate, confirmed ? "所选小区与地址或服务覆盖范围不符" : "请选择本单的履约小区",
    { 履约小区: "请确认符合当前地址的履约小区" });
  return { ...location, 所属小区: estate._id, 所属社区: estate["所属社区"] };
}
export function addressQuery(s, a, id) {
  resident(a);
  const rows = (s.residentAddressBook?.items || []).filter(
    (r) => r._resident === a.resident,
  );
  if (id) {
    const r = rows.find((r) => r._id === id);
    need(r, "地址不存在或无权访问");
    return clone(r);
  }
  return clone(rows).sort(
    (a, b) => Number(b["默认地址"]) - Number(a["默认地址"]),
  );
}
export function addressCommand(s, a, name, p) {
  resident(a);
  need(
    ["address.save", "address.delete", "address.default"].includes(name),
    "未知地址操作",
  );
  const book = s.residentAddressBook || { sequence: 0, items: [] };
  const old = p.id ? addressQuery(s, a, p.id) : null;
  if (old) revision(old, p);
  if (name !== "address.save") need(old, "请选择本人地址");
  const data = pickInput(p.data || {}, [
    "联系人姓名",
    "联系人电话",
    "省份",
    "城市",
    "区县",
    "详细地址",
    "地址补充说明",
    "默认地址",
  ]);
  if (name === "address.save") {
    if (typeof data["详细地址"] === "string") data["详细地址"] = data["详细地址"].trim();
    const houseId = p.data?.绑定房屋;
    if (p.data?.地址来源 === "绑定房屋" || houseId) {
      Object.assign(data, boundAddress(s, a, houseId), { 地址来源: "绑定房屋" });
    } else {
      data.地址来源 = "手动输入";
      if (old?.绑定房屋) {
        for (const key of ["绑定房屋", "所属房屋", "所属单元", "所属楼栋", "所属社区", "所属小区"]) delete old[key];
      }
    }
    validateAddress(data);
    if (old && addressFields.some((field) => data[field] !== old[field])) {
      delete old["所属社区"];
      delete old["所属小区"];
    }
  }
  const row = old || {
    _id: "ADDRESS-" + (book.sequence + 1),
    _resident: a.resident,
    _rev: 0,
  };
  if (name === "address.delete")
    book.items = book.items.filter((r) => r._id !== old._id);
  else {
    if (!old) book.sequence++;
    Object.assign(row, name === "address.save" ? data : { 默认地址: true });
    row["默认地址"] = !!row["默认地址"];
    row._rev++;
    row["更新时间"] = clock(s);
    if (row["默认地址"])
      for (const item of book.items) {
        if (
          item._resident === a.resident &&
          item._id !== row._id &&
          item["默认地址"]
        ) {
          item["默认地址"] = false;
          item._rev++;
        }
      }
    book.items = book.items.filter((r) => r._id !== row._id).concat(row);
  }
  s.residentAddressBook = book;
  return {
    id: row._id,
    table: "addresses",
    record: clone(row),
    message: name === "address.delete" ? "地址已删除" : "地址已保存",
  };
}
