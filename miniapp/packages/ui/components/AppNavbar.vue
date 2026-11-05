<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{
  title: string
  subtitle?: string
  showBrand?: boolean
  centered?: boolean
  brandIcon?: string
  showBack?: boolean
  large?: boolean
  showUser?: boolean
  compact?: boolean
}>(), { subtitle: '', showBrand: false, centered: false, brandIcon: 'brand-building', showBack: false, large: false, showUser: false, compact: false })

// H5 has no official capsule. WeChat reserves the real system menu bounds.
let statusBarHeight = 0
let navigationHeight = 56
let menuInset = 16
let menuBottom = 0
// #ifdef MP-WEIXIN
const windowInfo = uni.getWindowInfo()
const menu = uni.getMenuButtonBoundingClientRect()
statusBarHeight = windowInfo.statusBarHeight || 0
if (menu.width > 0 && menu.top >= statusBarHeight) {
  navigationHeight = Math.max(44, menu.height + (menu.top - statusBarHeight) * 2)
  menuInset = windowInfo.windowWidth - menu.left + 8
  menuBottom = menu.bottom
} else {
  // Invalid menu metrics: put all custom content below the system menu.
  menuBottom = statusBarHeight + 48
}
// #endif
const navbarStyle = {
  paddingTop: `${Math.max(statusBarHeight, menuBottom && menuInset === 16 ? menuBottom : 0)}px`,
  '--navigation-height': `${navigationHeight}px`,
  '--menu-inset': `${menuInset}px`,
}
const canGoBack = computed(() => getCurrentPages().length > 1)
const goBack = () => {
  if (canGoBack.value) uni.navigateBack({ delta: 1 })
  else uni.reLaunch({url: "/pages/profile/index"})
}
const goUser = () => {
  uni.redirectTo({ url: '/pages/profile/index' })
}
</script>

<template>
  <view class="navbar" :style="navbarStyle">
    <view class="navbar__inner" :class="{ 'navbar__inner--centered': centered, 'navbar__inner--large': large, 'navbar__inner--compact': compact }">
      <view v-if="showBack" class="navbar__back" aria-label="返回" @click="goBack"><AppIcon name="chevron-right" :size="20" /></view>
      <view v-else-if="showBrand" class="navbar__mark"><AppIcon :name="brandIcon" :size="22" /></view>
      <view v-else-if="large" class="navbar__accent" />
      <view class="navbar__copy">
        <text class="navbar__title">{{ title }}</text>
        <text v-if="subtitle" class="navbar__subtitle">{{ subtitle }}</text>
      </view>
      <view v-if="showUser" class="navbar__user-hit" aria-label="我的" @click="goUser"><view class="navbar__user"><AppIcon name="user" :size="20" /></view></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.navbar { position: sticky; z-index: 90; top: 0; width: 100%; background: rgba(248, 249, 252, 0.98); border-bottom: 1px solid rgba(225, 228, 230, 0.6); }
.navbar__inner { position: relative; display: flex; min-height: var(--navigation-height); align-items: center; gap: $space-2; padding: 0 var(--menu-inset) 0 $page-gutter; }
.navbar__mark { display: flex; width: 32px; height: 32px; flex: none; align-items: center; justify-content: center; border-radius: 10px; background: $color-primary-light; }
.navbar__back { display: flex; width: 44px; height: 44px; flex: none; align-items: center; justify-content: center; border-radius: 50%; }
.navbar__back :deep(image) { transform: rotate(180deg); }
.navbar__copy { flex: 1; min-width: 0; }
.navbar__accent { width: 6px; height: 20px; flex: none; border-radius: 999px; background: $color-primary; }
.navbar__user-hit { display: flex; width: 48px; height: 48px; flex: none; align-items: center; justify-content: center; }
.navbar__user { display: flex; width: 48px; height: 48px; align-items: center; justify-content: center; border-radius: 50%; background: $color-primary; }
.navbar__user :deep(image) { filter: brightness(0) invert(1); }
.navbar__inner--centered { padding-left: max(60px, var(--menu-inset)); padding-right: max(60px, var(--menu-inset)); }
.navbar__inner--centered .navbar__copy { text-align: center; }
.navbar__inner--centered .navbar__back { position: absolute; left: $page-gutter; }
.navbar__title, .navbar__subtitle { display: block; }
.navbar__title { font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
.navbar__inner--large .navbar__title { font-size: 22px; line-height: 32px; font-weight: 700; }
.navbar__inner--compact .navbar__title { font-size: 18px; line-height: 26px; font-weight: 600; }
.navbar__inner--compact .navbar__user-hit { width: $touch-target-min; height: $touch-target-min; }
.navbar__inner--compact .navbar__user { width: 32px; height: 32px; }
.navbar__subtitle { color: $color-text-secondary; font-size: 13px; }
</style>
