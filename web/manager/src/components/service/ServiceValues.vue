<template>
  <div class="service-values">
    <template v-if="Array.isArray(value)"
      ><p v-if="!value.length" class="quiet">暂无记录</p>
      <article v-for="(item, index) in value" :key="index" class="value-entry">
        <strong v-if="typeof item === 'object'"
          >{{ label || "记录" }} {{ index + 1 }}</strong
        ><ServiceValues
          :value="item"
          :path="path + ':' + index"
          :label="label"
          :options="options"
          @preview="$emit('preview', $event)"
        /></article
    ></template>
    <dl v-else-if="value && typeof value === 'object'" class="object-values">
      <div
        v-for="[key, item] in entries(value)"
        :key="key"
        :data-field="fieldForKey(key)"
      >
        <dt>{{ labels[key] || key }}</dt>
        <dd>
          <ServiceValues
            v-if="typeof item === 'object' && item !== null"
            :value="item"
            :path="path + ':' + key"
            :options="options"
            :label="labels[key] || key"
            @preview="$emit('preview', $event)"
          /><span v-else>{{ show(item, key) }}</span>
        </dd>
      </div>
      <p v-if="!entries(value).length" class="quiet">暂无可公开内容</p>
    </dl>
    <span v-else>{{ show(value) }}</span>
  </div>
</template>
<script>
import { plain } from "./model";
import { tableById } from "../../../../../prototype-shared/service/fields.js";
const labels = {
  history: "业务操作历史",
  arrangements: "安排版本",
  rounds: "履约轮次",
  fundRecords: "资金记录",
  items: "关联条目",
  snapshot: "下单快照",
  published: "发布版本",
  draft: "编辑版本",
  currentAuthorization: "当前有效授权",
  authorization: "当前有效授权",
  applications: "申请版本",
  currentArrangement: "当前有效安排",
  latestResult: "本轮服务结果",
  plan: "处理方案",
  plans: "协商方案历史",
  ruling: "当前裁定结果",
  rulings: "裁定历史",
  refunds: "退款记录",
  changes: "变更明细",
  before: "变更前值",
  after: "变更后值",
  field: "变更字段",
  action: "操作名称",
  actor: "操作人",
  time: "操作时间",
  note: "操作说明",
  result: "操作结果",
  version: "版本",
  id: "业务编号",
  name: "名称",
  type: "类型",
  status: "状态",
  amount: "金额",
  merchant: "商户",
  order: "服务订单",
  createdAt: "创建时间",
  updatedAt: "更新时间",
  uploadedAt: "上传时间",
  uploader: "上传人",
  size: "文件大小",
  public: "公开范围",
  service: "服务项目",
  point: "服务地点",
};
export default {
  name: "ServiceValues",
  props: {
    value: null,
    path: { type: String, default: "record" },
    label: String,
    options: { type: Object, default: () => ({}) },
  },
  data: () => ({ labels }),
  methods: {
    show(value, key = this.label) {
      return plain(this.resolve(value, key));
    },
    resolve(value, key) {
      const opts = /类目/.test(key || "")
        ? this.options.categories
        : /社区/.test(key || "")
          ? this.options.communities
          : /小区/.test(key || "")
            ? this.options.estates
            : /人员|执行人/.test(key || "")
              ? this.options.personnel
              : null;
      if (opts && typeof value === "string" && !/编号/.test(key || "")) {
        const found = opts.find((o) => (o.value || o._id || o.id) === value);
        if (found) return found.label || found.name || value;
      }
      return value;
    },
    fieldForKey(key) {
      const f = [
        ...(tableById.C2?.fields || []),
        ...(tableById.C3?.fields || []),
      ].find((x) => x.name === key);
      return f ? f.id : this.path + ":" + key;
    },
    entries(v) {
      return Object.entries(v).filter(
        ([k]) =>
          !k.startsWith("_") &&
          ![
            "blob",
            "path",
            "schemaVersion",
            "operations",
            "scenarios",
          ].includes(k),
      );
    },
  },
};
</script>
<style scoped>
.quiet {
  color: #657180;
}
.value-entry {
  padding: 10px 12px;
  border-left: 3px solid #d7e3ef;
  background: #f8fafc;
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.value-entry > strong {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
}
.object-values > div {
  display: grid;
  grid-template-columns: minmax(100px, 160px) minmax(0, 1fr);
  gap: 16px;
  padding: 7px 0;
  border-bottom: 1px solid #edf0f4;
}
.object-values dt {
  color: #657180;
  overflow-wrap: anywhere;
}
.object-values dd {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.object-values .object-values > div {
  grid-template-columns: minmax(88px, 130px) minmax(0, 1fr);
}
</style>
