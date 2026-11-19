<script setup lang="ts">
import CategoryTags from './CategoryTags.vue';
import { computed, ref, watch } from 'vue';
const props = withDefaults(defineProps<{value:string[]; categories:any[]; multiple?:boolean; allowed?:string[]; inline?:boolean}>(), {multiple:true});
const emit = defineEmits<{input:[string[]]}>();
const open = ref(false), first = ref(''), draft = ref<string[]>([]);
const roots = computed(() => props.categories.filter(root =>
  !root.上级类目 && root.类目状态 !== '停用' && (!props.allowed || props.categories.some(child =>
    child.上级类目 === root._id && child.类目状态 !== '停用' && props.allowed!.includes(child._id)))));
const current = computed(() => roots.value.find(c => c._id === first.value)?._id || roots.value[0]?._id);
const leaves = computed(() => props.categories.filter(c => c.上级类目 === current.value && c.类目状态 !== '停用' && (!props.allowed || props.allowed.includes(c._id))));
const title = (id:string) => props.categories.find(c => c._id === id)?.类目名称 || id;
function start(){draft.value=[...props.value]; first.value=props.categories.find(c=>c._id===draft.value[0])?.上级类目 || roots.value[0]?._id; open.value=true;}
function choose(id:string){const selected=props.inline?props.value:draft.value;const next=props.multiple?(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]):[id];if(props.inline)emit('input',next);else draft.value=next;}
function confirm(){emit('input',draft.value);open.value=false;}
watch(()=>props.value[0], id=>{if(props.inline && id) first.value=props.categories.find(c=>c._id===id)?.上级类目||'';},{immediate:true});
</script>
<template><view class="category-picker">
  <view v-if="!inline" class="category-summary">
    <CategoryTags v-if="value.length" :ids="value" :categories="categories"/>
    <button class="category-trigger" @click="start">{{ value.length ? '修改类目' : '请选择服务类目' }} ›</button>
  </view>
  <view v-if="inline||open" :class="inline?'inline-tree':'category-mask'" @click="open=false">
    <view class="category-panel" @click.stop>
      <view v-if="!inline" class="sheet-head"><button @click="open=false">取消</button><text>选择服务类目</text><button class="confirm" @click="confirm">确定</button></view>
      <view class="category-columns">
        <scroll-view scroll-y class="level-one"><button v-for="c in roots" :key="c._id" :class="{active:current===c._id}" @click="first=c._id">{{c.类目名称}}</button></scroll-view>
        <scroll-view scroll-y class="level-two"><text class="level-heading">{{title(current || '')}}</text><view class="category-grid"><button v-for="c in leaves" :key="c._id" :class="{selected:(inline?value:draft).includes(c._id)}" @click="choose(c._id)">{{c.类目名称}}<text v-if="(inline?value:draft).includes(c._id)">✓</text></button></view><text v-if="!leaves.length" class="empty-leaves">暂无可选类目</text></scroll-view>
      </view>
      <view v-if="!inline&&multiple&&draft.length" class="picked"><text>已选 {{draft.length}} 项</text><scroll-view scroll-y class="picked-tags"><CategoryTags :ids="draft" :categories="categories"/></scroll-view></view>
    </view>
  </view>
</view></template>
<style scoped lang="scss">
.category-trigger{width:100%;text-align:right;color:$color-primary;white-space:normal}
.category-picker button{margin:0;padding:0 10px;background:transparent;font-size:14px;line-height:44px}
.category-picker button::after{border:0}.category-mask{position:fixed;inset:0;z-index:85;background:#0006;display:flex;align-items:flex-end}
.category-panel{width:100%;background:white}.category-mask .category-panel{border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom)}.sheet-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e7ebeb}.sheet-head text{font-weight:600}.confirm,.selected{color:$color-primary}
.category-columns{display:flex;height:260px}.level-one{width:82px;flex:none;background:#f3f6f5}.level-two{flex:1;min-width:0}.level-one button,.level-two button{width:100%;text-align:left;border-radius:0}.level-two button{display:flex;justify-content:space-between}.level-one .active,.level-two .selected{background:#e6f3ef;color:$color-primary}.picked,.empty-leaves{display:block;padding:10px 12px;color:#56645f;font-size:13px}
.category-summary{padding:8px;background:#f8faf9;border-radius:9px}.category-summary .category-trigger{text-align:right;min-height:44px}
.level-heading{display:block;padding:10px 10px 4px;color:#56645f;font-size:14px}
.category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:6px 9px}
.level-two .category-grid button{display:flex;align-items:center;justify-content:center;min-height:44px;padding:4px;line-height:1.35;text-align:center;overflow-wrap:anywhere;background:#f2f5f4;border:1px solid transparent;border-radius:7px}
.level-two .category-grid button.selected{background:#e6f3ef;border-color:$color-primary;color:$color-primary}
.picked-tags{max-height:100px;margin-top:4px}
</style>
