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
      /><span class="quiet">支持查看已提交附件；上传失败可重试。</span>
    </div>
    <p v-if="uploading" role="status">正在保存文件，请稍候…</p>
    <p v-if="!items.length && !failed.length" class="quiet">暂无文件</p>
    <article
      v-for="(item, index) in items"
      :key="item.id || index"
      class="evidence-item"
    >
      <div class="evidence-heading">
        <strong data-field="C1.01">{{ name(item) }}</strong
        ><span class="evidence-success" data-field="C1.07">{{
          item["上传状态"] || item.status || "成功"
        }}</span>
      </div>
      <div class="evidence-meta">
        <span data-field="C1.02"
          >类型：{{ item["文件类型"] || item.type || extension(item) }}</span
        ><span data-field="C1.03">大小：{{ size(item) }}</span>
      </div>
      <div
        v-if="editable && isImage(item)"
        class="image-caption"
        data-field="C1.05"
      >
        <label
          >图片说明<Input
            :value="item['图片说明'] || item.description || ''"
            @input="update(index, '图片说明', $event)"
        /></label>
      </div>
      <p v-else-if="item['图片说明'] || item.description" data-field="C1.05">
        {{ item["图片说明"] || item.description }}
      </p>
      <details>
        <summary>文件记录</summary>
        <dl class="file-record">
          <div>
            <dt>显示顺序</dt>
            <dd data-field="C1.06">{{ index + 1 }}</dd>
          </div>
          <div>
            <dt>上传人</dt>
            <dd data-field="C1.09">
              {{ item["上传人"] || item.uploader || "当前上传账号" }}
            </dd>
          </div>
          <div>
            <dt>上传时间</dt>
            <dd data-field="C1.10">
              {{ item["上传时间"] || item.uploadedAt || "随文件记录保存" }}
            </dd>
          </div>
          <div>
            <dt>上传失败原因</dt>
            <dd data-field="C1.08">{{ item["上传失败原因"] || "无" }}</dd>
          </div>
        </dl>
      </details>
      <div class="file-actions">
        <Button size="small" @click="open(item)" data-field="C1.04">{{
          isImage(item) ? "查看图片" : "打开文件"
        }}</Button
        ><template v-if="editable"
          ><Button size="small" :disabled="index === 0" @click="move(index, -1)"
            >上移</Button
          ><Button
            size="small"
            :disabled="index === items.length - 1"
            @click="move(index, 1)"
            >下移</Button
          ><Button size="small" type="text" @click="remove(index)"
            >移除</Button
          ></template
        >
      </div>
    </article>
    <article
      v-for="(f, index) in failed"
      :key="'failed-' + index"
      class="evidence-item failed"
    >
      <strong>{{ f.file.name }}</strong>
      <p data-field="C1.07">上传失败</p>
      <p data-field="C1.08" role="alert">{{ f.message }}</p>
      <Button size="small" @click="retry(index)">重试此文件</Button
      ><Button size="small" type="text" @click="failed.splice(index, 1)"
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
    label: { type: String, default: "附件" },
    fieldId: String,
    record: Object,
    table: String,
    field: String,
    imagesOnly: Boolean,
    multiple: { type: Boolean, default: true },
  },
  data: () => ({
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
  beforeDestroy() {
    this.closePreview();
  },
  methods: {
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
    update(i, key, value) {
      const arr = this.items.map((x, n) =>
        n === i ? { ...x, [key]: value } : x,
      );
      this.$emit("input", arr);
    },
    move(i, delta) {
      const arr = [...this.items];
      [arr[i], arr[i + delta]] = [arr[i + delta], arr[i]];
      this.$emit(
        "input",
        arr.map((x, n) => ({ ...x, 显示顺序: n + 1 })),
      );
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
</style>
