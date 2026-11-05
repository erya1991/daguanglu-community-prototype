<template>
  <view class="bottom-action"><view class="bottom-action__inner"><slot /></view></view>
</template>

<style scoped lang="scss">
.bottom-action { position: fixed; z-index: 20; right: 0; bottom: 0; left: 0; padding: $space-3 $page-gutter calc(env(safe-area-inset-bottom) + #{$space-3}); border-top: 1px solid rgba(225, 228, 230, 0.88); background: rgba(255, 255, 255, 0.98); box-shadow: 0 -2px 10px rgba(25, 28, 30, 0.05); }
.bottom-action__inner { display: flex; width: 100%; max-width: 100%; margin: 0 auto; gap: $space-3; }
.bottom-action__inner :deep(.app-button) { min-width: 0; flex: 1; }
.bottom-action__inner :deep(.app-button--secondary) { flex: 0 0 104px; }
</style>
