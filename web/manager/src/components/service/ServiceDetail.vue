<template>
  <div class="service-detail">
    <details
      v-for="section in sections"
      :key="section.id"
      class="detail-section"
      open
    >
      <summary>
        {{ cleanTitle(tableById[section.id] && tableById[section.id].title, section.id) }}
      </summary>
      <p v-if="!section.sources.length" class="detail-empty">
        {{ emptyMessage(section.id) }}
      </p>
      <article
        v-for="(source, index) in section.sources"
        :key="index"
        class="detail-object"
      >
        <h4 v-if="source._contextLabel || section.sources.length > 1">
          {{ objectTitle(source, index) }}
        </h4>
        <dl class="detail-fields">
          <div
            v-for="f in fields(section.id, source)"
            :key="f.id"
            :data-field="f.id"
          >
            <dt>{{ f.name }}</dt>
            <dd>
              <ServiceEvidence
                v-if="isFile(f)"
                :value="array(fieldValue(source, f))"
                :record="record"
                :table="table"
                :field="f.name"
                :field-id="f.id"
                :label="f.name"
              />
              <ServiceValues
                v-else-if="isStructured(fieldValue(source, f))"
                :value="fieldValue(source, f)"
                :path="f.id"
                :options="options"
                :label="f.name"
              />
              <span
                v-else
                :data-empty="
                  fieldValue(source, f) === undefined ||
                  fieldValue(source, f) === null ||
                  fieldValue(source, f) === ''
                    ? 'true'
                    : undefined
                "
                >{{ show(fieldValue(source, f), f) }}</span
              >
            </dd>
          </div>
        </dl>
      </article>
    </details>
    <details v-if="showExtras && extras.length" class="related-records" open>
      <summary>关联业务信息</summary>
      <section v-for="[key, value] in extras" :key="key">
        <h3>{{ sectionNames[key] || key }}</h3>
        <ServiceValues
          :value="value"
          :path="table + ':' + key"
          :options="options"
        />
      </section>
    </details>
  </div>
</template>
<script>
import { tableById } from "../../../../../prototype-shared/service/fields.js";
import ServiceEvidence from "./ServiceEvidence.vue";
import ServiceValues from "./ServiceValues.vue";
import { plain, valueOf, titleOf } from "./model";
const sectionNames = {
  snapshot: "下单时服务约定",
  published: "当前发布内容",
  submitted: "本次送审内容",
  approved: "本次审核通过内容",
  draft: "最新编辑内容",
  versions: "供给历史版本",
  arrangements: "历次服务安排",
  changes: "历次改期申请",
  rounds: "履约轮次",
  process: "过程记录",
  results: "服务结果版本",
  anomalies: "履约异常记录",
  fundRecords: "关联资金记录",
  applications: "申请与审核版本",
  申请历史: "历次经营范围申请",
  plans: "协商方案版本",
  rulings: "裁定结果版本",
  ruling: "当前裁定结果",
  evidence: "追加证据记录",
  items: "关联条目",
  afterSales: "关联售后",
  aftersales: "关联售后",
  currentAftersale: "当前售后",
  qualification: "服务经营资格",
  authorization: "当前授权",
  currentAuthorization: "当前授权",
  specifications: "服务规格",
  history: "业务操作历史",
};
const asArray = (v) =>
  Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v];
export default {
  name: "ServiceDetail",
  components: { ServiceEvidence, ServiceValues },
  props: {
    record: { type: Object, default: () => ({}) },
    table: String,
    options: { type: Object, default: () => ({}) },
    tableIds: { type: Array, default: () => [] },
    showExtras: { type: Boolean, default: true },
  },
  data: () => ({ tableById, sectionNames }),
  computed: {
    sections() {
      return this.tableIds
        .filter(this.tableApplicable)
        .map((id) => ({ id, sources: this.sources(id) }));
    },
    extras() {
      return Object.entries(this.record).filter(
        ([k, v]) =>
          !k.startsWith("_") &&
          v !== null &&
          typeof v === "object" &&
          !["history", "versions", "changes", "申请历史", "arrangements", "rounds", "process", "plans", "rulings"].includes(k) &&
          (!Array.isArray(v) || v.length > 0) &&
          Object.prototype.hasOwnProperty.call(sectionNames, k),
      );
    },
  },
  methods: {
    array: asArray,
    show(v, f) {
      if (v === null) {
        if (/实结|结算结果/.test(f.name)) return "尚无实际结算事实";
        if (/金额|资金|渠道/.test(f.name)) return "尚待核查";
        return "未记录";
      }
      if (v === undefined || v === "")
        return /输入|多行|选择/.test(f.type) ? "未填写" : "未记录";
      return plain(v);
    },
    cleanTitle(t, id) {
      if (id === '31-C') return '售后证据与处理';
      return (t || "业务资料").replace(/^表[^｜]+｜/, "");
    },
    objectTitle(r, i) {
      return r._contextLabel || titleOf(r) || "记录 " + (i + 1);
    },
    isStructured(v) {
      return v !== null && typeof v === "object";
    },
    isFile(f) {
      return (
        /图片集合|文件集合|上传/.test(f.type) && !/材料编辑|结构化/.test(f.type)
      );
    },
    serviceContent() {
      const r = this.record;
      return this.table === "services" &&
        r["审核状态"] === "待审核" &&
        r.submitted
        ? r.submitted
        : r;
    },
    specs() {
      return asArray(
        this.serviceContent()["服务规格集合"] ||
          this.record["服务规格集合"] ||
          this.record.published?.["服务规格集合"] ||
          this.record.specifications,
      );
    },
    combos() {
      return this.specs().flatMap((spec, i) => {
        const rows = asArray(
          spec["组合集合"] || spec["规格方式组合"] || spec["方式报价"],
        );
        return rows.length
          ? rows.map((combo, j) => ({
              ...this.record,
              ...spec,
              ...combo,
              _sourceKind: "combo",
              _contextLabel:
                (spec["规格名称"] || "规格 " + (i + 1)) +
                " · " +
                (combo["组合履约方式名称"] ||
                  combo["组合流程模板"] ||
                  "方式 " + (j + 1)),
            }))
          : [
              {
                ...this.record,
                ...spec,
                _sourceKind: "spec",
                _contextLabel: spec["规格名称"] || "规格 " + (i + 1),
              },
            ];
      });
    },
    sales() {
      if (this.table === "aftersales") return [this.record];
      const r = this.record;
      return asArray(r.aftersales || r.afterSales || r.currentAftersale);
    },
    tableApplicable(id) {
      if (id === "26-D" && this.options.actor?.grant?.sensitive === false)
        return false;
      const mode = this.record["履约方式名称"] || this.record._mode;
      if (id === "29-C" && mode === "预约到点") return false;
      if (id === "30-B" && mode === "上门") return false;
      if (id === "27-E")
        return this.combos().some(
          (c) =>
            c["组合流程模板"] === "预约到点" ||
            c["组合履约方式名称"] === "预约到点",
        );
      return true;
    },
    sources(id) {
      const r = this.record;
      if (id === "27-C")
        return [
          {
            ...r,
            ...this.serviceContent(),
            _contextLabel:
              r["审核状态"] === "待审核" ? "当前送审版本" : "当前编辑内容",
          },
        ];
      if (id === "27-D") return this.combos();
      if (id === "27-E")
        return this.combos()
          .filter(
            (c) =>
              c["组合流程模板"] === "预约到点" ||
              c["组合履约方式名称"] === "预约到点",
          )
          .flatMap((c) =>
            asArray(c["可服务门店或服务点"]).map((point, i) => ({
              ...r,
              ...point,
              _sourceKind: "point",
              _contextLabel:
                c._contextLabel +
                " · " +
                (point["地点名称"] || "地点 " + (i + 1)),
            })),
          );
      if (id === "26-D")
        return asArray(
          r[this.table === "personnel" ? "人员资质材料" : "服务资质材料"],
        ).map((m, i) => ({
          ...m,
          _sourceKind: "material",
          _contextLabel: m["材料名称"] || "材料 " + (i + 1),
        }));
      if (id === "29-C")
        return [{ ...r, ...(r["地点快照"] || {}), _sourceKind: "address" }];
      if (id === "28-A") return [{ ...r, ...(r["原始期望时间"] || {}) }];
      if (id === "28-B")
        return asArray(r.currentArrangement || asArray(r.arrangements).slice(-1)[0]).map((a, i) => ({
          ...r,
          ...a,
          _sourceKind: "arrangement",
          _contextLabel: "当前服务安排",
        }));
      if (id === "28-C")
        return asArray(r.changes).map((a, i) => ({
          ...r,
          ...a,
          _sourceKind: "change",
          _contextLabel: "改期申请 " + (a["改期申请编号"] || i + 1),
        }));
      if (id === "28-D")
        return asArray(r.currentArrangement)
          .filter((a) => a["安排状态"] === "已接受")
          .map((a) => ({
            ...r,
            ...a,
            _contextLabel: "有效约定 · " + a["安排服务日期"],
          }));
      if (id === "30-E")
        return asArray(r.anomalies).map((a, i) => ({
          ...r,
          ...a,
          _sourceKind: "anomaly",
          _contextLabel: "履约异常 " + (i + 1),
        }));
      if (id === "30-C")
        return asArray(r.rounds).slice(-1).flatMap((round, i) => {
          const events = asArray(round.results).slice(-1).map((x) => ({
            ...x,
            _eventKind: "result",
          }));
          return (events.length ? events : [{}]).map((event, j) => ({
            ...r,
            ...round,
            ...event,
            _sourceKind: event._eventKind || "round",
            _contextLabel:
              "履约轮次 " +
              (round["履约轮次"] || i + 1) +
              (event._eventKind === "process"
                ? " · 过程记录 " + (j + 1)
                : event._eventKind === "result"
                  ? " · 结果版本 " + (event["结果版本"] || j + 1)
                  : ""),
          }));
        });
      if (/^30-[ABD]$/.test(id) && id !== "30-B")
        return asArray(r.rounds).slice(-1).map((a, i) => ({
          ...r,
          ...a,
          ...(id === "30-D" ? r.result || r["当前结果"] || {} : {}),
          _sourceKind: "round",
          _contextLabel: "履约轮次 " + (a["履约轮次"] || i + 1),
        }));
      const fundType = { "29-F": "支付", "31-D": "退款", "32-D": "分账" }[id];
      if (fundType) {
        if (this.table === "funds" && r["资金类型"] === fundType) return [r];
        return asArray(r.fundRecords)
          .filter((f) => f["资金类型"] === fundType)
          .map((f) => ({
            ...r,
            ...f,
            _sourceKind: "fund",
            _contextLabel: fundType + " · " + (f["资金业务单号"] || f._id),
          }));
      }
      if (id === "32-E") {
        if (this.table === "funds" && ["退款", "回退"].includes(r["资金类型"]))
          return [r];
        return asArray(r.fundRecords)
          .filter((f) => ["退款", "回退"].includes(f["资金类型"]))
          .map((f) => ({
            ...r,
            ...f,
            _sourceKind: "fund",
            _contextLabel: f["资金类型"] + " · " + (f["资金业务单号"] || f._id),
          }));
      }
      if (["31-A", "31-B", "31-C", "31-G"].includes(id)) {
        return this.sales().flatMap((sale) => {
          if (id === "31-G")
            return asArray(
              sale.rulings?.length ? sale.rulings : sale.ruling,
            ).map((ruling, i) => ({
              ...sale,
              ...ruling,
              _sourceKind: "ruling",
              _contextLabel: "裁定版本 " + (ruling["裁定版本"] || i + 1),
            }));
          if (id === "31-B" && sale.plans?.length)
            return sale.plans.map((plan, i) => ({
              ...sale,
              ...plan,
              _sourceKind: "plan",
              _contextLabel: "方案版本 " + (plan["方案版本"] || i + 1),
            }));
          return [sale];
        });
      }
      if (id === "C2") return asArray(r.history);
      if (id === "C3")
        return asArray(r.history).flatMap((h) => asArray(h.changes));
      return [r];
    },
    emptyMessage(id) {
      return (
        {
          "26-D": "当前没有已关联的专项证明材料。",
          "27-D": "当前版本尚未配置服务规格。",
          "27-E": "该到点组合尚未关联服务地点。",
          "28-B": "尚无服务安排提案。",
          "28-C": "尚无改期申请。",
          "28-D": "当前尚无已接受安排。",
          "29-F": "尚未产生支付记录。",
          "30-A": "尚无可展示的履约轮次。",
          "30-C": "尚未提交过程或结果记录。",
          "30-D": "尚无可确认的服务结果。",
          "30-E": "尚未登记履约异常。",
          "31-A": "尚无售后记录。",
          "31-B": "尚无售后协商方案。",
          "31-C": "尚无售后追加记录。",
          "31-D": "尚未产生退款记录。",
          "31-G": "尚未录入线下裁定结果。",
          "32-D": "尚未产生分账记录。",
          "32-E": "尚未产生退款或回退记录。",
          C2: "尚无业务操作历史。",
          C3: "尚无产品字段变更明细。",
        }[id] || "当前暂无此类记录。"
      );
    },
    fields(id, source) {
      return (tableById[id]?.fields || []).filter((f) => {
        if (/历史|操作记录|变更记录|数据库|主键|外键|快照|版本$|^原始期望时间$|^当前安排$/.test(f.name) || (id === '30-C' && /^过程/.test(f.name))) return false;
        const value = this.fieldValue(source, f);
        return this.fieldApplicable(id, source, f) && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
      });
    },
    fieldApplicable(id, source, f) {
      const n = f.name,
        c = f.condition || "",
        mode = source["组合流程模板"] || source["履约方式名称"] || source._mode;
      if (/编辑：筛选时|编辑：查询时/.test(c) || n.endsWith("筛选"))
        return false;
      const visibility = (c.split("可见：")[1] || "").split("；")[0];
      if (
        visibility &&
        !/Web|双方|各端|授权|引用/.test(visibility) &&
        !/详情|历史/.test(visibility)
      )
        return false;
      if (
        /内部备注|裁定依据附件|核查依据|服务资质材料|人员资质材料|证明文件/.test(
          n,
        ) &&
        this.options.actor?.grant?.sensitive === false
      )
        return false;
      if (id === "27-A") {
        if (
          this.table === "categories" &&
          /^(履约方式编号|履约方式名称|履约方式说明|绑定流程模板|方式版本|方式状态)$/.test(
            n,
          )
        )
          return false;
        if (
          this.table === "methods" &&
          !/^(履约方式编号|履约方式名称|履约方式说明|绑定流程模板|方式版本|方式状态|配置变更原因|配置历史)$/.test(
            n,
          )
        )
          return false;
      }
      if (id === "27-D") {
        if (mode === "上门" && n === "可服务门店或服务点") return false;
        if (mode === "预约到点" && /^上门覆盖/.test(n)) return false;
      }
      if (n === "有效截止日期" && source["长期有效"] === true) return false;
      if (n === "商户资质要求说明" && !source["商户证明是否必需"]) return false;
      if (n === "人员资质要求说明" && !source["人员证明是否必需"]) return false;
      if (id === "28-A" && this.table === "services" && /期望|约时提示/.test(n))
        return false;
      if (
        id === "28-A" &&
        this.table === "orders" &&
        ["接收新预约状态", "暂停原因", "开关变更时间"].includes(n)
      )
        return false;
      if (id === "30-A" && mode === "预约到点" && /^到场/.test(n)) return false;
      if (id === "30-C" && source._sourceKind === "process" && !/^过程/.test(n))
        return false;
      if (id === "30-C" && source._sourceKind === "result" && /^过程/.test(n))
        return false;
      if (n === "裁定退款金额" && !/退款/.test(source["裁定结果"] || ""))
        return false;
      if (
        n === "继续或补充履约内容" &&
        !/继续|补充/.test(source["裁定结果"] || "")
      )
        return false;
      return true;
    },
    fieldValue(r, f) {
      let value = valueOf(r, f.name);
      if (value !== undefined) {
        const opts = /类目/.test(f.name)
          ? this.options.categories
          : /社区/.test(f.name)
            ? this.options.communities
            : /小区/.test(f.name)
              ? this.options.estates
              : /人员|执行人/.test(f.name)
                ? this.options.personnel
                : null;
        const label = (v) => {
          if (typeof v !== "string" || /编号/.test(f.name)) return v;
          const o = opts?.find((x) => (x.value || x._id || x.id) === v);
          return o?.label || o?.name || v;
        };
        return Array.isArray(value) ? value.map(label) : label(value);
      }
      if (f.name === "配置变更原因" && r.history?.length)
        return r.history[r.history.length - 1]["原因说明"];
      const map = {
        业务操作历史: "history",
        配置历史: "history",
        变更历史: "history",
        订单历史: "history",
        审核及监管历史: "history",
        审核及上下架历史: "history",
        分账历史: "history",
        回退处理历史: "history",
        异常核查历史: "history",
        处理历史: "history",
        裁定历史: "rulings",
        安排变更历史: "changes",
        服务规格集合: "specifications",
        规格集合: "specifications",
        服务安排历史: "arrangements",
        历次安排: "arrangements",
        履约轮次: "rounds",
        关联资金记录: "fundRecords",
      };
      if (map[f.name] && r[map[f.name]] !== undefined) return r[map[f.name]];
      for (const key of [
        "snapshot",
        "当前结果",
        "原始期望时间",
        "地点快照",
        "currentAuthorization",
        "authorization",
        "submitted",
        "published",
        "draft",
        "plan",
        "ruling",
        "currentArrangement",
        "latestResult",
        "result",
      ])
        if (
          r[key] &&
          typeof r[key] === "object" &&
          r[key][f.name] !== undefined
        )
          return r[key][f.name];
      return undefined;
    },
  },
};
</script>
<style scoped>
.detail-section {
  margin-bottom: 24px;
}
.detail-section > summary {
  font-size: 15px;
  padding: 10px 0;
  border-bottom: 2px solid #edf0f4;
  margin-bottom: 12px;
  color: #2d4259;
  cursor: pointer;
}
.detail-empty {
  padding: 14px;
  background: #f8fafc;
  color: #657180;
  border: 1px dashed #dce4ed;
  border-radius: 4px;
}
.detail-object h4 {
  font-size: 14px;
  background: #f4f7fa;
  padding: 10px;
  margin-bottom: 8px;
}
.detail-fields > div {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 20px;
  padding: 10px 0;
  border-bottom: 1px solid #eef1f5;
}
.detail-fields dt {
  color: #657180;
}
.detail-fields dd {
  min-width: 0;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.detail-fields [data-empty="true"] {
  color: #7c8796;
}
.related-records {
  padding: 14px;
  border: 1px solid #dce4ed;
  border-radius: 6px;
}
.related-records summary {
  cursor: pointer;
  color: #315f93;
}
.related-records section {
  margin-top: 18px;
}
.related-records h3 {
  font-size: 14px;
  margin-bottom: 10px;
}
@media (max-width: 800px) {
  .detail-fields > div {
    grid-template-columns: 130px minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
