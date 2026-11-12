<template>
  <div v-if="row" class="s1">
    <div class="s1-summary">
      <div><h2>{{ row._title }}</h2><p v-if="row._subtitle">{{ row._subtitle }}</p><span class="s1-muted">{{ idLabel }}：{{ row._id }}</span> <Tag>{{ row._status }}</Tag></div>
      <strong v-if="row._amount !== undefined" class="s1-money">{{ money(row._amount) }}</strong>
    </div>
    <p v-if="row._businessId && row._businessId !== row._id" class="s1-actions"><a @click="$emit('open', { table: row._businessTable, id: row._businessId })">原单编号：{{ row._businessId }}</a></p>
    <Tabs v-if="isWorkorder" :key="row._id" v-model="activeTab" :animated="false">
      <TabPane name="basic" label="基本信息">
        <section class="s1-detail-section"><h3>工单信息</h3><Fields :row="source" :ids="sourceFields" :table="table" :record-id="row._id"/><Fields :row="row" :ids="present(row, ['WO15','WO16','WO17','WO19','WO22','WO23'])" :table="table" :record-id="row._id"/></section>
        <section class="s1-detail-section"><h3>派工信息</h3><Fields :row="row" :ids="present(row, ['WO04','WO05','WO07','WO09'])" :table="table" :record-id="row._id"/><p v-if="!present(row, ['WO04','WO05','WO07','WO09']).length" class="s1-muted">暂无派工信息</p></section>
      </TabPane>
      <TabPane name="evaluation" label="居民评价"><p v-if="!evaluation.VA01" class="s1-muted">暂无评价</p><Fields v-else :row="evaluation" :ids="present(evaluation, ['VA01','VA02','VA03','VA04'])" :table="table" :record-id="row._id"/></TabPane>
    </Tabs>
    <template v-else>
      <section v-for="(section, i) in groups" :key="section[0]" class="s1-detail-section"><h3>{{ section[0] }}</h3><Fields :row="row" :ids="section[1]" :table="table" :record-id="row._id"/><Fields v-if="i === 0 && row.relation" :row="row.relation" :ids="['PK03','PK05','PK06','PK13','PK14']"/></section>
      <section v-if="row.businessSummary" class="s1-detail-section"><h3>原单信息</h3><Fields :row="row.businessSummary" :ids="Object.keys(row.businessSummary).filter(id => fields[id])"/></section>
      <section v-if="(row.relatedPayments || row.payments || []).length" class="s1-detail-section"><h3>缴费记录</h3><p v-for="payment in row.relatedPayments || row.payments" :key="payment._id"><a @click="$emit('open',{table:'payments',id:payment._id})">{{ payment.PY01 }}</a> · {{ payment.PY12 }} · 核销／登记：{{ payment.PY17 }}</p></section>
      <section v-if="row.relatedChecks && row.relatedChecks.length" class="s1-detail-section"><h3>核对信息</h3><Fields v-for="check in row.relatedChecks" :key="check._id" :row="check" :ids="['EX01','EX02','EX05','EX06','EX07','EX08','EX09','EX10']" table="checks" :record-id="check._id"/></section>
    </template>
  </div>
</template>
<script>
import Fields from './Fields.vue';
import { detailSections, fieldById } from '../../../../../prototype-shared/stage01/ui.js';
export default {
  components: { Fields },
  props: { row: Object, table: String },
  data: () => ({ activeTab: 'basic', fields: fieldById }),
  watch: { 'row._id'() { this.activeTab = 'basic'; } },
  computed: {
    isWorkorder() { return ['workorders', 'reports'].includes(this.table); },
    source() { return this.row.report || this.row; },
    sourceFields() { return this.present(this.source, ['RP02','RP03','RP05','RP14','RP17', ...(this.row.WO22 ? [] : ['RP15']), ...(this.row.WO23 ? [] : ['RP16'])]); },
    evaluation() { return this.row.resolution || this.row; },
    groups() { return detailSections[this.table] || []; },
    idLabel() { return this.table === 'workorders' ? '工单编号' : this.table === 'reports' ? '上报编号' : '业务编号'; },
  },
  methods: {
    present(row, ids) { return ids.filter(id => row && row[id] !== undefined && row[id] !== null && row[id] !== '' && (!Array.isArray(row[id]) || row[id].length)); },
    money(n) { return '¥' + (Number(n) / 100).toFixed(2); },
  },
};
</script>
