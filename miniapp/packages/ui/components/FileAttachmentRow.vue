<script setup lang="ts">
import AppButton from './AppButton.vue'

const props = defineProps<{
  file: { name?: string; size?: number; url?: string; path?: string }
  removable?: boolean
}>()
const emit = defineEmits<{ remove: []; failure: [message: string] }>()

function openFile() {
  // #ifdef H5
  if (props.file.url) {
    const link = document.createElement('a')
    link.href = props.file.url
    link.download = props.file.name || '附件'
    link.click()
  }
  // #endif
  // #ifdef MP-WEIXIN
  if (props.file.path) {
    uni.openDocument({
      filePath: props.file.path,
      showMenu: true,
      fail: () => emit('failure', '此格式暂不能在微信打开，请下载后查看'),
    })
  }
  // #endif
}
</script>

<template>
  <view class="file-attachment-row">
    <text class="file-attachment-row__name">{{ file.name || '附件' }}</text>
    <text v-if="file.size" class="file-attachment-row__size">{{ Math.ceil(file.size / 1024) }} KB</text>
    <AppButton v-if="file.url || file.path" size="compact" variant="quiet" @click="openFile">打开</AppButton>
    <AppButton v-if="removable" size="compact" variant="danger" @click="emit('remove')">删除</AppButton>
  </view>
</template>

<style scoped lang="scss">
.file-attachment-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 32px;
  gap: 6px;
  border-bottom: 1px solid #edf1f0;
}
.file-attachment-row__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
}
.file-attachment-row__size { flex-shrink: 0; font-size: 12px; color: #5a726d; }
.file-attachment-row :deep(.app-button) { flex-shrink: 0; }
</style>
