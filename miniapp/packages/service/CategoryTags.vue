<script setup lang="ts">
defineProps<{ ids: string[]; categories: any[] }>();
</script>
<template>
  <view class="category-tags">
    <text v-for="id in ids" :key="id" class="category-tag">{{ categories.find(c => c._id === id)?.类目名称 || id }}</text>
  </view>
</template>
<style scoped lang="scss">
.category-tags { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; width:100%; }
.category-tag { background:#f2f5f4; border-radius:6px; padding:6px; line-height:1.4; font-size:14px; text-align:center; overflow-wrap:anywhere; color:#324540; }
@media(max-width:359px){ .category-tags { grid-template-columns:repeat(2,minmax(0,1fr)); } }
</style>
