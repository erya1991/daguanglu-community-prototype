<template>
  <div class="service-fields">
    <section v-for="group in groups" :key="group.id" class="form-section">
      <h3 v-if="groups.length > 1">{{ cleanTitle(group.title) }}</h3>
      <div class="fields-grid">
        <div
          v-for="f in group.fields"
          :key="f.id"
          class="service-field"
          :class="{ 'field-wide': wide(f) }"
          :data-field="f.id"
        >
          <label :for="controlId(f)"
            >{{ f.name
            }}<span v-if="required(f)" class="required"> *</span></label
          >
          <ServiceEvidence
            v-if="isFile(f)"
            :value="array(value[f.name])"
            editable
            :label="f.name"
            :field="f.name"
            :field-id="f.id"
            :images-only="/图片/.test(f.type)"
            :multiple="/集合/.test(f.type)"
            @input="set(f.name, $event)"
          />
          <div v-else-if="childTable(f)" class="collection-editor">
            <article v-for="(item, index) in array(value[f.name])" :key="index">
              <div class="collection-title">
                <strong>{{ f.name }} {{ index + 1 }}</strong
                ><Button size="small" type="text" @click="removeItem(f, index)"
                  >移除</Button
                >
              </div>
              <ServiceFields
                :value="item"
                :table-ids="[childTable(f)]"
                :options="options"
                :original="original"
                :action="action"
                :mode="mode"
                :depth="depth + 1"
                @input="updateItem(f, index, $event)"
              />
            </article>
            <Button @click="addItem(f)"
              >添加{{ f.name.replace(/集合|条目/g, "") }}</Button
            >
          </div>
          <Select
            v-else-if="isMulti(f)"
            :id="controlId(f)"
            :value="array(value[f.name])"
            multiple
            filterable
            clearable
            :aria-label="f.name"
            @on-change="set(f.name, $event)"
            ><Option
              v-for="o in choices(f)"
              :key="String(o.value)"
              :value="o.value"
              >{{ o.label }}</Option
            ></Select
          >
          <Select
            v-else-if="isChoice(f)"
            :id="controlId(f)"
            :value="value[f.name] === undefined ? '' : value[f.name]"
            filterable
            clearable
            :aria-label="f.name"
            @on-change="set(f.name, $event)"
            ><Option
              v-for="o in choices(f)"
              :key="String(o.value)"
              :value="o.value"
              >{{ o.label }}</Option
            ></Select
          >
          <div v-else-if="/布尔/.test(f.type)" class="boolean-options">
            <label
              ><input
                type="radio"
                :name="controlId(f)"
                :checked="value[f.name] === true"
                @change="set(f.name, true)"
              />是</label
            ><label
              ><input
                type="radio"
                :name="controlId(f)"
                :checked="value[f.name] === false"
                @change="set(f.name, false)"
              />否</label
            >
          </div>
          <input
            v-else-if="/日期时间/.test(f.type)"
            :id="controlId(f)"
            type="datetime-local"
            :value="localDateTime(value[f.name])"
            @input="set(f.name, $event.target.value)"
          />
          <input
            v-else-if="/日期/.test(f.type)"
            :id="controlId(f)"
            type="date"
            :value="value[f.name] || ''"
            @input="set(f.name, $event.target.value)"
          />
          <input
            v-else-if="/时间/.test(f.type)"
            :id="controlId(f)"
            type="time"
            :value="value[f.name] || ''"
            @input="set(f.name, $event.target.value)"
          />
          <input
            v-else-if="/金额|数值|数字|正整数|序号/.test(f.type)"
            :id="controlId(f)"
            type="number"
            :step="/金额/.test(f.type) ? '0.01' : '1'"
            :min="/金额/.test(f.type) ? '0' : undefined"
            :value="value[f.name] === undefined ? '' : value[f.name]"
            @input="set(f.name, $event.target.value)"
          />
          <textarea
            v-else-if="/多行/.test(f.type)"
            :id="controlId(f)"
            :value="value[f.name] || ''"
            rows="3"
            @input="set(f.name, $event.target.value)"
          />
          <input
            v-else
            :id="controlId(f)"
            :type="/电话/.test(f.type) ? 'tel' : 'text'"
            :value="value[f.name] === undefined ? '' : value[f.name]"
            @input="set(f.name, $event.target.value)"
          />
          <p
            v-if="f.name === '裁定退款金额' && value['裁定结果'] === '全额退款'"
            class="field-help"
          >
            全额退款以保存时重新核查的剩余可退金额为准。
          </p>
          <p v-if="errors[f.name]" class="field-error" role="alert">
            {{ errors[f.name] }}
          </p>
        </div>
      </div>
    </section>
    <p v-if="!groups.some((g) => g.fields.length)" class="quiet">
      确认后执行此动作。系统将重新核验当前权限、版本及业务条件。
    </p>
  </div>
</template>
<script>
import { tableById } from "../../../../../prototype-shared/service/fields.js";
import { requiredServiceField } from "../../../../../prototype-shared/service/required.js";
import ServiceEvidence from "./ServiceEvidence.vue";
const selectionValues = {
  审核结果: ["通过", "退回修改"],
  核验结论: ["认可", "不认可"],
  裁定结果: ["全额退款", "部分退款", "继续或补充履约", "不予退款"],
  裁定后业务处理: [
    "保留原状态",
    "未服务取消",
    "部分履行终止",
    "继续／补充履约",
    "完成后售后解决",
  ],
  流程模板: ["上门", "预约到点"],
  绑定流程模板: ["上门", "预约到点"],
  启用状态: ["启用", "停用"],
  类目状态: ["启用", "停用"],
  方式状态: ["启用", "停用"],
  评价展示状态: ["显示", "受限"],
  状态: ["启用", "停用"],
  总体评分: [1, 2, 3, 4, 5],
};
const statusField = {
  id: "action:状态",
  name: "状态",
  type: "枚举／单选",
  condition: "必填：提交时；可见：Web办理；编辑：提交前",
  rule: "",
};
export default {
  name: "ServiceFields",
  components: { ServiceEvidence },
  props: {
    value: { type: Object, default: () => ({}) },
    tableIds: { type: Array, default: () => [] },
    options: { type: Object, default: () => ({}) },
    errors: { type: Object, default: () => ({}) },
    original: { type: Object, default: () => ({}) },
    action: { type: String, default: "" },
    mode: { type: String, default: "action" },
    depth: { type: Number, default: 0 },
    excludedFields: { type: Array, default: () => [] },
    extraFields: { type: Array, default: () => [] },
  },
  computed: {
    groups() {
      const groups = this.tableIds.map((id) => ({
        ...tableById[id],
        id,
        fields: (tableById[id]?.fields || []).filter(this.applicable),
      }));
      if (this.extraFields.length)
        groups.push({
          id: "action",
          title: "办理信息",
          fields: this.extraFields.filter(this.applicable),
        });
      return groups;
    },
  },
  methods: {
    cleanTitle(t) {
      return (t || "办理信息").replace(/^表[^｜]+｜/, "");
    },
    array(v) {
      return Array.isArray(v)
        ? v
        : v === undefined || v === null || v === ""
          ? []
          : [v];
    },
    controlId(f) {
      return "service-" + this.depth + "-" + f.id;
    },
    set(k, v) {
      const next = { ...this.value, [k]: v };
      if (
        k === "裁定结果" &&
        !this.original.handlingOptions?.ruling?.[v]?.includes(
          next["裁定后业务处理"],
        )
      )
        next["裁定后业务处理"] = "";
      this.$emit("input", next);
    },
    wide(f) {
      return /多行|集合|文件|图片/.test(f.type);
    },
    isFile(f) {
      return (
        /图片集合|文件集合|上传/.test(f.type) && !/材料编辑|结构化/.test(f.type)
      );
    },
    isMulti(f) {
      return /多选/.test(f.type) || /关联集合/.test(f.type);
    },
    isChoice(f) {
      return (
        !/布尔/.test(f.type) &&
        (/单选|下拉|枚举|星级|关联选择/.test(f.type) ||
          ["上级类目", "流程模板", "绑定流程模板"].includes(f.name))
      );
    },
    required(f) {
      if (this.mode === "filter") return false;
      const requiredForAction = requiredServiceField(this.action, f, this.value, this.options, this.original);
      if (requiredForAction !== undefined) return requiredForAction;
      if (this.action === "aftersale.rulingNote") return f.name === "追加说明";
      if (this.action === "personnel.review" && f.name === "核验结论")
        return true;
      if (this.action === "personnel.review" && f.name === "核验意见")
        return this.value["核验结论"] === "不认可";
      if (f.name === "上级类目") return false;
      if (f.name === "商户资质要求说明")
        return this.value["商户证明是否必需"] === true;
      if (f.name === "人员资质要求说明")
        return this.value["人员证明是否必需"] === true;
      if (f.name === "配置变更原因") return !!this.original._id;
      const req = (f.condition || "").split("；")[0];
      if (/必填：否|自动|无需填写|有.*时|若/.test(req)) return false;
      if (f.name === "裁定退款金额")
        return this.value["裁定结果"] === "部分退款";
      if (f.name === "继续或补充履约内容")
        return /继续|补充/.test(this.value["裁定结果"] || "");
      if (f.name === "更正原因") return !!this.original["裁定版本"];
      if (f.name === "审核意见")
        return /退回/.test(this.value["审核结果"] || "");
      return /必填：/.test(req);
    },
    applicable(f) {
      if (!f || !f.name || this.excludedFields.includes(f.name)) return false;
      if (this.mode === "filter")
        return /编辑：筛选时|编辑：查询时/.test(f.condition || "");
      if (this.action === "aftersale.rulingNote")
        return ["追加说明", "裁定依据附件"].includes(f.name);
      if (this.action === "personnel.review")
        return ["核验结论", "核验意见"].includes(f.name);
      if (
        (/只读/.test(f.type) && !/输入|选择|上传|编辑/.test(f.type)) ||
        /状态标签|历史集合|展开/.test(f.type) ||
        /编辑：否|编辑：在原/.test(f.condition || "")
      )
        return false;
      const n = f.name,
        a = this.action;
      if (/筛选|关键词/.test(n)) return false;
      if (
        a === "qualification.review" &&
        !/^(审核结果|审核意见|批准服务类目|批准覆盖社区|批准覆盖小区)$/.test(n)
      )
        return false;
      if (
        a === "service.review" &&
        !/审核结果|审核意见|审核说明|审核结论/.test(n)
      )
        return false;
      if (a === "aftersale.ruling") {
        if (
          ![
            "裁定结果",
            "裁定退款金额",
            "继续或补充履约内容",
            "裁定后业务处理",
            "裁定说明",
            "裁定依据附件",
            "裁定作出人",
            "裁定作出时间",
            "更正原因",
          ].includes(n)
        )
          return false;
        if (n === "裁定退款金额" && !/退款/.test(this.value["裁定结果"] || ""))
          return false;
        if (
          n === "继续或补充履约内容" &&
          !/继续|补充/.test(this.value["裁定结果"] || "")
        )
          return false;
        if (
          n === "更正原因" &&
          !this.original["裁定版本"] &&
          !this.original.ruling
        )
          return false;
      }
      if (
        a === "category.save" &&
        /^(履约方式名称|履约方式说明|绑定流程模板|方式版本|方式状态)$/.test(n)
      )
        return false;
      if (
        a === "method.save" &&
        ![
          "履约方式名称",
          "履约方式说明",
          "绑定流程模板",
          "配置变更原因",
        ].includes(n)
      )
        return false;
      if (a.endsWith(".status") && !f.id.startsWith("action:")) {
        const status = this.value["状态"];
        const allowed =
          a === "qualification.status"
            ? ["暂停或恢复原因"]
            : a === "evaluation.status"
              ? ["评价限制原因", "评价监管证据"]
              : ["category.status", "method.status"].includes(a)
                ? ["配置变更原因"]
                : status === "已下架"
                  ? ["上架或下架原因"]
                  : status === "推荐"
                    ? ["推荐顺序"]
                    : [];
        if (!allowed.includes(n)) return false;
      }
      if (a === "fund.note" && !/核查说明|核查依据/.test(n)) return false;
      if (
        [
          "fund.query",
          "fund.retry",
          "aftersale.execute",
          "service.publish",
        ].includes(a)
      )
        return false;
      if (n === "商户资质要求说明" && this.value["商户证明是否必需"] !== true)
        return false;
      if (n === "人员资质要求说明" && this.value["人员证明是否必需"] !== true)
        return false;
      if (n === "配置变更原因" && !this.original._id) return false;
      if (a.endsWith(".save") && ["类目状态", "方式状态"].includes(n))
        return false;
      if (n === "有效截止日期" && this.value["长期有效"] === true) return false;
      if (n === "裁定退款金额" && this.value["裁定结果"] === "全额退款")
        return false;
      return true;
    },
    choices(f) {
      let opts = this.options.dictionaries?.[f.name];
      const name = f.name;
      if (name === "裁定后业务处理")
        opts =
          this.original.handlingOptions?.ruling?.[this.value["裁定结果"]] || [];
      if (name === "裁定结果" && this.original.handlingOptions?.ruling)
        opts = Object.entries(this.original.handlingOptions.ruling)
          .filter(([, v]) => v.length)
          .map(([type]) => type);
      if (/支付状态/.test(name))
        opts = ["待发起", "处理中", "成功", "失败", "结果未知", "已关闭"];
      else if (/退款状态/.test(name))
        opts = [
          "待处理",
          "待发起",
          "处理中",
          "成功",
          "失败",
          "结果未知",
          "受阻",
        ];
      else if (/分账状态|回退状态/.test(name))
        opts = [
          "待条件",
          "待处理",
          "处理中",
          "成功",
          "失败",
          "结果未知",
          "受阻",
        ];
      if (name === "状态") {
        opts =
          this.action === "qualification.status"
            ? ["暂停", "恢复"]
            : this.action === "service.status"
              ? ["已下架", "平台限制", "解除限制", "推荐", "取消推荐"]
              : this.action === "evaluation.status"
                ? ["显示", "受限"]
                : ["启用", "停用"];
      }
      if (!opts && /类目/.test(name)) opts = this.options.categories;
      if (!opts && /社区/.test(name))
        opts = this.options.communities || this.original["申请覆盖社区"];
      if (!opts && /小区/.test(name))
        opts = this.options.estates || this.original["申请覆盖小区"];
      if (!opts && /人员|执行人/.test(name)) opts = this.options.personnel;
      if (!opts && /商户|店铺|服务商/.test(name)) opts = this.options.merchants;
      if (!opts && /服务项目/.test(name)) opts = this.options.services;
      if (!opts && /履约方式/.test(name)) opts = this.options.methods;
      if (!opts && name === "申请状态")
        opts = ["草稿", "待审核", "已通过", "已退回", "已撤回"];
      if (!opts && /资格有效性/.test(name)) opts = ["未获准", "有效", "受限"];
      if (!opts && name === "人员资质有效性")
        opts = ["有效", "无专项要求", "已失效"];
      if (!opts && name === "售后类型筛选")
        opts = ["取消预约", "申请退款", "服务质量问题"];
      if (!opts && name === "售后状态筛选")
        opts = [
          "待处理",
          "协商中",
          "待居民确认方案",
          "待执行",
          "退款处理中",
          "已解决",
          "已拒绝",
          "已撤回",
        ];
      if (!opts) opts = selectionValues[name];
      if (!opts && /布尔/.test(f.type)) opts = [true, false];
      if (!opts) {
        const text = (f.rule || "")
          .split(/[；。]/)[0]
          .replace(/^包括|^可选|^仅支持/g, "");
        const tokens = text.split(/[、，]/);
        if (
          tokens.length > 1 &&
          tokens.length <= 10 &&
          tokens.every((t) => t.length < 18)
        )
          opts = tokens;
      }
      if (!opts) opts = [];
      const values =
        name === "裁定后业务处理" ? [] : this.array(this.value[name]);
      return [
        ...this.array(opts).map((v) =>
          typeof v === "object"
            ? {
                value:
                  v.value === undefined
                    ? v._id || v.id || v["类目编号"] || v["履约方式编号"]
                    : v.value,
                label:
                  v.label ||
                  v.name ||
                  v["类目名称"] ||
                  v["履约方式名称"] ||
                  v["人员姓名"] ||
                  v["商户名称"] ||
                  v["服务项目名称"] ||
                  v._id,
              }
            : {
                value: v,
                label: typeof v === "boolean" ? (v ? "是" : "否") : String(v),
              },
        ),
        ...values
          .filter(
            (v) =>
              !this.array(opts).some(
                (o) =>
                  (typeof o === "object" ? o.value || o._id || o.id : o) === v,
              ),
          )
          .map((v) => ({ value: v, label: String(v) })),
      ].filter((o) => o.value !== undefined);
    },
    childTable(f) {
      if (this.depth > 1 || this.isFile(f)) return null;
      const m = (f.rule || "").match(
        /(?:展开|字段|引用)[^；。]*?(26-D|27-D|27-E|29-C|C3)/,
      );
      return /结构化集合|材料编辑|结构化表单/.test(f.type) && m ? m[1] : null;
    },
    addItem(f) {
      this.set(f.name, [...this.array(this.value[f.name]), {}]);
    },
    removeItem(f, index) {
      this.set(
        f.name,
        this.array(this.value[f.name]).filter((_, i) => i !== index),
      );
    },
    updateItem(f, index, item) {
      this.set(
        f.name,
        this.array(this.value[f.name]).map((v, i) => (i === index ? item : v)),
      );
    },
    localDateTime(value) {
      return String(value || "").slice(0, 16);
    },
  },
};
export { statusField };
</script>
<style scoped>
.form-section + .form-section {
  margin-top: 24px;
}
.form-section h3 {
  font-size: 15px;
  margin-bottom: 16px;
  border-bottom: 1px solid #e8ecf1;
  padding-bottom: 10px;
}
.fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 20px;
}
.service-field {
  min-width: 0;
}
.service-field > label {
  display: block;
  color: #485363;
  margin-bottom: 7px;
  font-weight: 500;
}
.required {
  color: #b4413c;
}
.field-wide {
  grid-column: 1/-1;
}
.service-field input,
.service-field textarea {
  font: inherit;
  line-height: 1.5;
  padding: 8px 10px;
  min-height: 34px;
  border: 1px solid #d6dde5;
  border-radius: 4px;
  width: 100%;
  color: #253246;
  background: white;
}
.service-field input:focus,
.service-field textarea:focus {
  outline: 2px solid #b8d4ee;
  outline-offset: 1px;
}
.field-error {
  margin: 5px 0;
  color: #b23932;
}
.field-help,
.quiet {
  font-size: 12px;
  color: #657180;
  margin-top: 6px;
}
.collection-editor > article {
  padding: 14px;
  background: #f6f8fb;
  margin: 8px 0;
  border: 1px solid #e0e6ed;
  border-radius: 4px;
}
.collection-title {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.boolean-options {
  display: flex;
  gap: 20px;
}
.boolean-options label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.boolean-options input {
  width: 16px;
  min-height: 16px;
}
@media (max-width: 800px) {
  .fields-grid {
    grid-template-columns: 1fr;
  }
}
</style>
