import * as stage01 from './stage01/index.js'
import { seed as seedStage01 } from './stage01/seed.js'
import { roleInApp } from './core.js'
import { upgradeState, upgradeIdentity, defaultIdentity, ordinaryAccounts, R1_SCHEMA } from './r1-migration.js'
// WeChat-only local storage; no browser module or browser global is imported here.
import {
  createSeed,
  execute,
  query,
  record,
  dashboard,
  actorFor,
  historyFor,
  optionsFor,
  display,
  fileVersions,
  scopeOptions,
  communitySummary,
  authorizeAttachment,
} from './core.js'
export function createUniAdapter(app) {
  const key = 'dgl-community-prototype-stage00:' + app,
    defaults = defaultIdentity,
    identityKey = key + ':identity'
  let context = uni.getStorageSync(identityKey) || { app, account: defaults[app], role: '' },
    listeners = [],
    queue = Promise.resolve()
  context = upgradeIdentity(context, app)
  const read = () => { const stored = uni.getStorageSync(key); const s = stored || createSeed(); upgradeState(s); stage01.prepare(s, stored ? "" : "stage01-wechat"); seedStage01(s); return s },
    save = (s) => uni.setStorageSync(key, s)
  const notify = () => listeners.forEach((f) => f())
  const api = {
    app,
    session: '微信本端样例',
    context: () => ({ ...context }),
    onChange(f) {
      listeners.push(f)
      return () => (listeners = listeners.filter((x) => x !== f))
    },
    async start() {
      save(read())
      uni.setStorageSync(identityKey, context)
      return api.info()
    },
    async info() {
      const s = read()
      return {
        session: api.session,
        version: s.version,
        generation: s.generation,
        ...dashboard(s, context),
        accounts: ordinaryAccounts(s, app)
          .map((a) => ({
            id: a._id,
            name: a['人员姓名'],
            roles: a['授权角色']
              .filter((r) => roleInApp(app, r))
              .map((r) => ({
                id: r,
                name: s.roles.find((x) => x._id === r)?.['角色名称'],
              })),
          })),
      }
    },
    async identity(account, role) {
      const next = { app, account, role, identityVersion: R1_SCHEMA }
      actorFor(read(), next)
      context = next
      uni.setStorageSync(identityKey, next)
      notify()
      return api.info()
    },
    async scopes() {
      return scopeOptions(read(), context)
    },
    async scope(community, estate) {
      const opts = scopeOptions(read(), context)
      if (community && !opts.communities.some((c) => c.value === community)) throw Error('上下文不能扩大授权')
      if (estate && !opts.estates.some((e) => e.value === estate)) throw Error('上下文不能扩大授权')
      context = { ...context, community, estate }
      uni.setStorageSync(identityKey, context)
      notify()
    },
    async query(t, f) {
      return query(read(), context, t, f)
    },
    async record(t, id) {
      return record(read(), context, t, id)
    },
    async history(t, id) {
      return historyFor(read(), context, t, id)
    },
    async options(t, f, d) {
      return optionsFor(read(), context, t, f, d)
    },
    async label(t, k, v) {
      return display(read(), t, k, v)
    },
    async summary(id) {
      return communitySummary(read(), context, id)
    },
    async labels(t, rows) {
      const s = read()
      return rows.map((r) => ({
        ...r,
        _labels: Object.fromEntries(
          Object.entries(r)
            .filter(([k]) => !k.startsWith('_'))
            .map(([k, v]) => [k, display(s, t, k, v)]),
        ),
      }))
    },
    command(c, p = {}) {
      const pending = queue.then(() => {
        const s = read(),
          result = execute(s, context, c, p)
        save(s)
        notify()
        return result
      })
      queue = pending.catch(() => {})
      return pending
    },
    async draft(k, data) {
      const s = read(),
        id = context.account + ':' + k
      s.drafts = s.drafts || {}
      if (data === undefined) return s.drafts[id] || null
      if (data === null) delete s.drafts[id]
      else s.drafts[id] = JSON.parse(JSON.stringify(data))
      save(s)
      return data
    },
    async reset() {
      const s = createSeed()
      s.generation = (read().generation || 0) + 1
      save(s)
      notify()
    },
    async sample(name) {
      const s = createSeed()
      if (name === 'approved') {
        const context = { app: 'resident', account: 'resident-a', role: 'resident' }
        const r = execute(s, context, 'apply', {
          data: {
            _house: 'H-A',
            申请类型: '绑定',
            申请关系类型: '业主',
            申请说明: '预置样例切换，不是跨App同步',
          },
        })
        execute(s, { app: 'web', account: 'audit', role: 'reviewer' }, 'review', {
          id: r.id,
          decision: '通过',
          对外审核说明: '预置已通过样例',
        })
      }
      save(s)
      notify()
    },
    async upload(file, { fail = false } = {}) {
      if (fail) throw Error('模拟附件失败，请重试')
      if (file.size > 10 * 1024 * 1024) throw Error('超过本轮10 MiB演示技术限制')
      const stored = await new Promise((res, rej) =>
        uni.saveFile({ tempFilePath: file.path, success: res, fail: rej }),
      )
      const id = 'local-' + Date.now(),
        s = read()
      s.attachments[id] = {
        name: file.name || '本地样例.png',
        size: file.size || 0,
        path: stored.savedFilePath,
        owner: context.account,
      }
      save(s)
      return { id, ...s.attachments[id] }
    },
    async versions(id) {
      return fileVersions(read(), context, id)
    },
    async ownedAttachment(id) {
      const m = read().attachments[id]
      if (!m || m.owner !== context.account) throw Error('无权读取本地附件')
      return m
    },
    async attachment(p) {
      const s = read(),
        id = authorizeAttachment(s, context, p)
      return s.attachments[id]
    },
  }
  const stage01Write = fn => { const pending = queue.then(() => { const s = read(), value = fn(s); save(s); notify(); return value }); queue = pending.catch(() => {}); return pending }
  api.stage01 = {
    query: async (table, filters) => stage01.query(read(), context, table, filters),
    record: async (table, id) => stage01.record(read(), context, table, id),
    options: async () => stage01.options(read(), context),
    overview: async () => stage01.overview(read(), context),
    importPreview: async p => stage01.importPreview(read(), context, p),
    command: (name, p = {}) => stage01Write(s => stage01.command(s, context, name, p)),
    auxiliary: (name, p = {}) => stage01Write(s => stage01.auxiliary(s, context, name, p)),
    reset: () => stage01Write(s => { stage01.reset(s, context); seedStage01(s) }),
    async upload(file, options = {}) { const r = await api.upload(file, options); await stage01Write(s => { Object.assign(s.attachments[r.id], {stage01:true, uploadedAt:new Date().toISOString(), uploader:stage01.options(s, context).actor.name, status:'成功'}) }); return r },
    async attachment(p) { const s = read(), id = stage01.attachmentId(s, context, p); return s.attachments[id] },
    async accounts() { return [{id:'property-colleague',name:'陈晓',roles:[{id:'property',name:'物业管理员'}]}] },
  }
  return api
}
