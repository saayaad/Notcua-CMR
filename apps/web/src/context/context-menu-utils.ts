export function menuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return {
    left: Math.max(8, Math.min(x, viewportWidth - width - 8)),
    top: Math.max(8, Math.min(y, viewportHeight - height - 8)),
  };
}

export function safeMenuUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return ['https:', 'http:', 'blob:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
