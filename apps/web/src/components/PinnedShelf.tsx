import {Select} from './Select';
import { useState } from 'react';
import { Search, Pin, Settings2, Send } from 'lucide-react';
import type { Asset, Conversation, Library } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { useLibraryOrganization } from './LibraryCategories';
type Kind = Asset['kind'] | 'FUNNEL' | 'MACRO' | 'PIX' | 'FLOW';
type Resource = { id: string; name: string; kind: Kind; excerpt: string };
export const pinnedKinds = [
  { id: 'ALL', name: 'Todos os tipos' },
  { id: 'MESSAGE', name: 'Textos' },
  { id: 'AUDIO', name: 'Áudios' },
  { id: 'MEDIA', name: 'Mídias' },
  { id: 'DOCUMENT', name: 'Documentos' },
  { id: 'FUNNEL', name: 'Funis' },
  { id: 'MACRO', name: 'Macros' },
  { id: 'PIX', name: 'PIX' },
  { id: 'FLOW', name: 'Fluxos' },
];
export function openAttendanceCustomization(tab = 'panels') {
  window.dispatchEvent(new CustomEvent('noctua:customize-attendance', { detail: tab }));
}
export function PinnedShelf<T extends Resource>({
  resources,
  chat,
  selectedKind,
  onKind,
  onSend,
  connected,
  busy,
}: {
  resources: T[];
  library: Library;
  chat: Conversation | null;
  selectedKind: Kind | 'ALL';
  onKind: (kind: Kind | 'ALL') => void;
  onSend: (item: T, preview: boolean) => void;
  connected: boolean;
  busy: boolean;
}) {
  const { preferences } = usePreferences();
  const organization = useLibraryOrganization();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const categoryOf = (id: string) =>
    preferences.pinnedButtonSettings[id]?.category ?? organization.assignments[id] ?? '';
  const pinned = preferences.pinnedResourceIds
    .map((id) => resources.find((item) => item.id === id))
    .filter((item): item is T => Boolean(item));
  const categories = [...new Set(pinned.map((item) => categoryOf(item.id)).filter(Boolean))];
  const matches = pinned.filter(
    (item) =>
      (selectedKind === 'ALL' || item.kind === selectedKind) &&
      (!category || categoryOf(item.id) === category) &&
      `${preferences.pinnedButtonSettings[item.id]?.label || item.name} ${item.excerpt}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="pinned-shelf-header">
        <label className="workbench-search">
          <Search size={14} />
          <input
            aria-label="Buscar mensagens fixadas"
            placeholder="Buscar…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="pinned-shelf-controls">
          <Select
            aria-label="Tipo de conteúdo fixado"
            value={selectedKind}
            onChange={(event) => onKind(event.target.value as Kind | 'ALL')}
          >
            {pinnedKinds.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Categoria dos fixados"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
          <button
            className="icon-button"
            aria-label="Personalizar mensagens fixadas"
            title="Personalizar mensagens fixadas"
            onClick={() => openAttendanceCustomization('pinned')}
          >
            <Settings2 size={15} />
          </button>
        </div>
      </div>
      <div className="workbench-scroll pinned-shelf-results">
        {matches.map((item) => {
          const config = preferences.pinnedButtonSettings[item.id];
          const preview =
            config?.preview === 'always' || (config?.preview !== 'never' && preferences.showPinnedPreview);
          return (
            <article key={item.id} className="pinned-message-card">
              <header>
                <strong>{config?.label || item.name}</strong>
              </header>
              {preview && <p>{item.excerpt || pinnedKinds.find((kind) => kind.id === item.kind)?.name}</p>}
              <button
                className="button primary small"
                disabled={!chat || (!connected && !preview) || busy}
                onClick={() => onSend(item, preview)}
              >
                <Send size={13} />
                {busy ? 'Enviando…' : 'Enviar'}
              </button>
            </article>
          );
        })}
        {!matches.length && (
          <div className="workbench-empty">
            <Pin size={22} />
            <strong>{pinned.length ? 'Nenhuma mensagem neste filtro' : 'Painel vazio'}</strong>
            <p>Escolha seus conteúdos em Personalizar Atendimento → Mensagens fixadas.</p>
            <button className="button small" onClick={() => openAttendanceCustomization('pinned')}>
              Personalizar Atendimento
            </button>
          </div>
        )}
      </div>
    </>
  );
}
