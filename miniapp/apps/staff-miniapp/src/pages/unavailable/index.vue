<script setup lang="ts">
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import AppPage from '@/_shared/ui/components/AppPage.vue'
import AppNavbar from '@/_shared/ui/components/AppNavbar.vue'
import AppIcon from '@/_shared/ui/components/AppIcon.vue'
const title=ref('功能未开放')
onLoad((q:any)=>{try{title.value=decodeURIComponent(q?.feature||'功能未开放')}catch{}})
</script>
<template><AppPage secondary><template #navbar><AppNavbar :title="title" show-back/></template><view class="unavailable-page"><AppIcon name="services" :size="56"/><text>{{title}}</text><text class="unavailable-page__hint">功能开发中，敬请期待</text></view></AppPage></template>
<style scoped lang="scss">.unavailable-page{min-height:65vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:32px 16px;color:$color-primary;font-size:24px;font-weight:600}.unavailable-page__hint{font-size:15px;color:$color-text-secondary;font-weight:400}</style>
