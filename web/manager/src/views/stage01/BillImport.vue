<template>
  <section class="s1">
    <h1>导入物业费账单</h1>
    <p class="s1-muted">
      选择CSV文件，逐行核验，再确认导入有效行。导入后仍需发布。
    </p>
    <div class="s1-import-step">
      <strong>1 选择文件</strong
      ><strong :style="{ opacity: preview ? 1 : 0.4 }">2 校验核对</strong
      ><strong :style="{ opacity: result ? 1 : 0.4 }">3 导入结果</strong>
    </div>
    <div v-if="!preview && !result" class="s1-card">
      <label data-field="IM02"
        >来源名称 <span class="s1-required" aria-hidden="true">*</span> <input v-model="source" aria-label="来源名称" aria-required="true" /></label
      ><label>账单文件 <span class="s1-required" aria-hidden="true">*</span><input
        type="file"
        accept=".csv,text/csv"
        aria-label="选择账单文件"
        aria-required="true"
        data-field="IM01"
        @change="file"
      /></label><Button @click="download">下载样表</Button
      ><Button :disabled="!text" :loading="busy" @click="validate"
        >重新校验</Button
      >
      <p>{{ filename }}</p>
    </div>
    <div v-else-if="!result" class="s1-summary">
      <p>已选择：{{ filename }} · {{ source }}</p>
      <div class="s1-actions">
        <Button @click="resetFile">重新选择文件</Button
        ><Button :loading="busy" @click="validate">重新校验</Button>
      </div>
    </div>
    <Alert v-if="error" type="error">{{ error }}</Alert>
    <div v-if="preview && (!result || showRows)" class="s1-card">
      <div class="s1-actions">
        <span
          v-for="id in ['IM04', 'IM05', 'IM06', 'IM07', 'IM08']"
          :key="id"
          :data-field="id"
          >{{ fields[id].name }}：{{ preview[id] }}</span
        ><select v-model="filter" aria-label="行校验状态">
          <option value="">全部行</option>
          <option>错误</option>
          <option>冲突</option>
          <option>完全重复</option>
          <option>有效</option>
        </select>
      </div>
      <div class="s1-scroll">
        <table class="s1-table">
          <thead>
            <tr>
              <th>文件行</th>
              <th>原房屋／匹配</th>
              <th>期间与金额</th>
              <th>校验结果</th>
              <th>问题字段／原因</th>
              <th>核验</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in preview.rows.filter(
                (r) => !filter || r.IR04 === filter
              )"
              :key="r.IR01"
            >
              <td data-field="IR01">{{ r.IR01 }}</td>
              <td>
                <span data-field="IR02">{{ r.IR02 }}</span>
                <p data-field="IR03">{{ (options.houses || []).find(h=>h.value===r.IR03)?.label || "未匹配" }}</p><small>{{r.IR03}}</small>
              </td>
              <td>
                {{ r.data.BL10 }} 至 {{ r.data.BL11 }}
                <p>{{ r.data.BL13 }} 元</p>
              </td>
              <td data-field="IR04">{{ r.IR04 }}</td>
              <td>
                <span data-field="IR05">{{ r.IR05 }}</span>
                <p data-field="IR06">{{ r.IR06 }}</p>
                <span data-field="IR07">{{ r.IR07 }}</span>
              </td>
              <td>
                <Button
                  @click="
                    row = r;
                    mapping = { house: r.IR03, note: r.IR08 };
                  "
                  >查看原值并匹配</Button
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <label v-if="!result" data-field="IM09"
        ><input type="checkbox" v-model="validOnly" />仅导入有效行；排除
        {{ preview.IM07 + preview.IM08 }} 行</label
      >
      <div v-if="!result" class="s1-actions">
        <Button
          type="primary"
          :disabled="!preview.IM06"
          :loading="busy"
          @click="commit"
          >确认导入有效行</Button
        >
      </div>
    </div>
    <div v-if="result" class="s1-card">
      <h2>导入结果</h2>
      <Fields
        :row="result"
        :ids="['IM03', 'IM10', 'IM07', 'IM08', 'IM13']"
      /><Button type="primary" @click="$router.push('/property/bills')"
        >核验发布账单</Button
      >
      <Button @click="showRows = !showRows">{{
        showRows ? "收起行结果" : "查看本次行结果"
      }}</Button>
      <Button @click="resetFile">导入下一份文件</Button>
      <details>
        <summary>批次信息</summary>
        <Fields
          :row="result"
          :ids="['IM02', 'IM04', 'IM05', 'IM06', 'IM09', 'IM11', 'IM12']"
        />
      </details>
      <details>
        <summary>源文件信息</summary>
        <Fields :row="result" :ids="['IM01']" />
      </details>
    </div>
    <Modal
      :value="!!row"
      title="逐行核验"
      :footer-hide="true"
      @on-cancel="row = null"
      ><div v-if="row" class="s1">
        <h3>源文件原值</h3>
        <dl class="s1-fields">
          <template v-for="(v, k) in row.raw"
            ><dt :key="k">{{ k }}</dt>
            <dd :key="k + 'value'">{{ v || "未提供" }}</dd></template
          >
        </dl>
        <template v-if="row.validated"
          ><h3>匹配后的账单字段</h3>
          <Fields :row="row.validated" :ids="range('BL', 2, 18)"
        /></template>
        <label
          >匹配房屋 <span v-if="!result" class="s1-required" aria-hidden="true">*</span>
          <select v-model="mapping.house" :disabled="!!result" :aria-required="!result ? 'true' : undefined">
            <option v-for="h in options.houses" :key="h.value" :value="h.value">
              {{ h.label }}
            </option>
          </select></label
        ><label
          >核验说明 <span v-if="!result" class="s1-required" aria-hidden="true">*</span><textarea
            v-model="mapping.note"
            :readonly="!!result"
            :aria-required="!result ? 'true' : undefined"
            data-field="IR08"
          /></label
        ><Button v-if="!result" type="primary" @click="map"
          >保存映射并重新校验</Button
        >
      </div></Modal
    >
  </section>
</template>
<script>
import { service } from "../../services/foundation";
import { billTemplate } from "../../../../../prototype-shared/stage01/billing.js";
import {
  fieldById,
  fieldRange,
} from "../../../../../prototype-shared/stage01/ui.js";
import Fields from "../../components/stage01/Fields.vue";
export default {
  components: { Fields },
  data: () => ({
    source: "物业收费台账",
    filename: "",
    fileMeta: null,
    text: "",
    preview: null,
    result: null,
    showRows: false,
    error: "",
    busy: false,
    validOnly: false,
    filter: "",
    mappings: {},
    row: null,
    mapping: {},
    options: { houses: [] },
    fields: fieldById,
  }),
  async created() {
    try {
      this.options = await service.stage01.options();
    } catch (e) {
      this.error = e.message;
    }
  },
  methods: {
    range: fieldRange,
    resetFile() {
      this.preview = this.result = this.row = null;
      this.text = this.filename = this.error = "";
      this.fileMeta = null;
      this.mappings = {};
      this.validOnly = this.showRows = false;
    },
    download() {
      const u = URL.createObjectURL(
          new Blob([billTemplate], { type: "text/csv;charset=utf-8" })
        ),
        a = document.createElement("a");
      a.href = u;
      a.download = "物业费账单样表.csv";
      a.click();
      URL.revokeObjectURL(u);
    },
    async file(e) {
      const f = e.target.files[0];
      if (!f) return;
      this.filename = f.name;
      this.fileMeta = { name: f.name, size: f.size };
      this.text = await f.text();
      this.mappings = {};
      this.result = null;
      await this.validate();
    },
    async validate() {
      this.error = "";
      this.busy = true;
      try {
        this.preview = await service.stage01.importPreview({
          text: this.text,
          source: this.source,
          mappings: this.mappings,
        });
        this.validOnly = false;
      } catch (e) {
        this.error = e.message;
        this.preview = null;
      } finally {
        this.busy = false;
      }
    },
    async map() {
      this.$set(this.mappings, this.row.IR01, { ...this.mapping });
      this.row = null;
      await this.validate();
    },
    async commit() {
      this.error = "";
      this.busy = true;
      try {
        const r = await service.stage01.command("import", {
          text: this.text,
          source: this.source,
          mappings: this.mappings,
          validOnly: this.validOnly,
          file: this.fileMeta,
          operation: "import-" + this.source + "-" + this.text,
        });
        this.result = await service.stage01.record("batches", r.id);
        this.preview = this.result;
        this.showRows = false;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
