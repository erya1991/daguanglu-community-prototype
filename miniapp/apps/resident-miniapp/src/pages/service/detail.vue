<script setup lang="ts">
defineOptions({inheritAttrs:false})
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import Page from '@/_shared/service/ServicePage.vue'
const query=ref<any>({})
function decode(v:any){if(typeof v!=='string')return v;for(let i=0;i<3;i++){try{const n=decodeURIComponent(v);if(n===v)break;v=n}catch{break}}return v}
onLoad((q:any)=>query.value=Object.fromEntries(Object.entries(q||{}).map(([k,v])=>[k,decode(v)])))
</script>
<template><Page mode="detail" :table="query.table||'services'" :id="query.id||''" :action="query.action||''" :spec="query.spec||''" :method="query.method||''" :section="query.section||''"/></template>