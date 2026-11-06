<script setup lang="ts">
import { ref, computed, onUnmounted, watch, nextTick } from "vue";
import { onShow, onHide } from "@dcloudio/uni-app";
import { service, APP } from "@/services/foundation";
import AppPage from "../ui/components/AppPage.vue";
import AppNavbar from "../ui/components/AppNavbar.vue";
import ActionForm from "./ActionForm.vue";
import Details from "./Details.vue";
import { actionNames, format } from "@core/stage01/ui.js";
const names: Record<string, string> = actionNames;
const props = withDefaults(
  defineProps<{
    mode: string;
    view: string;
    id?: string;
    table?: string;
    action?: string;
  }>(),
  { id: "", table: "", action: "" }
);
const options = ref<any>({ actor: {} }),
  rows = ref<any[]>([]),
  row = ref<any>(null),
  events = ref<any[]>([]),
  form = ref<any>({}),
  errors = ref<any>({}),
  error = ref(""),
  busy = ref(false),
  saving = ref(false),
  keyword = ref(""),
  success = ref(""),
  startDate = ref(""),
  endDate = ref(""),
  status = ref(""),
  keyboard = ref(0);
let loaded = false,
  generation = 0,
  identityStamp = "";
const action = computed(() =>
  props.mode === "create"
    ? "report"
    : props.mode === "supplement"
    ? "supplement"
    : props.action
);
const table = computed(
  () => props.table || (props.view === "tasks" ? "workorders" : "reports")
);
const editing = computed(() =>
  ["create", "action", "supplement"].includes(props.mode)
);
const kind = computed(() =>
  props.view === "hazards"
    ? "隐患"
    : props.view === "repairs"
    ? "报修"
    : row.value?._kind || form.value.RP07 || "报修"
);
const title = computed(() =>
  editing.value
    ? names[action.value] || "现场上报"
    : (
        {
          repairs: "我的报修",
          hazards: "隐患随手拍",
          reports: "现场上报",
          tasks: "工单待办",
        } as any
      )[props.view]
);
const filtered = computed(() =>
  rows.value
    .filter(
      (r) =>
        !keyword.value ||
        [r._title, r._id, r._subtitle].join(" ").includes(keyword.value)
    )
    .filter(
      (r) =>
        (!startDate.value || r._date?.slice(0, 10) >= startDate.value) &&
        (!endDate.value || r._date?.slice(0, 10) <= endDate.value) &&
        (!status.value || r._status === status.value)
    )
);
const candidates = computed(() => row.value?.rounds?.slice(-1)[0]?.PR06 || []);
const draftKey = computed(
  () => `stage01:${APP}:${props.view}:${props.id}:${action.value}`
);
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
function open(r: any) {
  go(props.view + "/detail", { id: r._id, table: r._table || table.value });
}
function act(name: string) {
  if (["accept", "closeHazard"].includes(name)) {
    uni.showModal({
      title: names[name],
      content: "核对当前事项，确认办理。",
      success: (r) => {
        if (r.confirm) direct(name);
      },
    });
  } else
    go(props.view + "/action", {
      id: row.value._id,
      table: table.value,
      action: name,
    });
}
async function direct(name: string) {
  if (saving.value) return;
  saving.value = true;
  try {
    await service.stage01.command(name, {
      id: row.value._id,
      revision: row.value._rev,
      operation: name + "-" + row.value._id + "-" + row.value._rev,
    });
    await load();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
async function load() {
  const g = ++generation;
  error.value = "";
  busy.value = true;
  try {
    options.value = await service.stage01.options();
    if (identityStamp && identityStamp !== options.value.actor.id) {
      loaded = false;
      form.value = {};
      row.value = null;
    }
    identityStamp = options.value.actor.id;
    if (props.mode === "index") {
      if (props.view === "tasks") {
        const e = (await service.stage01.query("events"))
          .filter((r) => ["待核实", "待补充", "待重新核实"].includes(r.EV09))
          .map((r) => ({ ...r, _table: "events" }));
        const w = (await service.stage01.query("workorders"))
          .filter((r) => !["已完成", "已销号", "待居民确认"].includes(r.WO06))
          .map((r) => ({ ...r, _table: "workorders" }));
        rows.value = [...e, ...w];
      } else
        rows.value = (await service.stage01.query("reports")).filter(
          (r) => props.view === "reports" || r.RP07 === kind.value
        );
    } else if (props.id) {
      const r = await service.stage01.record(table.value, props.id);
      if (g !== generation) return;
      row.value = r;
    }
    if (editing.value && !loaded) {
      const saved = await service.draft(draftKey.value);
      form.value = saved || {
        ...row.value?.draft,
        RP07: kind.value,
        RP08: kind.value === "隐患" ? "公共安全" : "设施维修",
        RP09: "C-A",
        RP10: "E-A",
        RP11: "公共位置",
        RP15: options.value.actor.name,
        RP16: options.value.actor.phone || "",
        EV05: "有效",
        EV03: row.value?.report?.RP08 || "",
        EV04: row.value?.report?.RP13 || "",
        RV02: row.value?.WO12,
        RV03: "通过",
        UC01: "已解决",
        WO04:
          options.value.personnel?.find(
            (p: any) => p.account === options.value.actor.id
          )?.value || "",
        EV13: [],
      };
      if (action.value === "verify")
        events.value = await service.stage01.query("events");
      loaded = true;
    }
  } catch (e: any) {
    error.value = e.message;
    rows.value = [];
    row.value = null;
  } finally {
    if (g === generation) busy.value = false;
  }
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  errors.value = {};
  try {
    const revision = ["confirm", "evaluate"].includes(action.value)
      ? row.value?._taskRevision
      : row.value?._rev;
    const result = await service.stage01.command(action.value, {
      id: props.id || undefined,
      revision,
      data: form.value,
      operation:
        APP +
        "-" +
        action.value +
        "-" +
        (props.id || "new") +
        "-" +
        (revision ||
          "draft-" +
            (form.value._request || (form.value._request = Date.now()))),
    });
    await service.draft(draftKey.value, null);
    loaded = false;
    success.value = result.message;
    if (action.value === "report")
      uni.redirectTo({
        url:
          "/pages/stage01/" +
          (APP === "resident" ? props.view : "tasks") +
          "/detail?id=" +
          result.id +
          "&table=reports",
      });
    else uni.navigateBack({ delta: 1 });
  } catch (e: any) {
    error.value = e.message;
    errors.value = e.fields || {};
    await service.draft(draftKey.value, form.value);
  } finally {
    saving.value = false;
  }
}
const keyboardListener = (e: any) => {
  keyboard.value = e.height || 0;
};
// #ifdef MP-WEIXIN
uni.onKeyboardHeightChange(keyboardListener);
// #endif
onShow(async () => {
  await nextTick();
  await load();
});
watch(
  () => [props.id, props.action, props.table],
  () => {
    loaded = false;
    load();
  }
);
onHide(() => {
  if (editing.value && loaded && !saving.value)
    service.draft(draftKey.value, form.value);
});
const off = service.onChange(load);
onUnmounted(() => {
  generation++;
  off();
  // #ifdef MP-WEIXIN
  uni.offKeyboardHeightChange(keyboardListener);
  // #endif
});
</script>
<template>
  <AppPage secondary
    ><template #navbar><AppNavbar :title="title" show-back /></template
    ><view class="s1-mobile"
      ><text v-if="error" class="error">{{ error }}</text
      ><text v-if="success" class="notice">{{ success }}</text
      ><text v-if="busy" class="muted">正在读取…</text
      ><template v-if="mode === 'index'"
        ><button
          v-if="view !== 'tasks'"
          class="primary"
          @click="go(view + '/create')"
        >
          {{
            view === "hazards"
              ? "上报隐患"
              : view === "repairs"
              ? "提交报修"
              : "现场上报"
          }}</button
        ><view class="filters"
          ><input
            v-model="keyword"
            placeholder="搜索事项或编号"
            data-field="QF01"
          /><picker
            mode="date"
            :value="startDate"
            @change="startDate = $event.detail.value"
            ><view data-field="QF08"
              >{{ startDate || "上报开始日期" }} ›</view
            ></picker
          ><picker
            mode="date"
            :value="endDate"
            @change="endDate = $event.detail.value"
            ><view data-field="QF09"
              >{{ endDate || "上报结束日期" }} ›</view
            ></picker
          ><picker
            :range="['全部状态', ...new Set(rows.map((r) => r._status))]"
            @change="
              status = ['', ...new Set(rows.map((r) => r._status))][
                Number($event.detail.value)
              ]
            "
            ><view>{{ status || "全部状态" }} ›</view></picker
          ></view
        ><text class="muted" data-field="QF12">共 {{ filtered.length }} 条</text
        ><view v-for="r in filtered" :key="r._id" class="card" @click="open(r)"
          ><text class="card-title">{{ r._title }}</text
          ><text class="muted">{{ r._subtitle }}</text
          ><text class="state">{{ r._status }}</text
          ><text class="muted">{{ format("RP05", r._date) }}</text
          ><text class="link">查看办理 ›</text></view
        ><view v-if="!busy && !filtered.length" class="card" data-field="QF13"
          >当前暂无记录</view
        ></template
      ><template v-else-if="editing"
        ><view class="card"
          ><ActionForm
            :action="action"
            :value="form"
            @input="form = $event"
            :options="options"
            :errors="errors"
            :role="options.actor.role"
            :kind="kind"
            :records="events"
            :public-candidates="candidates" /></view
        ><view class="bottom-space" /><view
          class="fixed-action"
          :style="keyboard ? { position: 'static', paddingBottom: '16px' } : {}"
          ><button class="primary" :disabled="saving" @click="save">
            {{ saving ? "正在保存…" : "确认" + (names[action] || "提交") }}
          </button></view
        ></template
      ><template v-else-if="row"
        ><view class="card"
          ><text class="hero-title">{{ row._title }}</text
          ><text class="muted">{{ row._subtitle }}</text
          ><text class="state">{{ row._status }}</text></view
        ><view class="actions"
          ><template v-if="APP === 'resident'"
            ><button @click="act('supplement')">补充信息</button
            ><button
              v-if="row._canConfirm"
              class="primary"
              @click="act('confirm')"
            >
              确认处理结果</button
            ><button
              v-if="row._canEvaluate"
              class="primary"
              @click="act('evaluate')"
            >
              服务评价
            </button></template
          ><template v-else
            ><button
              v-if="
                table === 'events' &&
                ['待核实', '待补充', '待重新核实'].includes(row.EV09)
              "
              class="primary"
              @click="act('verify')"
            >
              核实事项</button
            ><button
              v-for="a in row._actions || []"
              :key="a"
              :disabled="saving"
              @click="act(a)"
            >
              {{ names[a] }}</button
            ><button
              v-if="table === 'reports'"
              @click="
                go('reports/supplement', { id: row._id, table: 'reports' })
              "
            >
              补充现场证据
            </button></template
          ></view
        ><Details :row="row" :table="table" /></template
      ><button v-if="error" @click="load">重新读取</button></view
    ></AppPage
  >
</template>
<style lang="scss" src="./stage01.scss"></style>
