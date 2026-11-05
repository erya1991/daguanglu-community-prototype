<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{
  icon: string
  tone?: 'teal' | 'orange' | 'green' | 'blue' | 'gray'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}>(), {
  tone: 'teal',
  size: 'md',
  disabled: false,
})
</script>

<template>
  <view class="icon-container" :class="[`icon-container--${tone}`, `icon-container--${size}`, { 'icon-container--disabled': disabled }]">
    <AppIcon :name="icon" :size="size === 'sm' ? 20 : size === 'lg' ? 28 : 24" />
  </view>
</template>

<style scoped lang="scss">
.icon-container {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
}

.icon-container--sm { width: 40px; height: 40px; border-radius: 12px; }
.icon-container--md { width: 48px; height: 48px; }
.icon-container--lg { width: 56px; height: 56px; border-radius: 16px; }
.icon-container--teal { background: #e7f1f1; }
.icon-container--orange { background: #faeee9; }
.icon-container--green { background: #e8f2ed; }
.icon-container--blue { background: #eaf0f7; }
.icon-container--gray { background: #f2f4f6; }
.icon-container--disabled { opacity: 0.72; filter: grayscale(0.35); }
</style>
