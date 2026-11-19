<script setup lang="ts">
import { ref, computed } from 'vue';
const props=withDefaults(defineProps<{modelValue?:string; placeholder?:string; filters?:any[]; hasMore?:boolean; activeMore?:boolean}>(),{modelValue:'',placeholder:'搜索名称或编号',filters:()=>[],hasMore:false,activeMore:false});
const emit=defineEmits<{ 'update:modelValue':[string]; filter:[string,string]; open:[]; apply:[]; reset:[]; cancel:[]; panel:[string] }>();
const opened=ref('');
const current=computed(()=>props.filters.find(f=>f.key===opened.value));
function close(){if(opened.value==='more')emit('cancel');opened.value=''}
function toggle(key:string){if(opened.value===key)return close();if(opened.value==='more')emit('cancel');opened.value=key;emit('panel',key);if(key==='more')emit('open')}
function choose(key:string,value:string){emit('filter',key,value);opened.value=''}
function label(f:any){return f.options.find((o:any)=>o.value===f.value)?.label||f.label}
function apply(){emit('apply');opened.value=''}
defineExpose({close});
function searchInput(event:any){emit('update:modelValue',event.detail.value)}
</script>
<template><view class="filter-bar" :class="{expanded:!!opened}">
  <view class="filter-search"><text class="search-icon">⌕</text><input :value="modelValue" :placeholder="placeholder" :maxlength="-1" confirm-type="search" @input="searchInput"/><button v-if="modelValue" aria-label="清空搜索" @click="emit('update:modelValue','')">×</button><slot name="shortcut"/></view>
  <view v-if="filters.length||hasMore" class="filter-triggers"><button v-for="f in filters" :key="f.key" :class="{active:!!f.value||opened===f.key,wide:f.wide}" @click="toggle(f.key)"><text>{{f.value?label(f):f.label}}</text><text class="arrow">{{opened===f.key?'▴':'▾'}}</text></button><button v-if="hasMore" :class="{active:activeMore||opened==='more'}" @click="toggle('more')">更多<text class="arrow">{{opened==='more'?'▴':'▾'}}</text></button></view>
  <view v-if="opened" class="filter-backdrop" @click="close"/>
  <view v-if="current?.custom" class="filter-options"><slot name="panel" :filter-key="current.key"/></view>
  <view v-else-if="current" class="filter-options"><button @click="choose(current.key,'')">{{current.emptyLabel || "全部"+current.label}}<text v-if="!current.value">✓</text></button><button v-for="o in current.options.filter((o:any)=>o.value!== '')" :key="o.value" :class="{selected:current.value===o.value}" @click="choose(current.key,o.value)">{{o.label}}<text v-if="current.value===o.value">✓</text></button></view>
  <view v-if="opened==='more'" class="filter-options more-panel"><slot/><view class="filter-actions"><button @click="emit('reset')">重置</button><button class="confirm" @click="apply">确定</button></view></view>
</view></template>
<style scoped lang="scss">
.filter-bar { position:relative; background:#fff; border-radius:14px; margin-bottom:12px; }
.expanded { z-index:35; }.filter-search { position:relative; z-index:2; display:flex; align-items:center; margin:0 12px; padding:8px 0; gap:8px; }
.search-icon { color:#89949f; font-size:24px; }.filter-search input { flex:1; min-width:0; height:36px; background:#f5f6f8; border-radius:20px; padding:0 12px; font-size:14px; }.filter-search button { margin:0; background:transparent; font-size:22px; line-height:32px; padding:0 8px; }
button::after {border:0}.filter-triggers { position:relative; z-index:2; display:flex; border-top:1px solid #f1f3f5; }
.filter-triggers button { display:flex; justify-content:center; align-items:center; gap:5px; flex:1; min-width:0; padding:0 5px; margin:0; border-radius:0; background:#fff; font-size:13px; line-height:44px; color:#667085; }.filter-triggers button text:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.filter-triggers .active,.selected { color:$color-primary; font-weight:600; }.arrow {font-size:12px}
.filter-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.22); z-index:1; }
.filter-options { position:absolute; top:100%; left:0; right:0; z-index:3; background:#fff; max-height:55vh; overflow:auto; border-radius:0 0 14px 14px; padding:4px 16px 12px; box-shadow:0 10px 18px #00000012; }
.filter-options>button { display:flex; align-items:center; justify-content:space-between; font-size:14px; text-align:left; margin:0; background:#fff; border-bottom:1px solid #f1f3f5; border-radius:0; line-height:48px; padding:0 4px; }
.filter-actions { display:flex; gap:12px; margin-top:12px; }.filter-actions button {flex:1; font-size:14px; line-height:40px; margin:0;}.filter-actions .confirm {background:$color-primary;color:#fff;}
.filter-triggers .wide { flex: 1.8; }
.filter-triggers .wide text:first-child { white-space:normal; line-height:1.3; }
</style>
