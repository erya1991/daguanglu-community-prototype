import {
  domain,
  list,
  need,
  value,
  required,
  phone,
  fen,
  actor,
  admin,
  merchant,
  find,
  get,
  revision,
  create,
  append,
  clone,
  clock,
  day,
  qualified,
  catEnabled,
  qualificationFor,
  materialValid,
  materialPresent,
  materialState,
  materials,
  shopFor,
  shopRecord,
  auditEvidence,
} from "./common.js";
const pick = (d, keys) =>
  Object.fromEntries(
    keys.filter((k) => d[k] !== undefined).map((k) => [k, clone(d[k])]),
  );
const serviceKeys = [
  "服务名称",
  "所属服务类目",
  "服务主图",
  "介绍图片",
  "服务简介",
  "服务详细说明",
  "适用对象说明",
  "预约须知",
  "公开服务电话",
  "服务规格集合",
];
export function normalizeSpecs(s, d, old = []) {
  const source = d["服务规格集合"];
  const specs =
    source !== undefined
      ? list(source)
      : d["规格名称"] || d["组合固定价格"]
        ? [
            {
              ...pick(d, [
                "规格编号",
                "规格名称",
                "规格说明",
                "包含内容",
                "不包含内容",
                "预计服务时长",
                "服务对象填写要求",
                "服务对象填写提示",
                "规格启用状态",
              ]),
              组合集合: list(d["组合集合"]).length
                ? d["组合集合"]
                : [
                    pick(d, [
                      "组合履约方式名称",
                      "组合流程模板",
                      "组合固定价格",
                      "上门覆盖社区",
                      "上门覆盖小区",
                      "可服务门店或服务点",
                      "完成证据要求",
                      "组合启用状态",
                    ]),
                  ],
            },
          ]
        : clone(old);
  return specs.map((raw, i) => {
    const x = clone(raw);
    x["规格编号"] =
      x["规格编号"] || "SPEC-" + domain(s).sequence + "-" + (i + 1);
    x["规格名称"] = x["规格名称"] || d["规格名称"] || "标准服务";
    x["规格启用状态"] = x["规格启用状态"] || "启用";
    x["组合集合"] = list(
      x["组合集合"] || x["方式报价"] || x["规格方式组合"],
    ).map((c) => {
      const mode = value(c, "组合履约方式名称", "履约方式名称") || "上门",
        m = domain(s).methods.find(
          (m) => m._id === mode || m["履约方式名称"] === mode,
        );
      return {
        ...c,
        组合履约方式名称: m?.["履约方式名称"] || mode,
        组合流程模板: m?.["绑定流程模板"] || c["组合流程模板"] || mode,
        _method: m?._id,
        组合计价方式: "固定规格价",
        组合启用状态: c["组合启用状态"] || "启用",
        上门覆盖社区: list(c["上门覆盖社区"]),
        上门覆盖小区: list(c["上门覆盖小区"]),
        可服务门店或服务点: list(c["可服务门店或服务点"]),
        完成证据要求: c["完成证据要求"] || "可选图片",
      };
    });
    x["允许履约方式"] = x["组合集合"].map((c) => c["组合履约方式名称"]);
    return x;
  });
}
export function comboFor(s, service, specId, mode, publicOnly = true) {
  const content = publicOnly ? service.published : service;
  const spec =
    list(content?.["服务规格集合"]).find((x) => x["规格编号"] === specId) ||
    (!specId ? list(content?.["服务规格集合"])[0] : null);
  need(spec && spec["规格启用状态"] !== "停用", "请选择有效服务规格");
  const combo = list(spec["组合集合"]).find(
    (c) =>
      c["组合履约方式名称"] === mode ||
      c["组合流程模板"] === mode ||
      c._method === mode,
  );
  need(combo, "请选择该规格支持的履约方式");
  return { spec, combo, content };
}
export function saleability(s, r) {
  const reasons = [];
  if (!r.published || r["审核状态"] === "未通过")
    reasons.push("尚无审核通过发布版本");
  if (r["上架状态"] !== "已上架") reasons.push("服务未上架");
  if (r["平台限制原因"]) reasons.push(r["平台限制原因"]);
  if (r["接收新预约状态"] === "暂停") reasons.push("商户暂停接收新预约");
  const cat = r.published?.["所属服务类目"] || r["所属服务类目"];
  if (!qualified(s, r._shop, cat)) reasons.push("服务经营资格或类目当前不满足");
  const valid = list(r.published?.["服务规格集合"]).some(
    (x) =>
      x["规格启用状态"] !== "停用" &&
      list(x["组合集合"]).some((c) => comboValid(s, c, cat)),
  );
  if (!valid) reasons.push("没有有效规格、方式价格或地点");
  return reasons;
}
export function comboValid(s, c, category) {
  const m = domain(s).methods.find(
    (m) => m._id === c._method || m["履约方式名称"] === c["组合履约方式名称"],
  );
  if (!m || m["方式状态"] !== "启用" || c["组合启用状态"] === "停用")
    return false;
  if (category) {
    const config = find(s, "categories", category);
    if (
      !config ||
      !list(config["允许履约方式"]).some((way) =>
        [m._id, m["履约方式名称"], m["绑定流程模板"]].includes(way),
      )
    )
      return false;
  }
  try {
    fen(c["组合固定价格"], "组合固定价格", true);
  } catch {
    return false;
  }
  return c["组合流程模板"] === "上门"
    ? list(c["上门覆盖社区"]).length > 0 && list(c["上门覆盖小区"]).length > 0
    : list(c["可服务门店或服务点"]).some((p) => p["地点状态"] === "启用");
}
export function validateSupply(s, r) {
  required(r, [
    "服务名称",
    "所属服务类目",
    "服务主图",
    "服务简介",
    "服务详细说明",
    "公开服务电话",
  ]);
  phone(r["公开服务电话"], "公开服务电话");
  need(qualified(s, r._shop, r["所属服务类目"]), "经营资格或类目当前不满足");
  need(list(r["服务规格集合"]).length, "请至少配置一个服务规格");
  for (const x of r["服务规格集合"]) {
    required(x, ["规格名称", "规格说明", "包含内容"]);
    need(["启用", "停用"].includes(x["规格启用状态"]), "规格启用状态无效");
    if (
      x["预计服务时长"] !== undefined &&
      x["预计服务时长"] !== null &&
      x["预计服务时长"] !== ""
    )
      need(
        Number.isFinite(Number(x["预计服务时长"])) &&
          Number(x["预计服务时长"]) > 0,
        "预计服务时长须为正数分钟或留空",
      );
    if (x["服务对象填写要求"])
      need(
        ["选填", "必填"].includes(x["服务对象填写要求"]),
        "服务对象填写要求无效",
      );
    for (const combo of x["组合集合"] || [])
      need(
        ["可选图片", "必需图片"].includes(combo["完成证据要求"]),
        "完成证据要求无效",
      );
    need(list(x["组合集合"]).length, "每个规格至少配置一个方式报价");
    for (const c of x["组合集合"])
      need(
        comboValid(s, c, r["所属服务类目"]),
        "请完善固定价格、类目允许的启用方式及对应范围或地点",
      );
  }
}
export function supplyCommand(s, a, name, p) {
  const d = clone(p.data || {}),
    kind = name.split(".")[0],
    action = name.split(".")[1];
  let r;
  if (kind === "qualification") {
    r = p.id ? get(s, a, "qualifications", p.id) : qualificationFor(s, a.shop);
    need(r, "未找到当前经营资格");
    if (action === "review" || action === "status") admin(a, "review");
    else {
      merchant(a);
      need(r._shop === a.shop, "无权操作该经营主体");
    }
    revision(r, p);
    if (action === "save") {
      if (!r.authorizationMaterials)
        r.authorizationMaterials = clone(r["服务资质材料"] || []);
      need(
        ["草稿", "已退回", "已撤回", "已通过"].includes(r["申请状态"]),
        "申请审核中，不可修改",
      );
      Object.assign(
        r,
        pick(d, ["申请服务类目", "申请覆盖社区", "申请覆盖小区", "申请说明"]),
      );
      if (d["服务资质材料"] !== undefined)
        r["服务资质材料"] = materials(
          s,
          a,
          d["服务资质材料"],
          r._shop,
          r["申请服务类目"],
        );
      r["申请状态"] = "草稿";
    } else if (action === "submit") {
      need(
        ["草稿", "已退回", "已撤回"].includes(r["申请状态"]),
        "当前申请不可提交",
      );
      required(r, ["申请服务类目", "申请覆盖社区"]);
      for (const cat of list(r["申请服务类目"])) {
        const c = find(s, "categories", cat);
        need(c && catEnabled(s, cat), "申请类目未启用");
        if (c["商户证明是否必需"])
          need(
            list(r["服务资质材料"]).some(
              (m) =>
                list(m["对应服务类目"]).includes(cat) && materialPresent(s, m),
            ),
            "请补齐该类目的商户证明材料",
          );
      }
      r["申请版本"] = (r["申请版本"] || 0) + 1;
      r["审核轮次"] = (r["审核轮次"] || 0) + 1;
      r["申请状态"] = "待审核";
      r["提交人"] = a.name;
      r["提交时间"] = clock(s);
      r["申请历史"] = [
        ...(r["申请历史"] || []),
        clone(
          pick(r, [
            "申请版本",
            "申请服务类目",
            "申请覆盖社区",
            "申请覆盖小区",
            "服务资质材料",
            "提交人",
            "提交时间",
          ]),
        ),
      ];
    } else if (action === "review") {
      need(r["申请状态"] === "待审核", "当前申请不是待审核");
      required(d, ["审核结果"]);
      const pass = d["审核结果"] === "通过";
      if (!pass) required(d, ["审核意见"]);
      r["审核结果"] = pass ? "通过" : "退回修改";
      r["审核意见"] = d["审核意见"] || "";
      r["审核人"] = a.name;
      r["审核时间"] = clock(s);
      r["最近审核时间"] = clock(s);
      r["申请状态"] = pass ? "已通过" : "已退回";
      if (pass) {
        const cats = list(value(d, "批准服务类目") || r["申请服务类目"]),
          communities = list(value(d, "批准覆盖社区") || r["申请覆盖社区"]),
          estates = list(value(d, "批准覆盖小区") || r["申请覆盖小区"]);
        need(
          cats.length && communities.length,
          "批准服务类目和覆盖社区不能为空",
        );
        for (const [requested, approved] of [
          [r["申请服务类目"], cats],
          [r["申请覆盖社区"], communities],
          [r["申请覆盖小区"], estates],
        ])
          need(
            approved.every((x) => list(requested).includes(x)),
            "批准范围不得超过申请范围",
          );
        if (
          cats.length !== list(r["申请服务类目"]).length ||
          communities.length !== list(r["申请覆盖社区"]).length ||
          estates.length !== list(r["申请覆盖小区"]).length
        )
          required(d, ["审核意见"]);
        for (const cat of cats) {
          const config = find(s, "categories", cat);
          need(
            catEnabled(s, cat) &&
              !domain(s).categories.some((c) => c["上级类目"] === cat),
            "只可批准当前启用末级类目",
          );
          if (config["商户证明是否必需"])
            need(
              list(r["服务资质材料"]).some(
                (m) =>
                  list(m["对应服务类目"]).includes(cat) &&
                  materialPresent(s, m),
              ),
              "批准前请重新核验对应商户证明",
            );
        }
        if (list(r["服务资质材料"]).length) admin(a, "sensitive");
        for (const m of list(r["服务资质材料"])) {
          m["核验结论"] = "认可";
          m["核验意见"] = d["核验意见"] || d["审核意见"] || "审核通过";
          m["材料有效性"] = materialState(s, m);
        }
        r.authorizationMaterials = clone(r["服务资质材料"] || []);
        r["获准服务类目"] = cats;
        r["获准社区"] = communities;
        r["获准小区"] = estates;
        r["服务经营有效性"] = "有效";
        r["新增交易资格"] = "可交易";
        r["资格限制原因"] = [];
        r["当前授权生效时间"] = clock(s);
      }
    } else if (action === "status") {
      required(d, [value(d, "暂停或恢复原因") ? "暂停或恢复原因" : "原因说明"]);
      const status = value(d, "状态", "服务经营有效性");
      if (!["暂停", "受限"].includes(status)) {
        need(
          r["协议状态"] === "有效" && r["商户状态"] === "正常",
          "协议或主体状态仍受限，不能恢复交易资格",
        );
        for (const cat of list(r["获准服务类目"])) {
          const config = find(s, "categories", cat);
          need(catEnabled(s, cat), "授权类目仍停用，不能恢复资格");
          if (config?.["商户证明是否必需"])
            need(
              list(r.authorizationMaterials || r["服务资质材料"]).some(
                (m) =>
                  list(m["对应服务类目"]).includes(cat) && materialValid(s, m),
              ),
              "必要资质仍缺失或失效，不能恢复资格",
            );
        }
      }
      r["服务经营有效性"] = ["暂停", "受限"].includes(status) ? "受限" : "有效";
      r["新增交易资格"] =
        r["服务经营有效性"] === "有效" ? "可交易" : "不可交易";
      r["资格限制原因"] =
        r["服务经营有效性"] === "受限"
          ? [value(d, "暂停或恢复原因", "原因说明")]
          : [];
    } else need(false, "不支持的资格动作");
    append(
      s,
      a,
      r,
      name,
      value(d, "审核意见", "暂停或恢复原因", "原因说明") || "",
    );
    return { table: "qualifications", r };
  }
  if (kind === "personnel") {
    if (action === "review") {
      admin(a, "review");
      admin(a, "sensitive");
    } else merchant(a);
    r = p.id ? get(s, a, "personnel", p.id) : null;
    if (r) revision(r, p);
    if (action === "save") {
      required(d, ["姓名", "工作联系电话", "可执行服务类目"]);
      phone(d["工作联系电话"], "工作联系电话");
      const q = qualificationFor(s, a.shop);
      need(
        list(d["可执行服务类目"]).every((c) =>
          list(q["获准服务类目"]).includes(c),
        ),
        "人员类目超出当前商户获准范围",
      );
      if (!r)
        r = create(
          s,
          a,
          "personnel",
          {
            人员状态: "启用",
            服务人员编号: "",
            所属商户名称: shopFor(s, a)["商户名称"],
          },
          "PERSON",
        );
      Object.assign(
        r,
        pick(d, [
          "姓名",
          "工作联系电话",
          "关联工作人员账号",
          "可执行服务类目",
          "技能说明",
          "内部备注",
        ]),
      );
      if (d["人员资质材料"] !== undefined)
        r["人员资质材料"] = materials(
          s,
          a,
          d["人员资质材料"],
          r._shop,
          r["可执行服务类目"],
        );
      r["服务人员编号"] = r._id;
    } else if (action === "review") {
      need(r && list(r["人员资质材料"]).length, "没有待核验的人员材料");
      need(
        ["认可", "不认可"].includes(d["核验结论"]),
        "请选择人员材料核验结论",
      );
      if (d["核验结论"] === "不认可") required(d, ["核验意见"]);
      for (const m of list(r["人员资质材料"])) {
        need(
          materialPresent(s, m) || d["核验结论"] === "不认可",
          "材料缺失或未在有效期内，不可认可",
        );
        m["核验结论"] = d["核验结论"];
        m["核验意见"] = d["核验意见"] || "核验认可";
        m["材料有效性"] = materialState(s, m);
      }
    } else if (action === "status") {
      need(r, "人员不存在");
      required(d, [value(d, "启停原因") ? "启停原因" : "原因说明"]);
      r["人员状态"] = value(d, "状态", "人员状态");
      need(["启用", "停用"].includes(r["人员状态"]), "人员状态无效");
      r["启停原因"] = value(d, "启停原因", "原因说明");
    } else need(false, "不支持的人员动作");
    const proofs = list(r["人员资质材料"]);
    r["资质有效性"] = proofs.length
      ? proofs.every((m) => materialValid(s, m))
        ? "有效"
        : proofs.some((m) => materialState(s, m) === "已失效")
          ? "已失效"
          : "待核实"
      : "无专项要求";
    append(s, a, r, name, d["启停原因"] || d["核验意见"] || "");
    return { table: "personnel", r };
  }
  if (kind === "category" || kind === "method") {
    admin(a, "config");
    const t = kind === "category" ? "categories" : "methods";
    r = p.id ? get(s, a, t, p.id) : null;
    if (r) revision(r, p);
    if (action === "save") {
      if (kind === "category") {
        required(d, ["类目名称"]);
        if (d["上级类目"])
          need(
            d["上级类目"] !== p.id && find(s, "categories", d["上级类目"]),
            "上级类目无效",
          );
        let parent = find(s, "categories", d["上级类目"]),
          seen = new Set();
        while (parent) {
          need(
            parent._id !== p.id && !seen.has(parent._id),
            "类目父子关系不能形成循环",
          );
          seen.add(parent._id);
          parent = find(s, "categories", parent["上级类目"]);
        }
        if (!r) r = create(s, a, t, { 类目状态: "启用", 类目排序: 0 }, "CAT");
        Object.assign(
          r,
          pick(d, [
            "类目名称",
            "上级类目",
            "类目图标",
            "类目说明",
            "商户证明是否必需",
            "商户资质要求说明",
            "人员证明是否必需",
            "人员资质要求说明",
            "允许履约方式",
            "类目排序",
          ]),
        );
        r["类目编号"] = r._id;
        if (d["类目图标"] !== undefined) auditEvidence(s, a, r, ["类目图标"]);
        r["商户证明是否必需"] = [true, "是", "必需"].includes(
          r["商户证明是否必需"],
        );
        r["人员证明是否必需"] = [true, "是", "必需"].includes(
          r["人员证明是否必需"],
        );
      } else {
        required(d, ["履约方式名称", "绑定流程模板"]);
        need(
          ["上门", "预约到点"].includes(d["绑定流程模板"]),
          "只支持上门和预约到点两个流程模板",
        );
        if (r)
          need(
            r["绑定流程模板"] === d["绑定流程模板"],
            "既有方式不可更换绑定流程模板，请新增方式",
          );
        if (!r)
          r = create(s, a, t, { 方式状态: "启用", 方式版本: 0 }, "METHOD");
        Object.assign(
          r,
          pick(d, ["履约方式名称", "履约方式说明", "绑定流程模板"]),
        );
        r["履约方式编号"] = r._id;
        r["方式版本"]++;
      }
    } else if (action === "status") {
      need(r, "配置不存在");
      required(d, [value(d, "配置变更原因") ? "配置变更原因" : "原因说明"]);
      const status = value(
        d,
        "状态",
        kind === "category" ? "类目状态" : "方式状态",
      );
      need(["启用", "停用"].includes(status), "配置状态无效");
      r[kind === "category" ? "类目状态" : "方式状态"] = status;
    } else need(false, "不支持的配置动作");
    append(s, a, r, name, value(d, "配置变更原因", "原因说明") || "");
    return { table: t, r };
  }
  if (kind === "service") {
    r = p.id ? get(s, a, "services", p.id) : null;
    if (action === "review") admin(a, "review");
    else if (
      action === "status" &&
      (["平台限制", "解除限制", "推荐", "取消推荐"].includes(d["状态"]) ||
        (a.app === "web" && d["状态"] === "已下架"))
    )
      admin(a, "manage");
    else merchant(a);
    if (r) revision(r, p);
    if (action === "save") {
      required(d, ["服务名称", "所属服务类目"]);
      if (r) need(r["审核状态"] !== "待审核", "送审中不可修改，请等待审核结果");
      if (!r)
        r = create(
          s,
          a,
          "services",
          {
            服务编号: "",
            当前编辑版本: 0,
            当前发布版本: 0,
            审核状态: "草稿",
            上架状态: "未上架",
            接收新预约状态: "接收中",
            平台限制原因: "",
            versions: [],
          },
          "SUPPLY",
        );
      const m = shopRecord(s, r._shop);
      Object.assign(r, pick(d, serviceKeys));
      r["经营主体名称"] = m["商户名称"];
      r["经营店铺名称"] = m["经营店铺名称"];
      r["服务编号"] = r._id;
      r["服务规格集合"] = normalizeSpecs(s, d, r["服务规格集合"]);
      r["当前编辑版本"] = (r["当前编辑版本"] || 0) + 1;
      r["审核状态"] = "草稿";
      r["当前展示价"] =
        r["服务规格集合"][0]?.["组合集合"]?.[0]?.["组合固定价格"] || "";
      auditEvidence(s, a, r, ["服务主图", "介绍图片"]);
    } else if (action === "submit") {
      need(
        r && ["草稿", "退回", "通过"].includes(r["审核状态"]),
        "当前版本不可提交审核",
      );
      validateSupply(s, r);
      r.submitted = clone(
        Object.fromEntries(serviceKeys.map((k) => [k, r[k]])),
      );
      r["送审版本"] = r["当前编辑版本"];
      r["审核状态"] = "待审核";
      r["提交时间"] = clock(s);
    } else if (action === "review") {
      need(r["审核状态"] === "待审核", "当前没有待审核版本");
      validateSupply(s, { ...r, ...r.submitted });
      required(d, ["审核结果"]);
      const pass = d["审核结果"] === "通过";
      if (!pass) required(d, ["审核意见"]);
      r["审核状态"] = pass ? "通过" : "退回";
      r["审核结果"] = pass ? "通过" : "退回";
      r["审核意见"] = d["审核意见"] || "";
      r["审核人"] = a.name;
      r["审核时间"] = clock(s);
      if (pass) r.approved = clone(r.submitted);
      r.versions.push({
        版本: r["送审版本"],
        内容: clone(r.submitted),
        审核结果: r["审核结果"],
        审核意见: r["审核意见"],
        审核人: a.name,
        审核时间: clock(s),
      });
    } else if (action === "publish") {
      need(r["审核状态"] === "通过" && r.approved, "新版本尚未审核通过");
      validateSupply(s, { ...r, ...r.approved });
      r.published = clone(r.approved);
      r["当前发布版本"] = r["当前编辑版本"];
      r["上架状态"] = "已上架";
    } else if (action === "status") {
      const status = d["状态"];
      if (status === "已上架") {
        if (!r.published) {
          need(r.approved, "请先审核通过");
          r.published = clone(r.approved);
          r["当前发布版本"] = r["当前编辑版本"];
        }
        validateSupply(s, { ...r, ...r.published });
        need(!r["平台限制原因"], "存在平台限制");
        r["上架状态"] = "已上架";
      } else if (status === "已下架") {
        required(d, [
          value(d, "上架或下架原因") ? "上架或下架原因" : "原因说明",
        ]);
        r["上架状态"] = "已下架";
      } else if (status === "暂停接单") {
        required(d, [value(d, "暂停原因") ? "暂停原因" : "原因说明"]);
        r["接收新预约状态"] = "暂停";
        r["暂停原因"] = value(d, "暂停原因", "原因说明");
      } else if (status === "恢复接单") {
        need(
          qualified(s, r._shop, r["所属服务类目"]),
          "经营资格不满足恢复条件",
        );
        r["接收新预约状态"] = "接收中";
      } else if (status === "平台限制") {
        required(d, ["原因说明"]);
        r["平台限制原因"] = d["原因说明"];
      } else if (status === "解除限制") {
        required(d, ["原因说明"]);
        r["平台限制原因"] = "";
      } else if (["推荐", "取消推荐"].includes(status)) {
        r["推荐展示状态"] = status === "推荐" ? "推荐" : "不推荐";
        r["推荐顺序"] = Number(d["推荐顺序"] || 0);
      } else need(false, "不支持的服务状态动作");
    } else need(false, "不支持的供给动作");
    append(
      s,
      a,
      r,
      name,
      value(d, "审核意见", "原因说明", "暂停原因", "上架或下架原因") || "",
    );
    return { table: "services", r };
  }
  return null;
}
