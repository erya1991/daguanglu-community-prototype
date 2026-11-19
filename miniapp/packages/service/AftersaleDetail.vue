<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {service} from '@/services/foundation';
import FieldGroup from './FieldGroup.vue';
import AppButton from '../ui/components/AppButton.vue';
import FormField from '../ui/components/FormField.vue';
import {showFormError} from '../ui/formFeedback';
const props=defineProps<{record:any;options:any;merchant:boolean;initialTab?:string}>();
const emit=defineEmits<{quick:[any];saved:[]}>();
const tab=ref(props.initialTab==='process'?'process':'content'), form=ref<any>({}), errors=ref<any>({}), saving=ref(false);
const actions=computed<any[]>(()=>props.record._actions||[]);
const handler=computed(()=>actions.value.find(a=>['aftersale.plan','aftersale.cancelDecision','aftersale.execute'].includes(a.name)));
const answer=computed(()=>actions.value.find(a=>a.name==='aftersale.respond'));
const withdraw=computed(()=>actions.value.find(a=>a.name==='aftersale.withdraw'));
const key=computed(()=>'service:merchant:'+props.record._id+':'+(handler.value?.name||'')+':'+props.record._rev);
const latest=computed(()=>props.record.plans?.[props.record.plans.length-1]||{});
let operation='';
watch(key,async active=>{
  if (!props.merchant||!handler.value) return;
  const saved=await service.draft(active);
  if(active!==key.value)return;
  const opts=props.record.handlingOptions?.plan||{};
  const type=opts['部分退款']?.length?'部分退款':'全额退款';
  form.value=saved?.data||{方案处理类型:type,拟退款金额:props.record.申请退款金额,业务结案方式:opts[type]?.[0]||''};
  operation=saved?.operationId||('sale-'+Date.now()+'-'+props.record._rev);errors.value={};
},{immediate:true});
async function update(v:any){form.value=v;try{await service.draft(key.value,{data:v,operationId:operation})}catch(e){await showFormError(e)}}
async function submit(){if(!handler.value||saving.value)return;if(handler.value.name==='aftersale.execute'){emit('quick',handler.value);return}
  saving.value=true;const active=key.value;
  try{await service.service.command(handler.value.name,{id:props.record._id,revision:props.record._rev,operationId:operation,data:form.value});
    await service.draft(active,null);tab.value='content';uni.showToast({title:'处理结果已保存',icon:'none'});emit('saved');
  }catch(e:any){errors.value=e.fields||{};await showFormError(e)}finally{saving.value=false}
}
</script>
<template><view class="after-detail">
  <view class="sale-tabs"><button :class="{current:tab==='content'}" @click="tab='content'">申请内容</button><button :class="{current:tab==='process'}" @click="tab='process'">处理方案</button></view>
  <view v-if="tab==='content'" class="sale-panel"><FieldGroup compact :heading="false" :tables="['31-A']" :only="['原服务订单号','服务项目名称','申请类型','申请原因','申请退款金额','期望解决方式','问题说明','问题证据','申请时间','售后状态']" :value="record" :options="options" record-table="aftersales" :record-id="record._id"/>
    <FieldGroup v-for="(item,i) in record.evidence||[]" :key="i" compact :heading="false" :tables="['31-C']" :only="['追加说明','追加证据']" :value="item" :options="options" record-table="aftersales" :record-id="record._id"/>
  </view>
  <view v-else class="sale-panel">
    <view v-if="latest.方案处理类型" class="plan-summary"><text>{{latest.方案处理类型}}　{{latest.拟退款金额?'¥'+latest.拟退款金额:''}}</text><text>{{latest.方案说明}}</text><text v-if="latest.居民方案答复">住户答复　{{latest.居民方案答复}}</text></view>
    <template v-if="merchant&&handler">
      <FieldGroup v-if="handler.name==='aftersale.plan'" editable :heading="false" :tables="['31-B']" :only="['方案处理类型','拟退款金额','金额依据说明','业务结案方式','方案说明']" :action="handler.name" :record="record" :options="{...options,handlingOptions:record.handlingOptions}" :value="form" :errors="errors" @input="update"/>
      <template v-else-if="handler.name==='aftersale.cancelDecision'"><FormField label="取消核实结果" required :error="errors.取消核实结果"><picker :range="['同意取消','不同意取消']" @change="update({...form,取消核实结果:['同意取消','不同意取消'][Number($event.detail.value)]})"><view>{{form.取消核实结果||'请选择'}}</view></picker></FormField><FormField label="核实依据说明" required :error="errors.核实依据说明"><textarea :value="form.核实依据说明||''" @input="update({...form,核实依据说明:$event.detail.value})"/></FormField></template>
      <AppButton :loading="saving" @click="submit">{{handler.name==='aftersale.plan'?'提交处理方案':handler.label}}</AppButton>
    </template>
    <text v-else-if="!latest.方案处理类型">{{record.当前处理说明||record.售后状态}}</text>
    <FieldGroup compact :heading="false" :tables="['31-B','31-G']" :only="['执行状态','退款状态','本次成功退款金额','裁定结果','公开处理说明']" :value="record" :options="options"/>
  </view>
  <view v-if="!merchant&&(answer||withdraw)" class="sale-buttons"><AppButton v-if="withdraw" variant="secondary" @click="emit('quick',withdraw)">{{withdraw.label}}</AppButton><AppButton v-if="answer" @click="emit('quick',answer)">确认方案</AppButton></view>
</view></template>
<style scoped lang="scss">.sale-tabs,.sale-buttons{display:flex;gap:8px}.sale-tabs button,.sale-buttons>button{flex:1}.sale-tabs button{margin:0;background:white;font-size:15px;line-height:44px}.sale-tabs .current{color:$color-primary;border-bottom:2px solid $color-primary}.sale-panel{background:white;padding:12px;margin:8px 0 12px;border-radius:12px}.plan-summary{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}.sale-buttons{position:sticky;bottom:0;padding:8px 0 calc(8px + env(safe-area-inset-bottom));background:#f6f8f8}</style>
