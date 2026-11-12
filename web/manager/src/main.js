import 'core-js/stable'
import Vue from 'vue'
import ViewUI from 'view-design'
import VueRouter from 'vue-router'
import Vuex from 'vuex'
import './styles/theme.less'
import './styles/stage00.scss'
import './styles/stage01.scss'
import App from './App.vue'
import { service } from './services/foundation'
Vue.use(ViewUI)
Vue.use(VueRouter)
Vue.use(Vuex)
Vue.config.productionTip = false
const router = new VueRouter({
  mode: 'hash',
  routes: [
    { path: '/statistics', redirect: '/spaces' },
    { path: '/relations', redirect: to => ({ path: '/applications', query: { ...to.query, tab: 'bindings', relation: to.query.id || '' } }) },
    ...['orgs', 'accounts', 'roles'].map(table => ({ path: '/' + table, redirect: '/dashboard' })),
    { path: '/messages', beforeEnter: async (to, from, next) => {
      try { if(to.query.id) { const message=await service.record('messages',to.query.id); if(message._table && message._object) { const spatial=['communities','estates','buildings','units','houses'].includes(message._table); return next(spatial ? {path:'/spaces',query:{node:message._table+':'+message._object}} : {path:'/'+(message._table==='relations'?'applications':message._table),query:message._table==='relations'?{tab:'bindings',id:message._object}:{id:message._object}}) } } } catch {}
      next('/dashboard')
    } },
    { path: '/spaces', name: 'spaces', component: () => import('./views/SpaceArchive.vue') },
    ...['communities', 'estates', 'buildings', 'units', 'houses'].map(table => ({ path: '/' + table, redirect: to => ({ name: 'spaces', query: { node: to.query.id ? table + ':' + to.query.id : to.query.node || 'root' } }) })),
    { path: '/property/bills', component: () => import('./views/stage01/Bills.vue'), meta:{stage01:true,title:'物业费账单'} },
    { path: '/property/bills/import', component: () => import('./views/stage01/BillImport.vue'), meta:{stage01:true,title:'导入物业账单'} },
    { path: '/property/payments', component: () => import('./views/stage01/Payments.vue'), meta:{stage01:true,title:'缴费记录'} },
    { path: '/parking/business', component: () => import('./views/stage01/Parking.vue'), meta:{stage01:true,title:'停车业务'} },
    { path: '/parking/checks', redirect: to=>({path:'/parking/business',query:{tab:'checks',detail:to.query.id?'checks':undefined,id:to.query.id}}) },
    { path: '/workorders/events', redirect: to=>({path:'/workorders/tasks',query:{legacyEvent:to.query.id}}) },
    { path: '/workorders/tasks', component: () => import('./views/stage01/Workorders.vue'), meta:{stage01:true,title:'工单办理'} },
    { path: '/workorders/overview', redirect: '/workorders/tasks' },
    { path: '/workorders/repairs', redirect: to => ({path:'/workorders/tasks',query:to.query.id ? {legacyReport:to.query.id} : {}}) },
    { path: '/workorders/hazards', redirect: to => ({ path: '/workorders/tasks', query: to.query }) },
    { path: '/service/qualifications', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'qualifications'}, meta:{service:true,title:'商户服务经营资格'} },
    { path: '/service/personnel', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'personnel'}, meta:{service:true,title:'商户服务人员'} },
    { path: '/service/categories', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'categories'}, meta:{service:true,title:'服务分类'} },
    { path: '/service/review', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'services'}, meta:{service:true,title:'服务审核'} },
    { path: '/service/orders', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'orders'}, meta:{service:true,title:'服务订单'} },
    { path: '/service/aftersales', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'aftersales'}, meta:{service:true,title:'服务售后'} },
    { path: '/service/evaluations', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'evaluations'}, meta:{service:true,title:'服务评价'} },
    { path: '/service/overview', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'overview'}, meta:{service:true,title:'服务经营'} },
    { path: '/service/funds', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'funds'}, meta:{service:true,title:'服务资金'} },
    { path: '/service/exceptions', component: () => import('./views/service/ServiceWorkspace.vue'), props: {table:'exceptions'}, meta:{service:true,title:'资金异常核查'} },
    { path: '/:table?', component: () => import('./views/Workspace.vue') },
  ],
})
const store = new Vuex.Store({
  state: { identityGeneration: 0 },
  mutations: {
    identityChanged(s) {
      s.identityGeneration++
    },
  },
})
new Vue({ router, store, render: (h) => h(App) }).$mount('#app')
