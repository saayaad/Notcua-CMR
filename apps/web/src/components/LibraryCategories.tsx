import { useEffect, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Library } from '../types';
import { Modal } from './ui';
export interface Organization {
  categories: string[];
  assignments: Record<string, string>;
}
export function useLibraryOrganization() {
  const { request, notify } = useApi();
  const [organization, setOrganization] = useState<Organization>({ categories: [], assignments: {} });
  useEffect(() => {
    const refresh = () => {
      void request<Organization>('/operations/toolbox/organization')
        .then(setOrganization)
        .catch((error) => notify(errorMessage(error), true));
    };
    refresh();
    window.addEventListener('noctua:categories', refresh);
    return () => window.removeEventListener('noctua:categories', refresh);
  }, [request, notify]);
  return organization;
}
export function LibraryCategories({ library, onClose }: { library: Library; onClose: () => void }) {
  const { request, notify } = useApi();
  const organization = useLibraryOrganization();
  const [draft, setDraft] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const value = draft ?? organization;
  const resources = [...library.assets, ...library.macros, ...library.funnels];
  return (
    <Modal title="Categorias das respostas" onClose={onClose} wide>
      <p className="muted">
        Organize textos, arquivos, macros e funis em categorias compartilhadas pela equipe.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const category = name.trim();
          if (!category || value.categories.includes(category)) return;
          setDraft({ ...value, categories: [...value.categories, category] });
          setName('');
        }}
      >
        <label>
          Nova categoria
          <input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button className="button" disabled={!name.trim()}>
          Adicionar categoria
        </button>
      </form>
      <div className="category-chips">
        {value.categories.map((category) => (
          <button
            className="button small"
            key={category}
            onClick={() =>
              setDraft({
                categories: value.categories.filter((item) => item !== category),
                assignments: Object.fromEntries(
                  Object.entries(value.assignments).filter(([, item]) => item !== category),
                ),
              })
            }
            title="Remover categoria e seus vínculos"
          >
            {category} ×
          </button>
        ))}
      </div>
      <div className="category-assignments">
        {resources.map((item) => (
          <label key={item.id}>
            <span>{item.name}</span>
            <select
              value={value.assignments[item.id] ?? ''}
              onChange={(event) =>
                setDraft({ ...value, assignments: { ...value.assignments, [item.id]: event.target.value } })
              }
            >
              <option value="">Sem categoria</option>
              {value.categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void request('/operations/toolbox/organization', 'PUT', value)
              .then(() => {
                window.dispatchEvent(new Event('noctua:categories'));
                onClose();
                notify('Categorias salvas.');
              })
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        >
          Salvar organização
        </button>
      </div>
    </Modal>
  );
}
