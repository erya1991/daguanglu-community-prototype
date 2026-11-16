<script setup lang="ts">
import { computed } from "vue";
import FormField from "../ui/components/FormField.vue";
const props = withDefaults(
  defineProps<{ value: any; options: any; errors?: any; contact?: boolean }>(),
  { errors: () => ({}), contact: true },
);
const emit = defineEmits<{ input: [any] }>();
const region = computed(() => props.options.addressRegions || []);
const cities = computed(
  () =>
    region.value.find((p: any) => p.name === props.value.省份)?.cities || [],
);
const districts = computed(
  () =>
    cities.value.find((c: any) => c.name === props.value.城市)?.districts || [],
);
const estates = computed(() =>
  (props.options.estates || []).filter(
    (e: any) => e.community === props.value.所属社区,
  ),
);
function set(k: string, v: any) {
  const next = { ...props.value, [k]: v };
  if (k === "省份") {
    next.城市 = "";
    next.区县 = "";
  }
  if (k === "城市") next.区县 = "";
  if (k === "所属社区") next.所属小区 = "";
  emit("input", next);
}
function eventValue(e: any) {
  return e.detail.value;
}
</script>
<template>
  <view class="address-form">
    <template v-if="contact"
      ><FormField label="联系人姓名" required :error="errors.联系人姓名"
        ><input
          :value="props.value.联系人姓名 || ''"
          placeholder="填写联系人"
          @input="set('联系人姓名', eventValue($event))" /></FormField
      ><FormField label="联系人电话" required :error="errors.联系人电话"
        ><input
          :value="props.value.联系人电话 || ''"
          type="number"
          placeholder="填写联系电话"
          @input="set('联系人电话', eventValue($event))" /></FormField
    ></template>
    <view class="region-row"
      ><FormField
        label="省份"
        required
        :error="errors.省份"
        data-address-field="省份"
        ><picker
          :range="region"
          range-key="name"
          @change="set('省份', region[Number(eventValue($event))].name)"
          ><view class="address-pick"
            >{{ props.value.省份 || "选择省份" }} ›</view
          ></picker
        ></FormField
      ><FormField
        label="城市"
        required
        :error="errors.城市"
        data-address-field="城市"
        ><picker
          :disabled="!cities.length"
          :range="cities"
          range-key="name"
          @change="set('城市', cities[Number(eventValue($event))].name)"
          ><view class="address-pick"
            >{{ props.value.城市 || "选择城市" }} ›</view
          ></picker
        ></FormField
      ><FormField
        label="区县"
        required
        :error="errors.区县"
        data-address-field="区县"
        ><picker
          :disabled="!districts.length"
          :range="districts"
          @change="set('区县', districts[Number(eventValue($event))])"
          ><view class="address-pick"
            >{{ props.value.区县 || "选择区县" }} ›</view
          ></picker
        ></FormField
      ></view
    >
    <view class="community-row"
      ><FormField
        label="社区"
        required
        :error="errors.所属社区"
        data-address-field="所属社区"
        ><picker
          :range="options.communities || []"
          range-key="label"
          @change="
            set(
              '所属社区',
              options.communities[Number(eventValue($event))].value,
            )
          "
          ><view class="address-pick"
            >{{
              options.communities?.find(
                (c: any) => c.value === props.value.所属社区,
              )?.label || "选择社区"
            }}
            ›</view
          ></picker
        ></FormField
      ><FormField
        label="小区"
        :required="!!options.selectedCombo?.上门覆盖小区?.length"
        :error="errors.所属小区"
        data-address-field="所属小区"
        ><picker
          :range="[{ value: '', label: '不选小区' }, ...estates]"
          range-key="label"
          @change="
            set(
              '所属小区',
              [{ value: '' }, ...estates][Number(eventValue($event))].value,
            )
          "
          ><view class="address-pick"
            >{{
              estates.find((e: any) => e.value === props.value.所属小区)
                ?.label || "选择小区"
            }}
            ›</view
          ></picker
        ></FormField
      ></view
    >
    <FormField
      label="详细地址"
      required
      :error="errors.详细地址"
      data-address-field="详细地址"
    >
      <textarea
        :value="props.value.详细地址 || ''"
        auto-height
        placeholder="街道、楼栋、单元及门牌号"
        @input="set('详细地址', eventValue($event))"
      />
    </FormField>
    <FormField label="地址补充说明"
      ><input
        :value="props.value.地址补充说明 || ''"
        placeholder="选填，如入门指引"
        @input="set('地址补充说明', eventValue($event))"
    /></FormField>
  </view>
</template>
<style scoped lang="scss">
.address-form {
  display: grid;
  gap: 16px;
}
.region-row,
.community-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.community-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.address-pick {
  padding: 12px 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.address-form textarea {
  min-height: 52px !important;
}
</style>
