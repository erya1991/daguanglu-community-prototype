<script setup lang="ts">
defineProps<{ tone: 'success' | 'pending' | 'error'; title: string; description: string }>()
</script>

<template>
  <view class="result-state" :class="`result-state--${tone}`"><view class="result-state__icon">{{ tone === 'success' ? '✓' : tone === 'error' ? '!' : '…' }}</view><text class="result-state__title">{{ title }}</text><text class="result-state__description">{{ description }}</text><slot /></view>
</template>

<style scoped lang="scss">
.result-state { display: flex; align-items: center; flex-direction: column; padding: $space-6 $space-4; border: 1px solid rgba(225, 228, 230, 0.72); border-radius: $radius-card; background: #fff; text-align: center; }
.result-state__icon { display: flex; width: 56px; height: 56px; align-items: center; justify-content: center; border-radius: 50%; background: $color-warning-light; color: $color-warning; font-size: 28px; font-weight: 700; }
.result-state--success .result-state__icon { background: $color-success-light; color: $color-success; }
.result-state--error .result-state__icon { background: $color-error-light; color: $color-error; }
.result-state__title { margin-top: $space-3; font-size: 20px; font-weight: 700; }
.result-state__description { margin-top: $space-2; color: $color-text-secondary; font-size: 14px; }
</style>
