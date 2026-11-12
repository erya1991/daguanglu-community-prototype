<template>
  <dl class="s1-fields">
    <template v-for="id in ids.filter(show)"
      ><dt :key="id + '-label'">{{ fields[id] ? fields[id].name : id }}</dt>
      <dd :key="id" :data-field="id">
        <dl v-if="id === 'IM01' && row.IM01 && typeof row.IM01 === 'object'">
          <template v-for="(v, k) in row.IM01"
            ><dt v-if="k !== 'AT08' || v" :key="k + 'k'">
              {{ fields[k].name }}
            </dt>
            <dd v-if="k !== 'AT08' || v" :key="k" :data-field="k">
              {{ k === "AT03" ? display(k, v) + " 字节" : display(k, v) }}
            </dd></template
          >
        </dl>
        <Evidence
          v-else-if="attachments.includes(id)"
          :value="Array.isArray(row[id]) ? row[id] : []"
          :table="table"
          :record-id="recordId"
        /><span v-else>{{ ['MP10','MO20','TB17'].includes(id) && !row[id] ? '未登记' : display(id, row[id], row._labels) }}</span>
      </dd></template
    >
  </dl>
</template>
<script>
import {
  fieldById,
  format,
  attachmentFields,
} from "../../../../../prototype-shared/stage01/ui.js";
import Evidence from "./Evidence.vue";
export default {
  components: { Evidence },
  props: {
    row: { type: Object, default: () => ({}) },
    ids: { type: Array, default: () => [] },
    table: String,
    recordId: String,
  },
  data: () => ({ fields: fieldById, attachments: attachmentFields }),
  methods: {
    display: format,
    show(id) {
      if(['MP10','MO20','TB17'].includes(id)) return true;
      if (id === "PY05") return false; // Stage03 points rules are disabled in this prototype.
      if (
        ["RP04", "RP12", "RP15", "RP16", "EV07", "EV08"].includes(id) &&
        !this.row[id]
      )
        return false;
      return (
        Object.prototype.hasOwnProperty.call(this.row, id) &&
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
          ].includes(id) && !this.row[id]
        )
      );
    },
  },
};
</script>
