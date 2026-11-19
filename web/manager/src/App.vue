<template>
  <div class="main" v-if="info">
    <aside class="sidebar-menu-con">
      <div class="logo-con">
        <span class="brand-icon">大</span><strong>大光路社区</strong><small>社区物业服务</small>
      </div>
      <Menu ref="propertyMenu" v-if="!identityChanging" theme="light" :active-name="table" :open-names="openGroups" width="200px" @on-select="navigate" @on-open-change="openGroups = $event">
        <Submenu name="property-management" class="property-menu-root">
          <template slot="title"><Icon type="ios-business-outline" />物业管理</template>
          <Submenu v-for="group in visibleGroups" :key="group.title" :name="group.title" class="property-menu-group">
            <template slot="title">{{ group.title }}</template>
            <MenuItem v-for="t in group.items" :key="t" :name="t">{{ menuTitle(t) }}</MenuItem>
          </Submenu>
          <Submenu v-if="['property','platform'].includes(info.actor.role)" name="物业服务" class="property-menu-group">
            <template slot="title">物业服务</template>
            <MenuItem v-for="entry in stage01Entries" :key="entry[0]" :name="entry[0]">{{entry[1]}}</MenuItem>
          </Submenu>
        </Submenu>
        <Submenu v-for="g in serviceMenuGroups" :key="'service-'+g.title" :name="g.title"><template slot="title">{{g.title}}</template><MenuItem v-for="entry in g.entries" :key="entry.path" :name="entry.path">{{entry.title}}</MenuItem></Submenu>
      </Menu>
    </aside>
    <header class="main-header-con">
      <div class="main-header">
        <div>
          <span class="header-title">{{ pageTitle }}</span>
        </div>
        <div class="header-right">
          <span>{{ info.actor.name }} · {{ roleName }}</span
          ><Dropdown trigger="click" placement="bottom-end" @on-click="chooseAccount"><Button :disabled="identityChanging" icon="ios-contact-outline">切换身份</Button><DropdownMenu slot="list"><DropdownItem v-for="account in info.accounts" :key="account.id" :name="account.id">{{account.name}}</DropdownItem></DropdownMenu></Dropdown>
        </div>
      </div>
      <div class="tags-con">
        <Breadcrumb
          ><BreadcrumbItem>物业管理</BreadcrumbItem><BreadcrumbItem>{{ activeGroup }}</BreadcrumbItem
          ><BreadcrumbItem>{{ pageTitle }}</BreadcrumbItem></Breadcrumb
        >
        <div class="header-context" v-if="!identityChanging && $route.meta.stage01 && $route.path !== '/property/bills'">
          <span class="scope-root">{{info.spaceRootName}}</span>
          <Select
            :value="context.estate || ''"
            clearable
            placeholder="全部小区"
            :data-field="$route.meta.stage01?'QF03':'demo:当前小区'"
            style="width: 180px"
            @on-change="changeEstate"
            ><Option v-for="e in scopeEstates" :key="e.value" :value="e.value">{{
              e.label
            }}</Option></Select
          >
        </div>
      </div>
    </header>
    <main class="single-page-con">
      <Spin v-if="identityChanging" size="large" />
      <router-view v-else :key="table + ':' + generation" :info="info" @refresh="refresh" />
    </main>
  </div>
  <div v-else class="startup">
    <h1>大光路社区</h1>
    <p v-if="error" class="error">{{ error }}</p>
    <Spin v-else size="large" /><Button @click="refresh">重新加载</Button
    ><Button @click="recover">返回首页</Button>
  </div>
</template>
<script>
import { service } from './services/foundation'
import { catalog } from '../../../prototype-shared/catalog.js'

const serviceCatalogGroup = '商品与服务运营'

export default {
  data: () => ({
    info: null,
    error: '',
    identityChanging: false,
    refreshTicket: 0,
    generation: 0,
    openGroups: [],
    scopes: { communities: [], estates: [] },
    scopeEstates: [],
    context: {},
    catalog,
    stage01Entries: [['property/bills','物业费账单'],['property/payments','缴费记录'],['parking/business','停车业务'],['workorders/tasks','工单办理']],


    groups: [
      { title: '工作台', items: ['dashboard'] },
      {
        title: '社区与房屋',
        items: ['spaces'],
      },
      { title: '居民与绑定', items: ['residents', 'applications', 'missing'] },
      { title: '基础资料', items: ['vehicles', 'facilities', 'personnel', 'files'] },

    ],
  }),
  computed: {
    serviceMenuGroups(){const role=this.info?.actor.role;const groups=[{title:'商户与合作管理',entries:[['qualifications','服务经营资格'],['personnel','服务人员']]},{title:serviceCatalogGroup,entries:[['categories','服务分类'],['review','服务审核']]},{title:'订单与履约管理',entries:[['orders','服务订单']]},{title:'售后与评价',entries:[['aftersales','服务售后'],['evaluations','服务评价']]}];return groups.map(g=>({...g,entries:g.entries.filter(e=>e[0]==='categories'?role==='platform':['platform','property'].includes(role)).map(e=>({path:'service/'+e[0],title:e[1]}))})).filter(g=>g.entries.length)},
    visibleGroups() {
      return this.groups.map(group => ({ ...group, items: group.items.filter(this.available) })).filter(group => group.items.length)
    },
    activeGroup() {
      return this.$route.meta.service ? this.serviceMenuGroups.find(g=>g.entries.some(e=>e.path===this.table))?.title || '便民服务' : this.$route.meta.stage01 ? '物业服务' : this.groups.find(group => group.items.includes(this.table))?.title || '工作台'
    },
    table() {
      if (this.$route.meta.service && ['/service/funds', '/service/exceptions'].includes(this.$route.path)) return 'service/orders'
      if(this.$route.meta.stage01 || this.$route.meta.service)return this.$route.path.slice(1)
      return this.$route.name === 'spaces' ? 'spaces' : this.$route.params.table || 'dashboard'
    },
    pageTitle() {
      if(this.$route.meta.stage01 || this.$route.meta.service)return this.$route.meta.title
      return this.table === 'spaces' ? '社区房屋档案' : this.catalog[this.table]?.title || '物业工作台'
    },
    currentAccount() {
      return this.info.accounts.find((a) => a.id === this.info.actor._id) || { roles: [] }
    },
    roleName() {
      return this.currentAccount.roles.find((r) => r.id === this.info.actor.role)?.name || this.info.actor.roleName
    },
    scopeText() {
      return this.info.actor.orgName + ' · ' + this.info.actor.scopeLabel
    },
  },
  watch: {
    openGroups() {
      this.$nextTick(() => this.$refs.propertyMenu?.updateOpened())
    },
    $route(to, from) {
      if (!this.info || this.identityChanging || to.path === from.path) return
      if (to.meta.service !== from.meta.service) {
        this.setDefaultOpenGroups()
        return
      }
      const ancestors = to.meta.service ? [this.activeGroup] : ['property-management', this.activeGroup]
      this.openGroups = [...new Set([...this.openGroups, ...ancestors])]
    },
    '$route.meta.stage01'() { if (this.info) this.refresh() },
  },
  async created() {
    this.unsubscribe = service.onChange(this.refresh)
    try {
      await service.start()
      await this.refresh()
    } catch (e) {
      this.error = e.message
    }
  },
  beforeDestroy() {
    this.unsubscribe?.()
  },
  methods: {
    setDefaultOpenGroups(group = this.activeGroup) {
      const serviceGroups = this.serviceMenuGroups.map(({ title }) => title)
      this.openGroups = serviceGroups.includes(group) || group === '便民服务'
        ? serviceGroups
        : ['property-management', group, ...serviceGroups.filter(title => title === serviceCatalogGroup)]
    },
    menuTitle(t) { return t === 'dashboard' ? '物业工作台' : t === 'spaces' ? '社区房屋档案' : catalog[t].title },
    available(t) {
      if (t === 'dashboard') return true
      if (t === 'spaces') return ['communities', 'estates', 'buildings', 'units', 'houses'].some(k => this.info.actor.menus.includes(k) && this.info.actor.permissions.includes('read:' + k))
      return this.info.actor.menus.includes(t) && this.info.actor.permissions.includes('read:' + t)
    },
    navigate(t) {
      if (t !== this.table) this.$router.push('/' + t)
    },
    async refresh(force = false) {
      if (this.identityChanging && !force) return
      const ticket = ++this.refreshTicket
      try {
        const next = await service.info()
        const scopes = await service.scopes()

        const estates = this.$route.meta.stage01 ? (await service.stage01.options()).estates : scopes.estates
        if (ticket !== this.refreshTicket) return
        if (
          this.info &&
          (this.info.actor._id !== next.actor._id || this.info.actor.role !== next.actor.role)
        ) {
          this.generation++
          this.$store.commit('identityChanged')
        }
        const firstLoad = !this.info
        this.info = next
        if (firstLoad) this.setDefaultOpenGroups()
        this.scopeEstates = estates
        this.scopes = scopes
        this.context = service.context()
        this.error = ''
      } catch (e) {
        if (ticket !== this.refreshTicket) return
        this.error = e.message
        this.info = null
      }
    },
    async chooseAccount(id) {
      const a = this.info.accounts.find(a => a.id === id)
      if (!a || !a.roles.length) return
      await this.switchIdentity(id, a.roles[0].id)
    },
    async chooseRole(role) {
      await this.switchIdentity(this.info.actor._id, role)
    },
    async switchIdentity(account, role) {
      if (this.identityChanging) return
      this.identityChanging = true
      this.refreshTicket++
      try {
        // Clear old business views before restoring the next account context.
        await this.$nextTick()
        await service.identity(account, role)
        this.generation++
        this.$store.commit('identityChanged')
        await this.refresh(true)
        this.setDefaultOpenGroups('工作台')
        this.navigate('dashboard')
      } catch (e) {
        this.$Message.error(e.message)
        await this.refresh(true)
      } finally {
        this.identityChanging = false
      }
    },
    async changeCommunity(c) {
      await service.scope(c || '', '')
      await this.refresh()
      this.generation++
    },
    async changeEstate(e) {
      await service.scope('', e || '')
      await this.refresh()
      this.generation++
    },
    async recover() {
      await service.identity('platform-admin', 'platform')
      await this.refresh()
    },
  },
}
</script>
