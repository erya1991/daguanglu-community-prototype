<template>
  <div class="binding-detail">
    <header class="binding-detail-header">
      <div><Tag>{{ record['申请类型'] }}</Tag><ApplicationStatus :status="record['申请状态']"/><span class="muted">{{ record['申请编号'] }}</span></div>
    </header>
    <Tabs v-model="tab" :animated="false">
      <TabPane label="绑定信息" name="binding">
        <div class="binding-summary"><strong>{{ record['申请人姓名'] }}</strong><span>{{ text(record, '房屋地址') }}</span></div>
        <Alert v-if="record['申请类型'] === '解除'" type="warning">审核通过后仅解除本次对应关系，申请及其他历史记录保留。</Alert>
        <dl class="detail-grid"><div v-for="name in bindingFields" :key="name" class="detail-row" :data-field="'applications:' + name"><dt>{{ bindingLabel(name) }}</dt><dd>{{ text(record, name) }}</dd></div>
          <div v-if="relation" class="detail-row"><dt>当前关系状态</dt><dd>{{ relation['关系状态'] }}（与本次申请状态分别记录）</dd></div></dl>
        <section class="binding-materials"><h3>申请材料</h3><template v-if="record['证明附件']?.length"><Button v-for="(id, index) in record['证明附件']" :key="id" @click="$emit('preview', id)">查看材料 {{ index + 1 }}</Button></template><p v-else class="muted">当前没有可展示的材料</p><p v-if="proofError" class="error">{{ proofError }}</p></section>
      </TabPane>
      <TabPane label="居民信息" name="resident"><dl class="detail-grid"><div class="detail-row" data-field="applications:申请人姓名"><dt>申请居民</dt><dd>{{ record['申请人姓名'] }}</dd></div><div v-if="record['联系号码']" class="detail-row" data-field="applications:联系号码"><dt>联系号码</dt><dd>{{ record['联系号码'] }}</dd></div></dl></TabPane>
      <TabPane label="房屋信息" name="house">
        <p v-if="houseError" class="muted">{{ houseError }}</p>
        <dl v-if="house" class="detail-grid"><div v-for="name in houseFields" :key="name" class="detail-row" :data-field="'houses:' + name"><dt>{{ name === '房号' ? '房间号' : name }}</dt><dd>{{ text(house, name) }}</dd></div></dl>
        <Button v-if="house" @click="openHouse">打开社区房屋档案</Button>
      </TabPane>
      <TabPane label="审核记录" name="history">
        <dl class="detail-grid"><div v-for="name in reviewFields" :key="name" class="detail-row" :data-field="'applications:' + name"><dt>{{ name }}</dt><dd>{{ text(record, name) }}</dd></div></dl>
        <h3>提交与审核轮次</h3><Table :columns="roundColumns" :data="rounds" border no-data-text="暂无审核记录"/>
        <details v-if="record['维护人'] || record['更新时间']" class="binding-maintenance"><summary>维护信息</summary><p v-for="name in ['维护人', '更新时间'].filter(n => has(record, n))" :key="name">{{ name }}：{{ text(record, name) }}</p></details>
      </TabPane>
    </Tabs>
  </div>
</template>
<script>
import HistoryPanel from './HistoryPanel.vue'
import ApplicationStatus from './ApplicationStatus.vue'
import { service } from '../services/foundation'
export default {
  components: { HistoryPanel, ApplicationStatus }, props: ['record', 'history', 'canReview', 'proofError'],
  data: () => ({ tab: 'binding', house: null, relation: null, rounds: [], houseError: '', ticket: 0, loadedId: '' }),
  computed: {
    roundColumns() { return ['申请类型','审核轮次','申请状态','提交时间','审核人','审核时间','对外审核说明','内部审核备注'].map(key => ({title:key,key,minWidth:/说明|备注/.test(key)?220:130,render:(h,p)=>key==='申请状态'?h(ApplicationStatus,{props:{status:p.row[key]}}):h('span',this.text(p.row,key)||'—')})) },
    bindingFields() { return ['当前关系类型', '申请关系类型', '申请有效起始日', '申请有效结束日', '申请说明', '证明说明', '提交时间'].filter(n => this.has(this.record, n)) },
    houseFields() { return ['所属社区', '所属小区', '所属楼栋', '所属单元', '房号', '房屋编号', '房屋用途', '房屋面积'].filter(n => this.has(this.house, n)) },
    reviewFields() { return ['审核操作', '审核人', '审核时间', '对外审核说明', '内部审核备注', '撤回时间'].filter(n => this.has(this.record, n)) },
  },
  watch: { record: { handler: 'load', immediate: true, deep: true } },
  beforeDestroy() { this.ticket++ },
  methods: {
    has(r, k) { const v = r?.[k]; return v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0) },
    text(r, k) { return r?._labels?.[k] || (Array.isArray(r?.[k]) ? r[k].join('、') : String(r?.[k] ?? '')) },
    bindingLabel(n) { return n === '当前关系类型' ? '原关系类型' : n === '申请关系类型' && this.record['申请类型'] === '变更' ? '申请变更为' : n },
    async load() {
      if (this.loadedId !== this.record._id) { this.tab = 'binding'; this.loadedId = this.record._id }
      const ticket = ++this.ticket, id = this.record._id; this.house = null; this.relation = null; this.rounds = []; this.houseError = ''
      try {
        const house = (await service.labels('houses', [await service.record('houses', this.record._house)]))[0]
        if (ticket !== this.ticket) return; this.house = house
      } catch (e) { if (ticket === this.ticket) this.houseError = '房屋资料当前不可展示，请核对访问权限。' }
      try {
        const rounds = await service.labels('applications', await service.query('applications', { _house: this.record._house }))
        const relations = await service.query('relations')
        if (ticket !== this.ticket || id !== this.record._id) return
        this.rounds = rounds.filter(r => r._resident === this.record._resident && r._house === this.record._house).sort((a, b) => String(a['提交时间']).localeCompare(String(b['提交时间'])))
        this.relation = relations.find(r => r._id === this.record._relation || r['来源申请编号'] === this.record['申请编号']) || null
      } catch (e) { if (ticket === this.ticket) this.rounds = [this.record] }
    },
    async openHouse() { try { await service.record('houses', this.house._id); this.$emit('close'); this.$router.push({ path: '/spaces', query: { node: 'houses:' + this.house._id } }) } catch (e) { this.houseError = e.message } },
  },
}
</script>
