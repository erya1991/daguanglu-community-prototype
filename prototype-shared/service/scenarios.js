import { domain, actor, clock, clone, find } from "./common.js";
import { makeOrder, orderCommand } from "./orders.js";
import { aftersaleCommand } from "./aftersale.js";
import { fund, refund } from "./funds.js";
const ctx = {
  resident: { app: "resident", account: "resident-a" },
  merchant: { app: "merchant", account: "merchant" },
  merchantB: { app: "merchant", account: "service-merchant-b" },
  web: { app: "web", account: "property-admin" },
};
export function loadScenario(s, name) {
  const d = domain(s);
  let seq = 0;
  const time = (v) => {
    d.clock = v;
  };
  const act = (who) => actor(s, ctx[who]);
  const run = (who, name, r, data = {}) => {
    const a = act(who);
    return (name.startsWith("order.") ? orderCommand : aftersaleCommand)(
      s,
      a,
      name,
      { id: r._id, revision: r._rev, operationId: "SEED-" + ++seq, data },
    ).r;
  };
  function order(
    key,
    service = "SV-HOME",
    paid = true,
    when = "2026-11-07T08:00:00+08:00",
  ) {
    time(when);
    const sv = find(s, "services", service),
      spec = sv.published["服务规格集合"][0],
      combo = spec["组合集合"][0],
      data = {
        选定服务项目: service,
        选定服务规格: spec["规格编号"],
        选定履约方式: combo["组合履约方式名称"],
        联系人姓名: "林示例",
        联系人电话: "13800005555",
        期望时间选择: "时间可协商",
        服务对象描述: "虚构演示服务对象",
        服务约定确认: true,
      };
    if (combo["组合流程模板"] === "上门")
      data["上门服务地址"] = {
        省份: "江苏省",
        城市: "南京市",
        区县: "示例区",
        所属社区: "C-A",
        所属小区: "E-A",
        楼栋: "1栋",
        单元: "1单元",
        门牌房号: "101",
        详细地址: "青禾花园1栋1单元101室",
      };
    else data["到点服务地点"] = "POINT-A";
    const o = makeOrder(s, act("resident"), data);
    o._id = key;
    o["服务订单号"] = key;
    o["服务预约编号"] = "BOOK-" + key;
    o["公共交易订单号"] = "TRADE-" + key;
    if (paid) run("resident", "order.pay", o);
    return o;
  }
  function arranged(o, date = "2026-11-07") {
    const who = o._shop === "SHOP-B" ? "merchantB" : "merchant";
    run(who, "order.accept", o);
    run(who, "order.arrange", o, {
      服务人员: o._shop === "SHOP-B" ? "P-B" : "P-A",
      安排服务日期: date,
      安排开始时间: "09:00",
      安排结束时间: "11:00",
    });
    run("resident", "order.respond", o, {
      安排版本: o.arrangements[o.arrangements.length - 1]["安排版本"],
      居民安排答复: "接受",
    });
    return o;
  }
  function started(o, date = "2026-11-07") {
    const who = o._shop === "SHOP-B" ? "merchantB" : "merchant";
    arranged(o, date);
    time(date + "T09:00:00+08:00");
    if (o._mode === "上门")
      run(who, "order.arrive", o, { 到场说明: "按约定到达" });
    else
      run(who, "order.verify", o, {
        到点凭证码: o.credential["到点凭证码"],
        当前核验地点: "POINT-A",
        确认到点: true,
      });
    run(who, "order.start", o, { 开始说明: "开始本轮服务" });
    return o;
  }
  function result(o, date = "2026-11-07", partial = false) {
    const who = o._shop === "SHOP-B" ? "merchantB" : "merchant";
    started(o, date);
    time(date + "T10:00:00+08:00");
    const pictures = [];
    if (o._combo["完成证据要求"] === "必需图片") {
      const aid = "S02-SCENE-PIC-" + o._id;
      s.attachments[aid] = {
        name: "虚构结果图片.svg",
        type: "image/svg+xml",
        size: 160,
        text: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#dbece3"/><text x="28" y="95">虚构服务结果证据</text></svg>',
        stage02: true,
        owner: ctx[who].account,
        status: "成功",
        uploader: act(who).name,
        uploadedAt: clock(s),
      };
      pictures.push(aid);
    }
    run(who, "order.result", o, {
      服务结果: partial ? "部分完成" : "全部完成",
      实际完成内容: partial ? "已完成可实施部分" : "已按规格完成服务",
      未完成内容: partial ? "剩余约定内容" : "",
      未完成原因: partial ? "现场条件不具备" : "",
      实际服务结束时间: clock(s),
      结果图片: pictures,
    });
    return o;
  }
  function complete(o, date = "2026-11-07") {
    result(o, date);
    run("resident", "order.confirm", o, {
      当前待确认结果版本: o["结果版本"],
      居民结果答复: "确认完成",
    });
    return o;
  }
  if (name === "S02-BASE" || name === "S02-BOOKING") return;
  if (name === "S02-QUAL") {
    const q = d.qualifications[0];
    q["申请状态"] = "草稿";
    q["申请服务类目"] = [...q["获准服务类目"]];
    q["申请说明"] = "申请增加服务覆盖范围，原授权仍有效";
    const missing = clone(d.personnel.find((p) => p._id === "P-A"));
    missing._id = "P-A-MISSING";
    missing["服务人员编号"] = "P-A-MISSING";
    missing["姓名"] = "待补材料人员";
    missing["可执行服务类目"] = ["CAT-AC"];
    missing["人员资质材料"] = [];
    missing["资质有效性"] = "待核实";
    d.personnel.push(missing);
    const existing = order("S02-QUAL-EXISTING");
    arranged(existing);
    return;
  }
  if (name === "S02-VERSION") {
    const sv = d.services[0];
    sv["当前编辑版本"] = 2;
    sv["审核状态"] = "草稿";
    sv["服务简介"] = "新编辑版本未发布，居民仍看V1";
    return;
  }
  if (name === "S02-STATS") {
    const t1 = order("T01", "SV-HOME", false, "2026-10-31T08:00:00+08:00");
    time("2026-11-01T08:00:00+08:00");
    run("resident", "order.pay", t1);
    complete(t1, "2026-11-02");
    const t2 = order("T02", "SV-AC", true, "2026-11-01T08:00:00+08:00");
    time("2026-11-02T08:00:00+08:00");
    d.outcomes.refund = "pending";
    run("resident", "order.cancel", t2, { 申请原因: "首次安排前取消" });
    d.outcomes.refund = "normal";
    const f2 = d.funds.find(
      (f) => f._order === "T02" && f["资金类型"] === "退款",
    );
    f2["资金状态"] = "成功";
    f2["退款状态"] = "成功";
    f2["成功时间"] = "2026-11-03T08:00:00+08:00";
    f2["退款成功时间"] = f2["成功时间"];
    f2["本笔成功退款金额"] = "129.00";
    f2["退款结果说明"] = "原请求演示退款成功";
    f2.history.push({
      记录编号: "T02-REF-RESULT",
      动作名称: "查询原退款结果",
      记录时间: f2["成功时间"],
      操作人: "原资金演示通道",
      操作人业务身份: "公共资金结果",
      结果状态: "成功",
      原因说明: "固定历史返回",
      关联凭证: [],
    });
    const t3 = order("T03", "SV-DRAIN", true, "2026-10-30T08:00:00+08:00");
    t3.ruleSnapshot.historyReturn = {
      version: "HISTORY-T03",
      amount: 15900,
      merchant: 13900,
      property: 2000,
    };
    complete(t3, "2026-10-31");
    time("2026-11-04T08:00:00+08:00");
    const f3 = refund(s, act("merchantB"), t3, 4000, "HISTORY-REF-T03");
    const back = d.funds.find(
      (f) => f._order === "T03" && f["资金类型"] === "回退",
    );
    back._amount = 3000;
    back["资金金额"] = "30.00";
    back["需回退金额"] = "30.00";
    back["请求回退金额"] = "30.00";
    back["成功回退金额"] = "30.00";
    back.ruleSnapshot = {
      ...back.ruleSnapshot,
      historyReturn: "T03原受控公共返回30.00，不由当前生成器重算",
    };
    const t4 = order("T04", "SV-POINT", true, "2026-11-02T08:00:00+08:00");
    arranged(t4, "2026-11-07");
    time("2026-11-06T08:00:00+08:00");
    run("resident", "order.cancel", t4, {
      申请原因: "已接受安排，申请核实取消",
    });
    order("T05", "SV-HOME", false, "2026-11-02T09:00:00+08:00");
    const t6 = order("T06", "SV-HINGE", true, "2026-10-15T08:00:00+08:00");
    result(t6, "2026-11-03", true);
    let sale = run("resident", "aftersale.apply", t6, {
      申请类型: "申请退款",
      申请原因: "部分履行协商终止",
      申请退款金额: "20.00",
    });
    sale = run("merchantB", "aftersale.plan", sale, {
      方案处理类型: "部分退款",
      拟退款金额: "20.00",
      金额依据说明: "虚构部分履行协商结果",
      业务结案方式: "部分履行终止",
      方案说明: "退还未履行部分",
    });
    run("resident", "aftersale.respond", sale, {
      方案版本: sale["方案版本"],
      居民方案答复: "同意",
    });
    order("T07", "SV-FAN", true, "2026-11-03T08:00:00+08:00");
    const t8 = order("T08", "SV-GLASS", true, "2026-11-04T08:00:00+08:00");
    run("merchant", "order.accept", t8);
    time("2026-11-06T18:00:00+08:00");
    return;
  }
  let o = order(
    "S02-DEMO-ORDER",
    name === "S02-POINT-READY" ? "SV-POINT" : "SV-HOME",
    !["S02-PAY", "S02-PAY-CLOSE"].includes(name),
  );
  if (
    [
      "S02-PAY",
      "S02-PAY-CLOSE",
      "S02-CANCEL-FIRST",
      "S02-UNABLE",
      "S02-ARRANGE",
      "S02-EXISTING",
      "S02-ISOLATION",
    ].includes(name)
  ) {
    if (name === "S02-PAY-CLOSE") d.outcomes.payment = "unknown";
    if (name === "S02-ISOLATION") {
      order("S02-B-ORDER", "SV-HINGE");
      order("S02-A-UNPAID", "SV-POINT", false);
    }
    return;
  }
  if (
    [
      "S02-HOME-READY",
      "S02-POINT-READY",
      "S02-CANCEL-CONFIRMED",
      "S02-CHANGE",
      "S02-NOSHOW",
    ].includes(name)
  ) {
    arranged(o);
    return;
  }
  if (name === "S02-IN-SERVICE") {
    started(o);
    return;
  }
  if (name === "S02-FUNDS-RULE") {
    o.ruleSnapshot.status = "缺失";
    result(o);
    return;
  }
  if (name === "S02-FUNDS") {
    result(o);
    return;
  }
  if (name === "S02-REFUND-LIMIT") {
    fund(s, act("merchant"), o, "退款", 2000, "LIMIT-SUCCESS");
    d.outcomes.refund = "pending";
    fund(s, act("merchant"), o, "退款", 1000, "LIMIT-PENDING");
    d.outcomes.refund = "normal";
    return;
  }
  if (["S02-FUNDS-REFUND", "S02-EVAL", "S02-OLD"].includes(name)) {
    complete(o);
    if (name === "S02-OLD") {
      o["创建时间"] = "2025-01-01T08:00:00+08:00";
      o.history[0]["记录时间"] = o["创建时间"];
    }
    return;
  }
  if (name === "S02-FUNDS-EXCEPTION") {
    d.outcomes.split = "unknown";
    complete(o);
    return;
  }
  result(o);
  const sale = run("resident", "aftersale.apply", o, {
    申请类型: "申请退款",
    申请原因: "居民反馈服务问题",
    申请退款金额: "30.00",
    问题说明: "请按原记录核实",
  });
  if (name === "S02-REWORK") {
    run("merchant", "aftersale.plan", sale, {
      方案处理类型: "补充履约",
      补充履约内容: "完成尚未达到约定的清洁内容",
      业务结案方式: "继续履约",
      方案说明: "不新增收费",
    });
    run("resident", "aftersale.respond", sale, {
      方案版本: sale["方案版本"],
      居民方案答复: "同意",
    });
  }
}
