<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  size?: 'default' | 'compact'
  disabled?: boolean
  loading?: boolean
}>(), { variant: 'primary', size: 'default', disabled: false, loading: false })
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`]"
    :disabled="disabled || loading"
    :loading="loading"
    hover-class="app-button--pressed"
    :hover-stay-time="80"
    @click="emit('click')"
  ><slot /></button>
</template>

<style scoped lang="scss">
.app-button { box-sizing: border-box; display: flex; width: 100%; height: $button-height; min-height: $touch-target-min; align-items: center; justify-content: center; padding: 0 $space-4; border: 1px solid transparent; border-radius: $radius-md; font-size: 15px; font-weight: 600; line-height: 1; transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease; }
.app-button::after { border: 0; }
.app-button--primary { background: $color-primary; color: #fff; }
.app-button--secondary { border-color: rgba(27, 77, 83, 0.72); background: #fff; color: $color-primary; }
.app-button--quiet { background: $color-primary-light; color: $color-primary; }
.app-button--danger { background: $color-error; color: #fff; }
.app-button--compact {
  width: auto;
  height: 44px;
  min-height: 44px;
  padding: 0 10px;
  border: 6px solid transparent;
  border-inline-width: 2px;
  border-radius: 12px;
  background-clip: padding-box;
  font-size: 14px;
}
.app-button--compact.app-button--secondary {
  border-color: transparent;
  box-shadow: inset 0 0 0 1px #c8d7d4;
}
.app-button--compact.app-button--danger { color: $color-error; background-color: #fff4f2; }
.app-button--pressed.app-button--primary { background: $color-primary-dark; }
.app-button--pressed.app-button--secondary { background: $color-primary-light; }
.app-button--pressed.app-button--quiet { background: rgba(27, 77, 83, 0.16); }
.app-button--pressed.app-button--danger { background: #8f1414; }
.app-button[disabled] { opacity: 0.48; }
</style>
