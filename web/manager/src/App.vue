<template>
  <div class="main" v-if="info">
    <aside class="sidebar-menu-con">
      <div class="logo-con">
        <span class="brand-icon">大</span><strong>大光路社区</strong><small>基础管理 · Stage00</small>
      </div>
      <Menu theme="light" :active-name="table" width="200px" @on-select="navigate">
        <MenuItem name="dashboard"><Icon type="ios-apps-outline" />基础工作台</MenuItem>
        <MenuGroup v-for="group in groups" :key="group.title" :title="group.title"
          ><MenuItem v-for="t in group.items.filter(available)" :key="t" :name="t">{{
            catalog[t].title
          }}</MenuItem></MenuGroup
        >
        <MenuItem name="messages">结果消息 <Badge :count="info.counts['未读结果消息数']" /></MenuItem>
      </Menu>
    </aside>
    <header class="main-header-con">
      <div class="main-header">
        <div>
          <Tag color="warning" data-field="demo:演示模式标识">演示模式 · 虚构数据</Tag
          ><span class="header-title">{{ pageTitle }}</span>
        </div>
        <div class="header-right">
          <span>{{ info.actor.name }} · {{ roleName }}</span
          ><Button @click="control = true" icon="ios-options-outline">演示控制</Button>
        </div>
      </div>
      <div class="tags-con">
        <Breadcrumb
          ><BreadcrumbItem>基础管理</BreadcrumbItem
          ><BreadcrumbItem>{{ pageTitle }}</BreadcrumbItem></Breadcrumb
        >
        <div class="header-context">
          <Select
            :value="context.community || ''"
            clearable
            placeholder="当前社区：全部获准"
            data-field="demo:当前社区"
            style="width: 180px"
            @on-change="changeCommunity"
            ><Option v-for="c in scopes.communities" :key="c.value" :value="c.value">{{
              c.label
            }}</Option></Select
          ><Select
            :value="context.estate || ''"
            clearable
            placeholder="当前小区：全部获准"
            data-field="demo:当前小区"
            style="width: 180px"
            @on-change="changeEstate"
            ><Option v-for="e in scopes.estates" :key="e.value" :value="e.value">{{
              e.label
            }}</Option></Select
          ><span>会话 {{ info.session }}</span>
        </div>
      </div>
    </header>
    <main class="single-page-con">
      <router-view :key="table + ':' + generation" :info="info" @refresh="refresh" />
    </main>
    <Modal v-model="control" title="演示控制（非生产授权）" :footer-hide="true" width="620">
      <Alert show-icon>仅切换固定虚构身份；四端共享当前会话业务，各端身份分别保存。</Alert>
      <Form label-position="top"
        ><FormItem data-field="demo:当前演示账号" label="当前演示账号"
          ><Select :value="info.actor._id" @on-change="chooseAccount"
            ><Option v-for="a in info.accounts" :key="a.id" :value="a.id"
              >{{ a.name }}（{{ a.id }}）</Option
            ></Select
          ></FormItem
        >
        <FormItem data-field="demo:当前业务角色" label="当前业务角色"
          ><Select :value="info.actor.role" @on-change="chooseRole"
            ><Option v-for="r in currentAccount.roles" :key="r.id" :value="r.id">{{ r.name }}</Option></Select
          ></FormItem
        >
        <FormItem label="当前所属组织与可见数据范围"
          ><p data-field="demo:当前所属组织">{{ info.actor.orgName }}</p>
          <p data-field="demo:可见数据范围">{{ info.actor.scopeLabel }}</p>
          <p>会话：{{ info.session }}；种子：{{ info.version }}；复位代次：{{ info.generation }}</p></FormItem
        > </Form
      ><Alert data-field="demo:数据复位说明" type="warning"
        >复位仅清除本原型当前会话的修改和本地附件，恢复虚构种子。其他会话和商城不受影响。</Alert
      ><Button type="error" ghost @click="reset">复位当前会话</Button>
    </Modal>
  </div>
  <div v-else class="startup">
    <h1>大光路社区原型</h1>
    <p v-if="error" class="error">{{ error }}</p>
    <Spin v-else size="large" /><Button @click="refresh">重新读取演示数据</Button
    ><Button @click="recover">恢复默认演示身份</Button>
  </div>
</template>
<script>
import { service } from './services/foundation'
import { catalog } from '../../../prototype-shared/catalog.js'
export default {
  data: () => ({
    info: null,
    error: '',
    control: false,
    generation: 0,
    scopes: { communities: [], estates: [] },
    context: {},
    catalog,
    groups: [
      {
        title: '社区与房屋',
        items: ['communities', 'estates', 'buildings', 'units', 'houses', 'statistics'],
      },
      { title: '居民与绑定', items: ['residents', 'applications', 'relations', 'missing'] },
      { title: '基础资料', items: ['vehicles', 'facilities', 'personnel', 'files'] },
      { title: '组织与权限', items: ['orgs', 'accounts', 'roles'] },
    ],
  }),
  computed: {
    table() {
      return this.$route.params.table || 'dashboard'
    },
    pageTitle() {
      return this.catalog[this.table]?.title || '基础工作台'
    },
    currentAccount() {
      return this.info.accounts.find((a) => a.id === this.info.actor._id) || { roles: [] }
    },
    roleName() {
      return this.currentAccount.roles.find((r) => r.id === this.info.actor.role)?.name || ''
    },
    scopeText() {
      return this.info.actor.orgName + ' · ' + this.info.actor.scopeLabel
    },
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
    available(t) {
      return this.info.actor.menus.includes(t) && this.info.actor.permissions.includes('read:' + t)
    },
    navigate(t) {
      if (t !== this.table) this.$router.push('/' + t)
    },
    async refresh() {
      try {
        const next = await service.info()
        if (
          this.info &&
          (this.info.actor._id !== next.actor._id || this.info.actor.role !== next.actor.role)
        ) {
          this.generation++
          this.$store.commit('identityChanged')
        }
        this.info = next
        this.scopes = await service.scopes()
        this.context = service.context()
        this.error = ''
      } catch (e) {
        this.error = e.message
        this.info = null
      }
    },
    async chooseAccount(id) {
      try {
        const a = this.info.accounts.find((a) => a.id === id)
        await service.identity(id, a.roles[0].id)
        this.generation++
        this.$store.commit('identityChanged')
        await this.refresh()
        this.navigate('dashboard')
      } catch (e) {
        this.$Message.error(e.message)
      }
    },
    async chooseRole(role) {
      try {
        await service.identity(this.info.actor._id, role)
        this.generation++
        await this.refresh()
        this.navigate('dashboard')
      } catch (e) {
        this.$Message.error(e.message)
      }
    },
    async changeCommunity(c) {
      await service.scope(c || '', '')
      await this.refresh()
      this.generation++
    },
    async changeEstate(e) {
      await service.scope(this.context.community || '', e || '')
      await this.refresh()
      this.generation++
    },
    async recover() {
      await service.identity('archive', 'maintainer')
      await this.refresh()
    },
    reset() {
      this.$Modal.confirm({
        title: '复位当前原型会话？',
        content: '将清除当前会话的模拟业务变化与附件，恢复虚构种子；不会清理商城或其他会话。',
        onOk: async () => {
          await service.reset()
          this.generation++
          await this.refresh()
          this.$Message.success('当前会话已复位')
        },
      })
    },
  },
}
</script>
