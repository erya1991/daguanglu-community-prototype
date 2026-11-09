<template>
  <Tag :color="color" class="application-status" :aria-label="'申请状态：' + status">{{ status || '—' }}</Tag>
</template>
<script>
export default {
  props: ['status'],
  computed: {
    color() { return { 待审核: 'orange', 已通过: 'green', 已驳回: 'red', 已撤回: 'default' }[this.status] || 'default' },
  },
}
</script>
