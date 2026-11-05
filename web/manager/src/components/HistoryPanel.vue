<template>
  <div>
    <p v-if="!records.length" class="muted">暂无本轮操作记录</p>
    <article v-for="(h, index) in records" :key="index" class="history-card">
      <dl>
        <div
          v-for="field in fields.filter((f) => f in h)"
          :key="field"
          class="detail-row"
          :data-field="'history:' + field"
        >
          <dt>{{ field }}</dt>
          <dd>
            <template v-if="['变更前值', '变更后值'].includes(field)"
              ><div v-for="(value, key) in h[field]" :key="key">{{ key }}：{{ show(value) }}</div></template
            ><template v-else>{{ show(h[field]) }}</template>
          </dd>
        </div>
      </dl>
    </article>
  </div>
</template>
<script>
export default {
  props: { records: { type: Array, default: () => [] } },
  data: () => ({
    fields: [
      '操作时间',
      '操作人',
      '操作组织',
      '操作名称',
      '操作对象',
      '变更字段',
      '变更前值',
      '变更后值',
      '操作说明／原因',
      '操作结果',
    ],
  }),
  methods: {
    show(v) {
      if (v === undefined || v === null || v === '') return '不适用'
      if (Array.isArray(v)) return v.join('、')
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v))
        return (
          new Date(Date.parse(v) + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') + '（北京时间）'
        )
      return String(v)
    },
  },
}
</script>
