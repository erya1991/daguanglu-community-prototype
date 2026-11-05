<script setup lang="ts">
withDefaults(defineProps<{ padded?: boolean }>(), { padded: true })
</script>

<template>
  <view class="base-card" :class="{ 'base-card--padded': padded }"><slot /></view>
</template>

<style scoped lang="scss">
.base-card {
  overflow: hidden;
  border: 1px solid rgba(225, 228, 230, 0.72);
  border-radius: $radius-card;
  background: $color-card-bg;
  box-shadow: 0 2px 8px rgba(27, 77, 83, 0.04);
}

.base-card--padded { padding: $space-4; }
</style>
