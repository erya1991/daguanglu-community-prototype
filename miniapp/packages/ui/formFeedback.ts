function focusFirstError() {
  setTimeout(() => {
    const query = uni.createSelectorQuery();
    query.selectViewport().scrollOffset(() => {});
    query.select('.field-wrap--error,.form-field--error').boundingClientRect();
    query.exec((items: any[]) => { if (items[1]) uni.pageScrollTo({scrollTop:Math.max(0,(items[0]?.scrollTop||0)+items[1].top-80),duration:200}); });
  },50);
}
export function showFormError(error: any, focus: () => void = focusFirstError) {
  const fields = error?.fields || error?.errors || {};
  const first = Object.keys(fields)[0];
  const message = error?.message || '请检查填写内容后重试';
  const content = first && !message.includes(first) ? `${first}：${fields[first]}` : message;
  return new Promise<void>((resolve) => uni.showModal({
    title: '请检查填写内容', content: String(content).replace(/到点/g, '到店'),
    showCancel: false, confirmText: '知道了',
    success: () => { focus?.(); resolve(); }, fail: () => { focus?.(); resolve(); },
  }));
}
