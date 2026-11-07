<script setup lang="ts">
import { computed, ref } from "vue";
import { APP, service } from "@/services/foundation";
import FieldGroup from "./FieldGroup.vue";
import Evidence from "./Evidence.vue";
const props = withDefaults(
  defineProps<{ table: string; record: any; options?: any }>(),
  { options: () => ({}) },
);
const open = ref("");
const error = ref(""),
  busy = ref("");
async function fundAction(item: any, action: any) {
  if (busy.value) return;
  busy.value = item._id;
  error.value = "";
  try {
    await (service as any).service.command(action.name, {
      id: item._id,
      revision: item._rev,
      operationId: "service-fund-ui-" + Date.now(),
      data: {},
    });
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = "";
  }
}
function goAftersale(id: string) {
  uni.navigateTo({
    url: "/pages/service/after-sale?id=" + encodeURIComponent(id),
  });
}
const groups = computed(
  () =>
    (
      ({
        services: [
          { key: "content", title: "服务内容", tables: ["27-C"] },
          { key: "spec", title: "规格与履约方式", tables: ["27-D"] },
          { key: "history", title: "审核与版本历史", tables: ["27-F"] },
        ],
        qualifications: [
          { key: "current", title: "当前经营授权", tables: ["26-B"] },
          { key: "application", title: "申请与审核", tables: ["26-C"] },
          { key: "materials", title: "资格材料", tables: ["26-D"] },
        ],
        personnel: [
          { key: "person", title: "人员资料", tables: ["26-E"] },
          { key: "materials", title: "人员证明", tables: ["26-D"] },
        ],
        orders: [
          {
            key: "agreement",
            title: "服务约定",
            tables: ["29-E", "29-B", "28-A"],
          },
          {
            key: "arrangements",
            title: "服务安排与变更",
            tables: ["28-B", "28-C"],
          },
          {
            key: "rounds",
            title: "履约记录与结果",
            tables: ["30-A", "30-B", "30-C", "30-D", "30-E"],
          },
          {
            key: "aftersales",
            title: "取消与售后记录",
            tables: ["31-A", "31-B", "31-C", "31-G"],
          },
          {
            key: "fundRecords",
            title: APP === "resident" ? "付款与退款记录" : "资金记录",
            tables:
              APP === "resident" ? ["29-F", "31-D"] : ["32-C", "32-D", "32-E"],
          },
        ],
        aftersales: [
          { key: "application", title: "申请内容", tables: ["31-A"] },
          { key: "plans", title: "处理方案与答复", tables: ["31-B"] },
          { key: "rulings", title: "裁定公开结论与执行", tables: ["31-G"] },
          { key: "fundRecords", title: "退款结果", tables: ["31-D"] },
          { key: "evidence", title: "补充证据与历史", tables: ["31-C"] },
        ],
        evaluations: [
          { key: "evaluation", title: "评价内容", tables: ["31-E"] },
        ],
        funds: [
          {
            key: "fund",
            title: "资金记录与只读依据",
            tables: ["29-F", "32-C", "32-D", "32-E"],
          },
        ],
        exceptions: [{ key: "exception", title: "核查记录", tables: ["32-F"] }],
      }) as any
    )[props.table] || [],
);
function merged(value: any) {
  const r = props.record || {},
    snap = r["服务内容快照"] || {};
  return {
    ...snap.项目,
    ...snap.规格,
    ...snap.方式,
    ...r["原始期望时间"],
    ...r["地点快照"],
    ...r.credential,
    ...r.snapshot,
    ...r["订单快照"],
    ...r,
    ...value,
  };
}
function values(key: string) {
  const r = props.record || {};
  if (key === "spec")
    return (r["服务规格集合"] || []).flatMap((sp: any) =>
      (sp["组合集合"] || []).map((c: any) => ({
        ...sp,
        ...c,
        允许履约方式: (sp["组合集合"] || []).map(
          (x: any) => x["组合履约方式名称"],
        ),
      })),
    );
  if (key === "materials") return r["服务资质材料"] || r["人员资质材料"] || [];
  const v = r[key];
  return Array.isArray(v) ? v : [];
}
const histories = computed(
  () => props.record?.history || props.record?.["操作历史"] || [],
);
function changeRows(h: any) {
  if (Array.isArray(h["变更前后值"])) return h["变更前后值"];
  if (Array.isArray(h.changes)) return h.changes;
  const before = h.before || h["变更前值"] || {},
    after = h.after || h["变更后值"] || {};
  return Object.keys({ ...before, ...after }).map((k) => ({
    变更字段名称: k,
    变更前值: before[k] ?? "未设置",
    变更后值: after[k] ?? "未设置",
  }));
}
function historyData(h: any) {
  return {
    记录编号: h._id || h.id,
    动作名称: h.action,
    记录时间: h.time || h.at,
    操作人: h.actorName || h.actor,
    操作人业务身份: h.role,
    结果状态: h.status || "成功",
    原因说明: h.note,
    ...h,
  };
}
</script>
<template>
  <view class="service-details svc-view"
    ><text v-if="error" class="error svc-text">{{ error }}</text>
    <view v-for="g in groups" :key="g.key" class="detail-section svc-view"
      ><view
        class="section-toggle svc-view"
        @click="open = open === g.key ? '' : g.key"
        ><text class="svc-text">{{ g.title }}</text
        ><text class="svc-text">{{
          open === g.key ? "收起" : "查看 ›"
        }}</text></view
      ><view v-if="open === g.key" class="section-content svc-view"
        ><template v-if="values(g.key).length"
          ><view
            v-for="(item, i) in values(g.key)"
            :key="item._id || i"
            class="detail-round svc-view"
            ><text v-if="values(g.key).length > 1" class="round-title svc-text"
              >第{{ i + 1 }}条记录</text
            ><FieldGroup
              :tables="g.tables"
              :value="merged(item)"
              :options="options"
              :record-id="record._id"
              :record-table="table"
            /><view v-if="g.key === 'fundRecords'" class="fund-actions svc-view"
              ><button
                class="svc-button"
                v-for="a in (item._actions || []).filter((x: any) =>
                  ['fund.query', 'fund.retry'].includes(x.name),
                )"
                :key="a.name"
                :disabled="!!busy"
                @click="fundAction(item, a)"
              >
                {{ a.label }}
              </button></view
            ><view v-if="g.key === 'aftersales'" class="fund-actions svc-view"
              ><button class="svc-button" @click="goAftersale(item._id)">
                查看并办理本次售后
              </button></view
            ></view
          ></template
        ><FieldGroup
          v-else
          :tables="g.tables"
          :value="merged({})"
          :options="options"
          :record-id="record._id"
          :record-table="table" /></view
    ></view>
    <view
      v-if="APP === 'resident' && table === 'services'"
      class="detail-section svc-view"
    >
      <view
        class="section-toggle svc-view"
        @click="
          open = open === 'public-evaluations' ? '' : 'public-evaluations'
        "
      >
        <text class="svc-text">居民评价</text
        ><text class="svc-text">{{
          open === "public-evaluations" ? "收起" : "查看 ›"
        }}</text>
      </view>
      <view
        v-if="open === 'public-evaluations'"
        class="section-content svc-view"
      >
        <text v-if="!record.evaluations?.length" class="muted svc-text"
          >暂无公开评价</text
        >
        <view
          v-for="(review, i) in record.evaluations || []"
          :key="i"
          class="public-review svc-view"
        >
          <view class="public-review-meta svc-view"
            ><text class="svc-text" data-field="31-E.09">{{
              review["评价人公开名称"]
            }}</text
            ><text class="svc-text" data-field="31-E.06"
              >{{ review["总体评分"] }} 星</text
            ></view
          >
          <text class="muted svc-text" data-field="31-E.10">{{
            review["评价时间"]
          }}</text>
          <text class="svc-text" data-field="31-E.07">{{
            review["评价内容"] || "未填写文字评价"
          }}</text>
          <view class="svc-view" data-field="31-E.08"
            ><Evidence
              :value="review['评价图片'] || []"
              table="services"
              :record-id="record._id"
          /></view>
        </view>
      </view>
    </view>
    <view class="detail-section svc-view"
      ><view
        class="section-toggle svc-view"
        @click="open = open === 'history' ? '' : 'history'"
        ><text class="svc-text">操作与变更历史</text
        ><text class="svc-text">{{
          open === "history" ? "收起" : "查看 ›"
        }}</text></view
      ><view v-if="open === 'history'" class="section-content svc-view"
        ><text v-if="!histories.length" class="muted svc-text"
          >暂无操作历史</text
        ><view
          v-for="(h, i) in histories"
          :key="h._id || i"
          class="history-row svc-view"
          ><FieldGroup
            :tables="['C2']"
            :value="historyData(h)"
            :options="options"
            :record-id="record._id"
            :record-table="table" /><view
            v-for="(c, j) in changeRows(h)"
            :key="j"
            class="change-row svc-view"
            ><FieldGroup
              :tables="['C3']"
              :value="c"
              :options="options" /></view></view></view
    ></view>
  </view>
</template>
<style scoped lang="scss">
.public-review {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid $color-border;
  word-break: break-word;
}
.public-review-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.detail-section {
  margin: 12px 0;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 12px;
  overflow: hidden;
}
.section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 56px;
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
}
.section-toggle > .svc-text:last-child {
  color: $color-primary;
  font-size: 13px;
  font-weight: 400;
}
.section-content {
  padding: 0 16px 16px;
}
.detail-round,
.history-row {
  padding: 12px 0;
  border-top: 1px solid $color-border;
}
.round-title {
  display: block;
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
}
.change-row {
  padding: 12px;
  margin: 12px 0;
  background: $color-group-bg;
  border-radius: 8px;
}
.muted {
  color: $color-text-secondary;
}
.fund-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.fund-actions .svc-button {
  font-size: 14px;
  color: $color-primary;
  background: $color-primary-light;
}
.error {
  display: block;
  color: $color-error;
  margin: 12px 0;
}
</style>
