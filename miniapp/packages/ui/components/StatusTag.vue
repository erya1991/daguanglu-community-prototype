<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'success' | 'pending' | 'error' | 'disabled' }>(), { tone: 'pending' })
</script>

<template><text class="status-tag" :class="`status-tag--${tone}`"><slot /></text></template>

<style scoped lang="scss">
.status-tag { display: inline-flex; min-height: 26px; align-items: center; padding: 0 $space-2; border-radius: $radius-sm; font-size: 13px; font-weight: 600; }
.status-tag--success { background: $color-success-light; color: $color-success; }
.status-tag--pending { background: $color-warning-light; color: $color-warning; }
.status-tag--error { background: $color-error-light; color: $color-error; }
.status-tag--disabled { background: $color-group-bg; color: $color-text-secondary; }
</style>
