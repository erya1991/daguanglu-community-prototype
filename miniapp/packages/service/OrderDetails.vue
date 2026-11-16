<script setup lang="ts">
import { serviceText } from "./presentation";
import { computed, ref } from "vue";
import { APP } from "@/services/foundation";
import FormField from "../ui/components/FormField.vue";
import Evidence from "./Evidence.vue";
const props = defineProps<{ record: any; options: any }>();
const tab = ref("info");
const groups = computed(() => [
  { id: "info", label: APP === "merchant" ? "服务信息" : "订单信息" },
  { id: "result", label: "服务结果" },
  { id: "money", label: APP === "merchant" ? "资金与售后" : "付款与售后" },
]);
const arr = computed(() => props.record.currentArrangement || {});
const location = computed(() => {
  const l = props.record["地点快照"] || {};
  return l["地点名称"]
    ? [l["地点名称"], l["详细地址"]].filter(Boolean).join(" · ")
    : [l["省份"], l["城市"], l["区县"], l["详细地址"]].filter(Boolean).join("");
});
const result = computed(
  () => props.record.result || props.record.results?.slice(-1)[0],
);
const items = computed(() => [
  ["规格", props.record["服务规格名称"]],
  ["服务方式", props.record["履约方式名称"]],
  ["服务地址", location.value],
  [
    "联系人",
    [props.record["联系人姓名"], props.record["联系人电话"]]
      .filter(Boolean)
      .join("　"),
  ],
  [
    "期望时间",
    [
      props.record["原始期望时间"]?.["期望时间选择"],
      props.record["原始期望时间"]?.["期望服务日期"],
      props.record["原始期望时间"]?.["期望时段偏好"],
    ]
      .filter(Boolean)
      .join(" "),
  ],
  ["服务人员", arr.value["服务人员姓名"]],
  [
    "服务时间",
    arr.value["安排服务日期"]
      ? `${arr.value["安排服务日期"]} ${arr.value["安排开始时间"]}—${arr.value["安排结束时间"]}`
      : "",
  ],
  ["服务对象", props.record["服务对象描述"]],
  ["补充需求", props.record["需求补充说明"]],
  ["下单时间", props.record["创建时间"]],
]);
function openSale(id: string) {
  uni.navigateTo({
    url: "/pages/service/after-sale?id=" + encodeURIComponent(id),
  });
}
function amount(f: any) {
  return (
    f["支付金额"] ||
    f["退款金额"] ||
    f["本次成功分账金额"] ||
    f["成功回退金额"] ||
    (Number(f._amount || 0) / 100).toFixed(2)
  );
}
</script>
<template>
  <view class="order-details"
    ><text v-if="record.currentAftersale" class="sale-notice"
      >{{
        record.currentAftersale.申请类型 === "核实取消"
          ? "取消处理中"
          : "售后处理中"
      }}
      · {{ record.currentAftersale.售后状态 }}</text
    ><view class="order-tabs"
      ><button
        v-for="g in groups"
        :key="g.id"
        :class="{ active: tab === g.id }"
        @click="tab = g.id"
      >
        {{ g.label }}
      </button></view
    ><view class="order-panel" v-if="tab === 'info'"
      ><template v-for="item in items" :key="item[0]"
        ><FormField v-if="item[1]" :label="item[0]" readonly
          ><text>{{ serviceText(item[1]) }}</text></FormField
        ></template
      ></view
    ><view class="order-panel" v-else-if="tab === 'result'"
      ><template v-if="result"
        ><FormField label="完成内容" readonly
          ><text>{{ result.实际完成内容 }}</text></FormField
        ><FormField label="完成时间" readonly
          ><text>{{
            record.服务完成时间 || result.结果提交时间
          }}</text></FormField
        ><FormField label="提交人" readonly
          ><text>{{ result.结果提交人 }}</text></FormField
        ><FormField v-if="result.结果补充说明" label="补充说明" readonly
          ><text>{{ result.结果补充说明 }}</text></FormField
        ><Evidence
          v-if="result.结果图片?.length"
          :value="result.结果图片"
          :editable="false"
          table="orders"
          :record-id="record._id"
        /><FormField v-if="record.credential" label="凭证状态" readonly
          ><text>{{ record.credential.凭证状态 }}</text></FormField
        ><template v-if="record.evaluation"
          ><FormField label="住户评分" readonly
            ><text>{{ record.evaluation.总体评分 }} 星</text></FormField
          ><FormField
            v-if="record.evaluation.评价内容"
            label="住户评价"
            readonly
            ><text>{{ record.evaluation.评价内容 }}</text></FormField
          ></template
        ><FormField v-if="record.订单完成时间" label="评价完成时间" readonly
          ><text>{{ record.订单完成时间 }}</text></FormField
        ></template
      ><text v-else class="muted">服务完成后可查看结果与图片</text></view
    ><view class="order-panel" v-else
      ><view v-for="f in record.fundRecords || []" :key="f._id" class="fund-row"
        ><view
          ><text>{{ f.资金类型 }} · {{ f.资金状态 }}</text
          ><text class="muted">{{ f.成功时间 || f.发起时间 }}</text></view
        ><text>¥{{ amount(f) }}</text></view
      ><text v-if="!record.fundRecords?.length" class="muted">暂无资金记录</text
      ><button
        v-for="sale in record.aftersales || []"
        :key="sale._id"
        class="sale-row"
        @click="openSale(sale._id)"
      >
        {{ sale.申请类型 === "核实取消" ? "取消申请" : "售后申请" }} ·
        {{ sale.售后状态 }}　›
      </button></view
    ></view
  >
</template>
<style scoped lang="scss">
.sale-notice {
  display: block;
  padding: 12px 16px;
  color: #a46416;
  background: #fff5df;
}
.order-details {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  margin: 14px 0;
}
.order-tabs {
  display: flex;
  border-bottom: 1px solid #e8eeee;
  position: sticky;
  top: 0;
}
.order-tabs button {
  flex: 1;
  padding: 14px 2px;
  font-size: 14px;
  line-height: 1.5;
  border-radius: 0;
  background: #fff;
  color: #677678;
}
.order-tabs button.active {
  color: #1b4d53;
  font-weight: 600;
  border-bottom: 3px solid #1b4d53;
}
.order-tabs button:after {
  border: 0;
}
.order-panel {
  padding: 8px 16px 20px;
}
.muted {
  display: block;
  color: #7b8688;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 6px;
}
.fund-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #edf0f1;
}
.sale-row {
  margin-top: 12px;
  font-size: 14px;
  background: #f3f7f7;
  color: #1b4d53;
}
</style>
