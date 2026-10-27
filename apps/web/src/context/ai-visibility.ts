const ids = new Set(['ai', 'summary', 'image-studio']);
export const aiHeaderVisible = (id: string, enabled: boolean) => enabled || !ids.has(id);
export function reorderVisibleHeaders(previous: string[], next: string[], enabled: boolean) {
  if (enabled) return next;
  const visible = [...next];
  return previous.map((id) => (ids.has(id) ? id : visible.shift()!)).filter(Boolean);
}
