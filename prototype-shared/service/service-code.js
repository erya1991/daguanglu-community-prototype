import { need } from "./common.js";

// One active code identifies one dispatched service order in this demo session.
export function issueServiceCode(orders, order, arrangement) {
  const used = new Set(orders.filter(item => item.credential?.凭证状态 === "有效" && item.结案结果 === "进行中")
    .map(item => item.credential.服务码).filter(Boolean));
  need(used.size < 1000000, "当前没有可用服务码");
  let number = Math.floor(Math.random() * 1000000);
  while (used.has(String(number).padStart(6, "0"))) number = (number + 1) % 1000000;
  order.credential = {
    服务码: String(number).padStart(6, "0"), 凭证状态: "有效",
    凭证对应服务订单号: order.服务订单号, 凭证对应服务日期: arrangement.安排服务日期,
    凭证对应开始时间: arrangement.安排开始时间, 凭证对应结束时间: arrangement.安排结束时间,
  };
}

export function upgradeServiceCodes(orders) {
  let changed = false;
  for (const order of orders) {
    if (order._flowVersion !== 2 || order.结案结果 !== "进行中" || order.服务完成时间 ||
        order.credential?.服务码 || order.credential?.凭证状态 === "已核验") continue;
    const arrangement = order.arrangements?.find(row => row.安排编号 === order.当前有效安排编号);
    if (arrangement) {
      issueServiceCode(orders, order, arrangement);
      changed = true;
    }
  }
  return changed;
}
