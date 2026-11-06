import {
  domain,
  actor,
  need,
  required,
  get,
  revision,
  makeId,
  history,
  fen,
  date,
  now,
  day,
  visible,
  clone,
} from "./common.js";
export function relationFor(s, a, id) {
  const r = get(s, a, "parkingRelations", id),
    v = s.vehicles.find((x) => x._id === r.PK02);
  need(
    r.PK07 === "有效" && v && v["核实状态"] === "已确认",
    "停车关系或车辆当前不可办理"
  );
  if (a.role === "resident") need(v._resident === a.resident, "车辆授权已失效");
  return r;
}
export function parkingCommand(s, ctx, command, p) {
  const d = domain(s),
    a = actor(s, ctx, true, !["createMonthly"].includes(command));
  if (command === "saveParkingRelation") {
    required(p.data, ["PK02", "PK04", "PK05", "PK08", "PK09"]);
    const v = s.vehicles.find((v) => v._id === p.data.PK02),
      h = s.houses.find((h) => h._id === v?.["关联房屋"]);
    need(
      v &&
        v["核实状态"] === "已确认" &&
        h &&
        a["可查看小区"].includes(h["所属小区"]),
      "请选择授权内已核验车辆"
    );
    const old = p.id ? get(s, a, "parkingRelations", p.id) : null;
    if (old) {
      revision(old, p);
      const referenced =
        d.monthly.some((x) => x._relation === old._id) ||
        d.temporary.some((x) => x.TB03 === old._id);
      need(
        !referenced || (old.PK02 === p.data.PK02 && old.PK04 === p.data.PK04),
        "该关系已有业务，请保留原记录并另行登记新车辆或车场关系",
        { PK02: "已有业务关联已锁定", PK04: "已有业务关联已锁定" }
      );
    }
    need(
      ["有效", "无效"].includes(p.data.PK07 || "有效"),
      "请选择有效关系状态"
    );
    need(
      (p.data.PK07 || "有效") !== "有效" ||
        !d.parkingRelations.some(
          (x) =>
            x._id !== old?._id &&
            x.PK02 === v._id &&
            x.PK04 === p.data.PK04 &&
            x.PK07 === "有效"
        ),
      "该车辆与停车场已有有效关系，请维护原记录"
    );
    const id = old?._id || makeId(s, "PK"),
      values = {
        PK01: id,
        PK02: v._id,
        PK03: v["车牌号码"],
        PK04: p.data.PK04,
        PK05: p.data.PK05,
        PK06: v._resident,
        PK07: p.data.PK07 || "有效",
        PK08: p.data.PK08,
        PK09: p.data.PK09,
        PK10: a.name,
        PK11: now(),
      };
    const r = old || {
      _id: id,
      _rev: 1,
      _resident: v._resident,
      _community: h["所属社区"],
      _estate: h["所属小区"],
      _org: a.org,
      history: [],
    };
    const before = old
      ? Object.fromEntries(Object.keys(values).map((k) => [k, old[k]]))
      : {};
    Object.assign(r, values, {
      _resident: v._resident,
      _community: h["所属社区"],
      _estate: h["所属小区"],
      _org: a.org,
    });
    if (!old) d.parkingRelations.push(r);
    history(s, a, r, "核验停车关系", before, values, p.data.PK09);
    return { id, message: "停车关系已保存" };
  }
  if (command === "saveProduct") {
    required(p.data, ["MP02", "MP03", "MP04", "MP05", "MP06", "MP07"]);
    const rel = d.parkingRelations.find(
      (r) => r.PK04 === p.data.MP03 && visible(s, a, r, "parkingRelations")
    );
    need(rel, "车场不在授权范围");
    const old = p.id ? get(s, a, "products", p.id) : null;
    if (old) revision(old, p);
    const id = old?._id || makeId(s, "MP"),
      values = {
        ...Object.fromEntries(
          ["MP02", "MP03", "MP05", "MP06", "MP07", "MP09"].map((k) => [
            k,
            p.data[k] || "",
          ])
        ),
        MP01: id,
        MP04: fen(p.data.MP04, "MP04"),
        MP08: (old?.MP08 || 0) + 1,
      };
    const r = old || {
      _id: id,
      _rev: 1,
      _community: rel._community,
      _estate: rel._estate,
      _org: a.org,
      history: [],
    };
    const before = old
      ? Object.fromEntries(Object.keys(values).map((k) => [k, old[k]]))
      : {};
    Object.assign(r, values, {
      _community: rel._community,
      _estate: rel._estate,
      _org: rel._org,
    });
    if (!old) d.products.push(r);
    history(s, a, r, "维护月租产品", before, values);
    return { id, message: "月租产品已保存，历史订单不变" };
  }
  if (command === "createMonthly") {
    need(a.role === "resident", "请由住户本人办理月租");
    const rel = relationFor(s, a, p.relation),
      product = get(s, a, "products", p.product);
    need(
      product.MP03 === rel.PK04 &&
        product.MP07 === "启用" &&
        product.MP08 === p.productVersion,
      "月租产品已变化，请重新确认"
    );
    date(p.start, "MO07");
    date(p.end, "MO08");
    need(p.start <= p.end, "服务结束日期不能早于开始日期");
    // This product's explicit demo rule is a calendar month; never substitute 30 days.
    const end = new Date(
      Date.UTC(Number(p.start.slice(0, 4)), Number(p.start.slice(5, 7)), 0)
    )
      .toISOString()
      .slice(0, 10);
    need(
      p.start.endsWith("-01") && p.end === end,
      "本演示产品按完整自然月办理，请核对起止日期",
      { MO07: "选择月初", MO08: "选择对应月末" }
    );
    const prior = d.monthly
      .filter((r) => r._relation === rel._id && r.MO10 === "已登记")
      .sort((x, y) => y.MO13.localeCompare(x.MO13))[0];
    if (p.kind === "续费") {
      need(
        prior && prior._id === p.prior && prior._rev === p.priorVersion,
        "原权益已变化，请重新选择续费"
      );
      need(p.start > prior.MO13, "续费期间不能与原权益重叠");
    } else
      need(
        !prior || p.start > prior.MO13,
        "已有权益期间重叠，请选择续费及正确期间"
      );
    need(
      !d.monthly.some(
        (r) =>
          r._relation === rel._id &&
          !["已关闭", "登记异常"].includes(r.MO10) &&
          p.start <= (r.MO13 || r.MO08) &&
          p.end >= (r.MO12 || r.MO07)
      ),
      "该车辆已有重叠期间订单，请查询原单"
    );
    const id = makeId(s, "MO"),
      r = {
        _id: id,
        _rev: 1,
        _resident: a.resident,
        _relation: rel._id,
        _relationSnapshot: clone(rel),
        _community: rel._community,
        _estate: rel._estate,
        _org: rel._org,
        _product: product._id,
        _productSnapshot: clone(product),
        MO01: id,
        MO02: p.kind || "新办",
        MO03: product.MP02,
        MO04: p.kind === "续费" ? prior.MO11 : "",
        MO05: p.kind === "续费" ? prior.MO12 : "",
        MO06: p.kind === "续费" ? prior.MO13 : "",
        MO07: p.start,
        MO08: p.end,
        MO09: product.MP04,
        MO10: "待支付",
        MO11: "",
        MO12: "",
        MO13: "",
        MO14: "",
        MO15: "未接入",
        MO16: "付款后登记平台期间；通行信息暂未同步",
        MO17: now(),
        MO18: product.MP08,
        history: [],
      };
    d.monthly.push(r);
    history(s, a, r, "创建月租预缴订单", {}, { MO10: r.MO10 }, "", true);
    return { id, message: "月租订单已创建，请确认缴费" };
  }
  if (command === "saveTemporary") {
    required(p.data, ["TB02", "TB03", "TB04", "TB05", "TB06", "TB09", "TB10"]);
    const rel = relationFor(s, a, p.data.TB03),
      old = p.id ? get(s, a, "temporary", p.id) : null;
    need(
      Number.isFinite(Date.parse(p.data.TB04)) &&
        Number.isFinite(Date.parse(p.data.TB05)) &&
        p.data.TB04 <= p.data.TB05,
      "请填写有效入场及计费截止时间"
    );
    if (old) {
      revision(old, p);
      need(
        old.TB13 !== "已发布" || old.TB03 === p.data.TB03,
        "已发布临停账单不能变更停车关系",
        { TB03: "已发布关联只读" }
      );
      need(
        !old.TB07 &&
          !d.payments.some(
            (x) =>
              x._business === old._id &&
              ["处理中", "结果待确认", "成功"].includes(x.PY12)
          ),
        "存在付款事实，不能直接改变报价"
      );
    }
    const id = old?._id || makeId(s, "TB"),
      amount = fen(p.data.TB06, "TB06"),
      r = old || {
        _id: id,
        _rev: 1,
        _resident: rel._resident,
        _community: rel._community,
        _estate: rel._estate,
        _org: rel._org,
        history: [],
      };
    Object.assign(r, {
      ...Object.fromEntries(
        ["TB02", "TB03", "TB04", "TB05", "TB09", "TB10", "TB12"].map((k) => [
          k,
          p.data[k] || "",
        ])
      ),
      _resident: rel._resident,
      _community: rel._community,
      _estate: rel._estate,
      _org: rel._org,
      _relationSnapshot: old?._relationSnapshot || clone(rel),
      TB01: id,
      TB06: amount,
      TB07: old?.TB07 || 0,
      TB08: amount - (old?.TB07 || 0),
      TB11: (old?.TB11 || 0) + 1,
      TB13: "已发布",
      TB14: amount ? "未结清" : "已结清",
      TB15: amount ? "请按本次确认金额缴费" : "本次无需缴费；通行信息暂未同步",
    });
    if (!old) d.temporary.push(r);
    history(
      s,
      a,
      r,
      "登记临停费用",
      {},
      { TB06: amount, TB11: r.TB11 },
      "费用由人工核验台账提供",
      true
    );
    return { id, message: "临停账单已保存" };
  }
  need(false, "不支持的停车操作");
}
