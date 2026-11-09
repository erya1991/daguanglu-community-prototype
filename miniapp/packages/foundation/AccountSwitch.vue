<script setup lang="ts">
import {ref} from 'vue'
import {service} from '@/services/foundation'
const props=defineProps<{info:any}>()
const emit=defineEmits<{changed:[]}>()
const error=ref(''), busy=ref(false)
async function change(event:any){if(busy.value)return;busy.value=true;error.value='';try{const account=props.info.accounts[Number(event.detail.value)];await service.identity(account.id,account.roles[0].id);emit('changed')}catch(e:any){error.value=e.message}finally{busy.value=false}}
</script>
<template><view v-if="info" class="account-switch"><picker v-if="info.accounts.length>1" :disabled="busy" :range="info.accounts" range-key="name" @change="change"><view class="control-row"><text>切换身份</text><text>{{info.actor.name}} ›</text></view></picker><view v-else class="control-row"><text>当前身份</text><text>{{info.actor.roleName}}</text></view><text v-if="error" class="form-error">{{error}}</text></view></template>
