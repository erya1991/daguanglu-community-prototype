import 'core-js/stable'
import Vue from 'vue'
import ViewUI from 'view-design'
import VueRouter from 'vue-router'
import Vuex from 'vuex'
import './styles/theme.less'
import './styles/stage00.scss'
import App from './App.vue'
Vue.use(ViewUI)
Vue.use(VueRouter)
Vue.use(Vuex)
Vue.config.productionTip = false
const router = new VueRouter({
  mode: 'hash',
  routes: [{ path: '/:table?', component: () => import('./views/Workspace.vue') }],
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
