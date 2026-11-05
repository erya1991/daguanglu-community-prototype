<script setup lang="ts">
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import FoundationPage from '@/_shared/foundation/FoundationPage.vue'
const id=ref(''),kind=ref('绑定'),previous=ref('')
onLoad((q:any)=>{id.value=q?.id||'';kind.value=q?.kind||'绑定';previous.value=q?.previous||''})
</script>
<template><FoundationPage mode="detail" table="communities" :id="id" :kind="kind" :previous="previous"/></template>
