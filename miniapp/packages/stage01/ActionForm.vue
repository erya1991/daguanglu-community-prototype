<script setup lang="ts">
import { computed } from "vue";
import {
  fieldById,
  activeFields,
  isRequiredField,
  choices,
  attachmentFields,
} from "@core/stage01/ui.js";
import FormField from "../ui/components/FormField.vue";
import Evidence from "./Evidence.vue";
const props = withDefaults(
  defineProps<{
    action: string;
    value: any;
    options: any;
    errors?: any;
    role?: string;
    kind?: string;
    record?: any;
    records?: any[];
    publicCandidates?: string[];
  }>(),
  {
    role: "resident",
    errors: () => ({}),
    records: () => [],
    publicCandidates: () => [],
    record: () => ({}),
  }
);
const emit = defineEmits<{ input: [any] }>();
const active = computed(() =>
  activeFields(props.action, props.value, props.role, props.kind)
);
function input(id: string, e: any) {
  set(id, e.detail?.value ?? e.target?.value);
}
function set(id: string, v: any) {
  const n = { ...props.value, [id]: v };
  if (id === "RP09") n.RP10 = "";
  if (id === "RP11" && v === "公共位置") n.RP12 = "";
  emit("input", n);
}
function opts(id: string) {
  const list = choices(id, props.options, props.records);
  return id === "RP10"
    ? list?.filter(
        (x: any) => !props.value.RP09 || x.community === props.value.RP09
      )
    : list;
}
function choose(id: string, e: any) {
  set(id, opts(id)?.[Number(e.detail.value)]?.value || "");
}
function label(id: string) {
  return (
    opts(id)?.find((o: any) => o.value === props.value[id])?.label || "请选择"
  );
}
function isDate(id: string) {
  return fieldById[id].type.startsWith("日期");
}
function part(id: string, e: any, time = false) {
  set(
    id,
    time
      ? (props.value[id]?.slice(0, 10) ||
          new Date().toISOString().slice(0, 10)) +
          "T" +
          e.detail.value
      : e.detail.value +
          (fieldById[id].type.includes("日期时间")
            ? "T" + (props.value[id]?.slice(11, 16) || "09:00")
            : "")
  );
}
function toggle(photo: string) {
  const old = props.value.EV13 || [];
  set(
    "EV13",
    old.includes(photo)
      ? old.filter((x: string) => x !== photo)
      : [...old, photo]
  );
}
</script>
<template>
  <view class="s1-form"
    ><FormField
      v-for="id in active"
      :key="id"
      :label="fieldById[id].name"
      :required="isRequiredField(action, id, value, record)"
      :error="errors[id]"
      :data-field="id"
      ><Evidence
        v-if="attachmentFields.includes(id) && id !== 'EV13'"
        :value="value[id] || []"
        editable
        @input="set(id, $event)" /><view v-else-if="id === 'EV13'"
        ><view
          v-for="(photo, i) in publicCandidates"
          :key="photo"
          class="option"
          @click="toggle(photo)"
          >{{ (value.EV13 || []).includes(photo) ? "☑" : "□" }} 公开处理照片
          {{ i + 1 }}</view
        ><text class="hint">仅所选照片向上报住户公开</text></view
      ><picker
        v-else-if="opts(id)"
        :disabled="id === 'WO15' && !!value.WO10"
        :range="opts(id)"
        range-key="label"
        @change="choose(id, $event)"
        ><view class="option">{{ label(id) }} ›</view></picker
      ><view v-else-if="isDate(id)"
        ><picker
          mode="date"
          :value="value[id]?.slice(0, 10) || ''"
          @change="part(id, $event)"
          ><view class="option"
            >{{ value[id]?.slice(0, 10) || "选择日期" }} ›</view
          ></picker
        ><picker
          v-if="fieldById[id].type.includes('日期时间')"
          mode="time"
          :value="value[id]?.slice(11, 16) || '09:00'"
          @change="part(id, $event, true)"
          ><view class="option"
            >{{ value[id]?.slice(11, 16) || "选择时间" }} ›</view
          ></picker
        ></view
      ><textarea
        v-else-if="fieldById[id].type.includes('多行')"
        :value="value[id] || ''"
        :maxlength="-1"
        auto-height
        :adjust-position="true"
        :cursor-spacing="120"
        @input="input(id, $event)" /><input
        v-else
        :value="value[id] === undefined ? '' : String(value[id])"
        :disabled="id === 'RV02'"
        :maxlength="-1"
        :adjust-position="true"
        :cursor-spacing="120"
        @input="input(id, $event)" /></FormField
  ></view>
</template>
<style scoped lang="scss">
.s1-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.option {
  padding: 14px 0;
  min-height: 48px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.hint {
  display: block;
  font-size: 12px;
  color: $color-text-secondary;
  padding-bottom: 8px;
}
</style>
