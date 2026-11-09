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
          <strong>空间结构</strong>
        </div>
        <Input v-model="treeSearch" search placeholder="查找小区、楼栋或房间" aria-label="查找空间" />
        <div class="space-tree-toolbar" data-space-tree-toolbar>
          <Button
            type="primary"
            icon="md-add"
            :disabled="!canAddChild(node)"
            :data-space-add-child="node.key"
            data-space-toolbar-child
            @click="treeAction(node, 'child')"
            >新增下级</Button
          >
          <Button
            icon="md-copy"
            :disabled="!canAddSibling(node)"
            :data-space-add-sibling="node.key"
            data-space-toolbar-sibling
            @click="treeAction(node, 'sibling')"
            >新增同级</Button
          >
        </div>
        <div class="space-tree-current" data-space-toolbar-context :title="breadcrumb">
          <span>当前节点</span><strong>{{ node.title }}</strong>
          <Button
            v-if="node.row"
            size="small"
            icon="ios-information-circle-outline"
            title="查看节点详情"
            aria-label="查看节点详情"
            data-space-current-detail
            @click="treeAction(node, 'view')"
          />
        </div>
        <div class="space-tree-viewport" data-space-tree-viewport>
          <Tree :data="treeData" :render="renderNode" @on-select-change="select" @on-toggle-expand="toggle" />
          <p v-if="!busy && !treeData[0].children.length" class="muted">当前没有可见空间</p>
        </div>
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
          ><TabPane :label="'房屋空间（' + resourceCounts.houses + '）'" name="space" /><TabPane :label="'设施点位（' + resourceCounts.facilities + '）'" name="facilities" /><TabPane
            :label="'车位资源（' + resourceCounts.parking + '）'"
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
          :context-label="creationBreadcrumb"
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
    <Modal v-model="rootNameOpen" title="编辑空间目录名称" :footer-hide="true" width="500">
      <Alert v-if="rootNameError" type="error">{{ rootNameError }}</Alert>
      <Form @submit.native.prevent label-position="top"
        ><FormItem label="目录名称" required
          ><Input
            v-model="rootNameValue"
            placeholder="填写空间目录名称"
            :disabled="rootNameSaving" /></FormItem
      ></Form>
      <div class="toolbar">
        <Button type="primary" :loading="rootNameSaving" @click="saveRootName">保存</Button
        ><Button @click="rootNameOpen = false">取消</Button>
      </div>
    </Modal>
  </section>
</template>
<script>
import Workspace from './Workspace.vue'
import ImportPanel from '../components/ImportPanel.vue'
import { service } from '../services/foundation'
import { countSpaceResources } from '../../../../prototype-shared/r3-product.js'
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
    expanded: ['root', 'estates:E-A'],
    treeSearch: '',
    busy: false,
    error: '',
    notice: '',
    importOpen: false,
    token: 0,
    editingTable: 'communities',
    rootNameOpen: false,
    rootNameValue: '',
    rootNameError: '',
    rootNameSaving: false,
    spaceNames,
  }),
  computed: {
    nodes() {
      const nodes = {
        root: {
          key: 'root',
          title: this.info.spaceRootName || '大光路社区',
          table: 'root',
          id: '',
          parentKey: '',
          row: null,
        },
      }
      for (const table of spaceTables.filter(t => t !== 'communities'))
        for (const row of this.graph[table] || []) {
          const parentKey =
            table === 'communities'
              ? 'root'
              : table === 'estates'
                ? 'root'
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
    resourceCounts() { return countSpaceResources(this.graph, this.scope) },
    breadcrumb() {
      return this.pathForNode(this.node) || '当前身份授权范围'
    },
    module() {
      return this.category === 'space' ? 'houses' : this.category
    },
    creationNode() {
      return this.node.table === 'houses' ? this.nodes[this.node.parentKey] || this.nodes.root : this.node
    },
    creationBreadcrumb() {
      return this.pathForNode(this.creationNode) || this.nodes.root.title
    },
    resourceParent() {
      return ['buildings', 'units'].includes(this.creationNode.table)
        ? { table: this.creationNode.table, id: this.creationNode.id }
        : null
    },
    resourceChoices() {
      const scope = this.creationNode
      return Object.values(this.nodes)
        .filter(
          (n) =>
            ['buildings', 'units'].includes(n.table) &&
            this.activeBranch(n) &&
            (scope.table === 'root' ||
              (scope.table === 'communities' && n.row['所属社区'] === scope.id) ||
              (scope.table === 'estates' &&
                (n.table === 'estates' ? n.id === scope.id : n.row['所属小区'] === scope.id)) ||
              (scope.table === 'buildings' &&
                (n.table === 'buildings'
                  ? n.id === scope.id
                  : n.table === 'units' && n.row['所属楼栋'] === scope.id)) ||
              (scope.table === 'units' && n.table === 'units' && n.id === scope.id)),
        )
        .map((n) => ({
          table: n.table,
          id: n.id,
          label: this.pathForNode(n),
          context: {
            所属社区: n.row['所属社区'],
            所属小区: n.table === 'estates' ? n.id : n.row['所属小区'],
            关联楼栋: n.table === 'buildings' ? n.id : n.table === 'units' ? n.row['所属楼栋'] : '',
            所属单元: n.table === 'units' ? n.id : '',
          },
        }))
    },
    context() {
      const c = spaceParents(this.creationNode.table, this.creationNode.row)
      if (this.category !== 'space') {
        if (c['所属楼栋']) c['关联楼栋'] = c['所属楼栋']
        delete c['所属楼栋']
      }
      return c
    },
    createLabel() {
      return this.category === 'space' ? '新增房间' : this.category === 'facilities' ? '新增设施' : '新增车位'
    },
    createAllowed() {
      return (
        this.activeBranch(this.creationNode) &&
        (this.category === 'space' ? true : !!this.resourceParent || this.resourceChoices.length > 0)
      )
    },
    canImport() {
      return this.node.table !== 'houses' && this.activeBranch(this.node) && this.canWrite('houses')
    },
    canCreateCommunity() {
      return this.info.actor.role !== 'property' && this.canWrite('communities')
    },
    canEditRootName() {
      return this.info.actor.role === 'platform'
    },
    creationHint() {
      if (!this.activeBranch(this.creationNode))
        return '当前所属位置已停用，可查看历史；请核对档案后再新增资源。'
      if (this.category === 'space' && this.node.table === 'houses')
        return '新增房间沿用当前房间的上级位置，当前房间不作为容器；CSV导入请选择上级位置。'
      if (this.category !== 'space' && this.node.table === 'houses')
        return '当前房间不作为资源归属；新增资源将归属于它的单元，无单元时归属于楼栋。'
      return this.category !== 'space' && ['root', 'communities'].includes(this.node.table)
        ? '汇总当前范围内资源；新增时请选择实际归属的楼栋或单元。'
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
        for (const t of [...spaceTables, 'facilities', 'parking'])
          graph[t] = this.info.actor.permissions.includes('read:' + t) ? await service.query(t) : []
        if (token !== this.token) return
        this.graph = graph
        let key = this.$route.query.node || this.selected
        if (key.startsWith('communities:')) { const estates = (graph.estates || []).filter(e => e['所属社区'] === key.slice(12)); key = estates.length === 1 ? spaceKey('estates', estates[0]._id) : 'root' }
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
      if (navigate && (this.$route.query.node || 'root') !== key)
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
        root: 'estates',
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
      if (node.table === 'root') return this.canWrite('estates')
      return !!table && this.canWrite(table) && this.activeBranch(node)
    },
    renderNode(h, { data }) {
      const inactive = data.row?.['档案状态'] === '停用'
      const icons = {
        root: 'ios-folder-outline',
        communities: 'md-map',
        estates: 'md-home',
        buildings: 'md-albums',
        units: 'ios-grid-outline',
        houses: 'ios-home-outline',
      }
      const title = h(
        'button',
        {
          attrs: { type: 'button', 'data-space-node': data.key, title: this.pathForNode(data) || data.title },
          class: { 'space-node-label': true, 'space-node-disabled': inactive },
          on: {
            click: (e) => {
              e.stopPropagation()
              this.choose(data.key)
            },
          },
        },
        [
          h('Icon', { class: 'space-node-icon', props: { type: icons[data.table] }, attrs: { 'aria-hidden': 'true' } }),
          h('span', { class: 'space-node-name' }, data.title),
          inactive ? h('small', {class:'space-node-state'}, '不可用') : null,
        ],
      )
      const controls = []
      const iconButton = (icon, label, attrs, action) => h('Button', {
        class: 'space-node-action',
        props: { size: 'small', icon },
        attrs: { ...attrs, title: label, 'aria-label': label },
        on: { click: (e) => { e.stopPropagation(); action() } },
      })
      if (data.table === 'root') {
        if (this.canEditRootName)
          controls.push(iconButton('ios-create-outline', '编辑根名称', { 'data-space-root-edit': 'root' }, () => this.openRootName()))
      } else if (data.table !== 'houses' && this.canWrite(data.table)) {
        controls.push(iconButton('ios-create-outline', '编辑' + data.title, { 'data-space-edit': data.key }, () => this.treeAction(data, 'edit')))
        controls.push(iconButton(
          'ios-trash-outline',
          '删除' + data.title,
          { 'data-space-delete': data.key },
          () => this.treeAction(data, 'delete'),
        ))
      }
      return h('span', { class: { 'space-tree-node': true, 'is-current': data.key === this.selected } }, [
        title,
        controls.length ? h('span', {
          class: 'space-node-tools',
          style: { width: controls.length === 1 ? '32px' : '62px' },
          attrs: { 'aria-label': '节点操作', 'aria-hidden': data.key !== this.selected ? 'true' : null },
        }, data.key === this.selected ? controls : []) : null,
      ])
    },
    async openEditor(table, row = null, context = {}, label = '') {
      this.editingTable = table
      await this.$nextTick()
      this.$refs.nodeActions.edit(row, { context, label })
    },
    openRootName() {
      if (!this.canEditRootName) return
      this.rootNameValue = this.info.spaceRootName || '大光路社区'
      this.rootNameError = ''
      this.rootNameOpen = true
    },
    async saveRootName() {
      this.rootNameSaving = true
      this.rootNameError = ''
      try {
        const result = await service.command('space-root', { name: this.rootNameValue })
        this.rootNameOpen = false
        this.$Message.success(result.message || '目录名称已保存')
        this.refresh()
      } catch (e) {
        this.rootNameError = e.message
      } finally {
        this.rootNameSaving = false
      }
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
      if (action === 'delete' && this.canWrite(node.table))
        return this.$refs.nodeActions.removeRow(node.row)
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
    refresh(payload) {
      if (
        this.node.table === 'houses' &&
        payload?.created &&
        ['houses', 'facilities', 'parking'].includes(payload.table)
      ) {
        const parent = this.creationNode
        if (parent && this.nodes[parent.key]) this.choose(parent.key)
      }
      this.load()
      this.$emit('refresh')
    },
  },
}
</script>
