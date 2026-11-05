<template>
  <div class="form-grid">
    <FormItem
      v-for="f in fields"
      v-show="visible(f.name)"
      :key="f.name"
      :label="f.name"
      :required="required(f)"
      :error="errors[f.name]"
      :class="{ 'field-full': /多行|集合|上传/.test(f.type) }"
      :data-field="table + ':' + f.name"
    >
      <template v-if="isFile(f)"
        ><div class="file-input">
          <input
            type="file"
            :accept="
              f.name === '头像' || f.name === '点位照片'
                ? '.png,.jpg,.jpeg'
                : '.pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx'
            "
            @change="upload($event, f)"
          />
          <p>{{ uploadState[f.name] || '待选择本地演示文件；文件不会发送到服务器' }}</p>
          <p v-if="value[f.name]">已选：{{ fileNames[f.name] || value[f.name] }}</p>
          <Checkbox v-model="uploadFail">本次模拟处理失败</Checkbox>
        </div></template
      >
      <Select
        v-else-if="isChoice(f)"
        :value="value[f.name]"
        :multiple="multiple(f)"
        clearable
        filterable
        :placeholder="choices[f.name]?.length ? '请选择' : '暂无可用选项；先核对上级及授权'"
        @on-change="set(f.name, $event)"
        ><Option v-for="o in choices[f.name] || []" :key="o.value" :value="o.value">{{
          o.label
        }}</Option></Select
      >
      <DatePicker
        v-else-if="/日期/.test(f.type)"
        type="date"
        :value="value[f.name]"
        format="yyyy-MM-dd"
        @on-change="set(f.name, $event)"
        style="width: 100%"
      />
      <InputNumber
        v-else-if="/数字输入/.test(f.type)"
        :value="value[f.name] === '' || value[f.name] === undefined ? null : Number(value[f.name])"
        :min="0"
        @on-change="set(f.name, $event === null ? '' : $event)"
        style="width: 100%"
      />
      <Input
        v-else
        :value="value[f.name]"
        :type="/多行/.test(f.type) ? 'textarea' : 'text'"
        :rows="3"
        :placeholder="f.rule"
        @input="set(f.name, $event)"
      />
      <div class="muted">{{ f.rule }}</div>
    </FormItem>
    <FormItem v-if="table === 'files'" label="到期提醒（样例配置）" class="field-full"
      ><Checkbox :value="value._reminder" @on-change="set('_reminder', $event)"
        >启用本地样例提醒；Q06正式参数待确认</Checkbox
      ></FormItem
    >
  </div>
</template>
<script>
import { catalog } from '../../../../prototype-shared/catalog.js'
import { service } from '../services/foundation'
const multis = [
  '授权角色',
  '可查看社区',
  '可查看小区',
  '可见菜单',
  '允许操作',
  '敏感查看与导出权限',
  '适用社区',
  '适用小区',
  '可查阅角色',
  '可下载角色',
  '到期提醒接收人',
]
export default {
  props: {
    table: String,
    value: Object,
    errors: { type: Object, default: () => ({}) },
    names: Array,
    original: Object,
  },
  data: () => ({ choices: {}, uploadState: {}, fileNames: {}, uploadFail: false, buildings: [] }),
  computed: {
    fields() {
      const def = catalog[this.table]
      return (this.names || def.form).map((name) => def.fields.find((f) => f.name === name)).filter(Boolean)
    },
  },
  watch: { table: { handler: 'load', immediate: true }, value: { handler: 'load', deep: true } },
  methods: {
    async load() {
      const result = {}
      for (const f of this.fields) result[f.name] = await service.options(this.table, f.name, this.value)
      this.choices = result
      try {
        this.buildings = await service.query('buildings')
      } catch {}
    },
    visible(n) {
      if (this.table === 'personnel' && n === '变更说明')
        return (
          !!this.original &&
          ['所属物业组织', '岗位', '关联账号'].some((k) => this.original[k] !== this.value[k])
        )
      if (n === '所属单元')
        return this.buildings.find((b) => b._id === this.value['所属楼栋'])?.['是否设单元'] === '是'
      if (['提前提醒天数', '到期提醒接收人'].includes(n))
        return this.value._reminder && this.value['到期日期']
      return true
    },
    required(f) {
      if (f.name === '来源说明') return !!this.value['资料来源'] && this.value['资料来源'] !== '人工维护'
      if (this.table === 'personnel' && f.name === '变更说明') return this.visible(f.name)
      if (f.name === '数量单位') return this.value['数量'] !== '' && this.value['数量'] !== undefined
      if (this.table === 'files' && ['提前提醒天数', '到期提醒接收人'].includes(f.name))
        return !!this.value._reminder
      if (this.table === 'vehicles' && f.name === '登记说明')
        return (
          !!this.original &&
          ['车牌号码', '关联居民', '关联房屋'].some((k) => this.original[k] !== this.value[k])
        )
      return f.condition.includes('必填：是') || (f.name === '所属单元' && this.visible(f.name))
    },
    multiple(f) {
      return multis.includes(f.name)
    },
    isChoice(f) {
      return (this.choices[f.name] || []).length || /枚举|关联对象|组织选择|账号选择|单选|多选/.test(f.type)
    },
    isFile(f) {
      return /上传|图片集合/.test(f.type)
    },
    set(k, v) {
      const next = { ...this.value, [k]: v }
      const cascade = {
        所属社区: ['所属小区', '所属楼栋', '所属单元'],
        所属小区: ['所属楼栋', '所属单元'],
        所属楼栋: ['所属单元'],
      }
      for (const f of cascade[k] || []) next[f] = ''
      this.$emit('input', next)
    },
    async upload(event, f) {
      const file = event.target.files[0]
      if (!file) return
      this.$set(this.uploadState, f.name, '处理中')
      try {
        const r = await service.upload(file, { fail: this.uploadFail })
        this.$set(this.fileNames, f.name, r.name)
        this.set(f.name, ['证明附件', '点位照片'].includes(f.name) ? [r.id] : r.id)
        this.$set(this.uploadState, f.name, '成功（本地模拟处理）')
      } catch (e) {
        this.$set(this.uploadState, f.name, '失败：' + e.message)
      }
    },
  },
}
</script>
