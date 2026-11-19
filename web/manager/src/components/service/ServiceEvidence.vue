<template>
  <div class="service-evidence" :data-field="fieldId">
    <div v-if="editable" class="upload-line">
      <input
        type="file"
        :multiple="multiple"
        :accept="
          imagesOnly
            ? '.png,.jpg,.jpeg'
            : '.pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx'
        "
        :aria-label="label + '选择文件'"
        @change="choose"
      />
    </div>
    <p v-if="uploading" role="status">正在保存文件，请稍候…</p>
    <p v-if="!items.length && !failed.length" class="quiet">暂无文件</p>
    <div class="compact-files"><article v-for="(item,index) in items" :key="item.id||index" class="compact-file"><button class="file-open" @click="open(item)"><img v-if="thumbnails[item.id] && isImage(item)" :src="thumbnails[item.id]" :alt="name(item)"/><span>{{name(item)}}</span><small v-if="!isImage(item)">{{size(item)}}</small></button><Button v-if="editable" size="small" @click="remove(index)" aria-label="删除附件">删除</Button></article></div>
    <article
      v-for="(f, index) in failed"
      :key="'failed-' + index"
      class="evidence-item failed"
    >
      <strong>{{ f.file.name }}</strong>
      <p data-field="C1.07">上传失败</p>
      <p data-field="C1.08" role="alert">{{ f.message }}</p>
      <Button size="small" @click="retry(index)">重试此文件</Button
      ><Button size="small" type="default" @click="failed.splice(index, 1)"
        >移除此项</Button
      >
    </article>
    <Alert v-if="error" type="error" show-icon>{{ error }}</Alert>
    <Modal
      :z-index="3200"
      v-model="previewVisible"
      :title="previewName"
      width="900"
      footer-hide
      :mask-closable="true"
      @on-hidden="closePreview"
      ><div class="preview-tools" v-if="previewImage">
        <Button @click="zoom = Math.max(0.25, zoom - 0.25)">缩小</Button
        ><Button @click="zoom = Math.min(3, zoom + 0.25)">放大</Button
        ><Button @click="zoom = 1">还原</Button>
      </div>
      <div class="preview-body">
        <img
          v-if="previewImage"
          :src="previewUrl"
          :alt="previewName"
          :style="{ width: zoom * 100 + '%' }"
        /><iframe
          v-else-if="previewType === 'application/pdf'"
          :src="previewUrl"
          :title="previewName"
        />
        <div v-else>
          <p>此格式不支持在页面内预览，请下载后查看。</p>
          <a :href="previewUrl" :download="previewName"
            >下载 {{ previewName }}</a
          >
        </div>
      </div></Modal
    >
  </div>
</template>
<script>
import { service } from "../../services/foundation";
export default {
  name: "ServiceEvidence",
  props: {
    value: { type: Array, default: () => [] },
    editable: Boolean,
    compact: Boolean,
    label: { type: String, default: "附件" },
    fieldId: String,
    record: Object,
    table: String,
    field: String,
    imagesOnly: Boolean,
    multiple: { type: Boolean, default: true },
  },
  data: () => ({
    thumbnails: {},
    uploading: false,
    failed: [],
    error: "",
    previewVisible: false,
    previewName: "",
    previewType: "",
    previewUrl: "",
    previewImage: false,
    zoom: 1,
  }),
  computed: {
    items() {
      return this.value.map((v) =>
        typeof v === "string" ? { id: v, name: v } : v,
      );
    },
  },
  watch: { value: {immediate:true,handler(){this.loadThumbnails();}}, compact(){this.loadThumbnails();} },
  beforeDestroy() {
    Object.values(this.thumbnails).forEach(url=>URL.revokeObjectURL(url));
    this.closePreview();
  },
  methods: {
    async loadThumbnails() {

      const recordId=this.record?._id;
      Object.values(this.thumbnails).forEach(url=>URL.revokeObjectURL(url));
      this.thumbnails={};
      for(const item of this.items.filter(this.isImage)){try{const file=await service.service.attachment(this.editable ? {attachmentId:item.id} : {table:this.table,id:recordId,attachmentId:item.id});if(recordId!==this.record?._id)return;if(file.blob)this.$set(this.thumbnails,item.id,URL.createObjectURL(file.blob));}catch(e){this.error=e.message;}}
    },
    name(f) {
      return f["文件名称"] || f.name || f.id || "文件";
    },
    extension(f) {
      return this.name(f).split(".").pop();
    },
    size(f) {
      const n = f["文件大小"] === undefined ? f.size : f["文件大小"];
      return n === undefined
        ? "未提供大小"
        : n >= 1024 * 1024
          ? (n / 1024 / 1024).toFixed(2) + " MiB"
          : n >= 1024
            ? (n / 1024).toFixed(1) + " KiB"
            : n + " B";
    },
    isImage(f) {
      return (
        /^image\//.test(f.type || f["文件类型"] || "") ||
        /\.(png|jpe?g)$/i.test(this.name(f))
      );
    },
    async choose(e) {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      for (const file of files) await this.save(file);
    },
    async save(file) {
      this.uploading = true;
      this.error = "";
      try {
        const f = await service.service.upload(file);
        this.$emit("input", [
          ...(this.multiple ? this.items : []),
          {
            ...f,
            文件名称: f.name || file.name,
            文件类型: f.type || file.type,
            文件大小: f.size === undefined ? file.size : f.size,
            图片说明: "",
            显示顺序: this.items.length + 1,
            上传状态: "成功",
            上传时间: f["上传时间"] || f.uploadedAt || new Date().toISOString(),
          },
        ]);
      } catch (e) {
        this.failed.push({ file, message: e.message || "保存失败，请重试" });
      } finally {
        this.uploading = false;
      }
    },
    async retry(i) {
      const entry = this.failed.splice(i, 1)[0];
      if (entry) await this.save(entry.file);
    },
    remove(i) {
      this.$emit(
        "input",
        this.items.filter((_, n) => n !== i),
      );
    },
    async open(item) {
      this.error = "";
      try {
        const p = {
          table: this.table,
          id: this.record && this.record._id,
          field: this.field,
          attachmentId: item.id || item._id,
        };
        const result = this.record
          ? await service.service.attachment(p)
          : await service.ownedAttachment(item.id || item._id);
        if (!result.blob)
          throw new Error("此文件内容暂不可打开，请核对原记录或重新选择文件");
        this.closePreview();
        this.previewUrl = URL.createObjectURL(result.blob);
        this.previewName = result.name || this.name(item);
        this.previewType = result.type || item.type || "";
        this.previewImage = this.isImage({ ...item, type: this.previewType });
        this.zoom = 1;
        this.previewVisible = true;
      } catch (e) {
        this.error = e.message || "无权打开此附件";
      }
    },
    closePreview() {
      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = "";
    },
  },
};
</script>
<style scoped>
.service-evidence {
  min-width: 0;
}
.upload-line {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.quiet {
  font-size: 12px;
  color: #657180;
}
.evidence-item {
  border: 1px solid #e4e8ed;
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
  background: #fff;
}
.evidence-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  overflow-wrap: anywhere;
}
.evidence-success {
  color: #237245;
  font-size: 12px;
}
.evidence-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #657180;
  margin: 7px 0;
}
.file-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.image-caption {
  margin: 10px 0;
}
.file-record {
  margin: 8px 0;
}
.file-record > div {
  display: grid;
  grid-template-columns: 100px 1fr;
  padding: 4px 0;
}
.file-record dt {
  color: #657180;
}
.failed {
  border-color: #e6b5b5;
}
.preview-tools {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.preview-body {
  max-height: 72vh;
  overflow: auto;
  background: #f4f5f7;
  text-align: center;
}
.preview-body img {
  max-width: none;
  display: block;
  margin: auto;
}
.preview-body iframe {
  width: 100%;
  height: 65vh;
  border: 0;
}
summary {
  cursor: pointer;
  color: #315f93;
}
.thumbnail-list{display:flex;gap:8px}.thumbnail-button{border:1px solid #edf0f2;border-radius:8px;background:#f7f9fa;padding:0;cursor:pointer;width:96px;height:76px;overflow:hidden}.thumbnail-button img{width:100%;height:100%;object-fit:cover}
.compact-files{display:flex;gap:8px;flex-wrap:wrap}.compact-file{display:flex;align-items:center;gap:8px;max-width:100%;padding:6px 0}.file-open{border:0;background:none;display:flex;align-items:center;gap:8px;text-align:left;color:#315a63;cursor:pointer;min-width:0}.file-open img{width:64px;height:64px;object-fit:cover;border-radius:6px}.file-open span{overflow-wrap:anywhere;font-size:13px}.file-open small{white-space:nowrap;color:#899399}
</style>
