<script setup lang="ts">
import {ref,computed} from 'vue';
const props=defineProps<{value:string[];categories:any[]}>();
const emit=defineEmits<{input:[string[]]}>();
const first=ref(''), second=ref('');
const roots=computed(()=>props.categories.filter(c=>!c['上级类目']));
const root=computed(()=>first.value||roots.value[0]?._id);
const children=(id:string)=>props.categories.filter(c=>c['上级类目']===id);
const seconds=computed(()=>children(root.value));
const middle=computed(()=>seconds.value.find(c=>c._id===second.value)?._id||seconds.value[0]?._id);
const leaves=computed(()=>children(middle.value).length?children(middle.value):seconds.value.length?seconds.value:roots.value.filter(c=>c._id===root.value));
function enabled(c:any):boolean{return !!c&&(!c['类目状态']||c['类目状态']==='启用')&&(!c['上级类目']||enabled(props.categories.find(x=>x._id===c['上级类目'])))}
function toggle(c:any){if(!enabled(c)||children(c._id).length)return;emit('input',props.value.includes(c._id)?props.value.filter(v=>v!==c._id):[...props.value,c._id])}
</script>
<template><view class="category-picker"><view class="category-columns"><scroll-view scroll-y class="level-one"><button v-for="c in roots" :key="c._id" :class="{active:root===c._id}" @click="first=c._id;second=''">{{c['类目名称']}}</button></scroll-view><view class="category-right"><scroll-view scroll-x class="level-two"><button v-for="c in seconds" :key="c._id" :class="{active:middle===c._id}" @click="second=c._id">{{c['类目名称']}}</button></scroll-view><scroll-view scroll-y class="level-three"><button v-for="c in leaves" :key="c._id" :disabled="!enabled(c)||children(c._id).length>0" :class="{selected:value.includes(c._id)}" @click="toggle(c)">{{c['类目名称']}}<text v-if="value.includes(c._id)">✓</text></button></scroll-view></view></view><view class="selected-categories"><text v-if="!value.length">请选择申请类目（可多选）</text><button v-for="id in value" :key="id" @click="emit('input',value.filter(v=>v!==id))">{{categories.find(c=>c._id===id)?.['类目名称']||id}} ×</button></view></view></template>
<style scoped lang="scss">
.category-columns {display:flex; height:288px; border:1px solid #e9edf1; border-radius:10px; overflow:hidden;}.level-one {width:100px;flex-shrink:0;background:#f5f7f8;}.category-right {flex:1;min-width:0;}.level-two {height:48px;white-space:nowrap;border-bottom:1px solid #edf0f3;}.level-two button {display:inline-block;padding:0 12px;}.level-three{height:240px;}.category-picker button{font-size:13px;line-height:44px;border-radius:0;margin:0;text-align:left;background:transparent;}.category-picker button::after{border:0}.level-three button{display:flex;justify-content:space-between;padding:0 12px;}.category-picker .active,.category-picker .selected{color:$color-primary;background:#edf5f4;font-weight:600;}.selected-categories{display:flex;gap:6px;flex-wrap:wrap;padding:10px 0;color:#8b939b;font-size:13px;}.selected-categories button{line-height:30px;border-radius:6px;background:#edf5f4;color:$color-primary;padding:0 8px;}
</style>
