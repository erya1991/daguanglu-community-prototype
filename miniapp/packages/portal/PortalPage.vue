<script setup lang="ts">
import {computed,ref,onUnmounted} from 'vue'
import {onShow} from '@dcloudio/uni-app'
import {APP,service,navigation} from '@/services/foundation'
import AppPage from '../ui/components/AppPage.vue'
import AppNavbar from '../ui/components/AppNavbar.vue'
import AppTabbar from '../ui/components/AppTabbar.vue'
import AppIcon from '../ui/components/AppIcon.vue'
import BaseCard from '../ui/components/BaseCard.vue'
import AccountSwitch from '../foundation/AccountSwitch.vue'
import ServicePage from '../service/ServicePage.vue'
import Picture from '../service/Picture.vue'
import ModuleGrid from './ModuleGrid.vue'
import {moduleEntries,pickEntries} from './modules'
import {openPage} from '../common/utils/navigation'
const props=withDefaults(defineProps<{mode:string;initialStatus?:string}>(),{initialStatus:''})
const info=ref<any>(null),error=ref(''),loading=ref(true),search=ref(''),services=ref<any[]>([]),orders=ref<any[]>([]),bills=ref<any[]>([]),tasks=ref<any[]>([]),reports=ref<any[]>([]),qualifications=ref<any[]>([]),options=ref<any>({}),profile=ref<any>({}),avatar=ref(''),communityName=ref('')
let ticket=0
const api=()=> (service as any).service
const entries=computed(()=>moduleEntries(APP,info.value?.actor))
const pick=(ids:string[])=>pickEntries(entries.value,ids)
const title=computed(()=>({home:'大光路社区',service:'服务',profile:'我的',mall:'社区商城',workbench:'工作台',operation:'经营',order:'订单',archive:'档案'} as any)[props.mode]||'社区服务')
const activePath=computed(()=>navigation.find((n:any)=>n.mode===props.mode)?.path||'')
const residentGroups=['生活缴费','我的社区','物业服务','便民生活','邻里生活','购物消费']
const groups=computed(()=>residentGroups.map(name=>({name,items:entries.value.filter(e=>e.group===name&&e.title.includes(search.value.trim()))})))
const categories=computed(()=> (options.value.categories||[]).filter((c:any)=>!(options.value.categories||[]).some((child:any)=>child['上级类目']===c._id)).filter((c:any)=>c.label.includes(search.value.trim())).map((c:any)=>({id:'category-'+c._id,title:c.label,icon:/清洁|保洁|家政/.test(c.label)?'cleaning':/维修/.test(c.label)?'repair':'services',group:'便民生活',apps:['resident'],path:'/pages/service/catalog?category='+encodeURIComponent(c._id),available:true})))
const matchedServices=computed(()=>services.value.filter(s=>[s['服务名称'],s['服务简介'],s['经营店铺名称']].join(' ').includes(search.value.trim())))
const shop=computed(()=>options.value.merchants?.[0]?.label||info.value?.actor.orgName||'商户中心')
const actorName=computed(()=>profile.value._nickname||profile.value['居民姓名']||info.value?.actor.name||'')
const community=computed(()=>communityName.value||'大光路社区')
const progress=(r:any)=>r['业务进度']||r['当前业务进度']||r['订单业务进度']||r._status||''
const pendingOrders=computed(()=>orders.value.filter(r=>!['正常完成','未服务取消','部分履行终止','未支付关闭'].includes(progress(r))))
const residentMetrics=computed(()=>[
 {title:'待缴物业费',value:bills.value.filter(r=>Number(r._amount)>0&&!r._paymentPending).length,path:'/pages/stage01/fees/index'},
 {title:'服务进行中',value:pendingOrders.value.length,path:'/pages/service/orders'},
 {title:'工单处理中',value:reports.value.filter(r=>r._status!=='已完成').length,path:'/pages/stage01/repairs/index'}
])
const merchantMetrics=computed(()=>['待接单','待商家安排','待确认安排','预约已确认','待开始服务','服务中','待居民确认完成','售后处理中'].map(state=>({title:state,value:orders.value.filter(o=>progress(o)===state).length,path:'/pages/order/index?status='+encodeURIComponent(state)})))
const staffMetrics=computed(()=>['待派单','待处理','处理中','待确认','待评价'].map(state=>({title:state,value:tasks.value.filter(t=>t._status===state).length,path:'/pages/stage01/tasks/index?status='+encodeURIComponent(state)})))
const pendingTasks=computed(()=>tasks.value.filter(t=>t._status!=='已完成'))
const staffArchives=computed(()=>entries.value.filter(e=>e.group==='授权档案'&&e.title.includes(search.value.trim())))
function price(s:any){const values=(s['服务规格集合']||[]).filter((v:any)=>v['规格启用状态']!=='停用').flatMap((v:any)=>v['组合集合']||[]).filter((c:any)=>c['组合启用状态']!=='停用').map((c:any)=>Number(c['组合固定价格'])).filter(Number.isFinite);return values.length?'¥'+Math.min(...values).toFixed(2)+'起':'查看服务'}
function serviceDetail(s:any){openPage('/pages/service/detail?id='+encodeURIComponent(s._id))}
function orderDetail(o:any){openPage('/pages/service/order?id='+encodeURIComponent(o._id))}
function taskDetail(t:any){openPage('/pages/stage01/tasks/detail?table=workorders&id='+encodeURIComponent(t._id))}
function releaseAvatar(){
 // #ifdef H5
 if(avatar.value.startsWith('blob:'))URL.revokeObjectURL(avatar.value)
 // #endif
 avatar.value=''
}
async function load(){const current=++ticket;loading.value=true;error.value='';try{
 const next=await service.start();if(current!==ticket)return;info.value=next
 const scopes=await service.scopes();if(current!==ticket)return;communityName.value=scopes.communities.map((c:any)=>c.label).join('、')
 if(APP==='resident'){
 const [o,sv,od,bl,rp,me,relations]=await Promise.all([api().options(),api().query('services'),api().query('orders'),service.stage01.query('bills'),service.stage01.query('reports'),service.query('residents'),service.query('relations')]);if(current!==ticket)return
 options.value=o;services.value=sv;orders.value=od;bills.value=bl;reports.value=rp;profile.value=me[0]||{};releaseAvatar()
 const boundCommunities=new Set(relations.filter((r:any)=>r['关系状态']==='有效').map((r:any)=>r._community));communityName.value=(o.communities||[]).filter((c:any)=>boundCommunities.has(c.value)).map((c:any)=>c.label).join('、')
 if(profile.value._avatar){const f=await service.ownedAttachment(profile.value._avatar);if(current!==ticket)return
 // #ifdef H5
 avatar.value=URL.createObjectURL(f.blob)
 // #endif
 // #ifdef MP-WEIXIN
 avatar.value=f.path
 // #endif
 }
 }else if(APP==='merchant'){
 const [o,sv,od,q,accounts]=await Promise.all([api().options(),api().query('services'),api().query('orders'),api().query('qualifications'),api().accounts()]);if(current!==ticket)return
 options.value=o;services.value=sv;orders.value=od;qualifications.value=q;info.value={...next,accounts:accounts.filter((a:any)=>a.roles.some((r:any)=>r.id==='merchant'))}
 }else {const ts=await service.stage01.query('workorders');if(current!==ticket)return;tasks.value=ts}
 }catch(e:any){if(current===ticket)error.value=e.message||'暂时无法读取，请重试'}finally{if(current===ticket)loading.value=false}}
onShow(load)
const unsubscribe=service.onChange(()=>{if(info.value)load()})
onUnmounted(()=>{ticket++;unsubscribe();releaseAvatar()})
</script>
<template>
 <AppPage :status="loading&&!info?'loading':'ready'" @retry="load"><template #navbar><AppNavbar :title="title" :show-brand="mode==='home'" :show-user="['home','workbench'].includes(mode)" /></template>
 <view class="portal" :data-app="APP" :data-page="mode">
  <view v-if="error" class="portal-error"><text>{{error}}</text><button @click="load">重新读取</button></view>
  <template v-if="APP==='resident'&&mode==='home'">
   <view class="location"><AppIcon name="location" :size="16"/><text>{{community}}</text></view>
   <view class="community-hero"><image src="/static/images/home/hero-community-life.png" mode="aspectFill"/><view class="hero-shade"/><view class="hero-copy"><text class="hero-kicker">大光路 · 社区生活</text><text class="hero-title">邻里相伴，生活更安心</text><text class="hero-subtitle">家门口的服务，就在身边</text></view></view>
   <BaseCard><ModuleGrid :items="pick(['fees','parking','repair','houses','vehicles','catalog','all'])"/></BaseCard>
   <view class="section-heading"><text>便民生活服务</text><button @click="openPage('/pages/service/catalog')">全部服务 <AppIcon name="chevron-right" :size="14"/></button></view>
   <scroll-view v-if="services.length" scroll-x class="service-strip"><view class="service-strip-inner"><view v-for="s in services.slice(0,6)" :key="s._id" class="featured-service" @click="serviceDetail(s)"><Picture :value="s['服务主图']" table="services" :record-id="s._id"/><view class="featured-copy"><text class="card-title">{{s['服务名称']}}</text><text class="meta">{{s['经营店铺名称']}}</text><text class="money">{{price(s)}}</text></view></view></view></scroll-view><BaseCard v-else><text class="meta">暂无可预约服务，稍后再来看看。</text></BaseCard>
   <template v-if="residentMetrics.some(m=>m.value)"><view class="section-heading"><text>与我有关</text></view><view class="metrics"><button v-for="m in residentMetrics" :key="m.title" @click="openPage(m.path)"><text class="metric-number">{{m.value}}</text><text>{{m.title}}</text></button></view></template>
  </template>
  <template v-else-if="APP==='resident'&&mode==='service'">
   <view class="page-intro"><text class="page-title">社区服务</text><text class="meta">日常所需，一站找到</text></view><view class="portal-search"><AppIcon name="search" :size="19"/><input v-model="search" placeholder="搜索功能或生活服务" :maxlength="-1"/></view>
   <template v-for="g in groups" :key="g.name"><BaseCard v-if="g.items.length||(g.name==='便民生活'&&categories.length)"><view class="section-heading"><text>{{g.name}}</text></view><ModuleGrid :items="g.name==='便民生活'?[...categories,...g.items.map(e=>e.id==='catalog'?{...e,title:'全部生活服务'}:e)]:g.items" compact/></BaseCard></template>
   <BaseCard v-if="search&&matchedServices.length"><view class="section-heading"><text>匹配的生活服务</text></view><button v-for="s in matchedServices" :key="s._id" class="plain-row" @click="serviceDetail(s)"><text>{{s['服务名称']}}</text><text class="money">{{price(s)}}</text></button></BaseCard><text v-if="search&&!groups.some(g=>g.items.length)&&!categories.length&&!matchedServices.length" class="empty-copy">没有匹配的功能或服务</text>
  </template>
  <template v-else-if="mode==='mall'"><view class="unavailable"><view class="unavailable-icon"><AppIcon name="bag" :size="56"/></view><text class="page-title">社区商城</text><text class="meta">功能开发中，敬请期待</text><text class="meta">社区日常服务可前往服务页查看</text><button class="portal-primary" @click="openPage('/pages/service/index')">查看社区服务</button></view></template>
  <template v-else-if="mode==='profile'">
   <BaseCard class="identity-card"><view class="identity-main" @click="APP==='resident'&&openPage('/pages/profile/edit')"><view class="identity-avatar"><image v-if="avatar" :src="avatar" mode="aspectFill"/><AppIcon v-else name="user" :size="32"/></view><view class="identity-copy"><text class="identity-name">{{actorName}}</text><text class="meta">{{info?.actor.roleName}} · {{APP==='merchant'?shop:community}}</text><text v-if="profile['联系电话']" class="meta">{{profile['联系电话']}}</text></view><AppIcon v-if="APP==='resident'" name="chevron-right" :size="18"/></view><AccountSwitch v-if="info" :info="info" @changed="load"/></BaseCard>
   <template v-if="APP==='resident'"><BaseCard><view class="section-heading"><text>我的服务订单</text><button @click="openPage('/pages/service/orders')">全部订单 ›</button></view><view class="order-summary"><text class="metric-number">{{pendingOrders.length}}</text><text class="meta">进行中的服务</text><button class="portal-primary" @click="openPage('/pages/service/orders')">预约与服务进度</button></view></BaseCard><BaseCard><view class="section-heading"><text>我的社区</text></view><ModuleGrid :items="pick(['houses','binding','vehicles','fees','parking','applications'])" compact/></BaseCard><BaseCard><view class="section-heading"><text>我的记录</text></view><ModuleGrid :items="pick(['repair','payments','records'])" compact/></BaseCard><BaseCard><view class="section-heading"><text>更多</text></view><ModuleGrid :items="pick(['profile-edit','missing','points','messages'])" compact/></BaseCard></template>
   <template v-else-if="APP==='merchant'"><BaseCard><view class="section-heading"><text>商户资料与资金</text></view><ModuleGrid :items="pick(['qualification','funds','personnel','messages'])"/></BaseCard><BaseCard><view class="section-heading"><text>商城经营</text></view><ModuleGrid :items="pick(['goods-settings','goods'])"/></BaseCard></template>
   <template v-else><BaseCard><view class="section-heading"><text>工作记录</text></view><ModuleGrid :items="pick(['tasks','charges','messages'])"/></BaseCard><BaseCard><text class="card-title">所属组织</text><text class="meta">{{info?.actor.orgName}}</text><text class="meta">{{info?.actor.scopeLabel}}</text></BaseCard></template>
  </template>
  <template v-else-if="APP==='merchant'&&mode==='workbench'">
   <view class="business-hero"><text class="hero-kicker">生活服务经营</text><text class="hero-title">{{shop}}</text><view class="hero-bottom"><text>{{qualifications[0]?.['服务经营有效性']||'查看经营资格'}}</text><button @click="openPage('/pages/service/qualification')">经营资格 ›</button></view></view>
   <view class="section-heading"><text>订单进度与待办</text><button @click="openPage('/pages/order/index')">全部订单 ›</button></view><view class="metrics metrics--merchant"><button v-for="m in merchantMetrics" :key="m.title" @click="openPage(m.path)"><text class="metric-number">{{m.value}}</text><text>{{m.title}}</text></button></view>
   <BaseCard><ModuleGrid :items="pick(['supply','verify','personnel','aftersales'])"/></BaseCard>
   <view class="section-heading"><text>进行中的服务</text></view><view v-if="!pendingOrders.length" class="empty-copy">暂无进行中的服务订单</view><button v-for="o in pendingOrders.slice(0,4)" :key="o._id" class="business-row" @click="orderDetail(o)"><view><text class="card-title">{{o['服务项目名称']||o['服务名称']}}</text><text class="meta">{{o['服务订单号']||o._id}}</text></view><text class="status-tag">{{progress(o)}}</text></button>
  </template>
  <template v-else-if="APP==='merchant'&&mode==='operation'"><view class="page-intro"><text class="page-title">服务经营</text><text class="meta">维护服务供给，管理人员与服务质量</text></view><BaseCard><ModuleGrid :items="pick(['supply','personnel','evaluations','overview'])"/></BaseCard><ServicePage mode="supply" embedded/><BaseCard><view class="section-heading"><text>商城经营</text></view><ModuleGrid :items="pick(['goods'])" compact/></BaseCard></template>
  <template v-else-if="APP==='merchant'&&mode==='order'"><view class="section-heading"><text>服务订单</text><button @click="openPage('/pages/service/aftersales')">售后处理 ›</button></view><ServicePage mode="orders" embedded :initial-status="initialStatus"/></template>
  <template v-else-if="APP==='staff'&&mode==='workbench'"><view class="business-hero"><text class="hero-kicker">物业服务</text><text class="hero-title">{{info?.actor.name}}，工作顺利</text><text class="hero-subtitle">{{info?.actor.orgName}}</text></view><view class="section-heading"><text>工单进度</text></view><view class="metrics"><button v-for="m in staffMetrics" :key="m.title" @click="openPage(m.path)"><text class="metric-number">{{m.value}}</text><text>{{m.title}}</text></button></view><BaseCard><ModuleGrid :items="pick(['tasks','report','charges'])"/></BaseCard><view class="section-heading"><text>待办事项</text><button @click="openPage('/pages/stage01/tasks/index')">全部工单 ›</button></view><text v-if="!pendingTasks.length" class="empty-copy">当前暂无待办工单</text><button v-for="t in pendingTasks.slice(0,5)" :key="t._id" class="business-row" @click="taskDetail(t)"><view><text class="card-title">{{t._title}}</text><text class="meta">{{t._subtitle}}</text></view><text class="status-tag">{{t._status}}</text></button></template>
  <template v-else-if="APP==='staff'&&mode==='archive'"><view class="page-intro"><text class="page-title">基础档案</text><text class="meta">查询当前授权范围内的社区与物业档案</text></view><view class="portal-search"><AppIcon name="search" :size="19"/><input v-model="search" placeholder="搜索档案类别"/></view><BaseCard><ModuleGrid :items="staffArchives"/></BaseCard><text v-if="!staffArchives.length" class="empty-copy">没有匹配或可访问的档案</text></template>
  <text class="portal-footer">大光路智慧社区 · 让生活更便利</text>
 </view><template #tabbar><AppTabbar :items="navigation" :active-path="activePath"/></template></AppPage>
</template>
<style scoped lang="scss">
@import './portal.scss';
</style>
