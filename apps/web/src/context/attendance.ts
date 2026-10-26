export interface ToolIntent {
  section: string;
  kind?: string;
  question?: string;
  stamp: number;
}
export interface DraftInsert {
  conversationId: string;
  text: string;
}
export interface AttachmentDraftInsert {
  sessionId: string;
  conversationId: string;
  file: File;
}
export function prepareAttachment(detail: AttachmentDraftInsert) {
  const event = new CustomEvent<AttachmentDraftInsert>('noctua:prepare-attachment', { detail, cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
export const shortcutOptions = [
  { id: 'faq', name: 'Respostas padrão', key: 'Alt+1' },
  { id: 'MESSAGE', name: 'Textos', key: 'Alt+2' },
  { id: 'AUDIO', name: 'Áudios', key: 'Alt+3' },
  { id: 'MEDIA', name: 'Fotos e vídeos', key: 'Alt+4' },
  { id: 'FUNNEL', name: 'Funis', key: 'Alt+5' },
  { id: 'DOCUMENT', name: 'Documentos', key: '' },
  { id: 'MACRO', name: 'Macros', key: '' },
  { id: 'PIX', name: 'PIX', key: '' },
  { id: 'client', name: 'Cliente e etiquetas', key: 'Alt+L' },
  { id: 'schedule', name: 'Agendar', key: 'Alt+A' },
  { id: 'notes', name: 'Notas', key: 'Alt+N' },
  { id: 'next', name: 'Próxima ação', key: 'Alt+R' },
  { id: 'transfers', name: 'Transferir', key: '' },
];
export function insertDraft(conversationId: string, text: string) {
  window.dispatchEvent(
    new CustomEvent<DraftInsert>('noctua:insert-draft', { detail: { conversationId, text } }),
  );
}

export function toolTarget(section: string): 'shelf' | 'dialog' {
  return section === 'responses' || section === 'catalog' ? 'shelf' : 'dialog';
}
export function hotkeyMatches(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  value: string,
) {
  const parts = value
    .toLowerCase()
    .split('+')
    .map((part) => part.trim());
  return (
    parts.length > 1 &&
    event.key.toLowerCase() === parts.at(-1) &&
    event.ctrlKey === parts.includes('ctrl') &&
    event.altKey === parts.includes('alt') &&
    event.shiftKey === parts.includes('shift') &&
    event.metaKey === parts.includes('meta')
  );
}
