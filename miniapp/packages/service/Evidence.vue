<script setup lang="ts">
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
  busy = ref(false),
  expanded = ref("");
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
  if (image(f)) {
    uni.previewImage({
      current: f.url,
      urls: files.value.filter(image).map((x) => x.url),
    });
  } else {
    // #ifdef H5
    if (f.url) {
      const a = document.createElement("a");
      a.href = f.url;
      a.download = f.name || "附件";
      a.click();
    }
    // #endif
    // #ifdef MP-WEIXIN
    if (f.path)
      uni.openDocument({
        filePath: f.path,
        showMenu: true,
        fail: () => (error.value = "此格式暂不能预览，请按授权下载后查看"),
      });
    // #endif
  }
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
function describe(index: number, text: string) {
  const next = props.value.map((v: any, i: number) => ({
    ...(typeof v === "string" ? { id: v } : v),
    显示顺序: i + 1,
  }));
  next[index].图片说明 = text;
  emit("input", next);
}
function move(index: number, offset: number) {
  const next = [...props.value];
  const j = index + offset;
  if (j < 0 || j >= next.length) return;
  [next[index], next[j]] = [next[j], next[index]];
  emit(
    "input",
    next.map((v: any, i: number) => ({
      ...(typeof v === "string" ? { id: v } : v),
      显示顺序: i + 1,
    })),
  );
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
function eventValue(event: any) { return event.detail.value }
</script>
<template>
  <view class="service-evidence svc-view">
    <view
      v-for="(f, index) in files"
      :key="f.id"
      class="evidence-item svc-view"
    >
      <image
        class="svc-image"
        v-if="image(f) && f.url"
        :src="f.url"
        mode="aspectFill"
        @click="preview(f)"
      />
      <view class="evidence-copy svc-view"
        ><text class="file-name svc-text">{{
          f.name || f["文件名称"] || "附件"
        }}</text
        ><text v-if="f.error" class="error svc-text">{{ f.error }}</text
        ><view class="links svc-view"
          ><text class="svc-text" v-if="f.url" @click="preview(f)"
            >查看内容</text
          ><text
            class="svc-text"
            @click="expanded = expanded === f.id ? '' : f.id"
            >文件详情</text
          ><text v-if="editable" class="danger svc-text" @click="remove(f.id)"
            >移除</text
          ></view
        ></view
      >
      <view v-if="editable" class="file-meta svc-view"
        ><input
          :value="f['图片说明'] || f.description || ''"
          placeholder="图片说明（选填）"
          data-field="C1.05"
          @input="describe(index, eventValue($event))"
        /><view class="links svc-view"
          ><text class="svc-text" v-if="index > 0" @click="move(index, -1)"
            >上移</text
          ><text
            class="svc-text"
            v-if="index < files.length - 1"
            @click="move(index, 1)"
            >下移</text
          ></view
        ></view
      >
      <view
        v-if="expanded === f.id"
        class="file-meta svc-view"
        data-field-table="C1"
      >
        <view class="svc-view" data-field="C1.01"
          ><text class="svc-text">文件名称</text
          ><text class="svc-text">{{ f.name || "—" }}</text></view
        >
        <view class="svc-view" data-field="C1.02"
          ><text class="svc-text">文件类型</text
          ><text class="svc-text">{{ f.type || "—" }}</text></view
        >
        <view class="svc-view" data-field="C1.03"
          ><text class="svc-text">文件大小</text
          ><text class="svc-text">{{
            f.size == null ? "—" : f.size + " B"
          }}</text></view
        >
        <view class="svc-view" data-field="C1.04"
          ><text class="svc-text">文件内容</text
          ><text class="svc-text" @click="preview(f)">{{
            f.url ? "查看原文件" : "暂不可用"
          }}</text></view
        >
        <view class="svc-view" data-field="C1.05"
          ><text class="svc-text">图片说明</text
          ><text class="svc-text">{{
            f["图片说明"] || f.description || "未填写"
          }}</text></view
        >
        <view class="svc-view" data-field="C1.06"
          ><text class="svc-text">显示顺序</text
          ><text class="svc-text">{{ index + 1 }}</text></view
        >
        <view class="svc-view" data-field="C1.07"
          ><text class="svc-text">上传状态</text
          ><text class="svc-text">{{ f.error ? "失败" : "成功" }}</text></view
        >
        <view class="svc-view" data-field="C1.08"
          ><text class="svc-text">上传失败原因</text
          ><text class="svc-text">{{ f.error || "无" }}</text></view
        >
        <view
          class="svc-view"
          v-if="!(APP === 'resident' && table === 'services')"
          data-field="C1.09"
          ><text class="svc-text">上传人</text
          ><text class="svc-text">{{
            f.uploader || f.owner || "—"
          }}</text></view
        >
        <view class="svc-view" data-field="C1.10"
          ><text class="svc-text">上传时间</text
          ><text class="svc-text">{{ f.uploadedAt || "—" }}</text></view
        >
      </view>
    </view>
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
</style>
