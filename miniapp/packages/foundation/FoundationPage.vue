<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { APP, service, navigation } from '@/services/foundation'
import AppPage from '../ui/components/AppPage.vue'
import AppNavbar from '../ui/components/AppNavbar.vue'
import AppTabbar from '../ui/components/AppTabbar.vue'
import AppButton from '../ui/components/AppButton.vue'
import AppIcon from '../ui/components/AppIcon.vue'
import BaseCard from '../ui/components/BaseCard.vue'
import AccountSwitch from './AccountSwitch.vue'
import MobileFields from './MobileFields.vue'
import { catalog } from '@core/catalog.js'
import { detailVisible } from '@core/core.js'
const props = withDefaults(
  defineProps<{ mode: string; table?: string; id?: string; kind?: string; previous?: string }>(),
  { table: '', id: '', kind: '绑定', previous: '' },
)
const info = ref<any>(null),
  rows = ref<any[]>([]),
  record = ref<any>(null),
  history = ref<any[]>([]),
  error = ref(''),
  success = ref(''),
  busy = ref(false),
  filter = ref(''),
  form = ref<Record<string, any>>({}),
  fieldErrors = ref<Record<string, string>>({}),
  loaded = ref(false),
  failSave = ref(false),
  houses = ref<any[]>([]),
  validity = ref(false),
  generation = ref(0),
  communityCounts = ref<Record<string, any>>({}),
  communitySources = ref<any[]>([]),
  avatarUrl = ref(''),
  profileName = ref(''),
  identityStamp = ref('')
const top = computed(() =>
  ['home', 'profile', 'service', 'mall', 'workbench', 'operation', 'order', 'archive'].includes(props.mode),
)
const activePath = computed(() => navigation.find((n: any) => n.mode === props.mode)?.path || '')
const title = computed(
  () =>
    (
      ({
        home: '大光路社区',
        profile: '我的',
        service: '社区服务',
        mall: '商城',
        workbench: '工作台',
        operation: '经营',
        order: '订单',
        archive: '档案',
        apply: '关系' + (props.kind || '绑定') + '申请',
        edit:
          props.table === 'profile' ? '本人资料' : props.table === 'missing' ? '地址缺失反馈' : '车辆申报',
      }) as Record<string, string>
    )[props.mode] ||
    (catalog as any)[props.table]?.title ||
    '基础档案',
)
const permittedTables = computed(() =>
  ['estates', 'houses', 'residents', 'vehicles', 'facilities', 'personnel'].filter((t) =>
    info.value?.actor.permissions.includes('read:' + t),
  ),
)
const filteredRows = computed(() =>
  rows.value.filter(
    (r) => !filter.value || Object.values(r._labels || {}).some((v) => String(v).includes(filter.value)),
  ),
)
const currentFields = computed(() =>
  ((catalog as any)[props.table]?.fields || []).filter(
    (f: any) => record.value && f.name in record.value && detailVisible(props.table, record.value, f.name),
  ),
)
const applyNames = computed(() => [
  '申请类型',
  '联系号码',
  '所属小区',
  '所属楼栋',
  '所属单元',
  ...(props.kind !== '解除' ? ['申请关系类型'] : []),
  '申请说明',
  '证明说明',
  '证明附件',
  ...(validity.value ? ['申请有效起始日', '申请有效结束日'] : []),
])
const houseOptions = computed(() =>
  houses.value.filter(
    (h) =>
      h['所属小区'] === form.value['所属小区'] &&
      h['所属楼栋'] === form.value['所属楼栋'] &&
      (!form.value['所属单元'] || h['所属单元'] === form.value['所属单元']),
  ),
)
const profileFormNames = ['头像', '昵称', '姓名', '手机号']
const vehicleFormNames = ['车牌号码', '车辆类型', '车辆颜色', '关联房屋', '登记说明']
const shortFields: Record<string, string[]> = {
  applications: ['申请类型', '房屋地址', '申请关系类型', '申请状态', '审核轮次', '提交时间'],
  relations: ['房屋地址', '关系类型', '关系状态'],
  houses: ['完整房屋地址', '房屋用途'],
  communities: ['社区地址', '社区简介'],
  vehicles: ['车牌号码', '车辆类型', '核实状态', '关联房屋'],
  facilities: ['点位类别', '具体位置', '接入状态'],
  personnel: ['岗位', '工作联系电话'],
  messages: ['消息内容', '发生时间', '阅读状态', '模拟发送状态'],
  residents: ['居民姓名', '联系电话', '关联房屋'],
}
function cardTitle(row: any) {
  if (APP === 'staff' && props.table === 'estates') return row._labels?.['小区名称'] || row['小区名称'] || '小区档案'
  if (APP === 'staff' && props.table === 'houses') return row._labels?.['完整房屋地址'] || row['完整房屋地址'] || [row._labels?.['所属小区'], row._labels?.['所属楼栋'], row._labels?.['所属单元'], row['房号'] && row['房号'] + '室'].filter(Boolean).join(' ') || '房屋档案'
  return row._labels?.[(catalog as any)[props.table].fields[0].name] || row._id
}
function open(mode: string, table = '', id = '', extra = '') {
  const path =
    mode === 'profileEdit'
      ? '/pages/profile/edit'
      : mode === 'apply'
        ? '/pages/foundation/relations/apply'
        : `/pages/foundation/${table}/${mode === 'detail' ? 'detail' : mode === 'edit' ? 'edit' : 'index'}`
  uni.navigateTo({ url: path + (id ? '?id=' + encodeURIComponent(id) : '?') + extra })
}
function stage01(path:string){uni.navigateTo({url:'/pages/stage01/'+path})}
function tab(path: string) {
  uni.redirectTo({ url: path })
}
async function load() {
  const request = ++generation.value
  error.value = ''
  busy.value = true
  try {
    const next = await service.info()
    if (request !== generation.value) return
    const stamp = next.actor._id + ':' + next.actor.role
    if (identityStamp.value && identityStamp.value !== stamp) {
      loaded.value = false
      // #ifdef H5
      if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value)
      // #endif
      avatarUrl.value = ''
      rows.value = []
      record.value = null
      form.value = {}
      success.value = ''
    }
    identityStamp.value = stamp
    info.value = next
    if (props.mode === 'profile' && APP === 'resident') {
      const me = (await service.query('residents'))[0]
      profileName.value = me._nickname || me['居民姓名'] || '未维护姓名'
      if (me._avatar) {
        const file = await service.ownedAttachment(me._avatar)
        // #ifdef H5
        if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value)
        avatarUrl.value = URL.createObjectURL(file.blob)
        // #endif
        // #ifdef MP-WEIXIN
        avatarUrl.value = file.path
        // #endif
      } else {
        // #ifdef H5
        if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value)
        // #endif
        avatarUrl.value = ''
      }
    }
    if (props.table === 'messages') {
      if (props.id) { const message=await service.record('messages',props.id); if(message._table && message._object){open('detail',message._table,message._object);return} }
      uni.redirectTo({url: APP === 'resident' ? '/pages/foundation/applications/index' : '/pages/profile/index'});return
    }
    if (['list', 'detail'].includes(props.mode)) {
      if (props.mode === 'list')
        rows.value = await service.labels(props.table, await service.query(props.table))
      else {
        record.value = (await service.labels(props.table, [await service.record(props.table, props.id)]))[0]
        history.value = await service.history(props.table, props.id)
        if (props.table === 'communities') {
          const summary = await service.summary(props.id)
          communityCounts.value = summary.counts
          communitySources.value = summary.sources
        }
        if (props.table === 'messages' && record.value['阅读状态'] !== '已读')
          await service.command('messageRead', { id: props.id })
      }
    }
    if (props.mode === 'apply') {
      houses.value = await service.query('houses')
      if (!loaded.value) {
        const me = (await service.query('residents'))[0]
        form.value = {
          申请类型: props.kind || '绑定',
          申请人姓名: me['居民姓名'],
          联系号码: me['联系电话'],
          申请说明: '',
          申请关系类型: '',
          证明附件: [],
        }
        if (props.id) {
          const h = houses.value.find((h) => h._id === props.id)
          if (h)
            form.value = {
              ...form.value,
              ...Object.fromEntries(
                ['所属社区', '所属小区', '所属楼栋', '所属单元', '房号'].map((k) => [k, h[k]]),
              ),
              _house: h._id,
            }
        }
      }
    }
    if (props.mode === 'edit' && !loaded.value) {
      if (props.table === 'profile') {
        const p = (await service.query('residents'))[0]
        form.value = {
          头像: p._avatar || '',
          昵称: p._nickname || '',
          姓名: p['居民姓名'],
          手机号: p['联系电话'],
        }
      } else if (props.table === 'missing') {
        const me = (await service.query('residents'))[0]
        form.value = { 联系号码: me['联系电话'] }
      } else form.value = props.id ? await service.record(props.table, props.id) : {}
    }
    if (props.mode === 'apply' && !loaded.value) {
      const draft = await service.draft('apply:' + props.kind + ':' + props.id)
      if (draft) {
        form.value = draft
        validity.value = !!draft._validity
      }
    }
    loaded.value = true
  } catch (e: any) {
    error.value = e.message
    rows.value = []
    record.value = null
  } finally {
    busy.value = false
  }
}
function setValidity(e: any) {
  validity.value = e.detail.value
}
function setFailure(e: any) {
  failSave.value = e.detail.value
}
function setHouse(e: any) {
  const h = houseOptions.value[Number(e.detail.value)]
  form.value = { ...form.value, _house: h._id, 房号: h['房号'] }
}
async function save() {
  busy.value = true
  error.value = ''
  fieldErrors.value = {}
  try {
    let result: any
    if (props.mode === 'apply')
      result = await service.command('apply', {
        data: { ...form.value, _validity: validity.value },
        previous: props.previous,
        fail: failSave.value,
        operation: 'apply-' + Date.now(),
      })
    else if (props.table === 'profile')
      result = await service.command('profile', { data: form.value, fail: failSave.value })
    else
      result = await service.command('save', {
        table: props.table,
        id: props.id || undefined,
        data: form.value,
        fail: failSave.value,
        operation: 'save-' + Date.now(),
      })
    success.value = result.message
    if (props.mode === 'apply') await service.draft('apply:' + props.kind + ':' + props.id, null)
    await load()
    if (props.mode === 'apply')
      uni.redirectTo({ url: '/pages/foundation/applications/detail?id=' + encodeURIComponent(result.id) })
    else if (props.table !== 'profile')
      uni.redirectTo({
        url: '/pages/foundation/' + props.table + '/detail?id=' + encodeURIComponent(result.id),
      })
  } catch (e: any) {
    error.value = e.message
    fieldErrors.value = e.fields || {}
  } finally {
    busy.value = false
  }
}
async function saveDraft() {
  await service.draft('apply:' + props.kind + ':' + props.id, { ...form.value, _validity: validity.value })
  success.value = '本地草稿已保存，尚未提交审核'
}
async function withdraw() {
  uni.showModal({
    title: '撤回本次申请？',
    content: '仅本人待审核申请可撤回，历史保留。',
    success: async (r) => {
      if (r.confirm)
        try {
          await service.command('withdraw', { id: props.id })
          await load()
        } catch (e: any) {
          error.value = e.message
        }
    },
  })
}
async function missing() {
  uni.navigateTo({ url: '/pages/foundation/missing/edit' })
}
async function saveMissing() {
  try {
    await service.command('save', { table: 'missing', data: form.value, fail: failSave.value })
    success.value = '地址缺失反馈已保存，尚未创建正式房屋'
    form.value = {}
  } catch (e: any) {
    error.value = e.message
    fieldErrors.value = e.fields || {}
  }
}
async function messageSend(failed = false) {
  try {
    await service.command('messageSend', { id: props.id, failed })
    await load()
  } catch (e: any) {
    error.value = e.message
  }
}
async function follow() {
  try {
    const r = record.value
    await service.record(r._table, r._object)
    open('detail', r._table, r._object)
  } catch (e: any) {
    error.value = e.message
  }
}
onShow(load)
const unsubscribe = service.onChange(() => {
  if (info.value) load()
})
onUnmounted(() => {
  unsubscribe()
  generation.value++
})
</script>
<template>
  <AppPage status="ready" :secondary="!top"
    ><template #navbar
      ><AppNavbar
        :title="title"
        :show-back="!top"
        :show-brand="props.mode === 'home'"
        :large="props.mode === 'home' || props.mode === 'workbench'"
    /></template>

    <view class="foundation-body" :class="{ 'has-tabs': top }">
      <view v-if="error" class="form-error"
        ><text>{{ error }}</text
        ><AppButton variant="quiet" @click="load">重新读取</AppButton></view
      ><text v-if="success" class="success-tip">{{ success }}</text
      ><view v-if="busy && !info" class="hint">正在加载…</view>
      <view v-if="APP==='resident' && ['home','service','profile'].includes(props.mode)" class="s1-entry"><text class="group-title">物业服务</text><view class="s1-entry-grid"><button @click="stage01('fees/index')">物业缴费</button><button @click="stage01('parking/index')">停车服务</button><button @click="stage01('repairs/index')">报事报修</button><button @click="stage01('hazards/index')">隐患随手拍</button><button @click="stage01('records/index')">业务记录</button></view></view><view v-if="APP==='staff' && ['workbench','profile'].includes(props.mode)" class="s1-entry"><text class="group-title">物业办理</text><view class="s1-entry-grid"><button @click="stage01('tasks/index')">工单待办</button><button @click="stage01('reports/create')">现场上报</button><button @click="stage01('charges/index')">收费查询</button></view></view>
      <template v-if="props.mode === 'home'"
        ><view class="community-line"
          ><AppIcon name="location" :size="18" /><text>大光路社区</text></view
        ><view class="home-hero"
          ><image src="/static/images/home/hero-community-life.png" mode="aspectFill" /><view
            ><text class="hero-title">邻里相伴，生活更安心</text><text>社区基础服务，从这里开始</text></view
          ></view
        ><BaseCard
          ><view class="quick-grid"
            ><view @click="open('list', 'relations')"
              ><AppIcon name="home" :size="28" /><text>我的房屋</text></view
            ><view @click="open('apply', '', '', '&kind=绑定')"
              ><AppIcon name="bill" :size="28" /><text>房屋绑定</text></view
            ><view @click="open('list', 'vehicles')"
              ><AppIcon name="car" :size="28" /><text>我的车辆</text></view
            ><view @click="open('list','applications')"><AppIcon name="bill" :size="28"/><text>申请记录</text></view></view
          ></BaseCard
        ><text class="group-title">社区基础服务</text
        ><BaseCard
          ><view class="entry-row" @click="open('list', 'applications')"
            ><view
              ><text class="entry-title">查看申请进度</text
              ><text class="hint">绑定、变更和解除的每一轮都有记录</text></view
            ><text>›</text></view
          ></BaseCard
        ><BaseCard
          ><view class="entry-row" @click="tab('/pages/mall/index')"
            ><view
              ><text class="entry-title">社区商城</text
              ><text class="hint">发现身边好物</text></view
            ><text>›</text></view
          ></BaseCard
        ></template
      >
      <template v-else-if="props.mode === 'profile'"
        ><BaseCard
          ><view class="identity-panel"
            ><view class="avatar"><AppIcon name="user" :size="32" /></view
            ><view
              ><text class="identity-name">{{ APP === 'resident' ? profileName || info?.actor.name : info?.actor.name }}</text
              ><text class="hint"
                >{{ APP === 'resident' ? '个人资料' : info?.actor.orgName || '' }} ·
                {{ info?.actor.roleName }}</text
              ></view
            ></view
          ><view v-if="APP === 'resident'" class="entry-row" @click="open('profileEdit')"
            ><text>个人资料</text><text>编辑 ›</text></view
          ></BaseCard
        ><BaseCard v-if="APP === 'resident'"
          ><view
            v-for="item in [
              { t: 'relations', n: '我的房屋' },
              { t: 'applications', n: '申请记录' },
              { t: 'vehicles', n: '我的车辆' },
              { t: 'missing', n: '地址缺失反馈' },
            ]"
            :key="item.t"
            class="entry-row"
            @click="open('list', item.t)"
            ><text>{{ item.n }}</text
            ><text>›</text></view
          ></BaseCard
        ><BaseCard v-else><text class="group-title">所属组织</text><text class="hint">{{info?.actor.orgName}}</text></BaseCard
        ><AccountSwitch v-if="info" :info="info" @changed="load"
      /></template>
      <template v-else-if="props.mode === 'workbench'"
        ><BaseCard
          ><text class="eyebrow">{{ APP === 'merchant' ? '商户工作台' : '社区与物业管理' }}</text
          ><text class="identity-name">{{ info?.actor.name }}</text
          ><text class="hint">当前所属组织：{{ info?.actor.orgName }}</text
          ><text class="hint">服务范围：{{ info?.actor.scopeLabel || '本主体' }}</text></BaseCard
        ><template v-if="APP === 'staff'"
          ><text class="group-title">基础档案查询</text
          ><view class="archive-grid"
            ><BaseCard v-for="t in permittedTables" :key="t"
              ><view @click="open('list', t)"
                ><AppIcon :name="t === 'houses' ? 'home' : 'bill'" :size="28" /><text class="entry-title">{{
                  (catalog as any)[t].title
                }}</text
                ><text class="hint">查看档案 ›</text></view
              ></BaseCard
            ></view
          ></template
        ><BaseCard v-else
          ><text class="group-title">经营入口</text
          ><text class="hint"
            >商品与订单管理</text
          ><AppButton variant="quiet" @click="tab('/pages/operation/index')"
            >商品管理</AppButton
          ></BaseCard
        ></template
      >
      <template v-else-if="props.mode === 'archive'"
        ><text class="hint">查找小区、房屋与物业工作联系。</text
        ><BaseCard v-for="t in permittedTables" :key="t"
          ><view class="entry-row" @click="open('list', t)"
            ><text>{{ (catalog as any)[t].title }}</text
            ><text>›</text></view
          ></BaseCard
        ></template
      >
      <template v-else-if="props.mode === 'service'"><text class="group-title">房屋服务</text><BaseCard><view class="entry-row" @click="open('list','relations')"><text>我的房屋</text><text>›</text></view><view class="entry-row" @click="open('list','applications')"><text>申请记录</text><text>›</text></view><view class="entry-row" @click="open('list','vehicles')"><text>我的车辆</text><text>›</text></view></BaseCard></template>
      <template v-else-if="props.mode === 'mall' || props.mode === 'operation'"><view class="list-toolbar"><input v-model="filter" :placeholder="props.mode === 'mall' ? '搜索商品' : '搜索商品名称'"/></view><BaseCard><view class="empty-state"><AppIcon name="shop" :size="42"/><text class="group-title">暂无商品</text><text class="hint">{{filter ? '未找到符合条件的商品' : '商品上架后将在这里展示'}}</text></view></BaseCard></template>
      <template v-else-if="props.mode === 'order'"><view class="order-filters"><button v-for="state in ['全部','待付款','待发货','待收货','已完成']" :key="state" :class="{'is-current':filter===state || (!filter && state==='全部')}" @click="filter=state">{{state}}</button></view><BaseCard><view class="empty-state"><AppIcon name="order" :size="42"/><text class="group-title">暂无订单</text></view></BaseCard></template>
      <template v-else-if="props.mode === 'list'"
        ><view class="list-toolbar"
          ><input v-model="filter" placeholder="搜索当前列表" :maxlength="-1" /><AppButton
            v-if="APP === 'resident' && props.table === 'relations'"
            size="compact"
            @click="open('apply', '', '', '&kind=绑定')"
            >添加房屋</AppButton
          ><AppButton
            v-if="APP === 'resident' && props.table === 'vehicles'"
            size="compact"
            @click="open('edit', 'vehicles')"
            >申报车辆</AppButton
          ></view
        ><text v-if="props.table === 'relations'" class="hint link" @click="open('list', 'applications')"
          >查看申请记录（与正式关系分开） ›</text
        ><view v-if="!filteredRows.length && !busy" class="empty-state"
          ><text class="group-title">暂无符合条件的记录</text
          ><text class="hint">可调整搜索条件后重试。</text
          ><AppButton variant="quiet" @click="load">重新读取</AppButton></view
        ><BaseCard v-for="r in filteredRows" :key="r._id"
          ><view @click="open('detail', props.table, r._id)"
            ><text class="entry-title">{{
              cardTitle(r)
            }}</text
            ><view v-for="f in shortFields[props.table] || []" :key="f" class="card-field"
              ><text>{{ f }}</text
              ><text>{{ r._labels[f] || '未维护' }}</text></view
            ><text class="hint link">查看详情与记录 ›</text></view
          ></BaseCard
        ></template
      >
      <template v-else-if="props.mode === 'detail' && record"
        ><BaseCard
          ><view
            v-for="f in currentFields"
            :key="f.name"
            class="detail-field"
            :data-field="props.table + ':' + f.name"
            ><text class="hint">{{ f.name }}</text
            ><text>{{ record._labels[f.name] || '未维护／不适用' }}</text></view
          ></BaseCard
        ><view
          class="actions"
          v-if="APP === 'resident' && props.table === 'relations' && record['关系状态'] === '有效'"
          ><AppButton variant="secondary" @click="open('apply', '', record._house, '&kind=变更')"
            >申请变更</AppButton
          ><AppButton variant="danger" @click="open('apply', '', record._house, '&kind=解除')"
            >申请解除</AppButton
          ></view
        ><template v-if="APP === 'resident' && props.table === 'applications'"
          ><AppButton v-if="record['申请状态'] === '待审核'" variant="secondary" @click="withdraw"
            >撤回待审申请</AppButton
          ><AppButton
            v-if="['已驳回', '已撤回'].includes(record['申请状态'])"
            @click="
              open('apply', '', record._house, '&kind=' + record['申请类型'] + '&previous=' + record._id)
            "
            >补充后重新提交</AppButton
          ></template
        ><AppButton
          v-if="APP === 'resident' && props.table === 'vehicles'"
          variant="secondary"
          @click="open('edit', 'vehicles', record._id)"
          >补充／更正后重提</AppButton>
<template v-if="props.table === 'communities'"
          ><text class="group-title">基础概况</text
          ><BaseCard
            ><view v-for="(v, k) in communityCounts" :key="k" class="control-row"
              ><text>{{ k }}</text
              ><text>{{ v }}</text></view
            ><text v-if="!communitySources.length" class="hint">社区提供的人口／户数：待提供／未维护</text
            ><text v-for="r in communitySources" :key="r._id" class="hint"
              >{{ r['指标名称'] }} {{ r['指标数值'] }}{{ r['计量单位'] }} · {{ r['统计口径说明'] }} ·
              {{ r['统计日期'] }}</text
            ></BaseCard
          ></template
        ><text class="group-title">操作记录</text
        ><BaseCard v-for="(h, i) in history" :key="i"
          ><text>{{ h['操作名称'] }} · {{ h['操作结果'] }}</text
          ><text class="hint">{{ h['操作时间'] }} · {{ h['操作人'] }}</text
          ><text class="hint">{{ h['操作说明／原因'] || '无补充说明' }}</text></BaseCard
        ><text v-if="!history.length" class="hint">暂无本轮操作记录</text></template
      >
      <template v-else-if="props.mode === 'apply'"
        ><BaseCard
          ><text class="group-title">{{ props.kind }}申请</text
          ><text class="hint"
            >姓名及联系号码自动带入个人资料，请核对房屋信息。</text
          ><text class="hint">申请人姓名：{{ form['申请人姓名'] }}；房屋选择不显示其他住户。</text></BaseCard
        ><BaseCard
          ><MobileFields
            table="applications"
            v-model="form"
            :names="
              applyNames.filter(
                (n) =>
                  n !== '申请类型' &&
                  (props.kind === '绑定' || !['所属社区', '所属小区', '所属楼栋', '所属单元'].includes(n)),
              )
            "
            :errors="fieldErrors"
          /><view v-if="props.kind !== '绑定'" class="readonly-field"
            ><text>房屋地址（只读）</text
            ><text class="hint">{{ houses.find((h) => h._id === form._house)?.['完整房屋地址'] }}</text></view
          ><picker
            v-if="props.kind === '绑定'"
            :range="houseOptions"
            range-key="完整房屋地址"
            @change="setHouse"
            ><view class="control-row"
              ><text>房号 *</text><text>{{ form['房号'] || '选择房屋' }} ›</text></view
            ></picker
          ><text class="hint link" @click="missing">找不到房屋？反馈地址缺失 ›</text
          ><switch :checked="validity" @change="setValidity" /><text class="hint"
            >设置关系有效期</text
          ></BaseCard>
<AppButton variant="secondary" @click="saveDraft">保存本地草稿</AppButton
        ><AppButton :loading="busy" @click="save">提交{{ props.kind }}申请</AppButton></template
      >
      <template v-else-if="props.mode === 'edit'"
        ><BaseCard
          ><MobileFields
            :table="props.table"
            v-model="form"
            :names="
              props.table === 'profile'
                ? profileFormNames
                : props.table === 'missing'
                  ? ['社区', '小区名称或地址', '具体房屋描述', '联系号码']
                  : vehicleFormNames
            "
            :errors="fieldErrors" /></BaseCard>
<AppButton :loading="busy" @click="props.table === 'missing' ? saveMissing() : save()">{{
          props.table === 'missing' ? '提交地址缺失反馈' : '保存资料'
        }}</AppButton>
</template
      > </view
    ><template #tabbar><AppTabbar v-if="top" :items="navigation" :active-path="activePath" /></template
  ></AppPage>
</template>

<style scoped>.s1-entry{padding:16px;background:white;border-radius:12px;margin:16px 0}.s1-entry-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.s1-entry-grid button{font-size:15px;padding:12px 8px;line-height:1.6;color:#225e46;background:#edf5f0;min-height:48px}.order-filters{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.order-filters button{font-size:14px;padding:8px;min-height:40px}.order-filters .is-current{color:#225e46;background:#edf5f0}</style>
