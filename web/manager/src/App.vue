<template>
  <div class="main" v-if="info">
    <aside class="sidebar-menu-con">
      <div class="logo-con">
        <span class="brand-icon">大</span><strong>大光路社区</strong><small>社区物业服务</small>
      </div>
      <Menu v-if="!identityChanging" theme="light" :active-name="table" width="200px" @on-select="navigate">
        <MenuItem name="dashboard"><Icon type="ios-apps-outline" />基础工作台</MenuItem>
        <MenuGroup v-for="group in groups" :key="group.title" :title="group.title"
          ><MenuItem v-for="t in group.items.filter(available)" :key="t" :name="t">{{
            menuTitle(t)
          }}</MenuItem></MenuGroup
        >
        <MenuGroup v-if="['property','platform'].includes(info.actor.role)" title="物业服务"><MenuItem v-for="entry in stage01Entries" :key="entry[0]" :name="entry[0]">{{entry[1]}}</MenuItem></MenuGroup><MenuItem name="messages">结果消息 <Badge :count="info.counts['未读结果消息数']" /></MenuItem>
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
          ><Button :disabled="identityChanging" @click="control = true" icon="ios-options-outline">演示身份</Button>
        </div>
      </div>
      <div class="tags-con">
        <Breadcrumb
          ><BreadcrumbItem>基础管理</BreadcrumbItem
          ><BreadcrumbItem>{{ pageTitle }}</BreadcrumbItem></Breadcrumb
        >
        <div class="header-context" v-if="!identityChanging">
          <Select
            :value="context.community || ''"
            clearable
            placeholder="当前社区：全部获准"
            :data-field="$route.meta.stage01?'QF02':'demo:当前社区'"
            style="width: 180px"
            @on-change="changeCommunity"
            ><Option v-for="c in scopes.communities" :key="c.value" :value="c.value">{{
              c.label
            }}</Option></Select
          ><Select
            :value="context.estate || ''"
            clearable
            placeholder="当前小区：全部获准"
            :data-field="$route.meta.stage01?'QF03':'demo:当前小区'"
            style="width: 180px"
            @on-change="changeEstate"
            ><Option v-for="e in scopes.estates" :key="e.value" :value="e.value">{{
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
    <Modal ref="identityModal" v-model="control" title="演示身份与辅助工具" :footer-hide="true" width="620" @on-hidden="identityClosed">
      <Alert show-icon>仅切换固定虚构身份；四端共享当前会话业务，各端身份分别保存。</Alert>
      <Form label-position="top"
        ><FormItem data-field="demo:当前演示账号" label="演示身份"
          ><Select :value="info.actor._id" @on-change="chooseAccount"
            ><Option v-for="a in info.accounts" :key="a.id" :value="a.id"
              >{{ a.name }}</Option
            ></Select
          ></FormItem
        >
        <FormItem data-field="demo:当前业务角色" label="当前业务角色"
          ><Select v-if="currentAccount.roles.length > 1" :value="info.actor.role" @on-change="chooseRole"
            ><Option v-for="r in currentAccount.roles" :key="r.id" :value="r.id">{{ r.name }}</Option></Select
          ><span v-if="currentAccount.roles.length <= 1">{{ roleName }}</span></FormItem
        >
        <FormItem label="当前所属组织与可见数据范围"
          ><p data-field="demo:当前所属组织">{{ info.actor.orgName }}</p>
          <p data-field="demo:可见数据范围">{{ info.actor.scopeLabel }}</p>
          <p>会话：{{ info.session }}；种子：{{ info.version }}；复位代次：{{ info.generation }}</p></FormItem
        > </Form
      ><Alert data-field="demo:数据复位说明" type="warning"
        >复位仅清除本原型当前会话的修改和本地附件，恢复虚构种子。其他会话和商城不受影响。</Alert
      ><Button type="error" ghost @click="reset">复位当前会话</Button>
      <div v-if="['property','platform'].includes(info.actor.role)" class="s1"><h3>Stage01场景辅助</h3><p>演示价格、自然月期间、评价字典和附件限制均为可替换样例。</p><Select v-model="paymentMode" @on-change="stage01Mode"><Option value="normal">正常缴费</Option><Option value="unknown">支付结果未知</Option><Option value="pending">支付在途</Option><Option value="failure">付款失败</Option><Option value="reconcile">成功待核销</Option></Select><Checkbox v-model="uploadFailure" @on-change="uploadMode">下次上传失败</Checkbox><div class="s1-actions"><Button @click="sameHouse">准备同房多人专项</Button><Button @click="replayLast">回放最近付款回执</Button><Button @click="closeLast">回放原支付关闭结果</Button><Button @click="funds('duplicate')">准备重复收款事实</Button><Button @click="funds('refund')">准备已有退款事实</Button><Button @click="resetStage01">仅复位Stage01</Button></div></div>
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
    identityChanging: false,
    refreshTicket: 0,
    generation: 0,
    scopes: { communities: [], estates: [] },
    context: {},
    catalog,
    stage01Entries: [['property/bills','物业费账单'],['property/payments','缴费记录与异常'],['parking/business','停车业务'],['parking/checks','停车核查'],['workorders/events','待核实事件'],['workorders/tasks','工单办理'],['workorders/overview','工单概况'],['workorders/repairs','报修反馈'],['workorders/hazards','隐患台账']],
    paymentMode:'normal', uploadFailure:false,

    groups: [
      {
        title: '社区与房屋',
        items: ['spaces', 'statistics'],
      },
      { title: '居民与绑定', items: ['residents', 'applications', 'relations', 'missing'] },
      { title: '基础资料', items: ['vehicles', 'facilities', 'personnel', 'files'] },
      { title: '组织与权限', items: ['orgs', 'accounts', 'roles'] },
    ],
  }),
  computed: {
    table() {
      if(this.$route.meta.stage01)return this.$route.path.slice(1)
      return this.$route.name === 'spaces' ? 'spaces' : this.$route.params.table || 'dashboard'
    },
    pageTitle() {
      if(this.$route.meta.stage01)return this.$route.meta.title
      return this.table === 'spaces' ? '社区房屋档案' : this.catalog[this.table]?.title || '基础工作台'
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
    identityClosed() {
      // View UI's 300ms close timer can run before the mask transition completes.
      // Recheck after leave/paint using its own all-modal guard, without unlocking other dialogs.
      this.$nextTick(() => requestAnimationFrame(() => {
        if (!this.control) this.$refs.identityModal?.removeScrollEffect()
      }))
    },
    menuTitle(t) { return t === 'spaces' ? '社区房屋档案' : catalog[t].title },
    available(t) {
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
        if(['property','platform'].includes(next.actor.role))next.accounts.push(...await service.stage01.accounts())
        if (ticket !== this.refreshTicket) return
        if (
          this.info &&
          (this.info.actor._id !== next.actor._id || this.info.actor.role !== next.actor.role)
        ) {
          this.generation++
          this.$store.commit('identityChanged')
        }
        this.info = next
        this.scopes = scopes
        this.context = service.context()
        this.error = ''
      } catch (e) {
        if (ticket !== this.refreshTicket) return
        this.control = false
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
      this.control = false
      this.identityChanging = true
      this.refreshTicket++
      try {
        // Keep the Modal mounted while View UI completes its close lifecycle.
        // Business views are removed immediately; stale identity reads cannot repopulate them.
        await this.$nextTick()
        await service.identity(account, role)
        this.generation++
        this.$store.commit('identityChanged')
        await this.refresh(true)
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
      await service.scope(this.context.community || '', e || '')
      await this.refresh()
      this.generation++
    },
    async recover() {
      await service.identity('platform-admin', 'platform')
      await this.refresh()
    },
    async stage01Mode(){await service.stage01.auxiliary('mode',{mode:this.paymentMode})},
    async resetStage01(){this.$Modal.confirm({title:'仅复位Stage01？',content:'保留房屋、人房关系、Stage00历史和其他会话，恢复本阶段样例。',onOk:async()=>{await service.stage01.reset();this.generation++;await this.refresh()}})},
    async uploadMode(){await service.stage01.auxiliary('uploadFailure',{fail:this.uploadFailure});sessionStorage.setItem('stage01-upload-fail',this.uploadFailure?'1':'0')},
    async sameHouse(){try{await service.stage01.auxiliary('sameHouse');this.$Message.success('同房专项已准备')}catch(e){this.$Message.error(e.message)}},
    async funds(kind){try{const rows=await service.stage01.query('payments');if(!rows.length)throw Error('尚无付款');await service.stage01.auxiliary('funds',{id:rows[rows.length-1]._id,kind});this.$Message.success('专项事实已准备')}catch(e){this.$Message.error(e.message)}},
    async closeLast(){try{const rows=await service.stage01.query('payments');await service.stage01.auxiliary('replay',{id:rows[rows.length-1]._id,outcome:'已关闭'});this.$Message.success('关单结果已处理')}catch(e){this.$Message.error(e.message)}},
    async replayLast(){try{const rows=await service.stage01.query('payments');if(!rows.length)throw Error('尚无付款记录');await service.stage01.auxiliary('replay',{id:rows[rows.length-1]._id});this.$Message.success('已按原支付回放')}catch(e){this.$Message.error(e.message)}},
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
