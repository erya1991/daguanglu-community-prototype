<script setup lang="ts">
import { ref, computed, onUnmounted, watch, nextTick } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { service } from "@/services/foundation";
import AppPage from "../ui/components/AppPage.vue";
import AppNavbar from "../ui/components/AppNavbar.vue";
import Details from "./Details.vue";
const props = withDefaults(
    defineProps<{ mode: string; id?: string; relation?: string }>(),
    { id: "", relation: "" }
  ),
  options = ref<any>({ relations: [], products: [] }),
  rows = ref<any[]>([]),
  row = ref<any>(null),
  relation = ref(""),
  product = ref(""),
  error = ref(""),
  busy = ref(false),
  saving = ref(false),
  start = ref("2026-11-01"),
  end = ref("2026-11-30"),
  kind = ref("新办"),
  prior = ref<any>(null);
const title = computed(
    () =>
      ((
        {
          index: "停车服务",
          monthly: "月租办理",
          temporary: "临停缴费",
          contactless: "无感支付",
        } as any
      )[props.mode])
  ),
  products = computed(() =>
    options.value.products.filter(
      (p: any) =>
        p.MP03 ===
        options.value.relations.find((r: any) => r._id === relation.value)?.PK04
    )
  );
const money = (v: any) => "¥" + (Number(v || 0) / 100).toFixed(2);
const vehicles = computed(
  () =>
    [
      ...new Map(
        options.value.relations.map((r: any) => [
          r.PK02,
          { value: r.PK02, label: r.PK03 },
        ])
      ).values(),
    ] as any[]
);
const selectedVehicle = computed(
  () => options.value.relations.find((r: any) => r._id === relation.value)?.PK02
);
const parks = computed(() =>
  options.value.relations.filter((r: any) => r.PK02 === selectedVehicle.value)
);
function selectRelation(value: string) {
  relation.value = value;
  product.value = "";
  row.value = null;
  load();
}
function vehicle() {
  uni.navigateTo({ url: "/pages/foundation/vehicles/index" });
}
function go(path: string, p: any = {}) {
  uni.navigateTo({
    url:
      "/pages/stage01/" +
      path +
      "?" +
      Object.entries(p)
        .map(([k, v]) => k + "=" + encodeURIComponent(String(v)))
        .join("&"),
  });
}
async function load() {
  busy.value = true;
  error.value = "";
  try {
    options.value = await service.stage01.options();
    if (!options.value.relations.some((r: any) => r._id === relation.value))
      relation.value = props.relation || options.value.relations[0]?._id || "";
    product.value = product.value || products.value[0]?._id || "";
    if (props.mode === "monthly") {
      rows.value = await service.stage01.query("monthly");
      prior.value =
        rows.value
          .filter((r) => r._relation === relation.value && r.MO10 === "已登记")
          .sort((a, b) => b.MO13.localeCompare(a.MO13))[0] || null;
      if (props.id)
        row.value = await service.stage01.record("monthly", props.id);
    }
    if (props.mode === "temporary") {
      rows.value = (await service.stage01.query("temporary")).filter(
        (r) => !relation.value || r.TB03 === relation.value
      );
      if (props.id)
        row.value = await service.stage01.record("temporary", props.id);
    }
  } catch (e: any) {
    error.value = e.message;
    rows.value = [];
    row.value = null;
  } finally {
    busy.value = false;
  }
}
function renewal() {
  kind.value = "续费";
  if (prior.value) {
    const next = new Date(prior.value.MO13 + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    start.value = next.toISOString().slice(0, 10);
    const last = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
    );
    end.value = last.toISOString().slice(0, 10);
  }
}
async function create() {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    const p = products.value.find((p: any) => p._id === product.value);
    const r = await service.stage01.command("createMonthly", {
      relation: relation.value,
      product: p?._id,
      productVersion: p?.MP08,
      start: start.value,
      end: end.value,
      kind: kind.value,
      prior: prior.value?._id,
      priorVersion: prior.value?._rev,
      operation:
        "monthly-" + relation.value + "-" + start.value + "-" + end.value,
    });
    go("fees/pay", { id: r.id, kind: "停车月租" });
  } catch (e: any) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
onShow(async () => {
  await nextTick();
  await load();
});
watch(
  () => [props.id, props.relation],
  () => {
    relation.value = props.relation;
    load();
  }
);
const off = service.onChange(load);
onUnmounted(off);
</script>
<template>
  <AppPage secondary
    ><template #navbar><AppNavbar :title="title" show-back /></template
    ><view class="s1-mobile"
      ><text v-if="error" class="error">{{ error }}</text
      ><text v-if="busy" class="muted">正在读取…</text
      ><view v-if="mode === 'contactless'" class="card"
        ><text class="hero-title" data-field="AU01">暂未开放</text
        ><text class="muted" data-field="AU02"
          >无感支付将在停车服务具备条件后开放。当前可主动办理月租和临停缴费。</text
        ></view
      ><template v-else
        ><view v-if="!options.relations.length" class="card"
          >暂无有效停车关系<text class="muted"
            >车辆核验后由物业核对停车关系。</text
          ><button @click="vehicle">我的车辆</button></view
        ><picker
          v-if="options.relations.length && !id"
          :range="vehicles"
          range-key="label"
          :disabled="vehicles.length < 2"
          @change="
            selectRelation(
              options.relations.find(
                (r: any) =>
                  r.PK02 === vehicles[Number($event.detail.value)].value
              )._id
            )
          "
          ><view class="card" data-field="QF05"
            >车辆：{{
              options.relations.find((r: any) => r._id === relation)?.PK03
            }}
            {{ vehicles.length > 1 ? "›" : "" }}</view
          ></picker
        ><picker
          v-if="options.relations.length && !id"
          :range="parks"
          range-key="PK05"
          :disabled="parks.length < 2"
          @change="selectRelation(parks[Number($event.detail.value)]._id)"
          ><view class="card" data-field="QF06"
            >停车场：{{
              options.relations.find((r: any) => r._id === relation)?.PK05
            }}
            {{ parks.length > 1 ? "›" : "" }}</view
          ></picker
        ><template v-if="mode === 'index'"
          ><view
            v-for="r in options.relations.filter((r:any) => r._id === relation)"
            :key="r._id"
            class="card"
            ><text class="card-title">{{ r.PK03 }}</text
            ><text class="muted">{{ r.PK05 }} · {{ r.PK07 }}</text
            ><view class="actions"
              ><button
                class="primary"
                @click="go('parking/monthly', { relation: r._id })"
              >
                月租新办／续费</button
              ><button @click="go('parking/temporary', { relation: r._id })">
                临停缴费
              </button></view
            ><Details :row="r" table="parkingRelations" /></view
          ><button @click="go('parking/contactless')">
            无感支付
          </button></template
        ><template v-else-if="row"
          ><view class="card"
            ><text class="card-title">{{ row._title }}</text
            ><text class="state">{{ row._status }}</text
            ><text class="amount">{{ money(row._amount) }}</text></view
          ><Details
            :row="row"
            :table="mode === 'monthly' ? 'monthly' : 'temporary'"
          /><button
            v-if="mode === 'monthly' ? row.MO10 === '待支付' : row.TB08 > 0"
            class="primary"
            @click="
              go('fees/pay', {
                id: row._id,
                kind: mode === 'monthly' ? '停车月租' : '临停',
              })
            "
          >
            确认缴费</button
          ><button
            v-for="p in row.payments"
            :key="p._id"
            @click="go('payments/detail', { id: p._id })"
          >
            付款记录 · {{ p.PY12 }}</button
          ><text class="notice" data-field="XI01"
            >平台登记与停车场通行分别确认；通行信息暂未同步。</text
          ></template
        ><template v-else-if="mode === 'monthly' && options.relations.length"
          ><view class="card"
            ><text class="card-title">{{
              options.relations.find((r: any) => r._id === relation)?._title
            }}</text
            ><view class="actions"
              ><button
                :class="{ primary: kind === '新办' }"
                @click="kind = '新办'"
              >
                新办</button
              ><button
                :disabled="!prior"
                :class="{ primary: kind === '续费' }"
                @click="renewal"
              >
                续费
              </button></view
            ><text class="choice-label">月租产品 <text class="required-mark">*</text></text><picker
              :range="products"
              range-key="MP02"
              @change="product = products[Number($event.detail.value)]._id"
              ><view class="choice" data-field="MO03"
                >{{
                  products.find((p: any) => p._id === product)?.MP02 ||
                  "选择月租产品"
                }}
                ›</view
              ></picker
            ><text class="amount" data-field="MO09">{{
              money(products.find((p: any) => p._id === product)?.MP04)
            }}</text
            ><text v-if="prior" class="muted"
              >原平台期间：{{ prior.MO12 }} 至 {{ prior.MO13 }}</text
            ><text class="muted">本产品按完整自然月办理</text
            ><picker
              mode="date"
              :value="start"
              @change="start = $event.detail.value"
              ><view class="choice" data-field="MO07"
                >本次开始 <text class="required-mark">*</text> {{ start }} ›</view
              ></picker
            ><picker
              mode="date"
              :value="end"
              @change="end = $event.detail.value"
              ><view class="choice" data-field="MO08"
                >本次结束 <text class="required-mark">*</text> {{ end }} ›</view
              ></picker
            ><button class="primary" :disabled="saving" @click="create">
              确认期间并创建订单
            </button></view
          ><text class="card-title">月租订单记录</text
          ><view
            v-for="m in rows.filter((m) => m._relation === relation)"
            :key="m._id"
            class="card"
            @click="go('parking/monthly', { id: m._id, relation })"
            ><text>{{ m.MO03 }}</text
            ><text class="muted">{{ m.MO07 }} 至 {{ m.MO08 }}</text
            ><text class="state">{{ m.MO10 }}</text></view
          ></template
        ><template v-else-if="mode === 'temporary'"
          ><view
            v-for="r in rows"
            :key="r._id"
            class="card"
            @click="go('parking/temporary', { id: r._id, relation })"
            ><text class="card-title">{{ r.TB02 }}</text
            ><text class="muted">{{ r.TB09 }}</text
            ><text class="amount">{{ money(r.TB08) }}</text
            ><text class="state">{{ r.TB14 }}</text></view
          ><view v-if="!rows.length && !busy" class="card"
            >没有可核验的临停账单</view
          ></template
        ></template
      ></view
    ></AppPage
  >
</template>
<style lang="scss" src="./stage01.scss"></style>
