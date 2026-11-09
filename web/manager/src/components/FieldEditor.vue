<template>
  <div class="form-grid">
    <FormItem
      v-for="f in fields"
      v-show="visible(f.name)"
      :key="f.name"
      :label="label(f.name)"
      :required="required(f)"
      :error="errors[f.name]"
      :class="{ 'field-full': /多行|集合|上传/.test(f.type) }"
      :data-field="table + ':' + f.name"
    >
      <Input
        v-if="isLocked(f.name)"
        :value="lockedText(f.name)"
        disabled
        :aria-label="label(f.name) + '（已带入，不可修改）'"
      />
      <template v-else-if="isFile(f)"
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
          <p>{{ uploadState[f.name] || '支持 PDF、PNG/JPEG、TXT、DOCX、XLSX，单文件不超过 10 MiB' }}</p>
          <p v-if="value[f.name]">已选：{{ fileNames[f.name] || value[f.name] }}</p>
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
        :placeholder="'请输入' + label(f.name)"
        @input="set(f.name, $event)"
      />
      <div v-if="help(f.name)" class="field-help">{{ help(f.name) }}</div>
    </FormItem>


  </div>
</template>
<script>
import { catalog } from '../../../../prototype-shared/catalog.js'
import { service } from '../services/foundation'
import { fieldHelp, fieldLabel } from '../../../../prototype-shared/field-help.js'
import { publicField } from '../../../../prototype-shared/r3-product.js'
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
const spaceReferences = {
  所属社区: ['communities', '社区名称'],
  所属小区: ['estates', '小区名称'],
  所属楼栋: ['buildings', '楼栋名称／楼栋号'],
  关联楼栋: ['buildings', '楼栋名称／楼栋号'],
  所属单元: ['units', '单元名称／单元号'],
}
const spaceTables = ['communities', 'estates', 'buildings', 'units', 'houses']
const resourceParents = ['所属小区', '关联楼栋', '所属单元']
export default {
  props: {
    table: String,
    value: Object,
    errors: { type: Object, default: () => ({}) },
    names: Array,
    original: Object,
    locked: { type: Object, default: () => ({}) },
  },
  data: () => ({ choices: {}, lockedNames: {}, uploadState: {}, fileNames: {}, uploadFail: false, buildings: [], loadTicket: 0 }),
  computed: {
    isResource() {
      return ['facilities', 'parking'].includes(this.table)
    },
    fields() {
      const def = catalog[this.table]
      const names = (this.names || def.form).filter(name => publicField(this.table, name))
      if (this.isResource) {
        // These controls project the existing resource ownership, rather than defining new archive fields.
        return [...resourceParents, ...names.filter((name) => !resourceParents.includes(name))]
          .map((name) => def.fields.find((f) => f.name === name) || catalog.facilities.fields.find((f) => f.name === name) || catalog.houses.fields.find((f) => f.name === name))
          .filter(Boolean)
      }
      const projected = spaceTables.includes(this.table)
        ? Object.keys(spaceReferences).filter((name) => name !== '所属社区' && this.isLocked(name) && !names.includes(name))
        : []
      return [...projected, ...names].map((name) => def.fields.find((f) => f.name === name)).filter(Boolean)
    },
  },
  watch: { table: { handler: 'load', immediate: true }, value: { handler: 'load', deep: true } },
  beforeDestroy() { this.loadTicket++ },
  methods: {
    async load() {
      const ticket = ++this.loadTicket, result = {}, lockedNames = {}, data = this.isResource ? { ...this.value, 所属楼栋: this.value['关联楼栋'] } : this.value
      for (const f of this.fields) result[f.name] = await service.options(this.table, f.name, data)
      for (const name of Object.keys(this.locked)) {
        const reference = spaceReferences[name], value = this.locked[name]
        if (!reference || !value) continue
        const option = (result[name] || []).find((item) => item.value === value)
        if (option) lockedNames[name] = option.label
        else {
          try { lockedNames[name] = (await service.record(reference[0], value))[reference[1]] || '未命名的归属档案' }
          catch { lockedNames[name] = '当前归属不可访问或已失效' }
        }
      }
      if (ticket !== this.loadTicket) return
      this.choices = result
      this.lockedNames = lockedNames
      try {
        const buildings = await service.query('buildings')
        if (ticket === this.loadTicket) this.buildings = buildings
      } catch {}
    },
    isLocked(name) {
      return Object.prototype.hasOwnProperty.call(this.locked, name)
    },
    lockedText(name) {
      const value = this.locked[name]
      if (value === '' || value === undefined || value === null) return '未关联／不适用'
      if (spaceReferences[name]) return this.lockedNames[name] || '正在读取归属名称…'
      const values = Array.isArray(value) ? value : [value]
      return values.map((v) => (this.choices[name] || []).find((item) => item.value === v)?.label || String(v)).join('、')
    },
    visible(n) {
      if (this.table === 'personnel' && n === '变更说明')
        return (
          !!this.original &&
          ['所属物业组织', '岗位', '关联账号'].some((k) => this.original[k] !== this.value[k])
        )
      if (n === '所属单元')
        return !!this.value[n] || this.buildings.find((b) => b._id === this.value[this.isResource ? '关联楼栋' : '所属楼栋'])?.['是否设单元'] === '是'
      if (['提前提醒天数', '到期提醒接收人'].includes(n))
        return this.value._reminder && this.value['到期日期']
      return true
    },
    help(n) { return fieldHelp(this.table, n) },
    label(n) { return this.isResource && n === '关联楼栋' ? '所属楼栋' : fieldLabel(this.table, n) },
    required(f) {
      if (this.isResource && resourceParents.includes(f.name)) return ['所属小区', '关联楼栋'].includes(f.name)
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
      if (this.isLocked(k)) return
      const next = { ...this.value, [k]: v }
      const cascade = this.isResource ? {
        所属社区: ['所属小区', '关联楼栋', '所属单元', '关联房屋'],
        所属小区: ['关联楼栋', '所属单元', '关联房屋'],
        关联楼栋: ['所属单元', '关联房屋'],
        所属单元: ['关联房屋'],
      } : {
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
        const r = await service.upload(file)
        this.$set(this.fileNames, f.name, r.name)
        this.set(f.name, ['证明附件', '点位照片'].includes(f.name) ? [r.id] : r.id)
        this.$set(this.uploadState, f.name, '上传成功')
      } catch (e) {
        this.$set(this.uploadState, f.name, '失败：' + e.message)
      }
    },
  },
}
</script>
