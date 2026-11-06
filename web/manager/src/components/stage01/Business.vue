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
    <template v-else
      ><Tabs v-if="tabs.length" :value="tab" @on-click="changeTab"
        ><TabPane v-for="t in tabs" :key="t.key" :name="t.key" :label="t.label"
      /></Tabs>
      <div class="s1-toolbar">
        <input
          v-model="keyword"
          data-field="QF01"
          placeholder="搜索业务编号或内容"
          aria-label="关键字"
          @input="page = 1"
        /><select
          v-if="statusChoices.length"
          v-model="status"
          aria-label="状态"
          @change="page = 1"
        >
          <option value="">全部状态</option>
          <option v-for="v in statusChoices" :key="v">{{ v }}</option></select
        ><select
          v-if="table === 'bills'"
          v-model="house"
          data-field="QF04"
          aria-label="房屋"
        >
          <option value="">全部授权房屋</option>
          <option v-for="h in options.houses" :key="h.value" :value="h.value">
            {{ h.label }}
          </option></select
        ><select
          v-if="view === 'parking' && table !== 'products'"
          v-model="vehicle"
          data-field="QF05"
          aria-label="车辆"
          @change="
            park = '';
            page = 1;
          "
        >
          <option value="">全部授权车辆</option>
          <option v-for="v in options.vehicles" :key="v.value" :value="v.value">
            {{ v.label }}
          </option></select
        ><select
          v-if="view === 'parking'"
          v-model="park"
          data-field="QF06"
          aria-label="停车场"
          @change="page = 1"
        >
          <option value="">全部授权停车场</option>
          <option v-for="v in parkChoices" :key="v.value" :value="v.value">
            {{ v.label }}
          </option></select
        ><select
          v-if="['payments', 'checks'].includes(table)"
          v-model="business"
          data-field="QF07"
          aria-label="业务类型"
          @change="page = 1"
        >
          <option value="">全部业务类型</option>
          <option v-for="v in ['物业费', '停车月租', '临停']" :key="v">
            {{ v }}
          </option></select
        ><input
          type="date"
          v-model="startDate"
          data-field="QF08"
          aria-label="查询开始日期"
        /><span>至</span
        ><input
          type="date"
          v-model="endDate"
          data-field="QF09"
          aria-label="查询结束日期"
        /><span class="s1-muted">{{ dateLabel }}</span>
      </div>
      <p v-if="busy">正在读取…</p>
      <div v-else class="s1-card">
        <div class="s1-scroll">
          <table class="s1-table">
            <thead>
              <tr>
                <th class="s1-id-cell">业务编号</th>
                <th>事项／对象</th>
                <th class="s1-period-cell">期间／位置</th>
                <th v-if="financial" class="s1-money-cell">
                  {{ table === "bills" ? "待缴金额" : "金额" }}
                </th>
                <th class="s1-state-cell">状态</th>
                <th class="s1-action-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in pageRows" :key="r._id">
                <td class="s1-id-cell">{{ r._id }}</td>
                <td>{{ r._title }}</td>
                <td class="s1-period-cell">
                  {{ r._subtitle || display(dateKey, r._date) }}
                </td>
                <td v-if="financial" class="s1-money-cell">
                  {{ r._amount === undefined ? "—" : money(r._amount) }}
                </td>
                <td class="s1-state-cell">{{ r._status }}</td>
                <td class="s1-action-cell">
                  <Button size="small" @click="open(r)">查看办理</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!filtered.length" data-field="QF13" class="s1-muted">
          当前条件下暂无记录
        </p>
        <div class="s1-toolbar">
          <span data-field="QF12">共 {{ filtered.length }} 条</span
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
          /><span data-field="QF11">每页 {{ pageSize }} 条</span>
        </div>
      </div></template
    >
    <p
      v-if="['parking', 'checks'].includes(view)"
      class="s1-muted"
      data-field="XI01"
    >
      平台停车记录可查询；闸机尚未接入，通行信息暂未同步。
    </p>
    <Drawer
      :value="!!selected"
      width="860"
      title="业务详情"
      class-name="s1-drawer"
      @on-close="close"
      ><div v-if="selected" class="s1">
        <div class="s1-summary">
          <div>
            <h2>{{ selected._title }}</h2>
            <p>{{ selected._subtitle }}</p>
            <Tag>{{ selected._status }}</Tag>
          </div>
          <strong v-if="selected._amount !== undefined" class="s1-money">{{
            money(selected._amount)
          }}</strong>
        </div>
        <div class="s1-actions">
          <Button
            v-for="a in actions"
            :key="a"
            :type="
              [
                'publish',
                'dispatch',
                'submitProcess',
                'review',
                'closeHazard',
              ].includes(a)
                ? 'primary'
                : 'default'
            "
            @click="start(a)"
            >{{ actionNames[a] }}</Button
          ><Button
            v-if="selected._workorder"
            @click="
              $router.push({
                path: '/workorders/tasks',
                query: { id: selected._workorder },
              })
            "
            >查看关联工单</Button
          >
        </div>
        <Tabs v-model="detailTab"
          ><TabPane label="事项信息" name="info"
            ><template v-if="selected.businessSummary">
              <h3>原业务摘要</h3>
              <Fields
                :row="selected.businessSummary"
                :ids="Object.keys(selected.businessSummary)"
                :table="table"
                :record-id="selected._id"
              />
            </template>
            <div v-for="section in detailSections" :key="section[0]">
              <h3>{{ section[0] }}</h3>
              <Fields
                :row="selected"
                :ids="section[1]"
                :table="table"
                :record-id="selected._id"
              />
            </div>
            <template v-if="selected.report"
              ><h3>原始上报</h3>
              <Fields
                :row="selected.report"
                :ids="range('RP', 1, 17)"
                :table="table"
                :record-id="selected._id" /></template
            ><template v-if="selected.event"
              ><h3>核实与公开反馈</h3>
              <Fields
                :row="selected.event"
                :ids="range('EV', 1, 13)"
                :table="table"
                :record-id="selected._id" /></template
            ><template v-if="selected.relation"
              ><h3>车辆车场</h3>
              <Fields
                :row="selected.relation"
                :ids="range('PK', 1, 7)" /></template
            ><template v-if="table === 'bills'"
              ><h3>缴费记录</h3>
              <p v-if="!selected.relatedPayments.length">暂无本账单付款</p>
              <button
                v-for="p in selected.relatedPayments"
                :key="p._id"
                @click="gotoPayment(p)"
              >
                {{ p.PY01 }} · {{ p.PY12 }}／{{ p.PY17 }}
              </button></template
            ></TabPane
          >
          <TabPane
            v-if="['workorders', 'events', 'reports'].includes(table)"
            label="处理与复核"
            name="process"
            ><template v-if="table === 'workorders'"
              ><label
                >处理轮次
                <select v-model="roundFilter" data-field="QF14">
                  <option value="">全部轮次</option>
                  <option
                    v-for="r in selected.rounds"
                    :key="r.PR01"
                    :value="r.PR10"
                  >
                    第{{ r.PR10 }}轮
                  </option>
                </select></label
              >
              <div
                v-for="r in selected.rounds.filter(
                  (r) => !roundFilter || String(r.PR10) === String(roundFilter)
                )"
                :key="r.PR01"
                class="s1-card"
              >
                <h3>第 {{ r.PR10 }} 轮处理</h3>
                <Fields
                  :row="r"
                  :ids="range('PR', 1, 11)"
                  :table="table"
                  :record-id="selected._id"
                />
              </div>
              <h3>复核记录</h3>
              <div v-for="r in selected.reviews" :key="r.RV01" class="s1-card">
                <Fields
                  :row="r"
                  :ids="range('RV', 1, 8)"
                  :table="table"
                  :record-id="selected._id"
                />
              </div>
              <h3>退单与内部转派</h3>
              <div v-for="(o, i) in selected.operations" :key="i">
                <Fields :row="o" :ids="range('OP', 1, 6)" /></div
            ></template>
            <h3>追加补充</h3>
            <div
              v-for="s in selected.RP18 ||
              (selected.report && selected.report.RP18) ||
              []"
              :key="s.SP01"
              data-field="RP18"
            >
              <Fields
                :row="s"
                :ids="range('SP', 1, 6)"
                :table="table"
                :record-id="selected._id"
              /></div
          ></TabPane>
          <TabPane
            v-if="['workorders', 'reports'].includes(table)"
            label="居民反馈"
            name="feedback"
            ><Fields
              :row="selected.resolution || selected"
              :ids="[...range('UC', 1, 6), ...range('VA', 1, 5)]"
              :table="table"
              :record-id="selected._id"
            /><Fields
              v-if="selected.feedback"
              :row="selected.feedback"
              :ids="['EV12', 'EV13']"
              :table="table"
              :record-id="selected._id"
            />
            <div
              v-for="(confirmation, i) in selected.confirmations || []"
              :key="'confirmation-' + i"
              class="s1-card"
            >
              <h3>第 {{ i + 1 }} 次居民确认</h3>
              <Fields
                :row="confirmation"
                :ids="range('UC', 1, 6)"
                :table="table"
                :record-id="selected._id"
              />
            </div>
          </TabPane>
          <TabPane label="操作记录" name="history"
            ><History
              :rows="selected.history"
              :data-field="
                {
                  bills: 'BL24',
                  payments: 'PY23',
                  checks: 'EX11',
                  parkingRelations: 'PK12',
                  monthly: 'MO19',
                  temporary: 'TB16',
                  events: 'EV14',
                  workorders: 'WO14',
                  reports: 'RP20',
                }[table]
              " /></TabPane
        ></Tabs></div
    ></Drawer>
    <Modal
      :z-index="3200"
      :value="!!action"
      :title="actionNames[action] || '办理'"
      :footer-hide="true"
      width="720"
      :mask-closable="false"
      @on-cancel="action = ''"
      class="s1"
      ><Alert v-if="actionError" type="error">{{ actionError }}</Alert>
      <div v-if="action === 'publish'">
        <Fields
          :row="selected"
          :ids="[
            'BL01',
            'BL07',
            'BL08',
            'BL10',
            'BL11',
            'BL13',
            'BL16',
            'BL18',
          ]"
        /><Checkbox v-model="form.IR09" data-field="IR09"
          >已核对单张账单，确认发布</Checkbox
        >
      </div>
      <ActionForm
        v-else-if="action"
        :action="action"
        v-model="form"
        :options="options"
        :records="events"
        :errors="fieldErrors"
        :kind="selected && selected._kind"
        :public-candidates="publicCandidates"
      />
      <div class="s1-actions">
        <Button type="primary" :loading="saving" @click="save"
          >确认{{ actionNames[action] }}</Button
        ><Button :disabled="saving" @click="action = ''">取消</Button>
      </div></Modal
    >
  </section>
</template>
<script>
import { service } from "../../services/foundation";
import Fields from "./Fields.vue";
import History from "./History.vue";
import ActionForm from "./ActionForm.vue";
import {
  sections,
  fieldById,
  fieldRange,
  format,
  actionNames,
  moneyFields,
} from "../../../../../prototype-shared/stage01/ui.js";
const definitions = {
  bills: ["物业费账单", "核验发布与单张账单查询"],
  payments: ["缴费记录与异常", "付款、核销和未缴费用分别核对"],
  parking: ["停车业务", "停车关系、月租预缴和临停费用分别办理"],
  checks: ["停车核查", "核对平台业务和支付事实"],
  events: ["待核实事件", "先人工核实，再派单处理"],
  tasks: ["工单办理", "每个动作独立记录处理人、时间与轮次"],
  overview: ["工单概况", "状态数量和时间事实，不作响应考核"],
  repairs: ["报修与居民反馈", "查看居民诉求、确认和评价"],
  hazards: ["隐患整改台账", "整改证据与有效复核支持销号"],
};
export default {
  components: { Fields, History, ActionForm },
  props: { view: String },
  data: () => ({
    rows: [],
    options: { houses: [] },
    events: [],
    stats: {},
    busy: false,
    error: "",
    keyword: "",
    status: "",
    house: "",
    vehicle: "",
    park: "",
    business: "",
    startDate: "",
    endDate: "",
    page: 1,
    pageSize: 10,
    tab: "",
    selected: null,
    detailTab: "info",
    roundFilter: "",
    action: "",
    form: {},
    fieldErrors: {},
    actionError: "",
    saving: false,
    actionNames,
    fieldById,
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
          ]
        : this.view === "payments"
        ? [
            { key: "payments", label: "缴费记录" },
            { key: "bills", label: "未缴费用" },
            { key: "checks", label: "异常核查" },
          ]
        : [];
    },
    table() {
      return (
        this.tab ||
        {
          bills: "bills",
          payments: "payments",
          parking: "parkingRelations",
          checks: "checks",
          events: "events",
          tasks: "workorders",
          repairs: "reports",
          hazards: "workorders",
        }[this.view]
      );
    },
    financial() {
      return ["bills", "payments", "parking", "checks"].includes(this.view);
    },
    newAction() {
      if (this.view === "events") return "report";
      if (this.view === "parking")
        return {
          parkingRelations: "saveParkingRelation",
          products: "saveProduct",
          temporary: "saveTemporary",
        }[this.table];
      return "";
    },
    filtered() {
      return this.rows.filter(
        (r) =>
          (!this.keyword ||
            JSON.stringify([
              r._id,
              r._title,
              r._subtitle,
              r.BL02,
              r.PY10,
              r.PK03,
              r.TB02,
            ]).includes(this.keyword)) &&
          (!this.status || r._status === this.status) &&
          (!this.house || r.BL07 === this.house) &&
          (!this.business ||
            r.PY02 === this.business ||
            (this.options.payments || []).some(
              (p) => p.PY03 === r.EX03 && p.PY02 === this.business
            )) &&
          this.parkingFilter(r) &&
          (!this.$route.query.states ||
            this.$route.query.states.split(",").includes(r._status)) &&
          (!this.startDate || r._date?.slice(0, 10) >= this.startDate) &&
          (!this.endDate || r._date?.slice(0, 10) <= this.endDate)
      );
    },
    pageRows() {
      return this.filtered.slice(
        (this.page - 1) * this.pageSize,
        this.page * this.pageSize
      );
    },
    statusChoices() {
      return [...new Set(this.rows.map((r) => r._status))];
    },
    parkChoices() {
      return [
        ...new Map(
          (this.options.relations || [])
            .filter((r) => !this.vehicle || r.PK02 === this.vehicle)
            .map((r) => [r.PK04, { value: r.PK04, label: r.PK05 }])
        ).values(),
      ];
    },
    dateLabel() {
      return this.table === "bills"
        ? "费用开始日期"
        : this.table === "payments"
        ? "渠道付款日期"
        : this.table === "monthly"
        ? "订单创建日期"
        : this.table === "temporary"
        ? "入场日期"
        : this.table === "workorders"
        ? "首次派单日期"
        : "上报／核查日期";
    },
    dateKey() {
      return "HI04";
    },
    detailSections() {
      return (sections[this.table] || []).filter(([title]) =>
        title === "隐患整改"
          ? this.selected?._kind === "隐患"
          : title === "已有退款事实"
          ? !!this.selected?.PY20
          : true
      );
    },
    actions() {
      const r = this.selected;
      if (!r) return [];
      if (this.table === "bills")
        return r.BL19 === "待发布" ? ["editBill", "publish"] : ["createCheck"];
      if (this.table === "payments")
        return [
          "queryPayment",
          ...(r.PY12 === "成功" && r.PY17 !== "成功" ? ["recoverPayment"] : []),
        ];
      if (this.table === "checks") return ["saveCheck"];
      if (this.table === "events")
        return ["待核实", "待补充", "待重新核实"].includes(r.EV09)
          ? ["verify"]
          : [];
      if (this.table === "workorders") return r._actions;
      if (this.table === "parkingRelations") return ["saveParkingRelation"];
      if (this.table === "products") return ["saveProduct"];
      if (this.table === "temporary") return ["saveTemporary"];
      return [];
    },
    publicCandidates() {
      return this.selected?.rounds?.slice(-1)[0]?.PR06 || [];
    },
  },
  watch: {
    "$route.query.id"() {
      this.load();
    },
    view() {
      this.tab = "";
      this.selected = null;
      this.house =
        this.vehicle =
        this.park =
        this.business =
        this.status =
        this.keyword =
          "";
      this.load();
    },
  },
  created() {
    this.tab = this.tabs[0]?.key || "";
    this.off = service.onChange(this.load);
    this.load();
  },
  beforeDestroy() {
    this.off?.();
  },
  methods: {
    display: format,
    range: fieldRange,
    money(n) {
      return "¥" + (Number(n) / 100).toFixed(2);
    },
    parkingFilter(r) {
      if (this.view !== "parking") return true;
      const relation =
        this.table === "parkingRelations"
          ? r
          : (this.options.relations || []).find(
              (x) => x._id === (r._relation || r.TB03)
            );
      return (
        (!this.vehicle ||
          this.table === "products" ||
          relation?.PK02 === this.vehicle) &&
        (!this.park || (r.MP03 || relation?.PK04) === this.park)
      );
    },
    async load() {
      this.busy = true;
      this.error = "";
      try {
        this.options = await service.stage01.options();
        if (this.table === "checks")
          this.options.payments = await service.stage01.query("payments");
        if (this.view === "overview")
          this.stats = await service.stage01.overview();
        else {
          this.rows = await service.stage01.query(this.table);
          if (this.view === "repairs")
            this.rows = this.rows.filter((r) => r.RP07 === "报修");
          if (this.view === "hazards")
            this.rows = this.rows.filter((r) => r._kind === "隐患");
          if (this.view === "payments" && this.table === "bills")
            this.rows = this.rows.filter((r) => r.BL16 > 0);
          if (this.view === "checks") {
            const ids = new Set(
              (this.options.payments || [])
                .filter((p) => p.PY02 !== "物业费")
                .map((p) => p.PY03)
            );
            this.rows = this.rows.filter((r) => ids.has(r.EX03));
          }
          const id = this.$route.query.id || this.selected?._id;
          if (id)
            try {
              this.selected = await service.stage01.record(this.table, id);
            } catch {
              this.selected = null;
            }
        }
      } catch (e) {
        this.error = e.message;
        this.rows = [];
        this.selected = null;
      } finally {
        this.busy = false;
      }
    },
    changeTab(t) {
      this.tab = t;
      if (!["payments", "checks"].includes(t)) this.business = "";
      this.page = 1;
      this.selected = null;
      if (this.$route.query.id) this.$router.replace({ query: {} });
      this.load();
    },
    async open(r) {
      this.selected = await service.stage01.record(this.table, r._id);
      this.detailTab = "info";
      this.$router.replace({ query: { ...this.$route.query, id: r._id } });
    },
    close() {
      this.selected = null;
      this.$router.replace({ query: {} });
    },
    gotoPayment(p) {
      this.$router.push({ path: "/property/payments", query: { id: p._id } });
    },
    drill(id) {
      this.$router.push({
        path: id === "ST01" ? "/workorders/events" : "/workorders/tasks",
        query: {
          states: {
            ST01: "待核实,待重新核实",
            ST02: "待派单",
            ST03: "待接单,处理中,退回整改",
            ST04: "待复核",
            ST05: "待居民确认",
          }[id],
        },
      });
    },
    async start(a) {
      this.actionError = "";
      this.fieldErrors = {};
      if (a === "publish") {
        this.action = a;
        this.form = { IR09: false };
        return;
      }
      if (
        [
          "accept",
          "closeHazard",
          "queryPayment",
          "recoverPayment",
          "createCheck",
        ].includes(a)
      ) {
        this.action = a;
        this.form = {};
        return;
      }
      this.action = a;
      const r = this.selected || {};
      this.form = {
        ...r,
        ...(r.draft || {}),
        RP07: "报修",
        RP08: "设施维修",
        EV03: r.EV03 || r.report?.RP08 || "设施维修",
        RP09: "C-A",
        RP10: "E-A",
        RP11: "公共位置",
        EV05: "有效",
        RV02: r.WO12,
        RV03: "通过",
        UC01: "已解决",
        VA01: "满意",
        WO04:
          this.options.personnel?.find(
            (p) => p.account === this.options.actor?.id
          )?.value || "",
        PK07: r.PK07 || "有效",
        MP07: r.MP07 || "启用",
        EV13: [],
      };
      for (const k of moneyFields)
        if (this.form[k] !== undefined)
          this.form[k] = (Number(this.form[k]) / 100).toFixed(2);
      if (a === "verify") this.events = await service.stage01.query("events");
    },
    async direct(name) {
      try {
        await service.stage01.command(name, {
          id: this.selected._id,
          revision: this.selected._rev,
          confirm: true,
          operation:
            "web-" + name + "-" + this.selected._id + "-" + this.selected._rev,
        });
        await this.load();
        this.$Message.success("办理已保存");
      } catch (e) {
        this.error = e.message;
      }
    },
    async save() {
      if (this.saving) return;
      this.saving = true;
      this.actionError = "";
      try {
        const p = {
          data: this.form,
          id: this.selected?._id,
          revision: this.selected?._rev,
          operation:
            "web-" +
            this.action +
            "-" +
            (this.selected?._id || Date.now()) +
            "-" +
            this.selected?._rev,
        };
        if (this.action === "publish") p.confirm = this.form.IR09 === true;
        if (this.action === "saveCheck") {
          p.note = this.form.EX06;
          p.next = this.form.EX10;
          p.photos = this.form.EX07 || [];
        }
        if (this.newAction === this.action && !this.selected) delete p.id;
        await service.stage01.command(this.action, p);
        this.action = "";
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
