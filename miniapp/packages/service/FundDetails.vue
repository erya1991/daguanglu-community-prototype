<script setup lang="ts">
import {computed,ref} from 'vue';
import {service} from '@/services/foundation';
import AppButton from '../ui/components/AppButton.vue';
import {moneySections} from '@core/service/display.js';
import FormField from '../ui/components/FormField.vue';
const props=defineProps<{record:any}>();
const selected=ref('');
const refreshed=ref<any>({}), error=ref(''), busy=ref('');
const facts=computed(()=> (props.record['资金类型']?[props.record]:props.record.fundRecords||[]).map((f:any)=>refreshed.value[f._id]||f));
const all=computed(()=>moneySections({fundRecords:facts.value}));
async function queryFund(id:string,name:string){if(busy.value)return;busy.value=id;error.value='';try{const f=facts.value.find((f:any)=>f._id===id);await service.service.command(name,{id,revision:f._rev,operationId:'fund-query-'+Date.now(),data:{}});refreshed.value={...refreshed.value,[id]:await service.service.record('funds',id)}}catch(e:any){error.value=e.message}finally{busy.value=''}}
const tabs=computed(()=>[{key:'income',label:'收款与分账',items:all.value.filter((f:any)=>['支付','分账'].includes(f.kind))},{key:'refund',label:'退款与回退',items:all.value.filter((f:any)=>['退款','回退'].includes(f.kind))}].filter(g=>g.items.length));
const current=computed(()=>tabs.value.find(g=>g.key===selected.value)||tabs.value[0]);
</script>
<template><view class="fund-details"><view v-if="tabs.length>1" class="fund-tabs"><button v-for="g in tabs" :key="g.key" :class="{active:current?.key===g.key}" @click="selected=g.key">{{g.label}}</button></view><view v-for="f in current?.items||[]" :key="f.id" class="fund-section"><text class="fund-heading">{{f.title}}</text><FormField v-for="p in f.values" :key="p[0]" :label="p[0]" readonly><text>{{p[1]}}</text></FormField><view class="fund-actions"><AppButton v-for="a in f.actions.filter((a:any)=>['fund.query','fund.retry'].includes(a.name))" :key="a.name" size="compact" variant="secondary" :loading="busy===f.id" @click="queryFund(f.id,a.name)">{{a.label}}</AppButton></view></view><text v-if="error" class="error">{{error}}</text><text v-if="!all.length">暂无资金记录</text></view></template>
<style scoped lang="scss">.fund-details{background:#fff;border-radius:14px;margin:14px 0;padding:14px}.fund-tabs{display:flex;gap:8px}.fund-tabs button{flex:1;font-size:14px;line-height:40px}.fund-tabs .active{background:$color-primary;color:#fff}.fund-section{padding:8px 0}.fund-heading{display:block;font-weight:600;margin:8px 0}.fund-actions{display:flex;gap:8px;justify-content:flex-end}.error{color:#bf3340}.fund-details{margin:10px 0;padding:12px}
</style>
