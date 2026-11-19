<script setup lang="ts">
import {ref,computed} from 'vue';
import { serviceSpecFields, serviceWayFields } from '@core/service/display.js';
import {onShow} from '@dcloudio/uni-app';
import {service} from '@/services/foundation';
import AppPage from '../ui/components/AppPage.vue';
import AppNavbar from '../ui/components/AppNavbar.vue';
import AppButton from '../ui/components/AppButton.vue';
import FieldGroup from './FieldGroup.vue';
import {showFormError} from '../ui/formFeedback';
import {serviceText} from './presentation';
const props=defineProps<{draftKey:string;index:number}>();
const form=ref<any>(null), parent=ref<any>(null), options=ref<any>({}),errors=ref<any>({}),error=ref(''),saving=ref(false);
const activeMethod=ref(''), parked=ref<Record<string,any>>({});
const activeCombo=computed(()=>form.value?.['组合集合']?.find((c:any)=>c._method===activeMethod.value));
const methods=computed(()=>{const c=options.value.categories?.find((c:any)=>c._id===parent.value?.data?.['所属服务类目']);return(options.value.methods||[]).filter((m:any)=>m['方式状态']==='启用'&&(c?.['允许履约方式']||[]).some((v:string)=>v===m._id||v===m['履约方式名称']))});
onShow(async()=>{if(form.value)return;try{options.value=await service.service.options();parent.value=await service.draft(props.draftKey);if(!parent.value?.data)throw Error('请从供给编辑页重新打开规格');form.value=JSON.parse(JSON.stringify(parent.value.data['服务规格集合']?.[props.index]||{规格编号:'SPEC-'+Date.now(),规格名称:'',规格说明:'',服务对象填写要求:'选填',组合集合:[]}))}catch(e:any){error.value=e.message}if (form.value) {
  form.value['规格启用状态'] = '启用';
  form.value['组合集合'] = (form.value['组合集合'] || []).filter((combo:any) => combo['组合启用状态'] !== '停用');
}activeMethod.value=form.value?.['组合集合']?.[0]?._method||''});
function selected(id:string){return form.value?.['组合集合']?.some((c:any)=>c._method===id)}
function toggle(m:any){const all=form.value['组合集合']||[];if(selected(m._id)){parked.value[m._id]=all.find((c:any)=>c._method===m._id);form.value={...form.value,组合集合:all.filter((c:any)=>c._method!==m._id)};if(activeMethod.value===m._id)activeMethod.value=form.value['组合集合'][0]?._method||''}else{form.value={...form.value,组合集合:[...all,parked.value[m._id]||{_method:m._id,组合履约方式名称:m['履约方式名称'],组合流程模板:m['绑定流程模板'],组合固定价格:'',组合启用状态:'启用',完成证据要求:'可选图片',上门覆盖社区:[],上门覆盖小区:[],可服务门店或服务点:[]}]};activeMethod.value=m._id}}
function setCombo(i:number,value:any){form.value={...form.value,组合集合:form.value['组合集合'].map((c:any,j:number)=>i===j?value:c)}}
function comboError(c:any,message:string,field:string){activeMethod.value=c._method;throw {message,fields:{[field]:message}}}
async function save(){if(saving.value)return;saving.value=true;errors.value={};try{
 for(const n of ['规格名称','规格说明','服务对象填写要求']) if(!String(form.value[n]||'').trim())throw {message:'请填写'+n,fields:{[n]:'必填'}};
 if(!form.value['组合集合'].length)throw Error('请至少选择一种服务方式');
 for(const c of form.value['组合集合']){if(!/^\d+(\.\d{1,2})?$/.test(String(c['组合固定价格']))||Number(c['组合固定价格'])<=0)comboError(c,'请输入大于零、最多两位小数的金额','组合固定价格');if(c._method==='HOME'&&!c['上门覆盖小区']?.length)comboError(c,'请选择上门覆盖小区','上门覆盖小区');if(c._method==='POINT'&&!c['可服务门店或服务点']?.length)comboError(c,'请选择可服务门店或服务点','可服务门店或服务点')}
 const latest=await service.draft(props.draftKey);if(!latest?.data)throw Error('供给草稿已不可用，请返回重新打开');const specs=[...(latest.data['服务规格集合']||[])];specs[props.index]=form.value;await service.draft(props.draftKey,{...latest,data:{...latest.data,服务规格集合:specs}});uni.navigateBack({fail:()=>uni.redirectTo({url:'/pages/service/supply'})});
 }catch(e:any){errors.value=e.fields||{};await showFormError(e)}finally{saving.value=false}}
</script>
<template><AppPage secondary with-bottom-action><template #navbar><AppNavbar title="服务规格" show-back/></template><view class="spec-page"><text v-if="error" class="error">{{error}}</text><template v-if="form"><view class="spec-section"><text class="heading">规格信息</text><FieldGroup :tables="['27-D']" :only="serviceSpecFields" :value="form" :options="options" :errors="errors" action="service.save" editable @input="form=$event"/></view><view class="spec-section"><text class="heading">服务方式与报价 <text class="error">*</text></text><view class="method-cards"><view v-for="m in methods" :key="m._id" class="method-card" :class="{selected:selected(m._id),active:activeMethod===m._id}" :data-method="m._id"><checkbox-group @change="toggle(m)"><label class="method-check"><checkbox :value="m._id" :checked="selected(m._id)" color="#1b4d53"/></label></checkbox-group><button @click="activeMethod=m._id">{{serviceText(m.label)}}</button></view></view><text v-if="activeMethod&&!activeCombo" class="hint">勾选此方式后可编辑报价</text><view v-for="(c,i) in form['组合集合']" :key="c._method" v-show="activeMethod===c._method" class="price-section"><text class="heading">{{serviceText(c['组合履约方式名称'])}}</text><FieldGroup :tables="['27-D']" :only="serviceWayFields" :value="c" :options="options" :errors="errors" action="service.save" editable @input="setCombo(i,$event)"/></view></view><view class="bottom-actions"><AppButton :loading="saving" @click="save">保存规格</AppButton></view></template></view></AppPage></template>
<style scoped lang="scss">.spec-page{padding:16px 16px 100px}.spec-section{background:#fff;border-radius:14px;padding:16px;margin-bottom:14px}.heading{display:block;font-size:16px;font-weight:600}.hint{display:block;font-size:13px;color:#7b8688;margin:8px 0}.error{color:$color-error}.method-cards{display:flex;gap:12px;margin:14px 0}.method-cards button{flex:1;font-size:15px;line-height:52px;background:#f5f7f8}.method-cards .selected{background:#e7f1ef;color:$color-primary;border:1px solid $color-primary}.method-cards button::after{border:0}.price-section{margin-top:18px;padding-top:16px;border-top:1px solid #edf0f2}.bottom-actions{position:fixed;bottom:0;left:0;right:0;background:#fff;padding:12px 16px calc(12px + env(safe-area-inset-bottom));z-index:8}.spec-page{padding:12px 12px 100px}.spec-section{padding:12px;margin-bottom:12px}.method-cards{gap:8px;margin:10px 0}.method-card{display:flex;align-items:center;flex:1;min-width:0;border:1px solid #e9edf1;border-radius:8px}.method-card button{padding:0 4px;background:transparent;line-height:44px;font-size:14px}.method-card.active{box-shadow:inset 0 -2px #1b4d53}.method-check{display:flex;align-items:center;justify-content:center;min-width:44px;height:44px}.method-check checkbox{transform:scale(.8)}.price-section{margin-top:10px;padding-top:10px}</style>
