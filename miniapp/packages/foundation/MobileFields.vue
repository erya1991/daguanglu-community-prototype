<script setup lang="ts">
import { ref, watch } from 'vue'
import FormField from '../ui/components/FormField.vue'
import AppButton from '../ui/components/AppButton.vue'
import { catalog } from '@core/catalog.js'
import { fieldHelp } from '@core/field-help.js'
import { service } from '@/services/foundation'
const props = defineProps<{
  table: string
  modelValue: Record<string, any>
  names: string[]
  errors?: Record<string, string>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, any>] }>()
const choices = ref<Record<string, any[]>>({}),
  buildings = ref<any[]>([]),
  status = ref<Record<string, string>>({})
async function load() {
  const all: Record<string, any[]> = {}
  for (const f of props.names) all[f] = await service.options(props.table, f, props.modelValue)
  choices.value = all
  try {
    buildings.value = await service.query('buildings')
  } catch {}
}
watch(() => [props.table, props.modelValue], load, { immediate: true, deep: true })
const field = (name: string) => (catalog as any)[props.table].fields.find((f: any) => f.name === name)
function set(f: string, value: any) {
  const next = { ...props.modelValue, [f]: value }
  const cascade: Record<string, string[]> = {
    所属社区: ['所属小区', '所属楼栋', '所属单元', '房号', '_house'],
    所属小区: ['所属楼栋', '所属单元', '房号', '_house'],
    所属楼栋: ['所属单元', '房号', '_house'],
    所属单元: ['房号', '_house'],
  }
  for (const k of cascade[f] || []) next[k] = ''
  emit('update:modelValue', next)
}
const required = (name: string) =>
  field(name)?.condition.includes('必填：是') ||
  (name === '所属单元' && visible(name)) ||
  (props.table === 'applications' && ['申请关系类型', '申请有效起始日'].includes(name)) ||
  (props.table === 'applications' && name === '申请说明' && props.modelValue['申请类型'] !== '绑定')
const visible = (f: string) =>
  f !== '所属单元' ||
  buildings.value.find((b) => b._id === props.modelValue['所属楼栋'])?.['是否设单元'] === '是'
function input(f: string, e: any) {
  set(f, e.detail.value)
}
function choose(f: string, e: any) {
  set(f, choices.value[f][Number(e.detail.value)].value)
}
async function image(f: string) {
  uni.chooseImage({
    count: 1,
    success: async (r) => {
      try {
        let file: any = { path: r.tempFilePaths[0], name: '本地演示图片.png' }
        // #ifdef H5
        const blob = await fetch(r.tempFilePaths[0]).then((r) => r.blob())
        file = new File([blob], '本地演示图片.png', { type: blob.type })
        // #endif
        const saved = await service.upload(file)
        set(f, f === '证明附件' || f === '点位照片' ? [saved.id] : saved.id)
        status.value = { ...status.value, [f]: '成功（本地处理），可重新选择' }
      } catch (e: any) {
        status.value = { ...status.value, [f]: '失败：' + e.message }
      }
    },
  })
}
async function preview(f: string) {
  try {
    const id = Array.isArray(props.modelValue[f]) ? props.modelValue[f][0] : props.modelValue[f]
    const content = await service.ownedAttachment(id)
    let url = content.path
    // #ifdef H5
    url = URL.createObjectURL(content.blob)
    // #endif
    uni.previewImage({ urls: [url] })
  } catch (e: any) {
    status.value = { ...status.value, [f]: e.message }
  }
}
</script>
<template>
  <view class="mobile-fields"
    ><template v-for="name in names" :key="name"
      ><FormField
        v-if="visible(name)"
        :label="name"
        :required="required(name)"
        :hint="fieldHelp(table, name)"
        :error="errors?.[name]"
        :data-field="table + ':' + name"
      >
        <template v-if="/图片|附件|上传/.test(field(name)?.type || '')"
          ><AppButton variant="quiet" @click="image(name)">选择本地演示图片</AppButton
          ><view
            v-if="modelValue[name] && (!Array.isArray(modelValue[name]) || modelValue[name].length)"
            class="actions"
            ><AppButton variant="quiet" @click="preview(name)">预览已选图片</AppButton
            ><AppButton variant="secondary" @click="set(name, Array.isArray(modelValue[name]) ? [] : '')"
              >移除</AppButton
            ></view
          ><text class="hint">{{ status[name] || '可选；不上传真实服务器' }}</text></template
        >
        <picker
          v-else-if="choices[name]?.length"
          :range="choices[name]"
          range-key="label"
          @change="choose(name, $event)"
          ><view class="picker-value"
            >{{ choices[name].find((o) => o.value === modelValue[name])?.label || '请选择'
            }}<text>⌄</text></view
          ></picker
        >
        <view
          v-else-if="/枚举|关联对象|组织选择|账号选择/.test(field(name)?.type || '')"
          class="hint picker-value"
          >暂无可选项，请核对上级或有效关系；可选字段允许留空</view
        ><picker v-else-if="/日期/.test(field(name)?.type || '')" mode="date" @change="input(name, $event)"
          ><view class="picker-value">{{ modelValue[name] || '选择日期' }}</view></picker
        >
        <textarea
          v-else-if="/多行/.test(field(name)?.type || '')"
          :value="modelValue[name]"
          :placeholder="'填写' + name"
          :maxlength="-1"
          auto-height
          @input="input(name, $event)"
        />
        <input
          v-else
          :value="modelValue[name]"
          :placeholder="'填写' + name"
          :maxlength="-1"
          @input="input(name, $event)"
        /> </FormField></template
  ></view>
</template>
