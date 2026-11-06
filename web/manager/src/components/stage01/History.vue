<template>
  <div>
    <p v-if="!rows.length" class="s1-muted">暂无操作记录</p>
    <div v-for="h in rows" :key="h.HI01" class="s1-history">
      <strong data-field="HI02">{{ h.HI02 }}</strong
      ><small
        ><span data-field="HI03">{{ h.HI03 }}</span> ·
        <span data-field="HI04">{{ display("HI04", h.HI04) }}</span></small
      >
      <p data-field="HI07">{{ h.HI07 }}</p>
      <details>
        <summary>变更详情</summary>
        <Fields :row="h" :ids="['HI01', 'HI05', 'HI06', 'HI08']" />
      </details>
    </div>
  </div>
</template>
<script>
import Fields from "./Fields.vue";
import { format } from "../../../../../prototype-shared/stage01/ui.js";
export default {
  components: { Fields },
  props: { rows: { type: Array, default: () => [] } },
  methods: { display: format },
};
</script>
