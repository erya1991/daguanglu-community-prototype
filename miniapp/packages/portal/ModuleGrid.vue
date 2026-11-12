<script setup lang="ts">
import AppIcon from '../ui/components/AppIcon.vue'
import { openPage } from '../common/utils/navigation'
import type { ModuleEntry } from './modules'
defineProps<{items:ModuleEntry[]; compact?:boolean}>()
function open(item:ModuleEntry){openPage(item.path)}
</script>
<template><view class="module-grid" :class="{'module-grid--compact':compact}"><button v-for="item in items" :key="item.id" class="module-entry" :class="{'module-entry--pending':!item.available}" :data-module="item.id" @click="open(item)"><view class="module-icon"><AppIcon :name="item.icon" :size="25"/></view><text class="module-title">{{item.title}}</text><text v-if="!item.available" class="module-note">开发中</text></button></view></template>
<style scoped lang="scss">
.module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 6px}.module-entry{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-height:82px;padding:8px 0;background:transparent;line-height:1.5;min-width:0}.module-icon{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:16px;background:$color-primary-light}.module-title{font-size:13px;color:$color-text-primary;margin-top:8px;text-align:center;overflow-wrap:anywhere}.module-note{font-size:10px;color:$color-text-disabled}.module-entry--pending .module-icon{background:$color-group-bg;filter:grayscale(1);opacity:.6}.module-grid--compact .module-icon{width:42px;height:42px;border-radius:14px}@media(max-width:340px){.module-title{font-size:12px}.module-grid{gap:8px 2px}}
</style>
