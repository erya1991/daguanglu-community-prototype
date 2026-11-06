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
      class="s1-field"
      :data-field="id"
      ><text class="s1-label">{{ fieldById[id]?.name || id }}</text
      ><Evidence
        v-if="attachmentFields.includes(id)"
        :value="Array.isArray(row[id]) ? row[id] : []"
        :table="table"
        :record-id="recordId"
      /><text v-else class="s1-value">{{
        format(id, row[id], row._labels)
      }}</text></view
    ></view
  >
</template>
<style scoped>
.s1-field {
  padding: 10px 0;
  border-bottom: 1px solid #edf0f1;
}
.s1-label {
  display: block;
  font-size: 13px;
  color: #607176;
  margin-bottom: 5px;
}
.s1-value {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.65;
  font-size: 15px;
  color: #253a3b;
}
</style>
