import 'core-js/stable'
import Vue from 'vue'
import ViewUI from 'view-design'
import VueRouter from 'vue-router'
import Vuex from 'vuex'
import './styles/theme.less'
import './styles/stage00.scss'
import './styles/stage01.scss'
import App from './App.vue'
Vue.use(ViewUI)
Vue.use(VueRouter)
Vue.use(Vuex)
Vue.config.productionTip = false
const router = new VueRouter({
  mode: 'hash',
  routes: [
    { path: '/spaces', name: 'spaces', component: () => import('./views/SpaceArchive.vue') },
    ...['communities', 'estates', 'buildings', 'units', 'houses'].map(table => ({ path: '/' + table, redirect: to => ({ name: 'spaces', query: { node: to.query.id ? table + ':' + to.query.id : to.query.node || 'root' } }) })),
    { path: '/property/bills', component: () => import('./views/stage01/Bills.vue'), meta:{stage01:true,title:'物业费账单'} },
    { path: '/property/bills/import', component: () => import('./views/stage01/BillImport.vue'), meta:{stage01:true,title:'导入物业账单'} },
    { path: '/property/payments', component: () => import('./views/stage01/Payments.vue'), meta:{stage01:true,title:'缴费记录与异常'} },
    { path: '/parking/business', component: () => import('./views/stage01/Parking.vue'), meta:{stage01:true,title:'停车业务'} },
    { path: '/parking/checks', component: () => import('./views/stage01/ParkingChecks.vue'), meta:{stage01:true,title:'停车核查'} },
    { path: '/workorders/events', component: () => import('./views/stage01/Events.vue'), meta:{stage01:true,title:'待核实事件'} },
    { path: '/workorders/tasks', component: () => import('./views/stage01/Workorders.vue'), meta:{stage01:true,title:'工单办理'} },
    { path: '/workorders/overview', component: () => import('./views/stage01/WorkorderOverview.vue'), meta:{stage01:true,title:'工单概况'} },
    { path: '/workorders/repairs', component: () => import('./views/stage01/Repairs.vue'), meta:{stage01:true,title:'报修与居民反馈'} },
    { path: '/workorders/hazards', component: () => import('./views/stage01/Hazards.vue'), meta:{stage01:true,title:'隐患台账'} },
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
