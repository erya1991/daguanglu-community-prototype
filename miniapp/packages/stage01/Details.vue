<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { detailSections, fieldById } from '@core/stage01/ui.js';
import { APP } from '@/services/foundation';
import Fields from './Fields.vue';
const props = defineProps<{ row: any; table: string }>();
const tab = ref('basic');
watch(() => props.row?._id, () => { tab.value = 'basic'; });
const isWorkorder = computed(() => ['workorders','reports'].includes(props.table));
const source = computed(() => props.row.report || props.row);
const sourceFields = computed(() => present(source.value, ['RP02','RP03','RP05','RP14','RP17', ...(props.row.WO22 ? [] : ['RP15']), ...(props.row.WO23 ? [] : ['RP16'])]));
const evaluation = computed(() => props.row.resolution || props.row);
const groups = computed(() => (detailSections as Record<string, Array<[string,string[]]>>)[props.table] || []);
function present(row: any, ids: string[]) { return ids.filter(id => row && row[id] !== undefined && row[id] !== null && row[id] !== '' && (!Array.isArray(row[id]) || row[id].length)); }
function openPayment(id: string) { const route = APP === 'staff' ? '/pages/stage01/charges/detail?table=payments&id=' : '/pages/stage01/payments/detail?id='; uni.navigateTo({url: route + encodeURIComponent(id)}); }
</script>
<template>
  <view v-if="row">
    <template v-if="isWorkorder">
      <view class="detail-tabs"><button :class="{active:tab==='basic'}" @click="tab='basic'">基本信息</button><button :class="{active:tab==='evaluation'}" @click="tab='evaluation'">居民评价</button></view>
      <template v-if="tab==='basic'">
        <view class="s1-detail-group"><text class="group-title">工单信息</text><text v-if="row._workorder || table === 'workorders'" class="record-number">工单编号：{{ row._workorder || row._id }}</text><Fields :row="source" :ids="sourceFields" :table="table" :record-id="row._id"/><Fields :row="row" :ids="present(row,['WO15','WO16','WO17','WO19','WO22','WO23'])" :table="table" :record-id="row._id"/></view>
        <view v-if="present(row,['WO04','WO05','WO07','WO09']).length" class="s1-detail-group"><text class="group-title">派工信息</text><Fields :row="row" :ids="present(row,['WO04','WO05','WO07','WO09'])" :table="table" :record-id="row._id"/></view>
        <view v-if="row.feedback?.EV12 && row._canConfirm" class="s1-detail-group"><text class="group-title">本次处理结果</text><Fields :row="row.feedback" :ids="['EV12','EV13']" :table="table" :record-id="row._id"/></view>
      </template>
      <view v-else class="s1-detail-group"><text class="group-title">居民评价</text><Fields v-if="evaluation.VA01" :row="evaluation" :ids="present(evaluation,['VA01','VA02','VA03','VA04'])" :table="table" :record-id="row._id"/><text v-else class="hint">暂无评价</text></view>
    </template>
    <template v-else>
      <view v-for="section in groups" :key="section[0]" class="s1-detail-group"><text class="group-title">{{ section[0] }}</text><Fields :row="row" :ids="section[1]" :table="table" :record-id="row._id"/><Fields v-if="row.relation" :row="row.relation" :ids="['PK03','PK05','PK06','PK13','PK14']"/></view>
      <view v-if="row.businessSummary" class="s1-detail-group"><text class="group-title">原单信息</text><Fields :row="row.businessSummary" :ids="Object.keys(row.businessSummary).filter(id => fieldById[id])"/></view>
      <view v-if="(row.relatedPayments || row.payments || []).length" class="s1-detail-group"><text class="group-title">缴费记录</text><view v-for="payment in row.relatedPayments || row.payments" :key="payment._id" class="payment-link" @click="openPayment(payment._id)">{{ payment.PY01 }} · {{ payment.PY12 }} · {{ payment.PY17 }} ›</view></view>
      <view v-if="row.relatedChecks?.length" class="s1-detail-group"><text class="group-title">核对信息</text><Fields v-for="check in row.relatedChecks" :key="check._id" :row="check" :ids="['EX01','EX02','EX05','EX06','EX07','EX08','EX09','EX10']" table="checks" :record-id="check._id"/></view>
    </template>
  </view>
</template>
<style scoped lang="scss">
.s1-detail-group{background:#fff;border-radius:$radius-card;padding:16px;margin:16px 0;border:1px solid $color-border;min-width:0}
.group-title{display:block;font-size:16px;font-weight:600;line-height:1.6;margin-bottom:8px}.hint,.record-number{display:block;font-size:13px;color:$color-text-secondary;line-height:1.6}.payment-link{padding:12px 0;line-height:1.6;color:$color-primary;overflow-wrap:anywhere}
.detail-tabs{display:flex;gap:12px;margin-top:16px}.detail-tabs button{flex:1;background:#fff;border:1px solid $color-border;font-size:14px;padding:8px;line-height:1.6}.detail-tabs button.active{color:$color-primary;border-color:$color-primary;font-weight:600}
</style>
