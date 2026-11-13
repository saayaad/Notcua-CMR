export function mediaTypeLabel(type: string) {
  const normalized = type.toLocaleLowerCase('pt-BR');
  if (normalized.includes('audio')) return 'Áudio';
  if (normalized.includes('image') || normalized.includes('sticker')) return 'Foto';
  if (normalized.includes('video') || normalized.includes('ptv')) return 'Vídeo';
  if (normalized.includes('document') || normalized.includes('pdf')) return 'Documento';
  return '';
}

export function requestComposerFocus(focus: () => void, schedule: (callback: () => void) => void) {
  schedule(focus);
}
