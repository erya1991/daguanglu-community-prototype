<script setup lang="ts">
defineOptions({inheritAttrs:false})
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import PortalPage from '@/_shared/portal/PortalPage.vue'
const status=ref('')
onLoad((q:any)=>{let value=q?.status||'';for(let i=0;i<3;i++){try{const next=decodeURIComponent(value);if(next===value)break;value=next}catch{break}}status.value=value})
</script>
<template><PortalPage mode="order" :initial-status="status"/></template>
