<script setup lang="ts">
import { computed } from "vue";
// The existing locked qrcode-terminal 0.12.0 vendor is Kazuhiko Arase's MIT QR encoder.
// Import only this pure JavaScript encoder; the Node terminal entry is not used.
import QRCode from "qrcode-terminal/vendor/QRCode/index.js";
const props = defineProps<{ value: string }>();
const encoded = computed(() => {
  if (!props.value) return { rows: [], error: "" };
  try {
    const qr = new QRCode(-1, 1);
    qr.addData(props.value);
    qr.make();
    return {
      rows: Array.from({ length: qr.getModuleCount() }, (_, y) =>
        Array.from({ length: qr.getModuleCount() }, (_, x) => qr.isDark(y, x)),
      ),
      error: "",
    };
  } catch (e: any) {
    return { rows: [], error: e.message || "二维码生成失败" };
  }
});
</script>
<template>
  <view class="credential-qr svc-view" data-field="30-B.02"
    ><view
      v-if="encoded.rows.length"
      class="qr-box svc-view"
      aria-label="到点凭证二维码"
      ><view v-for="(row, y) in encoded.rows" :key="y" class="qr-row svc-view"
        ><view
          v-for="(dark, x) in row"
          :key="x"
          class="qr-cell svc-view"
          :class="{ 'qr-cell--dark': dark }" /></view></view
    ><text v-if="encoded.error" class="qr-error svc-text"
      >二维码暂不能展示，请使用下方凭证码。{{ encoded.error }}</text
    ><text v-if="!value" class="qr-note svc-text"
      >当前没有可展示的到点凭证</text
    ></view
  >
</template>
<style scoped lang="scss">
.credential-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
}
.qr-box {
  box-sizing: border-box;
  width: 232px;
  height: 232px;
  max-width: 100%;
  padding: 24px;
  background: #fff;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  flex: none;
}
.qr-row {
  display: flex;
  flex: 1;
  min-height: 0;
}
.qr-cell {
  flex: 1;
  min-width: 0;
  background: #fff;
}
.qr-cell--dark {
  background: #000;
}
.qr-error {
  color: $color-error;
  font-size: 13px;
  line-height: 1.7;
}
.qr-note {
  color: $color-text-secondary;
  font-size: 13px;
}
</style>
