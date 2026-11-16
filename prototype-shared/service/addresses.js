import {
  resident,
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
export function validateAddress(s, data, contact = true) {
  required(data, [
    ...(contact ? ["联系人姓名", "联系人电话"] : []),
    "省份",
    "城市",
    "区县",
    "所属社区",
    "详细地址",
  ]);
  if (contact) phone(data["联系人电话"]);
  need(
    addressRegions
      .find((p) => p.name === data["省份"])
      ?.cities.find((c) => c.name === data["城市"])
      ?.districts.includes(data["区县"]),
    "请选择有效的省、市、区",
    { 区县: "请重新选择省市区" },
  );
  need(
    s.communities.some(
      (c) => c._id === data["所属社区"] && c["档案状态"] !== "停用",
    ),
    "请选择有效社区",
  );
  if (data["所属小区"])
    need(
      s.estates.some(
        (e) =>
          e._id === data["所属小区"] &&
          e["所属社区"] === data["所属社区"] &&
          e["档案状态"] !== "停用",
      ),
      "小区与社区不匹配",
      { 所属小区: "请重新选择小区" },
    );
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
    "所属社区",
    "所属小区",
    "详细地址",
    "地址补充说明",
    "默认地址",
  ]);
  if (name === "address.save") validateAddress(s, data);
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
