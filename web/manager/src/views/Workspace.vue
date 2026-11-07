<template>
  <section :class="{ 'space-workspace': embedded }">
    <div class="page-heading" v-if="!embedded && !detailOnly">
      <div>
        <h1>{{ isDashboard ? '基础工作台' : definition.title }}</h1>
        <p class="muted" data-field="demo:入口可用说明">
          {{ isDashboard ? '当前身份授权范围内的基础资料和审核结果' : description }}
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
            key === '居民档案人数' ? '居民编号去重；不等于常住人口' : '当前身份获准数据'
          }}</span>
        </div>
      </div>
      <div class="panel">
        <h3>开始处理</h3>
        <p class="instructions">
          住户提交房屋绑定申请后，物业管理员可在授权范围内完成审核；各端查看同一业务结果。
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
      <div class="panel">
        <h3>本轮边界与统计口径</h3>
        <p class="instructions">
          社区提供的人口与户数按来源、日期和口径单独维护；未提供显示待维护。车辆档案不等于停车准入，设施档案不等于设备在线。Q02～Q06正式政策仍待确认。
        </p>
      </div></template
    >
    <template v-else-if="!detailOnly">
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
          ><Button v-if="canExport" @click="exportRows">导出当前获准结果</Button>
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
              <a
                v-if="canWrite && ['houses', 'facilities', 'parking'].includes(table)"
                @click="openRowAction(row, 'status')"
                >{{ row['档案状态'] === '停用' ? '启用' : '停用' }}</a
              >
              <a v-if="embedded && table === 'houses'" @click="$emit('locate', row)">定位树节点</a>
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
      <Form label-position="top"
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
        <details class="demo-tools">
          <summary>演示辅助</summary>
          <Checkbox v-model="failSave">下一次保存失败</Checkbox>
        </details>
      </div></Modal
    >
    <Modal
      v-model="detailOpen"
      :title="definition.title + '详情'"
      width="1000"
      :footer-hide="true"
      @on-visible-change="releasePreview"
    >
      <template v-if="selected && detailOpen">
        <BindingDetail
          v-if="table === 'applications'"
          :record="selected"
          :history="history"
          :can-review="canReview"
          :proof-error="proofError"
          @review="openAction('review')"
          @preview="proofPreview"
          @application="details"
          @close="detailOpen = false"
        />
        <template v-else
          ><div class="toolbar">
            <Tag color="orange">{{ info.actor.roleName }}</Tag
            ><Button v-if="canWrite && !spatialDetail" @click="edit(selected)">编辑资料</Button
            ><Button v-if="canWrite && statusSupported && !spatialDetail" @click="openAction('status')">{{
              table === 'personnel' ? '记录入岗／离岗' : table === 'files' ? '归档／恢复' : '启用／停用'
            }}</Button
            ><Button
              v-if="table === 'vehicles' && canWrite && selected['核实状态'] === '待核实'"
              @click="openAction('verifyVehicle')"
              >核实车辆</Button
            >
          </div>
          <dl class="detail-grid">
            <div
              v-for="f in detailFields"
              :key="f.name"
              class="detail-row"
              :data-field="table + ':' + f.name"
            >
              <dt>{{ f.name }}</dt>
              <dd>{{ selected._labels[f.name] || '未维护／不适用' }}</dd>
            </div>
          </dl>
          <template v-if="table === 'communities'"
            ><h3 style="margin-top: 24px">基础概况</h3>
            <p class="instructions">
              档案指标与来源人口／户数分开。来源记录未维护时为“待提供／未维护”，不以档案数替代。
            </p>
            <div class="metric-grid">
              <div class="metric" v-for="(v, k) in communityCounts" :key="k">
                {{ k }}<strong>{{ v }}</strong>
              </div>
            </div>
            <p v-for="r in sourceStats" :key="r._id">
              {{ r['指标名称'] }}：{{ r['指标数值'] }}{{ r['计量单位'] }} · {{ r['统计口径说明'] }} ·
              {{ r['统计日期'] }} · {{ r['数据来源'] }}
            </p>
            <p v-if="!sourceStats.length" class="muted">社区提供的人口／户数：待提供／未维护</p></template
          >
          <template v-if="table === 'files'"
            ><h3 style="margin-top: 24px">历史版本与受控附件</h3>
            <div class="toolbar">
              <span data-field="fileFeedback:目标版本">目标版本</span
              ><Select v-model="targetVersion" style="width: 180px"
                ><Option v-for="v in versions" :key="v['版本号']" :value="v['版本号']"
                  >{{ v['版本号'] }} · {{ v['附件文件名'] }}</Option
                ></Select
              ><Button @click="fileAccess('view')">预览目标版本</Button
              ><Button @click="fileAccess('download')">下载目标版本</Button
              ><Button v-if="canWrite" @click="openAction('fileVersion')">上传新版本</Button
              ><Button v-if="canWrite" @click="remind">生成本地到期提醒</Button>
            </div>
            <Table :columns="versionColumns" :data="versions" size="small" />
            <p v-if="previewError" class="error" data-field="fileFeedback:预览结果说明">{{ previewError }}</p>
            <pre data-field="fileFeedback:预览内容" v-if="previewText" class="native-text">{{
              previewText
            }}</pre>
            <img v-if="previewUrl && previewType === 'image'" :src="previewUrl" class="file-preview" /><iframe
              v-if="previewUrl && previewType === 'pdf'"
              :src="previewUrl"
              class="file-preview"
              title="本地样例文件预览"
              width="100%"
          /></template>
          <template v-if="table === 'messages'"
            ><div class="toolbar">
              <Button @click="messageAction('messageRead')">标为已读</Button
              ><Button @click="messageAction('messageSend')">模拟处理／重试</Button
              ><Button @click="messageAction('messageSend', true)">模拟处理失败</Button
              ><Button @click="followMessage">查看关联业务</Button>
            </div></template
          >
          <h3 style="margin-top: 24px">操作与变更记录</h3>
          <HistoryPanel :records="history" />
        </template>
      </template>
    </Modal>
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
      <Form label-position="top"
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
        <details class="demo-tools">
          <summary>演示辅助</summary>
          <Checkbox v-model="actionForm.fail">下一次操作失败</Checkbox>
        </details></Form
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
import { detailVisible } from '../../../../prototype-shared/core.js'
import FieldEditor from '../components/FieldEditor.vue'
import HistoryPanel from '../components/HistoryPanel.vue'
import BindingDetail from '../components/BindingDetail.vue'
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
  components: { FieldEditor, HistoryPanel, BindingDetail },
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
    history: [],
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
      return this.module || this.$route.params.table || 'dashboard'
    },
    isDashboard() {
      return this.table === 'dashboard'
    },
    definition() {
      return catalog[this.table] || { title: '基础工作台', fields: [], filters: [], form: [] }
    },
    description() {
      return (
        {
          files: '版本保留，查阅和下载分别授权；正式分类及提醒规则待Q06',
          facilities: '车棚、监控、充电、消防基础档案；未接入真实设备',
          vehicles: '基础登记与人工核实，不产生停车或支付权益',
          applications: '申请、审核轮次与正式人房关系分别记录',
        }[this.table] || '按当前组织、角色及社区小区范围查询和维护'
      )
    },
    allowedTables() {
      const allowed = Object.keys(listFields).filter(
        (t) =>
          !['communities', 'estates', 'buildings', 'units', 'houses', 'parking'].includes(t) &&
          this.info.actor.permissions.includes('read:' + t),
      )
      if (this.info.actor.permissions.includes('read:communities')) allowed.unshift('spaces')
      return allowed
    },
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
        this.createAllowed &&
        (!this.isResource || !!this.resourceParent || this.resourceChoices.length > 0)
      )
    },
    filterFields() {
      if (this.table === 'applications')
        return ['申请人姓名', '所属社区', '所属小区', '房屋地址', '申请类型', '申请状态', '提交时间']
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
        for (const f of ['所属社区', '所属小区', '所属楼栋', '所属单元', '关联楼栋'])
          if (f in this.form || (this.isResource && f !== '所属楼栋')) locked[f] = this.form[f] || ''
      if (this.table === 'parking' && this.editing) locked['车位编号'] = this.form['车位编号']
      return locked
    },
    canWrite() {
      return this.info.actor.permissions.includes('write:' + this.table)
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
      if (this.embedded && ['houses', 'facilities', 'parking'].includes(this.table)) {
        const fields =
          this.table === 'houses'
            ? ['房号', '房屋编号', '所属位置', '房屋面积', '档案状态']
            : this.table === 'facilities'
              ? ['点位名称', '点位编号', '点位类别', '所属位置', '档案状态', '接入状态']
              : ['车位编号', '车位类型', '所属位置', '档案状态']
        return [
          ...fields.map((f) => ({
            title: f === '房号' ? '房间号' : f === '房屋面积' ? '建筑面积（㎡）' : f,
            key: f,
            minWidth: f === '所属位置' ? 290 : 120,
            render: (h, p) =>
              h(
                'span',
                f === '所属位置'
                  ? (this.pathFor?.(p.row) || p.row._labels['所属空间'] || '未维护') +
                      (p.row._spaceTable === 'communities' ? '（历史社区直属）' : '')
                  : p.row._labels[f] || '未维护',
              ),
          })),
          { title: '操作', slot: 'actions', width: this.table === 'houses' ? 230 : 160 },
        ]
      }
      return [
        ...(this.embedded && this.table === 'houses'
          ? ['房号', '房屋用途', '房屋面积', '档案状态']
          : this.embedded && this.table === 'units'
            ? ['单元名称／单元号', '档案状态']
            : this.embedded && this.table === 'buildings'
              ? ['楼栋名称／楼栋号', '是否设单元', '档案状态']
              : listFields[this.table] || []
        ).map((f) => ({
          title: f === '房号' ? '房间号' : f,
          key: f,
          minWidth: f.includes('地址') ? 220 : 140,
          render: (h, p) => h('span', p.row._labels[f] || '未维护'),
        })),
        { title: '操作', slot: 'actions', width: 120, fixed: 'right' },
      ]
    },
    detailFields() {
      return this.definition.fields.filter(
        (f) => this.selected && f.name in this.selected && detailVisible(this.table, this.selected, f.name),
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
        if (!this.editing && this.isResource) {
          const requiredParents = ['所属社区', '所属小区'].filter((f) => !this.form[f])
          if (requiredParents.length) {
            this.fieldErrors = Object.fromEntries(requiredParents.map((f) => [f, '请选择' + f]))
            this.formError = '请完成资源所属社区和小区'
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
        if (!this.editing && ['communities', 'estates'].includes(this.table) && this.info.actor.role !== 'platform')
          this.$Modal.info({
            title: '新档案与访问清单',
            content:
              '新档案已保存。请由平台管理员在账号授权中明确勾选新社区和小区后继续维护下级档案；选择社区不会自动授予全部小区。',
          })
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
        const history = await service.history(this.table, r._id)
        if (ticket !== this.detailTicket) return
        this.selected = selected
        this.history = history
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
          version: this.targetVersion,
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
        } else this.previewError = '当前格式不支持浏览器预览；有下载权限时可下载原始样例文件'
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
          title: '本地证明样例',
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
      a.download = 'Stage00-' + this.definition.title + '.csv'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  },
}
</script>
