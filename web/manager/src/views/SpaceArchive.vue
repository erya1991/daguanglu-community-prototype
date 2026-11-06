<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>社区房屋档案</h1>
        <p class="muted">左侧维护空间结构，右侧查询当前范围内的全部资源</p>
      </div>
    </div>
    <Alert v-if="notice" type="warning" closable @on-close="notice = ''">{{ notice }}</Alert>
    <Alert v-if="error" type="error">{{ error }} <Button size="small" @click="load">重试</Button></Alert>
    <div class="space-layout">
      <aside class="space-tree panel" aria-label="空间导航">
        <div class="space-tree-heading">
          <strong>空间结构</strong
          ><Button v-if="canCreateCommunity" size="small" @click="openEditor('communities')">新增社区</Button>
        </div>
        <Input v-model="treeSearch" search placeholder="查找社区、楼栋或房间" aria-label="查找空间" />
        <Tree :data="treeData" :render="renderNode" @on-select-change="select" @on-toggle-expand="toggle" />
        <p v-if="!busy && !treeData[0].children.length" class="muted">当前没有可见空间</p>
        <Spin v-if="busy" fix />
      </aside>
      <div class="space-main">
        <div class="space-context panel">
          <div>
            <h2>{{ node.title }} <Tag v-if="node.row && node.row['档案状态'] === '停用'">已停用</Tag></h2>
            <p class="muted" data-testid="space-breadcrumb">{{ breadcrumb }}</p>
          </div>
        </div>
        <Tabs :value="category" @on-click="category = $event" class="space-tabs"
          ><TabPane label="房屋空间" name="space" /><TabPane label="设施点位" name="facilities" /><TabPane
            label="车位资源"
            name="parking"
        /></Tabs>
        <div v-if="category === 'space'" class="space-resource-toolbar">
          <Button
            v-if="canWrite('houses')"
            :disabled="!canImport"
            icon="ios-cloud-upload-outline"
            @click="importOpen = true"
            >房间CSV导入</Button
          >
        </div>
        <p v-if="creationHint" class="scope-summary">{{ creationHint }}</p>
        <Workspace
          :key="node.key + ':' + category"
          :info="info"
          :module="module"
          :embedded="true"
          :parent-context="context"
          :resource-parent="resourceParent"
          :resource-choices="resourceChoices"
          :create-allowed="createAllowed"
          :create-label="createLabel"
          :scope-node="scope"
          :context-label="breadcrumb"
          :path-for="locationFor"
          @refresh="refresh"
          @locate="locateRoom"
        />
      </div>
    </div>
    <Workspace
      ref="nodeActions"
      :info="info"
      :module="editingTable"
      :detail-only="true"
      :path-for="locationFor"
      @refresh="refresh"
    />
    <Modal
      v-model="importOpen"
      title="房间（房屋）导入"
      :footer-hide="true"
      width="1100"
      :mask-closable="false"
      ><ImportPanel v-if="importOpen" :scope="scope" :scope-label="breadcrumb" @refresh="refresh"
    /></Modal>
  </section>
</template>
<script>
import Workspace from './Workspace.vue'
import ImportPanel from '../components/ImportPanel.vue'
import { service } from '../services/foundation'
import {
  spaceTables,
  spaceNames,
  spaceKey,
  spaceTitle,
  spaceParents,
} from '../../../../prototype-shared/spaces.js'
export default {
  components: { Workspace, ImportPanel },
  props: ['info'],
  data: () => ({
    graph: {},
    selected: 'root',
    category: 'space',
    expanded: ['root', 'communities:C-A', 'estates:E-A'],
    treeSearch: '',
    busy: false,
    error: '',
    notice: '',
    importOpen: false,
    token: 0,
    editingTable: 'communities',
    spaceNames,
  }),
  computed: {
    nodes() {
      const nodes = {
        root: { key: 'root', title: '全部获准空间', table: 'root', id: '', parentKey: '', row: null },
      }
      for (const table of spaceTables)
        for (const row of this.graph[table] || []) {
          const parentKey =
            table === 'communities'
              ? 'root'
              : table === 'estates'
                ? spaceKey('communities', row['所属社区'])
                : table === 'buildings'
                  ? spaceKey('estates', row['所属小区'])
                  : table === 'units'
                    ? spaceKey('buildings', row['所属楼栋'])
                    : row['所属单元']
                      ? spaceKey('units', row['所属单元'])
                      : spaceKey('buildings', row['所属楼栋'])
          nodes[spaceKey(table, row._id)] = {
            key: spaceKey(table, row._id),
            table,
            id: row._id,
            title: spaceTitle(table, row) + (table === 'houses' ? '室' : ''),
            parentKey,
            row,
          }
        }
      return nodes
    },
    node() {
      return this.nodes[this.selected] || this.nodes.root
    },
    treeData() {
      const build = (node) => {
        const children = Object.values(this.nodes)
          .filter((n) => n.parentKey === node.key)
          .map(build)
          .filter(Boolean)
        const matched =
          !this.treeSearch || node.title.toLowerCase().includes(this.treeSearch.trim().toLowerCase())
        if (node.key !== 'root' && !matched && !children.length) return null
        return {
          ...node,
          children,
          expand: !!this.treeSearch || this.expanded.includes(node.key),
          selected: node.key === this.selected,
        }
      }
      return [build(this.nodes.root)]
    },
    scope() {
      return { table: this.node.table, id: this.node.id }
    },
    breadcrumb() {
      return this.pathForNode(this.node) || '当前身份授权范围'
    },
    module() {
      return this.category === 'space' ? 'houses' : this.category
    },
    resourceParent() {
      return ['estates', 'buildings'].includes(this.node.table) ? this.scope : null
    },
    resourceChoices() {
      if (!['root', 'communities'].includes(this.node.table)) return []
      return Object.values(this.nodes)
        .filter(
          (n) =>
            ['estates', 'buildings'].includes(n.table) &&
            this.activeBranch(n) &&
            (this.node.table === 'root' || n.row['所属社区'] === this.node.id),
        )
        .map((n) => ({
          table: n.table,
          id: n.id,
          label: this.pathForNode(n),
          context: {
            所属社区: n.row['所属社区'],
            所属小区: n.table === 'estates' ? n.id : n.row['所属小区'],
            关联楼栋: n.table === 'buildings' ? n.id : '',
          },
        }))
    },
    context() {
      const c = spaceParents(this.node.table, this.node.row)
      if (this.category !== 'space') {
        c['关联楼栋'] = this.node.table === 'buildings' ? this.node.id : ''
        delete c['所属楼栋']
        delete c['所属单元']
      }
      return c
    },
    createLabel() {
      return this.category === 'space' ? '新增房间' : this.category === 'facilities' ? '新增设施' : '新增车位'
    },
    createAllowed() {
      return (
        this.activeBranch(this.node) &&
        (this.category === 'space'
          ? this.node.table !== 'houses'
          : !!this.resourceParent || this.resourceChoices.length > 0)
      )
    },
    canImport() {
      return this.node.table !== 'houses' && this.activeBranch(this.node) && this.canWrite('houses')
    },
    canCreateCommunity() {
      return this.info.actor.role !== 'property' && this.canWrite('communities')
    },
    creationHint() {
      if (!this.activeBranch(this.node))
        return '当前节点或上级已停用，可查看历史；恢复启用后才能新增资源或导入。'
      if (this.category === 'space' && this.node.table === 'houses')
        return '当前为房间本身；请从上级新增或使用左侧“新增同级”，导入请选择上级位置。'
      if (this.category !== 'space' && ['units', 'houses'].includes(this.node.table))
        return '当前节点没有直属设施或车位；新增资源请先选择小区或楼栋。'
      return this.category !== 'space' && ['root', 'communities'].includes(this.node.table)
        ? '汇总当前范围内资源；新增时请选择实际归属的小区或楼栋。'
        : ''
    },
  },
  watch: {
    '$route.query.node'(key) {
      if (!this.busy) this.choose(key || 'root', false)
    },
  },
  created() {
    this.unsubscribe = service.onChange(this.load)
    this.load()
  },
  beforeDestroy() {
    this.token++
    this.unsubscribe?.()
  },
  methods: {
    canWrite(table) {
      return this.info.actor.permissions.includes('write:' + table)
    },
    activeBranch(node) {
      let n = node
      while (n?.row) {
        if (n.row['档案状态'] === '停用') return false
        n = this.nodes[n.parentKey]
      }
      return !!node
    },
    pathForNode(node) {
      const parts = []
      let n = node
      while (n && n.key !== 'root') {
        parts.unshift(n.title)
        n = this.nodes[n.parentKey]
      }
      return parts.join(' / ')
    },
    locationFor(row) {
      return ['所属社区', '所属小区', '所属楼栋', '所属单元']
        .map((f, i) => {
          const id = row[f] || (f === '所属楼栋' ? row['关联楼栋'] : '')
          return id
            ? this.nodes[spaceKey(['communities', 'estates', 'buildings', 'units'][i], id)]?.title ||
                row._labels?.[f] ||
                ''
            : ''
        })
        .filter(Boolean)
        .join(' / ')
    },
    async load() {
      const token = ++this.token,
        previous = this.node
      this.busy = true
      this.error = ''
      try {
        const graph = {}
        for (const t of spaceTables)
          graph[t] = this.info.actor.permissions.includes('read:' + t) ? await service.query(t) : []
        if (token !== this.token) return
        this.graph = graph
        let key = this.$route.query.node || this.selected
        if (!this.nodes[key] && previous?.parentKey) key = previous.parentKey
        this.choose(key, false)
      } catch (e) {
        if (token === this.token) this.error = e.message
      } finally {
        if (token === this.token) this.busy = false
      }
    },
    choose(key, navigate = true) {
      if (!this.nodes[key]) {
        this.notice = '所选位置已不可访问，已返回当前获准空间。'
        key = 'root'
      }
      this.selected = key
      if (navigate && this.$route.query.node !== key)
        this.$router.replace({ path: '/spaces', query: key === 'root' ? {} : { node: key } })
    },
    select(selected, current) {
      if (selected.length) this.choose((current || selected[0]).key)
    },
    toggle(node) {
      const set = new Set(this.expanded)
      node.expand ? set.add(node.key) : set.delete(node.key)
      this.expanded = [...set]
    },
    childTable(node) {
      return {
        communities: 'estates',
        estates: 'buildings',
        buildings: node.row?.['是否设单元'] === '是' ? 'units' : 'houses',
        units: 'houses',
      }[node.table]
    },
    canAddSibling(node) {
      return (
        (node.table !== 'communities' || this.canCreateCommunity) &&
        this.canWrite(node.table) &&
        this.activeBranch(this.nodes[node.parentKey])
      )
    },
    canAddChild(node) {
      const table = this.childTable(node)
      return !!table && this.canWrite(table) && this.activeBranch(node)
    },
    renderNode(h, { data }) {
      const title = h(
        'span',
        {
          attrs: { 'data-space-node': data.key },
          class: { 'space-node-disabled': data.row?.['档案状态'] === '停用' },
        },
        [
          data.title,
          h(
            'small',
            data.row?.['档案状态'] === '停用'
              ? ' 已停用'
              : data.children?.length
                ? ' (' + data.children.length + ')'
                : '',
          ),
        ],
      )
      if (!data.row) return title
      const actions = [
        h('DropdownItem', { props: { name: 'view' } }, '查看详情'),
        h('DropdownItem', { props: { name: 'sibling', disabled: !this.canAddSibling(data) } }, '新增同级'),
      ]
      if (this.childTable(data))
        actions.push(
          h('DropdownItem', { props: { name: 'child', disabled: !this.canAddChild(data) } }, '新增下级'),
        )
      actions.push(
        h('DropdownItem', { props: { name: 'edit', disabled: !this.canWrite(data.table) } }, '编辑节点'),
        h(
          'DropdownItem',
          { props: { name: 'status', disabled: !this.canWrite(data.table) } },
          data.row['档案状态'] === '停用' ? '启用' : '停用',
        ),
      )
      return h('span', { class: 'space-tree-node' }, [
        title,
        h(
          'Dropdown',
          {
            props: { trigger: 'click', transfer: true, placement: 'bottom-end' },
            on: { 'on-click': (action) => this.treeAction(data, action) },
            nativeOn: { click: (e) => e.stopPropagation() },
          },
          [
            h(
              'Button',
              {
                props: { size: 'small', type: 'text' },
                attrs: { 'data-space-actions': data.key, 'aria-label': data.title + '更多操作' },
              },
              '更多',
            ),
            h('DropdownMenu', { slot: 'list' }, actions),
          ],
        ),
      ])
    },
    async openEditor(table, row = null, context = {}, label = '') {
      this.editingTable = table
      await this.$nextTick()
      this.$refs.nodeActions.edit(row, { context, label })
    },
    async treeAction(node, action) {
      if (action === 'sibling' && this.canAddSibling(node)) {
        const parent = this.nodes[node.parentKey]
        return this.openEditor(
          node.table,
          null,
          spaceParents(parent.table, parent.row),
          this.pathForNode(parent),
        )
      }
      if (action === 'child' && this.canAddChild(node)) {
        this.expanded = [...new Set([...this.expanded, node.key])]
        return this.openEditor(
          this.childTable(node),
          null,
          spaceParents(node.table, node.row),
          this.pathForNode(node),
        )
      }
      this.editingTable = node.table
      await this.$nextTick()
      if (action === 'view') return this.$refs.nodeActions.details(node.row)
      if (action === 'edit' && this.canWrite(node.table)) return this.$refs.nodeActions.edit(node.row)
      if (action === 'status' && this.canWrite(node.table))
        return this.$refs.nodeActions.openRowAction(node.row, 'status')
    },
    locateRoom(row) {
      const key = spaceKey('houses', row._id)
      let n = this.nodes[key]
      const set = new Set(this.expanded)
      while (n) {
        set.add(n.key)
        n = this.nodes[n.parentKey]
      }
      this.expanded = [...set]
      this.treeSearch = ''
      this.choose(key)
    },
    refresh() {
      this.load()
      this.$emit('refresh')
    },
  },
}
</script>
