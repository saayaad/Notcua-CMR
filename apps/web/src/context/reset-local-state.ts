export function clearOperationLocalState(
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'>,
  uid: string,
) {
  const exact = new Set([
    `noctua-preferences:${uid}`,
    `noctua-active-session:${uid}`,
    `noctua:sandbox:v1:${uid}`,
    'noctua-theme',
    'noctua-tools-open',
    'noctua-tools-size',
  ]);
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (key && (exact.has(key) || key.startsWith(`noctua:draft:${uid}:`))) storage.removeItem(key);
  }
}
