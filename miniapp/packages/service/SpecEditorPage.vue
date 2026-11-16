<script setup lang="ts">
import {ref,computed} from 'vue';
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
const methods=computed(()=>{const c=options.value.categories?.find((c:any)=>c._id===parent.value?.data?.['所属服务类目']);return(options.value.methods||[]).filter((m:any)=>m['方式状态']==='启用'&&(c?.['允许履约方式']||[]).some((v:string)=>v===m._id||v===m['履约方式名称']))});
onShow(async()=>{if(form.value)return;try{options.value=await service.service.options();parent.value=await service.draft(props.draftKey);if(!parent.value?.data)throw Error('请从供给编辑页重新打开规格');form.value=JSON.parse(JSON.stringify(parent.value.data['服务规格集合']?.[props.index]||{规格编号:'SPEC-'+Date.now(),规格名称:'',规格说明:'',包含内容:'',不包含内容:'',规格启用状态:'启用',服务对象填写要求:'选填',组合集合:[]}))}catch(e:any){error.value=e.message}});
function selected(id:string){return form.value?.['组合集合']?.some((c:any)=>c._method===id)}
function toggle(m:any){const all=form.value['组合集合']||[];form.value={...form.value,组合集合:selected(m._id)?all.filter((c:any)=>c._method!==m._id):[...all,{_method:m._id,组合履约方式名称:m['履约方式名称'],组合流程模板:m['绑定流程模板'],组合固定价格:'',组合启用状态:'启用',完成证据要求:'可选图片',上门覆盖社区:m._id==='HOME'?(options.value.approvedCommunities||[]).map((c:any)=>c.value):[],上门覆盖小区:[],可服务门店或服务点:[]}]}}
function setCombo(i:number,value:any){form.value={...form.value,组合集合:form.value['组合集合'].map((c:any,j:number)=>i===j?value:c)}}
async function save(){if(saving.value)return;saving.value=true;errors.value={};try{
 for(const n of ['规格名称','规格说明','包含内容','规格启用状态','服务对象填写要求',...(form.value['服务对象填写要求']==='必填'?['服务对象填写提示']:[])]) if(!String(form.value[n]||'').trim())throw {message:'请填写'+n,fields:{[n]:'必填'}};
 if(!form.value['组合集合'].length)throw Error('请至少选择一种服务方式');
 for(const c of form.value['组合集合']){if(!/^\d+(\.\d{1,2})?$/.test(String(c['组合固定价格']))||Number(c['组合固定价格'])<=0)throw {message:'请填写有效的组合固定价格',fields:{组合固定价格:'请输入大于零、最多两位小数的金额'}};if(c._method==='HOME'&&!c['上门覆盖社区']?.length)throw Error('请选择上门覆盖社区');if(c._method==='POINT'&&!c['可服务门店或服务点']?.length)throw Error('请选择可服务门店或服务点')}
 const latest=await service.draft(props.draftKey);if(!latest?.data)throw Error('供给草稿已不可用，请返回重新打开');const specs=[...(latest.data['服务规格集合']||[])];specs[props.index]=form.value;await service.draft(props.draftKey,{...latest,data:{...latest.data,服务规格集合:specs}});uni.navigateBack({fail:()=>uni.redirectTo({url:'/pages/service/supply'})});
 }catch(e:any){errors.value=e.fields||{};await showFormError(e)}finally{saving.value=false}}
</script>
<template><AppPage secondary with-bottom-action><template #navbar><AppNavbar title="服务规格" show-back/></template><view class="spec-page"><text v-if="error" class="error">{{error}}</text><template v-if="form"><view class="spec-section"><text class="heading">规格信息</text><FieldGroup :tables="['27-D']" :only="['规格名称','规格说明','包含内容','不包含内容','预计服务时长','服务对象填写要求','服务对象填写提示','规格启用状态']" :value="form" :options="options" :errors="errors" action="service.save" editable @input="form=$event"/></view><view class="spec-section"><text class="heading">服务方式与报价 <text class="error">*</text></text><text class="hint">可多选；取消选择即不提供该方式</text><view class="method-cards"><button v-for="m in methods" :key="m._id" :class="{selected:selected(m._id)}" :data-method="m._id" @click="toggle(m)">{{selected(m._id)?'✓ ':''}}{{serviceText(m.label)}}</button></view><view v-for="(c,i) in form['组合集合']" :key="c._method" class="price-section"><text class="heading">{{serviceText(c['组合履约方式名称'])}}</text><FieldGroup :tables="['27-D']" :only="['组合固定价格','组合启用状态','完成证据要求','上门覆盖社区','上门覆盖小区','可服务门店或服务点','方式说明','服务约定说明']" :value="c" :options="options" :errors="errors" action="service.save" editable @input="setCombo(i,$event)"/></view></view><view class="bottom-actions"><AppButton :loading="saving" @click="save">保存规格</AppButton></view></template></view></AppPage></template>
<style scoped lang="scss">.spec-page{padding:16px 16px 100px}.spec-section{background:#fff;border-radius:14px;padding:16px;margin-bottom:14px}.heading{display:block;font-size:16px;font-weight:600}.hint{display:block;font-size:13px;color:#7b8688;margin:8px 0}.error{color:$color-error}.method-cards{display:flex;gap:12px;margin:14px 0}.method-cards button{flex:1;font-size:15px;line-height:52px;background:#f5f7f8}.method-cards .selected{background:#e7f1ef;color:$color-primary;border:1px solid $color-primary}.method-cards button::after{border:0}.price-section{margin-top:18px;padding-top:16px;border-top:1px solid #edf0f2}.bottom-actions{position:fixed;bottom:0;left:0;right:0;background:#fff;padding:12px 16px calc(12px + env(safe-area-inset-bottom));z-index:8}</style>
