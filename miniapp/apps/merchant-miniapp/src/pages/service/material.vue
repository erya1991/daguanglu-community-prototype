<script setup lang="ts">
defineOptions({inheritAttrs:false});
import {ref} from 'vue';
import {onLoad} from '@dcloudio/uni-app';
import Page from '@/_shared/service/MaterialEditorPage.vue';
const query=ref<any>(null);
function decode(v:string){for(let i=0;i<3;i++){const n=decodeURIComponent(v);if(n===v)break;v=n}return v}
onLoad((q:any)=>query.value={draftKey:decode(q?.draftKey||''),field:decode(q?.field||''),index:Number(q?.index||0)});
</script>
<template><Page v-if="query" :draft-key="query.draftKey" :field="query.field" :index="query.index"/></template>
