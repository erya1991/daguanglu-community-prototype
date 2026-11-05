<script setup lang="ts">
import { ref } from 'vue'
import { service } from '@/services/foundation'
const props = defineProps<{ info: any }>()
const emit = defineEmits<{ changed: [] }>()
const error = ref('')
async function account(e: any) {
  try {
    const a = props.info.accounts[Number(e.detail.value)]
    await service.identity(a.id, a.roles[0].id)
    emit('changed')
  } catch (e: any) {
    error.value = e.message
  }
}
async function role(e: any) {
  try {
    const a = props.info.accounts.find((a: any) => a.id === props.info.actor._id)
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
    ><text class="group-title">演示控制</text><text class="hint">虚构身份切换工具 · 不代表生产授权</text
    ><picker :range="info.accounts" range-key="name" @change="account"
      ><view class="control-row"
        ><text>当前演示账号</text><text>{{ info.actor.name }} ›</text></view
      ></picker
    ><picker
      :range="info.accounts.find((a: any) => a.id === info.actor._id)?.roles || []"
      range-key="name"
      @change="role"
      ><view class="control-row"
        ><text>当前业务角色</text><text>{{ info.actor.roleName }} ›</text></view
      ></picker
    ><view class="control-row"
      ><text>当前所属组织</text><text>{{ info.actor.orgName || '本人' }}</text></view
    ><view class="control-row"
      ><text>可见数据范围</text><text>{{ info.actor.scopeLabel || '本人／本主体' }}</text></view
    ><text class="hint">会话：{{ info.session }} · 种子：{{ info.version }} · 代次 {{ info.generation }}</text
    ><button class="reset-button" @click="reset">复位当前会话</button>
    <!-- #ifdef MP-WEIXIN --><text class="hint">以下为微信本端预置样例切换，不是Web或其他App同步。</text
    ><view class="actions"
      ><button @click="sample('initial')">未绑定样例</button
      ><button @click="sample('approved')">已通过样例</button></view
    ><!-- #endif --><text v-if="error" class="form-error">{{ error }}</text></view
  >
</template>
