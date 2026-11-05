<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <view class="form-section">
    <view class="form-section__heading"><view class="form-section__accent" /><view><text class="form-section__title">{{ title }}</text><text v-if="description" class="form-section__description">{{ description }}</text></view></view>
    <view class="form-section__body"><slot /></view>
  </view>
</template>

<style scoped lang="scss">
.form-section { padding: $space-4; border: 1px solid rgba(225, 228, 230, 0.72); border-radius: $radius-card; background: #fff; box-shadow: 0 2px 8px rgba(27, 77, 83, 0.04); }
.form-section__heading { display: flex; align-items: flex-start; gap: $space-2; padding-bottom: $space-3; border-bottom: 1px solid rgba(225, 228, 230, 0.72); }
.form-section__accent { width: 4px; height: 18px; flex: none; margin-top: 4px; border-radius: 999px; background: $color-primary; }
.form-section__title, .form-section__description { display: block; }
.form-section__title { font-size: 18px; font-weight: 700; }
.form-section__description { margin-top: 2px; color: $color-text-secondary; font-size: 13px; }
.form-section__body { display: flex; flex-direction: column; gap: $space-4; padding-top: $space-4; }
</style>
