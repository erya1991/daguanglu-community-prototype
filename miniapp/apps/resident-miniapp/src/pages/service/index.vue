<script setup lang="ts">
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import PortalPage from '@/_shared/portal/PortalPage.vue'
const status=ref('')
onLoad((q:any)=>{try{status.value=decodeURIComponent(q?.status||'')}catch{status.value=''}})
</script>
<template><PortalPage mode="service" :initial-status="status"/></template>
