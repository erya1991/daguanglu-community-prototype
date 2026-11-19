<script setup lang="ts">
import FileAttachmentRow from "../ui/components/FileAttachmentRow.vue";
import { ref, watch, onUnmounted } from "vue";
import { service } from "@/services/foundation";
const props = withDefaults(
  defineProps<{
    value?: string[];
    editable?: boolean;
    table?: string;
    recordId?: string;
  }>(),
  { value: () => [] }
);
const emit = defineEmits<{ input: [string[]] }>(),
  files = ref<any[]>([]),
  error = ref(""),
  pending = ref<any[]>([]),
  busy = ref(false);
let generation = 0;
async function load() {
  const stamp = ++generation;
  const rows = [];
  for (const id of props.value) {
    try {
      const f =
        props.table && props.recordId
          ? await service.stage01.attachment({
              table: props.table,
              id: props.recordId,
              attachment: id,
            })
          : await service.ownedAttachment(id);
      let url = f.path || "";
      // #ifdef H5
      url = URL.createObjectURL(f.blob);
      // #endif
      rows.push({ id, ...f, url });
    } catch (e: any) {
      rows.push({ id, name: "附件暂不可用", error: e.message });
    }
  }
  if (stamp !== generation) return;
  release();
  files.value = rows;
}
function release() {
  // #ifdef H5
  files.value.forEach((f) => f.url && URL.revokeObjectURL(f.url));
  // #endif
}
watch(() => props.value, load, { immediate: true, deep: true });
onUnmounted(release);
function isPhoto(f: any) { return /^image\//.test(f.type || "") || /\.(png|jpe?g|webp)$/i.test(f.name || ""); }
function preview(f: any) {
  if (f.url)
    uni.previewImage({
      current: f.url,
      urls: files.value.filter((f) => f.url && isPhoto(f)).map((f) => f.url),
    });
}
async function upload() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  const ids = [...props.value];
  try {
    const o = await service.stage01.options();
    while (pending.value.length) {
      const file = pending.value[0],
        r = await service.stage01.upload(file, {
          fail: !!o.scenarios.uploadFailure,
        });
      ids.push(r.id);
      pending.value.shift();
      emit("input", [...ids]);
    }
  } catch (e: any) {
    error.value = String(e.message).includes("10 MiB")
      ? "图片不能超过10 MiB，请重新选择"
      : "照片保存失败，请重试；已填内容保留";
  } finally {
    busy.value = false;
  }
}
function choose() {
  uni.chooseImage({
    count: 9,
    success: async (r) => {
      try {
        const selected: any[] = [];
        for (const f of r.tempFiles as any[]) {
          let file: any = {
            path: f.path,
            size: f.size,
            name: f.name || "现场照片.jpg",
            type: f.type || "image/jpeg",
          };
          // #ifdef H5
          const blob =
            f instanceof Blob
              ? f
              : await fetch(f.path).then((response) => response.blob());
          file = new File([blob], f.name || "现场照片.png", {
            type: blob.type,
          });
          // #endif
          selected.push(file);
        }
        pending.value = selected;
        await upload();
      } catch (e: any) {
        error.value = "照片读取失败，请重新选择；文字已保留";
      }
    },
  });
}
</script>
<template>
  <view
    ><view class="photos"
      ><template v-for="f in files" :key="f.id"><view v-if="isPhoto(f)" class="photo"
        ><image
          v-if="f.url"
          :src="f.url"
          mode="aspectFill"
          @click="preview(f)"
          data-field="AT04"
        /><text data-field="AT01">{{ f.name }}</text
        ><text v-if="f.error" class="error">{{ f.error }}</text
        ><button v-if="editable" class="remove-photo" aria-label="删除附件" @click="emit('input',value.filter(x=>x!==f.id))">×</button></view>
        <template v-else>
          <FileAttachmentRow :file="f" :removable="editable" @failure="error=$event"
            @remove="emit('input',value.filter(x=>x!==f.id))" />
          <text v-if="f.error" class="error">{{ f.error }}</text>
        </template>
      </template>
    </view><view v-if="editable" class="choose"
      ><button size="mini" @click="choose" :disabled="busy">
        选择／拍摄照片
      </button></view
    ><text v-if="busy">正在保存照片…</text
    ><view v-if="error" class="error" data-field="AT08"
      >{{ error }}<button size="mini" @click="upload">重试上传</button></view
    ></view
  >
</template>
<style scoped lang="scss">
.photos {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 8px 0;
}
.photo {
  width: calc(50% - 6px);
  min-width: 0;
}
.photo image {
  width: 100%;
  height: 120px;
  border-radius: 8px;
}
.photo > text {
  display: block;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.photo-links {
  display: flex;
  justify-content: space-between;
  color: $color-primary;
  padding: 10px 0;
}
.photo-links text {
  padding: 8px 0;
  min-height: 40px;
}
.metadata text {
  display: block;
  font-size: 12px;
  color: $color-text-secondary;
}
.error {
  color: $color-error;
  display: block;
  margin: 8px 0;
}
.choose {
  padding: 8px 0;
}
.choose input {
  width: 100%;
  min-height: 44px;
}
.photos{gap:8px}.photo{width:80px;position:relative}.photo image{height:80px;width:80px}.photo>text:not(.error){display:none}.remove-photo{position:absolute;right:-6px;top:-6px;width:44px;height:44px;line-height:44px;padding:0;margin:0;font-size:24px;background:#fffffff0;color:#bf3340}.choose button{min-height:44px;line-height:44px;background:#edf5f4;color:#1b4d53}
</style>
