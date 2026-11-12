<template>
  <form class="s1-form" @submit.prevent="$emit('submit')">
    <div v-for="id in active" :key="id" class="s1-form-field" :data-field="id">
      <label :for="'s1-' + id">{{ fields[id].name }}<span v-if="required(id)" class="s1-required" aria-hidden="true"> *</span></label
      ><Evidence
        v-if="attachmentIds.includes(id) && id !== 'EV13'"
        :value="value[id] || []"
        editable
        @input="set(id, $event)"
      />
      <div v-else-if="id === 'EV13'">
        <label v-for="photo in publicCandidates" :key="photo"
          ><input
            type="checkbox"
            :checked="(value.EV13 || []).includes(photo)"
            @change="toggle(photo, $event.target.checked)"
          />选择处理照片 {{ publicCandidates.indexOf(photo) + 1 }}</label
        >
        <p class="s1-muted">仅选中的照片对住户公开</p>
      </div>
      <select
        v-else-if="opts(id)"
        :id="'s1-' + id"
        :aria-required="required(id) ? 'true' : undefined"
        :value="value[id] || ''"
        :disabled="
          (id === 'TB03' && value.TB13 === '已发布') ||
          (id === 'WO15' && !!value.WO10) ||
          (id === 'PK02' && value._identityLocked)
        "
        @change="set(id, $event.target.value)"
      >
        <option value="">请选择</option>
        <option v-for="o in opts(id)" :key="o.value" :value="o.value">
          {{ o.label }}
        </option></select
      ><textarea
        v-else-if="/多行/.test(fields[id].type)"
        :id="'s1-' + id"
        :aria-required="required(id) ? 'true' : undefined"
        :value="value[id] || ''"
        @input="set(id, $event.target.value)"
        rows="3"
      /><input
        v-else
        :id="'s1-' + id"
        :aria-required="required(id) ? 'true' : undefined"
        :type="inputType(id)"
        :value="value[id] === undefined ? '' : value[id]"
        :readonly="id === 'RV02' || (id === 'PK04' && value._identityLocked)"
        @input="set(id, $event.target.value)"
      /><span v-if="errors[id]" class="s1-error">{{ errors[id] }}</span>
    </div>
    <slot />
  </form>
</template>
<script>
import {
  fieldById,
  activeFields,
  isRequiredField,
  choices,
  attachmentFields,
} from "../../../../../prototype-shared/stage01/ui.js";
import Evidence from "./Evidence.vue";
export default {
  components: { Evidence },
  props: {
    action: String,
    value: { type: Object, default: () => ({}) },
    options: { type: Object, default: () => ({}) },
    records: { type: Array, default: () => [] },
    errors: { type: Object, default: () => ({}) },
    role: { default: "property" },
    kind: String,
    record: { type: Object, default: () => ({}) },
    publicCandidates: { type: Array, default: () => [] },
  },
  data: () => ({ fields: fieldById, attachmentIds: attachmentFields }),
  computed: {
    active() {
      return activeFields(this.action, this.value, this.role, this.kind);
    },
  },
  methods: {
    required(id) { return isRequiredField(this.action, id, this.value, this.record); },
    set(id, v) {
      const n = { ...this.value, [id]: v };
      if (id === "RP09") n.RP10 = "";
      if (id === "RP11" && v === "公共位置") n.RP12 = "";
      this.$emit("input", n);
    },
    opts(id) {
      const o = choices(id, this.options, this.records);
      return id === "RP10"
        ? o?.filter((e) => !this.value.RP09 || e.community === this.value.RP09)
        : o;
    },
    inputType(id) {
      const t = this.fields[id].type;
      if (t.includes("日期时间")) return "datetime-local";
      if (t.startsWith("日期")) return "date";
      return "text";
    },
    toggle(id, on) {
      this.set(
        "EV13",
        on
          ? [...(this.value.EV13 || []), id]
          : (this.value.EV13 || []).filter((x) => x !== id)
      );
    },
  },
};
</script>
