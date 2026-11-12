<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { service } from "@/services/foundation";
import AppPage from "../ui/components/AppPage.vue";
import AppNavbar from "../ui/components/AppNavbar.vue";
const counts = ref<Record<string, number>>({}),
  error = ref("");
const entries = [
  ["payments", "缴费记录", "payments/index"],
  ["monthly", "月租订单", "parking/monthly"],
  ["temporary", "临停账单", "parking/temporary"],
  ["repairs", "我的工单", "repairs/index"],
];
function go(path: string) {
  uni.navigateTo({ url: "/pages/stage01/" + path });
}
onShow(async () => {
  try {
    counts.value = {
      payments: (await service.stage01.query("payments")).length,
      monthly: (await service.stage01.query("monthly")).length,
      temporary: (await service.stage01.query("temporary")).length,
    };
    const reports = await service.stage01.query("reports");
    counts.value.repairs = reports.length;
  } catch (e: any) {
    error.value = e.message;
  }
});
</script>
<template>
  <AppPage secondary
    ><template #navbar><AppNavbar title="我的业务记录" show-back /></template
    ><view class="s1-mobile"
      ><text v-if="error" class="error">{{ error }}</text
      ><view v-for="e in entries" :key="e[0]" class="card" @click="go(e[2])"
        ><text class="card-title">{{ e[1] }} ›</text
        ><text class="muted">{{ counts[e[0]] || 0 }} 条记录</text></view
      ></view
    ></AppPage
  >
</template>
<style lang="scss" src="./stage01.scss"></style>
