<script setup lang="ts">
defineProps<{ value?: string; state?: string }>();
</script>
<template>
  <view class="service-code">
    <text v-if="value" selectable class="voucher-code">{{ value }}</text>
    <text>{{ state === '有效' ? '待核验' : state || '当前暂无服务码' }}</text>
  </view>
</template>
<style scoped>
.service-code { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:12px; }
.voucher-code { font-size:26px; line-height:1.4; font-weight:600; letter-spacing:0.12em; font-variant-numeric:tabular-nums; }
</style>
