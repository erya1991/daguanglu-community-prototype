import { parseCSV } from "../import-houses.js";
import {
  domain,
  need,
  required,
  actor,
  get,
  revision,
  fen,
  yuan,
  houseFor,
  scopeFromHouse,
  makeId,
  history,
  now,
  day,
  clone,
} from "./common.js";
export const billColumns = [
  "来源账单编号",
  "房屋编号",
  "费用开始日期",
  "费用结束日期",
  "原始应收金额",
  "历史已结清金额",
  "缴费截止日期",
  "计费说明",
];
export const billTemplate =
  "\uFEFF" +
  billColumns.join(",") +
  "\r\n台账-1101,H-A,2026-11-01,2026-11-30,280.00,0,2026-11-30,11月物业服务费\r\n台账-1102,H-S01,2026-11-01,2026-11-30,320.00,0,,11月物业服务费\r\n";
export function refreshBill(r) {
  r.BL16 = Math.max(0, r.BL13 - r.BL14 - r.BL15);
  r.BL20 =
    r.BL16 === 0 ? "已结清" : r.BL14 + r.BL15 > 0 ? "部分结清" : "未结清";
  r.BL21 = r._pendingReconcile
    ? "已支付待核销"
    : !r.BL12
    ? "截止日未明确"
    : r.BL16 && r.BL12 < day()
    ? "到期未缴"
    : "未到期";
  return r;
}
function billData(s, a, data, source) {
  const h = houseFor(s, a, data.BL07),
    start = data.BL10,
    end = data.BL11;
  const validDate = (x) =>
    /^\d{4}-\d{2}-\d{2}$/.test(x || "") &&
    Number.isFinite(Date.parse(x)) &&
    new Date(x).toISOString().slice(0, 10) === x;
  need(validDate(start) && validDate(end) && start <= end, "费用期间无效", {
    BL10: "请核对期间",
    BL11: "请核对期间",
  });
  need(!data.BL12 || validDate(data.BL12), "缴费截止日期无效", {
    BL12: "请填写有效日期",
  });
  const amount = fen(data.BL13, "BL13"),
    paid = fen(data.BL14 || 0, "BL14");
  need(paid <= amount, "历史结清不能超过应收", { BL14: "金额超出应收" });
  return {
    ...scopeFromHouse(h),
    BL02: data.BL02 || "",
    BL03: h["所属社区"],
    BL04: h["所属小区"],
    BL05: h["所属楼栋"],
    BL06: h["所属单元"] || "",
    BL07: h._id,
    BL08: h["完整房屋地址"],
    BL09: "物业费",
    BL10: start,
    BL11: end,
    BL12: data.BL12 || "",
    BL13: amount,
    BL14: paid,
    BL15: 0,
    BL17: data.BL17 || "",
    BL18: domain(s).config.company,
    BL19: "待发布",
    BL22: source,
    BL23: "",
  };
}
export function importPreview(s, ctx, p) {
  const a = actor(s, ctx, true, true);
  required(p, ["text", "source"]);
  need(!p.text.includes("\uFFFD"), "文件不是有效UTF-8，请重新导出CSV");
  const parsed = parseCSV(p.text),
    headers = parsed.shift() || [];
  need(
    billColumns.every((c) => headers.includes(c)),
    "文件列不完整，请使用物业账单CSV样表"
  );
  const seen = new Map(),
    rows = parsed.map((cells) => {
      const raw = Object.fromEntries(
        headers.map((h, i) => [h, cells[i] || ""])
      );
      const prior = p.mappings?.[cells._line],
        data = {
          BL02: raw["来源账单编号"],
          BL07: prior?.house || raw["房屋编号"],
          BL10: raw["费用开始日期"],
          BL11: raw["费用结束日期"],
          BL12: raw["缴费截止日期"],
          BL13: raw["原始应收金额"],
          BL14: raw["历史已结清金额"] || "0",
          BL17: raw["计费说明"],
        };
      const r = {
        IR01: cells._line,
        IR02: raw["房屋编号"],
        IR03: data.BL07,
        IR04: "有效",
        IR05: "",
        IR06: "",
        IR07: "",
        IR08: prior?.note || "",
        raw,
        data,
      };
      try {
        if (prior?.house !== undefined)
          required({ IR08: prior.note }, ["IR08"]);
        r.validated = billData(s, a, data, p.source);
        const signature = [
            data.BL07,
            data.BL10,
            data.BL11,
            r.validated.BL13,
            r.validated.BL14,
            data.BL12,
          ].join("|"),
          key =
            p.source +
            "|" +
            (data.BL02 || [data.BL07, data.BL10, data.BL11].join("|"));
        const old = domain(s).bills.find((b) => b._sourceKey === key),
          inFile = seen.get(key);
        if (old || inFile) {
          r.IR07 = old?.BL01 || "本文件第" + inFile.line + "行";
          const oldSig = old?._signature || inFile.signature;
          r.IR04 = oldSig === signature ? "完全重复" : "冲突";
          r.IR05 = "来源账单编号／金额／期间";
          r.IR06 =
            r.IR04 === "冲突"
              ? "同一来源存在不同内容，请核查原账单"
              : "内容已存在，不再生成账单";
        }
        r.key = key;
        r.signature = signature;
        seen.set(key, { signature, line: cells._line });
      } catch (e) {
        r.IR04 = "错误";
        r.IR05 = Object.keys(e.fields || {}).join("、") || "房屋／期间／金额";
        r.IR06 = e.message;
      }
      return r;
    });
  return {
    IM04: "已校验",
    IM05: rows.length,
    IM06: rows.filter((r) => r.IR04 === "有效").length,
    IM07: rows.filter((r) => r.IR04 === "错误").length,
    IM08: rows.filter((r) => ["冲突", "完全重复"].includes(r.IR04)).length,
    rows,
  };
}
export function billingCommand(s, ctx, command, p) {
  const d = domain(s),
    a = actor(s, ctx, true, true);
  if (command === "import") {
    const preview = importPreview(s, ctx, p);
    need(preview.IM06 > 0, "没有可导入的有效行");
    need(
      (!preview.IM07 && !preview.IM08) || p.validOnly === true,
      "请明确确认仅导入有效行"
    );
    const id = makeId(s, "IM"),
      batch = {
        _id: id,
        _rev: 1,
        _org: a.org,
        _community: ctx.community || a["可查看社区"][0],
        _estate: ctx.estate || a["可查看小区"][0],
        IM01: {
          AT01: p.file?.name || "物业账单.csv",
          AT02: "text/csv",
          AT03:
            p.file?.size ||
            Array.from(p.text).reduce(
              (n, c) =>
                n +
                (c.codePointAt(0) < 128
                  ? 1
                  : c.codePointAt(0) < 2048
                  ? 2
                  : c.codePointAt(0) < 65536
                  ? 3
                  : 4),
              0
            ),
          AT04: p.text,
          AT05: a.name,
          AT06: now(),
          AT07: "成功",
          AT08: "",
        },
        IM02: p.source,
        IM03: id,
        IM04: preview.IM04,
        IM05: preview.IM05,
        IM06: preview.IM06,
        IM07: preview.IM07,
        IM08: preview.IM08,
        IM09: !!p.validOnly,
        IM10: preview.IM06,
        IM11: a.name,
        IM12: now(),
        IM13: "有效行已导入，账单仍待发布",
        rows: clone(preview.rows),
        history: [],
      };
    for (const r of preview.rows.filter((r) => r.IR04 === "有效")) {
      const bid = makeId(s, "BL"),
        bill = refreshBill({
          ...r.validated,
          _id: bid,
          _rev: 1,
          BL01: bid,
          _sourceKey: r.key,
          _signature: r.signature,
          _batch: id,
          history: [],
        });
      history(s, a, bill, "导入核验", {}, { BL19: "待发布" }, r.IR08);
      d.bills.push(bill);
      r.IR07 = bid;
      batch.rows.find((x) => x.IR01 === r.IR01).IR07 = bid;
    }
    d.batches.push(batch);
    return { id, message: "有效账单已导入，请核验发布" };
  }
  const r = get(s, a, "bills", p.id);
  revision(r, p);
  if (command === "editBill") {
    need(r.BL19 === "待发布", "已发布账单不能直接修改，请进入异常核查");
    const old = clone(r);
    const next = billData(s, a, p.data, r.BL22);
    Object.assign(r, next);
    r._sourceKey =
      r.BL22 + "|" + (r.BL02 || [r.BL07, r.BL10, r.BL11].join("|"));
    r._signature = [r.BL07, r.BL10, r.BL11, r.BL13, r.BL14, r.BL12].join("|");
    history(s, a, r, "核验更正", old, next, p.note || "");
    refreshBill(r);
  } else if (command === "publish") {
    need(r.BL19 === "待发布" && p.confirm === true, "请核对单张账单并确认发布");
    r.BL19 = "已发布";
    r.BL23 = now();
    history(
      s,
      a,
      r,
      "发布账单",
      { BL19: "待发布" },
      { BL19: "已发布" },
      "账单已发布",
      true
    );
  } else need(false, "不支持的账单操作");
  return { id: r._id, message: "办理已保存" };
}
