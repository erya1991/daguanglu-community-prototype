<script setup lang="ts">
import { computed, ref } from "vue";
import FormField from "../ui/components/FormField.vue";
const props = withDefaults(
  defineProps<{ value: any; options: any; errors?: any; contact?: boolean; allowBound?: boolean }>(),
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
function set(k: string, v: any) {
  const next = { ...props.value, [k]: v };
  if (k === "省份") {
    next.城市 = "";
    next.区县 = "";
  }
  if (k === "城市") next.区县 = "";
  emit("input", next);
}
const manualDraft = ref<any>({});
const fromHouse = computed(() => !!props.allowBound && props.value.地址来源 === '绑定房屋');
const homes = computed<any[]>(() => props.options.boundHomes || []);
const selectedHome = computed(() => homes.value.find(h => h.绑定房屋 === props.value.绑定房屋));
function changeSource(bound: boolean) {
  if (bound === fromHouse.value) return;
  if (bound) manualDraft.value = { ...props.value };
  const next = bound ? {} : { ...manualDraft.value };
  for (const k of ['_id','_rev','联系人姓名','联系人电话','默认地址']) next[k] = props.value[k];
  next.地址来源 = bound ? '绑定房屋' : '手动输入';
  emit('input', next);
}
function chooseHome(event:any) {
  const home = homes.value[Number(event.detail.value)];
  if (home) emit('input', { ...props.value, 省份:'',城市:'',区县:'', ...home });
}
function eventValue(e: any) {
  return e.detail.value;
}
</script>
<template>
  <view class="address-form">
    <view v-if="allowBound" class="address-sources">
      <button :class="{active:!fromHouse}" @click="changeSource(false)">手动输入</button>
      <button :class="{active:fromHouse}" @click="changeSource(true)">从我的房屋选择</button>
    </view>
    <FormField v-if="fromHouse" label="绑定房屋" required :error="errors.绑定房屋">
      <picker v-if="homes.length" :range="homes" range-key="详细地址" @change="chooseHome">
        <view class="address-pick">{{ selectedHome?.详细地址 || '选择已绑定房屋' }} ›</view>
      </picker>
      <text v-else>暂无有效绑定房屋，可手动输入地址</text>
    </FormField>
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
    <view v-if="!fromHouse || (selectedHome && !(selectedHome.省份 && selectedHome.城市 && selectedHome.区县))" class="region-row"
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
    <FormField
      v-if="!fromHouse" label="详细地址"
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
  </view>
</template>
<style scoped lang="scss">
.address-sources {display:flex; gap:8px}
.address-sources button {flex:1;min-height:44px;font-size:14px;background:#f4f6f5;color:#34433e}
.address-sources .active {background:#e4f2ec;color:$color-primary}
.address-form {
  display: grid;
  gap: 6px;
}
.region-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
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
<style scoped>.region-row :deep(.form-field__label-row){flex-basis:100%}.address-pick{padding:8px 0;line-height:24px}</style>
