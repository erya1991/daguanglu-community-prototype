import * as serviceDomain from './service/index.js'
import * as stage01 from './stage01/index.js'
import { cleanupStage01Attachments } from './stage01/upgrade.js'
import { upgradeProductState } from './r3-product.js'
import { seed as seedStage01 } from './stage01/seed.js'
import { roleInApp } from './core.js'
import { upgradeState, upgradeIdentity, defaultIdentity, ordinaryAccounts, R1_SCHEMA } from './r1-migration.js'
// Browser-only adapter. MP builds select storage-uni.js and never import this file.
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
  authorizeAttachment,
  DomainError,
  scopeOptions,
  exportData,
  communitySummary,
  statistics,
} from './core.js'
import { previewImport, commitImport } from './import-houses.js'
export const NAMESPACE = 'dgl-community-prototype-stage00'
let opened
function db() {
  if (!opened)
    opened = new Promise((resolve, reject) => {
      const q = indexedDB.open(NAMESPACE, 1)
      q.onupgradeneeded = () => {
        q.result.createObjectStore('sessions')
        q.result.createObjectStore('blobs')
      }
      q.onsuccess = () => resolve(q.result)
      q.onerror = () => reject(new Error('浏览器存储不可用，请允许此原型使用本地存储'))
    })
  return opened
}
const req = (q) =>
  new Promise((res, rej) => {
    q.onsuccess = () => res(q.result)
    q.onerror = () => rej(q.error)
  })
export function createBrowserAdapter(app) {
  const url = new URL(location.href),
    session =
      (url.searchParams.get('session') || 'demo').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'demo'
  const identityKey = NAMESPACE + ':' + session + ':' + app + ':identity',
    signalKey = NAMESPACE + ':' + session + ':changed'
  const defaultAccount = session.startsWith('stage01-') ? ({web:'property-admin',resident:'resident-b',staff:'property-admin',merchant:'merchant'})[app] : defaultIdentity[app]
  let context = { app, account: defaultAccount, role: '' },
    listeners = []
  try {
    context = { ...context, ...JSON.parse(localStorage.getItem(identityKey) || '{}'), app }
  } catch {}
  context = upgradeIdentity(context, app)
  const notify = () => {
    localStorage.setItem(signalKey, Date.now() + ':' + Math.random())
    listeners.forEach((f) => f())
  }
  window.addEventListener('storage', (e) => {
    if (e.key === identityKey) {
      try {
        context = upgradeIdentity({ ...JSON.parse(e.newValue), app }, app)
      } catch {
        context = { app, account: defaultAccount, role: '' }
      }
    }
    if (e.key === signalKey || e.key === identityKey) listeners.forEach((f) => f())
  })
  window.addEventListener('focus', () => listeners.forEach((f) => f()))
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) listeners.forEach((f) => f())
  })
  async function transact(fn) {
    const database = await db()
    return new Promise((resolve, reject) => {
      const tx = database.transaction(['sessions', 'blobs'], 'readwrite'),
        store = tx.objectStore('sessions'),
        q = store.get(session)
      let value, error
      q.onsuccess = () => {
        try {
          const state = q.result || createSeed()
          upgradeState(state)
          upgradeProductState(state)
          stage01.prepare(state, session)
          seedStage01(state)
          serviceDomain.prepare(state, session)
          cleanupStage01Attachments(state, id => tx.objectStore('blobs').delete(session + ':' + id))
          value = fn(state, tx.objectStore('blobs'))
          store.put(state, session)
        } catch (e) {
          error = e
          tx.abort()
        }
      }
      tx.oncomplete = () => resolve(value)
      tx.onerror = () => reject(error || tx.error)
      tx.onabort = () => reject(error || new Error('本地保存失败，输入已保留'))
    })
  }
  async function read(fn) {
    const database = await db(),
      s = await req(database.transaction('sessions').objectStore('sessions').get(session))
    const state = s || createSeed()
    upgradeState(state)
    upgradeProductState(state)
          stage01.prepare(state, session)
          seedStage01(state)
          serviceDomain.prepare(state, session)
    return fn(state)
  }
  const api = {
    app,
    session,
    context: () => ({ ...context }),
    onChange(fn) {
      listeners.push(fn)
      return () => {
        listeners = listeners.filter((f) => f !== fn)
      }
    },
    async start() {
      await transact(() => true)
      localStorage.setItem(identityKey, JSON.stringify(context))
      return api.info()
    },
    async info() {
      return read((s) => ({
        session,
        version: s.version,
        generation: s.generation,
        ...dashboard(s, context),
        accounts: ordinaryAccounts(s, app)
          .map((a) => ({
            id: a._id,
            name: a['人员姓名'],
            roles: a['授权角色']
              .filter((r) => roleInApp(app, r))
              .filter((r) => s.roles.some((x) => x._id === r && x['角色状态'] === '启用'))
              .map((r) => ({ id: r, name: s.roles.find((x) => x._id === r)?.['角色名称'] })),
          })),
      }))
    },
    async identity(account, role) {
      const next = { app, account, role, identityVersion: R1_SCHEMA }
      await read((s) => actorFor(s, next))
      context = next
      localStorage.setItem(identityKey, JSON.stringify(context))
      listeners.forEach((f) => f())
      return api.info()
    },
    async scopes() {
      return read((s) => scopeOptions(s, context))
    },
    async scope(community, estate) {
      const options = await api.scopes()
      if (community && !options.communities.some((c) => c.value === community))
        throw new DomainError('选择上下文不能扩大授权')
      if (estate && !options.estates.some((e) => e.value === estate))
        throw new DomainError('小区不在当前授权内')
      context = { ...context, community, estate }
      localStorage.setItem(identityKey, JSON.stringify(context))
      listeners.forEach((f) => f())
    },
    async query(table, filters) {
      return read((s) => query(s, context, table, filters))
    },
    async summary(id) {
      return read((s) => communitySummary(s, context, id))
    },
    async statistics(filters) { return read(s => statistics(s, context, filters)) },
    async record(table, id) {
      return read((s) => record(s, context, table, id))
    },
    async history(table, id) {
      return read((s) => historyFor(s, context, table, id))
    },
    async exportRows(table, filters) {
      return read((s) => exportData(s, context, table, filters))
    },
    async options(table, field, data) {
      return read((s) => optionsFor(s, context, table, field, data))
    },
    async label(table, key, value) {
      return read((s) => display(s, table, key, value))
    },
    async labels(table, rows) {
      return read((s) =>
        rows.map((r) => ({
          ...r,
          _labels: Object.fromEntries(
            Object.entries(r)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k, v]) => [k, display(s, table, k, v)]),
          ),
        })),
      )
    },
    async command(command, p = {}) {
      const value = await transact((s) => execute(s, context, command, p))
      notify()
      return value
    },
    async draft(key, data) {
      const id = context.account + ':' + key
      if (data === undefined) return read((s) => s.drafts?.[id] || null)
      await transact((s) => {
        actorFor(s, context)
        s.drafts = s.drafts || {}
        if (data === null) delete s.drafts[id]
        else s.drafts[id] = JSON.parse(JSON.stringify(data))
      })
      return data
    },
    async reset() {
      await transact((s, blobs) => {
        const oldGeneration = s.generation
        for (const id of Object.keys(s.attachments)) blobs.delete(session + ':' + id)
        const seed = createSeed()
        for (const k of Object.keys(s)) delete s[k]
        Object.assign(s, seed, { generation: oldGeneration + 1 })
      })
      notify()
    },
    async upload(file, { fail = false } = {}) {
      if (fail) throw new DomainError('附件上传失败，请重试；表单内容已保留')
      const ext = file.name.split('.').pop().toLowerCase()
      if (!['pdf', 'png', 'jpg', 'jpeg', 'txt', 'docx', 'xlsx'].includes(ext))
        throw new DomainError('不支持该文件格式，请选择 PDF、PNG/JPEG、TXT、DOCX 或 XLSX')
      if (file.size > 10 * 1024 * 1024) throw new DomainError('文件不能超过10 MiB')
      const id = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2)
      await transact((s, blobs) => {
        actorFor(s, context)
        s.attachments[id] = { name: file.name, size: file.size, type: file.type, owner: context.account }
        blobs.put(file, session + ':' + id)
      })
      return { id, name: file.name, size: file.size, type: file.type }
    },
    async versions(id) {
      return read((s) => fileVersions(s, context, id))
    },
    async importPreview(text, source, scope) {
      return read((s) => previewImport(s, context, text, source, scope))
    },
    async importCommit(text, source, revision, scope) {
      const r = await transact((s) => commitImport(s, context, text, source, revision, scope))
      notify()
      return r
    },
    async attachment(params) {
      const descriptor = await read((s) => {
        const id = authorizeAttachment(s, context, params)
        if(s.attachments[id]?.stage02)serviceDomain.attachmentId(s,context,{attachmentId:id})
        return { id, meta: s.attachments[id] }
      })
      let blob
      if (descriptor.meta.text) blob = new Blob([descriptor.meta.text], { type: descriptor.meta.type })
      else {
        const database = await db()
        blob = await req(
          database
            .transaction('blobs')
            .objectStore('blobs')
            .get(session + ':' + descriptor.id),
        )
      }
      if (!blob) throw new DomainError('附件不可用，请重新选择文件')
      return { blob, name: descriptor.meta.name, type: descriptor.meta.type }
    },
    async ownedAttachment(id) {
      const meta = await read((s) => {
        actorFor(s, context)
        const m = s.attachments[id]
        if (!m || m.owner !== context.account) throw new DomainError('无权读取此本地附件')
        if(m.stage02)serviceDomain.attachmentId(s,context,{attachmentId:id})
        return m
      })
      const database = await db(),
        blob = await req(
          database
            .transaction('blobs')
            .objectStore('blobs')
            .get(session + ':' + id),
        )
      if (!blob) throw new DomainError('本地附件已失效，请重新选择')
      return { ...meta, blob, name: meta.name, type: meta.type }
    },
  }
  api.stage01 = {
    query: (table, filters) => read(s => stage01.query(s, context, table, filters)),
    record: (table, id) => read(s => stage01.record(s, context, table, id)),
    options: () => read(s => stage01.options(s, context)),
    overview: () => read(s => stage01.overview(s, context)),
    importPreview: p => read(s => stage01.importPreview(s, context, p)),
    async command(name, p = {}) { const r = await transact(s => stage01.command(s, context, name, p)); notify(); return r },
    async auxiliary(name, p = {}) { const r = await transact(s => stage01.auxiliary(s, context, name, p)); notify(); return r },
    async reset() { await transact((s, blobs) => { stage01.reset(s, context, id => blobs.delete(session + ':' + id)); seedStage01(s) }); notify() },
    async upload(file, options = {}) { const r = await api.upload(file, options); await transact(s => { Object.assign(s.attachments[r.id], {stage01: true, uploadedAt: new Date().toISOString(), uploader: stage01.options(s, context).actor.name, status: '成功'}) }); return r },
    async attachment(p) { const id = await read(s => stage01.attachmentId(s, context, p)); const database = await db(); const blob = await req(database.transaction('blobs').objectStore('blobs').get(session + ':' + id)); if (!blob) throw new DomainError('本地附件已失效，请重新选择'); return {blob, ...(await read(s => s.attachments[id]))} },
    async accounts() { return read(s => s.stage01?.prepared && ['web','staff'].includes(app) ? [{id:'property-colleague',name:'陈晓',roles:[{id:'property',name:'物业管理员'}]}] : []) },
  }

  api.service = {
    query: (table, filters) => read(s => serviceDomain.query(s, context, table, filters)),
    record: (table, id) => read(s => serviceDomain.record(s, context, table, id)),
    options: () => read(s => serviceDomain.options(s, context)),
    overview: filters => read(s => serviceDomain.overview(s, context, filters)),
    async command(name, p = {}) { const r = await transact(s => serviceDomain.command(s, context, name, p)); notify(); return r },
    async auxiliary(name, p = {}) { const r = await transact(s => serviceDomain.auxiliary(s, context, name, p)); notify(); return r },
    async reset() { await transact((s, blobs) => serviceDomain.reset(s, context, id => blobs.delete(session + ':' + id))); notify() },
    async draft(key, data) { return api.draft('service:' + key, data) },
    async upload(file, options = {}) {
      await api.service.options()
      if ((await read(s => s.service?.outcomes?.upload)) === "failure") throw new DomainError("上传失败，已保留所选文件与其他输入")
      const r = await api.upload(file, options)
      await transact(s => Object.assign(s.attachments[r.id], { stage02:true, uploadedAt:new Date().toISOString(), uploader:serviceDomain.options(s, context).actor.name, status:'成功', table:options.table || '', recordId:options.id || options.recordId || '', visibility:options.visibility || '业务可见', description:options.description || '', order:options.order || 0 }))
      return { ...r, stage02:true, status:'成功' }
    },
    async attachment(p) {
      const descriptor = await read(s => { const id=serviceDomain.attachmentId(s, context, p); return {id,meta:s.attachments[id]} })
      let blob
      if(descriptor.meta.base64) blob=new Blob([Uint8Array.from(atob(descriptor.meta.base64), c=>c.charCodeAt(0))], {type:descriptor.meta.type})
      else if(descriptor.meta.text) blob=new Blob([descriptor.meta.text], {type:descriptor.meta.type || 'text/plain'})
      else {const database=await db();blob=await req(database.transaction('blobs').objectStore('blobs').get(session+':'+descriptor.id))}
      if(!blob)throw new DomainError('本地附件已失效，请重新选择')
      return {...descriptor.meta,blob,name:descriptor.meta.name,type:descriptor.meta.type}
    },
    accounts: () => read(s => serviceDomain.accounts(s, context)),
  }
  return api
}
