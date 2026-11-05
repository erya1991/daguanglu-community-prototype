<template>
  <div>
    <Alert show-icon>UTF-8 CSV演示模板，限2 MiB；Q04正式模板待确认。错误批次整批不写入，不静默覆盖。</Alert>
    <div class="toolbar">
      <Button @click="template">下载演示模板</Button><input type="file" accept=".csv" @change="choose" />
    </div>
    <Form label-position="top"
      ><FormItem label="文件名称"
        ><span>{{ name || '未选择' }}</span></FormItem
      ><FormItem label="资料来源">台账导入</FormItem
      ><FormItem label="来源说明" required
        ><Input v-model="source" type="textarea" placeholder="填写本次演示台账提供方及依据" /></FormItem
    ></Form>
    <div class="toolbar">
      <Button type="primary" :disabled="!text" :loading="busy" @click="preview">校验预览</Button
      ><Button :disabled="!result || result['导入处理状态'] !== '待确认导入'" :loading="busy" @click="commit"
        >确认整批导入</Button
      ><Button v-if="result" @click="downloadErrors">下载错误明细</Button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="result"
      ><div class="metric-grid">
        <div class="metric" v-for="f in ['总行数', '通过行数', '不通过行数']" :key="f">
          {{ f }}<strong>{{ result[f] }}</strong>
        </div>
        <div class="metric">
          导入处理状态<strong style="font-size: 18px">{{ result['导入处理状态'] }}</strong>
        </div>
      </div>
      <Table :columns="columns" :data="rows" border size="small" />
      <p class="source-note">
        提交人：{{ result['提交人'] || '待确认' }} · 提交时间：{{ result['提交时间'] || '未提交' }}
      </p></template
    >
  </div>
</template>
<script>
import { service } from '../services/foundation'
import { importTemplate, importColumns } from '../../../../prototype-shared/import-houses.js'
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default {
  data: () => ({ name: '', text: '', source: '', result: null, error: '', busy: false }),
  computed: {
    columns() {
      return [
        { title: '数据行号', key: '数据行号', width: 90 },
        ...importColumns.map((k) => ({ title: k, key: k, width: 140 })),
        { title: '校验结果', key: '校验结果', width: 100 },
        { title: '错误原因', key: 'error', width: 250 },
      ]
    },
    rows() {
      return this.result.rows.map((r) => ({ ...r, ...r['待导入房屋资料'], error: r['错误原因'].join('；') }))
    },
  },
  methods: {
    template() {
      download(importTemplate, 'Stage00房屋导入-演示模板.csv')
    },
    async choose(e) {
      this.result = null
      this.error = ''
      const f = e.target.files[0]
      if (!f) return
      if (f.size > 2 * 1024 * 1024) {
        this.error = '超过本轮2 MiB演示限制'
        return
      }
      this.name = f.name
      this.text = await f.text()
    },
    async preview() {
      this.busy = true
      this.error = ''
      try {
        this.result = await service.importPreview(this.text, this.source)
      } catch (e) {
        this.error = e.message
      } finally {
        this.busy = false
      }
    },
    async commit() {
      this.busy = true
      this.error = ''
      try {
        this.result = {
          ...(await service.importCommit(this.text, this.source, this.result.revision)),
          文件名称: this.name,
        }
        this.$emit('refresh')
      } catch (e) {
        this.error = e.message
        if (this.result) this.result['导入处理状态'] = '失败'
      } finally {
        this.busy = false
      }
    },
    downloadErrors() {
      download(
        '数据行号,错误原因\r\n' +
          this.result.rows
            .filter((r) => r['错误原因'].length)
            .map((r) => r['数据行号'] + ',"' + r['错误原因'].join('；').replace(/"/g, '""') + '"')
            .join('\r\n'),
        'Stage00导入错误.csv',
      )
    },
  },
}
</script>
