<script setup lang="ts">
import { ref, computed, onUnmounted, watch, nextTick } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { service, APP } from "@/services/foundation";
import AppPage from "../ui/components/AppPage.vue";
import AppNavbar from "../ui/components/AppNavbar.vue";
import Details from "./Details.vue";
import { format } from "@core/stage01/ui.js";
const props = withDefaults(
  defineProps<{
    mode: string;
    id?: string;
    kind?: string;
    payment?: string;
    table?: string;
  }>(),
  { id: "", kind: "物业费", payment: "", table: "" }
);
const rows = ref<any[]>([]),
  row = ref<any>(null),
  paymentRow = ref<any>(null),
  error = ref(""),
  busy = ref(false),
  saving = ref(false),
  filter = ref(""),
  category = ref("bills"),
  options = ref<any>({ houses: [] }),
  house = ref(""),
  startDate = ref(""),
  endDate = ref(""),
  business = ref(""),
  community = ref(""),
  estate = ref("");
let generation = 0;
const charging = computed(() => props.mode.startsWith("charge")),
  paying = computed(() => props.mode === "pay"),
  isList = computed(() => ["list", "records", "charges"].includes(props.mode)),
  table = computed(
    () =>
      props.table ||
      (props.mode === "records" || props.mode === "record"
        ? "payments"
        : charging.value
        ? category.value
        : props.kind === "停车月租"
        ? "monthly"
        : props.kind === "临停"
        ? "temporary"
        : "bills")
  );
const title = computed(
  () =>
    ((
      {
        list: "物业费账单",
        detail: "物业费账单",
        pay: "确认缴费",
        records: "缴费记录",
        record: "缴费凭证",
        charges: "收费查询",
        charge: "收费详情",
      } as any
    )[props.mode])
);
const filtered = computed(() =>
  rows.value.filter(
    (r) =>
      (!filter.value ||
        [r._title, r._subtitle, r._id].join(" ").includes(filter.value)) &&
      (!house.value || r.BL07 === house.value) &&
      (!startDate.value || r._date?.slice(0, 10) >= startDate.value) &&
      (!endDate.value || r._date?.slice(0, 10) <= endDate.value) &&
      (!business.value || r.PY02 === business.value) &&
      (!community.value || r._scope?.community === community.value) &&
      (!estate.value || r._scope?.estate === estate.value)
  )
);
const canPay = computed(
  () =>
    !charging.value &&
    row.value &&
    !row.value._paymentPending &&
    (!paymentRow.value || ["失败", "已关闭"].includes(paymentRow.value.PY12)) &&
    (table.value === "bills"
      ? row.value.BL16 > 0
      : table.value === "temporary"
      ? row.value.TB08 > 0
      : row.value.MO10 === "待支付")
);
const amount = computed(() =>
  table.value === "bills"
    ? row.value?.BL16
    : table.value === "monthly"
    ? row.value?.MO09
    : row.value?.TB08
);
const money = (v: any) => "¥" + (Number(v || 0) / 100).toFixed(2);
function go(path: string, params: Record<string, any> = {}) {
  uni.navigateTo({
    url:
      "/pages/stage01/" +
      path +
      "?" +
      Object.entries(params)
        .map(([k, v]) => k + "=" + encodeURIComponent(String(v)))
        .join("&"),
  });
}
async function load() {
  const g = ++generation;
  busy.value = true;
  error.value = "";
  try {
    options.value = await service.stage01.options();
    if (isList.value) {
      const data = await service.stage01.query(table.value);
      if (g === generation) rows.value = data;
    } else {
      const data = await service.stage01.record(table.value, props.id);
      if (g !== generation) return;
      row.value = data;
      if (paying.value) {
        const payments = await service.stage01.query("payments");
        paymentRow.value = props.payment
          ? await service.stage01.record("payments", props.payment)
          : payments.filter((p) => p.PY03 === props.id).slice(-1)[0] || null;
      }
    }
  } catch (e: any) {
    error.value = e.message;
    row.value = null;
    rows.value = [];
  } finally {
    if (g === generation) busy.value = false;
  }
}
async function pay() {
  if (saving.value || !canPay.value) return;
  uni.showModal({
    title: "确认缴费",
    content:
      "收款方：" +
      options.value.config.company +
      "；应付 " +
      money(amount.value) +
      "。演示环境，不会实际扣款。",
    success: async (r) => {
      if (!r.confirm || saving.value) return;
      saving.value = true;
      error.value = "";
      try {
        const result = await service.stage01.command("pay", {
          id: row.value._id,
          kind: props.kind,
          revision: row.value._rev,
          quoteVersion: row.value.TB11,
          operation:
            "pay-" +
            row.value._id +
            "-" +
            row.value._rev +
            "-" +
            (paymentRow.value?._id || "first"),
        });
        uni.redirectTo({
          url:
            "/pages/stage01/fees/pay?id=" +
            props.id +
            "&kind=" +
            encodeURIComponent(props.kind) +
            "&payment=" +
            result.id,
        });
      } catch (e: any) {
        await load();
        error.value = e.message;
      } finally {
        saving.value = false;
      }
    },
  });
}
async function queryOriginal() {
  if (saving.value) return;
  saving.value = true;
  try {
    await service.stage01.command("queryPayment", { id: paymentRow.value._id });
    await load();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
function open(r: any) {
  go(
    charging.value
      ? "charges/detail"
      : props.mode === "records"
      ? "payments/detail"
      : "fees/detail",
    { id: r._id, table: table.value }
  );
}
onShow(async () => {
  await nextTick();
  await load();
});
watch(
  () => [props.id, props.payment, props.table],
  () => {
    load();
  }
);
const off = service.onChange(load);
onUnmounted(() => {
  generation++;
  off();
});
</script>
<template>
  <AppPage secondary
    ><template #navbar><AppNavbar :title="title" show-back /></template
    ><view class="s1-mobile"
      ><text v-if="error" class="error">{{ error }}</text
      ><text v-if="busy" class="muted">正在读取…</text
      ><template v-if="isList"
        ><view v-if="charging" class="actions"
          ><button
            v-for="t in [
              { id: 'bills', name: '物业费' },
              { id: 'monthly', name: '月租' },
              { id: 'temporary', name: '临停' },
              { id: 'payments', name: '支付' },
            ]"
            :key="t.id"
            :class="{ primary: category === t.id }"
            @click="
              category = t.id;
              load();
            "
          >
            {{ t.name }}
          </button></view
        ><view class="filters"
          ><picker
            v-if="charging"
            :range="[
              { value: '', label: '全部社区' },
              ...(options.communities || []),
            ]"
            range-key="label"
            @change="
              community = [{ value: '' }, ...options.communities][
                Number($event.detail.value)
              ].value;
              estate = '';
            "
            ><view data-field="QF02"
              >{{
                options.communities.find((c: any) => c.value === community)
                  ?.label || "全部社区"
              }}
              ›</view
            ></picker
          ><picker
            v-if="charging"
            :range="[{value:'',label:'全部小区'},...(options.estates||[]).filter((e:any)=>!community||e.community===community)]"
            range-key="label"
            @change="
              estate = [
                { value: '' },
                ...options.estates.filter(
                  (e: any) => !community || e.community === community
                ),
              ][Number($event.detail.value)].value
            "
            ><view data-field="QF03"
              >{{
                options.estates.find((e: any) => e.value === estate)?.label ||
                "全部小区"
              }}
              ›</view
            ></picker
          ><input
            v-model="filter"
            placeholder="搜索编号或内容"
            data-field="QF01"
          /><picker
            v-if="table === 'bills'"
            :range="[{ value: '', label: '全部授权房屋' }, ...options.houses]"
            range-key="label"
            @change="
              house = [{ value: '' }, ...options.houses][
                Number($event.detail.value)
              ].value
            "
            ><view data-field="QF04">选择房屋 ›</view></picker
          ><picker
            mode="date"
            :value="startDate"
            @change="startDate = $event.detail.value"
            ><view data-field="QF08"
              >{{ startDate || "开始日期" }} ›</view
            ></picker
          ><picker
            mode="date"
            :value="endDate"
            @change="endDate = $event.detail.value"
            ><view data-field="QF09"
              >{{ endDate || "结束日期" }} ›</view
            ></picker
          ><picker
            v-if="table === 'payments'"
            :range="['全部业务', '物业费', '停车月租', '临停']"
            @change="
              business = ['', '物业费', '停车月租', '临停'][
                Number($event.detail.value)
              ]
            "
            ><view data-field="QF07"
              >{{ business || "全部业务" }} ›</view
            ></picker
          ><button
            v-if="startDate || endDate || house || business"
            @click="
              startDate = '';
              endDate = '';
              house = '';
              business = '';
            "
          >
            清除筛选
          </button></view
        ><text class="muted"
          >{{
            table === "bills"
              ? "按费用开始日期"
              : table === "payments"
              ? "按渠道付款日期"
              : table === "monthly"
              ? "按订单创建日期"
              : "按入场日期"
          }}查询</text
        ><text class="muted" data-field="QF12">共 {{ filtered.length }} 条</text
        ><view v-for="r in filtered" :key="r._id" class="card" @click="open(r)"
          ><text class="card-title">{{ r._title }}</text
          ><text class="muted">{{ r._subtitle || r._id }}</text
          ><text v-if="r._amount !== undefined" class="amount">{{
            money(r._amount)
          }}</text
          ><text class="state">{{ r._status }}</text
          ><text class="link">查看详情 ›</text></view
        ><view v-if="!busy && !filtered.length" class="card" data-field="QF13"
          >当前没有可查询记录<button @click="load">重新读取</button></view
        ></template
      ><template v-else-if="row"
        ><view class="card"
          ><text class="card-title">{{ row._title }}</text
          ><text class="muted">{{ row._subtitle || row._id }}</text
          ><text class="state">{{ row._status }}</text
          ><text v-if="row._amount !== undefined && !paying" class="amount">{{
            money(row._amount)
          }}</text></view
        ><template v-if="paying"
          ><view class="card"
            ><text class="card-title">收款方</text
            ><text>{{ options.config?.company }}</text
            ><text class="muted">演示环境，不会实际扣款</text
            ><text v-if="!paymentRow" class="amount">{{
              money(amount)
            }}</text></view
          ><view v-if="paymentRow" class="card"
            ><text class="card-title" data-field="PY12">{{
              paymentRow.PY12
            }}</text
            ><text class="state" data-field="PY17">{{
              paymentRow.PY17 === "成功" ? "业务已确认" : paymentRow.PY17
            }}</text
            ><text class="amount">{{
              money(
                paymentRow.PY12 === "成功" ? paymentRow.PY07 : paymentRow.PY06
              )
            }}</text
            ><text class="muted" data-field="PY16">{{ paymentRow.PY16 }}</text
            ><button
              v-if="['处理中', '结果待确认', '成功'].includes(paymentRow.PY12)"
              :disabled="saving"
              @click="queryOriginal"
            >
              查询原支付</button
            ><button @click="go('payments/detail', { id: paymentRow._id })">
              查看付款记录</button
            ><text v-if="paymentRow.PY19" data-field="PY19"
              >普通凭证：{{ paymentRow.PY19 }}</text
            ></view
          ></template
        ><Details :row="row" :table="table" /><button
          v-if="!charging && !paying && table === 'bills' && row.BL16 > 0"
          class="primary"
          :disabled="row._paymentPending && !row.relatedPayments?.length"
          @click="go('fees/pay', { id: row._id, kind: '物业费' })"
        >
          {{
            row._paymentPending
              ? row.relatedPayments?.length
                ? "查看付款结果"
                : "付款确认中"
              : "去缴费"
          }}</button
        ><button
          v-if="!charging && row.relatedPayments?.length"
          @click="
            go('payments/detail', {
              id: row.relatedPayments[row.relatedPayments.length - 1]._id,
            })
          "
        >
          查看本人付款记录</button
        ><button
          v-if="paying && canPay"
          class="primary"
          :disabled="saving"
          @click="pay"
        >
          {{ saving ? "正在提交…" : "确认缴费" }}
        </button></template
      ><button v-if="error" @click="load">重新读取</button></view
    ></AppPage
  >
</template>
<style lang="scss" src="./stage01.scss"></style>
