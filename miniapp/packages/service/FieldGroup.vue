<script setup lang="ts">
import {serviceText} from './presentation';
import { computed } from "vue";
import { APP } from "@/services/foundation";
import { fieldsFor } from "@core/service/fields.js";
import { requiredServiceField } from "@core/service/required.js";
import FormField from "../ui/components/FormField.vue";
import Evidence from "./Evidence.vue";
const props = withDefaults(
  defineProps<{
    tables?: string[];
    value?: any;
    editable?: boolean;
    options?: any;
    errors?: any;
    only?: string[];
    exclude?: string[];
    recordId?: string;
    recordTable?: string;
    heading?: boolean;
    compact?: boolean;
    action?: string;
    record?: any;
  }>(),
  {
    tables: () => [],
    value: () => ({}),
    editable: false,
    options: () => ({}),
    errors: () => ({}),
    only: () => [],
    exclude: () => [],
    recordId: "",
    recordTable: "",
    heading: true,
    compact: false,
    action: "",
    record: () => ({}),
  },
);
const emit = defineEmits<{ input: [any] }>();
const dictionaries: any = {
  接收新预约状态: ["接收新预约", "暂停接单"],
  上门地址来源: ["常用地址", "本次填写"],
  过程记录类型: ["进度说明", "沟通记录", "异常记录"],
  人员状态: ["启用", "停用"],
  资格状态: ["有效", "暂停"],
  服务商材料要求: ["需要", "不需要"],
  人员材料要求: ["需要", "不需要"],
  服务对象填写要求: ["不需要", "选填", "必填"],
  服务对象要求: ["选填", "必填"],
  服务人员证明要求: ["选填", "必填"],
  完成证据要求: ["可选图片", "必需图片"],
  居民安排答复: ["接受", "希望调整"],
  居民结果答复: ["确认完成", "有异议"],
  居民方案答复: ["同意", "不同意"],
  服务结果: ["全部完成", "部分完成", "未完成"],
  申请类型: ["申请退款", "核实取消", "服务问题"],
  期望解决方式: ["全额退款", "部分退款", "补充履约", "协商解决"],
  方案处理类型: ["全额退款", "部分退款", "补充履约", "不退款"],
  业务结案方式: [
    "未服务取消",
    "部分履行终止",
    "继续履约／补充履约",
    "完成后售后解决",
  ],
  期望时间选择: ["指定日期", "时间可协商"],
  组合履约方式名称: ["上门", "预约到点"],
  组合流程模板: ["上门", "预约到点"],
  履约方式: ["上门", "预约到点"],
  选定履约方式: ["上门", "预约到点"],
  是否推荐: ["是", "否"],
  审核结果: ["通过", "退回", "驳回"],
  启用状态: ["启用", "停用"],
  组合启用状态: ["启用", "停用"],
  接收预约开关: ["开启", "暂停"],
  公开展示状态: ["展示", "限制"],
  总体评分: [1, 2, 3, 4, 5],
};
const fields = computed(() =>
  (fieldsFor as any)(...props.tables).filter(
    (f: any) =>
      (!props.only.length || props.only.includes(f.name)) &&
      !props.exclude.includes(f.name) &&
      (!props.compact || props.editable || (!/历史|操作记录|变更记录|数据库|主键|外键|快照|版本$|^原始期望时间$|^当前安排$/.test(f.name) && props.value?.[f.name] !== undefined && props.value?.[f.name] !== '' && (!Array.isArray(props.value?.[f.name]) || props.value[f.name].length > 0))) &&
      visible(f),
  ),
);
function set(name: string, value: any) {
  const next: any = { ...props.value, [name]: value };
  if (name === "上门覆盖社区")
    next["上门覆盖小区"] = (next["上门覆盖小区"] || []).filter((id: string) =>
      props.options.approvedEstates?.some(
        (e: any) => e.value === id && value.includes(e.community),
      ),
    );
  if (
    name === "所属社区" &&
    next["所属小区"] &&
    !props.options.estates?.some(
      (e: any) => e.value === next["所属小区"] && e.community === value,
    )
  )
    next["所属小区"] = "";
  if (
    name === "方案处理类型" &&
    !props.options.handlingOptions?.plan?.[value]?.includes(
      next["业务结案方式"],
    )
  )
    next["业务结案方式"] = "";
  if (name === "长期有效" && value) next["有效截止日期"] = "";
  emit("input", next);
}
function visible(f: any) {
  const visibility = (f.condition.split("可见：")[1] || "").split("；")[0];
  if (
    APP === "resident" &&
    /商户|Web|后台|管理人员/.test(visibility) &&
    !/住户|居民|各端|公开|双方/.test(visibility)
  )
    return false;
  if (APP === "merchant" && /仅Web|仅获授权Web|仅管理/.test(visibility))
    return false;
  if (
    APP === "resident" &&
    /佣金|应结|实结|分账|回退|内部|资质|审核意见|操作人业务身份/.test(f.name)
  )
    return false;
  const selectedWay =
    props.value?.["选定履约方式"] ||
    props.value?.["组合履约方式名称"] ||
    props.value?.["履约方式"];
  const mode =
    props.value?.["组合流程模板"] ||
    props.options.selectedCombo?.["组合流程模板"] ||
    props.options.methods?.find(
      (m: any) => m._id === selectedWay || m.label === selectedWay,
    )?.["绑定流程模板"] ||
    selectedWay;
  if (
    ["服务对象描述", "服务对象填写提示"].includes(f.name) &&
    props.options.selectedSpec?.["服务对象填写要求"] === "不需要"
  )
    return false;
  if (mode === "上门" && f.name === "可服务门店或服务点") return false;
  if (mode === "预约到点" && /^上门覆盖/.test(f.name)) return false;
  if (
    ["未完成内容", "未完成原因"].includes(f.name) &&
    ["全部完成", "按约完成"].includes(props.value?.["服务结果"])
  )
    return false;
  if (
    ["问题说明", "问题图片"].includes(f.name) &&
    props.value?.["居民结果答复"] === "确认完成"
  )
    return false;
  if (f.name === "居民答复说明" && props.value?.["居民安排答复"] === "接受")
    return false;
  if (f.name === "居民方案答复说明" && props.value?.["居民方案答复"] === "同意")
    return false;
  if (mode === "上门" && /到点服务地点|到点地点/.test(f.name)) return false;
  if (mode === "预约到点" && /上门服务地址|上门地址来源/.test(f.name))
    return false;
  if (
    props.value?.["期望时间选择"] === "时间可协商" &&
    f.name === "期望服务日期"
  )
    return false;
  return true;
}
function edit(f: any) {
  return (
    props.editable &&
    !/编辑：否(?:；|$)/.test(f.condition) &&
    (!/只读/.test(f.type) || /输入|选择|编辑/.test(f.type)) &&
    !/自动生成，无需填写/.test(f.condition)
  );
}
function required(f: any) {
  if (!props.editable) return false;
  const requiredForAction = requiredServiceField(props.action, f, props.value, props.options, props.record);
  if (requiredForAction !== undefined) return requiredForAction;
  return (
    /^必填：(?:是|必填)/.test(f.condition) ||
    f.name === "业务结案方式" ||
    (f.name === "服务对象描述" &&
      props.options.selectedSpec?.["服务对象填写要求"] === "必填")
  );
}
function val(f: any) {
  return props.value?.[f.name];
}
function str(v: any): string {
  if (v && typeof v === "object")
    return Array.isArray(v)
      ? v.map(str).join("、")
      : Object.entries(v)
          .filter(([k]) => !k.startsWith("_") && (!props.compact || !/历史|操作记录|变更记录/.test(k)))
          .map(([k, val]) => k + "：" + str(val))
          .join("；");
  return v === undefined || v === null || v === ""
    ? "未记录"
    : typeof v === "boolean"
      ? v
        ? "是"
        : "否"
      : serviceText(v);
}
function input(f: any, e: any) {
  set(f.name, e.detail?.value ?? e.target?.value ?? "");
}
function choices(f: any): any[] {
  const n = f.name,
    o = props.options;
  let rows: any[] = [];
  if (n === "业务结案方式")
    return (o.handlingOptions?.plan?.[props.value["方案处理类型"]] || []).map(
      (v: string) => ({ value: v, label: v }),
    );
  if (n === "方案处理类型" && o.handlingOptions?.plan)
    return Object.entries(o.handlingOptions.plan)
      .filter(([, v]: any) => v.length)
      .map(([v]) => ({ value: v, label: v }));
  if (/履约方式/.test(n) && n !== "组合流程模板")
    return (o.methods || [])
      .filter(
        (m: any) =>
          !props.editable || m["方式状态"] === "启用" || !m["方式状态"],
      )
      .map((m: any) => ({
        value: m._id || m.value,
        label: m.label || m["履约方式名称"],
      }));
  if (n === "上门覆盖社区" && props.editable)
    return o.approvedCommunities || [];
  if (n === "上门覆盖小区" && props.editable)
    return (o.approvedEstates || []).filter((e: any) =>
      (props.value["上门覆盖社区"] || []).includes(e.community),
    );
  if (o.dictionaries?.[n])
    return o.dictionaries[n].map((v: any) => ({ value: v, label: String(v) }));
  if (dictionaries[n])
    return dictionaries[n].map((v: any) => ({ value: v, label: String(v) }));
  if (/服务类目|申请经营类目|可执行类目/.test(n)) rows = o.categories || [];
  else if (/服务人员|拟安排人员/.test(n)) rows = o.personnel || [];
  else if (/选定服务项目|服务项目筛选|评价项目筛选/.test(n))
    rows = o.services || [];
  else if (/商户|经营主体|经营店铺/.test(n)) rows = o.merchants || [];
  else if (/履约方式|流程模板/.test(n))
    return ["上门", "预约到点"].map((v) => ({ value: v, label: v }));
  else if (/社区/.test(n)) return o.communities || [];
  else if (/小区/.test(n))
    return (o.estates || []).filter(
      (e: any) =>
        !props.editable ||
        !props.value["所属社区"] ||
        e.community === props.value["所属社区"],
    );
  return rows.map((r) => ({
    value: r._id || r.id || r.value,
    label:
      r.类目名称 ||
      r.姓名 ||
      r.人员姓名 ||
      r.服务名称 ||
      r.商户名称 ||
      r.经营店铺名称 ||
      r.name ||
      r.label ||
      r._id,
  }));
}
function label(f: any) {
  const v = val(f),
    opts = choices(f);
  return opts.find((x) => x.value === v)?.label || str(v);
}
function choose(f: any, e: any) {
  set(f.name, choices(f)[Number(e.detail.value)]?.value || "");
}
function list(f: any) {
  return Array.isArray(val(f)) ? val(f) : [];
}
function childTable(f: any) {
  if (/资质材料|证明材料/.test(f.name)) return "26-D";
  if (/规格集合/.test(f.name)) return "27-D";
  if (/组合集合|规格方式组合/.test(f.name)) return "27-D";
  if (/门店或服务点|地点集合/.test(f.name)) return "27-E";
  if (/上门服务地址|地址快照/.test(f.name)) return "29-C";
  return "";
}
function fileRefs(f: any) {
  const v = val(f);
  return Array.isArray(v) ? v : v ? [v] : [];
}
function isEvidence(f: any) {
  return (
    !/说明|要求|状态|时间|名称|数量/.test(f.name) &&
    (/图片|单图|文件|附件|上传/.test(f.type) ||
      /主图|图标|图片|照片|附件|证明文件/.test(f.name))
  );
}
function isMany(f: any) {
  return /多选|集合/.test(f.type) && !isEvidence(f);
}
function isBoolean(f: any) {
  return (
    /开关|勾选|布尔/.test(f.type) || /原安排仍可履行|约定确认/.test(f.name)
  );
}
function togglePoint(f: any, point: any) {
  const items = list(f),
    code = point["地点业务编号"];
  set(
    f.name,
    items.some((p: any) => p["地点业务编号"] === code)
      ? items.filter((p: any) => p["地点业务编号"] !== code)
      : [...items, point],
  );
}
function nested(f: any, i: number, v: any) {
  const all = [...list(f)];
  all[i] = v;
  set(f.name, all);
}
function add(f: any) {
  set(f.name, [...list(f), {}]);
}
function toggle(f: any, v: any) {
  const values = [...list(f)];
  set(
    f.name,
    values.includes(v) ? values.filter((x) => x !== v) : [...values, v],
  );
}
function datePart(f: any, e: any, time = false) {
  const old = val(f) || "";
  set(
    f.name,
    time
      ? (old.slice(0, 10) || props.options.scenarioDate || "2026-11-08") +
          "T" +
          e.detail.value
      : e.detail.value +
          (/日期时间/.test(f.type) ? "T" + (old.slice(11, 16) || "09:00") : ""),
  );
}
function eventValue(event: any) { return event.detail.value }
</script>
<template>
  <view class="service-fields svc-view">
    <view
      v-for="f in fields"
      :key="f.id"
      class="field-wrap svc-view"
      :data-field="f.id"
      :data-field-name="f.name"
    >
      <template v-if="isEvidence(f)"
        ><text class="section-label svc-text"
          >{{ f.name
          }}<text v-if="edit(f) && required(f)" class="required svc-text"> *</text></text
        ><Evidence
          :value="fileRefs(f)"
          :editable="edit(f)"
          :images-only="/图片|单图|主图|图标/.test(f.type + f.name)"
          :max-files="/单图|主图|图标/.test(f.type + f.name) ? 1 : 9"
          :table="recordTable"
          :record-id="recordId"
          @input="set(f.name, $event)"
        /><text v-if="errors[f.name]" class="error svc-text">{{
          errors[f.name]
        }}</text></template
      >
      <template v-else-if="f.name === '可服务门店或服务点' && edit(f)">
        <text class="section-label svc-text">{{ f.name }}<text v-if="required(f)" class="required svc-text"> *</text></text>
        <view class="multi svc-view"
          ><view
            v-for="p in options.points || []"
            :key="p['地点业务编号']"
            class="choice svc-view"
            :data-point="p['地点业务编号']"
            :class="{
              selected: list(f).some(
                (v: any) => v['地点业务编号'] === p['地点业务编号'],
              ),
            }"
            @click="togglePoint(f, p)"
            >{{
              list(f).some((v: any) => v["地点业务编号"] === p["地点业务编号"])
                ? "✓ "
                : ""
            }}{{ p["地点名称"] }}</view
          ></view
        >
        <text v-if="!(options.points || []).length" class="muted svc-text"
          >本商户暂无可选的有效服务点。</text
        >
        <view
          v-for="p in list(f)"
          :key="p['地点业务编号']"
          class="nested svc-view"
          ><FieldGroup
            :tables="['27-E']"
            :value="p"
            :options="options"
            :editable="false"
          /><button class="text-button svc-button" @click="togglePoint(f, p)">
            移除此地点
          </button></view
        >
        <text v-if="errors[f.name]" class="error svc-text">{{
          errors[f.name]
        }}</text>
      </template>
      <template
        v-else-if="
          childTable(f) &&
          (Array.isArray(val(f)) ||
            /集合|材料|门店或服务点/.test(f.type + f.name))
        "
        ><text class="section-label svc-text">{{ f.name }}<text v-if="edit(f) && required(f)" class="required svc-text"> *</text></text
        ><view v-for="(item, i) in list(f)" :key="i" class="nested svc-view"
          ><FieldGroup
            :tables="[childTable(f)]"
            :value="item"
            :compact="compact"
            :action="action"
            :record="record"
            :editable="edit(f)"
            :options="props.options"
            :errors="errors"
            :exclude="
              /组合集合|规格方式组合/.test(f.name)
                ? ['服务规格集合', '组合集合', '规格方式组合']
                : ['服务规格集合']
            "
            @input="nested(f, i, $event)"
          /><button
            v-if="edit(f)"
            class="text-button danger svc-button"
            @click="
              set(
                f.name,
                list(f).filter((_: any, j: number) => j !== i),
              )
            "
          >
            移除本项
          </button></view
        ><button v-if="edit(f)" class="text-button svc-button" @click="add(f)">
          添加{{ f.name }}</button
        ><text v-if="!list(f).length && !edit(f)" class="muted svc-text"
          >暂无记录</text
        ></template
      >
      <template
        v-else-if="childTable(f) && val(f) && typeof val(f) === 'object'"
        ><text class="section-label svc-text">{{ f.name }}<text v-if="edit(f) && required(f)" class="required svc-text"> *</text></text
        ><view class="nested svc-view"
          ><FieldGroup
            :tables="[childTable(f)]"
            :value="val(f)"
            :compact="compact"
            :action="action"
            :record="record"
            :editable="edit(f)"
            :options="props.options"
            :errors="errors"
            @input="set(f.name, $event)" /></view
      ></template>
      <FormField
        v-else
        :label="f.name"
        :required="edit(f) && required(f)"
        :readonly="!edit(f)"
        :error="errors[f.name]"
      >
        <view v-if="!edit(f)" class="readonly svc-view"
          ><template v-if="Array.isArray(val(f))"
            ><view
              v-for="(item, i) in val(f)"
              :key="i"
              class="value-item svc-view"
              ><template v-if="item && typeof item === 'object'"
                ><view
                  v-for="(v, k) in item"
                  :key="String(k)"
                  class="kv svc-view"
                  ><text class="svc-text">{{ k }}</text
                  ><text class="svc-text">{{ str(v) }}</text></view
                ></template
              ><text class="svc-text" v-else>{{
                choices(f).find((x) => x.value === item)?.label || str(item)
              }}</text></view
            ><text class="svc-text" v-if="!val(f).length"
              >暂无记录</text
            ></template
          ><template v-else-if="val(f) && typeof val(f) === 'object'"
            ><view v-for="(v, k) in val(f)" :key="String(k)" class="kv svc-view"
              ><text class="svc-text">{{ k }}</text
              ><text class="svc-text">{{ str(v) }}</text></view
            ></template
          ><text class="svc-text" v-else>{{ label(f) }}</text></view
        >
        <view v-else-if="isBoolean(f)" class="switch svc-view"
          ><switch
            :checked="!!val(f)"
            color="#1b4d53"
            @change="set(f.name, eventValue($event))"
          /><text class="svc-text">{{
            val(f) ? "已确认" : "未确认"
          }}</text></view
        >
        <view v-else-if="isMany(f) && choices(f).length" class="multi svc-view"
          ><view
            v-for="o in choices(f)"
            :key="o.value"
            class="choice svc-view"
            :class="{ selected: list(f).includes(o.value) }"
            @click="toggle(f, o.value)"
            >{{ list(f).includes(o.value) ? "✓ " : "" }}{{ o.label }}</view
          ></view
        >
        <picker
          class="svc-picker"
          v-else-if="choices(f).length"
          :range="choices(f)"
          range-key="label"
          @change="choose(f, $event)"
          ><view class="pick svc-view"
            >{{ val(f) ? label(f) : "请选择"
            }}<text class="svc-text">›</text></view
          ></picker
        >
        <view v-else-if="/日期/.test(f.type)" class="date-row svc-view"
          ><picker
            class="svc-picker"
            mode="date"
            :value="(val(f) || '').slice(0, 10)"
            @change="datePart(f, $event)"
            ><view class="pick svc-view">{{
              (val(f) || "").slice(0, 10) || "选择日期"
            }}</view></picker
          ><picker
            class="svc-picker"
            v-if="/日期时间/.test(f.type)"
            mode="time"
            :value="(val(f) || '').slice(11, 16)"
            @change="datePart(f, $event, true)"
            ><view class="pick svc-view">{{
              (val(f) || "").slice(11, 16) || "选择时间"
            }}</view></picker
          ></view
        >
        <picker
          class="svc-picker"
          v-else-if="/时间/.test(f.type) && !/时段|范围/.test(f.name)"
          mode="time"
          :value="val(f) || ''"
          @change="input(f, $event)"
          ><view class="pick svc-view">{{ val(f) || "选择时间" }}</view></picker
        >
        <textarea
          v-else-if="
            /多行|长文本/.test(f.type) ||
            /说明|原因|内容|描述|地址|须知|约定/.test(f.name)
          "
          :value="val(f) || ''"
          :maxlength="-1"
          auto-height
          :placeholder="
            f.name === '服务对象描述'
              ? props.options.selectedSpec?.['服务对象填写提示'] ||
                '填写服务对象描述'
              : '填写' + f.name
          "
          @input="input(f, $event)"
        />
        <input
          v-else
          :value="val(f) == null ? '' : String(val(f))"
          :type="/金额|价格|数量|排序|评分/.test(f.name) ? 'digit' : 'text'"
          :placeholder="
            f.name === '服务对象描述'
              ? props.options.selectedSpec?.['服务对象填写提示'] ||
                '填写服务对象描述'
              : '填写' + f.name
          "
          @input="input(f, $event)"
        />
        <text
          v-if="
            f.name === '服务对象描述' &&
            props.options.selectedSpec?.['服务对象填写提示']
          "
          class="muted svc-text"
          data-field="27-D.08"
          data-field-name="服务对象填写提示"
          >{{ props.options.selectedSpec["服务对象填写提示"] }}</text
        >
      </FormField>
    </view>
  </view>
</template>
<style scoped lang="scss">
.service-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.required,
.error,
.danger {
  color: $color-error;
}
.readonly {
  padding: 12px 0;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.pick {
  display: flex;
  justify-content: space-between;
  min-height: 48px;
  align-items: center;
  gap: 8px;
}
.date-row {
  display: flex;
  gap: 16px;
}
.date-row > .svc-picker {
  flex: 1;
}
.switch {
  display: flex;
  align-items: center;
  min-height: 48px;
  gap: 12px;
}
.multi {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
}
.choice {
  padding: 10px;
  border: 1px solid $color-border;
  border-radius: 8px;
}
.choice.selected {
  background: $color-primary-light;
  color: $color-primary;
  border-color: $color-primary;
}
.nested {
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: 12px;
  background: #fff;
  margin-bottom: 12px;
}
.text-button {
  font-size: 14px;
  color: $color-primary;
  background: $color-primary-light;
  margin-top: 8px;
}
.text-button::after {
  border: 0;
}
.muted {
  color: $color-text-secondary;
}
.kv {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 4px 0;
}
.kv > .svc-text:last-child {
  text-align: right;
  overflow-wrap: anywhere;
}
.value-item {
  padding: 6px 0;
  border-bottom: 1px solid $color-border;
}
.error {
  display: block;
  margin-top: 6px;
  font-size: 13px;
}
</style>
