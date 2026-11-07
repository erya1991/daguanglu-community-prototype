<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { service } from "@/services/foundation";
const props = withDefaults(
  defineProps<{
    value?: any;
    table: string;
    recordId: string;
    large?: boolean;
  }>(),
  { value: () => [], large: false },
);
const url = ref(""),
  error = ref("");
let generation = 0;
function release(value: string) {
  // #ifdef H5
  if (value.startsWith("blob:")) URL.revokeObjectURL(value);
  // #endif
}
function key() {
  const value = Array.isArray(props.value) ? props.value[0] : props.value;
  return typeof value === "string"
    ? value
    : value?.id || value?.attachmentId || "";
}
async function load() {
  const stamp = ++generation;
  const id = key();
  error.value = "";
  if (!id) {
    release(url.value);
    url.value = "";
    return;
  }
  try {
    const file = await (service as any).service.attachment({
      table: props.table,
      id: props.recordId,
      attachmentId: id,
    });
    let next = file.path || "";
    // #ifdef H5
    if (file.blob) next = URL.createObjectURL(file.blob);
    // #endif
    if (stamp !== generation) {
      release(next);
      return;
    }
    release(url.value);
    url.value = next;
    if (!next) error.value = "服务图片暂不可用";
  } catch (e: any) {
    if (stamp === generation) {
      release(url.value);
      url.value = "";
      error.value = "服务图片暂不可用";
    }
  }
}
watch(() => [key(), props.recordId], load, { immediate: true });
onUnmounted(() => {
  generation++;
  release(url.value);
});
function preview() {
  if (url.value) uni.previewImage({ current: url.value, urls: [url.value] });
}
</script>
<template>
  <view
    v-if="url || error"
    class="service-picture svc-view"
    :class="{ 'service-picture--large': large }"
    data-field="29-A.07"
    ><image
      class="svc-image"
      v-if="url"
      :src="url"
      mode="aspectFill"
      @click.stop="preview"
    /><text v-else class="image-error svc-text">{{ error }}</text></view
  >
</template>
<style scoped lang="scss">
.service-picture {
  height: 144px;
  width: 100%;
  border-radius: 8px;
  background: $color-group-bg;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.service-picture--large {
  height: 196px;
}
.service-picture .svc-image {
  width: 100%;
  height: 100%;
}
.image-error {
  font-size: 13px;
  color: $color-text-secondary;
}
</style>
