<template>
  <div class="binding-detail">
    <header class="binding-detail-header"><div><Tag>{{ record['申请类型'] }}</Tag><ApplicationStatus :status="record['申请状态']"/><span class="muted">{{ record['申请编号'] }}</span></div></header>
    <div class="binding-summary"><strong>{{ record['申请人姓名'] }}</strong><span>{{ text(record, '房屋地址') }}</span></div>
    <section><h3>申请信息</h3><dl class="detail-grid"><div v-for="name in bindingFields" :key="name" class="detail-row" :data-field="'applications:' + name"><dt>{{ bindingLabel(name) }}</dt><dd>{{ text(record, name) }}</dd></div><div v-if="record['联系号码']" class="detail-row"><dt>联系电话</dt><dd>{{ text(record, '联系号码') }}</dd></div><div v-if="relation" class="detail-row"><dt>当前关系状态</dt><dd>{{ relation['关系状态'] }}</dd></div></dl></section>
    <section class="binding-materials"><h3>申请材料</h3><template v-if="record['证明附件']?.length"><Button v-for="(id, index) in record['证明附件']" :key="id" @click="$emit('preview', id)">查看材料 {{ index + 1 }}</Button></template><p v-else class="muted">当前没有可展示的材料</p><p v-if="proofError" class="error">{{ proofError }}</p></section>
    <section><h3>房屋信息</h3><p v-if="houseError" class="muted">{{ houseError }}</p><dl v-if="house" class="detail-grid"><div v-for="name in houseFields" :key="name" class="detail-row" :data-field="'houses:' + name"><dt>{{ name === '房号' ? '房间号' : name }}</dt><dd>{{ text(house, name) }}</dd></div></dl><Button v-if="house" @click="openHouse">打开社区房屋档案</Button></section>
    <section v-if="reviewFields.length"><h3>审核结果</h3><dl class="detail-grid"><div v-for="name in reviewFields" :key="name" class="detail-row" :data-field="'applications:' + name"><dt>{{ name }}</dt><dd>{{ text(record, name) }}</dd></div></dl></section>
  </div>
</template>
<script>
import ApplicationStatus from './ApplicationStatus.vue';
import { service } from '../services/foundation';
export default {
  components: { ApplicationStatus }, props: ['record', 'proofError'],
  data: () => ({ house: null, relation: null, houseError: '', ticket: 0 }),
  computed: {
    bindingFields() { return ['当前关系类型', '申请关系类型', '申请有效起始日', '申请有效结束日', '申请说明', '证明说明', '提交时间'].filter(n => this.has(this.record, n)); },
    houseFields() { return ['所属社区', '所属小区', '所属楼栋', '所属单元', '房号', '房屋编号', '房屋用途', '房屋面积'].filter(n => this.has(this.house, n)); },
    reviewFields() { return ['审核操作', '审核人', '审核时间', '对外审核说明', '内部审核备注', '撤回时间'].filter(n => this.has(this.record, n)); },
  },
  watch: { record: { handler: 'load', immediate: true, deep: true } },
  beforeDestroy() { this.ticket++; },
  methods: {
    has(r, k) { const v = r?.[k]; return v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0); },
    text(r, k) { return r?._labels?.[k] || (Array.isArray(r?.[k]) ? r[k].join('、') : String(r?.[k] ?? '')); },
    bindingLabel(n) { return n === '当前关系类型' ? '原关系类型' : n === '申请关系类型' && this.record['申请类型'] === '变更' ? '申请变更为' : n; },
    async load() {
      const ticket = ++this.ticket, id = this.record._id; this.house = null; this.relation = null; this.houseError = '';
      try { const house = (await service.labels('houses', [await service.record('houses', this.record._house)]))[0]; if (ticket !== this.ticket) return; this.house = house; } catch (e) { if (ticket === this.ticket) this.houseError = '房屋资料当前不可展示，请核对访问权限。'; }
      try { const relations = await service.query('relations'); if (ticket !== this.ticket || id !== this.record._id) return; this.relation = relations.find(r => r._id === this.record._relation || r['来源申请编号'] === this.record['申请编号']) || null; } catch (e) { /* The application remains readable if its relationship is unavailable. */ }
    },
    async openHouse() { try { await service.record('houses', this.house._id); this.$emit('close'); this.$router.push({ path: '/spaces', query: { node: 'houses:' + this.house._id } }); } catch (e) { this.houseError = e.message; } },
  },
};
</script>
