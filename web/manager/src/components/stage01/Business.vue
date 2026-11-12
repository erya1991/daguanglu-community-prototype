<template>
  <section class="s1">
    <div class="s1-summary">
      <div>
        <h1>{{ title }}</h1>
        <p class="s1-muted">{{ description }}</p>
      </div>
      <div class="s1-actions">
        <Button
          v-if="view === 'bills'"
          type="primary"
          @click="$router.push('/property/bills/import')"
          >导入账单</Button
        ><Button v-if="newAction" type="primary" @click="start(newAction)">{{
          actionNames[newAction]
        }}</Button
        ><Button @click="load">刷新</Button>
      </div>
    </div>
    <Alert v-if="error" type="error" show-icon>{{ error }}</Alert>
    <div v-if="view === 'overview'" class="s1-stats">
      <button
        v-for="id in ['ST01', 'ST02', 'ST03', 'ST04', 'ST05']"
        :key="id"
        :data-field="id"
        @click="drill(id)"
      >
        {{ fieldById[id].name }}<strong>{{ stats[id] }}</strong>
      </button>
      <p data-field="ST09">统计时点：{{ display("ST09", stats.ST09) }}</p>
    </div>
    <div v-else :class="{ 's1-with-tree': view === 'bills' }">
      <SpaceFilter
        v-if="view === 'bills'"
        :spaces="options.spaces"
        v-model="space"
      />
      <div class="s1-results">
        <Tabs v-if="view === 'tasks'" :value="taskStatus" @on-click="selectTaskStatus">
          <TabPane v-for="s in taskTabs" :key="s.value" :name="s.value" :label="s.label" />
        </Tabs>
        <Tabs v-if="tabs.length" :value="tab" @on-click="changeTab"
          ><TabPane
            v-for="t in tabs"
            :key="t.key"
            :name="t.key"
            :label="t.label"
        /></Tabs>
        <div class="s1-toolbar">
          <input
            v-model="keyword"
            data-field="QF01"
            placeholder="编号、名称或内容"
            aria-label="关键字"
          />
          <select v-if="view !== 'tasks'" v-model="status" aria-label="状态">
            <option value="">全部状态</option>
            <option v-for="s in statusChoices" :key="s">{{ s }}</option>
          </select>
          <Checkbox v-if="view === 'tasks'" v-model="mineOnly">我处理的工单</Checkbox>
          <template v-if="financial"
            ><select v-model="paymentState" aria-label="付款状态">
              <option value="">全部付款状态</option>
              <option v-for="s in paymentStates" :key="s">
                {{ s }}
              </option></select
            ><select v-model="settlementState" aria-label="核销登记状态">
              <option value="">全部核销／登记状态</option>
              <option v-for="s in settlementStates" :key="s">{{ s }}</option>
            </select></template
          >
          <template v-if="view === 'parking'"
            ><input
              v-if="table !== 'products'"
              v-model="plate"
              placeholder="输入车牌"
              aria-label="车牌"
              data-field="QF05"
            /><select v-model="park" aria-label="停车场" data-field="QF06">
              <option value="">全部停车场</option>
              <option v-for="p in parkChoices" :key="p.value" :value="p.value">
                {{ p.label }}
              </option>
            </select></template
          >
          <select
            v-if="['payments', 'dues', 'checks'].includes(table)"
            v-model="business"
            aria-label="业务类型"
            data-field="QF07"
          >
            <option value="">全部业务类型</option>
            <option v-for="s in businessTypes" :key="s">{{ s }}</option>
          </select>
          <input
            type="date"
            v-model="startDate"
            aria-label="查询开始日期"
            data-field="QF08"
          /><span>至</span
          ><input
            type="date"
            v-model="endDate"
            aria-label="查询结束日期"
            data-field="QF09"
          /><Button @click="resetFilters">重置筛选</Button>
        </div>
        <p v-if="table === 'dues'" class="s1-muted">
          按原单列示待缴事项。月租订单为预缴，付款确认中与待核销／登记单独显示。
        </p>
        <div class="s1-card">
          <p v-if="busy">正在读取…</p>
          <div v-else class="s1-scroll">
            <table class="s1-table s1-business-table">
              <thead>
                <tr>
                  <th class="s1-id-cell">{{ idLabel }}</th>
                  <th v-for="c in columns" :key="c.key">{{ c.label }}</th>
                  <th>状态</th>
                  <th class="s1-list-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in pageRows" :key="r._id" :data-record="r._id">
                  <td>
                    <a @click="open(r)">{{ r._id }}</a>
                  </td>
                  <td v-for="c in columns" :key="c.key">
                    <a
                      v-if="c.key === '_businessId'"
                      @click="
                        open({ _table: r._businessTable, _id: r._businessId })
                      "
                      >{{ r._businessId }}</a
                    ><template v-else>{{ cell(r, c) }}</template>
                  </td>
                  <td>
                    {{ r._status
                    }}<small v-if="financial" class="s1-substate"
                      >付款：{{ r._paymentState }}<br />核销／登记：{{
                        r._settlementState
                      }}</small
                    >
                  </td>
                  <td class="s1-list-actions">
                    <div class="s1-actions">
                      <Button
                        v-for="a in actionsFor(r)"
                        :key="a"
                        size="small"
                        @click="start(a, r)"
                        >{{ actionNames[a] }}</Button
                      ><a
                        v-if="r._workorder && r._table !== 'workorders'"
                        @click="
                          open({ _table: 'workorders', _id: r._workorder })
                        "
                        >查看工单</a
                      ><a v-if="!actionsFor(r).length" @click="open(r)"
                        >查看详情</a
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!busy && !filtered.length" data-field="QF13">
            当前条件下暂无记录
          </p>
          <div class="s1-toolbar">
            <span data-field="QF12">共{{ filtered.length }}条</span
            ><Page
              :total="filtered.length"
              :current="page"
              :page-size="pageSize"
              show-sizer
              :page-size-opts="[10, 20, 50]"
              @on-change="page = $event"
              @on-page-size-change="
                pageSize = $event;
                page = 1;
              "
              data-field="QF10"
            /><span data-field="QF11">每页{{ pageSize }}条</span>
          </div>
        </div>
      </div>
    </div>
    <p v-if="view === 'parking'" class="s1-muted" data-field="XI01">
      闸机尚未接入，平台登记与通行结果分别记录。
    </p>
    <Drawer
      :value="!!selected"
      width="860"
      title="业务详情"
      class-name="s1-drawer"
      @on-close="close"
      ><BusinessDetail
        v-if="selected"
        :row="selected"
        :table="detailTable"
        @open="open({ _table: $event.table, _id: $event.id })"
    /></Drawer>
    <Modal
      :z-index="3200"
      :value="!!action"
      :title="actionNames[action] || '办理'"
      :footer-hide="true"
      width="720"
      :mask-closable="false"
      @on-cancel="cancel"
      class="s1"
    >
      <Alert v-if="actionError" type="error">{{ actionError }}</Alert>
      <p v-if="actionTarget">
        {{ actionTarget._id }} · {{ actionTarget._title }}
      </p>
      <div v-if="action === 'publish'">
        <Fields
          :row="actionTarget"
          :ids="['BL01', 'BL08', 'BL10', 'BL11', 'BL13', 'BL16']"
        /><Checkbox v-model="form.IR09" data-field="IR09"
          >已核对单张账单，确认发布 <span class="s1-required" aria-hidden="true">*</span></Checkbox
        >
      </div>
      <p
        v-else-if="
          ['startProcess', 'queryPayment', 'recoverPayment'].includes(
            action
          )
        "
      >
        确认按当前记录办理。
      </p>
      <ActionForm
        v-else-if="action"
        :action="action === 'createCheck' ? 'saveCheck' : action"
        v-model="form"
        :options="options"
        :records="tasks"
        :errors="fieldErrors"
        :kind="actionTarget && actionTarget._kind"
        :role="options.actor && options.actor.role"
        :record="actionTarget || {}"
        :public-candidates="publicCandidates"
      />
      <div class="s1-actions">
        <Button type="primary" :loading="saving" @click="save"
          >确认{{ actionNames[action] }}</Button
        ><Button :disabled="saving" @click="cancel">取消</Button>
      </div>
    </Modal>
  </section>
</template>
<script>
import { service } from "../../services/foundation";
import Fields from "./Fields.vue";
import BusinessDetail from "./BusinessDetail.vue";
import SpaceFilter from "./SpaceFilter.vue";
import ActionForm from "./ActionForm.vue";
import {
  fieldById,
  format,
  actionNames,
  moneyFields,
  rowActions,
  listStates,
  paymentStates,
  settlementStates,
} from "../../../../../prototype-shared/stage01/ui.js";
const definitions = {
  bills: ["物业费账单", "按房屋范围查询、核验与发布"],
  payments: ["缴费记录", "原单、付款与核销登记分别核对"],
  parking: ["停车业务", "停车关系、月租预缴与临停费用"],
  tasks: ["工单办理", "登记受理、人工派单与逐轮处理"],
  overview: ["工单概况", "当前状态数量与办理进度"],
  repairs: ["工单与居民反馈", "原始诉求、处理结果与居民确认评价"],
  hazards: ["隐患整改台账", "整改证据、复核与销号"],
};
const col = (key, label, money = false) => ({ key, label, money });
const layouts = {
  bills: [
    col("_title", "房屋"),
    col("_subtitle", "费用期间"),
    col("BL13", "应缴", true),
    col("BL15", "已缴", true),
    col("BL16", "剩余", true),
  ],
  payments: [
    col("_businessType", "业务类型"),
    col("_businessId", "原单编号"),
    col("PY06", "实付金额", true),
    col("_date", "付款时间"),
  ],
  dues: [
    col("_businessType", "业务类型"),
    col("_title", "事项"),
    col("_subtitle", "期间"),
    col("_amount", "待缴金额", true),
  ],
  parkingRelations: [
    col("PK03", "车牌"),
    col("PK15", "车辆类型"),
    col("PK16", "车辆颜色"),
    col("PK06", "关联居民"),
    col("PK13", "关联房屋"),
    col("PK14", "有效业主"),
    col("PK05", "停车场"),
  ],
  products: [
    col("MP02", "产品名称"),
    col("_parkName", "停车场"),
    col("MP04", "价格", true),
    col("MP10", "闸机厂商名称"),
  ],
  monthly: [
    col("_plate", "车牌"),
    col("_residentName", "关联居民"),
    col("_houseName", "关联房屋"),
    col("_ownerName", "有效业主"),
    col("_parkName", "停车场"),
    col("MO03", "产品"),
    col("_subtitle", "服务期间"),
    col("MO09", "金额", true),
    col("MO20", "闸机厂商名称"),
  ],
  temporary: [
    col("_plate", "车牌"),
    col("_parkName", "停车场"),
    col("TB09", "收费标准／费用依据"),
    col("TB04", "入场时间"),
    col("TB05", "计费截止"),
    col("TB18", "停放时长"),
    col("TB06", "金额", true),
    col("TB17", "闸机厂商名称"),
  ],
  checks: [
    col("_businessType", "业务类型"),
    col("_businessId", "原单编号"),
    col("EX02", "核对事项"),
    col("EX06", "处理意见"),
    col("EX09", "登记时间"),
  ],
  workorders: [
    col("_title", "事项"),
    col("WO15", "工单类型"),
    col("WO16", "问题类别"),
    col("WO17", "位置"),
    col("WO04", "处理人"),
  ],
  reports: [
    col("_title", "原始诉求"),
    col("_kind", "当前类型"),
    col("_currentCategory", "当前类别"),
    col("_subtitle", "上报位置"),
  ],
};
export default {
  components: { Fields, BusinessDetail, SpaceFilter, ActionForm },
  props: { view: String },
  data: () => ({
    rows: [],
    options: { houses: [] },
    tasks: [],
    stats: {},
    busy: false,
    error: "",
    keyword: "",
    status: "",
    taskStatus: "",
    mineOnly: false,
    plate: "",
    park: "",
    business: "",
    paymentState: "",
    settlementState: "",
    startDate: "",
    endDate: "",
    space: {},
    page: 1,
    pageSize: 10,
    tab: "",
    selected: null,
    detailTable: "",
    actionTarget: null,
    action: "",
    form: {},
    fieldErrors: {},
    actionError: "",
    saving: false,
    actionNames,
    fieldById,
    paymentStates,
    settlementStates,
    generation: 0,
  }),
  computed: {
    title() {
      return definitions[this.view][0];
    },
    description() {
      return definitions[this.view][1];
    },
    tabs() {
      return this.view === "parking"
        ? [
            { key: "parkingRelations", label: "停车关系" },
            { key: "products", label: "月租产品" },
            { key: "monthly", label: "月租订单" },
            { key: "temporary", label: "临停账单" },
            { key: "checks", label: "待处理" },
          ]
        : this.view === "payments"
        ? [
            { key: "payments", label: "缴费记录" },
            { key: "dues", label: "待缴记录" },
            { key: "checks", label: "待处理" },
          ]
        : [];
    },
    table() {
      return (
        this.tab ||
        {
          bills: "bills",
          tasks: "workorders",
          repairs: "reports",
          hazards: "workorders",
        }[this.view]
      );
    },
    columns() {
      return layouts[this.table] || [];
    },
    idLabel() {
      return {
        bills: "账单编号",
        payments: "缴费编号",
        dues: "原单编号",
        parkingRelations: "关系编号",
        products: "产品编号",
        monthly: "订单编号",
        temporary: "临停单编号",
        checks: "核对编号",
        workorders: "工单编号",
        reports: "上报编号",
      }[this.table];
    },
    financial() {
      return ["bills", "payments", "dues", "monthly", "temporary"].includes(
        this.table
      );
    },
    statusChoices() {
      return listStates[this.table] || [];
    },
    taskTabs() {
      return [{ value: "", label: `全部 (${this.rows.length})` },
        ...this.statusChoices.map(value => ({ value, label: `${value} (${this.rows.filter(r => r._status === value).length})` }))];
    },
    businessTypes() {
      return this.view === "parking"
        ? ["停车月租", "临停"]
        : ["物业费", "停车月租", "临停"];
    },
    parkChoices() {
      return [
        ...new Map(
          (this.options.relations || []).map((r) => [
            r.PK04,
            { value: r.PK04, label: r.PK05 },
          ])
        ).values(),
      ];
    },
    newAction() {
      return this.view === "tasks"
        ? "report"
        : this.view === "parking"
        ? {
            parkingRelations: "saveParkingRelation",
            products: "saveProduct",
            temporary: "saveTemporary",
          }[this.table]
        : "";
    },
    publicCandidates() {
      return this.actionTarget?.rounds?.slice(-1)[0]?.PR06 || [];
    },
    filterStamp() {
      return [
        this.keyword,
        this.status,
        this.taskStatus,
        this.mineOnly,
        this.plate,
        this.park,
        this.business,
        this.paymentState,
        this.settlementState,
        this.startDate,
        this.endDate,
      ].join("|");
    },
    filtered() {
      return this.rows.filter(
        (r) =>
          (!this.keyword || JSON.stringify(r).includes(this.keyword)) &&
          (!this.status || r._status === this.status) &&
          (this.view !== "tasks" || !this.taskStatus || r._status === this.taskStatus) &&
          (this.view !== "tasks" || !this.mineOnly || r._assignee === this.options.actor?.id) &&
          (!this.plate || (r._plate || r.TB02 || "").includes(this.plate)) &&
          (!this.park || r._parkId === this.park) &&
          (!this.business || r._businessType === this.business) &&
          (!this.paymentState || r._paymentState === this.paymentState) &&
          (!this.settlementState ||
            r._settlementState === this.settlementState) &&
          (!this.startDate || r._date?.slice(0, 10) >= this.startDate) &&
          (!this.endDate || r._date?.slice(0, 10) <= this.endDate) &&
          (!this.$route.query.states ||
            this.$route.query.states.split(",").includes(r._status))
      );
    },
    pageRows() {
      return this.filtered.slice(
        (this.page - 1) * this.pageSize,
        this.page * this.pageSize
      );
    },
  },
  watch: {
    filterStamp() {
      this.page = 1;
    },
    space: {
      deep: true,
      handler() {
        this.page = 1;
        this.load();
      },
    },
    "$route.query"() {
      this.load();
    },
    view() {
      this.tab = this.tabs[0]?.key || "";
      this.selected = null;
      this.resetFilters();
      this.load();
    },
  },
  created() {
    this.tab = this.$route.query.tab || this.tabs[0]?.key || "";
    this.off = service.onChange(this.load);
    this.load();
  },
  beforeDestroy() {
    this.off?.();
    this.generation++;
  },
  methods: {
    selectTaskStatus(value) {
      this.taskStatus = value;
      this.page = 1;
    },
    display: format,
    actionsFor: rowActions,
    cell(r, c) {
      const v = r[c.key];
      if (c.money)
        return v === undefined ? "—" : "¥" + (Number(v) / 100).toFixed(2);
      if (["MP10", "MO20", "TB17"].includes(c.key) && !v) return "未登记";
      return v === undefined || v === "" ? "—" : format(c.key, v, r._labels);
    },
    resetFilters() {
      this.keyword =
        this.status =
        this.plate =
        this.park =
        this.business =
        this.paymentState =
        this.settlementState =
        this.startDate =
        this.endDate =
          "";
      this.taskStatus = "";
      this.mineOnly = false;
      this.page = 1;
    },
    async load() {
      const gen = ++this.generation;
      this.busy = true;
      this.error = "";
      try {
        const options = await service.stage01.options();
        if (gen !== this.generation) return;
        this.options = options;
        if (this.view === "overview") {
          this.stats = await service.stage01.overview();
          return;
        }
        let rows = await service.stage01.query(this.table, {
          space: this.space,
          allScope: this.view === "bills",
        });
        if (gen !== this.generation) return;
        if (this.view === "hazards")
          rows = rows.filter((r) => r._kind === "隐患");
        if (this.view === "parking" && this.table === "checks")
          rows = rows.filter((r) => r._businessType !== "物业费");
        this.rows = rows;
        this.page = Math.min(
          this.page,
          Math.max(1, Math.ceil(this.filtered.length / this.pageSize))
        );
        const q = this.$route.query;
        if (q.legacyEvent) {
          const e = await service.stage01.record("events", q.legacyEvent);
          if (e._workorder)
            await this.open({ _id: e._workorder, _table: "workorders" });
          return;
        }
        if (q.legacyReport) {
          try {
            const report = await service.stage01.record('reports', q.legacyReport);
            if (!report._workorder) throw new Error('关联工单不存在');
            await this.open({ _id: report._workorder, _table: 'workorders' });
          } catch (e) { this.error = e.message || '记录不存在或无权访问'; }
          return;
        }
        const id = q.id || this.selected?._id;
        if (id) {
          const t = q.detail || this.detailTable || this.table;
          this.selected = await service.stage01.record(t, id);
          this.detailTable = t;
        }
      } catch (e) {
        this.error = e.message;
        this.rows = [];
        this.selected = null;
      } finally {
        if (gen === this.generation) this.busy = false;
      }
    },
    changeTab(t) {
      this.tab = t;
      this.selected = null;
      this.resetFilters();
      this.$router.replace({ query: { tab: t } }).catch(() => {});
      this.load();
    },
    async open(r) {
      try {
        this.detailTable = r._table || this.table;
        this.selected = await service.stage01.record(this.detailTable, r._id);
        this.$router
          .replace({
            query: {
              tab: this.tab || undefined,
              detail: this.detailTable,
              id: r._id,
            },
          })
          .catch(() => {});
      } catch (e) {
        this.error = e.message;
      }
    },
    close() {
      this.selected = null;
      this.$router
        .replace({ query: { tab: this.tab || undefined } })
        .catch(() => {});
    },
    drill(id) {
      this.$router.push({
        path: "/workorders/tasks",
        query: {
          states: {
            ST01: "待处理",
            ST02: "待派单",
            ST03: "处理中",
            ST04: "待评价",
            ST05: "待确认",
          }[id],
        },
      });
    },
    cancel() {
      if (!this.saving) {
        this.action = "";
        this.actionTarget = null;
      }
    },
    async start(a, row) {
      this.actionError = "";
      this.fieldErrors = {};
      try {
        let r = row
          ? await service.stage01.record(row._table || this.table, row._id)
          : null;
        if (r && ["queryPayment", "recoverPayment"].includes(a))
          r = await service.stage01.record("payments", r._paymentId);
        this.actionTarget = r;
        this.action = a;
        this.form = {
          ...(r || {}),
          ...(r?.draft || {}),
          RP07: "报修",
          RP08: "设施维修",
          RP09: this.options.communities?.[0]?.value || "",
          RP10: this.options.estates?.[0]?.value || "",
          RP11: "公共位置",
          RV02: r?.WO12,
          RV03: "通过",
          WO04:
            r?.WO04 ||
            this.options.personnel?.find(
              (p) => p.account === this.options.actor.id
            )?.value ||
            "",
          WO22: r?.WO22 || r?.report?.RP15 || "",
          WO23: r?.WO23 || r?.report?.RP16 || "",
          WO18: "",
          WO19: [],
          PK07: r?.PK07 || "有效",
          MP07: r?.MP07 || "启用",
          EV13: [],
          EX06: "",
          EX10: "",
          EX07: [],
          IR09: false,
        };
        for (const k of moneyFields)
          if (this.form[k] !== undefined)
            this.form[k] = (Number(this.form[k]) / 100).toFixed(2);
        if (a === "markDuplicate")
          this.tasks = (await service.stage01.query("workorders")).filter(
            (t) => t._id !== r._id
          );
      } catch (e) {
        this.error = e.message;
        this.action = "";
      }
    },
    async save() {
      if (this.saving) return;
      this.saving = true;
      this.actionError = "";
      try {
        const r = this.actionTarget,
          p = {
            data: this.form,
            id: r?._id,
            table: r?._table,
            revision: r?._rev,
            operation:
              "web-" +
              this.action +
              "-" +
              (r?._id ||
                this.form._request ||
                (this.form._request = Date.now())) +
              "-" +
              (r?._rev || "new"),
          };
        if (this.action === "publish") p.confirm = this.form.IR09 === true;
        if (["saveCheck", "createCheck"].includes(this.action)) {
          if (!this.form.EX06?.trim()) throw new Error("请填写处理意见");
          p.note = this.form.EX06;
          p.next = this.form.EX10;
          p.photos = this.form.EX07 || [];
        }
        if (this.action === "createCheck") {
          const check = await service.stage01.command("createCheck", p);
          const c = await service.stage01.record("checks", check.id);
          await service.stage01.command("saveCheck", {
            id: c._id,
            revision: c._rev,
            note: p.note,
            next: p.next,
            photos: p.photos,
            operation: p.operation + "-note",
          });
        } else await service.stage01.command(this.action, p);
        this.action = "";
        this.actionTarget = null;
        await this.load();
        this.$Message.success("办理已保存");
      } catch (e) {
        this.actionError = e.message;
        this.fieldErrors = e.fields || {};
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
