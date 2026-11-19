<script setup lang="ts">
import { fieldById, format, attachmentFields } from "@core/stage01/ui.js";
import Evidence from "./Evidence.vue";
const props = withDefaults(
  defineProps<{
    row?: any;
    ids: string[];
    table?: string;
    recordId?: string;
  }>(),
  { row: () => ({}) }
);
function show(id: string) {
  if(['MP10','MO20','TB17'].includes(id)) return true;
  if (id === "PY05") return false; // Stage03 points rules are disabled in this prototype.
  if (
    ["RP04", "RP12", "RP15", "RP16", "EV07", "EV08"].includes(id) &&
    !props.row[id]
  )
    return false;
  return (
    Object.prototype.hasOwnProperty.call(props.row, id) &&
    !(
      [
        "PY20",
        "PY21",
        "PY22",
        "MO04",
        "MO05",
        "MO06",
        "HZ05",
        "HZ03",
        "HZ09",
      ].includes(id) && !props.row[id]
    )
  );
}
</script>
<template>
  <view class="s1-fields"
    ><view
      v-for="id in ids.filter(show)"
      :key="id"
      :class="['s1-field', {'s1-field--wide': attachmentFields.includes(id) || /多行|图片|附件/.test(fieldById[id]?.type || '') || /说明|原因|内容|描述/.test(fieldById[id]?.name || '')}]"
      :data-field="id"
      ><text class="s1-label">{{ fieldById[id]?.name || id }}</text
      ><Evidence
        v-if="attachmentFields.includes(id)"
        :value="Array.isArray(row[id]) ? row[id] : []"
        :table="table"
        :record-id="recordId"
      /><text v-else class="s1-value">{{
        ['MP10','MO20','TB17'].includes(id) && !row[id] ? '未登记' : format(id, row[id], row._labels)
      }}</text></view
    ></view
  >
</template>
<style scoped lang="scss">
.s1-field {
  padding: 10px 0;
  border-bottom: 1px solid $color-border;
}
.s1-label {
  display: block;
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 5px;
}
.s1-value {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.65;
  font-size: 15px;
  color: $color-text-primary;
}
.s1-field{display:flex;align-items:baseline;gap:10px;padding:8px 0}.s1-label{flex:0 0 96px;margin:0;font-size:14px}.s1-value{flex:1;min-width:0}.s1-field--wide{display:block}.s1-field--wide .s1-label{margin-bottom:6px}
</style>
