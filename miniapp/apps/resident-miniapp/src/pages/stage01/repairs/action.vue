<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import Page from "@/_shared/stage01/WorkPage.vue";
function decode(v: any) {
  if (typeof v !== "string") return v;
  for (let i = 0; i < 3; i++) {
    try {
      const n = decodeURIComponent(v);
      if (n === v) break;
      v = n;
    } catch {
      break;
    }
  }
  return v;
}
const query = ref<any>({});
onLoad((q: any) => {
  query.value = Object.fromEntries(
    Object.entries(q || {}).map(([k, v]) => {
      try {
        return [k, decode(v)];
      } catch {
        return [k, v];
      }
    })
  );
});
</script>
<template>
  <Page
    view="repairs"
    mode="action"
    :id="query.id || ''"
    :kind="query.kind || ''"
    :payment="query.payment || ''"
    :table="query.table || ''"
    :relation="query.relation || ''"
    :action="query.action || ''"
  />
</template>
