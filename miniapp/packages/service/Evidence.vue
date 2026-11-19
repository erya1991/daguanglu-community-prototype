<script setup lang="ts">
import FileAttachmentRow from "../ui/components/FileAttachmentRow.vue";
import { ref, watch, onUnmounted } from "vue";
import { service, APP } from "@/services/foundation";
const props = withDefaults(
  defineProps<{
    value?: any[];
    editable?: boolean;
    table?: string;
    recordId?: string;
    imagesOnly?: boolean;
    maxFiles?: number;
  }>(),
  {
    value: () => [],
    editable: false,
    table: "",
    recordId: "",
    imagesOnly: false,
    maxFiles: 9,
  },
);
const emit = defineEmits<{ input: [any[]] }>();
const files = ref<any[]>([]),
  pending = ref<any[]>([]),
  error = ref(""),
  busy = ref(false);
let generation = 0;
const api = () => (service as any).service;
function ids() {
  return props.value
    .map((v: any) => (typeof v === "string" ? v : v.id || v.附件编号))
    .filter(Boolean);
}
function release() {
  // #ifdef H5
  files.value.forEach(
    (f) => f.url && f.url.startsWith("blob:") && URL.revokeObjectURL(f.url),
  );
  // #endif
}
async function readAttachment(id: string) {
  if (props.editable) {
    try {
      return await api().attachment({ attachmentId: id });
    } catch {}
  }
  return api().attachment({
    table: props.table,
    id: props.recordId,
    attachmentId: id,
  });
}
async function load() {
  const stamp = ++generation,
    rows: any[] = [];
  for (const id of ids()) {
    try {
      const f = await readAttachment(id);
      let url = f.path || "";
      // #ifdef H5
      if (f.blob) url = URL.createObjectURL(f.blob);
      // #endif
      const original = props.value.find(
        (v: any) => (typeof v === "string" ? v : v.id) === id,
      );
      rows.push({
        id,
        ...f,
        ...(typeof original === "object" ? original : {}),
        url,
      });
    } catch (e: any) {
      rows.push({ id, name: "附件暂不可用", error: e.message });
    }
  }
  if (stamp !== generation) return;
  release();
  files.value = rows;
}
watch(() => props.value, load, { immediate: true, deep: true });
onUnmounted(release);
function image(f: any) {
  return (
    /^image\//.test(f.type || "") || /\.(png|jpe?g|webp)$/i.test(f.name || "")
  );
}
function preview(f: any) {
  uni.previewImage({
    current: f.url,
    urls: files.value.filter((file) => image(file) && file.url).map((file) => file.url),
  });
}
async function upload() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  const next = [...props.value];
  try {
    while (pending.value.length) {
      const result = await api().upload(pending.value[0]);
      next.push({ id: result.id, 图片说明: "", 显示顺序: next.length + 1 });
      pending.value.shift();
      emit("input", [...next]);
    }
  } catch (e: any) {
    error.value = e.message || "附件保存失败，其他输入已保留";
  } finally {
    busy.value = false;
  }
}
function remove(id: string) {
  emit(
    "input",
    props.value.filter((v: any) => (typeof v === "string" ? v : v.id) !== id),
  );
}
// #ifdef H5
async function readLocalImageBlob(file: unknown): Promise<Blob> {
  if (file instanceof Blob) return file;
  const localPath = (file as { path?: unknown })?.path;
  if (typeof localPath !== "string" || !localPath.startsWith("blob:"))
    throw new Error("仅支持本地选择的图片，请重新选择；其他输入已保留");
  const response = await fetch(localPath);
  if (!response.ok)
    throw new Error("本地图片读取失败，请重新选择；其他输入已保留");
  return response.blob();
}
// #endif
function choose() {
  uni.chooseImage({
    count: Math.max(1, (props.maxFiles || 9) - props.value.length),
    success: async (r: any) => {
      try {
        for (const f of r.tempFiles.slice(
          0,
          Math.max(0, (props.maxFiles || 9) - props.value.length),
        )) {
          let file: any = {
            path: f.path,
            size: f.size,
            name: f.name || "服务凭证.jpg",
            type: "image/jpeg",
          };
          // #ifdef H5
          const blob = await readLocalImageBlob(f);
          file = new File([blob], f.name || "服务凭证.png", {
            type: blob.type || "image/png",
          });
          // #endif
          pending.value.push(file);
        }
        await upload();
      } catch (e: any) {
        error.value = e.message || "读取图片失败，文字已保留";
      }
    },
  });
}
function chooseFile() {
  // #ifdef H5
  const el = document.createElement("input");
  el.type = "file";
  el.multiple = true;
  el.accept = ".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx";
  el.onchange = async () => {
    pending.value.push(...Array.from(el.files || []));
    await upload();
  };
  el.click();
  // #endif
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 9,
    type: "file",
    success: async (r: any) => {
      pending.value.push(
        ...r.tempFiles.map((f: any) => ({
          path: f.path,
          name: f.name,
          size: f.size,
          type: f.type || "",
        })),
      );
      await upload();
    },
  });
  // #endif
}
</script>
<template>
  <view class="service-evidence svc-view">
    <template v-for="f in files" :key="f.id">
      <view v-if="image(f)" class="evidence-item svc-view">
        <image v-if="f.url" class="svc-image" :src="f.url" mode="aspectFill" @click="preview(f)" />
        <view class="evidence-copy">
          <text class="file-name">{{ f.name || '图片' }}</text>
          <text v-if="f.error" class="error">{{ f.error }}</text>
        </view>
        <button v-if="editable" class="remove-file" aria-label="删除附件" @click.stop="remove(f.id)">×</button>
      </view>
      <template v-else>
        <FileAttachmentRow :file="f" :removable="editable" @failure="error=$event" @remove="remove(f.id)" />
        <text v-if="f.error" class="error">{{ f.error }}</text>
      </template>
    </template>
    <text v-if="!files.length && !pending.length" class="muted svc-text"
      >暂无附件</text
    >
    <view
      v-if="editable && files.length < (maxFiles || 9)"
      class="upload-actions svc-view"
      ><button class="svc-button" :disabled="busy" @click="choose">
        {{ busy ? "正在保存…" : "上传／拍照" }}</button
      ><button
        class="svc-button"
        v-if="!imagesOnly"
        :disabled="busy"
        @click="chooseFile"
      >
        选择文件
      </button></view
    >
    <view
      v-for="(file, index) in pending"
      :key="index"
      class="file-meta svc-view"
      ><text class="svc-text">{{ file.name || "未完成附件" }}</text
      ><text class="svc-text" data-field="C1.07"
        >上传状态：{{ busy ? "上传中" : "失败" }}</text
      ><text v-if="!busy" data-field="C1.08" class="error svc-text">{{
        error
      }}</text></view
    ><text v-if="error" class="error svc-text">{{ error }}</text
    ><button class="svc-button" v-if="pending.length && !busy" @click="upload">
      重试未完成的上传
    </button>
  </view>
</template>
<style scoped lang="scss">
.service-evidence {
  padding: 12px 0;
}
.evidence-item {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: 12px;
  background: #fff;
}
.evidence-item .svc-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
}
.evidence-copy {
  flex: 1;
  min-width: 0;
}
.file-name {
  display: block;
  overflow-wrap: anywhere;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: $color-primary;
  margin-top: 6px;
}
.links .svc-text {
  min-height: 40px;
  display: flex;
  align-items: center;
}
.danger,
.error {
  color: $color-error;
}
.error {
  display: block;
  line-height: 1.6;
}
.muted {
  color: $color-text-secondary;
}
.file-meta {
  width: 100%;
  font-size: 13px;
}
.file-meta > .svc-view {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}
.file-meta > .svc-view > .svc-text:last-child {
  overflow-wrap: anywhere;
  text-align: right;
}
.upload-actions {
  display: flex;
  gap: 8px;
}
.upload-actions .svc-button {
  flex: 1;
  font-size: 14px;
  color: $color-primary;
  background: $color-primary-light;
}
.upload-actions .svc-button::after {
  border: 0;
}
.evidence-item{position:relative;display:flex;align-items:center;flex-wrap:nowrap;gap:8px;padding:8px 0;margin:0}.evidence-item image{width:64px!important;height:64px!important;flex:none;border-radius:6px}.evidence-copy{min-width:0;flex:1}.file-name{font-size:13px;overflow-wrap:anywhere}.remove-file{flex:none;width:44px;height:44px;line-height:44px;margin:0;padding:0;background:#f5f7f8;color:#9b3940;font-size:22px}.remove-file::after{border:0}.upload-actions{gap:8px;margin-top:8px}.upload-actions button{font-size:13px;min-height:44px;line-height:44px;margin:0;padding:0 12px}
</style>
