<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { service } from '@/services/foundation'
const props = defineProps<{ info: any; stage02?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const error = ref('')
const expanded = ref(false)
const isStage02=computed(()=>!!props.stage02 || service.session.startsWith('stage02-') || (service.session==='微信本端样例' && ['resident','merchant'].includes(props.info?.actor.role)))
const serviceScenarios=ref<string[]>(['S02-BASE','S02-STATS']),serviceScenario=ref('S02-BASE'),serviceOutcome=ref('normal'),serviceRuleVersion=ref('DEMO-ALLOC-V1')
const serviceDate=ref('2026-11-07'),serviceTime=ref('08:00')
async function setServiceRuleVersion(e:any){try{serviceRuleVersion.value=['DEMO-ALLOC-V1','DEMO-ALLOC-V2'][Number(e.detail.value)];await service.service.auxiliary('rule-version',{version:serviceRuleVersion.value});emit('changed')}catch(e:any){error.value=e.message}}
async function setServiceClock(){try{await service.service.auxiliary('clock',{time:serviceDate.value+'T'+serviceTime.value+':00+08:00'});emit('changed')}catch(e:any){error.value=e.message}}
const outcomes=['normal','failure','unknown','pending'],outcomeLabels=['默认成功','失败','结果未知','在途']
async function scenarioChange(e:any){serviceScenario.value=serviceScenarios.value[Number(e.detail.value)];uni.showModal({title:'载入独立服务场景？',content:'只恢复当前会话Stage02业务及专属附件，保留其他阶段。',success:async r=>{if(r.confirm){try{await service.service.auxiliary('scenario',{name:serviceScenario.value});emit('changed')}catch(e:any){error.value=e.message}}}})}
async function serviceMode(e:any){try{serviceOutcome.value=outcomes[Number(e.detail.value)];await service.service.auxiliary('mode',{kind:'payment',outcome:serviceOutcome.value})}catch(e:any){error.value=e.message}}
function resetService(){uni.showModal({title:'仅复位Stage02？',content:'仅恢复当前会话便民服务与专属附件，保留Stage00/01和其他会话。',success:async r=>{if(r.confirm){try{await service.service.reset();emit('changed')}catch(e:any){error.value=e.message}}}})}

const extraAccounts=ref<any[]>([])
const availableAccounts=computed(()=>[...(props.info?.accounts||[]),...extraAccounts.value])
watch(()=>props.info,async()=>{try{extraAccounts.value=isStage02.value?await service.service.accounts():props.info?.actor.role==='property'?await service.stage01.accounts():[];if(isStage02.value){const opts=await service.service.options();serviceRuleVersion.value=opts.ruleVersion||'DEMO-ALLOC-V1';serviceDate.value=String(opts.clock||'2026-11-07').slice(0,10);serviceTime.value=String(opts.clock||'2026-11-07T08:00').slice(11,16);if(opts.scenarios?.length)serviceScenarios.value=opts.scenarios.map((x:any)=>typeof x==='string'?x:x.id||x.name)}}catch(e:any){error.value=e.message}},{immediate:true})
const mode=ref('normal'), modes=['normal','unknown','pending','failure','reconcile'], modeLabels=['正常缴费','支付结果未知','支付在途','付款失败','成功待核销']
async function paymentMode(e:any){mode.value=modes[Number(e.detail.value)];await service.stage01.auxiliary('mode',{mode:mode.value})}
async function stageReset(){uni.showModal({title:'仅复位Stage01？',content:'保留Stage00档案、关系与历史，仅恢复本阶段业务样例。',success:async r=>{if(r.confirm){await service.stage01.reset();emit('changed')}}})}
async function uploadFailure(e:any){await service.stage01.auxiliary('uploadFailure',{fail:e.detail.value})}
async function account(e: any) {
  try {
    const a = availableAccounts.value[Number(e.detail.value)]
    await service.identity(a.id, a.roles[0].id)
    emit('changed')
  } catch (e: any) {
    error.value = e.message
  }
}
async function role(e: any) {
  try {
    const a = availableAccounts.value.find((a: any) => a.id === props.info.actor._id)
    await service.identity(a.id, a.roles[Number(e.detail.value)].id)
    emit('changed')
  } catch (e: any) {
    error.value = e.message
  }
}
async function reset() {
  uni.showModal({
    title: '复位当前原型会话？',
    content: '仅清除本会话模拟修改和附件，恢复虚构种子；不清商城或其他会话。',
    success: async (r) => {
      if (r.confirm) {
        await service.reset()
        emit('changed')
      }
    },
  })
}
async function sample(name: string) {
  // This handler is only referenced by the MP-WEIXIN template branch.
  await service.sample!(name)
  emit('changed')
}
</script>
<template>
  <view class="demo-control" v-if="info"
    ><view class="control-row" role="button" @click="expanded = !expanded"><text class="group-title">演示身份与辅助工具</text><text>{{ expanded ? '收起' : '展开' }}</text></view><view v-if="expanded"><text class="hint">虚构身份切换工具 · 不代表生产授权</text
    ><picker v-if="availableAccounts.length > 1" :range="availableAccounts" range-key="name" @change="account"
      ><view class="control-row"
        ><text>演示身份</text><text>{{ info.actor.name }} ›</text></view
      ></picker
    ><picker
      v-if="(availableAccounts.find((a: any) => a.id === info.actor._id)?.roles.length || 0) > 1"
      :range="availableAccounts.find((a: any) => a.id === info.actor._id)?.roles || []"
      range-key="name"
      @change="role"
      ><view class="control-row"
        ><text>当前业务角色</text><text>{{ info.actor.roleName }} ›</text></view
      ></picker
    ><view class="control-row" v-if="availableAccounts.length <= 1"><text>当前身份</text><text>{{ info.actor.roleName }}</text></view
    ><view class="control-row"
      ><text>当前所属组织</text><text>{{ info.actor.orgName || '本人' }}</text></view
    ><view class="control-row"
      ><text>可见数据范围</text><text>{{ info.actor.scopeLabel || '本人／本主体' }}</text></view
    ><text class="hint">会话：{{ info.session }} · 种子：{{ info.version }} · 代次 {{ info.generation }}</text
    ><view v-if="!isStage02 && ['resident','property'].includes(info.actor.role)" class="stage01-tools"><text class="hint">Stage01价格、自然月期间、评价字典和附件限制是演示样例。</text><picker :range="modeLabels" @change="paymentMode"><view class="control-row"><text>下次付款场景</text><text>{{modeLabels[modes.indexOf(mode)]}} ›</text></view></picker><view class="control-row"><text>上传失败场景</text><switch @change="uploadFailure"/></view><button @click="stageReset">仅复位Stage01</button></view><button v-if="!isStage02" class="reset-button" @click="reset">复位当前会话</button>
    <view v-if="isStage02" class="stage02-tools"><text class="group-title">Stage02场景辅助</text><text class="hint">资金结果为演示返回，不会真实扣款。正常主线无需辅助按钮。</text><picker :range="serviceScenarios" @change="scenarioChange"><view class="control-row"><text>独立服务场景</text><text>{{serviceScenario}} ›</text></view></picker><picker :range="outcomeLabels" @change="serviceMode"><view class="control-row"><text>下次付款返回</text><text>{{outcomeLabels[outcomes.indexOf(serviceOutcome)]}} ›</text></view></picker><view class="control-row"><text>可重放场景时间</text><picker mode="date" :value="serviceDate" @change="serviceDate=$event.detail.value"><text>{{serviceDate}} ›</text></picker><picker mode="time" :value="serviceTime" @change="serviceTime=$event.detail.value"><text>{{serviceTime}} ›</text></picker></view><button @click="setServiceClock">设置场景时间</button><text class="hint">仅调整场景当前时间，已有业务发生时间保留。</text><picker :range="['演示返回 V1','演示返回 V2']" @change="setServiceRuleVersion"><view class="control-row"><text>只读演示返回版本</text><text>{{serviceRuleVersion}} ›</text></view></picker><text class="hint">只影响后续新订单快照，原订单及资金保留；没有商业费率配置。</text><button @click="resetService">仅复位Stage02</button></view>
    <!-- #ifdef MP-WEIXIN --><text class="hint">以下为微信本端预置样例切换，不是Web或其他App同步。</text
    ><view v-if="!isStage02" class="actions"
      ><button @click="sample('initial')">未绑定样例</button
      ><button @click="sample('approved')">已通过样例</button></view
    ><!-- #endif --><text v-if="error" class="form-error">{{ error }}</text></view></view
  >
</template>
