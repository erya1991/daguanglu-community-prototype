<script setup lang="ts">
defineProps<{ label: string; required?: boolean; hint?: string; error?: string; readonly?: boolean }>()
</script>

<template>
  <view class="form-field" :class="{ 'form-field--error': error, 'form-field--readonly': readonly }">
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
.form-field--readonly .form-field__control { color: $color-text-secondary; background: #f7f8f9; }
.form-field--error .form-field__control { border-color: $color-error; background: $color-error-light; }
.form-field__error { display: block; margin-top: $space-1; font-size: 13px; }
</style>
