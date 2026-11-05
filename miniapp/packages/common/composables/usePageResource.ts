import { ref, shallowRef, watch } from 'vue'
import type { PageStatus } from '../types/app'

let defaultScope: (() => string) | undefined
export function configurePageResourceScope(scope: () => string) { defaultScope = scope }
export function usePageResource<T>(loader: () => Promise<T>) {
  const status = ref<PageStatus>('loading')
  const data = shallowRef<T | null>(null)
  const errorMessage = ref('')

  let sequence = 0
  const scope = defaultScope
  if (scope) watch(scope, () => { sequence++; data.value = null; status.value = 'error'; errorMessage.value = '登录状态已变化，请重新加载本人内容。' }, { flush: 'sync' })
  const runLoad = async (preserveContent = false) => {
    const request = ++sequence, owner = scope?.()
    if (!preserveContent) status.value = 'loading'
    errorMessage.value = ''
    try {
      const result = await loader()
      if (request !== sequence || owner !== scope?.()) return
      data.value = result
      status.value = Array.isArray(result) && result.length === 0 ? 'empty' : 'ready'
    } catch (error) {
      if (request !== sequence || owner !== scope?.()) return
      data.value = null
      errorMessage.value = error instanceof Error ? error.message : '加载失败，请稍后重试'
      status.value = 'error'
    }
  }

  const load = () => runLoad()
  // Keep native scroll/swiper nodes mounted during a secondary page's return refresh.
  const refresh = () => runLoad(data.value !== null)
  return { status, data, errorMessage, load, refresh }
}
