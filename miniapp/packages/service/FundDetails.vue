<script setup lang="ts">
import {computed,ref} from 'vue';
import {moneySections} from '@core/service/display.js';
import FormField from '../ui/components/FormField.vue';
const props=defineProps<{record:any}>();
const selected=ref('');
const all=computed(()=>moneySections(props.record));
const tabs=computed(()=>[{key:'income',label:'收款与分账',items:all.value.filter((f:any)=>['支付','分账'].includes(f.kind))},{key:'refund',label:'退款与回退',items:all.value.filter((f:any)=>['退款','回退'].includes(f.kind))}].filter(g=>g.items.length));
const current=computed(()=>tabs.value.find(g=>g.key===selected.value)||tabs.value[0]);
</script>
<template><view class="fund-details"><view v-if="tabs.length>1" class="fund-tabs"><button v-for="g in tabs" :key="g.key" :class="{active:current?.key===g.key}" @click="selected=g.key">{{g.label}}</button></view><view v-for="f in current?.items||[]" :key="f.id" class="fund-section"><text class="fund-heading">{{f.title}}</text><FormField v-for="p in f.values" :key="p[0]" :label="p[0]" readonly><text>{{p[1]}}</text></FormField></view><text v-if="!all.length">暂无资金记录</text></view></template>
<style scoped lang="scss">.fund-details{background:#fff;border-radius:14px;margin:14px 0;padding:14px}.fund-tabs{display:flex;gap:8px}.fund-tabs button{flex:1;font-size:14px;line-height:40px}.fund-tabs .active{background:$color-primary;color:#fff}.fund-section{padding:8px 0}.fund-heading{display:block;font-weight:600;margin:8px 0}</style>
