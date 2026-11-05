<script setup lang="ts">
defineProps<{ files: string[]; readonly?: boolean; images?: boolean; maxFiles?: number }>()
const emit = defineEmits<{ add: []; remove: [index: number] }>()
const preview = (files: string[], index: number) => uni.previewImage({ urls: files, current: index })
</script>

<template>
  <view class="evidence-uploader" :class="{ 'evidence-uploader--images': images }"><view v-for="(file, index) in files" :key="`${file}-${index}`" class="evidence-uploader__file"><image v-if="images" :src="file" mode="aspectFill" @click="preview(files, index)" /><template v-else><text class="evidence-uploader__icon">▧</text><text class="evidence-uploader__name">{{ file }}</text></template><view v-if="!readonly" class="evidence-uploader__remove" @click="emit('remove', index)">×</view></view><view v-if="!readonly && (!maxFiles || files.length < maxFiles)" class="evidence-uploader__add" @click="emit('add')"><text class="evidence-uploader__camera">＋</text><text>上传 / 拍照</text><text class="evidence-uploader__hint">{{ images ? '本地图片凭证' : '支持图片与文件' }}</text></view></view>
</template>

<style scoped lang="scss">
.evidence-uploader { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.evidence-uploader__file, .evidence-uploader__add { position: relative; display: flex; min-height: 112px; align-items: center; justify-content: center; flex-direction: column; gap: $space-2; padding: $space-3; border: 1px solid $color-border; border-radius: $radius-md; background: $color-group-bg; text-align: center; }
.evidence-uploader__add { border-style: dashed; background: #fff; color: $color-primary; }
.evidence-uploader__icon, .evidence-uploader__camera { font-size: 28px; color: $color-primary; }
.evidence-uploader__name { width: 100%; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.evidence-uploader__hint { color: $color-text-secondary; font-size: 12px; }
.evidence-uploader__remove { position: absolute; top: 0; right: 0; display: flex; width: 40px; height: 40px; align-items: center; justify-content: center; color: $color-text-secondary; font-size: 22px; }
.evidence-uploader--images .evidence-uploader__file { padding:0; overflow:hidden; }
.evidence-uploader--images image { width:100%; height:112px; }
.evidence-uploader--images .evidence-uploader__remove { width:44px; height:44px; background:rgba(255,255,255,.9); }
</style>
