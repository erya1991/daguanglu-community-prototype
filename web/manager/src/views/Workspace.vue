<template>
  <section :class="{ 'space-workspace': embedded }">
    <div class="page-heading" v-if="!embedded && !detailOnly">
      <div>
        <h1>{{ isDashboard ? '物业工作台' : table === 'relations' ? '房屋绑定' : definition.title }}</h1>
        <p class="muted" data-field="demo:入口可用说明">
          {{ isDashboard ? '基础资料与待办事项' : description }}
        </p>
      </div>
    </div>
    <template v-if="isDashboard"
      ><div class="metric-grid">
        <div
          class="metric"
          v-for="(value, key) in info.counts"
          v-show="value !== null"
          :key="key"
          :data-field="'demo:' + key"
        >
          <Icon type="ios-stats-outline" /> {{ key }}<strong>{{ value }}</strong
          ><span class="muted">{{
            key === '居民档案人数' ? '居民编号去重；不等于常住人口' : '当前业务数据'
          }}</span>
        </div>
      </div>
      <div class="panel">
        <Alert v-if="isResource && rows.some(r => !r['关联楼栋'])" type="warning">部分资源尚未填写楼栋位置，请通过行操作编辑补全。</Alert>
        <h3>开始处理</h3>
        <p class="instructions">
          住户提交房屋绑定申请后，物业管理员可完成审核；各端查看同一业务结果。
        </p>
        <div class="module-links">
          <Button
            v-for="t in allowedTables"
            :key="t"
            data-field="demo:功能入口名称"
            @click="$router.push('/' + t)"
            >{{ t === 'spaces' ? '社区房屋档案' : catalog[t].title }}</Button
          >
        </div>
      </div>
</template
    >
    <template v-else-if="!detailOnly">
      <Tabs v-if="module === 'applications' || $route.params.table === 'applications'" v-model="bindingTab" :animated="false"><TabPane label="申请记录" name="applications"/><TabPane label="当前绑定" name="relations"/></Tabs>
      <Alert v-if="error" type="error" show-icon
        >{{ error }}<Button size="small" @click="load">重试</Button></Alert
      >
      <div class="panel">
        <div class="filter-grid">
          <label v-for="f in filterFields" :key="f"
            >{{ filterLabel(f)
            }}<Select
              v-if="filterOptions[f] && filterOptions[f].length"
              v-model="filters[f]"
              clearable
              @on-change="load"
              ><Option v-for="o in filterOptions[f]" :key="o.value" :value="o.value">{{
                o.label
              }}</Option></Select
            ><DatePicker
              v-else-if="f === '提交时间'"
              type="daterange"
              format="yyyy-MM-dd"
              :value="filters[f]"
              @on-change="$set(filters, f, $event)"
              style="width: 100%" /><Input
              v-else
              v-model="filters[f]"
              :placeholder="'筛选' + f"
              @on-enter="load"
          /></label>
        </div>
        <div class="toolbar">
          <Button type="primary" icon="ios-search" @click="load">查询</Button
          ><Button @click="clearFilters">重置筛选</Button
          ><Button v-if="canCreate" icon="md-add" @click="edit()">{{
            createLabel || '新增' + definition.title
          }}</Button
          ><Button v-if="canExport" @click="exportRows">导出</Button>
        </div>
        <p v-if="embedded" class="space-table-scroll-note">表格可横向滚动，查看完整字段及操作。</p>
        <Spin v-if="loading" fix /><Table
          :columns="columns"
          :data="pagedRows"
          :loading="loading"
          border
          stripe
          :no-data-text="error ? '读取失败，请重试' : '当前筛选没有数据'"
          size="default"
          ><template slot="actions" slot-scope="{ row }"
            ><div class="table-actions" :data-row-id="row._id">
              <a @click="details(row)">详情</a><a v-if="canWrite" @click="edit(row)">编辑</a>
              <a v-if="canWrite && table === 'houses'" @click="removeRow(row)">删除</a>
              <a v-if="table === 'applications' && canReview && row['申请状态'] === '待审核'" @click="openRowAction(row, 'review')">审核</a>
              <a v-if="table === 'vehicles' && canWrite && row['核实状态'] === '待核实'" @click="openRowAction(row, 'verifyVehicle')">核实</a>
              <a v-if="table === 'files'" @click="openFile(row, 'view')">预览</a><a v-if="table === 'files'" @click="openFile(row, 'download')">下载</a>
              <a
                v-if="embedded && table === 'houses' && info.actor.permissions.includes('read:applications')"
                @click="$router.push({ path: '/applications', query: { house: row._id } })"
                >房屋绑定</a
              >
            </div></template
          ></Table
        >
        <Page
          :total="rows.length"
          :page-size="pageSize"
          :current="page"
          show-total
          @on-change="page = $event"
          class="list-pagination"
        />
      </div>
    </template>
    <Modal
      v-model="editor"
      :title="(editing ? '编辑' : '新增') + definition.title"
      width="900"
      :mask-closable="false"
      :footer-hide="true"
      ><Alert v-if="formError" type="error">{{ formError }}</Alert>
      <Form @submit.native.prevent label-position="top"
        ><FieldEditor
          v-if="editor"
          :key="table + ':' + (editing || 'new')"
          :table="table"
          v-model="form"
          :errors="fieldErrors"
          :original="originalForm"
          :locked="lockedContext" /><FormItem
          v-if="table === 'files' && editing"
          label="操作原因（组织、范围或访问权限变更时必填）"
          :required="fileAccessChanged"
          :error="fieldErrors.reason"
          data-field="fileFeedback:操作原因"
          ><Input v-model="form['操作原因']" type="textarea" /></FormItem
      ></Form>
      <div class="toolbar">
        <Button type="primary" :loading="saving" @click="save">保存</Button
        ><Button @click="editor = false">取消</Button>

      </div></Modal
    >
    <Modal v-model="detailOpen" :title="definition.title + '详情'" width="1000" :footer-hide="true">
      <template v-if="selected && detailOpen">
        <BindingDetail v-if="table === 'applications'" :record="selected" :proof-error="proofError" @preview="proofPreview" @close="detailOpen = false"/>
        <template v-else>
          <dl class="detail-grid"><div v-for="f in detailFields" :key="f.name" class="detail-row" :data-field="table + ':' + f.name"><dt>{{f.name === '房号' ? '房间号' : f.name}}</dt><dd>{{selected._labels[f.name] || '—'}}</dd></div></dl>
        </template>
      </template>
    </Modal>
    <Modal v-model="previewOpen" title="文件预览" width="1000" :footer-hide="true" @on-visible-change="releasePreview"><p v-if="previewError" class="error">{{previewError}}</p><pre v-if="previewText" class="native-text">{{previewText}}</pre><img v-if="previewUrl && previewType === 'image'" :src="previewUrl" class="file-preview"/><iframe v-if="previewUrl && previewType === 'pdf'" :src="previewUrl" class="file-preview" title="文件预览" width="100%"/></Modal>
    <Modal v-model="actionOpen" :title="actionTitle" :footer-hide="true" width="680" :mask-closable="false"
      ><Alert v-if="actionError" type="error">{{ actionError }}</Alert>
      <p
        v-if="action === 'status' && spatialDetail && selected"
        class="form-context"
        data-testid="space-status-target"
      >
        对象：{{ statusObject }}；本次将{{
          selected['档案状态'] === '停用' ? '启用' : '停用'
        }}，历史和关联记录保留。
      </p>
      <Form @submit.native.prevent label-position="top"
        ><FormItem
          v-if="action === 'review' || action === 'verifyVehicle'"
          :label="action === 'review' ? '审核操作' : '核实操作'"
          required
          ><RadioGroup v-model="actionForm.decision"
            ><Radio :label="action === 'review' ? '通过' : '确认'" /><Radio
              :label="action === 'review' ? '驳回' : '退回'" /></RadioGroup></FormItem
        ><FormItem
          :label="
            action === 'review'
              ? '对外审核说明'
              : action === 'verifyVehicle'
                ? '核实反馈'
                : '操作原因／变更说明'
          "
          :required="action !== 'review' || actionForm.decision === '驳回'"
          :error="actionErrors['对外审核说明'] || actionErrors.feedback || actionErrors.reason"
          data-field="fileFeedback:操作原因"
          ><Input v-model="actionForm.reason" type="textarea" :rows="3" /></FormItem
        ><FormItem v-if="action === 'review'" label="内部审核备注（居民不可见）"
          ><Input v-model="actionForm.internal" type="textarea" /></FormItem
        ><FormItem
          v-if="action === 'status' && table === 'personnel'"
          label="离岗日期／入岗确认日期"
          required
          :error="actionErrors.date || actionErrors['离岗日期']"
          ><DatePicker
            type="date"
            :value="actionForm.date"
            format="yyyy-MM-dd"
            @on-change="actionForm.date = $event" /></FormItem
        ><FormItem v-if="action === 'fileVersion'" label="文件附件" required
          ><input type="file" @change="versionUpload" />
          <p data-field="fileFeedback:上传进度或状态">上传进度或状态：{{ versionUploadState }}</p>
          <p v-if="versionUploadState.startsWith('失败')" data-field="fileFeedback:上传失败原因">
            上传失败原因：{{ versionUploadState }}
          </p></FormItem
        >
</Form
      >
      <div class="toolbar">
        <Button type="primary" :loading="saving" @click="submitAction">确认</Button
        ><Button @click="actionOpen = false">取消</Button>
      </div></Modal
    >
  </section>
</template>
<script>
import { catalog } from '../../../../prototype-shared/catalog.js'
import { service } from '../services/foundation'
import { productMenus } from '../../../../prototype-shared/r3-product.js'
import { detailVisible } from '../../../../prototype-shared/core.js'
import FieldEditor from '../components/FieldEditor.vue'
import BindingDetail from '../components/BindingDetail.vue'
import ApplicationStatus from '../components/ApplicationStatus.vue'
const listFields = {
  orgs: ['组织名称', '组织类型', '上级组织', '工作联系人', '工作联系电话', '组织状态'],
  accounts: ['登录账号', '人员姓名', '所属组织', '岗位', '授权角色', '账号状态', '当前工作身份状态'],
  roles: ['角色名称', '角色说明', '角色状态'],
  communities: ['社区编号', '社区名称', '社区地址', '维护单位', '档案状态'],
  estates: ['小区编号', '小区名称', '所属社区', '物业管理单位', '档案状态'],
  buildings: ['楼栋编号', '楼栋名称／楼栋号', '所属小区', '是否设单元', '档案状态'],
  units: ['单元编号', '单元名称／单元号', '所属社区', '所属小区', '所属楼栋', '档案状态'],
  houses: ['房屋编号', '所属小区', '所属楼栋', '房号', '完整房屋地址', '房屋用途', '档案状态'],
  residents: ['居民姓名', '联系电话', '账号关联情况', '关联房屋'],
  applications: ['申请人姓名', '房屋地址', '申请关系类型', '申请类型', '提交时间', '申请状态'],
  parking: ['车位编号', '所属空间', '车位类型', '档案状态'],
  relations: ['居民姓名', '房屋地址', '关系类型', '关系状态', '有效起始日', '有效结束日'],
  missing: ['社区', '小区名称或地址', '具体房屋描述', '联系号码', '提交时间'],
  statistics: ['统计范围', '指标名称', '指标数值', '统计口径说明', '统计日期', '数据来源'],
  vehicles: ['车牌号码', '车辆类型', '关联居民', '关联房屋', '核实状态'],
  facilities: [
    '点位名称',
    '点位类别',
    '所属小区',
    '具体位置',
    '数量',
    '数量单位',
    '维护单位',
    '档案状态',
    '接入状态',
  ],
  personnel: ['人员姓名', '所属物业组织', '岗位', '工作联系电话', '在岗状态'],
  files: [
    '文件名称',
    '文件分类',
    '所属组织',
    '版本号',
    '文件格式',
    '资料使用状态',
    '到期日期',
    '有效期提示',
    '更新时间',
  ],
  messages: ['消息标题', '消息类型', '发生时间', '阅读状态', '模拟发送状态'],
}
export default {
  components: { FieldEditor, BindingDetail },
  props: {
    info: Object,
    module: String,
    embedded: Boolean,
    detailOnly: Boolean,
    filterRow: Function,
    parentContext: { type: Object, default: () => ({}) },
    resourceParent: Object,
    resourceChoices: { type: Array, default: () => [] },
    createAllowed: { type: Boolean, default: true },
    createLabel: String,
    scopeNode: Object,
    contextLabel: String,
    pathFor: Function,
  },
  data: () => ({
    catalog,
    bindingTab: 'applications', previewOpen: false,
    rows: [],
    filters: {},
    filterOptions: {},
    loading: false,
    error: '',
    editor: false,
    editing: null,
    originalForm: null,
    form: {},
    formError: '',
    fieldErrors: {},
    saving: false,
    failSave: false,
    detailOpen: false,
    selected: null,
    actionOpen: false,
    action: '',
    actionForm: {},
    actionError: '',
    actionErrors: {},
    versions: [],
    targetVersion: '',
    previewUrl: '',
    previewText: '',
    previewError: '',
    previewType: '',
    versionUploadState: '',
    proofError: '',
    communityCounts: {},
    sourceStats: [],
    page: 1,
    pageSize: 10,
    loadTicket: 0,
    detailTicket: 0,
    editingSpace: null,
    formParents: {},
    actionFromRow: false,
  }),
  computed: {
    fileAccessChanged() {
      return (
        !!this.originalForm &&
        ['所属组织', '适用社区', '适用小区', '可查阅角色', '可下载角色'].some(
          (k) => JSON.stringify(this.originalForm[k] || []) !== JSON.stringify(this.form[k] || []),
        )
      )
    },
    table() {
      const selected = this.module || this.$route.params.table || 'dashboard'
      return selected === 'applications' && this.bindingTab === 'relations' ? 'relations' : selected
    },
    isDashboard() {
      return this.table === 'dashboard'
    },
    definition() {
      return catalog[this.table] || { title: '物业工作台', fields: [], filters: [], form: [] }
    },
    description() { return { files: '物业资料查询与维护', facilities: '设施档案查询与维护', vehicles: '车辆登记与核实', applications: '申请审核与房屋绑定查询', relations: '已建立的房屋绑定关系', personnel: '物业组织人员名录' }[this.table] || '' },
    allowedTables() { return productMenus.filter(t => t === 'spaces' || this.info.actor.permissions.includes('read:' + t)) },
    isResource() {
      return ['facilities', 'parking'].includes(this.table)
    },
    spatialDetail() {
      return ['communities', 'estates', 'buildings', 'units', 'houses', 'facilities', 'parking'].includes(
        this.table,
      )
    },
    canCreate() {
      return (
        this.canWrite &&
        this.createAllowed
      )
    },
    filterFields() {
      if (this.table === 'applications')
        return ['申请人姓名', '所属小区', '房屋地址', '申请类型', '申请状态', '提交时间']
      return this.definition.filters.filter((f) => !this.embedded || !(f in this.parentContext))
    },
    pagedRows() {
      return this.rows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize)
    },
    lockedContext() {
      const locked = { ...this.formParents }
      if (
        this.editing &&
        ['estates', 'buildings', 'units', 'houses', 'facilities', 'parking'].includes(this.table)
      )
        for (const f of (this.isResource ? [] : ['所属社区', '所属小区', '所属楼栋', '所属单元']))
          if (f in this.form || (this.isResource && f !== '所属楼栋')) locked[f] = this.form[f] || ''
      if (this.table === 'parking' && this.editing) locked['车位编号'] = this.form['车位编号']
      return locked
    },
    canWrite() {
      return !['personnel','relations'].includes(this.table) && this.info.actor.permissions.includes('write:' + this.table)
    },
    canReview() {
      return this.info.actor.permissions.includes('review:applications')
    },
    canExport() {
      return (
        this.info.actor.sensitive.includes('export') &&
        this.info.actor.permissions.includes('read:' + this.table)
      )
    },
    statusSupported() {
      return [
        'orgs',
        'accounts',
        'roles',
        'communities',
        'estates',
        'buildings',
        'units',
        'houses',
        'facilities',
        'parking',
        'personnel',
        'files',
      ].includes(this.table)
    },
    columns() {
      const position = this.table === 'houses' ? ['所属小区','所属楼栋','所属单元'] : ['所属小区','关联楼栋','所属单元']
      const fields = this.table === 'houses' ? [...position, '房号','房屋面积','房屋用途'] : this.table === 'facilities' ? [...position,'点位名称','点位编号','点位类别','具体位置','数量','数量单位','接入状态'] : this.table === 'parking' ? [...position,'车位编号','车位类型','备注'] : this.table === 'files' ? ['文件名称','文件分类','所属组织','附件文件名','文件格式','文件大小','更新时间'] : this.table === 'personnel' ? ['人员姓名','所属物业组织','岗位','工作联系电话'] : listFields[this.table] || []
      return [...fields.map(f => ({ title: f === '房号' ? '房间号' : f === '房屋面积' ? '建筑面积（㎡）' : f === '关联楼栋' ? '楼栋' : f.replace(/^所属/,''), key: f, minWidth: /地址|房屋/.test(f) ? 180 : 120, render: (h,p) => f === '申请状态' ? h(ApplicationStatus,{props:{status:p.row[f]}}) : h('span', !p.row[f] && p.row[f] !== 0 ? '—' : p.row._labels[f] || '—') })), { title: '操作', slot: 'actions', width: this.table === 'houses' ? 280 : this.table === 'files' ? 240 : 210, fixed: 'right' }]
    },
    detailFields() {
      return this.definition.fields.filter(
        (f) => this.selected && f.name in this.selected && this.selected[f.name] !== '' && this.selected[f.name] !== undefined && this.selected[f.name] !== null && (!Array.isArray(this.selected[f.name]) || this.selected[f.name].length) && detailVisible(this.table, this.selected, f.name) && (this.table !== 'vehicles' || ['车牌号码','车辆类型','车辆颜色','关联居民','关联房屋','核实状态','核实反馈','核实人','核实时间','登记说明'].includes(f.name)),
      )
    },
    actionTitle() {
      return {
        status: '受控状态变更',
        review: '审核房屋绑定',
        verifyVehicle: '核实车辆',
        fileVersion: '上传新版本',
      }[this.action]
    },
    statusObject() {
      if (!this.selected) return ''
      const name =
        ['点位名称', '车位编号', '社区名称', '小区名称', '楼栋名称／楼栋号', '单元名称／单元号', '房号']
          .map((f) => this.selected[f])
          .find(Boolean) || ''
      return [this.pathFor?.(this.selected), name].filter(Boolean).join(' / ')
    },
    versionColumns() {
      return [
        '版本号',
        '附件文件名',
        '文件大小',
        '上传人',
        '上传时间',
        '变更说明',
        '生效日期',
        '到期日期',
      ].map((f) => ({ title: f, key: f, minWidth: 130 }))
    },
  },
  watch: {
    '$route.query.house'() {
      if (this.table === 'applications') {
        this.detailOpen = false
        this.page = 1
        this.load()
      }
    },
    '$route.query.id'() {
      if (!this.embedded) this.load()
    },
    table() {
      this.filters = {}
      this.page = 1
      this.detailOpen = false
      this.editor = false
      this.load()
    },
  },
  created() {
    if (this.$route.query.tab === 'bindings') this.bindingTab = 'relations'
    this.load()
    this.unsubscribe = service.onChange(() => {
      this.load()
      if (this.detailOpen && this.selected) this.details(this.selected)
    })
  },
  beforeDestroy() {
    this.loadTicket++
    this.detailTicket++
    this.unsubscribe?.()
    this.releasePreview(false)
  },
  methods: {
    removeRow(row) {
      this.$Modal.confirm({ title: '确认删除？', content: '删除“' + this.statusName(row) + '”？此操作无法撤销。', onOk: async () => { try { await service.command('delete', {table:this.table,id:row._id,revision:row._rev}); this.$Message.success('已删除'); await this.load(); this.$emit('refresh') } catch(e) { this.$Message.error(e.message) } } })
    },
    statusName(row) { return [this.pathFor?.(row), row['点位名称'] || row['车位编号'] || row['房号'] || row['小区名称'] || row['楼栋名称／楼栋号'] || row['单元名称／单元号']].filter(Boolean).join(' / ') },
    async openFile(row, action) { this.selected = row; if(action === 'view') this.previewOpen = true; await this.fileAccess(action) },
    filterLabel(f) {
      return this.table === 'applications' && f === '申请人姓名'
        ? '申请人或联系方式'
        : f === '房屋地址'
          ? '房屋位置'
          : f === '房号'
            ? '房间号'
            : f
    },
    showValue(v) {
      if (v === undefined) return '不适用'
      return Array.isArray(v) ? v.join('、') : String(v)
    },
    async load() {
      if (this.isDashboard || this.detailOnly) return
      const ticket = ++this.loadTicket,
        table = this.table
      this.loading = true
      this.error = ''
      this.rows = []
      try {
        const filters = { ...this.filters }
        if (this.embedded && this.scopeNode) filters._space = this.scopeNode
        if (table === 'applications' && this.$route.query.house) filters._house = this.$route.query.house
        let rows = await service.labels(table, await service.query(table, filters))
        if (ticket !== this.loadTicket) return
        if (this.filterRow) rows = rows.filter(this.filterRow)
        this.rows = rows
        this.page = Math.min(this.page, Math.max(1, Math.ceil(rows.length / this.pageSize)))
        const options = {}
        for (const f of this.definition.filters)
          options[f] = await service.options(this.table, f, { ...this.parentContext, ...this.filters })
        if (ticket !== this.loadTicket) return
        this.filterOptions = options
        if (this.$route.query.id && !this.embedded) await this.details({ _id: this.$route.query.id })
      } catch (e) {
        if (ticket !== this.loadTicket) return
        this.error = e.message
        this.rows = []
      } finally {
        if (ticket === this.loadTicket) this.loading = false
      }
    },
    clearFilters() {
      this.filters = {}
      this.page = 1
      this.load()
    },
    async edit(r, settings = {}) {
      if (!this.canWrite) return
      if (r && !r._labels) r = (await service.labels(this.table, [r]))[0]
      const context = { ...(settings.context || this.parentContext) }
      if (this.isResource && context['所属楼栋']) {
        context['关联楼栋'] = context['所属楼栋']
        delete context['所属楼栋']
      }
      this.formParents = Object.fromEntries(Object.entries(context).filter(([, value]) => value !== '' && value !== undefined && value !== null))
      this.editing = r?._id || null
      const initial = Object.fromEntries(this.definition.form.map((f) => [f, '']))
      if (this.isResource)
        for (const f of ['所属社区', '所属小区', '关联楼栋', '所属单元']) initial[f] = ''
      this.form = r ? { ...initial, ...r } : { ...initial, ...this.formParents }
      if (!r) this.form['资料来源'] = '人工维护'
      this.editingSpace = r
        ? ['communities', 'estates', 'buildings', 'units'].includes(r._spaceTable)
          ? { table: r._spaceTable, id: r._spaceId }
          : null
        : this.resourceParent
      this.originalForm = r ? JSON.parse(JSON.stringify(r)) : null
      if (this.table === 'personnel') this.form['变更说明'] = ''
      for (const f of [
        '授权角色',
        '可查看社区',
        '可查看小区',
        '可见菜单',
        '允许操作',
        '敏感查看与导出权限',
        '适用社区',
        '适用小区',
        '可查阅角色',
        '可下载角色',
        '到期提醒接收人',
      ])
        if (this.definition.form.includes(f) && !Array.isArray(this.form[f])) this.form[f] = []
      if (this.table === 'accounts' && !r) this.form['所属组织'] = this.info.actor.org
      if (this.table === 'files' && !r) this.form['所属组织'] = this.info.actor.org
      this.formError = ''
      this.fieldErrors = {}
      this.editor = true
    },
    async save() {
      this.saving = true
      this.formError = ''
      this.fieldErrors = {}
      try {
        let space = this.editingSpace
        if (this.isResource) {
          const requiredParents = ['所属小区', '关联楼栋'].filter((f) => !this.form[f])
          if (requiredParents.length) {
            this.fieldErrors = Object.fromEntries(requiredParents.map((f) => [f, '请选择' + f]))
            this.formError = '请选择资源所属小区和楼栋'
            return
          }
          space = this.form['所属单元']
            ? { table: 'units', id: this.form['所属单元'] }
            : this.form['关联楼栋']
              ? { table: 'buildings', id: this.form['关联楼栋'] }
              : { table: 'estates', id: this.form['所属小区'] }
        }
        const result = await service.command('save', {
          table: this.table,
          id: this.editing,
          data: this.form,
          reason: this.form['操作原因'] || this.form['变更说明'],
          space,
          fail: this.failSave,
          operation: 'save-' + Date.now(),
        })
        this.editor = false
        this.$Message.success(result.message)
        await this.load()
        this.$emit('refresh', { table: this.table, created: !this.editing, id: result.id })
      } catch (e) {
        this.formError = e.message
        this.fieldErrors = e.fields || {}
      } finally {
        this.saving = false
      }
    },
    async details(r) {
      const ticket = ++this.detailTicket
      this.proofError = ''
      this.releasePreview(false)
      try {
        const selected = (await service.labels(this.table, [await service.record(this.table, r._id)]))[0]
        if (ticket !== this.detailTicket) return
        this.selected = selected
        this.detailOpen = true
        if (this.table === 'files') {
          this.versions = await service.versions(r._id)
          this.targetVersion = this.selected['版本号']
        }
        if (this.table === 'messages' && this.selected['阅读状态'] !== '已读')
          await service.command('messageRead', { id: r._id })
        if (this.table === 'communities') {
          const summary = await service.summary(r._id)
          this.communityCounts = summary.counts
          this.sourceStats = summary.sources
        }
      } catch (e) {
        this.detailOpen = false
        this.$Message.error(e.message)
      }
    },
    async openRowAction(row, action) {
      const ticket = ++this.detailTicket
      this.actionOpen = false
      try {
        const current = await service.record(this.table, row._id)
        const selected = (await service.labels(this.table, [current]))[0]
        if (ticket !== this.detailTicket) return
        this.selected = selected
        this.openAction(action, true)
      } catch (e) {
        if (ticket !== this.detailTicket) return
        this.actionOpen = false
        this.$Message.error(e.message)
      }
    },
    openAction(action, fromRow = false) {
      this.actionFromRow = fromRow
      this.action = action
      this.actionForm = {
        decision: action === 'review' ? '通过' : '确认',
        reason: '',
        internal: '',
        date: '',
        fail: false,
        blob: '',
      }
      this.actionError = ''
      this.actionErrors = {}
      this.versionUploadState = '待上传'
      this.actionOpen = true
    },
    async submitAction() {
      this.saving = true
      this.actionError = ''
      try {
        const p = {
          table: this.table,
          id: this.selected._id,
          reason: this.actionForm.reason,
          decision: this.actionForm.decision,
          对外审核说明: this.actionForm.reason,
          内部审核备注: this.actionForm.internal,
          feedback: this.actionForm.reason,
          date: this.actionForm.date,
          blob: this.actionForm.blob,
          fail: this.actionForm.fail,
        }
        await service.command(this.action, p)
        this.actionOpen = false
        if (!this.actionFromRow) await this.details(this.selected)
        await this.load()
        this.$emit('refresh')
      } catch (e) {
        this.actionError = e.message
        this.actionErrors = e.fields || {}
      } finally {
        this.saving = false
      }
    },
    async versionUpload(e) {
      const file = e.target.files[0]
      if (!file) return
      this.versionUploadState = '上传中（本地处理）'
      try {
        const r = await service.upload(file, { fail: this.actionForm.fail })
        this.actionForm.blob = r.id
        this.versionUploadState = '成功：' + r.name
      } catch (e) {
        this.versionUploadState = '失败：' + e.message
      }
    },
    releasePreview(open) {
      if (open) return
      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl)
      this.previewUrl = ''
      this.previewText = ''
      this.previewError = ''
      this.previewType = ''
    },
    async fileAccess(action) {
      this.releasePreview(false)
      try {
        const { blob, name, type } = await service.attachment({
          table: 'files',
          id: this.selected._id,
          action,
        })
        if (action === 'download') {
          const url = URL.createObjectURL(blob),
            a = document.createElement('a')
          a.href = url
          a.download = name
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        } else if (name.endsWith('.txt')) this.previewText = await blob.text()
        else if (/\.(png|jpe?g)$/i.test(name)) {
          this.previewUrl = URL.createObjectURL(blob)
          this.previewType = 'image'
        } else if (name.endsWith('.pdf')) {
          this.previewUrl = URL.createObjectURL(blob)
          this.previewType = 'pdf'
        } else this.previewError = '当前格式不支持在线预览，请下载文件查看'
      } catch (e) {
        this.previewError = e.message
      }
    },
    async proofPreview(blob) {
      try {
        const r = await service.attachment({
          table: 'applications',
          id: this.selected._id,
          blob,
          action: 'view',
        })
        const url = URL.createObjectURL(r.blob)
        this.$Modal.info({
          title: '申请材料',
          render: (h) => h('img', { attrs: { src: url }, style: { maxWidth: '100%' } }),
          onOk: () => URL.revokeObjectURL(url),
        })
      } catch (e) {
        this.proofError = e.message
      }
    },
    async remind() {
      try {
        const r = await service.command('remind', { id: this.selected._id })
        this.$Message.success(r.message)
      } catch (e) {
        this.$Message.error(e.message)
      }
    },
    async messageAction(c, failed) {
      try {
        await service.command(c, { id: this.selected._id, failed })
        await this.details(this.selected)
      } catch (e) {
        this.$Message.error(e.message)
      }
    },
    async followMessage() {
      const m = this.selected
      try {
        await service.record(m._table, m._object)
        this.detailOpen = false
        const spatial = ['communities', 'estates', 'buildings', 'units', 'houses'].includes(m._table)
        await this.$router.push(
          spatial
            ? { path: '/spaces', query: { node: m._table + ':' + m._object } }
            : { path: '/' + m._table, query: { id: m._object } },
        )
      } catch (e) {
        this.$Message.error(e.message)
      }
    },
    async exportRows() {
      const filters = { ...this.filters }
      if (this.embedded && this.scopeNode) filters._space = this.scopeNode
      this.rows = await service.labels(this.table, await service.exportRows(this.table, filters))
      if (this.filterRow) this.rows = this.rows.filter(this.filterRow)
      const fields = this.definition.fields.map((f) => f.name),
        csv =
          '\uFEFF' +
          [fields, ...this.rows.map((r) => fields.map((f) => r._labels[f] || ''))]
            .map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','))
            .join('\r\n'),
        url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
        a = document.createElement('a')
      a.href = url
      a.download = this.definition.title + '.csv'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  },
}
</script>
