import { useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { orderItems } from '../context/ordering';
import type { Library } from '../types';
export const kindName: Record<string, string> = {
  MESSAGE: 'Texto',
  AUDIO: 'Áudio',
  MEDIA: 'Imagem / vídeo',
  DOCUMENT: 'Documento',
};
export function ResourcePicker({
  library,
  value,
  onChange,
}: {
  library: Library;
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = library.assets.find((asset) => asset.id === value);
  const { preferences } = usePreferences();
  const [category, setCategory] = useState(selected?.kind ?? 'MESSAGE');
  const [search, setSearch] = useState('');
  const matches = library.assets.filter(
    (asset) =>
      asset.kind === category &&
      asset.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <div className="resource-picker">
      <div className="form-grid">
        <label>
          Categoria
          <select
            aria-label="Categoria do recurso"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as typeof category);
              setSearch('');
              onChange('');
            }}
          >
            {orderItems(Object.entries(kindName), preferences.folderOrder, (item) => item[0]!).map(
              ([kind, name]) => (
                <option key={kind} value={kind}>
                  {name}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Buscar recurso
          <input
            aria-label="Buscar recurso"
            placeholder="Nome do recurso"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <label>
        Resposta
        <select
          required
          aria-label="Resposta da etapa"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecione {(kindName[category] ?? 'recurso').toLowerCase()}</option>
          {selected && !matches.some((asset) => asset.id === selected.id) && (
            <option value={selected.id}>
              {kindName[selected.kind]} · {selected.name} (selecionado)
            </option>
          )}
          {matches.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
              {asset.file ? ` · ${asset.file.mimeType.split('/')[1]}` : ''}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <p className="resource-choice-preview">
          <strong>{kindName[selected.kind]}</strong> ·{' '}
          {selected.text?.slice(0, 180) || selected.file?.filename || selected.caption}
        </p>
      )}
      {!matches.length && (
        <small className="muted">Nenhum recurso nesta categoria. Cadastre-o na Biblioteca.</small>
      )}
    </div>
  );
}
