import {
  domain,
  pointFor,
  list,
  need,
  value,
  required,
  phone,
  fen,
  money,
  find,
  get,
  revision,
  create,
  append,
  clone,
  clock,
  day,
  date,
  merchant,
  resident,
  shopRecord,
  staffEligible,
  allocations,
  success,
  fundsFor,
  activeAftersale,
  refundable,
  auditEvidence,
  pickInput,
  id,
} from "./common.js";
import { comboFor, saleability, comboValid, methodFor } from "./supply.js";
import {
  fund,
  refund,
  splitIfReady,
  syncOrder,
  finish,
  outcome,
} from "./funds.js";
export function currentArrangement(o) {
  return (
    o.arrangements?.find((x) => x["安排编号"] === o["当前有效安排编号"]) || null
  );
}
export function proposal(o) {
  return (
    [...(o.arrangements || [])]
      .reverse()
      .find((x) => x["安排状态"] === "待确认") || null
  );
}
export function currentRound(o) {
  return o.rounds?.[o.rounds.length - 1] || null;
}
export function orderBlocked(s, o) {
  return (
    !!(activeAftersale(s, o) && activeAftersale(s, o)._id !== o._reworkSale) ||
    o["结案结果"] !== "进行中"
  );
}
function progress(o) {
  if (o["结案结果"] !== "进行中") return o["结案结果"];
  if (
    o["售后状态"] &&
    !["无", "已解决", "已撤回", "已拒绝"].includes(o["售后状态"])
  )
    return "售后处理中";
  if (o["支付状态"] !== "成功") return "待付款";
  if (o["履约状态"] === "结果已提交") return "待居民确认完成";
  if (o["履约状态"] === "服务中") return "服务中";
  if (["已到场", "已到点"].includes(o["履约状态"])) return "待开始服务";
  if (o["安排状态"] === "待居民确认") return "待确认安排";
  if (o["安排状态"] === "已确认") return "预约已确认";
  if (o["接单状态"] === "已接单") return "待商家安排";
  return "待接单";
}
function ensureRound(s, o, arr) {
  let round = currentRound(o);
  if (
    !round ||
    round["本轮履约状态"] === "已终止" ||
    round["本轮履约状态"] === "已确认"
  ) {
    round = {
      _id: id(s, "ROUND"),
      履约轮次: (o.rounds?.length || 0) + 1,
      本轮关联安排编号: arr["安排编号"],
      本轮服务日期: arr["安排服务日期"],
      本轮安排开始时间: arr["安排开始时间"],
      本轮安排结束时间: arr["安排结束时间"],
      实际执行人员姓名: arr["服务人员姓名"],
      关联售后编号: o._reworkSale || "",
      本轮履约状态: "未开始",
      process: [],
      results: [],
    };
    o.rounds.push(round);
  } else {
    round["本轮关联安排编号"] = arr["安排编号"];
    round["本轮服务日期"] = arr["安排服务日期"];
    round["实际执行人员姓名"] = arr["服务人员姓名"];
  }
  return round;
}
export function makeOrder(s, a, data) {
  resident(a);
  const service = find(s, "services", value(data, "选定服务项目", "serviceId"));
  need(service, "请选择服务项目");
  const reasons = saleability(s, service);
  need(!reasons.length, reasons.join("；"));
  const { content, spec, combo } = comboFor(
    s,
    service,
    value(data, "选定服务规格", "specId"),
    value(data, "选定履约方式", "mode"),
  );
  need(
    comboValid(s, combo, content["所属服务类目"], service._shop),
    "该规格方式当前不可售：类目允许方式或配置已变化",
  );
  const selectedMethod = methodFor(s, combo);
  const frozenWay = {
    ...combo,
    组合履约方式名称: selectedMethod["履约方式名称"],
    组合流程模板: selectedMethod["绑定流程模板"],
    方式说明: selectedMethod?.["履约方式说明"],
    方式版本: selectedMethod?.["方式版本"],
  };
  required(data, ["联系人姓名", "联系人电话"]);
  phone(data["联系人电话"]);
  need(
    [true, "是", "已确认", "同意", 1].includes(data["服务约定确认"]),
    "请先阅读并确认服务约定",
    { 服务约定确认: "请确认服务约定" },
  );
  if (spec["服务对象填写要求"] === "必填") required(data, ["服务对象描述"]);
  const expected = value(data, "期望时间选择") || "时间可协商";
  need(["指定日期", "时间可协商"].includes(expected), "期望时间选择无效");
  if (expected === "指定日期") {
    required(data, ["期望服务日期", "期望时段偏好"]);
    date(s, data["期望服务日期"], "期望服务日期", true);
  }
  let location;
  if (combo["组合流程模板"] === "上门") {
    location = pickInput(data["上门服务地址"] || {}, [
      "省份",
      "城市",
      "区县",
      "所属社区",
      "所属小区",
      "所属楼栋",
      "所属单元",
      "所属房屋",
      "楼栋",
      "单元",
      "门牌房号",
      "地址补充说明",
      "详细地址",
      "联系人姓名",
      "联系人电话",
    ]);
    required(location, ["所属社区", "详细地址"]);
    if (location["所属小区"])
      need(
        s.estates.some(
          (e) =>
            e._id === location["所属小区"] &&
            e["所属社区"] === location["所属社区"],
        ),
        "上门地址的社区与小区不匹配",
      );
    need(
      list(combo["上门覆盖社区"]).includes(location["所属社区"]),
      "上门地址不在服务覆盖社区",
    );
    if (list(combo["上门覆盖小区"]).length)
      need(
        list(combo["上门覆盖小区"]).includes(location["所属小区"]),
        "上门地址不在服务覆盖小区",
      );
    need(!data["到点服务地点"], "上门订单不能同时提交到点地点");
  } else {
    need(
      !data["上门服务地址"] ||
        !Object.values(data["上门服务地址"]).some(Boolean),
      "到点服务不填写上门地址",
    );
    location = clone(
      list(combo["可服务门店或服务点"]).find(
        (x) =>
          x["地点业务编号"] === data["到点服务地点"] ||
          x["地点业务编号"] === data["到点服务地点"]?.["地点业务编号"],
      ),
    );
    const currentPoint = location && pointFor(s, service._shop, location);
    need(
      currentPoint && currentPoint["详细地址"] && currentPoint["联系号码"],
      "请选择本商户有效到点地点",
    );
    location = Object.fromEntries(
      Object.entries(currentPoint).filter(([k]) => !k.startsWith("_")),
    );
  }
  const amount = fen(combo["组合固定价格"], "组合固定价格", true),
    m = shopRecord(s, service._shop),
    o = create(
      s,
      a,
      "orders",
      {
        _shop: service._shop,
        _resident: a.resident,
        _service: service._id,
        _spec: spec["规格编号"],
        _category: content["所属服务类目"],
        _amount: amount,
        _mode: combo["组合流程模板"],
        _combo: clone(frozenWay),
        服务订单号: "",
        服务预约编号: "",
        公共交易订单号: "",
        下单人展示名称: a.name,
        服务项目名称: content["服务名称"],
        服务规格名称: spec["规格名称"],
        履约方式名称: selectedMethod["履约方式名称"],
        履约模板版本: selectedMethod?.["方式版本"] || 1,
        关联合作协议编号: m["合作协议编号"],
        上门地址来源: data["上门地址来源"] || "本次填写",
        服务约定确认: true,
        服务供给版本: service["当前发布版本"],
        经营主体名称: m["商户名称"],
        经营店铺名称: m["经营店铺名称"],
        服务内容快照: clone({ 项目: content, 规格: spec, 方式: frozenWay }),
        地点快照: location,
        联系人姓名: data["联系人姓名"],
        联系人电话: data["联系人电话"],
        服务对象描述:
          spec["服务对象填写要求"] === "不需要"
            ? ""
            : data["服务对象描述"] || "",
        需求说明: data["需求补充说明"] || "",
        需求图片: data["需求图片"] || [],
        原始期望时间: {
          期望时间选择: expected,
          期望服务日期: data["期望服务日期"] || "",
          期望时段偏好: data["期望时段偏好"] || "",
          期望时间补充说明: data["期望时间补充说明"] || "",
        },
        订单应付金额: money(amount),
        累计实付金额: "0.00",
        累计成功退款金额: "0.00",
        当前业务进度: "待付款",
        支付状态: "待发起",
        接单状态: "待接单",
        安排状态: "待商家安排",
        履约状态: "未开始",
        居民完成确认状态: "待确认",
        售后状态: "无",
        结案结果: "进行中",
        当前有效安排编号: "",
        arrangements: [],
        changes: [],
        rounds: [],
        anomalies: [],
        ruleSnapshot: {
          id: "DEMO-SERVICE-" + service._shop,
          version: domain(s).ruleVersion || "DEMO-ALLOC-V1",
          status: "有效",
          business: "便民服务",
          merchant: service._shop,
          shop: service._shop,
          allocation: allocations(
            amount,
            domain(s).ruleVersion || "DEMO-ALLOC-V1",
          ),
          说明: "只读演示返回，不是正式费率或结算政策",
        },
        createdBy: a._id,
      },
      "ORDER",
    );
  o["服务订单号"] = o._id;
  o["服务预约编号"] = "BOOK-" + o._id;
  o["公共交易订单号"] = "TRADE-" + o._id;
  auditEvidence(s, a, o, ["需求图片"]);
  append(s, a, o, "创建服务订单");
  return o;
}
function arrange(s, a, o, data) {
  merchant(a);
  need(
    o["支付状态"] === "成功" &&
      o["接单状态"] === "已接单" &&
      !orderBlocked(s, o),
    "请先接单且确保订单无取消或售后阻断",
  );
  need(o["履约状态"] === "未开始", "服务已开始，不能直接改期");
  required(data, ["服务人员", "安排服务日期", "安排开始时间", "安排结束时间"]);
  date(s, data["安排服务日期"], "安排服务日期", true);
  need(
    /^\d{2}:\d{2}$/.test(data["安排开始时间"]) &&
      /^\d{2}:\d{2}$/.test(data["安排结束时间"]) &&
      data["安排结束时间"] > data["安排开始时间"],
    "安排结束时间须晚于同日开始时间",
  );
  need(
    data["安排服务日期"] > day(s) ||
      data["安排结束时间"] > clock(s).slice(11, 16),
    "整个时间范围已过去，请重新约时",
  );
  const staff = find(s, "personnel", data["服务人员"]);
  need(
    staffEligible(s, staff, o._shop, o._category),
    "人员已停用、类目或所需资质不满足",
  );
  const old = currentArrangement(o);
  if (old) {
    need(data["原安排仍可履行"] !== undefined, "请说明原安排是否仍可履行");
    required(data, ["改期原因"]);
    if (
      !o.changes.some((c) =>
        ["待商家安排", "待居民确认"].includes(c["改期申请状态"]),
      )
    )
      o.changes.push({
        改期申请编号: id(s, "CHG"),
        改期发起方: a.name,
        原安排编号: old["安排编号"],
        原服务日期: old["安排服务日期"],
        原开始时间: old["安排开始时间"],
        原结束时间: old["安排结束时间"],
        改期原因: data["改期原因"],
        原安排仍可履行: data["原安排仍可履行"],
        改期申请状态: "待商家安排",
        改期申请时间: clock(s),
      });
    if ([false, "否", "不能"].includes(data["原安排仍可履行"])) {
      old["安排状态"] = "已撤回";
      o["当前有效安排编号"] = "";
      o["安排状态"] = "需重新约时";
      o.credential = null;
    }
  }
  for (const x of o.arrangements)
    if (x["安排状态"] === "待确认") x["安排状态"] = "已替代";
  const ar = {
    安排编号: id(s, "ARR"),
    安排版本: o.arrangements.length + 1,
    关联履约轮次: o.rounds.length || 1,
    服务人员: staff._id,
    服务人员姓名: staff["姓名"],
    服务人员工作联系电话: staff["工作联系电话"],
    安排服务日期: data["安排服务日期"],
    安排开始时间: data["安排开始时间"],
    安排结束时间: data["安排结束时间"],
    安排地点: clone(o["地点快照"]),
    安排说明: data["安排说明"] || "",
    安排状态: "待确认",
    安排提出人: a.name,
    安排提出时间: clock(s),
  };
  o.arrangements.push(ar);
  const change = [...o.changes]
    .reverse()
    .find((c) => ["待商家安排", "待居民确认"].includes(c["改期申请状态"]));
  if (change) {
    change["改期申请状态"] = "待居民确认";
    change["新安排编号"] = ar["安排编号"];
  }
  o["安排状态"] = "待居民确认";
  return ar;
}
export function orderCommand(s, a, name, p) {
  const data = pickInput(
    p.data || {},
    {
      create: [
        "选定服务项目",
        "serviceId",
        "选定服务规格",
        "specId",
        "选定履约方式",
        "mode",
        "联系人姓名",
        "联系人电话",
        "服务约定确认",
        "服务对象描述",
        "期望时间选择",
        "期望服务日期",
        "期望时段偏好",
        "期望时间补充说明",
        "上门服务地址",
        "上门地址来源",
        "到点服务地点",
        "需求补充说明",
        "需求图片",
      ],
      pay: [],
      accept: [
        "接单结果",
        "无法承接说明",
        "服务人员",
        "安排服务日期",
        "安排开始时间",
        "安排结束时间",
        "安排说明",
        "原安排仍可履行",
        "改期原因",
      ],
      arrange: [
        "服务人员",
        "安排服务日期",
        "安排开始时间",
        "安排结束时间",
        "安排说明",
        "原安排仍可履行",
        "改期原因",
      ],
      respond: ["安排版本", "居民安排答复", "居民答复说明"],
      change: ["改期原因", "期望改期日期", "期望改期时段偏好"],
      arrive: ["到场说明", "到场图片"],
      verify: ["到点凭证码", "当前核验地点", "确认到点", "核验说明"],
      start: ["开始说明"],
      process: ["过程记录类型", "过程说明", "过程图片"],
      result: [
        "服务结果",
        "实际完成内容",
        "未完成内容",
        "未完成原因",
        "实际服务结束时间",
        "结果图片",
        "结果补充说明",
      ],
      confirm: ["当前待确认结果版本", "居民结果答复", "问题说明", "问题图片"],
      cancel: ["申请原因", "问题证据"],
      anomaly: [
        "异常类型",
        "异常发生时间",
        "异常事实说明",
        "异常证据",
        "期望处理方式",
      ],
    }[name.split(".")[1]] || [],
  );
  if (name === "order.create")
    return { table: "orders", r: makeOrder(s, a, data) };
  const o = get(s, a, "orders", p.id),
    action = name.split(".")[1];
  if (action === "pay") {
    resident(a);
    const old = fundsFor(s, o, "支付")[0];
    if (old && old["资金状态"] === "成功") return { table: "orders", r: o };
    revision(o, p);
    need(
      o["结案结果"] === "进行中" && ["待发起", "失败"].includes(o["支付状态"]),
      "当前订单不可重复发起付款，未知须查询原请求",
    );
    const f = old
      ? finish(
          s,
          a,
          old,
          {
            normal: "成功",
            failure: "失败",
            unknown: "结果未知",
            pending: "处理中",
          }[outcome(s, "支付")],
        )
      : fund(s, a, o, "支付", o._amount, "PAY:" + o._id, {
          支付方式: "演示付款",
          支付结果说明: "不会真实扣款",
        });
    syncOrder(s, o);
    if (f["资金状态"] === "成功") o["当前业务进度"] = "待接单";
    append(s, a, o, "支付服务订单");
    return { table: "orders", r: o };
  }
  if (action === "confirm" && o["居民完成确认状态"] === "已确认") {
    resident(a);
    return { table: "orders", r: o };
  }
  if (action === "verify" && data["确认到点"] === false) {
    merchant(a);
    const cr = o.credential;
    need(
      cr &&
        cr["到点凭证码"] === data["到点凭证码"] &&
        cr["凭证状态"] === "有效",
      "凭证无效或已失效",
    );
    need(currentArrangement(o) && !orderBlocked(s, o), "当前安排不可核验");
    return {
      table: "orders",
      r: o,
      message: "已查询有效凭证，请核对后确认到点",
    };
  }
  revision(o, p);
  if (
    [
      "accept",
      "arrange",
      "arrive",
      "verify",
      "start",
      "process",
      "result",
      "anomaly",
    ].includes(action)
  )
    merchant(a);
  else resident(a);
  if (action === "accept") {
    need(
      o["支付状态"] === "成功" &&
        o["接单状态"] === "待接单" &&
        !orderBlocked(s, o),
      "该订单不可接单",
    );
    if (data["接单结果"] === "无法承接") {
      required(data, ["无法承接说明"]);
      o["无法承接说明"] = data["无法承接说明"];
      o["接单状态"] = "已拒单";
      o["结案结果"] = "未服务取消";
      o["结案时间"] = clock(s);
      refund(s, a, o, refundable(s, o), "REJECT:" + o._id);
    } else {
      o["接单状态"] = "已接单";
      o["接单操作人"] = a.name;
      o["接单时间"] = clock(s);
      if (data["服务人员"]) arrange(s, a, o, data);
    }
  } else if (action === "arrange") arrange(s, a, o, data);
  else if (action === "respond") {
    const ar = proposal(o);
    need(
      ar && Number(data["安排版本"]) === ar["安排版本"],
      "安排已变化，请查看最新提案",
    );
    need(
      !orderBlocked(s, o) && o["履约状态"] === "未开始",
      "当前状态不可答复安排",
    );
    const accept = data["居民安排答复"] === "接受";
    if (!accept) required(data, ["居民答复说明"]);
    ar["居民安排答复"] = accept ? "接受" : "希望调整";
    ar["居民答复说明"] = data["居民答复说明"] || "";
    ar["居民答复人"] = a.name;
    ar["居民答复时间"] = clock(s);
    ar["安排状态"] = accept ? "已接受" : "未接受";
    const change = [...o.changes]
      .reverse()
      .find((c) => c["新安排编号"] === ar["安排编号"]);
    if (change) {
      change["改期申请状态"] = accept ? "已生效" : "未达成";
      if (accept) change["改期生效时间"] = clock(s);
    }
    if (accept) {
      const old = currentArrangement(o);
      if (old && old !== ar) old["安排状态"] = "已替代";
      o["当前有效安排编号"] = ar["安排编号"];
      o["安排状态"] = "已确认";
      ensureRound(s, o, ar);
      if (o._mode === "预约到点")
        o.credential = {
          到点凭证码: "S02-" + o._id + "-V" + ar["安排版本"],
          到点凭证二维码: "S02:" + o._id + ":" + ar["安排版本"],
          凭证状态: "有效",
          凭证对应服务订单号: o["服务订单号"],
          凭证对应项目名称: o["服务项目名称"],
          凭证对应规格名称: o["服务规格名称"],
          凭证对应地点名称: o["地点快照"]["地点名称"],
          凭证对应服务日期: ar["安排服务日期"],
          凭证对应开始时间: ar["安排开始时间"],
          凭证对应结束时间: ar["安排结束时间"],
          凭证联系人姓名: o["联系人姓名"],
          凭证联系人电话: o["联系人电话"],
        };
    } else o["安排状态"] = currentArrangement(o) ? "已确认" : "待商家安排";
  } else if (action === "change") {
    need(
      o["履约状态"] === "未开始" && !orderBlocked(s, o),
      "服务已开始或有冲突，请通过售后处理",
    );
    required(data, ["改期原因"]);
    o.changes.push({
      改期申请编号: id(s, "CHG"),
      改期发起方: a.name,
      原安排编号: currentArrangement(o)?.["安排编号"] || "",
      原服务日期: currentArrangement(o)?.["安排服务日期"] || "",
      原开始时间: currentArrangement(o)?.["安排开始时间"] || "",
      原结束时间: currentArrangement(o)?.["安排结束时间"] || "",
      期望改期日期: data["期望改期日期"] || "",
      期望改期时段偏好: data["期望改期时段偏好"] || "",
      改期原因: data["改期原因"],
      改期申请状态: "待商家安排",
      改期申请时间: clock(s),
    });
    if (data["期望改期日期"])
      date(s, data["期望改期日期"], "期望改期日期", true);
  } else if (action === "arrive" || action === "verify") {
    need(
      o["安排状态"] === "已确认" &&
        o["履约状态"] === "未开始" &&
        !orderBlocked(s, o),
      "需要有效安排且无取消或售后阻断",
    );
    const ar = currentArrangement(o);
    need(
      staffEligible(
        s,
        find(s, "personnel", ar["服务人员"]),
        o._shop,
        o._category,
      ),
      "安排人员当前不可执行，请重新安排并确认",
    );
    const round = currentRound(o);
    if (action === "arrive") {
      need(o._mode === "上门", "该订单应办理到点核验");
      auditEvidence(s, a, data, ["到场图片"]);
      Object.assign(round, {
        到场说明: data["到场说明"] || "",
        到场图片: data["到场图片"] || [],
        到场记录时间: clock(s),
        到场记录操作人: a.name,
        本轮履约状态: "已到场",
      });
      o["履约状态"] = "已到场";
    } else {
      need(o._mode === "预约到点", "上门订单不使用到点凭证");
      const cr = o.credential;
      need(
        cr &&
          cr["凭证状态"] === "有效" &&
          cr["到点凭证码"] === data["到点凭证码"],
        "凭证不存在、已核验或属于旧安排",
      );
      need(day(s) === ar["安排服务日期"], "服务日期不符，请先改期并由居民接受");
      need(
        data["当前核验地点"] === o["地点快照"]["地点业务编号"],
        "核验地点与原订单不符",
      );
      if (
        clock(s).slice(11, 16) < ar["安排开始时间"] ||
        clock(s).slice(11, 16) > ar["安排结束时间"]
      )
        required(data, ["核验说明"]);
      cr["凭证状态"] = "已核验";
      Object.assign(cr, {
        核验记录编号: id(s, "VERIFY"),
        当前核验地点: data["当前核验地点"],
        核验说明: data["核验说明"] || "",
        核验结果: "已到点",
        核验操作人: a.name,
        核验时间: clock(s),
      });
      round["本轮履约状态"] = "已到点";
      o["履约状态"] = "已到点";
    }
  } else if (action === "start") {
    need(
      !orderBlocked(s, o) && ["已到场", "已到点"].includes(o["履约状态"]),
      "请先到场或确认到点，且确认没有取消或售后阻断",
    );
    const arrangement = currentArrangement(o);
    need(
      arrangement &&
        staffEligible(
          s,
          find(s, "personnel", arrangement["服务人员"]),
          o._shop,
          o._category,
        ),
      "安排人员当前不可执行，人员或资质已变化，请协调重新安排",
    );
    const round = currentRound(o);
    Object.assign(round, {
      开始说明: data["开始说明"] || "",
      开始记录时间: clock(s),
      开始记录操作人: a.name,
      本轮履约状态: "服务中",
    });
    o["履约状态"] = "服务中";
  } else if (action === "process") {
    need(
      o["履约状态"] === "服务中" && !orderBlocked(s, o),
      "当前不可追加过程记录",
    );
    required(data, ["过程说明"]);
    auditEvidence(s, a, data, ["过程图片"]);
    currentRound(o).process.push({
      ...data,
      过程记录时间: clock(s),
      过程操作人: a.name,
    });
  } else if (action === "result") {
    need(
      ["服务中", "结果已提交"].includes(o["履约状态"]) && !orderBlocked(s, o),
      "请先开始服务且处理当前售后",
    );
    required(data, ["服务结果", "实际完成内容", "实际服务结束时间"]);
    need(
      ["全部完成", "部分完成", "未完成"].includes(data["服务结果"]),
      "服务结果无效",
    );
    if (data["服务结果"] !== "全部完成")
      required(data, ["未完成内容", "未完成原因"]);
    need(
      Number.isFinite(Date.parse(data["实际服务结束时间"])),
      "实际服务结束时间无效",
    );
    need(
      Date.parse(data["实际服务结束时间"]) <= Date.parse(clock(s)),
      "实际服务结束时间不能晚于提交时",
      { 实际服务结束时间: "不能填写未来时间" },
    );
    const round = currentRound(o);
    need(
      Date.parse(data["实际服务结束时间"]) >= Date.parse(round["开始记录时间"]),
      "结束时间不得早于开始时间",
    );
    auditEvidence(s, a, data, ["结果图片"]);
    if (o._combo["完成证据要求"] === "必需图片")
      need(list(data["结果图片"]).length, "本单要求提交结果图片", {
        结果图片: "请补充结果图片",
      });
    const result = {
      ...data,
      结果版本: (o.results?.length || 0) + 1,
      结果提交人: a.name,
      结果提交时间: clock(s),
    };
    o.results = o.results || [];
    o.results.push(result);
    round.results.push(clone(result));
    round["本轮履约状态"] = "结果已提交";
    o["结果版本"] = result["结果版本"];
    o["履约状态"] = "结果已提交";
    o["居民完成确认状态"] = "待确认";
  } else if (action === "confirm") {
    need(
      o["履约状态"] === "结果已提交" &&
        (!activeAftersale(s, o) || activeAftersale(s, o)._id === o._reworkSale),
      "当前结果不可确认，存在售后时先处理",
    );
    const result = o.results?.[o.results.length - 1];
    need(
      result && Number(data["当前待确认结果版本"]) === result["结果版本"],
      "结果版本已变化，请查看最新结果",
    );
    need(
      ["确认完成", "有异议", "反馈问题"].includes(data["居民结果答复"]),
      "请选择本次居民结果答复",
      { 居民结果答复: "请选择确认完成或反馈问题" },
    );
    if (["有异议", "反馈问题"].includes(data["居民结果答复"])) {
      required(data, ["问题说明"]);
      auditEvidence(s, a, data, ["问题图片"]);
      o["居民完成确认状态"] = "有异议";
      let sale = o._reworkSale ? find(s, "aftersales", o._reworkSale) : null;
      if (sale) {
        sale.evidence = sale.evidence || [];
        sale.evidence.push({
          追加说明: data["问题说明"],
          追加证据: data["问题图片"] || [],
          追加人: a.name,
          追加时间: clock(s),
          关联履约轮次: currentRound(o)["履约轮次"],
          结果版本: result["结果版本"],
        });
        sale._issueVersion = (sale._issueVersion || 0) + 1;
        sale["售后状态"] = "协商中";
        sale["执行状态"] = "受阻";
        sale["当前处理说明"] = data["问题说明"];
        delete o._reworkSale;
      } else {
        sale = create(
          s,
          a,
          "aftersales",
          {
            _shop: o._shop,
            _resident: o._resident,
            _order: o._id,
            售后编号: "",
            原服务订单号: o["服务订单号"],
            服务项目名称: o["服务项目名称"],
            申请类型: "服务问题",
            申请原因: data["问题说明"],
            问题说明: data["问题说明"],
            问题证据: data["问题图片"] || [],
            申请时服务阶段: o["履约状态"],
            申请人: a.name,
            申请时间: clock(s),
            售后状态: "待处理",
            方案版本: 0,
            plans: [],
            rulings: [],
          },
          "SALE",
        );
      }
      sale["售后编号"] = sale._id;
      o["售后状态"] = sale["售后状态"];
      o["关联问题记录号"] = sale._id;
      append(s, a, sale, "居民反馈问题");
    } else {
      need(
        result["服务结果"] === "全部完成",
        "部分或未完成服务应通过售后结案，不能正常完成",
      );
      o["居民完成确认状态"] = "已确认";
      o["居民确认人"] = a.name;
      o["居民确认时间"] = clock(s);
      o["结案结果"] = "正常完成";
      o["结案时间"] = clock(s);
      currentRound(o)["本轮履约状态"] = "已确认";
      if (o._reworkSale) {
        const sale = find(s, "aftersales", o._reworkSale);
        if (sale) {
          sale["售后状态"] = "已解决";
          sale["执行状态"] = "执行完成";
          sale["售后结案时间"] = clock(s);
          append(s, a, sale, "补充履约完成");
        }
        o["售后状态"] = "已解决";
        delete o._reworkSale;
      }
      splitIfReady(s, a, o);
    }
  } else if (action === "cancel") {
    required(data, ["申请原因"]);
    need(!activeAftersale(s, o), "已有进行中售后，请在原记录办理");
    need(o["结案结果"] === "进行中", "当前订单已结案");
    if (o["支付状态"] !== "成功") {
      const pay = fundsFor(s, o, "支付")[0];
      if (pay && ["处理中", "结果未知"].includes(pay["资金状态"])) {
        o["支付关闭结果"] = "关闭结果未知，需查询原支付";
        o["结案结果"] = "未支付关闭";
      } else {
        o["支付关闭结果"] = "已关闭";
        o["结案结果"] = "未支付关闭";
      }
      o["结案时间"] = clock(s);
    } else if (o["履约状态"] === "未开始" && !currentArrangement(o)) {
      o["结案结果"] = "未服务取消";
      o["结案时间"] = clock(s);
      o["安排状态"] = "已终止";
      for (const ar of o.arrangements)
        if (ar["安排状态"] === "待确认") ar["安排状态"] = "已撤回";
      refund(s, a, o, refundable(s, o), "DIRECT-CANCEL:" + o._id);
    } else {
      const type = o["履约状态"] === "未开始" ? "核实取消" : "服务问题",
        sale = create(
          s,
          a,
          "aftersales",
          {
            _shop: o._shop,
            _resident: o._resident,
            _order: o._id,
            售后编号: "",
            原服务订单号: o["服务订单号"],
            服务项目名称: o["服务项目名称"],
            申请类型: type,
            申请原因: data["申请原因"],
            申请时服务阶段: o["履约状态"],
            申请退款金额: money(refundable(s, o)),
            申请人: a.name,
            申请时间: clock(s),
            售后状态: "待处理",
            方案版本: 0,
            plans: [],
            rulings: [],
          },
          "SALE",
        );
      sale["售后编号"] = sale._id;
      o["售后状态"] = "待处理";
      append(s, a, sale, "申请" + type);
    }
  } else if (action === "anomaly") {
    required(data, ["异常类型", "异常发生时间", "异常事实说明"]);
    need(
      Number.isFinite(Date.parse(data["异常发生时间"])) &&
        Date.parse(data["异常发生时间"]) <= Date.parse(clock(s)),
      "异常发生时间不能晚于登记时间",
      { 异常发生时间: "请填写已发生的有效时间" },
    );
    auditEvidence(s, a, data, ["异常证据"]);
    o.anomalies.push({
      ...data,
      异常记录编号: id(s, "ANOMALY"),
      异常登记人: a.name,
      异常登记时间: clock(s),
    });
    need(
      !["正常完成", "未服务取消"].includes(o["结案结果"]),
      "已结案订单不能修改履约异常",
    );
  } else need(false, "不支持的订单动作");
  syncOrder(s, o);
  o["当前业务进度"] = progress(o);
  append(s, a, o, name, value(data, "申请原因", "改期原因", "问题说明") || "");
  return { table: "orders", r: o };
}
export function refreshOrder(s, o) {
  syncOrder(s, o);
  o["当前业务进度"] = progress(o);
  return o;
}
