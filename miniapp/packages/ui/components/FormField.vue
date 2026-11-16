<script setup lang="ts">
import { computed } from 'vue';
const props=defineProps<{ label: string; required?: boolean; hint?: string; error?: string; readonly?: boolean; multiline?: boolean }>()
const stacked=computed(()=>props.multiline || /说明|原因|内容|描述|详细地址|须知|图片|附件|材料|证明|备注|集合/.test(props.label));
</script>

<template>
  <view class="form-field" :class="{ 'form-field--error': error, 'form-field--readonly': readonly, 'form-field--inline':!readonly&&!stacked, 'form-field--stacked':!readonly&&stacked }">
    <view class="form-field__label-row"><text class="form-field__label">{{ label }}<text v-if="required" class="form-field__required"> *</text></text><text v-if="hint" class="form-field__hint">{{ hint }}</text></view>
    <view class="form-field__control"><slot /></view>
    <text v-if="error" class="form-field__error">{{ error }}</text>
  </view>
</template>

<style scoped lang="scss">
.form-field__label-row { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-2; }
.form-field__label { color: $color-text-primary; font-size: 15px; font-weight: 600; }
.form-field__required, .form-field__error { color: $color-error; }
.form-field__hint { color: $color-text-secondary; font-size: 12px; text-align: right; }
.form-field__control { min-height: 48px; margin-top: $space-2; padding: 0 $space-3; border: 1px solid $color-border; border-radius: $radius-md; background: $color-group-bg; }
.form-field__control :deep(input), .form-field__control :deep(textarea), .form-field__control :deep(picker) { width: 100%; min-height: 48px; font-size: 15px; }
.form-field__control :deep(textarea) { padding: $space-3 0; }
.form-field--readonly { display: flex; align-items: baseline; gap: 16px; padding: 10px 0; border-bottom: 1px solid $color-border; }
.form-field--readonly .form-field__label-row { flex: 0 0 100px; }
.form-field--readonly .form-field__label { font-weight: 400; color: $color-text-secondary; }
.form-field--readonly .form-field__control { flex: 1; min-width: 0; min-height: 0; margin: 0; padding: 0; border: 0; border-radius: 0; color: $color-text-primary; background: transparent; overflow-wrap: anywhere; }
.form-field--error .form-field__control { border-color: $color-error; background: $color-error-light; }
.form-field__error { display: block; margin-top: $space-1; font-size: 13px; }
.form-field { padding:10px 0; }
.form-field--inline { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; border-bottom:1px solid $color-border; }
.form-field--inline .form-field__label-row { flex:0 0 104px; min-width:0; }
.form-field--inline .form-field__label {font-weight:400; font-size:14px;}
.form-field--inline .form-field__control {flex:1; min-width:0; min-height:44px; margin:0; padding:0 8px; background:#fff; border-color:transparent;}
.form-field--inline .form-field__control :deep(input),.form-field--inline .form-field__control :deep(picker) {min-height:44px; font-size:14px;}
.form-field--inline .form-field__error {flex:0 0 100%;}
.form-field--stacked .form-field__control {margin-top:8px;}
</style>
