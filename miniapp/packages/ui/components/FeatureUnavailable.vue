<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import AppButton from './AppButton.vue'

withDefaults(defineProps<{ title?: string; description?: string }>(), { title: '功能暂不可用', description: '该服务将在开放后提供，当前可以继续浏览其他功能。' })
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <view class="feature-unavailable-mask" @click.self="emit('close')" @touchmove.stop.prevent>
    <view class="feature-unavailable" @click.stop>
      <view class="feature-unavailable__mark"><AppIcon name="services" :size="22" /></view>
      <text class="feature-unavailable__title">{{ title }}</text>
      <text class="feature-unavailable__description">{{ description }}</text>
      <AppButton class="feature-unavailable__close" @click="emit('close')">知道了</AppButton>
    </view>
  </view>
</template>

<style scoped lang="scss">
.feature-unavailable-mask { position: fixed; z-index: 200; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; justify-content: center; padding: $space-4 $page-gutter calc($space-4 + env(safe-area-inset-bottom)); background: rgba(25, 28, 30, 0.4); }
.feature-unavailable { width: 100%; max-width: 390px; padding: $space-5 $space-4 calc($space-4 + env(safe-area-inset-bottom)); border-radius: $radius-sheet $radius-sheet 0 0; background: $color-card-bg; box-shadow: 0 -4px 20px rgba(27, 77, 83, 0.08); text-align: center; }
.feature-unavailable__mark { display: flex; width: 44px; height: 44px; align-items: center; justify-content: center; margin: 0 auto; border-radius: 50%; background: $color-primary-light; color: $color-primary; font-size: 22px; font-weight: 700; }
.feature-unavailable__title, .feature-unavailable__description { display: block; }
.feature-unavailable__title { margin-top: $space-3; font-size: 17px; font-weight: 600; }
.feature-unavailable__description { margin-top: $space-1; color: $color-text-secondary; font-size: 14px; line-height: 22px; }
.feature-unavailable__close { margin-top: $space-5; }
</style>
