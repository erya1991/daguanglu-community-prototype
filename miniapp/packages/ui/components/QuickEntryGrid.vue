<script setup lang="ts">
import { ref } from 'vue'
import type { QuickEntry } from '../../common/types/app'
import { openPage } from '../../common/utils/navigation'
import IconContainer from './IconContainer.vue'
import FeatureUnavailable from './FeatureUnavailable.vue'

const props = defineProps<{ items: QuickEntry[]; columns?: number; compact?: boolean }>()
const showUnavailable = ref(false)

const handleClick = (item: QuickEntry) => {
  if (!item.available || !item.path) {
    showUnavailable.value = true
    return
  }
  openPage(item.path)
}
</script>

<template>
  <view class="entry-grid" :class="{ 'entry-grid--compact': compact }" :style="{ gridTemplateColumns: `repeat(${columns || 4}, minmax(0, 1fr))` }">
    <view v-for="item in props.items" :key="item.id" class="entry" hover-class="entry--pressed" @click="handleClick(item)">
      <IconContainer :icon="item.icon" :tone="item.tone || 'teal'" />
      <text class="entry__label">{{ item.label }}</text>
    </view>
    <FeatureUnavailable v-show="showUnavailable" @close="showUnavailable = false" />
  </view>
</template>

<style scoped lang="scss">
.entry-grid { display: grid; gap: $space-4 $space-2; padding-top: $space-2; }
.entry { display: flex; min-height: 76px; align-items: center; justify-content: flex-start; flex-direction: column; background: transparent; color: $color-text-primary; }
.entry--pressed { opacity: 0.72; }
.entry__label { margin-top: $space-2; font-size: 14px; line-height: 20px; text-align: center; }
.entry-grid--compact { gap: $space-3 $space-1; }
</style>
