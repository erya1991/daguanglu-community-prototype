<script setup lang="ts">
import { openPage } from '../../common/utils/navigation'
import type { NavItem } from '../../common/types/app'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  items: NavItem[]
  activePath: string
}>()
</script>

<template>
  <view class="tabbar" :style="{gridTemplateColumns: `repeat(${props.items.length}, 1fr)`}">
    <view
      v-for="item in props.items"
      :key="item.path"
      class="tabbar__item"
      :class="{ 'tabbar__item--active': item.path === activePath }"
      hover-class="tabbar__item--pressed"
      @click="openPage(item.path)"
    >
      <view class="tabbar__icon"><AppIcon :name="item.icon" :size="22" /></view>
      <text class="tabbar__label">{{ item.label }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar {
  position: fixed;
  z-index: 100;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  display: grid;
  min-height: $tabbar-height;

  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid $color-border;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -2px 12px rgba(27, 77, 83, 0.05);
}

.tabbar__item {
  display: flex;
  min-height: $tabbar-height;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-radius: 0;
  background: transparent;
  color: $color-text-secondary;
}

.tabbar__item--active {
  color: $color-primary;
  font-weight: 600;
}

.tabbar__item--pressed { background: rgba(27, 77, 83, 0.05); }
.tabbar__item:not(.tabbar__item--active) .tabbar__icon { opacity: 0.55; filter: grayscale(1); }

.tabbar__icon {
  display: flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  opacity: 0.48;
}

.tabbar__item--active .tabbar__icon { opacity: 1; }

.tabbar__label {
  margin-top: 2px;
  font-size: 13px;
  line-height: 18px;
}
</style>
