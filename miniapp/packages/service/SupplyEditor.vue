<script setup lang="ts">
import { computed } from "vue";
import { tableById } from "@core/service/fields.js";
const fieldId = (name: string) =>
  (tableById as any)["27-D"].fields.find((f: any) => f.name === name)?.id || "";
import FieldGroup from "./FieldGroup.vue";
import FormField from "../ui/components/FormField.vue";
const props = withDefaults(
  defineProps<{ value: any; options: any; errors?: any }>(),
  { errors: () => ({}) },
);
const emit = defineEmits<{ input: [any] }>();
const specs = computed(() => props.value["服务规格集合"] || []);
const availableMethods = computed(() => {
  const category = props.options.categories?.find(
    (c: any) => c._id === props.value["所属服务类目"],
  );
  return (props.options.methods || []).filter(
    (m: any) =>
      m["方式状态"] === "启用" &&
      (category?.["允许履约方式"] || []).some(
        (v: string) => v === m._id || v === m["履约方式名称"],
      ),
  );
});
function update(v: any) {
  emit("input", v);
}
function setSpec(i: number, key: string, value: any) {
  const all = JSON.parse(JSON.stringify(specs.value));
  all[i][key] = value;
  update({ ...props.value, 服务规格集合: all });
}
function setCombo(i: number, j: number, value: any) {
  const all = JSON.parse(JSON.stringify(specs.value));
  all[i]["组合集合"][j] = value;
  update({ ...props.value, 服务规格集合: all });
}
function newSpec() {
  update({
    ...props.value,
    服务规格集合: [
      ...specs.value,
      {
        规格编号: "SPEC-" + Date.now(),
        规格名称: "",
        规格说明: "",
        包含内容: "",
        不包含内容: "",
        服务对象填写要求: "选填",
        组合集合: [],
      },
    ],
  });
}
function addCombo(i: number, methodId: string) {
  const method = availableMethods.value.find((m: any) => m._id === methodId);
  if (!method) return;
  const items = specs.value[i]["组合集合"] || [];
  if (items.some((v: any) => v._method === methodId)) return;
  setSpec(i, "组合集合", [
    ...items,
    {
      _method: methodId,
      组合履约方式名称: method["履约方式名称"],
      组合流程模板: method["绑定流程模板"],
      组合固定价格: "",
      组合启用状态: "启用",
      完成证据要求: "可选图片",
      上门覆盖社区:
        method["绑定流程模板"] === "上门"
          ? (props.options.approvedCommunities || []).map((c: any) => c.value)
          : [],
      上门覆盖小区:
        method["绑定流程模板"] === "上门"
          ? (props.options.approvedEstates || []).map((e: any) => e.value)
          : [],
      可服务门店或服务点: [],
    },
  ]);
}
function methodLabel(c: any) {
  return (
    props.options.methods?.find((m: any) => m._id === c._method)?.label ||
    c["组合履约方式名称"]
  );
}
function removeSpec(i: number) {
  update({
    ...props.value,
    服务规格集合: specs.value.filter((_: any, j: number) => j !== i),
  });
}
function removeCombo(i: number, j: number) {
  setSpec(
    i,
    "组合集合",
    specs.value[i]["组合集合"].filter((_: any, k: number) => k !== j),
  );
}
const names = [
  "规格名称",
  "规格说明",
  "预计服务时长",
  "服务对象填写提示",
  "规格启用状态",
  "包含内容",
  "不包含内容",
  "服务对象填写要求",
];
function eventValue(event: any) { return event.detail.value }
</script>
<template>
  <view class="supply-editor svc-view"
    ><FieldGroup
      :tables="['27-C']"
      action="service.save"
      :value="value"
      :options="options"
      :errors="errors"
      editable
      :only="[
        '服务名称',
        '所属服务类目',
        '服务主图',
        '介绍图片',
        '服务简介',
        '服务详细说明',
        '适用对象说明',
        '预约须知',
        '公开服务电话',
      ]"
      @input="update"
    />
    <view class="section-heading svc-view"
      ><text class="svc-text">规格及固定报价 <text class="required-mark">*</text></text
      ><button class="add svc-button" @click="newSpec">添加规格</button></view
    >
    <view
      v-for="(s, i) in specs"
      :key="s['规格编号'] || i"
      class="spec-card svc-view"
      ><view class="section-heading svc-view"
        ><text class="svc-text">{{ s["规格名称"] || "新规格" }}</text
        ><text class="remove svc-text" @click="removeSpec(i)">移除</text></view
      >
      <FormField
        v-for="n in names"
        :key="n"
        :label="n"
        :data-field="fieldId(n)"
        :data-field-name="n"
        :required="
          ['规格名称', '规格说明', '包含内容', '规格启用状态', '服务对象填写要求'].includes(n) ||
          (n === '服务对象填写提示' && s['服务对象填写要求'] === '必填')
        "
        :error="errors[n]"
        ><picker
          class="svc-picker"
          v-if="n === '服务对象填写要求'"
          :range="['不需要', '选填', '必填']"
          @change="
            setSpec(
              i,
              n,
              ['不需要', '选填', '必填'][Number(eventValue($event))],
            )
          "
          ><view class="pick svc-view">{{ s[n] || "选填" }}</view></picker
        ><textarea
          v-else-if="/内容|说明/.test(n)"
          :value="s[n] || ''"
          :maxlength="-1"
          auto-height
          @input="setSpec(i, n, eventValue($event))" /><input
          v-else
          :value="s[n] || ''"
          @input="setSpec(i, n, eventValue($event))"
      /></FormField>
      <view class="mode-add svc-view">
        <button
          v-for="m in availableMethods"
          :key="m._id"
          class="svc-button"
          :data-method="m._id"
          @click="addCombo(i, m._id)"
        >
          添加{{
            m._id === "POINT" && m.label === "预约到点" ? "到点" : m.label
          }}报价
        </button>
        <text v-if="!availableMethods.length" class="muted svc-text"
          >当前类目没有可选的启用履约方式。</text
        >
      </view>
      <view
        v-for="(c, j) in s['组合集合'] || []"
        :key="c._method || c['组合履约方式名称']"
        class="combo-card svc-view"
        ><view class="section-heading svc-view"
          ><text class="svc-text">{{ methodLabel(c) }}</text
          ><text class="remove svc-text" @click="removeCombo(i, j)"
            >移除</text
          ></view
        ><FormField
          label="组合固定价格"
          :data-field="fieldId('组合固定价格')"
          data-field-name="组合固定价格"
          required
          :error="errors['组合固定价格']"
          ><input
            type="digit"
            :value="c['组合固定价格'] || ''"
            placeholder="填写固定总价，元"
            @input="
              setCombo(i, j, { ...c, 组合固定价格: eventValue($event) })
            " /></FormField
        ><FieldGroup
          :tables="['27-D']"
          action="service.save"
          :value="c"
          :options="options"
          :errors="errors"
          editable
          :only="[
            '组合启用状态',
            '完成证据要求',
            '上门覆盖社区',
            '上门覆盖小区',
            '可服务门店或服务点',
            '方式说明',
            '服务约定说明',
          ]"
          @input="setCombo(i, j, $event)"
        />
      </view> </view
    ><text v-if="!specs.length" class="muted svc-text"
      >至少添加一个规格及有效方式报价后提交审核。</text
    ></view
  >
</template>
<style scoped lang="scss">
.required-mark { color: $color-error; }
.supply-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}
.section-heading .add {
  font-size: 14px;
  margin: 0;
  color: $color-primary;
  background: $color-primary-light;
}
.spec-card {
  padding: 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.combo-card {
  background: $color-group-bg;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mode-add {
  display: flex;
  gap: 8px;
}
.mode-add .svc-button {
  flex: 1;
  font-size: 13px;
  background: $color-primary-light;
  color: $color-primary;
}
.remove {
  color: $color-error;
  min-height: 40px;
  display: flex;
  align-items: center;
}
.pick {
  padding: 12px 0;
}
.point-label {
  display: block;
  font-weight: 600;
  margin: 8px 0;
}
.muted {
  color: $color-text-secondary;
}
</style>
