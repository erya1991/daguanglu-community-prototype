<script setup lang="ts">
withDefaults(defineProps<{ modelValue?: number; readonly?: boolean }>(), { modelValue: 0, readonly: false });
const emit = defineEmits<{ 'update:modelValue': [number] }>();
</script>
<template><view class="star-rating" :class="{readonly}" :aria-label="`${modelValue}星`"><button v-for="n in 5" :key="n" :disabled="readonly" :aria-label="`${n}星`" :class="{selected:n<=modelValue}" @click="emit('update:modelValue',n)">★</button><text v-if="readonly" class="score">{{modelValue}}分</text></view></template>
<style scoped lang="scss">
.star-rating { display:flex; align-items:center; gap:6px; }
.star-rating button { margin:0; padding:0; width:36px; height:44px; line-height:44px; border:0; background:transparent; color:#d8dce2; font-size:32px; }
.star-rating button::after { border:0; }.star-rating button.selected { color:#ed9b21; }
.readonly { gap:2px; }.readonly button { width:18px; height:24px; line-height:24px; font-size:19px; }.score { font-size:13px; margin-left:6px; color:#6b7280; }
</style>
