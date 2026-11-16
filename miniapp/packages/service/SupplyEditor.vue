<script setup lang="ts">
import {computed} from 'vue';
import {service} from '@/services/foundation';
import {serviceText} from './presentation';
import {showFormError} from '../ui/formFeedback';
import FieldGroup from './FieldGroup.vue';
const props=withDefaults(defineProps<{value:any;options:any;errors?:any;draftKey:string}>(),{errors:()=>({})});
const emit=defineEmits<{input:[any]}>();
const specs=computed(()=>props.value['服务规格集合']||[]);
function update(v:any){emit('input',v)}
async function openSpec(index:number){try{const previous=await service.draft(props.draftKey);await service.draft(props.draftKey,{...previous,data:props.value});uni.navigateTo({url:'/pages/service/spec?draftKey='+encodeURIComponent(props.draftKey)+'&index='+index})}catch(e:any){await showFormError(e)}}
function removeSpec(i:number){update({...props.value,服务规格集合:specs.value.filter((_:any,j:number)=>j!==i)})}
</script>
<template><view class="supply-editor"><FieldGroup :tables="['27-C']" action="service.save" :value="value" :options="options" :errors="errors" editable :only="['服务名称','所属服务类目','服务主图','介绍图片','服务简介','服务详细说明','适用对象说明','预约须知','公开服务电话']" @input="update"/>
<view class="section-heading"><text>规格及固定报价 <text class="required-mark">*</text></text><button class="add" @click="openSpec(specs.length)">添加规格</button></view>
<view v-for="(s,i) in specs" :key="s['规格编号']||i" class="spec-card" @click="openSpec(i)"><view class="section-heading"><text>{{s['规格名称']||'新规格'}}</text><text>编辑 ›</text></view><text class="muted">{{s['规格说明']}}</text><text v-for="c in s['组合集合']" :key="c._method">{{serviceText(c['组合履约方式名称'])}} · ¥{{c['组合固定价格']}}</text><text class="remove" @click.stop="removeSpec(i)">移除规格</text></view><text v-if="!specs.length" class="muted">添加规格后设置上门或到店报价</text></view></template>

<style scoped lang="scss">
.required-mark { color: $color-error; }
.supply-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}
.section-heading .add {
  font-size: 14px;
  margin: 0;
  color: $color-primary;
  background: $color-primary-light;
}
.spec-card {
  padding: 16px;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.remove {
  color: $color-error;
  min-height: 40px;
  display: flex;
  align-items: center;
}
.muted {
  color: $color-text-secondary;
}
</style>
