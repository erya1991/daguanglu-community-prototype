<script setup lang="ts">
import type { PageStatus } from '../../common/types/app'
import AppButton from './AppButton.vue'

defineProps<{
  status: Exclude<PageStatus, 'ready'>
  message?: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <view class="page-state">
    <view class="page-state__icon">{{ status === 'loading' ? '…' : status === 'error' ? '!' : '○' }}</view>
    <text class="page-state__title">
      {{ status === 'loading' ? '正在加载' : status === 'empty' ? '暂无内容' : ['error', 'network-error'].includes(status) ? '加载失败' : status === 'no-permission' ? '暂无权限' : status === 'disabled' ? '当前已停用' : '暂不可用' }}
    </text>
    <text class="page-state__message">{{ message || (status === 'unavailable' ? '相关能力正在建设中' : '请稍后再试') }}</text>
    <AppButton v-if="['error', 'network-error'].includes(status)" class="page-state__retry" @click="emit('retry')">重新加载</AppButton>
  </view>
</template>

<style scoped lang="scss">
.page-state {
  display: flex;
  min-height: 360px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: $space-8 $space-4;
  text-align: center;
}

.page-state__icon {
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $color-primary-light;
  color: $color-primary;
  font-size: 28px;
  font-weight: 700;
}

.page-state__title {
  margin-top: $space-4;
  font-size: 17px;
  font-weight: 600;
}

.page-state__message {
  margin-top: $space-2;
  color: $color-text-secondary;
  font-size: 14px;
}

.page-state__retry {
  width: 160px;
  margin-top: $space-5;
}
</style>
