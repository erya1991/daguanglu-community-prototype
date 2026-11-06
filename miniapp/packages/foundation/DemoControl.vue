<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { service } from '@/services/foundation'
const props = defineProps<{ info: any }>()
const emit = defineEmits<{ changed: [] }>()
const error = ref('')
const expanded = ref(false)
const extraAccounts=ref<any[]>([])
const availableAccounts=computed(()=>[...(props.info?.accounts||[]),...extraAccounts.value])
watch(()=>props.info,async()=>{extraAccounts.value=props.info?.actor.role==='property'?await service.stage01.accounts():[]},{immediate:true})
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
    ><view v-if="['resident','property'].includes(info.actor.role)" class="stage01-tools"><text class="hint">Stage01价格、自然月期间、评价字典和附件限制是演示样例。</text><picker :range="modeLabels" @change="paymentMode"><view class="control-row"><text>下次付款场景</text><text>{{modeLabels[modes.indexOf(mode)]}} ›</text></view></picker><view class="control-row"><text>上传失败场景</text><switch @change="uploadFailure"/></view><button @click="stageReset">仅复位Stage01</button></view><button class="reset-button" @click="reset">复位当前会话</button>
    <!-- #ifdef MP-WEIXIN --><text class="hint">以下为微信本端预置样例切换，不是Web或其他App同步。</text
    ><view class="actions"
      ><button @click="sample('initial')">未绑定样例</button
      ><button @click="sample('approved')">已通过样例</button></view
    ><!-- #endif --><text v-if="error" class="form-error">{{ error }}</text></view></view
  >
</template>
