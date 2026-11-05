<script setup lang="ts">
import PageState from './PageState.vue'
import type { PageStatus } from '../../common/types/app'

withDefaults(defineProps<{
  status?: PageStatus
  stateMessage?: string
  secondary?: boolean
  withBottomAction?: boolean
}>(), {
  status: 'ready',
  stateMessage: '',
  secondary: false,
  withBottomAction: false,
})

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <view class="app-page">
    <slot name="navbar" />
    <view v-if="status === 'ready'" class="app-page__content" :class="{ 'app-page__content--secondary': secondary, 'app-page__content--bottom-action': withBottomAction }">
      <slot />
    </view>
    <PageState v-else :status="status" :message="stateMessage" @retry="emit('retry')" />
    <slot name="tabbar" />
  </view>
</template>

<style scoped lang="scss">
.app-page {
  width: 100%;
  max-width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  background: $color-page-bg;
}
.app-page__content--secondary { padding-bottom: calc(env(safe-area-inset-bottom) + #{$space-6}); }
.app-page__content--bottom-action { padding-bottom: calc(env(safe-area-inset-bottom) + 92px); }
</style>
