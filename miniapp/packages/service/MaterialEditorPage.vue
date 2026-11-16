<script setup lang="ts">
import {ref} from 'vue';
import {onShow} from '@dcloudio/uni-app';
import {service} from '@/services/foundation';
import AppPage from '../ui/components/AppPage.vue';
import AppNavbar from '../ui/components/AppNavbar.vue';
import AppButton from '../ui/components/AppButton.vue';
import FieldGroup from './FieldGroup.vue';
import {showFormError} from '../ui/formFeedback';
const props=defineProps<{draftKey:string;field:string;index:number}>();
const form=ref<any>(null),options=ref<any>({}),errors=ref<any>({}),error=ref(''),saving=ref(false);
const action=props.field==='服务资质材料'?'qualification.save':'personnel.save';
onShow(async()=>{if(form.value)return;try{if(!['服务资质材料','人员资质材料'].includes(props.field))throw Error('请从资料编辑页打开');options.value=await service.service.options();const parent=await service.draft(props.draftKey);if(!parent?.data)throw Error('请返回资料页重新打开');form.value=JSON.parse(JSON.stringify(parent.data[props.field]?.[props.index]||{材料名称:'',证明文件:[],长期有效:false,对应服务类目:[]}))}catch(e:any){error.value=e.message}});
async function save(){if(saving.value)return;saving.value=true;try{if(!String(form.value['材料名称']||'').trim())throw {message:'请填写材料名称',fields:{材料名称:'必填'}};const parent=await service.draft(props.draftKey);if(!parent?.data)throw Error('资料草稿已不可用，请返回重新打开');const items=[...(parent.data[props.field]||[])];items[props.index]=form.value;await service.draft(props.draftKey,{...parent,data:{...parent.data,[props.field]:items}});uni.navigateBack()}catch(e:any){errors.value=e.fields||{};await showFormError(e)}finally{saving.value=false}}
</script>
<template><AppPage secondary with-bottom-action><template #navbar><AppNavbar title="证明材料" show-back/></template><view class="material-page"><text v-if="error" class="error">{{error}}</text><view v-if="form" class="material-form"><FieldGroup :tables="['26-D']" :only="['材料名称','对应服务类目','证明编号','证明文件','发证机构','生效日期','长期有效','有效截止日期']" :action="action" :value="form" :options="options" :errors="errors" editable @input="form=$event"/></view><view v-if="form" class="bottom-actions"><AppButton :loading="saving" @click="save">保存材料</AppButton></view></view></AppPage></template>
<style scoped lang="scss">.material-page{padding:16px 16px 100px}.material-form{background:#fff;border-radius:14px;padding:16px}.error{color:$color-error}.bottom-actions{position:fixed;bottom:0;left:0;right:0;background:#fff;padding:12px 16px calc(12px + env(safe-area-inset-bottom));z-index:8}</style>
