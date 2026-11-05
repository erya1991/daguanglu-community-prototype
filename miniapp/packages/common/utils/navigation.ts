export function openPage(path?: string, available = true) {
  if (!available || !path) {
    return false
  }
  uni.redirectTo({ url: path })
  return true
}

export function openSubPage(path?: string, available = true) {
  if (!available || !path) return false
  uni.navigateTo({ url: path })
  return true
}
