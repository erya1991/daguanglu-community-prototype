<template>
  <section class="service-workspace" :data-view="activeView">
    <header class="page-heading">
      <div>
        <p class="eyebrow">社区便民服务</p>
        <h1>{{ config.title }}</h1>
        <p class="page-description">{{ config.intro }}</p>
      </div>
      <div class="heading-actions">
        <Button
          v-if="newAction"
          type="primary"
          :data-action="newAction.name"
          @click="startAction(newAction, null)"
          >{{ newAction.label }}</Button
        ><Button :loading="loading" @click="load">刷新</Button>
      </div>
    </header>
    <Alert
      v-if="error"
      type="error"
      show-icon
      closable
      @on-close="error = ''"
      >{{ error }}</Alert
    >
    <Tabs
      v-if="activeView === 'categories' || activeView === 'methods'"
      :value="categoryTab"
      @on-click="setCategoryTab"
      ><TabPane label="服务类目" name="categories" /><TabPane
        label="履约方式"
        name="methods"
    /></Tabs>
    <div class="query-panel">
      <div class="query-main">
        <input
          v-model="keyword"
          aria-label="搜索服务业务"
          :data-field="
            ['categories', 'methods'].includes(activeView)
              ? '27-A.01'
              : undefined
          "
          placeholder="搜索业务编号、项目或商户"
          @input="changeFilter"
        /><select
          v-model="status"
          aria-label="状态筛选"
          :data-field="
            ['categories', 'methods'].includes(activeView)
              ? '27-A.02'
              : undefined
          "
          @change="changeFilter"
        >
          <option value="">全部状态</option>
          <option v-for="v in statusOptions" :key="v" :value="v">
            {{ v }}
          </option></select
        ><select
          v-if="options.merchants && options.merchants.length"
          v-model="merchantFilter"
          aria-label="商户筛选"
          @change="changeFilter"
        >
          <option value="">全部授权商户</option>
          <option
            v-for="m in options.merchants"
            :key="m._id || m.id || m.value"
            :value="m._id || m.id || m.value"
          >
            {{ m["商户名称"] || m.label || m.name }}
          </option></select
        ><template
          v-if="
            activeView === 'overview' ||
            activeView === 'funds' ||
            activeView === 'exceptions'
          "
          ><input
            v-model="filters['查询开始日期']"
            type="date"
            aria-label="查询开始日期"
            @change="changeFilter" /><span>至</span
          ><input
            v-model="filters['查询结束日期']"
            type="date"
            aria-label="查询结束日期"
            @change="changeFilter" /></template
        ><label v-if="activeView === 'overview'" class="service-date-query"
          >安排查询服务日
          <input
            v-model="filters.serviceDate"
            type="date"
            aria-label="安排查询服务日"
            @change="changeFilter" /></label
        ><Button type="primary" @click="search">查询</Button
        ><Button @click="clearFilters">重置筛选</Button>
      </div>
      <details v-if="config.filter.length" class="more-filter">
        <summary>更多查询条件</summary>
        <Form :label-width="0"
          ><ServiceFields
            v-model="filters"
            :table-ids="config.filter"
            :options="filterOptions"
            :excluded-fields="filterExclusions"
            mode="filter" /></Form
        ><Button size="small" type="primary" @click="search">应用条件</Button>
      </details>
    </div>
    <div v-if="loading" class="loading-state" role="status">
      <Spin size="large" />
      <p>正在读取服务记录…</p>
    </div>
    <div v-else-if="activeView === 'overview'" class="service-overview">
      <div class="stats-period">
        <strong>期间经营</strong><span>{{ periodLabel }}</span>
      </div>
      <div class="metric-grid">
        <button
          v-for="metric in periodMetrics"
          :key="metric.name"
          :data-metric="metric.name"
          :data-field="fieldIdFor(metric.name)"
          @click="drill(metric)"
        >
          <span>{{ metric.name }}</span
          ><strong>{{ metric.value }}</strong
          ><small>{{ metric.basis || metricTime(metric.name) }}</small
          ><em>查看明细 →</em>
        </button>
      </div>
      <div class="stats-period">
        <strong>当前待办与安排</strong
        ><span :data-field="fieldIdFor('数据更新时间')">{{ statsTime }}</span>
      </div>
      <div class="metric-grid stock-metrics">
        <button
          v-for="metric in stockMetrics"
          :key="metric.name"
          :data-metric="metric.name"
          :data-field="fieldIdFor(metric.name)"
          @click="drill(metric)"
        >
          <span>{{ metric.name }}</span
          ><strong>{{ metric.value }}</strong
          ><small>{{ metric.basis || "当前状态，不套期间累计" }}</small
          ><em>查看记录 →</em>
        </button>
      </div>
      <Alert v-if="!periodMetrics.length && !stockMetrics.length" show-icon
        >当前范围暂无可计算的经营事实。</Alert
      >
    </div>
    <div v-else class="list-card" :class="{ 'category-list': activeView === 'categories' }">
      <div class="list-heading">
        <strong>{{ config.title }}记录</strong
        ><span>{{ filteredRows.length }} 条</span>
      </div>
      <div class="table-scroll">
        <table class="service-table" :data-table="currentTable">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column">{{ column }}</th>
              <th class="action-column">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pageRows" :key="row._id" :data-record="row._id">
              <td
                v-for="column in columns"
                :key="column"
                :data-field="fieldIdFor(column)"
              >
                <span
                  :class="{ 'status-badge': /状态|进度|有效性/.test(column), 'category-child': activeView === 'categories' && column === '类目名称' && row['上级类目'] }"
                  >{{ cell(row, column) }}</span
                >
              </td>
              <td class="action-column">
                <Button type="text" @click="openRecord(row)">查看详情</Button
                ><Button
                  v-for="action in rowActions(row)"
                  :key="action.name + action.label"
                  type="text"
                  :data-action="action.name"
                  @click="startAction(action, row)"
                  >{{ action.label }}</Button
                >
              </td>
            </tr>
            <tr v-if="!pageRows.length">
              <td :colspan="columns.length + 1" class="empty-state">
                <strong>暂无匹配记录</strong>
                <p>可以调整查询条件，或在完成相应业务操作后刷新。</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="list-footer">
        <span>记录及操作按当前身份、主体和授权范围展示。</span
        ><Page
          :total="filteredRows.length"
          :current="page"
          :page-size="10"
          @on-change="setPage"
        />
      </div>
    </div>
    <Drawer
      v-model="detailVisible"
      :title="selected ? recordTitle(selected) : '记录详情'"
      :width="960"
      :mask-closable="true"
      class-name="service-detail-drawer"
      @on-close="clearSelection"
    >
      <template v-if="selected"
        ><div class="record-summary">
          <div>
            <span>{{ selected._id }}</span>
            <h2>{{ recordTitle(selected) }}</h2>
            <p>{{ summary(selected) }}</p>
          </div>
        </div>
        <section v-for="g in detailGroups" :key="g[0]" class="service-detail-group">
          <h3>{{ g[0] }}</h3>
          <ServiceDetail :record="selected" :options="options" :table="currentTable" :table-ids="g[1]" :show-extras="false" />
        </section>
        <ServiceDetail :record="selected" :options="options" :table="currentTable" :table-ids="[]" />
      </template>
    </Drawer>
    <Drawer
      v-model="actionVisible"
      :title="actionTitle"
      :width="760"
      :mask-closable="false"
      class-name="service-action-drawer"
      @on-close="closeAction"
    >
      <template v-if="action"
        ><div class="action-context">
          <strong>{{
            actionRecord ? recordTitle(actionRecord) : config.title
          }}</strong>
          <p>{{ actionDescription }}</p>
          <p v-if="action.defaults && action.defaults['状态']">
            本次操作：{{ action.defaults["状态"] }}
          </p>
          <p v-if="action.name === 'aftersale.ruling'" class="ruling-impact">
            保存结果将替代尚未执行的协商方案。退款、继续履约和居民完成确认仍分别依据实际执行记录。
          </p>
        </div>
        <Alert v-if="actionError" type="error" show-icon>{{
          actionError
        }}</Alert
        ><Form :label-width="0" @submit.native.prevent="submitAction"
          ><ServiceFields
            v-model="draft"
            :table-ids="actionTables"
            :extra-fields="extraFields"
            :options="options"
            :errors="fieldErrors"
            :original="actionRecord || {}"
            :action="action.name"
          />
          <div class="action-footer">
            <Button @click="closeAction">保留输入并返回</Button
            ><Button
              type="primary"
              :loading="saving"
              :disabled="saving"
              :data-action="'submit:' + action.name"
              @click="submitAction"
              >{{ saving ? "正在保存…" : "确认" + actionTitle }}</Button
            >
          </div></Form
        ></template
      >
    </Drawer>
  </section>
</template>
<script>
import { service } from "../../services/foundation";
import {
  fieldTables,
  tableById,
} from "../../../../../prototype-shared/service/fields.js";
import ServiceFields from "../../components/service/ServiceFields.vue";
import ServiceDetail from "../../components/service/ServiceDetail.vue";
import {
  views,
  titleOf,
  valueOf,
  plain,
  operationId,
} from "../../components/service/model";
const actionFallbacks = {
  "category.save": ["27-A"],
  "category.status": ["27-A"],
  "method.save": ["27-A"],
  "method.status": ["27-A"],
  "qualification.review": ["26-C"],
  "personnel.review": ["26-D"],
  "qualification.status": ["26-C"],
  "service.review": ["27-F"],
  "service.status": ["27-F"],
  "service.publish": ["27-F"],
  "aftersale.ruling": ["31-G"],
  "aftersale.rulingNote": ["31-C", "31-G"],
  "aftersale.execute": ["31-G"],
  "evaluation.status": ["31-F"],
  "fund.note": ["32-F"],
  "fund.query": ["32-F"],
  "fund.retry": ["32-F"],
};
const actionDescriptions = {
  "personnel.review":
    "核验本主体上传的人员材料；不认可时填写原因，商户不能自行设为已核验。",
  "aftersale.rulingNote":
    "只追加说明及内部依据，保留原裁定、金额和已执行资金事实。",
  "qualification.review":
    "批准范围不得超过本轮申请，退回或缩减范围请说明依据。",
  "qualification.status": "暂停只影响新增交易；恢复前将重新核查当前资格。",
  "category.save": "类目仅定义服务供给及材料要求，不增加新的履约流程。",
  "method.save": "仅维护已支持的上门或预约到点方式。",
  "service.review": "审核绑定当前送审版本，线上旧版及原订单快照保留。",
  "service.status": "监管和销售动作分别留痕，不删除原单或无痕改写历史。",
  "aftersale.ruling": "仅记录已在线下作出的结论。公开说明与内部依据分别保存。",
  "aftersale.execute": "按有效方案或裁定执行，重复操作将恢复原执行记录。",
  "evaluation.status": "不得仅因低分限制展示，原评价及监管依据必须保留。",
  "fund.note": "核查说明只记录依据，不直接改变资金最终状态。",
  "fund.query": "只查询此笔原资金请求，不新增付款、退款或分账。",
  "fund.retry": "系统将检查原请求状态，仅允许符合条件的原请求恢复。",
};
export default {
  name: "ServiceWorkspace",
  components: { ServiceFields, ServiceDetail },
  props: {
    table: { type: String, default: "" },
    view: { type: String, default: "" },
  },
  data: () => ({
    rows: [],
    options: {},
    metrics: [],
    stats: {},
    loading: false,
    error: "",
    keyword: "",
    status: "",
    merchantFilter: "",
    filters: {},
    page: 1,
    categoryTab: "categories",
    detailVisible: false,
    selected: null,
    actionVisible: false,
    action: null,
    actionRecord: null,
    draft: {},
    fieldErrors: {},
    actionError: "",
    saving: false,
    pendingOperation: "",
    unsubscribe: null,
    restoring: false,
    requestSequence: 0,
  }),
  computed: {
    activeView() {
      const raw =
        this.view ||
        this.table ||
        this.$route.path.split("/").filter(Boolean).pop() ||
        "orders";
      const key = raw === "services" ? "review" : raw;
      return key === "categories"
        ? this.categoryTab
        : views[key]
          ? key
          : "orders";
    },
    config() {
      return views[this.activeView] || views.orders;
    },
    currentTable() {
      return this.config.table;
    },
    columns() {
      return this.config.columns;
    },
    detailGroups() {
      return this.config.groups;
    },
    filterExclusions() {
      const list =
        this.activeView === "overview"
          ? ["时间口径"]
          : this.activeView === "qualifications"
            ? ["人员姓名", "人员联系电话", "人员状态", "人员资质有效性"]
            : this.activeView === "personnel"
              ? ["申请状态", "资格有效性", "覆盖社区", "覆盖小区"]
              : [];
      if (this.options.actor?.grant?.sensitive !== true)
        list.push("人员联系电话", "联系人电话筛选");
      return list;
    },
    filterOptions() {
      return {
        ...this.options,
        dictionaries: {
          ...(this.options.dictionaries || {}),
          时间口径: [
            "创建时间",
            "支付成功时间",
            "退款成功时间",
            "分账成功时间",
            "回退成功时间",
          ],
        },
      };
    },
    newAction() {
      if (!["platform", "system"].includes(this.options.actor?.role))
        return null;
      if (this.activeView === "categories")
        return {
          name: "category.save",
          label: "新增服务类目",
          fields: ["27-A"],
        };
      if (this.activeView === "methods")
        return { name: "method.save", label: "新增履约方式", fields: ["27-A"] };
      return null;
    },
    filteredRows() {
      const term = this.keyword.trim().toLowerCase();
      return this.rows.filter((row) => {
        const values = Object.entries(row)
          .filter(([k]) => !k.startsWith("_"))
          .map(([, v]) => plain(v))
          .join(" ")
          .toLowerCase();
        if (
          term &&
          !values.includes(term) &&
          !row._id.toLowerCase().includes(term)
        )
          return false;
        if (this.status && !values.includes(this.status.toLowerCase()))
          return false;
        if (this.merchantFilter) {
          const merchant = this.options.merchants?.find(
            (m) => (m._id || m.id || m.value) === this.merchantFilter,
          );
          if (
            !values.includes(String(this.merchantFilter).toLowerCase()) &&
            !values.includes(
              String(
                merchant?.["商户名称"] ||
                  merchant?.label ||
                  merchant?.name ||
                  "",
              ).toLowerCase(),
            )
          )
            return false;
        }
        return true;
      });
    },
    pageRows() {
      return this.filteredRows.slice((this.page - 1) * 10, this.page * 10);
    },
    statusOptions() {
      return Array.from(
        new Set(
          this.rows.flatMap((row) =>
            Object.entries(row)
              .filter(
                ([k, v]) => /状态|进度|有效性/.test(k) && typeof v === "string",
              )
              .map(([, v]) => v),
          ),
        ),
      ).sort();
    },
    actionTables() {
      return this.action?.fields?.length
        ? this.action.fields
        : actionFallbacks[this.action?.name] || [];
    },
    actionTitle() {
      return this.action?.label || "办理";
    },
    actionDescription() {
      return (
        actionDescriptions[this.action?.name] ||
        "保存时重新核验当前身份、最新版本及业务状态。"
      );
    },
    extraFields() {
      const name = this.action?.name || "",
        fields = [];
      if (name.endsWith(".status")) {
        if (!this.action?.defaults?.["状态"])
          fields.push({
            id: "action:状态",
            name: "状态",
            type: "枚举／单选",
            condition: "必填：办理时；可见：Web办理；编辑：提交前",
            rule: "",
          });
        const state = this.action?.defaults?.["状态"] || this.draft["状态"];
        const reason =
          name === "evaluation.status"
            ? "评价限制原因"
            : name === "qualification.status"
              ? "暂停或恢复原因"
              : ["category.status", "method.status"].includes(name)
                ? "配置变更原因"
                : state === "已下架"
                  ? "上架或下架原因"
                  : "原因说明";
        const exists = this.actionTables.some((id) =>
          (tableById[id]?.fields || []).some((f) => f.name === reason),
        );
        if (!exists)
          fields.push({
            id: "action:" + reason,
            name: reason,
            type: "多行文本／输入框",
            condition: "必填：办理时；可见：Web办理；编辑：提交前",
            rule: "",
          });
      }
      if (
        name === "fund.note" &&
        !this.actionTables.some((id) =>
          (tableById[id]?.fields || []).some((f) => /核查说明/.test(f.name)),
        )
      )
        fields.push({
          id: "action:核查说明",
          name: "本次核查说明",
          type: "多行文本／输入框",
          condition: "必填：办理时；可见：Web办理；编辑：提交前",
          rule: "",
        });
      return fields;
    },
    periodMetrics() {
      return this.metrics.filter(
        (m) => !/当前|待接|待安排|待处理|有效安排|已确认服务安排/.test(m.name),
      );
    },
    stockMetrics() {
      return this.metrics.filter((m) =>
        /当前|待接|待安排|待处理|有效安排|已确认服务安排/.test(m.name),
      );
    },
    periodLabel() {
      const p = this.stats.period || {};
      return (
        (this.filters["查询开始日期"] || p.start || "全部已记录时间") +
        " 至 " +
        (this.filters["查询结束日期"] || p.end || "当前查询时点")
      );
    },
    statsTime() {
      return (
        this.stats["数据更新时间"] ||
        this.stats["统计时点"] ||
        this.stats.asOf ||
        "按当前业务事实"
      );
    },
  },
  watch: {
    table() {
      this.routeChanged();
    },
    view() {
      this.routeChanged();
    },
    "$route.path"() {
      this.routeChanged();
    },
    draft: {
      deep: true,
      handler() {
        if (this.action && !this.restoring) this.persistActionDraft();
      },
    },
  },
  async created() {
    this.restoreFilters();
    this.applyDrillQuery();
    this.unsubscribe = service.onChange(() => this.load());
    await this.load();
  },
  beforeDestroy() {
    if (this.unsubscribe) this.unsubscribe();
    this.persistFilters();
  },
  methods: {
    recordTitle: titleOf,
    cell(r, c) {
      let v = valueOf(r, c);
      const opts = /类目/.test(c)
        ? this.options.categories
        : /社区/.test(c)
          ? this.options.communities
          : /小区/.test(c)
            ? this.options.estates
            : null;
      const human = (x) => {
        const o = opts?.find((a) => (a.value || a._id || a.id) === x);
        return o?.label || o?.name || x;
      };
      if (opts) v = Array.isArray(v) ? v.map(human) : human(v);
      return v === undefined && /编号|订单号|业务单号/.test(c)
        ? r._id
        : plain(v);
    },
    fieldIdFor(name) {
      const f = fieldTables
        .flatMap((t) => t.fields)
        .find((f) => f.name === name);
      return f?.id || "summary:" + name;
    },
    summary(row) {
      return Object.entries(row)
        .filter(
          ([k, v]) =>
            /状态|进度|金额|有效性/.test(k) &&
            ["string", "number"].includes(typeof v),
        )
        .slice(0, 6)
        .map(([k, v]) => k + "：" + v)
        .join(" · ");
    },
    rowActions(row) {
      return (row._actions || []).filter(
        (a) => typeof a === "object" && actionFallbacks[a.name],
      );
    },
    filterKey() {
      return (
        "dgl:service-ui:" +
        service.session +
        ":" +
        service.context().account +
        ":" +
        this.activeView
      );
    },
    persistFilters() {
      try {
        sessionStorage.setItem(
          this.filterKey(),
          JSON.stringify({
            keyword: this.keyword,
            status: this.status,
            merchantFilter: this.merchantFilter,
            filters: this.filters,
            page: this.page,
          }),
        );
      } catch (e) {
        /* Browser storage may be unavailable; business facts remain managed by Adapter. */
      }
    },
    restoreFilters() {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem(this.filterKey()) || "null",
        );
        if (saved) {
          this.keyword = saved.keyword || "";
          this.status = saved.status || "";
          this.merchantFilter = saved.merchantFilter || "";
          this.filters = saved.filters || {};
          this.page = saved.page || 1;
        }
      } catch (e) {
        this.error = "未能恢复上次查询条件，请重新选择。";
      }
    },
    routeChanged() {
      this.keyword = "";
      this.status = "";
      this.merchantFilter = "";
      this.filters = {};
      this.page = 1;
      this.detailVisible = false;
      this.selected = null;
      this.restoreFilters();
      this.applyDrillQuery();
      this.load();
    },
    setCategoryTab(name) {
      this.categoryTab = name;
      this.keyword = "";
      this.status = "";
      this.filters = {};
      this.page = 1;
      this.restoreFilters();
      this.load();
    },
    changeFilter() {
      this.page = 1;
      this.persistFilters();
    },
    search() {
      if (this.filters["时间口径"]) {
        this.$delete(this.filters, "metric");
        if (this.$route.query.metric) {
          const query = { ...this.$route.query };
          delete query.metric;
          this.$router
            .replace({ path: this.$route.path, query })
            .catch(() => {});
        }
      }
      this.page = 1;
      this.persistFilters();
      this.load();
    },
    clearFilters() {
      this.keyword = "";
      this.status = "";
      this.merchantFilter = "";
      this.filters = {};
      this.page = 1;
      this.persistFilters();
      this.load();
    },
    setPage(p) {
      this.page = p;
      this.persistFilters();
    },
    async load() {
      const seq = ++this.requestSequence;
      this.loading = true;
      this.error = "";
      try {
        if (!service.service) throw new Error("服务业务尚未初始化，请刷新页面");
        await service.start();
        const options = await service.service.options();
        if (seq !== this.requestSequence) return;
        this.options = options || {};
        if (this.activeView === "overview" && !this.filters.serviceDate)
          this.$set(this.filters, "serviceDate", options.today);
        const f = {
          ...this.filters,
          keyword: this.keyword,
          status: this.status,
          merchant: this.merchantFilter,
        };
        if (this.activeView === "overview") {
          const result = await service.service.overview(f);
          if (seq !== this.requestSequence) return;
          this.stats = result || {};
          const metrics = result.metrics || result["经营指标"] || result;
          this.metrics = Array.isArray(metrics)
            ? metrics.map((m) => ({
                ...m,
                name: m.name || m["指标名称"],
                value: m.value === undefined ? m["指标值"] : m.value,
                basis: m.basis || m["时间口径"],
              }))
            : Object.entries(metrics)
                .filter(([k, v]) => !k.startsWith("_") && typeof v !== "object")
                .map(([name, value]) => ({ name, value }));
          this.rows = [];
        } else {
          const rows = await service.service.query(this.currentTable, f);
          if (seq !== this.requestSequence) return;
          this.rows = Array.isArray(rows) ? rows : rows.rows || [];
          if (this.selected) {
            try {
              this.selected = await service.service.record(
                this.currentTable,
                this.selected._id,
              );
            } catch (e) {
              this.selected = null;
              this.detailVisible = false;
            }
          }
          if ((this.page - 1) * 10 >= this.filteredRows.length) this.page = 1;
        }
      } catch (e) {
        if (seq === this.requestSequence)
          this.error = e.message || "读取失败，请重试";
      } finally {
        if (seq === this.requestSequence) this.loading = false;
      }
    },
    async openRecord(row) {
      this.error = "";
      try {
        this.selected = await service.service.record(
          this.currentTable,
          row._id,
        );
        this.detailVisible = true;
      } catch (e) {
        this.error = e.message || "无权读取此记录";
      }
    },
    clearSelection() {
      this.selected = null;
    },
    async startAction(action, row) {
      this.action = action;
      this.actionRecord = row
        ? await service.service.record(this.currentTable, row._id)
        : null;
      this.fieldErrors = {};
      this.actionError = "";
      this.pendingOperation = operationId();
      let draft = {};
      if (action.name.endsWith(".save") && row)
        draft = JSON.parse(JSON.stringify(row));
      if (action.name === "qualification.review") {
        draft["审核结果"] = "通过";
        draft["批准服务类目"] = this.actionRecord["申请服务类目"] || [];
        draft["批准覆盖社区"] = this.actionRecord["申请覆盖社区"] || [];
        draft["批准覆盖小区"] = this.actionRecord["申请覆盖小区"] || [];
      }
      if (action.name === "service.review") draft["审核结果"] = "通过";
      if (action.name === "personnel.review") draft["核验结论"] = "认可";
      if (action.name === "aftersale.ruling") {
        draft["裁定结果"] = "部分退款";
        if (
          !(
            this.actionRecord.handlingOptions?.ruling?.[draft["裁定结果"]] || []
          ).length
        )
          draft["裁定结果"] = "全额退款";
        draft["裁定后业务处理"] =
          this.actionRecord.handlingOptions?.ruling?.[draft["裁定结果"]]?.[0] ||
          "";
      }
      if (action.name.endsWith(".status"))
        draft["状态"] =
          action.name === "qualification.status"
            ? "暂停"
            : action.name === "service.status"
              ? "平台限制"
              : action.name === "evaluation.status"
                ? "受限"
                : "停用";
      try {
        const saved = await service.draft(this.actionDraftKey());
        if (saved?.data) {
          draft = saved.data;
          this.pendingOperation = saved.operationId || this.pendingOperation;
        }
      } catch (e) {
        this.actionError = "上次输入未能恢复，请核对后重新填写。";
      }
      this.restoring = true;
      this.draft = { ...draft, ...(action.defaults || {}) };
      this.$nextTick(() => {
        this.restoring = false;
      });
      this.actionVisible = true;
    },
    actionDraftKey() {
      return (
        "service:web:" +
        this.currentTable +
        ":" +
        (this.actionRecord ? this.actionRecord._id : "new") +
        ":" +
        this.action?.name +
        ":" +
        (this.action?.defaults?.["状态"] || "")
      );
    },
    async persistActionDraft() {
      if (!this.action) return;
      try {
        await service.draft(this.actionDraftKey(), {
          data: this.draft,
          operationId: this.pendingOperation,
        });
      } catch (e) {
        this.actionError = "草稿暂未保存，请保留页面并重试。";
      }
    },
    async closeAction() {
      await this.persistActionDraft();
      this.actionVisible = false;
    },
    async submitAction() {
      if (this.saving || !this.action) return;
      this.saving = true;
      this.actionError = "";
      this.fieldErrors = {};
      try {
        const payload = JSON.parse(JSON.stringify(this.draft));
        if (this.action.name === "aftersale.ruling") {
          if (!/退款/.test(payload["裁定结果"] || ""))
            delete payload["裁定退款金额"];
          if (!/继续|补充/.test(payload["裁定结果"] || ""))
            delete payload["继续或补充履约内容"];
        }
        const result = await service.service.command(this.action.name, {
          id: this.actionRecord ? this.actionRecord._id : undefined,
          revision: this.actionRecord ? this.actionRecord._rev : undefined,
          operationId: this.pendingOperation,
          data: payload,
        });
        await service.draft(this.actionDraftKey(), null);
        this.actionVisible = false;
        this.action = null;
        this.$Message.success(result.message || "办理成功");
        await this.load();
        if (
          this.detailVisible &&
          result.table === this.currentTable &&
          result.id
        )
          this.selected = await service.service.record(
            this.currentTable,
            result.id,
          );
      } catch (e) {
        this.actionError = e.message || "保存失败，输入已保留";
        this.fieldErrors = e.fields || e.errors || {};
        await this.persistActionDraft();
      } finally {
        this.saving = false;
      }
    },
    applyDrillQuery() {
      const q = this.$route.query || {};
      if (q.metric) {
        this.filters = {
          ...this.filters,
          metric: q.metric,
          serviceDate: q.serviceDate || "",
          start: q.start || "",
          查询开始日期: q.start || "",
          end: q.end || "",
          查询结束日期: q.end || "",
          merchant: q.merchant || "",
          service: q.service || "",
          category: q.category || "",
          服务项目筛选: q.service || "",
          服务类目筛选: q.category || "",
        };
        this.merchantFilter = q.merchant || "";
      }
    },
    metricTime(name) {
      return /付款|支付/.test(name)
        ? "按支付成功时间"
        : /退款/.test(name)
          ? "按退款成功时间"
          : /回退/.test(name)
            ? "按回退成功时间"
            : /分账/.test(name)
              ? "按分账成功时间"
              : /完成/.test(name)
                ? "按居民完成确认时间"
                : /取消/.test(name)
                  ? "按取消生效时间"
                  : /终止/.test(name)
                    ? "按售后结案时间"
                    : "按订单创建时间";
    },
    drill(metric) {
      const funds = /金额|净收|分账|退款|回退|实付/.test(metric.name),
        table = funds ? "funds" : "orders";
      const query = {
        ...(metric.filters || {}),
        metric: metric.name,
        service: metric.filters?.service || this.filters["服务项目筛选"] || "",
        category:
          metric.filters?.category || this.filters["服务类目筛选"] || "",
        serviceDate:
          metric.filters?.serviceDate || this.filters.serviceDate || "",
        start: metric.filters?.start || this.filters["查询开始日期"] || "",
        end: metric.filters?.end || this.filters["查询结束日期"] || "",
        merchant: metric.filters?.merchant || this.merchantFilter,
      };
      this.$router.push({ path: "/service/" + table, query });
      this.$Message.info(
        "已进入" + metric.name + "对应明细，请核对其事件时间口径。",
      );
    },
  },
};
</script>
<style scoped>
.service-workspace {
  max-width: 1600px;
  margin: 0 auto;
  min-width: 0;
  color: #263448;
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 22px;
}
.eyebrow {
  font-size: 12px;
  color: #60758b;
  letter-spacing: 2px;
  margin-bottom: 5px;
}
.page-heading h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}
.page-description {
  color: #657180;
  line-height: 1.8;
  margin-top: 8px;
}
.heading-actions {
  display: flex;
  gap: 8px;
  white-space: nowrap;
}
.query-panel {
  background: white;
  border: 1px solid #e5eaf0;
  border-radius: 6px;
  margin-bottom: 18px;
  padding: 16px;
}
.query-main {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.query-main input,
.query-main select {
  border: 1px solid #d8dfe8;
  border-radius: 4px;
  padding: 7px 10px;
  min-height: 34px;
  font: inherit;
  max-width: 100%;
  background: white;
}
.query-main > input:first-child {
  width: 260px;
}
.more-filter {
  margin-top: 12px;
}
.more-filter > summary {
  cursor: pointer;
  color: #315f93;
  font-size: 13px;
}
.more-filter .ivu-form {
  padding: 18px 0;
}
.loading-state {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #657180;
}
.list-card {
  background: white;
  border: 1px solid #e4e9ef;
  border-radius: 6px;
  min-width: 0;
  overflow: hidden;
}
.category-list .service-table th { background: #e9f3fd; color: #314154; }
.category-list .service-table td { height: 49px; }
.category-list .service-table tbody tr:hover { background: #f5f8fc; }
.category-list .service-table .action-column .ivu-btn { color: #2d8cf0; }
.category-list .category-child { display: inline-block; padding-left: 22px; }
.category-list .category-child::before { content: "— "; color: #9ba7b4; }
.list-heading {
  padding: 16px 18px;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #e8edf3;
}
.list-heading span {
  color: #657180;
  font-size: 12px;
}
.table-scroll {
  overflow: auto;
  max-width: 100%;
}
.service-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
  min-width: 900px;
}
.service-table th {
  text-align: left;
  background: #f7f9fb;
  font-weight: 500;
  color: #526174;
  white-space: nowrap;
}
.service-table td,
.service-table th {
  padding: 13px 14px;
  border-bottom: 1px solid #edf0f4;
  font-size: 13px;
  line-height: 1.6;
  max-width: 220px;
  overflow-wrap: anywhere;
}
.service-table td:first-child {
  color: #315f93;
}
.action-column {
  min-width: 155px;
  white-space: nowrap;
}
.action-column .ivu-btn {
  padding: 0 6px;
}
.status-badge {
  display: inline-block;
  padding: 2px 7px;
  background: #eef3f8;
  border-radius: 3px;
  white-space: nowrap;
  font-size: 12px;
  color: #375a80;
}
.empty-state {
  text-align: center !important;
  padding: 52px 20px !important;
  color: #657180 !important;
}
.empty-state p {
  margin-top: 9px;
  font-size: 12px;
}
.list-footer {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  align-items: center;
  padding: 16px;
}
.list-footer > span {
  color: #657180;
  font-size: 12px;
}
.record-summary {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e2e8ef;
}
.record-summary span {
  color: #73849a;
  font-size: 12px;
}
.record-summary h2 {
  font-size: 20px;
  margin: 7px 0;
}
.record-summary p {
  font-size: 12px;
  color: #657180;
  line-height: 1.8;
}
.action-context {
  padding: 14px 16px;
  background: #f4f7fa;
  border-left: 3px solid #4f7eaa;
  margin-bottom: 20px;
}
.action-context strong {
  font-size: 16px;
}
.action-context p {
  font-size: 13px;
  color: #53677d;
  line-height: 1.8;
  margin-top: 7px;
}
.ruling-impact {
  border-top: 1px solid #dbe4ed;
  padding-top: 8px;
}
.action-footer {
  position: sticky;
  bottom: -16px;
  background: white;
  border-top: 1px solid #e1e7ef;
  padding: 18px 0 2px;
  margin-top: 25px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  z-index: 3;
}
.stats-period {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 22px 0 12px;
}
.stats-period strong {
  font-size: 16px;
}
.stats-period span {
  font-size: 12px;
  color: #657180;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.metric-grid button {
  text-align: left;
  border: 1px solid #e1e7ee;
  border-radius: 6px;
  background: white;
  padding: 18px;
  cursor: pointer;
  color: #263448;
  min-height: 146px;
}
.metric-grid button:hover {
  border-color: #8db0d0;
  box-shadow: 0 4px 12px #26344809;
}
.metric-grid span {
  display: block;
  font-size: 13px;
  color: #526174;
}
.metric-grid strong {
  display: block;
  font-size: 28px;
  font-weight: 500;
  margin: 12px 0;
}
.metric-grid small {
  display: block;
  font-size: 11px;
  color: #657180;
}
.metric-grid em {
  display: block;
  font-style: normal;
  font-size: 12px;
  color: #315f93;
  margin-top: 12px;
}
.stock-metrics button {
  background: #f7fafc;
}
@media (max-width: 1450px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 1000px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .page-heading {
    flex-wrap: wrap;
  }
  .list-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
