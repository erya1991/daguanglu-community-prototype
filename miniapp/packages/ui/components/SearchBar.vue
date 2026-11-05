<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{ modelValue?: string; placeholder?: string; clearable?: boolean }>(), { modelValue: '', placeholder: '搜索', clearable: false })
const emit = defineEmits<{ 'update:modelValue': [value: string]; confirm: [value: string] }>()

const handleInput = (event: Event) => {
  emit('update:modelValue', (event as Event & { detail: { value: string } }).detail.value)
}
const handleConfirm = (event: Event) => {
  emit('confirm', (event as Event & { detail: { value: string } }).detail.value)
}
</script>

<template>
  <view class="search-bar">
    <AppIcon name="search" :size="21" />
    <input class="search-bar__input" :value="modelValue" :placeholder="placeholder" confirm-type="search" @input="handleInput" @confirm="handleConfirm" />
    <button v-if="clearable && modelValue" class="search-bar__clear" aria-label="清空搜索" hover-class="search-bar__clear--pressed" @click="emit('update:modelValue', '')"><AppIcon name="close" :size="18" /></button>
  </view>
</template>

<style scoped lang="scss">
.search-bar { display: flex; height: 48px; align-items: center; gap: $space-2; padding: 0 $space-4; border: 1px solid $color-border; border-radius: $radius-md; background: #fff; box-shadow: 0 3px 12px rgba(27, 77, 83, 0.03); }
.search-bar__input { min-width: 0; flex: 1; color: $color-text-primary; font-size: 15px; }
.search-bar__clear { display: flex; width: $touch-target-min; height: $touch-target-min; flex: none; align-items: center; justify-content: center; margin: 0 -12px 0 0; padding: 0; border: 0; background: transparent; color: $color-text-secondary; }
.search-bar__clear::after { border: 0; }.search-bar__clear--pressed { opacity: .72; }
</style>
