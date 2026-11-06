<template>
  <div class="s1-evidence">
    <div class="s1-photo-grid">
      <div v-for="f in files" :key="f.id" class="s1-photo">
        <img
          v-if="f.url && f.type.startsWith('image/')"
          :src="f.url"
          :alt="f.name"
          @click="preview = f"
        /><button v-else-if="f.url" type="button" @click="preview = f">
          查看附件</button
        ><span>{{ f.name }}</span>
        <details>
          <summary>附件信息</summary>
          <div
            v-for="id in [
              'AT01',
              'AT02',
              'AT03',
              'AT05',
              'AT06',
              'AT07',
              'AT08',
            ].filter((id) => id !== 'AT08' || f.error)"
            :key="id"
            :data-field="id"
          >
            {{ names[id] }}：{{ meta(f, id) }}
          </div>
        </details>
        <button v-if="editable" type="button" @click="remove(f.id)">移除</button
        ><span v-if="f.error" class="s1-error">{{ f.error }}</span>
      </div>
    </div>
    <input
      v-if="editable"
      type="file"
      accept="image/png,image/jpeg"
      multiple
      aria-label="选择照片"
      @change="choose"
    /><span v-if="busy">正在保存照片…</span>
    <div v-if="error" class="s1-error" data-field="AT08">
      {{ error }} <button type="button" @click="retry">重试上传</button>
    </div>
    <Modal
      :z-index="3600"
      :value="!!preview"
      title="附件预览"
      :footer-hide="true"
      @on-cancel="preview = null"
      ><img
        v-if="preview"
        :src="preview.url"
        :alt="preview.name"
        style="max-width: 100%"
        data-field="AT04"
    /></Modal>
  </div>
</template>
<script>
import { service } from "../../services/foundation";
import { fieldById } from "../../../../../prototype-shared/stage01/fields.js";
export default {
  props: {
    value: { type: Array, default: () => [] },
    editable: Boolean,
    table: String,
    recordId: String,
  },
  data: () => ({
    files: [],
    busy: false,
    error: "",
    pending: [],
    preview: null,
    names: Object.fromEntries(
      Object.values(fieldById).map((f) => [f.id, f.name])
    ),
  }),
  watch: {
    value: {
      immediate: true,
      handler() {
        this.load();
      },
    },
  },
  beforeDestroy() {
    this.files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
  },
  methods: {
    meta(f, id) {
      return {
        AT01: f.name,
        AT02: f.type,
        AT03: (f.size || 0) + " 字节",
        AT05: f.uploader || "本人",
        AT06: f.uploadedAt || "本次上传",
        AT07: f.error ? "失败" : "成功",
        AT08: f.error || "无",
      }[id];
    },
    async load() {
      const next = [];
      for (const id of this.value) {
        try {
          let f;
          if (this.table && this.recordId)
            f = await service.stage01.attachment({
              table: this.table,
              id: this.recordId,
              attachment: id,
            });
          else f = await service.ownedAttachment(id);
          next.push({
            id,
            ...f,
            url: URL.createObjectURL(f.blob),
            type: f.type || f.blob.type,
          });
        } catch (e) {
          next.push({ id, name: "附件暂不可用", error: e.message, type: "" });
        }
      }
      this.files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
      this.files = next;
    },
    remove(id) {
      this.$emit(
        "input",
        this.value.filter((x) => x !== id)
      );
    },
    choose(e) {
      this.pending = Array.from(e.target.files);
      e.target.value = "";
      this.retry();
    },
    async retry() {
      if (this.busy) return;
      this.busy = true;
      this.error = "";
      const ids = [...this.value];
      try {
        while (this.pending.length) {
          const file = this.pending[0];
          const f = await service.stage01.upload(file, {
            fail: sessionStorage.getItem("stage01-upload-fail") === "1",
          });
          ids.push(f.id);
          this.pending.shift();
          this.$emit("input", [...ids]);
        }
      } catch (e) {
        this.error = e.message;
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
