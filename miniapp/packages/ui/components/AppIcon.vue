<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; size?: number; label?: string }>(), {
  size: 24,
  label: '',
})

const iconModules = import.meta.glob('../assets/icons/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
})
const iconSource = computed(() => iconModules[`../assets/icons/${props.name}.svg`] as string | undefined)
</script>

<template>
  <image
    class="app-icon"
    :src="iconSource"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    mode="aspectFit"
    :aria-label="props.label"
  />
</template>

<style scoped lang="scss">
.app-icon {
  display: block;
  flex: none;
}
</style>
