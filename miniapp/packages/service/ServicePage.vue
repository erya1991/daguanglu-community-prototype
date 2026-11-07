<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { service, APP } from "@/services/foundation";
import AppPage from "../ui/components/AppPage.vue";
import AppNavbar from "../ui/components/AppNavbar.vue";
import AppButton from "../ui/components/AppButton.vue";
import FormField from "../ui/components/FormField.vue";
import FieldGroup from "./FieldGroup.vue";
import Details from "./Details.vue";
import SupplyEditor from "./SupplyEditor.vue";
import VoucherCode from "./VoucherCode.vue";
import Picture from "./Picture.vue";
const props = withDefaults(
  defineProps<{
    mode: string;
    table?: string;
    id?: string;
    action?: string;
    spec?: string;
    method?: string;
    section?: string;
  }>(),
  { table: "", id: "", action: "", spec: "", method: "", section: "" },
);
const api = () => (service as any).service;
const rows = ref<any[]>([]),
  row = ref<any>(null),
  options = ref<any>({}),
  overview = ref<any>({}),
  error = ref(""),
  success = ref(""),
  busy = ref(false),
  saving = ref(false),
  search = ref(""),
  status = ref(""),
  date = ref(""),
  person = ref(""),
  category = ref(""),
  method = ref(""),
  form = ref<any>({}),
  fieldErrors = ref<any>({}),
  sheet = ref(false),
  selectedSpec = ref(""),
  selectedMethod = ref(""),
  voucherInput = ref(""),
  verified = ref<any>(null),
  operationId = ref(""),
  loaded = ref(false),
  more = ref(false);
const expandedCoverage = ref<string[]>([]);
const communityFilter = ref(""),
  estateFilter = ref(""),
  sortOrder = ref("综合排序");
const merchant = computed(() => APP === "merchant");
const table = computed(
  () =>
    props.table ||
    (
      {
        discover: "services",
        detail: "services",
        booking: "services",
        qualification: "qualifications",
        personnel: "personnel",
        supply: "services",
        orders: "orders",
        order: "orders",
        aftersales: "aftersales",
        "after-sale": "aftersales",
        evaluations: "evaluations",
        funds: "funds",
        voucher: "orders",
        verify: "orders",
        evaluation: "orders",
      } as any
    )[props.mode] ||
    "orders",
);
const isList = computed(() =>
  [
    "discover",
    "personnel",
    "supply",
    "orders",
    "aftersales",
    "evaluations",
    "funds",
  ].includes(props.mode),
);
const isAction = computed(() => ["action", "evaluation"].includes(props.mode));
const title = computed(
  () =>
    (
      ({
        discover: "便民服务",
        detail: row.value?.服务名称 || "服务详情",
        booking: "确认服务订单",
        qualification: "服务经营资格",
        personnel: "服务人员",
        supply: "服务管理",
        orders: "服务订单",
        order: "服务订单详情",
        action: action.value?.label || "业务办理",
        aftersales: "服务售后",
        "after-sale": "售后详情",
        evaluations: "服务评价",
        evaluation: "评价服务",
        overview: "服务经营",
        funds: "服务资金",
        workbench: "服务工作台",
        voucher: "到点凭证",
        verify: "到点核验",
      }) as any
    )[props.mode] || "便民服务",
);
const actions = computed(() =>
  Array.isArray(row.value?._actions) ? row.value._actions : [],
);
const commandName = computed(
  () => props.action || (props.mode === "evaluation" ? "evaluation.save" : ""),
);
const action = computed(
  () =>
    actions.value.find(
      (a: any) =>
        a.name === commandName.value &&
        (!props.section || a.label === props.section),
    ) || {
      name: commandName.value,
      label:
        (
          {
            "service.save": "新增服务项目",
            "personnel.save": "添加服务人员",
            "qualification.save": "申请经营范围",
            "aftersale.apply": "申请服务售后",
            "evaluation.save": "评价服务",
          } as any
        )[commandName.value] || "确认办理",
      fields: defaultTables(commandName.value),
    },
);
const fields = computed(() =>
  Array.isArray(action.value.fields)
    ? action.value.fields
    : defaultTables(commandName.value),
);
const formNames = computed(
  () =>
    (
      ({
        "qualification.save": [
          "申请服务类目",
          "申请覆盖社区",
          "申请覆盖小区",
          "申请说明",
          "服务资质材料",
        ],
        "personnel.save": [
          "姓名",
          "工作联系电话",
          "关联工作人员账号",
          "可执行服务类目",
          "技能说明",
          "人员资质材料",
          "内部备注",
        ],
        "personnel.status": ["人员状态", "启停原因"],
        "service.status": ["上架或下架原因", "暂停原因"],
        "aftersale.evidence": ["追加说明", "追加证据"],
        "aftersale.withdraw": ["撤回原因"],
        "order.accept": [
          "接单结果",
          "无法承接说明",
          "服务人员",
          "安排服务日期",
          "安排开始时间",
          "安排结束时间",
          "安排说明",
        ],
        "order.arrange": [
          "改期原因",
          "原安排仍可履行",
          "服务人员",
          "安排服务日期",
          "安排开始时间",
          "安排结束时间",
          "安排地点",
          "安排说明",
        ],
        "order.respond": ["居民安排答复", "居民答复说明"],
        "order.change": [
          "改期原因",
          "期望改期日期",
          "期望改期时段偏好",
          "原安排仍可履行",
        ],
        "order.arrive": ["到场说明", "到场图片"],
        "order.start": ["开始说明"],
        "order.process": ["过程记录类型", "过程说明", "过程图片"],
        "order.result": [
          "服务结果",
          "实际完成内容",
          "未完成内容",
          "未完成原因",
          "实际服务结束时间",
          "结果图片",
          "结果补充说明",
        ],
        "order.confirm": ["居民结果答复", "问题说明", "问题图片"],
        "order.cancel": ["申请原因"],
        "aftersale.apply": [
          "申请类型",
          "申请原因",
          "申请退款金额",
          "期望解决方式",
          "问题说明",
          "问题证据",
        ],
        "aftersale.plan": [
          "取消核实结果",
          "服务是否已实际开始",
          "核实依据说明",
          "核实依据附件",
          "方案处理类型",
          "拟退款金额",
          "金额依据说明",
          "补充履约内容",
          "业务结案方式",
          "方案说明",
        ],
        "aftersale.respond": ["居民方案答复", "居民方案答复说明"],
        "evaluation.save": ["总体评分", "评价内容", "评价图片"],
      }) as any
    )[commandName.value] || [],
);
const bookingData = computed(() => ({
  ...form.value,
  方式说明: combo.value["组合履约方式名称"],
  规格包含内容: spec.value["包含内容"],
  规格不包含内容: spec.value["不包含内容"],
  规格方式固定价: combo.value["组合固定价格"],
  应付总金额: combo.value["组合固定价格"],
  收款主体名称: row.value?.["收款主体名称"] || "青禾物业服务有限公司（演示）",
}));
function priceNumber(r: any) {
  const all = (r["服务规格集合"] || [])
    .filter((sp: any) => sp["规格启用状态"] !== "停用")
    .flatMap((sp: any) =>
      (sp["组合集合"] || [])
        .filter((c: any) => c["组合启用状态"] !== "停用")
        .map((c: any) => Number(c["组合固定价格"])),
    )
    .filter((n: number) => Number.isFinite(n));
  return all.length ? Math.min(...all) : Number(r._amount || 0) / 100;
}
const filtered = computed(() => {
  const result = rows.value.filter((r: any) => {
    const arrangement = r.currentArrangement || r["当前有效安排"];
    const combos = (r["服务规格集合"] || []).flatMap(
      (sp: any) => sp["组合集合"] || [],
    );
    return (
      (!search.value ||
        [label(r), subtitle(r), r._id].join(" ").includes(search.value)) &&
      (!status.value || statusLabel(r).includes(status.value)) &&
      (!date.value || arrangement?.["安排服务日期"] === date.value) &&
      (!person.value || arrangement?.["服务人员"] === person.value) &&
      (!category.value || r["所属服务类目"] === category.value) &&
      (!method.value ||
        (table.value === "services"
          ? combos.some((c: any) => c["组合履约方式名称"] === method.value)
          : r["履约方式名称"] === method.value)) &&
      (!communityFilter.value ||
        combos.some((c: any) =>
          (c["上门覆盖社区"] || []).includes(communityFilter.value),
        ) ||
        r._community === communityFilter.value) &&
      (!estateFilter.value ||
        combos.some((c: any) =>
          (c["上门覆盖小区"] || []).includes(estateFilter.value),
        ) ||
        r._estate === estateFilter.value)
    );
  });
  if (table.value === "services" && sortOrder.value !== "综合排序")
    result.sort(
      (a: any, b: any) =>
        (priceNumber(a) - priceNumber(b)) *
        (sortOrder.value === "价格从低到高" ? 1 : -1),
    );
  return result;
});
const specs = computed(
  () =>
    row.value?.["服务规格集合"] || row.value?.snapshot?.["服务规格集合"] || [],
);
const spec = computed(
  () =>
    specs.value.find((v: any) => v["规格编号"] === selectedSpec.value) ||
    specs.value[0] ||
    {},
);
const combos = computed(
  () => spec.value["组合集合"] || spec.value["规格方式组合"] || [],
);
const combo = computed(
  () =>
    combos.value.find(
      (v: any) => v["组合履约方式名称"] === selectedMethod.value,
    ) ||
    combos.value[0] ||
    {},
);
const activeArrangement = computed(
  () =>
    row.value?.currentArrangement ||
    row.value?.["当前有效安排"] ||
    row.value?.arrangements?.find((a: any) => a.安排状态 === "已确认") ||
    null,
);
const proposal = computed(
  () =>
    row.value?.proposal ||
    row.value?.currentProposal ||
    row.value?.["当前安排提案"] ||
    row.value?.arrangements?.[row.value.arrangements.length - 1] ||
    null,
);
const result = computed(
  () =>
    row.value?.result ||
    row.value?.currentResult ||
    row.value?.["当前结果"] ||
    row.value?.rounds?.[row.value.rounds.length - 1]?.result ||
    null,
);
const topMenus = computed(() =>
  merchant.value
    ? [
        { label: "待接单与服务订单", page: "orders" },
        { label: "服务供给", page: "supply" },
        { label: "服务人员", page: "personnel" },
        { label: "服务售后", page: "aftersales" },
        { label: "经营查询", page: "overview" },
        { label: "服务资金", page: "funds" },
        { label: "经营资格", page: "qualification" },
        { label: "服务评价", page: "evaluations" },
      ]
    : [
        { label: "发现服务", page: "catalog" },
        { label: "我的服务订单", page: "orders" },
      ],
);
function queryFilters() {
  try {
    return props.section.startsWith("{") ? JSON.parse(props.section) : {};
  } catch {
    return {};
  }
}
const metricRows = computed(() =>
  Array.isArray(overview.value.metrics)
    ? overview.value.metrics
    : Object.entries(overview.value.metrics || overview.value.values || {}).map(
        ([name, value]) => ({ name, value, table: "orders", filters: {} }),
      ),
);
function metricGo(metric: any) {
  go(metric.table === "funds" ? "funds" : "orders", {
    section: JSON.stringify(metric.filters || {}),
  });
}
const newCommand = computed(() =>
  merchant.value
    ? (
        {
          personnel: "personnel.save",
          supply: "service.save",
          qualification: "qualification.save",
        } as any
      )[props.mode] || ""
    : "",
);
const newLabel = computed(
  () =>
    (
      ({
        personnel: "添加服务人员",
        supply: "新增服务项目",
        qualification: "申请服务经营范围",
      }) as any
    )[props.mode] || "新增",
);
function defaultTables(name: string) {
  return (
    (
      {
        "qualification.save": ["26-C"],
        "personnel.save": ["26-E"],
        "service.save": ["27-C", "27-D"],
        "order.arrange": ["28-B"],
        "order.respond": ["28-B"],
        "order.change": ["28-C"],
        "order.arrive": ["30-A"],
        "order.verify": ["30-B"],
        "order.start": ["30-A"],
        "order.process": ["30-C"],
        "order.result": ["30-C"],
        "order.confirm": ["30-D"],
        "order.cancel": ["31-A"],
        "order.anomaly": ["30-E"],
        "aftersale.apply": ["31-A"],
        "aftersale.plan": ["31-B"],
        "aftersale.respond": ["31-B"],
        "aftersale.evidence": ["31-C"],
        "evaluation.save": ["31-E"],
      } as any
    )[name] || []
  );
}
function label(r: any) {
  return (
    r._title ||
    r["服务名称"] ||
    r["服务项目名称"] ||
    r["姓名"] ||
    r["人员姓名"] ||
    r["商户名称"] ||
    r["经营店铺名称"] ||
    r["服务订单号"] ||
    r["售后单号"] ||
    r["业务单号"] ||
    r._id
  );
}
function availableCombos(r: any) {
  return (r["服务规格集合"] || [])
    .filter((sp: any) => sp["规格启用状态"] !== "停用")
    .flatMap((sp: any) => sp["组合集合"] || [])
    .filter((c: any) => c["组合启用状态"] !== "停用");
}
function serviceMethods(r: any) {
  return [
    ...new Set(availableCombos(r).map((c: any) => c["组合履约方式名称"])),
  ].join("、");
}
function serviceCoverage(r: any): string[] {
  const lines: string[] = [];
  for (const c of availableCombos(r)) {
    if (c["组合履约方式名称"] === "上门") {
      const communities = (c["上门覆盖社区"] || []).map(
        (id: string) =>
          options.value.communities?.find((o: any) => o.value === id)?.label ||
          id,
      );
      const estates = (c["上门覆盖小区"] || []).map(
        (id: string) =>
          options.value.estates?.find((o: any) => o.value === id)?.label || id,
      );
      lines.push(
        "上门：" + [...new Set([...communities, ...estates])].join("、"),
      );
    } else
      for (const p of c["可服务门店或服务点"] || []) {
        if (p["地点状态"] !== "停用")
          lines.push(
            "到点：" +
              p["地点名称"] +
              (p["详细地址"] ? "（" + p["详细地址"] + "）" : ""),
          );
      }
  }
  return [...new Set(lines)];
}
function toggleCoverage(id: string) {
  expandedCoverage.value = expandedCoverage.value.includes(id)
    ? expandedCoverage.value.filter((v) => v !== id)
    : [...expandedCoverage.value, id];
}
function subtitle(r: any) {
  return (
    r._subtitle ||
    [
      r["服务规格名称"] || r["规格名称"],
      r["履约方式名称"] || r["选定履约方式"] || r["履约方式"],
      r["经营店铺名称"],
      r["联系人姓名"],
    ]
      .filter(Boolean)
      .join(" · ")
  );
}
function statusLabel(r: any) {
  if (APP === "resident" && table.value === "services")
    return r["可售状态说明"] || r["当前可售提示"] || "可预约";
  return (
    r._status ||
    r["当前业务进度"] ||
    r["业务进度"] ||
    r["订单业务进度"] ||
    r["服务订单状态"] ||
    r["售后状态"] ||
    r["人员状态"] ||
    r["审核状态"] ||
    r["申请状态"] ||
    r["资金状态"] ||
    r["支付状态"] ||
    r["上架状态"] ||
    ""
  );
}
function price(r: any) {
  if (r._amount !== undefined) return money(r._amount);
  const prices = (r["服务规格集合"] || [])
    .flatMap((s: any) =>
      (s["组合集合"] || []).map((c: any) => Number(c["组合固定价格"])),
    )
    .filter((n: number) => Number.isFinite(n));
  return prices.length
    ? "¥" + Math.min(...prices).toFixed(2) + "起"
    : r["应付总金额"] !== undefined
      ? "¥" + Number(r["应付总金额"]).toFixed(2)
      : "";
}
function money(v: any) {
  return "¥" + (Number(v || 0) / 100).toFixed(2);
}
function go(page: string, params: any = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v)),
    )
    .join("&");
  uni.navigateTo({
    url: "/pages/service/" + page + (query ? "?" + query : ""),
  });
}
function openRecord(r: any) {
  if (table.value === "services" && !merchant.value)
    go("detail", { id: r._id });
  else if (table.value === "orders") go("order", { id: r._id });
  else if (table.value === "aftersales") go("after-sale", { id: r._id });
  else go("action", { table: table.value, id: r._id, action: "" });
}
function editRecord(r: any, command: string) {
  go("action", { table: table.value, id: r?._id || "", action: command });
}
function act(a: any) {
  if (a.name === "order.verify") {
    go("verify", { id: row.value._id });
    return;
  }
  go("action", {
    table: table.value,
    id: row.value?._id || "",
    action: a.name,
    section: a.label,
  });
}
function seedForm() {
  const name = commandName.value,
    r = row.value || {},
    data: any = { ...(action.value.defaults || {}) };
  if (/\.save$/.test(name) && name !== "evaluation.save")
    Object.assign(data, JSON.parse(JSON.stringify(r)));
  if (["order.arrange", "order.accept"].includes(name))
    Object.assign(data, {
      服务人员: options.value.personnel?.[0]?._id || "",
      安排服务日期: options.value.today || "2026-11-07",
      安排开始时间: "09:00",
      安排结束时间: "11:00",
      原安排仍可履行: true,
    });
  if (name === "order.respond")
    Object.assign(data, {
      安排版本:
        proposal.value?.["安排版本"] ||
        proposal.value?.version ||
        proposal.value?._rev ||
        1,
      居民安排答复: "接受",
    });
  if (name === "order.result")
    Object.assign(data, {
      服务结果: "全部完成",
      实际服务结束时间: options.value.clock || "2026-11-07T09:00",
      结果图片: [],
    });
  if (name === "order.confirm")
    Object.assign(data, {
      当前待确认结果版本:
        result.value?.["结果版本"] || result.value?.version || 1,
      居民结果答复: "确认完成",
    });
  if (name === "order.arrive")
    Object.assign(data, {
      实际到场时间: options.value.clock || "2026-11-07T09:00",
    });
  if (name === "order.start")
    Object.assign(data, {
      实际服务开始时间: options.value.clock || "2026-11-07T09:00",
    });
  if (name === "aftersale.apply")
    Object.assign(data, {
      服务订单号: props.id,
      申请类型: "申请退款",
      期望解决方式: "协商解决",
    });
  if (name === "aftersale.plan")
    Object.assign(data, {
      方案处理类型: "部分退款",
      业务结案方式: "部分履行终止",
    });
  if (name === "aftersale.respond")
    Object.assign(data, {
      方案版本:
        r.plans?.[r.plans.length - 1]?.["方案版本"] || r["方案版本"] || 1,
      居民方案答复: "同意",
    });
  if (name === "evaluation.save")
    Object.assign(data, { 总体评分: 5, 评价图片: [] });
  return data;
}
async function load() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await service.start();
    options.value = await api().options();
    if (["workbench", "overview"].includes(props.mode))
      overview.value = await api().overview(
        props.mode === "overview"
          ? {
              start: form.value.start || "2026-11-01",
              end: form.value.end || "2026-11-06",
              serviceDate: form.value.serviceDate || "2026-11-07",
            }
          : {},
      );
    else if (props.id) {
      row.value = await api().record(table.value, props.id);
      if (table.value === "orders") {
        row.value.aftersales = (await api().query("aftersales")).filter(
          (r: any) => r._order === props.id,
        );
        if (resumeAftersale(row.value)) return;
      }
      if (props.mode === "booking") {
        selectedSpec.value = props.spec || specs.value[0]?.["规格编号"] || "";
        selectedMethod.value =
          props.method || combo.value["组合履约方式名称"] || "上门";
        form.value = {
          选定服务项目: props.id,
          选定服务规格: selectedSpec.value,
          选定履约方式: selectedMethod.value,
          期望时间选择: "指定日期",
          期望服务日期: options.value.today || "2026-11-07",
          联系人姓名: "",
          联系人电话: "",
          上门地址来源: "本次填写",
          上门服务地址: { 所属社区: "C-A", 所属小区: "E-A", 详细地址: "" },
          到点服务地点:
            combo.value["可服务门店或服务点"]?.[0]?.["地点业务编号"] || "",
          服务约定确认: false,
          需求图片: [],
        };
      } else if (isAction.value) form.value = seedForm();
    } else if (props.mode === "qualification") {
      rows.value = await api().query("qualifications");
      row.value = rows.value[0] || null;
    } else if (isAction.value) {
      form.value = seedForm();
    } else rows.value = await api().query(table.value, queryFilters());
    if (!operationId.value)
      operationId.value =
        "service-ui-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    if ((isAction.value && commandName.value) || props.mode === "booking") {
      const draft = await service.draft(
        "service:" +
          APP +
          ":" +
          (props.id || "new") +
          ":" +
          (commandName.value || "booking"),
      );
      if (draft?.data)
        form.value = { ...draft.data, ...(action.value.defaults || {}) };
      if (props.mode === "booking") form.value = bookingPayload(form.value);
      if (draft?.operationId) operationId.value = draft.operationId;
    }
    loaded.value = true;
  } catch (e: any) {
    error.value = e.message || "加载失败，请重试";
  } finally {
    busy.value = false;
  }
}
function updateForm(v: any) {
  form.value = v;
  if (loaded.value && (isAction.value || props.mode === "booking"))
    service
      .draft(
        "service:" +
          APP +
          ":" +
          (props.id || "new") +
          ":" +
          (commandName.value || "booking"),
        { data: v, operationId: operationId.value },
      )
      .catch(() => {});
}
function bookingPayload(value: any) {
  const data = {
    ...value,
    选定服务项目: props.id,
    选定服务规格: selectedSpec.value,
    选定履约方式: selectedMethod.value,
  };
  if (selectedMethod.value === "预约到点") {
    delete data["上门服务地址"];
    delete data["上门地址来源"];
    const points = combo.value["可服务门店或服务点"] || [];
    if (!points.some((p: any) => p["地点业务编号"] === data["到点服务地点"]))
      data["到点服务地点"] = "";
  } else {
    delete data["到点服务地点"];
    if (!data["上门服务地址"])
      data["上门服务地址"] = { 所属社区: "C-A", 所属小区: "E-A", 详细地址: "" };
  }
  return data;
}
function normalize(data: any) {
  const d = JSON.parse(JSON.stringify(data));
  if (commandName.value === "order.respond")
    d["安排版本"] = Number(d["安排版本"]);
  if (commandName.value === "order.confirm")
    d["当前待确认结果版本"] = Number(d["当前待确认结果版本"]);
  if (commandName.value === "aftersale.respond")
    d["方案版本"] = Number(d["方案版本"]);
  return d;
}
function finishObject(tableName: string, id: string) {
  const target =
    tableName === "orders" ? "pages/service/order" : "pages/service/after-sale";
  const url = "/" + target + "?id=" + encodeURIComponent(id);
  const pages = getCurrentPages() as any[];
  const previous = pages[pages.length - 2];
  const previousId = previous?.options?.id || previous?.$page?.options?.id;
  const redirect = () => uni.redirectTo({ url });
  if (previous?.route === target && previousId === id)
    uni.navigateBack({ delta: 1, fail: redirect });
  else redirect();
}
function resumeAftersale(order: any) {
  if (commandName.value !== "aftersale.apply" || table.value !== "orders")
    return false;
  const existing = order?.currentAftersale;
  if (!existing?._id) return false;
  uni.showToast({ title: "本单已有进行中售后，已打开原记录", icon: "none" });
  finishObject("aftersales", existing._id);
  return true;
}
async function submit() {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  fieldErrors.value = {};
  try {
    const result = await api().command(commandName.value, {
      id: props.id || undefined,
      revision: row.value?._rev,
      operationId: operationId.value,
      data: normalize(form.value),
    });
    success.value = result.message || "已保存";
    await service.draft(
      "service:" + APP + ":" + (props.id || "new") + ":" + commandName.value,
      null,
    );
    if (result.table === "evaluations")
      finishObject("orders", result.record?._order || props.id);
    else if (["orders", "aftersales"].includes(result.table))
      finishObject(result.table, result.id);
    else {
      row.value =
        result.record ||
        (await api().record(result.table || table.value, result.id));
      operationId.value = "service-ui-" + Date.now();
      uni.showToast({ title: success.value, icon: "none" });
      const target =
        result.table === "services"
          ? "pages/service/supply"
          : result.table === "personnel"
            ? "pages/service/personnel"
            : "pages/service/qualification";
      const pages = getCurrentPages() as any[];
      const previous = pages[pages.length - 2];
      const previousId = previous?.options?.id || previous?.$page?.options?.id;
      const redirect = () => uni.redirectTo({ url: "/" + target });
      // A direct/deep link has no valid business return page. Replacing it avoids
      // returning to an earlier copy of the same form and resubmitting it.
      if (
        previous &&
        (previous.route === target ||
          (previousId === result.id && !previous.route?.endsWith("/action")))
      )
        uni.navigateBack({ delta: 1, fail: redirect });
      else redirect();
    }
  } catch (e: any) {
    if (commandName.value === "aftersale.apply" && props.id) {
      try {
        const latest = await api().record("orders", props.id);
        if (resumeAftersale(latest)) return;
      } catch {
        // Preserve the command error and draft if the original record cannot be read.
      }
    }
    error.value = e.message || "提交失败，输入已保留";
    fieldErrors.value = e.fields || e.errors || {};
  } finally {
    saving.value = false;
  }
}
function selectSpec(s: any) {
  selectedSpec.value = s["规格编号"];
  selectedMethod.value = (s["组合集合"] || [])[0]?.["组合履约方式名称"] || "";
}
function book() {
  if (!spec.value["规格编号"] || !combo.value["组合履约方式名称"]) {
    error.value = "请选择有效规格与服务方式";
    return;
  }
  sheet.value = false;
  go("booking", {
    id: row.value._id,
    spec: spec.value["规格编号"],
    method: combo.value["组合履约方式名称"],
  });
}
async function createOrder() {
  if (saving.value) return;
  if (!form.value["服务约定确认"]) {
    error.value = "请阅读并确认服务约定";
    fieldErrors.value = { 服务约定确认: "请先确认服务内容与取消规则" };
    return;
  }
  const ok = await new Promise<boolean>((resolve) =>
    uni.showModal({
      title: "确认付款",
      content: "本次为演示支付，不会真实扣款。确认订单后将按本单固定总价付款。",
      success: (r) => resolve(r.confirm),
    }),
  );
  if (!ok) return;
  saving.value = true;
  error.value = "";
  try {
    const data = bookingPayload(form.value);
    const result = await api().command("order.create", {
      operationId: operationId.value,
      data,
    });
    try {
      await api().command("order.pay", {
        id: result.id,
        revision: result.record?._rev,
        operationId: operationId.value + "-pay",
        data: {},
      });
    } catch (e: any) {
      error.value = e.message;
    }
    await service.draft("service:" + APP + ":" + props.id + ":booking", null);
    finishObject("orders", result.id);
  } catch (e: any) {
    error.value = e.message || "订单提交失败，输入已保留";
    fieldErrors.value = e.fields || {};
  } finally {
    saving.value = false;
  }
}
async function quick(a: any) {
  if (a.name === "order.pay") {
    const ok = await new Promise<boolean>((resolve) =>
      uni.showModal({
        title: "确认付款",
        content: "演示支付，不会真实扣款。付款金额以原订单快照为准。",
        success: (r) => resolve(r.confirm),
      }),
    );
    if (!ok) return;
    await execute(a.name, {});
  } else if (a.name === "order.confirm") {
    const ok = await new Promise<boolean>((resolve) =>
      uni.showModal({
        title: "确认履约完成",
        content: "请确认本轮服务结果与约定一致。此操作与确认服务安排分别记录。",
        success: (r) => resolve(r.confirm),
      }),
    );
    if (!ok) return;
    await execute(a.name, {
      当前待确认结果版本:
        result.value?.["结果版本"] || result.value?.version || 1,
      居民结果答复: "确认完成",
    });
  } else act(a);
}
async function execute(name: string, data: any) {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    await api().command(name, {
      id: row.value._id,
      revision: row.value._rev,
      operationId: "service-ui-" + Date.now(),
      data,
    });
    await load();
    success.value = "操作已完成";
  } catch (e: any) {
    error.value = e.message || "操作失败，请重试";
  } finally {
    saving.value = false;
  }
}
async function queryVoucher() {
  error.value = "";
  verified.value = null;
  try {
    const list = props.id
      ? [await api().record("orders", props.id)]
      : await api().query("orders", {});
    const code = voucherInput.value.trim();
    const match = list.find(
      (r: any) =>
        (r.credential?.["到点凭证码"] || r["到点凭证码"] || "") === code ||
        (r.credential?.["到点凭证二维码"] || "") === code,
    );
    if (!voucherInput.value.trim() || !match)
      throw Error("未找到可核验的服务凭证，请检查后重试");
    await api().command("order.verify", {
      id: match._id,
      revision: match._rev,
      operationId: "service-lookup-" + Date.now(),
      data: {
        到点凭证码:
          match.credential?.["到点凭证码"] || voucherInput.value.trim(),
        当前核验地点:
          match["地点快照"]?.["地点业务编号"] ||
          match.credential?.["地点业务编号"] ||
          "",
        确认到点: false,
      },
    });
    verified.value = match;
    row.value = match;
  } catch (e: any) {
    error.value = e.message;
  }
}
async function verifyPoint() {
  const ok = await new Promise<boolean>((resolve) =>
    uni.showModal({
      title: "确认到点",
      content:
        "请核对商户、地点和本次有效安排。确认到点只记录到点事实，不代表服务完成。",
      success: (r) => resolve(r.confirm),
    }),
  );
  if (!ok) return;
  await execute("order.verify", {
    到点凭证码: matchCredentialCode(),
    当前核验地点: verified.value?.["地点快照"]?.["地点业务编号"] || "",
    核验说明: form.value["核验说明"] || "",
    确认到点: true,
  });
  verified.value = null;
}
function matchCredentialCode() {
  return (
    verified.value?.credential?.["到点凭证码"] || voucherInput.value.trim()
  );
}
function scan() {
  // #ifdef MP-WEIXIN
  uni.scanCode({
    onlyFromCamera: false,
    success: (r) => {
      voucherInput.value = r.result;
      queryVoucher();
    },
    fail: () => (error.value = "扫码未完成，可手动输入凭证码"),
  });
  // #endif
  // #ifdef H5
  error.value = "浏览器演示请手动输入凭证码；微信扫码能力单独验证";
  // #endif
}
const off = service.onChange(() => {
  if (!isAction.value && props.mode !== "booking") load();
});
onShow(load);
onUnmounted(off);
watch(
  () => [props.id, props.mode],
  () => {
    loaded.value = false;
    load();
  },
);
</script>
<template>
  <AppPage
    secondary
    with-bottom-action
    :status="busy && !loaded ? 'loading' : 'ready'"
    @retry="load"
    ><template #navbar><AppNavbar :title="title" show-back /></template>
    <view class="service-page svc-view">
      <view v-if="error" class="message error svc-view" role="alert"
        ><text class="svc-text">{{ error }}</text
        ><text v-if="!loaded" class="retry svc-text" @click="load"
          >重试</text
        ></view
      ><view v-if="success" class="message success svc-view">{{
        success
      }}</view>
      <template v-if="mode === 'workbench'">
        <view class="hero svc-view"
          ><text class="eyebrow svc-text">便民服务</text
          ><text class="hero-title svc-text">今天的服务待办</text
          ><text class="muted svc-text"
            >按状态办理，服务安排与履约结果分别确认。</text
          ></view
        >
        <view class="menu-grid svc-view"
          ><view
            v-for="m in topMenus"
            :key="m.page"
            class="menu-tile svc-view"
            @click="go(m.page)"
            ><text class="svc-text">{{ m.label }}</text
            ><text class="svc-text">›</text></view
          ></view
        >
        <view class="metric-grid svc-view"
          ><view
            v-for="metric in metricRows.slice(0, 9)"
            :key="metric.name"
            class="metric svc-view"
            @click="metricGo(metric)"
            ><text class="muted svc-text">{{ metric.name }}</text
            ><text class="metric-value svc-text">{{ metric.value }}</text></view
          ></view
        >
      </template>
      <template v-else-if="mode === 'overview'">
        <view class="hero svc-view"
          ><text class="hero-title svc-text">服务经营</text
          ><text class="muted svc-text"
            >期间指标与当前待办分别统计，各指标按自身事件时间查询原记录。</text
          ></view
        >
        <view class="period svc-view"
          ><picker
            class="svc-picker"
            mode="date"
            :value="form.start || '2026-11-01'"
            @change="form.start = $event.detail.value"
            ><text class="svc-text">{{
              form.start || "2026-11-01"
            }}</text></picker
          ><text class="svc-text">至</text
          ><picker
            class="svc-picker"
            mode="date"
            :value="form.end || '2026-11-06'"
            @change="form.end = $event.detail.value"
            ><text class="svc-text">{{
              form.end || "2026-11-06"
            }}</text></picker
          ><button class="svc-button" @click="load">查询</button></view
        >
        <view class="period svc-view"
          ><text class="svc-text">安排服务日</text
          ><picker
            class="svc-picker"
            mode="date"
            :value="form.serviceDate || '2026-11-07'"
            @change="
              form.serviceDate = $event.detail.value;
              load();
            "
            ><text class="svc-text">{{
              form.serviceDate || "2026-11-07"
            }}</text></picker
          ></view
        >
        <view class="metric-grid svc-view"
          ><view
            v-for="metric in metricRows"
            :key="metric.name"
            class="metric svc-view"
            @click="metricGo(metric)"
            ><text class="muted svc-text">{{ metric.name }}</text
            ><text class="metric-value svc-text">{{ metric.value }}</text
            ><text class="muted svc-text">{{ metric.basis }}</text></view
          ></view
        >
      </template>
      <template v-else-if="isList"
        ><view class="list-heading svc-view"
          ><text class="list-title svc-text">{{
            mode === "discover" ? "预约专业便民服务" : title
          }}</text
          ><button
            v-if="newCommand"
            class="new-button svc-button"
            @click="editRecord(null, newCommand)"
          >
            {{ newLabel }}
          </button></view
        ><view class="search svc-view"
          ><input
            v-model="search"
            :data-field="mode === 'discover' ? '29-A.01' : undefined"
            :data-field-name="mode === 'discover' ? '搜索关键词' : undefined"
            :placeholder="
              mode === 'discover' ? '搜索服务名称、店铺' : '搜索编号、服务名称'
            "
            confirm-type="search"
          /><text class="svc-text" @click="more = !more">筛选</text></view
        ><view v-if="more" class="filter-panel svc-view"
          ><FormField
            label="服务方式"
            :data-field="mode === 'discover' ? '29-A.03' : undefined"
            ><picker
              class="svc-picker"
              :range="['全部', '上门', '预约到点']"
              @change="
                method = ['', '上门', '预约到点'][Number($event.detail.value)]
              "
              ><view class="pick svc-view">{{ method || "全部" }}</view></picker
            ></FormField
          ><FormField
            v-if="mode === 'discover'"
            label="服务分类"
            data-field="29-A.02"
            ><picker
              class="svc-picker"
              :range="[
                { 类目名称: '全部', _id: '' },
                ...(options.categories || []),
              ]"
              range-key="类目名称"
              @change="
                category = Number($event.detail.value)
                  ? options.categories[Number($event.detail.value) - 1]._id
                  : ''
              "
              ><view class="pick svc-view">{{
                options.categories?.find((r: any) => r._id === category)
                  ?.类目名称 || "全部"
              }}</view></picker
            ></FormField
          ><FormField
            v-if="mode === 'discover'"
            label="社区"
            data-field="29-A.04"
            ><picker
              class="svc-picker"
              :range="[
                { value: '', label: '全部' },
                ...(options.communities || []),
              ]"
              range-key="label"
              @change="
                communityFilter = Number($event.detail.value)
                  ? options.communities[Number($event.detail.value) - 1].value
                  : '';
                estateFilter = '';
              "
              ><view class="pick svc-view">{{
                options.communities?.find(
                  (r: any) => r.value === communityFilter,
                )?.label || "全部"
              }}</view></picker
            ></FormField
          >
          <FormField
            v-if="mode === 'discover'"
            label="小区"
            data-field="29-A.05"
            ><picker
              class="svc-picker"
              :range="[
                { value: '', label: '全部' },
                ...(options.estates || []).filter(
                  (r: any) =>
                    !communityFilter || r.community === communityFilter,
                ),
              ]"
              range-key="label"
              @change="
                estateFilter = Number($event.detail.value)
                  ? options.estates.filter(
                      (r: any) =>
                        !communityFilter || r.community === communityFilter,
                    )[Number($event.detail.value) - 1].value
                  : ''
              "
              ><view class="pick svc-view">{{
                options.estates?.find((r: any) => r.value === estateFilter)
                  ?.label || "全部"
              }}</view></picker
            ></FormField
          >
          <FormField
            v-if="mode === 'discover'"
            label="排序"
            data-field="29-A.06"
            ><picker
              class="svc-picker"
              :range="['综合排序', '价格从低到高', '价格从高到低']"
              @change="
                sortOrder = ['综合排序', '价格从低到高', '价格从高到低'][
                  Number($event.detail.value)
                ]
              "
              ><view class="pick svc-view">{{ sortOrder }}</view></picker
            ></FormField
          >
          <FormField
            v-if="mode === 'orders' && merchant"
            label="服务人员"
            data-field="28-D.02"
            ><picker
              class="svc-picker"
              :range="[
                { value: '', label: '全部' },
                ...(options.personnel || []),
              ]"
              range-key="label"
              @change="
                person = Number($event.detail.value)
                  ? options.personnel[Number($event.detail.value) - 1]._id
                  : ''
              "
              ><view class="pick svc-view">{{
                options.personnel?.find((r: any) => r._id === person)?.label ||
                "全部"
              }}</view></picker
            ></FormField
          >
          <FormField v-if="mode === 'orders'" label="当前进度"
            ><input
              v-model="status"
              placeholder="如：待接单、待居民确认" /></FormField
          ><FormField
            v-if="mode === 'orders' && merchant"
            label="服务日期"
            data-field="28-D.01"
            ><picker
              class="svc-picker"
              mode="date"
              :value="date"
              @change="date = $event.detail.value"
              ><view class="pick svc-view">{{
                date || "全部日期"
              }}</view></picker
            ></FormField
          ><button
            class="text-button svc-button"
            @click="
              status = '';
              date = '';
              category = '';
              method = '';
            "
          >
            清除筛选
          </button></view
        ><view v-if="!filtered.length" class="empty svc-view"
          ><text class="svc-text">暂无符合条件的记录</text
          ><text class="muted svc-text">调整筛选，或稍后重新查询。</text
          ><button class="svc-button" @click="load">重新查询</button></view
        ><view
          v-for="r in filtered"
          :key="r._id"
          class="record-card svc-view"
          @click="openRecord(r)"
          ><Picture
            v-if="table === 'services'"
            :value="r['服务主图']"
            table="services"
            :record-id="r._id"
          /><view class="card-top svc-view"
            ><text
              class="card-title svc-text"
              :data-field="mode === 'discover' ? '29-A.08' : undefined"
              >{{ label(r) }}</text
            ><text
              v-if="statusLabel(r)"
              class="status svc-text"
              :data-field="mode === 'discover' ? '29-A.13' : undefined"
              >{{ statusLabel(r) }}</text
            ></view
          ><template v-if="mode === 'discover'">
            <text class="muted svc-text" data-field="29-A.09">{{
              r["经营店铺名称"]
            }}</text>
            <text class="muted svc-text" data-field="29-A.11">{{
              serviceMethods(r)
            }}</text>
            <view
              class="coverage svc-view"
              data-field="29-A.12"
              @click.stop="toggleCoverage(r._id)"
            >
              <text
                v-for="line in expandedCoverage.includes(r._id)
                  ? serviceCoverage(r)
                  : serviceCoverage(r).slice(0, 1)"
                :key="line"
                class="muted svc-text"
                >{{ line }}</text
              >
              <text
                v-if="serviceCoverage(r).length > 1"
                class="coverage-toggle svc-text"
                >{{
                  expandedCoverage.includes(r._id)
                    ? "收起适用地点"
                    : "展开全部适用地点"
                }}</text
              >
            </view> </template
          ><text v-else-if="subtitle(r)" class="muted svc-text">{{
            subtitle(r)
          }}</text>
          <view
            v-if="mode === 'orders' && merchant && r.currentArrangement"
            class="arrangement-line svc-view"
          >
            <text class="muted svc-text">当前已确认：</text>
            <text class="svc-text" data-field="28-D.03">{{
              r.currentArrangement["安排服务日期"]
            }}</text>
            <text class="svc-text" data-field="28-D.04">{{
              r.currentArrangement["安排开始时间"]
            }}</text
            ><text class="svc-text">至</text>
            <text class="svc-text" data-field="28-D.05">{{
              r.currentArrangement["安排结束时间"]
            }}</text> </view
          ><view class="card-bottom svc-view"
            ><text
              class="amount svc-text"
              :data-field="mode === 'discover' ? '29-A.10' : undefined"
              >{{ price(r) }}</text
            ><text class="link svc-text">{{
              mode === "discover" ? "查看服务 ›" : "查看详情 ›"
            }}</text></view
          ><text v-if="mode !== 'discover'" class="record-no svc-text">{{
            r._id
          }}</text></view
        ></template
      >
      <template v-else-if="mode === 'detail' && row"
        ><view class="hero svc-view"
          ><Picture
            :value="row['服务主图']"
            table="services"
            :record-id="row._id"
            large
          /><text class="eyebrow svc-text">{{
            row["经营店铺名称"] || "社区便民服务"
          }}</text
          ><text class="hero-title svc-text">{{ row["服务名称"] }}</text
          ><text class="amount svc-text">{{ price(row) }}</text
          ><text class="muted svc-text">{{
            row["服务简介"] || row["服务详细说明"]
          }}</text></view
        ><Details table="services" :record="row" :options="options" /><view
          class="bottom-actions svc-view"
          ><AppButton @click="sheet = true">选择规格与服务方式</AppButton></view
        ><view v-if="sheet" class="sheet-mask svc-view" @click="sheet = false"
          ><view class="sheet svc-view" @click.stop
            ><view class="sheet-heading svc-view"
              ><text class="svc-text">选择规格与方式</text
              ><text class="close svc-text" @click="sheet = false"
                >关闭</text
              ></view
            ><text class="section-label svc-text">服务规格</text
            ><view class="chips svc-view"
              ><view
                v-for="s in specs"
                :key="s['规格编号']"
                class="chip svc-view"
                :class="{ selected: spec['规格编号'] === s['规格编号'] }"
                @click="selectSpec(s)"
                >{{ s["规格名称"] }}</view
              ></view
            ><text class="section-label svc-text">服务方式</text
            ><view class="chips svc-view"
              ><view
                v-for="c in combos"
                :key="c['组合履约方式名称']"
                class="chip svc-view"
                :class="{
                  selected: combo['组合履约方式名称'] === c['组合履约方式名称'],
                }"
                @click="selectedMethod = c['组合履约方式名称']"
                >{{ c["组合履约方式名称"] }} · ¥{{ c["组合固定价格"] }}</view
              ></view
            ><text class="muted svc-text">{{ spec["包含内容"] }}</text
            ><text v-if="spec['不包含内容']" class="muted svc-text"
              >不包含：{{ spec["不包含内容"] }}</text
            ><AppButton @click="book">确认选择，去预约</AppButton></view
          ></view
        ></template
      >
      <template v-else-if="mode === 'booking' && row"
        ><view class="hero compact svc-view"
          ><text class="hero-title svc-text">{{ row["服务名称"] }}</text
          ><text class="svc-text"
            >{{ spec["规格名称"] }} · {{ combo["组合履约方式名称"] }}</text
          ><text class="amount svc-text">¥{{ combo["组合固定价格"] }}</text
          ><text class="muted svc-text">{{ spec["包含内容"] }}</text
          ><text v-if="spec['不包含内容']" class="muted svc-text"
            >不包含：{{ spec["不包含内容"] }}</text
          ></view
        ><view class="form-card svc-view"
          ><FieldGroup
            :tables="['29-B', '28-A']"
            :value="bookingData"
            :options="{ ...options, selectedSpec: spec }"
            :errors="fieldErrors"
            editable
            :exclude="[
              '选定服务项目',
              '选定服务规格',
              '选定履约方式',
              '上门服务地址',
              '到点服务地点',
              '期望时间信息',
              '服务约定确认',
              '接收新预约状态',
              '暂停原因',
              '开关变更时间',
            ]"
            @input="updateForm"
          /><view v-if="selectedMethod === '上门'" class="sub-form svc-view"
            ><text class="section-label svc-text">本次上门地址</text
            ><FieldGroup
              :tables="['29-C']"
              :value="form['上门服务地址']"
              :options="options"
              :errors="fieldErrors"
              editable
              @input="updateForm({ ...form, 上门服务地址: $event })" /></view
          ><FormField
            v-else
            label="到点服务地点"
            required
            data-field="29-B.09"
            data-field-name="到点服务地点"
            ><picker
              class="svc-picker"
              :range="combo['可服务门店或服务点'] || []"
              range-key="地点名称"
              @change="
                updateForm({
                  ...form,
                  到点服务地点:
                    combo['可服务门店或服务点'][Number($event.detail.value)][
                      '地点业务编号'
                    ],
                })
              "
              ><view class="pick svc-view">{{
                combo["可服务门店或服务点"]?.find(
                  (p: any) => p["地点业务编号"] === form["到点服务地点"],
                )?.地点名称 || "请选择服务地点"
              }}</view></picker
            ></FormField
          ><view
            class="agreement svc-view"
            data-field="29-B.19"
            data-field-name="服务约定确认"
            @click="
              updateForm({ ...form, 服务约定确认: !form['服务约定确认'] })
            "
            ><checkbox :checked="!!form['服务约定确认']" color="#1b4d53" /><text
              class="svc-text"
              >我已阅读服务内容、商家约时与取消售后约定</text
            ></view
          ><text class="muted svc-text"
            >先付款并提交期望时间，具体人员和时间由商户提出后另行确认。</text
          ></view
        ><view class="bottom-actions svc-view"
          ><view class="total svc-view"
            ><text class="svc-text">应付总金额</text
            ><text class="amount svc-text"
              >¥{{ combo["组合固定价格"] }}</text
            ></view
          ><AppButton :loading="saving" @click="createOrder"
            >提交并付款</AppButton
          ></view
        ></template
      >
      <template v-else-if="isAction && commandName"
        ><view v-if="row" class="hero compact svc-view"
          ><text class="hero-title svc-text">{{ label(row) }}</text
          ><text class="muted svc-text"
            >{{ statusLabel(row) }} · {{ row._id }}</text
          ></view
        ><view class="form-card svc-view"
          ><SupplyEditor
            v-if="commandName === 'service.save'"
            :value="form"
            :options="options"
            :errors="fieldErrors"
            @input="updateForm" /><template v-else
            ><FieldGroup
              :tables="fields"
              :only="formNames"
              :value="form"
              :options="options"
              :errors="fieldErrors"
              editable
              :record-id="row?._id || ''"
              :record-table="table"
              @input="updateForm" /><FormField
              v-if="
                !fields.length &&
                /status|withdraw|retry|execute|submit|publish/.test(commandName)
              "
              label="操作说明"
            >
              <textarea
                v-model="form['原因说明']"
                auto-height
                placeholder="必要时填写说明"
              /></FormField></template></view
        ><view class="bottom-actions svc-view"
          ><AppButton :loading="saving" @click="submit">{{
            action.label || "确认提交"
          }}</AppButton></view
        ></template
      >
      <template v-else-if="mode === 'verify'"
        ><view class="hero svc-view"
          ><text class="hero-title svc-text">核对到点凭证</text
          ><text class="muted svc-text"
            >查询后核对服务、商户、地点与安排，再确认到点。核验不会完成服务。</text
          ></view
        ><view class="form-card svc-view"
          ><FormField label="凭证码" required
            ><input
              v-model="voucherInput"
              placeholder="输入住户展示的有效凭证码" /></FormField
          ><view class="button-row svc-view"
            ><AppButton variant="secondary" @click="scan">扫码查询</AppButton
            ><AppButton @click="queryVoucher">查询凭证</AppButton></view
          ></view
        ><template v-if="verified"
          ><view class="hero compact svc-view"
            ><text class="hero-title svc-text">{{ label(verified) }}</text
            ><text class="svc-text">{{ subtitle(verified) }}</text
            ><text class="svc-text">{{ verified._id }}</text></view
          ><Details
            table="orders"
            :record="verified"
            :options="options"
          /><AppButton :loading="saving" @click="verifyPoint"
            >确认到点</AppButton
          ></template
        ></template
      >
      <template v-else-if="row"
        ><view class="hero svc-view"
          ><text class="eyebrow svc-text">{{ row._id }}</text
          ><text class="hero-title svc-text">{{ label(row) }}</text
          ><text class="status large svc-text">{{ statusLabel(row) }}</text
          ><text class="muted svc-text">{{ subtitle(row) }}</text
          ><text v-if="price(row)" class="amount svc-text">{{
            price(row)
          }}</text></view
        ><view
          v-if="proposal || activeArrangement"
          class="arrangement-card svc-view"
          ><text class="section-label svc-text">{{
            proposal && proposal !== activeArrangement
              ? "本次安排提案"
              : "当前有效安排"
          }}</text
          ><text class="svc-text"
            >{{ (proposal || activeArrangement)["安排服务日期"] }}
            {{ (proposal || activeArrangement)["安排开始时间"] }}—{{
              (proposal || activeArrangement)["安排结束时间"]
            }}</text
          ><text class="muted svc-text">{{
            (proposal || activeArrangement)["服务人员姓名"] ||
            (proposal || activeArrangement)["服务人员"]
          }}</text
          ><text
            v-if="
              activeArrangement && proposal && activeArrangement !== proposal
            "
            class="muted svc-text"
            >原有效安排仍单独保留，新提案接受后才生效。</text
          ></view
        ><view v-if="mode === 'voucher'" class="voucher-card svc-view"
          ><text class="muted svc-text">请向本订单商户出示</text
          ><VoucherCode
            :value="
              row.credential?.['到点凭证二维码'] || row['到点凭证二维码'] || ''
            " /><text class="voucher-code svc-text">{{
            row.credential?.["到点凭证码"] ||
            row["到点凭证码"] ||
            row["凭证码"] ||
            row.voucher?.code ||
            activeArrangement?.["到点凭证码"] ||
            "当前没有有效到点凭证"
          }}</text
          ><FieldGroup
            :tables="['30-B']"
            :value="{
              ...row,
              ...row.credential,
              ...row.voucher,
              ...activeArrangement,
            }"
            :options="options" /></view
        ><Details :table="table" :record="row" :options="options" /><view
          v-if="table === 'orders' && !merchant"
          class="secondary-links svc-view"
          ><text
            class="svc-text"
            v-if="
              row['履约方式名称'] === '预约到点' ||
              row['选定履约方式'] === '预约到点' ||
              row['履约方式'] === '预约到点'
            "
            @click="go('voucher', { id: row._id })"
            >查看到点凭证</text
          ></view
        ><view
          v-if="newCommand && mode === 'qualification'"
          class="secondary-links svc-view"
          ><text class="svc-text" @click="editRecord(row, newCommand)"
            >编辑经营申请</text
          ></view
        ><view v-if="actions.length" class="bottom-actions svc-view"
          ><AppButton :loading="saving" @click="quick(actions[0])">{{
            actions[0].label
          }}</AppButton
          ><view v-if="actions.length > 1" class="secondary-links svc-view"
            ><text
              class="svc-text"
              v-for="a in actions.slice(1)"
              :key="a.name + ':' + a.label"
              @click="quick(a)"
              >{{ a.label }}</text
            ></view
          ></view
        ></template
      >
      <template v-else-if="mode === 'qualification' && !busy"
        ><view class="empty svc-view"
          ><text class="svc-text">尚无服务经营申请</text
          ><AppButton @click="editRecord(null, 'qualification.save')"
            >申请服务经营范围</AppButton
          ></view
        ></template
      >
      <template v-else-if="!busy && !error"
        ><view class="empty svc-view"
          >记录不存在或当前身份无权访问</view
        ></template
      >
    </view>
  </AppPage>
</template>
<style scoped lang="scss">
.service-page {
  padding: 16px;
  box-sizing: border-box;
  max-width: 100%;
  padding-bottom: 24px;
}
.message {
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.7;
  margin-bottom: 16px;
  overflow-wrap: anywhere;
}
.error {
  background: $color-error-light;
  color: $color-error;
}
.success {
  background: $color-primary-light;
  color: $color-primary;
}
.retry {
  display: block;
  text-decoration: underline;
  margin-top: 8px;
}
.hero {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 20px;
  margin-bottom: 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 12px;
}
.hero.compact {
  padding: 16px;
}
.eyebrow {
  font-size: 12px;
  color: $color-text-secondary;
  overflow-wrap: anywhere;
}
.hero-title {
  font-size: 22px;
  line-height: 1.5;
  font-weight: 700;
}
.muted {
  font-size: 13px;
  line-height: 1.8;
  color: $color-text-secondary;
  overflow-wrap: anywhere;
}
.amount {
  color: $color-primary;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.4;
}
.menu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.menu-tile {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 80px;
  padding: 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 12px;
  font-weight: 600;
}
.menu-tile > .svc-text:last-child {
  color: $color-primary;
}
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}
.metric {
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.metric-value {
  font-size: 20px;
  font-weight: 600;
  color: $color-primary;
  overflow-wrap: anywhere;
}
.period {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
}
.period .svc-picker {
  padding: 12px 4px;
}
.period .svc-button {
  font-size: 14px;
  color: $color-primary;
  background: $color-primary-light;
}
.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.list-title {
  font-size: 20px;
  font-weight: 700;
}
.new-button {
  font-size: 13px;
  background: $color-primary;
  color: #fff;
  margin: 0;
  min-width: 108px;
}
.search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 12px;
  margin-bottom: 16px;
}
.search input {
  flex: 1;
  min-width: 0;
  height: 48px;
  font-size: 15px;
}
.search > .svc-text {
  padding: 12px 0;
  color: $color-primary;
}
.filter-panel,
.form-card {
  padding: 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 12px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.record-card {
  padding: 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 12px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.card-title {
  font-size: 17px;
  font-weight: 600;
  overflow-wrap: anywhere;
  flex: 1;
}
.status {
  color: $color-primary;
  background: $color-primary-light;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  flex: none;
}
.status.large {
  font-size: 15px;
  align-self: flex-start;
}
.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.link {
  color: $color-primary;
  font-size: 14px;
}
.record-no {
  font-size: 12px;
  color: $color-text-secondary;
  overflow-wrap: anywhere;
}
.empty {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 32px 16px;
  align-items: center;
  background: #fff;
  border-radius: 12px;
}
.empty .svc-button {
  font-size: 14px;
  color: $color-primary;
  background: $color-primary-light;
}
.arrangement-card,
.voucher-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: $color-primary-light;
  border: 1px solid rgba(27, 77, 83, 0.2);
  border-radius: 12px;
  margin-bottom: 16px;
}
.section-label {
  font-size: 15px;
  font-weight: 600;
  display: block;
  margin: 8px 0;
}
.bottom-actions {
  position: sticky;
  bottom: 0;
  z-index: 40;
  background: rgba(248, 249, 252, 0.98);
  padding: 16px 0 calc(env(safe-area-inset-bottom) + 8px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}
.coverage {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.arrangement-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.coverage-toggle {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: $color-primary;
}
.secondary-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 0;
}
.secondary-links > .svc-text {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: $color-primary;
  font-size: 14px;
}
.total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pick {
  padding: 12px 0;
}
.agreement {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 1.8;
  padding: 12px 0;
}
.sub-form {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid $color-border;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  max-height: 80vh;
  overflow: auto;
  padding: 20px 16px calc(env(safe-area-inset-bottom) + 24px);
  box-sizing: border-box;
  background: #fff;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sheet-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
}
.close {
  padding: 12px;
  color: $color-text-secondary;
  font-size: 14px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  padding: 12px 16px;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid $color-border;
  border-radius: 8px;
  font-size: 14px;
}
.chip.selected {
  background: $color-primary-light;
  color: $color-primary;
  border-color: $color-primary;
}
.button-row {
  display: flex;
  gap: 12px;
}
.button-row > .svc-view,
.button-row > .svc-button {
  flex: 1;
}
.voucher-code {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 2px;
  overflow-wrap: anywhere;
}
.text-button {
  font-size: 14px;
  color: $color-primary;
  background: $color-primary-light;
}
.svc-button::after {
  border: 0;
}
</style>
