<script setup lang="ts">
import CategoryPicker from "./CategoryPicker.vue";
import AftersaleDetail from "./AftersaleDetail.vue";
import { serviceText } from "./presentation";
import { showFormError } from "../ui/formFeedback";
import FilterBar from "../ui/components/FilterBar.vue";
import StarRating from "../ui/components/StarRating.vue";
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
import FundDetails from "./FundDetails.vue";
import OrderDetails from "./OrderDetails.vue";
const props = withDefaults(
  defineProps<{
    mode: string;
    embedded?: boolean;
    category?: string;
    initialStatus?: string;
    table?: string;
    id?: string;
    action?: string;
    spec?: string;
    method?: string;
    section?: string;
  }>(),
  { table: "", id: "", action: "", spec: "", method: "", section: "", embedded: false, category: "", initialStatus: "" },
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
  status = ref(props.initialStatus),
  date = ref(""),
  person = ref(""),
  category = ref(props.category),
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
watch(()=>props.initialStatus, v=>{status.value=v||""});
watch(()=>props.category, v=>{category.value=v||""});
const estateFilter = ref(""),
  sortOrder = ref("");
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
        voucher: "服务码",
        verify: "服务码核对",
      }) as any
    )[props.mode] || "便民服务",
);
const actions = computed(() =>
  Array.isArray(row.value?._actions) ? row.value._actions : [],
);
const isNewFlow = computed(() => row.value?._flowVersion === 2);
const primaryAction = computed(() => {
  if (merchant.value && table.value === "services") return actions.value.find((a:any) => a.name === "service.save");
  const main = actions.value.find((a:any) => a.primary || ["qualification.submit","aftersale.respond"].includes(a.name));
  return main || (isNewFlow.value && table.value === "orders" ? null : actions.value[0]);
});
const secondaryActions = computed(() => actions.value.filter((a:any)=>a!==primaryAction.value));
const addresses = ref<any[]>([]), addressSheet = ref(false), needsEstate = ref(false);
const filterBar=ref<any>(null);
const createdPreset=ref(''), createdStart=ref(''), createdEnd=ref(''), customStart=ref(''), customEnd=ref('');
const bookingDraftKey=()=> 'service:'+APP+':'+props.id+':booking';
async function editAddress(a?:any){try{await service.draft(bookingDraftKey(),{data:form.value,operationId:operationId.value});addressSheet.value=false;uni.navigateTo({url:'/pages/profile/addresses?returnKey='+encodeURIComponent(bookingDraftKey())+(a?'&id='+encodeURIComponent(a._id):'')})}catch(e:any){await showFormError(e)}}
function applyCreatedDates(){if(!customStart.value||!customEnd.value||customStart.value>customEnd.value){uni.showModal({title:'日期范围有误',content:'请选择有效的起止日期',showCancel:false});return}createdPreset.value='custom';createdStart.value=customStart.value;createdEnd.value=customEnd.value;filterBar.value?.close();load()}
const showSupplement = ref(false);
const eventValue = (event:any) => event.detail?.value ?? event.target?.value ?? '';
const addressLabel = (a:any) => [a.联系人姓名, a.省份, a.城市, a.区县, a.详细地址].filter(Boolean).join(' ');
function selectAddress(a:any) {
  if (!a) return;
  needsEstate.value = false;
  updateForm({ ...form.value, 履约小区: "", 上门地址来源: "常用地址", 上门服务地址: { ...a },
    联系人姓名: a.联系人姓名, 联系人电话: a.联系人电话 });
  addressSheet.value = false;
}
function focusError(){setTimeout(()=>{
 const query=uni.createSelectorQuery();
 query.selectViewport().scrollOffset(()=>{});
 query.select('.field-wrap--error,.form-field--error').boundingClientRect();
 query.select('.error').boundingClientRect();
 query.exec((items:any[])=>{const target=items[1]||items[2];if(target)uni.pageScrollTo({scrollTop:Math.max(0,(items[0]?.scrollTop||0)+target.top-80),duration:200})});
},50)}
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
const legacyFormNames = computed(
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
const formNames = computed(() => {
  if (isNewFlow.value && commandName.value === 'order.accept') return action.value.defaults?.接单结果 === '无法承接' ? ['无法承接说明'] : ['服务人员','安排服务日期','安排开始时间','安排结束时间','安排说明'];
  if (isNewFlow.value && commandName.value === 'order.result') return ['实际完成内容','结果图片', ...(showSupplement.value ? ['结果补充说明'] : [])];
  if (isNewFlow.value && commandName.value === 'aftersale.plan') return ['方案处理类型','拟退款金额','金额依据说明','业务结案方式','方案说明'];
  return legacyFormNames.value;
});
const bookingData = computed(() => ({
  ...form.value,
  方式说明: combo.value["方式说明"] || combo.value["组合履约方式名称"],
  约时提示: "期望时间不代表预约成功，具体人员及时间由商户接单派工后生效。",
  规格方式固定价: combo.value["组合固定价格"],
  应付总金额: combo.value["组合固定价格"],
  收款主体名称: row.value?.["收款主体名称"] || "青禾物业服务有限公司",
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
        [label(r), subtitle(r), r._id, r._order, r.申请原因].join(" ").includes(search.value)) &&
      (!status.value || statusLabel(r).includes(status.value)) &&
      (!date.value || arrangement?.["安排服务日期"] === date.value) &&
      (!person.value || arrangement?.["服务人员"] === person.value) &&
      (!category.value || r["所属服务类目"] === category.value) &&
      (!method.value ||
        (table.value === "services"
          ? combos.some(
              (c: any) =>
                c._method === method.value ||
                c["组合履约方式名称"] === method.value,
            )
          : r._combo?._method === method.value ||
            r["履约方式名称"] === method.value)) &&
      (!estateFilter.value ||
        combos.some((c: any) =>
          (c["上门覆盖小区"] || []).includes(estateFilter.value) ||
          (c["可服务门店或服务点"] || []).some((p:any) => (p.所属小区 || p._estate) === estateFilter.value),
        ))
    );
  });
  if (table.value === "services" && sortOrder.value)
    result.sort(
      (a: any, b: any) =>
        (priceNumber(a) - priceNumber(b)) *
        (sortOrder.value === "价格从低到高" ? 1 : -1),
    );
  if (table.value === "orders" && sortOrder.value) {
    result.sort((a: any, b: any) => {
      if (sortOrder.value === "下单从旧到新") return String(a["创建时间"]).localeCompare(String(b["创建时间"]));
      if (sortOrder.value === "下单从新到旧") return String(b["创建时间"]).localeCompare(String(a["创建时间"]));
      const byAmount = Number(a._amount ?? 0) - Number(b._amount ?? 0);
      return sortOrder.value === "价格从低到高" ? byAmount : -byAmount;
    });
  }
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
      (v: any) =>
        v._method === selectedMethod.value ||
        v["组合履约方式名称"] === selectedMethod.value,
    ) ||
    combos.value[0] ||
    {},
);
const activeArrangement = computed(
  () =>
    row.value?.currentArrangement ||
    row.value?.["当前有效安排"] ||
    row.value?.arrangements?.find((a: any) => a.安排状态 === "已接受") ||
    null,
);
const proposal = computed(
  () =>
    row.value?.proposal ||
    row.value?.currentProposal ||
    row.value?.["当前安排提案"] ||
    [...(row.value?.arrangements || [])].reverse().find((a: any) => a.安排状态 === "待确认") ||
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
    const filters=props.section.startsWith("{") ? JSON.parse(props.section) : {};
    if(props.mode==='funds'){delete filters.metric;return {...filters,groupBy:'order'}}
    return ['orders','aftersales'].includes(props.mode)&&createdPreset.value ? {...filters,start:createdStart.value,end:createdEnd.value} : filters;
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
function subtitle(r: any) {
  return serviceText(
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
const orderStatuses = computed(() => ['全部','待付款','待接单','待服务','待评价','已完成','已取消']);
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
  if(r._fundSummary){go('action',{table:'orders',id:r._id,section:'funds'});return}
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
      服务人员: "",
      安排服务日期: options.value.today || "2026-11-07",
      安排开始时间: "09:00",
      安排结束时间: "11:00",
      原安排仍可履行: true,
    });
  if (isNewFlow.value && name === 'order.accept') {
    const hour = Number((options.value.clock || '').slice(11,13));
    data['安排开始时间'] = String(hour).padStart(2,'0') + ':00';
    data['安排结束时间'] = hour < 23 ? String(hour + 1).padStart(2,'0') + ':00' : '23:59';
    data['接单结果'] = action.value.defaults?.接单结果 || '接单';
  }
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
      拟退款金额: r["申请退款金额"] || "",
      业务结案方式: r.handlingOptions?.plan?.["部分退款"]?.[0] || "",
    });
  if (name === "aftersale.respond")
    Object.assign(data, {
      方案版本:
        r.plans?.[r.plans.length - 1]?.["方案版本"] || r["方案版本"] || 1,
      居民方案答复: "同意",
    });
  if (name === "evaluation.save")
    Object.assign(data, { 总体评分: 5, 评价图片: [] });
  if (
    name === "aftersale.plan" &&
    !(r.handlingOptions?.plan?.[data["方案处理类型"]] || []).length
  ) {
    data["方案处理类型"] = "全额退款";
    data["业务结案方式"] = r.handlingOptions?.plan?.["全额退款"]?.[0] || "";
  }
  return data;
}
let reloadPending = false;
async function load() {
  if (busy.value) { reloadPending = true; return; }
  busy.value = true;
  error.value = "";
  try {
    await service.start();
    options.value = await api().options();
    if (props.mode === 'booking') addresses.value = await api().query('addresses');
    if (["workbench", "overview"].includes(props.mode))
      overview.value = await api().overview(
        props.mode === "overview"
          ? {
              ...form.value,
              start: form.value.start || options.value.today.slice(0,7)+'-01',
              end: form.value.end || options.value.today,
              serviceDate: form.value.serviceDate || options.value.today,
            }
          : {},
      );
    else if (props.id) {
      row.value = await api().record(table.value, props.id);
      if (isAction.value && table.value==='aftersales' && ['aftersale.plan','aftersale.cancelDecision','aftersale.withdraw','aftersale.respond'].includes(commandName.value)) {
        uni.redirectTo({url:'/pages/service/after-sale?id='+encodeURIComponent(props.id)+'&section=process'}); return;
      }
      options.value = {
        ...options.value,
        handlingOptions: row.value?.handlingOptions,
      };
      if (table.value === "orders") {
        row.value.aftersales = (await api().query("aftersales")).filter(
          (r: any) => r._order === props.id,
        );
        if (resumeAftersale(row.value)) return;
      }
      if (props.mode === "booking") {
        selectedSpec.value = props.spec || specs.value[0]?.["规格编号"] || "";
        selectedMethod.value =
          props.method ||
          combo.value._method ||
          combo.value["组合履约方式名称"] ||
          "HOME";
        form.value = {
          选定服务项目: props.id,
          选定服务规格: selectedSpec.value,
          选定履约方式: selectedMethod.value,
          期望时间选择: "时间可协商",
          期望服务日期: options.value.today || "2026-11-07",
          联系人姓名: options.value.actor.name || "",
          联系人电话: "",
          上门地址来源: "本次填写",
          上门服务地址: {},
          到点服务地点:
            combo.value["可服务门店或服务点"]?.[0]?.["地点业务编号"] || "",
          服务约定确认: false,
          需求图片: [],
        };
        const preferred = addresses.value.find((a:any)=>a.默认地址);
        if (preferred && combo.value['组合流程模板'] === '上门') selectAddress(preferred);

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
          (commandName.value || "booking") + (props.section ? ":" + props.section : ""),
      );
      if (draft?.data)
        form.value = { ...draft.data, ...(action.value.defaults || {}) };
      if (commandName.value === "order.accept" && form.value.服务人员 && !row.value?.dispatchPersonnel?.some((p:any)=>p.value===form.value.服务人员)) form.value.服务人员 = "";
      if (props.mode === "booking") form.value = bookingPayload(form.value);
      if (draft?.operationId) operationId.value = draft.operationId;
      if(props.mode==='booking'&&draft?.selectedAddressId){
        const selected=addresses.value.find(a=>a._id===draft.selectedAddressId);
        if(selected)selectAddress(selected);
        await service.draft(bookingDraftKey(),{data:form.value,operationId:operationId.value});
      }
    }
    loaded.value = true;
  } catch (e: any) {
    error.value = e.message || "加载失败，请重试";
  } finally {
    busy.value = false;
    if (reloadPending) { reloadPending = false; load(); }
  }
}
function updateForm(v: any) {
  form.value = v;
  if (loaded.value && !busy.value && (isAction.value || props.mode === "booking"))
    service
      .draft(
        "service:" +
          APP +
          ":" +
          (props.id || "new") +
          ":" +
          (commandName.value || "booking") + (props.section ? ":" + props.section : ""),
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
  if (value["选定服务规格"] && value["选定服务规格"] !== selectedSpec.value)
    delete data["服务对象描述"];
  if (spec.value["服务对象填写要求"] === "不需要") delete data["服务对象描述"];
  if (data["期望时间选择"] === "时间可协商") {
    delete data["期望服务日期"];
    delete data["期望时段偏好"];
  }
  if (combo.value["组合流程模板"] === "预约到点") {
    delete data["上门服务地址"];
    delete data["上门地址来源"];
    delete data["履约小区"];
    const points = combo.value["可服务门店或服务点"] || [];
    if (!points.some((p: any) => p["地点业务编号"] === data["到点服务地点"]))
      data["到点服务地点"] = "";
  } else {
    delete data["到点服务地点"];
    if (!data["上门服务地址"]) data["上门服务地址"] = {};
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
    const result = await api().command(commandName.value === "service.save" ? "service.saveAndSubmit" : commandName.value, {
      id: props.id || undefined,
      revision: row.value?._rev,
      operationId: operationId.value,
      data: normalize(form.value),
    });
    success.value = result.message || "已保存";
    await service.draft(
      "service:" + APP + ":" + (props.id || "new") + ":" + commandName.value + (props.section ? ":" + props.section : ""),
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
    await showFormError(e, focusError);
  } finally {
    saving.value = false;
  }
}
function selectSpec(s: any) {
  selectedSpec.value = s["规格编号"];
  const c = (s["组合集合"] || [])[0];
  selectedMethod.value = c?._method || c?.["组合履约方式名称"] || "";
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
    method: combo.value._method || combo.value["组合履约方式名称"],
  });
}
async function createOrder() {
  if (saving.value) return;
  saving.value = true; error.value = ""; fieldErrors.value = {};
  try {
    const data = bookingPayload(form.value);
    await api().preflight(data);
    const ok = await new Promise<boolean>((resolve) => uni.showModal({
      title: "确认付款", content: "确认支付 ¥" + combo.value["组合固定价格"] + "？",
      success: r => resolve(r.confirm), fail: () => resolve(false),
    }));
    if (!ok) return;
    const result = await api().command("order.create", { operationId: operationId.value, data });
    try {
      await api().command("order.pay", {id:result.id, revision:result.record?._rev, operationId:operationId.value+"-pay",data:{}});
    } catch (e:any) {
      await showFormError(e);
      finishObject("orders",result.id);
      return;
    }
    await service.draft("service:"+APP+":"+props.id+":booking", null);
    uni.redirectTo({url:"/pages/service/orders"});
  } catch(e:any) {
    error.value=e.message||"订单提交失败，输入已保留";
    fieldErrors.value=e.fields||{};
    if (fieldErrors.value["履约小区"]) needsEstate.value = true;
    await showFormError(e,focusError);
  } finally { saving.value=false; }
}
async function quick(a: any, target = row.value) {
  if (saving.value) return;
  if (a.name === "qualification.submit") { await execute(a.name, {}, target, "申请已提交，等待审核"); return; }
  if (['personnel.status','aftersale.respond','aftersale.withdraw','service.publish','service.submit','aftersale.execute'].includes(a.name) ||
      (a.name==='service.status' && ['已上架','恢复接单','推荐','取消推荐'].includes(a.defaults?.状态))) {
    const plan=target.plans?.[target.plans.length-1];
    const data=a.name==='aftersale.respond'?{居民方案答复:'同意',方案版本:target.方案版本}:a.defaults||{};
    const description=a.name==='aftersale.respond'?[plan?.方案处理类型,plan?.拟退款金额?'退款 ¥'+plan.拟退款金额:'',plan?.方案说明].filter(Boolean).join(' · '):a.name==='aftersale.withdraw'?'撤回后该申请结束。':(target.姓名||target.服务名称||'')+' · '+a.label;
    const ok=await new Promise<boolean>(resolve=>uni.showModal({title:a.label,content:description||a.label,success:r=>resolve(r.confirm)}));
    if(ok) await execute(a.name,data,target);
    return;
  }
  if (a.name === "order.pay") {
    const ok = await new Promise<boolean>((resolve) =>
      uni.showModal({
        title: "确认付款",
        content: "请核对原订单金额后确认付款。",
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
async function execute(name: string, data: any, target=row.value, message="操作已完成") {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    await api().command(name, {
      id: target._id,
      revision: target._rev,
      operationId: "service-ui-" + Date.now(),
      data,
    });
    await load();
    success.value = message;
    uni.showToast({title:message,icon:"none"});
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
    const entered = voucherInput.value.trim();
    if (/^\d{6}$/.test(entered)) {
      const matches = await api().query('orders', {serviceCode: entered});
      const order = matches.find((o:any) => !props.id || o._id === props.id);
      if (!order) throw Error('未找到本店可办理的服务订单，请核对服务码');
      row.value = verified.value = order;
      return;
    }
    const list = props.id
      ? [await api().record("orders", props.id)]
      : await api().query("orders", {});
    const code = entered;
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
      title: "确认到店",
      content:
        "请核对商户、地点和本次有效安排。确认到店只记录到店事实，不代表服务完成。",
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
const off = service.onChange(() => {
  if (!isAction.value && props.mode !== "booking") load();
});
watch(selectedSpec, (next, previous) => {
  if (
    previous &&
    next !== previous &&
    form.value["服务对象描述"] !== undefined
  ) {
    const clean = { ...form.value };
    delete clean["服务对象描述"];
    form.value = clean;
  }
});
onShow(load);
onUnmounted(off);
watch(
  () => [props.id, props.mode, props.spec, props.method],
  () => {
    loaded.value = false;
    load();
  },
);
const voucherExpanded=ref(false);
function cardActions(r:any){const list=(r._actions||[]).filter((a:any)=>['evaluation.save','aftersale.apply'].includes(a.name));if(r.currentAftersale)list.push({name:'view-sale',label:'查看售后'});return list.sort((x:any,y:any)=>Number(x.name==='evaluation.save')-Number(y.name==='evaluation.save'))}
function cardAction(r:any,a:any){if(a.name==='view-sale')return go('after-sale',{id:r.currentAftersale._id});go('action',{table:'orders',id:r._id,action:a.name,section:a.label})}
const priceSort = ["价格从低到高", "价格从高到低"];
const selectableEstates = computed(() => (options.value.estates || [])
  .filter((e:any) => (combo.value["上门覆盖小区"] || []).includes(e.value)));
const quickFilters=computed(()=>{
  const filters:any[]=[];
  if (['discover','orders'].includes(props.mode)) filters.push({key:'method',label:'服务方式',value:method.value,options:[{value:'上门',label:'上门'},{value:'预约到点',label:'预约到店'}]});
  if (props.mode==='aftersales') filters.push({key:'status',label:'售后状态',value:status.value,options:(options.value.dictionaries?.售后状态筛选 || []).map((value:string)=>({value,label:value}))});
  if (['orders','aftersales'].includes(props.mode)) filters.push({key:'created',custom:true,label:props.mode==='orders'?'下单日期':'申请日期',wide:props.mode==='orders',value:createdPreset.value,options:[...['7','30','90'].map(value=>({value,label:'近'+value+'天'})),{value:'custom',label:createdStart.value+' 至 '+createdEnd.value}]});
  if (props.mode==='discover') filters.push({key:'category',custom:true,label:'服务分类',value:category.value,options:options.value.categories||[]});
  if (props.mode==='discover') filters.push({key:'estate',label:'小区',value:estateFilter.value,options:options.value.estates||[]});
  if (props.mode==='orders'&&merchant.value) filters.push({key:'person',label:'服务人员',value:person.value,options:options.value.personnel||[]});
  if (["discover", "orders"].includes(props.mode)) {
    const order = props.mode === "orders";
    const values = order ? ["下单从新到旧", "下单从旧到新", ...priceSort] : priceSort;
    filters.push({ key: "sort", label: "排序", emptyLabel: order ? "默认排序（最新下单）" : "综合排序",
      value: sortOrder.value, options: values.map(value => ({ value, label: value })) });
  }
  return filters;
});
function openPanel(key:string){if(key==='created'){customStart.value=createdStart.value;customEnd.value=createdEnd.value;}}
function setFilter(key:string,value:string){
  if(key==='created'){
    createdPreset.value=value;createdStart.value='';createdEnd.value='';
    if(value){const today=options.value.today;const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-Number(value)+1);createdStart.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');createdEnd.value=today}
    load();
  }
  if(key==='method')method.value=value;
  if(key==='person')person.value=value;
  if(key==='category')category.value=value;
  if(key==='estate')estateFilter.value=value;
  if(key==='status')status.value=value;
  if(key==='sort')sortOrder.value=value;
  filterBar.value?.close();
}
function supplyMore(){
  const items=secondaryActions.value;
  uni.showActionSheet({itemList:items.map((a:any)=>a.label),success:r=>quick(items[r.tapIndex])});
}
function saleTask(r:any){return (r._actions||[]).find((a:any)=>['aftersale.plan','aftersale.cancelDecision','aftersale.execute'].includes(a.name))}
function clearFilters(){createdPreset.value='';createdStart.value='';createdEnd.value='';load();search.value='';status.value='';method.value='';category.value='';person.value='';date.value='';estateFilter.value='';sortOrder.value=''}
</script>
<template>
  <AppPage
    :class="{'service-embedded':embedded}"
    :secondary="!embedded"
    :with-bottom-action="!embedded"
    :status="busy && !loaded ? 'loading' : 'ready'"
    @retry="load"
    ><template #navbar><AppNavbar v-if="!embedded" :title="title" show-back /></template>
    <view class="service-page svc-view" :class="{'booking-flow':mode==='booking','compact-action':isAction && isNewFlow}">
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
            >接单派工后提交服务结果，及时查看住户评价。</text
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
        <view class="form-card svc-view"
          ><FieldGroup
            :tables="['32-A']"
            :only="['服务项目筛选', '服务类目筛选']"
            :value="form"
            :options="options"
            editable
            @input="updateForm"
        /></view>
        <view class="period svc-view"
          ><picker
            class="svc-picker"
            mode="date"
            :value="form.start || options.today?.slice(0,7)+'-01'"
            @change="form.start = $event.detail.value"
            ><text class="svc-text">{{
              form.start || options.today?.slice(0,7)+"-01"
            }}</text></picker
          ><text class="svc-text">至</text
          ><picker
            class="svc-picker"
            mode="date"
            :value="form.end || options.today"
            @change="form.end = $event.detail.value"
            ><text class="svc-text">{{
              form.end || options.today
            }}</text></picker
          ><button class="svc-button" @click="load">查询</button></view
        >
        <view class="period svc-view"
          ><text class="svc-text">安排服务日</text
          ><picker
            class="svc-picker"
            mode="date"
            :value="form.serviceDate || options.today"
            @change="
              form.serviceDate = $event.detail.value;
              load();
            "
            ><text class="svc-text">{{
              form.serviceDate || options.today
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
        ><view v-if="mode!=='discover' && mode!=='orders'" class="list-heading svc-view">
          <text class="list-title svc-text">{{ title }}</text>
          <AppButton v-if="newCommand" size="compact" @click="editRecord(null, newCommand)">{{ newLabel }}</AppButton>
        </view>
          <FilterBar ref="filterBar" v-model="search" :placeholder="mode==='discover'?'搜索服务名称、店铺':mode==='aftersales'?'搜索售后单号、订单号或服务':'搜索编号、服务名称'" :filters="quickFilters" @filter="setFilter" @panel="openPanel">
            <template #shortcut><button v-if="mode==='discover'" class="search-shortcut" @click="go('orders')">服务订单</button><button v-if="mode==='orders'" class="search-shortcut" @click="go('aftersales')">{{merchant?'售后处理':'服务售后'}}</button></template>
            <template #panel="{filterKey}"><view v-if="filterKey==='category'"><button class="filter-all" @click="setFilter('category','')">全部分类</button><CategoryPicker inline :multiple="false" :categories="options.categories||[]" :value="category?[category]:[]" @input="setFilter('category',$event[0]||'')"/></view>
            <view v-else-if="filterKey==='created'" class="date-panel"><view class="date-presets"><button v-for="v in ['7','30','90']" :key="v" :class="{selected:createdPreset===v}" @click="setFilter('created',v)">近{{v}}天</button></view>
              <view class="date-range"><picker mode="date" :value="customStart||options.today" @change="customStart=$event.detail.value"><view>{{customStart||'开始日期'}}</view></picker><text>至</text><picker mode="date" :value="customEnd||options.today" @change="customEnd=$event.detail.value"><view>{{customEnd||'结束日期'}}</view></picker></view><view class="date-presets"><button @click="setFilter('created','')">全部日期</button><button class="selected" @click="applyCreatedDates">确定范围</button></view></view></template>
          </FilterBar>
          <view v-if="mode==='aftersales'&&createdPreset" class="date-summary">申请日期　{{createdStart}} 至 {{createdEnd}}</view>
          <view v-if="mode==='funds'" class="date-summary">期间：{{rows[0]?._fundSummary?.period?.start||options.today?.slice(0,7)+'-01'}} 至 {{rows[0]?._fundSummary?.period?.end||options.today}} · 金额为本单累计</view>
          <scroll-view v-if="mode==='orders'" scroll-x class="status-tabs"><button v-for="t in orderStatuses" :key="t" :class="{active:(status||'全部')===t}" @click="status=t==='全部'?'':t">{{t}}</button></scroll-view>
          <view v-if="search||status||method||category||person||date||createdPreset||estateFilter||sortOrder" class="filter-summary"><text>共 {{filtered.length}} 条</text><text class="text-link" @click="clearFilters">清除筛选</text></view
        ><view v-if="!filtered.length" class="empty svc-view"
          ><text class="svc-text">暂无符合条件的记录</text
          ><text class="muted svc-text">调整筛选，或稍后重新查询。</text
          ><button class="svc-button" @click="load">重新查询</button></view
        ><view v-if="filtered.length" :class="table==='services'?'service-grid':'record-list'">
          <view v-for="r in filtered" :key="r._id" class="record-card svc-view" :data-record="r._id" @click="openRecord(r)">
            <Picture v-if="table==='services'" card :value="r.服务主图" table="services" :record-id="r._id"/>
            <view class="card-top"><text class="card-title" :data-field="mode==='discover'?'29-A.08':undefined">{{label(r)}}</text><text v-if="table==='orders'||r._fundSummary" class="top-order-no">{{r.服务订单号||r._id}}</text></view>
            <template v-if="table==='services'"><text v-if="mode==='discover'" class="muted" data-field="29-A.09">{{r.经营店铺名称}}</text><text class="muted" data-field="29-A.11">{{serviceText(serviceMethods(r))}}</text><view class="tile-footer"><text class="amount" data-field="29-A.10">{{price(r)}}</text><text class="status" :class="{approved:merchant && r.审核状态==='通过',pending:merchant && r.审核状态==='待审核'}" data-field="29-A.13">{{statusLabel(r)}}</text></view></template>
            <template v-else>
              <text v-if="statusLabel(r)" class="status">{{statusLabel(r)}}</text>
              <template v-if="table==='personnel'"><text>{{r.工作联系电话}}</text><text class="muted">{{(r.可执行服务类目||[]).map((id:string)=>options.categories?.find((c:any)=>c._id===id)?.label||id).join('、')}}</text><text class="muted">证明材料 {{r.人员资质材料?.length||0}} 份 · {{r.资质有效性}}</text>
                <view v-if="merchant" class="card-actions" @click.stop><AppButton v-for="a in (r._actions||[]).filter((a:any)=>a.name==='personnel.status')" :key="a.name" size="compact" variant="secondary" @click="quick(a,r)">{{a.label}}</AppButton></view></template>
              <template v-else-if="table==='aftersales'"><text>{{r.申请类型}} · {{r.申请原因}}</text><text class="muted"><template v-if="r.申请退款金额!==undefined && r.申请退款金额!==''">申请退款 ¥{{r.申请退款金额}}　</template>{{r.期望解决方式}}</text><text class="muted">{{r.申请时间}} · {{r._order}}</text><view v-if="merchant&&saleTask(r)&&r.售后状态!=='待居民确认方案'" class="card-actions" @click.stop><AppButton size="compact" @click="go('after-sale',{id:r._id,section:'process'})">去处理</AppButton></view></template>
              <template v-else-if="r._fundSummary"><view class="fund-summary-grid"><view><text>用户支付 {{money(r._fundSummary.paid)}}</text><text v-if="r._fundSummary.refund" class="outgoing">已退款 {{money(r._fundSummary.refund)}}</text></view><view><text>商户分账 {{money(r._fundSummary.split)}} · {{r._fundSummary.splitStatus}}</text><text v-if="r._fundSummary.reversal" class="outgoing">已回退 {{money(r._fundSummary.reversal)}}</text></view></view></template>
              <template v-else-if="table==='evaluations'"><StarRating :model-value="Number(r.总体评分)" readonly/><text>{{r.评价内容||'未填写文字评价'}}</text><text class="muted">{{r.评价时间}}</text></template>
              <template v-else><text v-if="subtitle(r)" class="muted">{{subtitle(r)}}</text><text v-if="merchant&&r.currentArrangement" class="muted">{{r.currentArrangement.安排服务日期}}　{{r.currentArrangement.安排开始时间}}—{{r.currentArrangement.安排结束时间}}</text><view class="card-bottom"><text class="amount">{{price(r)}}</text><text v-if="table==='orders'" class="order-time">下单 {{r.创建时间?.slice(0,16).replace('T',' ')}}</text></view><view v-if="table==='orders'&&!merchant&&cardActions(r).length" class="card-actions" @click.stop><AppButton v-for="a in cardActions(r)" :key="a.name" size="compact" :variant="a.name==='evaluation.save'?'primary':'secondary'" @click="cardAction(r,a)">{{a.label}}</AppButton></view></template>
            </template>
          </view></view></template>
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
            row["服务简介"]
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
                @click="selectedMethod = c._method || c['组合履约方式名称']"
                >{{ serviceText(c["组合履约方式名称"]) }} · ¥{{ c["组合固定价格"] }}</view
              ></view
            ><text class="muted svc-text">{{ spec["规格说明"] }}</text
            ><AppButton @click="book">确认选择，去预约</AppButton></view
          ></view
        ></template
      >
      <template v-else-if="mode === 'booking' && row"
        ><view class="hero compact svc-view"
          ><text class="hero-title svc-text">{{ row["服务名称"] }}</text
          ><text class="svc-text"
            >{{ spec["规格名称"] }} · {{ serviceText(combo["组合履约方式名称"]) }}</text
          ><text class="amount svc-text">¥{{ combo["组合固定价格"] }}</text
          ><text class="muted svc-text">{{ spec["规格说明"] }}</text
          ></view
        ><view class="form-card svc-view"
          ><view
            v-if="combo['组合流程模板'] === '上门'"
            class="sub-form svc-view"
            ><text class="section-label svc-text">本次上门地址</text
            >
            <button class="selected-address" @click="addressSheet=true"><text>{{form['上门服务地址']?.详细地址?addressLabel(form['上门服务地址']):'请选择服务地址'}}</text><text>{{form['上门服务地址']?.联系人电话||''}}　›</text></button>
            <FormField v-if="needsEstate" label="履约小区" required :error="fieldErrors.履约小区">
              <picker :range="selectableEstates" range-key="label"
                @change="updateForm({...form, 履约小区:selectableEstates[Number($event.detail.value)].value})">
                <view class="pick">{{selectableEstates.find((e:any)=>e.value===form.履约小区)?.label || '请选择履约小区'}} ›</view>
              </picker>
            </FormField></view
          ><FormField
            v-else
            label="到店服务地点"
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
          ><view v-if="combo['组合流程模板']==='预约到点' && form['到点服务地点']" class="point-summary"><template v-for="p in (combo['可服务门店或服务点']||[]).filter((p:any)=>p['地点业务编号']===form['到点服务地点'])" :key="p['地点业务编号']"><text>{{p['详细地址']}}</text><text>{{p['地点联系电话']}}</text><text>{{p['到点指引']}}</text></template></view><view class="booking-inputs"><FieldGroup class="booking-main-fields"
            :tables="['29-B', '28-A']"
            :only="['联系人姓名','联系人电话','期望时间选择','期望服务日期','期望时段偏好','服务对象描述']"
            :value="bookingData"
            action="order.book"
            :options="{ ...options, selectedSpec: spec, selectedCombo: combo }"
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
          /><text class="optional-toggle" @click="showSupplement=!showSupplement">{{showSupplement?'收起补充需求':'补充需求（选填）'}} {{showSupplement?'⌃':'⌄'}}</text><FieldGroup v-if="showSupplement" :tables="['29-B','28-A']" :only="['期望时间补充说明','需求补充说明','需求图片']" :value="form" action="order.book" :options="{...options,selectedSpec:spec,selectedCombo:combo}" :errors="fieldErrors" editable @input="updateForm"/></view><checkbox-group class="agreement svc-view" data-field="29-B.19" data-field-name="服务约定确认" @change="updateForm({...form,服务约定确认:$event.detail.value.includes('agree')})"><label class="agreement-label"><checkbox value="agree" :checked="!!form['服务约定确认']" color="#1b4d53"/><text>我已阅读服务内容、商家约时与取消售后约定 <text class="required-mark">*</text></text></label></checkbox-group
          ><text class="muted svc-text"
            >付款后由商户接单派工，可在订单中查看人员和服务时间。</text
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
        ><view v-if="isNewFlow && table==='orders'" class="action-context"><text>{{row['服务规格名称']}} · {{row['履约方式名称']}}</text><text>{{row['地点快照']?.['地点名称']||''}} {{[row['地点快照']?.省份,row['地点快照']?.城市,row['地点快照']?.区县,row['地点快照']?.详细地址].filter(Boolean).join('')}}</text><text>{{row['联系人姓名']}}　{{row['联系人电话']}}</text><text v-if="row.currentArrangement">{{row.currentArrangement['服务人员姓名']}} · {{row.currentArrangement['安排服务日期']}} {{row.currentArrangement['安排开始时间']}}—{{row.currentArrangement['安排结束时间']}}</text></view>
        <view class="form-card svc-view"
          ><SupplyEditor
            v-if="commandName === 'service.save'"
            :draft-key="'service:'+APP+':'+(props.id||'new')+':service.save'+(props.section?':'+props.section:'')"
            :value="form"
            :options="options"
            :errors="fieldErrors"
            @input="updateForm" /><template v-else
            >              <FormField v-if="isNewFlow && commandName==='order.result' && row.credential?.凭证状态!=='已核验'" label="服务码" required :error="fieldErrors.服务码" data-field-name="服务码">
                <input type="number" maxlength="6" :value="form.服务码||''" placeholder="输入住户出示的 6 位服务码" @input="updateForm({...form,服务码:eventValue($event)})"/>
              </FormField><FieldGroup
              :tables="fields"
              :draft-key="'service:'+APP+':'+(props.id||'new')+':'+commandName+(props.section?':'+props.section:'')"
              :only="formNames"
              :value="form"
              :options="{...options, selectedCombo:row?._combo}"
              :errors="fieldErrors"
              editable
              :record-id="row?._id || ''"
              :record-table="table"
              :action="commandName"
              :record="row || {}"
              @input="updateForm" />

              <text v-if="isNewFlow && commandName==='order.result'" class="optional-toggle" @click="showSupplement=!showSupplement">{{showSupplement?'收起补充说明':'补充说明（选填）'}}</text>
              <template v-if="commandName==='aftersale.cancelDecision'"><FormField label="取消核实结果" required :error="fieldErrors.取消核实结果"><picker :range="['同意取消','不同意取消']" @change="updateForm({...form,取消核实结果:['同意取消','不同意取消'][Number($event.detail.value)]})"><view class="pick">{{form.取消核实结果||'选择核实结果'}}</view></picker></FormField><FormField label="核实依据说明" required :error="fieldErrors.核实依据说明"><textarea :value="form.核实依据说明||''" placeholder="填写核实结果和理由" @input="updateForm({...form,核实依据说明:eventValue($event)})"/></FormField></template>
              <FormField
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
            commandName==='qualification.save'?'保存申请':commandName==='service.save'?'保存并提交审核':commandName==='order.accept'&&form.接单结果!=='无法承接'?'确认':action.label || "确认提交"
          }}</AppButton></view
        ></template
      >
      <template v-else-if="mode === 'verify'"
        ><view class="hero svc-view"
          ><text class="hero-title svc-text">核对服务码</text
          ><text class="muted svc-text"
            >输入住户出示的服务码，查看对应订单。</text
          ></view
        ><view class="form-card svc-view"
          ><FormField label="服务码" required
            ><input
              v-model="voucherInput"
              placeholder="输入住户出示的服务码" /></FormField
          ><view class="button-row svc-view"
            ><AppButton @click="queryVoucher">查询订单</AppButton></view
          ></view
        ><view
          v-if="error"
          class="error-panel svc-view"
          data-field="30-B.17"
          data-field-name="拒绝核验原因"
          >{{ error }}</view
        >
        <template v-if="verified"
          ><view class="hero compact svc-view"
            ><text class="hero-title svc-text">{{ label(verified) }}</text
            ><text class="svc-text">{{ subtitle(verified) }}</text
            ><text class="svc-text">{{ verified._id }}</text></view
          ><Details
            table="orders"
            :record="verified"
            :options="options"
          /><AppButton v-if="verified._flowVersion===2" @click="go('order',{id:verified._id})">查看订单</AppButton><AppButton v-else :loading="saving" @click="verifyPoint"
            >确认到店</AppButton
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
          v-if="!isNewFlow && (proposal || activeArrangement)"
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
        ><view v-if="!merchant && row.credential && row.currentArrangement && row.credential.凭证状态!=='失效'" class="inline-voucher">
          <button v-if="mode!=='voucher'" class="voucher-toggle" @click="voucherExpanded=!voucherExpanded">{{ voucherExpanded?'收起服务码':'查看服务码' }}</button>
          <view v-if="mode==='voucher'||voucherExpanded" class="voucher-card">
            <VoucherCode :value="row.credential.服务码 || row.credential.到点凭证码" :state="row.credential.凭证状态"/>
            <text>{{ row.地点快照?.地点名称 || row.地点快照?.详细地址 }}</text>
            <text>{{ row.currentArrangement.安排服务日期 }} {{ row.currentArrangement.安排开始时间 }}—{{ row.currentArrangement.安排结束时间 }}</text>
          </view>
        </view>
        <AftersaleDetail v-if="table==='aftersales'" :record="row" :options="options" :merchant="merchant" :initial-tab="section" @quick="quick" @saved="load"/><FundDetails v-else-if="table==='orders'&&section==='funds'" :record="row"/><OrderDetails v-else-if="table==='orders' && isNewFlow" :record="row" :options="options"/><Details v-else :table="table" :record="row" :options="options" /><view v-if="table!=='aftersales'&&actions.length&&section!=='funds'" class="bottom-actions action-row">
          <view v-if="secondaryActions.length" class="secondary-links"><AppButton v-if="table==='services'&&merchant" variant="secondary" @click="supplyMore">更多</AppButton><AppButton v-else v-for="a in secondaryActions" :key="a.name+a.label" variant="secondary" @click="quick(a)">{{a.label}}</AppButton></view>
          <view v-if="primaryAction" class="main-cta"><AppButton :loading="saving" @click="quick(primaryAction)">{{primaryAction.label}}</AppButton></view></view
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
    <view v-if="addressSheet" class="sheet-mask" @click="addressSheet=false"><view class="address-sheet" @click.stop><view class="sheet-heading"><text>选择地址</text><button aria-label="关闭地址选择" @click="addressSheet=false">×</button></view><scroll-view scroll-y class="address-options"><view v-for="a in addresses" :key="a._id" class="address-option"><button class="address-choice" @click="selectAddress(a)"><text class="address-radio">{{form['上门服务地址']?._id===a._id?'◉':'○'}}</text><view><text class="address-full">{{[a.省份,a.城市,a.区县,a.详细地址].filter(Boolean).join(' ')}}</text><text class="muted">{{a.联系人姓名}}　{{a.联系人电话}}</text></view></button><button class="address-edit" @click="editAddress(a)">编辑</button></view><text v-if="!addresses.length" class="empty">暂无常用地址，请新增地址</text></scroll-view><view class="sheet-footer"><AppButton variant="secondary" @click="editAddress()">新增地址</AppButton></view></view></view>

  </AppPage>
</template>
<style scoped lang="scss">
.address-select-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0}.address-select-row>text,.text-link{color:#1b4d53;font-size:14px}.selected-address{background:#f3f7f7;padding:12px;border-radius:10px;line-height:1.6}.selected-address>text{display:block}.point-summary{display:flex;flex-direction:column;gap:6px;color:#657678;margin:10px 0;font-size:14px}.action-context{background:white;border-radius:12px;padding:14px;margin:12px 0;line-height:1.7}.action-context>text{display:block;font-size:14px}.bottom-actions .secondary-links{flex-wrap:wrap}.service-page{padding-bottom:120px!important}
.compact-action .hero{margin-bottom:10px;gap:6px}.compact-action .action-context{padding:12px;margin:10px 0}.compact-action :deep(.service-fields),.booking-main-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}.compact-action :deep(.service-fields > [data-field-name]),.booking-main-fields :deep([data-field-name]){grid-column:span 2}.compact-action :deep(.service-fields > [data-field-name="安排开始时间"]),.compact-action :deep(.service-fields > [data-field-name="安排结束时间"]){grid-column:span 1}.compact-action :deep([data-field-name="安排开始时间"] .form-field__label-row),.compact-action :deep([data-field-name="安排结束时间"] .form-field__label-row){flex-basis:100%}.compact-action :deep(.form-field__control textarea){min-height:64px}.optional-toggle{display:block;padding:10px 0;color:#1b4d53;font-size:14px}.booking-inputs{margin-top:12px}.booking-flow .sub-form{border:0;margin:0;padding:0}.booking-flow .agreement{align-items:center;gap:8px}.booking-flow .agreement .required-mark{display:inline}.booking-flow .form-card{gap:10px}

.required-mark { color: $color-error; }
.service-page {
  padding: 16px;
  box-sizing: border-box;
  max-width: 100%;
  padding-bottom: 24px;
}
.message {
  padding: 12px 16px;
  border-radius: $radius-card;
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
  border-radius: $radius-card;
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
  color: $color-accent;
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
  border-radius: $radius-card;
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
  border-radius: $radius-card;
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
  border-radius: $radius-card;
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
.search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: $radius-card;
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
  border-radius: $radius-card;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.record-card {
  padding: 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: $radius-card;
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
  border-radius: $radius-card;
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
  border-radius: $radius-card;
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
.card-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}.review-summary{margin:8px 0;}.review-copy{display:block;margin:6px 0;font-size:14px;line-height:1.6;}.fund-summary{display:flex;justify-content:space-between;margin-top:8px;font-size:14px;}.agreement-label{display:flex;align-items:center;gap:6px;font-size:13px;line-height:1.6;}.voucher-toggle{background:#e7f1ef;color:#1b4d53;font-size:16px;line-height:50px;margin:12px 0 0;}.inline-voucher .voucher-card{display:flex;flex-direction:column;align-items:center;gap:10px;}
.status-tabs {white-space:nowrap;margin:0 0 12px;background:#fff;border-radius:12px;}.status-tabs button {display:inline-block;margin:0;padding:0 12px;line-height:46px;font-size:14px;background:transparent;border-radius:0;color:#687478;}.status-tabs button::after{border:0}.status-tabs button.active{color:#1b4d53;font-weight:600;border-bottom:3px solid #1b4d53;}
.order-shortcut {text-align:left;margin:0 0 12px;background:#fff;line-height:48px;font-size:15px;color:#1b4d53;}.order-shortcut::after{border:0}.filter-summary{display:flex;justify-content:space-between;color:#7a8788;font-size:13px;margin:8px 0 12px;}
.service-page{padding-left:12px;padding-right:12px}.record-card{padding:12px;margin-bottom:12px;gap:6px;position:relative}.card-top{gap:6px}.card-title{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1}.top-order-no{font-size:11px;color:#8b939b;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.card-actions{justify-content:flex-end;gap:8px;margin:4px 0 0}.card-bottom{margin-top:4px}.record-card.has-card-actions .card-bottom{display:none}.card-action-amount{margin-right:auto}.status-tabs{width:100%;white-space:nowrap;margin:8px 0}.status-tabs button{box-sizing:border-box;width:14.285%;padding:0;min-width:0;margin:0;font-size:13px;line-height:44px}.hero,.form-card{padding:12px;margin-bottom:12px}.bottom-actions{gap:8px;display:flex;align-items:center}.bottom-actions>.app-button,.bottom-actions>.secondary-links{flex:1}.bottom-actions .secondary-links{margin:0;display:flex;gap:8px}.secondary-links :deep(.app-button){flex:1}.voucher-card{padding:10px;gap:6px}.voucher-code{font-size:16px!important;white-space:nowrap;overflow:auto;word-break:normal!important}.sheet-mask{position:fixed;inset:0;z-index:90;background:#0006;display:flex;align-items:flex-end}.address-sheet{width:100%;max-height:82vh;background:#fff;border-radius:20px 20px 0 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));box-sizing:border-box}.sheet-heading{display:flex;align-items:center;justify-content:space-between;font-size:19px;font-weight:600}.sheet-heading button{background:transparent;margin:0;font-size:28px;line-height:44px;width:44px;padding:0}.address-options{max-height:55vh}.address-option{display:flex;border-bottom:1px solid #eef0f2;align-items:center;gap:8px;padding:8px 0}.address-choice{display:flex;flex:1;gap:10px;text-align:left;background:#fff;margin:0;padding:8px 0;line-height:1.6;font-size:15px}.address-choice>view{flex:1}.address-full{display:block;font-weight:600}.address-radio{color:#1b4d53;font-size:24px}.address-edit{padding:0 8px;font-size:13px;line-height:44px;margin:0;background:#f3f6f6}.sheet-footer{padding-top:12px}.selected-address{display:flex;width:100%;justify-content:space-between;gap:8px;text-align:left;font-size:15px;line-height:1.6;padding:10px}.date-sheet{padding:16px}.date-summary{font-size:12px;color:#718080;padding:6px 0}.fund-summary-grid{display:grid;gap:6px;font-size:14px;padding:8px 0}.fund-summary-grid text{display:block}
.status-tabs button{vertical-align:top;height:46px;line-height:43px;border-bottom:3px solid transparent}
.service-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:8px 0 14px}.service-grid .record-card{margin:0;min-width:0;overflow:hidden;padding:8px;gap:5px}.service-grid :deep(.service-picture){height:108px;border-radius:7px}.service-grid .card-title{font-size:15px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.tile-footer,.fund-summary-grid>view{display:flex;justify-content:space-between;align-items:center;gap:4px}.tile-footer{margin-top:auto;flex-wrap:wrap;row-gap:2px}.tile-footer .amount{white-space:nowrap;font-size:20px;line-height:1.25}.tile-footer .status{margin-left:auto}.tile-footer .status{font-size:11px;white-space:nowrap}
.tile-footer .status.pending { color:#8e4610; background:#fff2df; }
.tile-footer .status.approved { color:#17674b; background:#e4f5ed; }.order-time,.muted{color:#667781;font-size:13px}.record-card>.status{align-self:flex-start}.outgoing{color:#ad3434}.bottom-actions.action-row{flex-direction:row;align-items:center}.action-row>.secondary-links{flex:1;padding:0}.action-row>.main-cta{flex:1.65;min-width:0}.card-actions{justify-content:flex-end}.date-presets,.date-range{display:flex;gap:8px;align-items:center;margin:8px 0}.date-range picker,.date-presets button{flex:1;min-width:0;text-align:center}.date-range picker,.date-presets button,.filter-all{padding:0 4px;line-height:44px;background:#f4f7f6;font-size:14px}.date-presets .selected{color:$color-primary;background:#e5f3ee}.search-shortcut{font-size:14px!important;color:$color-primary;font-weight:600;white-space:nowrap}
</style>
