<script setup lang="ts">
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
  busy = ref(false),
  expanded = ref("");
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
function preview(f: any) {
  if (f.url)
    uni.previewImage({
      current: f.url,
      urls: files.value.filter((f) => f.url).map((f) => f.url),
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
      ? "图片超过演示处理上限10 MiB，请重新选择"
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
      ><view v-for="f in files" :key="f.id" class="photo"
        ><image
          v-if="f.url"
          :src="f.url"
          mode="aspectFill"
          @click="preview(f)"
          data-field="AT04"
        /><text data-field="AT01">{{ f.name }}</text
        ><text v-if="f.error" class="error">{{ f.error }}</text
        ><view class="photo-links"
          ><text @click="expanded = expanded === f.id ? '' : f.id"
            >附件信息</text
          ><text
            v-if="editable"
            @click="
              emit(
                'input',
                value.filter((x) => x !== f.id)
              )
            "
            >移除</text
          ></view
        ><view v-if="expanded === f.id" class="metadata"
          ><text data-field="AT02">格式：{{ f.type || "图片" }}</text
          ><text data-field="AT03">大小：{{ f.size || 0 }} 字节</text
          ><text data-field="AT05">上传人：{{ f.uploader || "本人" }}</text
          ><text data-field="AT06"
            >上传时间：{{ f.uploadedAt || "本次选择" }}</text
          ><text data-field="AT07"
            >结果：{{ f.error ? "失败" : "成功" }}</text
          ></view
        ></view
      ></view
    ><view v-if="editable" class="choose"
      ><button size="mini" @click="choose" :disabled="busy">
        选择／拍摄照片
      </button></view
    ><text v-if="busy">正在保存照片…</text
    ><view v-if="error" class="error" data-field="AT08"
      >{{ error }}<button size="mini" @click="upload">重试上传</button></view
    ></view
  >
</template>
<style scoped>
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
  color: #175a43;
  padding: 10px 0;
}
.photo-links text {
  padding: 8px 0;
  min-height: 40px;
}
.metadata text {
  display: block;
  font-size: 12px;
  color: #59676b;
}
.error {
  color: #a3252d;
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
</style>
