import { domain, need, now, day } from "./common.js";
// Extra master fixtures are explicit and confined to a new stage01-* session.
export function prepare(s, session) {
  const d = domain(s);
  if (d.prepared && !s.accounts.some((a) => a._id === "property-colleague")) {
    const fixture = s.accounts.find(
      (a) =>
        a["登录账号"] === "property-colleague" && a._id === "property-admin"
    );
    if (fixture) fixture._id = "property-colleague";
  }
  if (d.prepared || !String(session).startsWith("stage01-")) return d;
  need(!d.bills.length && !d.reports.length, "已有业务不会被样例初始化覆盖");
  const add = (table, id, values) => {
    if (!s[table].some((r) => r._id === id))
      s[table].push({ ...values, _id: id, _rev: 1 });
  };
  add("estates", "E-S01", {
    小区编号: "E-S01",
    小区名称: "澄园小区",
    所属社区: "C-A",
    所属物业组织: "ORG-A",
    小区地址: "澄园路18号",
    档案状态: "启用",
  });
  add("buildings", "B-S01", {
    楼栋编号: "B-S01",
    "楼栋名称／楼栋号": "1幢",
    所属社区: "C-A",
    所属小区: "E-S01",
    是否有单元: "否",
    档案状态: "启用",
  });
  add("houses", "H-S01", {
    房屋编号: "H-S01",
    所属社区: "C-A",
    所属小区: "E-S01",
    所属楼栋: "B-S01",
    所属单元: "",
    房号: "0101",
    完整房屋地址: "澄园路18号 1幢 0101室",
    房屋用途: "住宅",
    档案状态: "启用",
  });
  const pa = s.accounts.find((a) => a._id === "property-admin");
  if (!pa["可查看小区"].includes("E-S01")) pa["可查看小区"].push("E-S01");
  add("accounts", "property-colleague", {
    ...pa,
    登录账号: "property-colleague",
    人员姓名: "陈晓",
    授权角色: ["property"],
    _apps: ["web", "staff"],
  });
  for (const [id, acc, name] of [
    ["P-S01", "property-admin", "物业管理员"],
    ["P-S02", "property-colleague", "陈晓"],
  ])
    add("personnel", id, {
      人员编号: id,
      人员姓名: name,
      所属物业组织: "ORG-A",
      关联账号: acc,
      在岗状态: "在岗",
      工作联系电话: "025-00000001",
    });
  const r = s.residents.find((r) => r._id === "R-B"),
    account = s.accounts.find((a) => a._id === "resident-b");
  r["居民姓名"] = "周明";
  account["人员姓名"] = "周明";
  s.relations
    .filter((x) => x._resident === "R-B")
    .forEach((x) => {
      x["居民姓名"] = "周明";
    });
  s.vehicles.find((v) => v._id === "V-B")["车牌号码"] = "苏A8K268";
  d.prepared = true;
  d.preparedAt = now();
  d.createdDay = day();
  return d;
}
