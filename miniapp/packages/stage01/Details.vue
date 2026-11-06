<script setup lang="ts">
import { ref, computed } from "vue";
import { sections, fieldRange, format } from "@core/stage01/ui.js";
import Fields from "./Fields.vue";
const props = defineProps<{ row: any; table: string }>(),
  expanded = ref<Record<string, boolean>>({});
const sectionMap = sections as Record<string, Array<[string, string[]]>>;
const groups = computed(() =>
  (sectionMap[props.table] || []).filter(([title]) =>
    title === "隐患整改"
      ? props.row._kind === "隐患"
      : title === "已有退款事实"
      ? !!props.row.PY20
      : true
  )
);
const roundFilter = ref(0);
const visibleRounds = computed(() =>
  (props.row.rounds || []).filter(
    (r: any) => !roundFilter.value || r.PR10 === roundFilter.value
  )
);
function toggle(key: string) {
  expanded.value[key] = !expanded.value[key];
}
</script>
<template>
  <view v-if="row"
    ><view v-if="row.businessSummary" class="s1-detail-group"
      ><text class="group-title">缴费时的业务信息</text
      ><Fields
        :row="row.businessSummary"
        :ids="Object.keys(row.businessSummary)" /></view
    ><view v-for="section in groups" :key="section[0]" class="s1-detail-group"
      ><view class="group-title" @click="toggle(section[0])"
        >{{ section[0] }}
        <text>{{ expanded[section[0]] ? "收起" : "查看" }}</text></view
      ><Fields
        v-if="expanded[section[0]]"
        :row="row"
        :ids="section[1]"
        :table="table"
        :record-id="row._id" /></view
    ><view v-if="row.report" class="s1-detail-group"
      ><view class="group-title" @click="toggle('report')"
        >原始上报 <text>{{ expanded.report ? "收起" : "查看" }}</text></view
      ><Fields
        v-if="expanded.report"
        :row="row.report"
        :ids="fieldRange('RP', 1, 17)"
        :table="table"
        :record-id="row._id" /></view
    ><view v-if="row.event" class="s1-detail-group"
      ><view class="group-title" @click="toggle('event')"
        >核实记录 <text>{{ expanded.event ? "收起" : "查看" }}</text></view
      ><Fields
        v-if="expanded.event"
        :row="row.event"
        :ids="fieldRange('EV', 1, 13)"
        :table="table"
        :record-id="row._id" /></view
    ><view
      v-if="
        row.feedback &&
        (row.feedback.EV07 || row.feedback.EV12 || row.feedback.EV13?.length)
      "
      class="s1-detail-group"
      ><text class="group-title">{{
        row.feedback.EV07 ? "待补充内容" : "公开处理结果"
      }}</text
      ><Fields
        :row="row.feedback"
        :ids="['EV07', 'EV12', 'EV13']"
        :table="table"
        :record-id="row._id" /></view
    ><view
      v-if="
        row.resolution &&
        row.RP07 !== '隐患' &&
        (row._canConfirm ||
          row._canEvaluate ||
          row.resolution.UC05 ||
          row.resolution.VA04)
      "
      class="s1-detail-group"
      ><text class="group-title">本人确认与评价</text
      ><Fields
        :row="row.resolution"
        :ids="[...fieldRange('UC', 1, 6), ...fieldRange('VA', 1, 5)]"
        :table="table"
        :record-id="row._id" /></view
    ><view
      v-for="s in row.RP18 || row.report?.RP18 || []"
      :key="s.SP01"
      class="s1-detail-group"
      data-field="RP18"
      ><text class="group-title">追加补充</text
      ><Fields
        :row="s"
        :ids="fieldRange('SP', 1, 6)"
        :table="table"
        :record-id="row._id" /></view
    ><view
      v-for="(confirmation, i) in row.confirmations || []"
      :key="'confirmation-' + i"
      class="s1-detail-group"
    >
      <view class="group-title" @click="toggle('confirmation-' + i)"
        >第 {{ i + 1 }} 次居民确认 <text>查看</text></view
      >
      <Fields
        v-if="expanded['confirmation-' + i]"
        :row="confirmation"
        :ids="fieldRange('UC', 1, 6)"
        :table="table"
        :record-id="row._id"
      /> </view
    ><view
      v-for="(operation, i) in row.operations || []"
      :key="'operation-' + i"
      class="s1-detail-group"
    >
      <view class="group-title" @click="toggle('operation-' + i)"
        >退单与内部转派记录 <text>查看</text></view
      >
      <Fields
        v-if="expanded['operation-' + i]"
        :row="operation"
        :ids="fieldRange('OP', 1, 6)"
      /> </view
    ><picker
      v-if="row.rounds?.length"
      :range="['全部处理轮次',...row.rounds.map((r:any)=>'第'+r.PR10+'轮')]"
      @change="
        roundFilter = Number($event.detail.value)
          ? row.rounds[Number($event.detail.value) - 1].PR10
          : 0
      "
      ><view class="group-title" data-field="QF14"
        >{{ roundFilter ? "第" + roundFilter + "轮" : "全部处理轮次" }} ›</view
      ></picker
    ><view v-for="r in visibleRounds" :key="r.PR01" class="s1-detail-group"
      ><view class="group-title" @click="toggle(r.PR01)"
        >第 {{ r.PR10 }} 轮处理 <text>查看</text></view
      ><Fields
        v-if="expanded[r.PR01]"
        :row="r"
        :ids="fieldRange('PR', 1, 11)"
        :table="table"
        :record-id="row._id" /></view
    ><view v-for="r in row.reviews || []" :key="r.RV01" class="s1-detail-group"
      ><view class="group-title" @click="toggle(r.RV01)"
        >第 {{ r.RV02 }} 轮复核 · {{ r.RV03 }} <text>查看</text></view
      ><Fields
        v-if="expanded[r.RV01]"
        :row="r"
        :ids="fieldRange('RV', 1, 8)"
        :table="table"
        :record-id="row._id" /></view
    ><view
      class="s1-detail-group"
      :data-field="({bills:'BL24',payments:'PY23',parkingRelations:'PK12',monthly:'MO19',temporary:'TB16',reports:'RP20',events:'EV14',workorders:'WO14',checks:'EX11'} as Record<string,string>)[table]"
      ><view class="group-title" @click="toggle('history')"
        >办理轨迹 <text>{{ expanded.history ? "收起" : "展开" }}</text></view
      ><view v-if="expanded.history"
        ><view v-for="h in row.history || []" :key="h.HI01" class="timeline"
          ><text data-field="HI02">{{ h.HI02 }}</text
          ><text class="hint"
            ><text data-field="HI03">{{ h.HI03 }}</text> ·
            <text data-field="HI04">{{ format("HI04", h.HI04) }}</text></text
          ><text data-field="HI07">{{ h.HI07 }}</text
          ><view @click="toggle(h.HI01)" class="hint">查看变更</view
          ><Fields
            v-if="expanded[h.HI01]"
            :row="h"
            :ids="['HI01', 'HI05', 'HI06', 'HI08']" /></view></view></view
  ></view>
</template>
<style scoped>
.s1-detail-group {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
  border: 1px solid #e6ece9;
  min-width: 0;
}
.group-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.6;
  min-height: 40px;
  align-items: center;
}
.group-title text {
  font-size: 13px;
  color: #27644f;
  font-weight: 400;
  flex-shrink: 0;
}
.timeline {
  padding: 12px 0 12px 12px;
  border-left: 2px solid #dce8e2;
  line-height: 1.7;
}
.timeline > text,
.hint {
  display: block;
}
.hint {
  font-size: 12px;
  color: #5c6e70;
  padding: 6px 0;
}
</style>
