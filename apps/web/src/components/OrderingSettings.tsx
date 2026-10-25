import {Select} from './Select';
import { useEffect, useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { useApi, errorMessage } from '../context/ApiContext';
import { menuGroups, libraryFolders, orderItems } from '../context/ordering';
import type { Library, Label } from '../types';
import { ReorderList } from './ReorderList';
export function OrderingSettings({
  library,
  sessionId,
  onRefresh,
}: {
  library: Library;
  sessionId: string;
  onRefresh: () => void;
}) {
  const { preferences: prefs, updatePreferences } = usePreferences();
  const { request, notify } = useApi();
  const [labels, setLabels] = useState<Label[]>([]);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState('MESSAGE');
  useEffect(() => {
    if (!sessionId) {
      setLabels([]);
      return;
    }
    void request<{ items: Label[] }>(`/whatsapp/sessions/${sessionId}/labels`)
      .then((result) => setLabels(result.items))
      .catch((error) => notify(errorMessage(error), true));
  }, [sessionId, request, notify]);
  const groups = orderItems(menuGroups, prefs.menuGroupOrder, (item) => item.id);
  const folders = orderItems(libraryFolders, prefs.folderOrder, (item) => item[0]!);
  const resources: { id: string; name: string }[] =
    folder === 'FUNNEL'
      ? library.funnels
      : folder === 'MACRO'
        ? library.macros
        : folder === 'PIX'
          ? library.pixKeys
          : library.assets.filter((asset) => asset.kind === folder);
  return (
    <>
      <div className="surface">
        <h2>Ordem dos grupos do menu</h2>
        <p>Arraste pela alça ou use as setas. A ordem visual fica salva neste navegador.</p>
        <ReorderList
          label="Ordem dos grupos"
          items={groups}
          onChange={(menuGroupOrder) => updatePreferences({ menuGroupOrder })}
        />
        {groups.map((group) => {
          const items = orderItems(
            group.items.map(([id, name]) => ({ id: id!, name: name! })),
            prefs.menuOrder,
            (item) => item.id,
          );
          return (
            <details key={group.id} open>
              <summary>{group.name} · botões</summary>
              <ReorderList
                label={`Botões de ${group.name}`}
                items={items}
                onChange={(ids) =>
                  updatePreferences({
                    menuOrder: [...prefs.menuOrder.filter((id) => !ids.includes(id)), ...ids],
                  })
                }
              />
              <div className="ordering-visibility">
                {items.map((item) => (
                  <label className="checkbox" key={item.id}>
                    <input
                      type="checkbox"
                      disabled={['settings', 'connections', 'inbox'].includes(item.id)}
                      checked={!prefs.hiddenViews.includes(item.id)}
                      onChange={(event) =>
                        updatePreferences({
                          hiddenViews: event.target.checked
                            ? prefs.hiddenViews.filter((id) => id !== item.id)
                            : [...prefs.hiddenViews, item.id],
                        })
                      }
                    />
                    Mostrar {item.name}
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <div className="surface">
        <h2>Pastas da biblioteca</h2>
        <p>A ordem vale também para o painel de ferramentas do atendimento.</p>
        <ReorderList
          label="Ordem das pastas"
          items={folders.map(([id, name]) => ({ id: id!, name: prefs.folderLabels[id!] || name! }))}
          onChange={(folderOrder) => updatePreferences({ folderOrder })}
        />
        <label>
          Recursos dentro da pasta
          <Select value={folder} onChange={(event) => setFolder(event.target.value)}>
            {folders.map(([id, name]) => (
              <option key={id} value={id}>
                {prefs.folderLabels[id!] || name}
              </option>
            ))}
          </Select>
        </label>
        <ReorderList
          label="Ordem dos recursos da pasta"
          items={orderItems(resources, prefs.resourceOrder[folder] ?? [], (item) => item.id).map((item) => ({
            id: item.id,
            name: item.name,
          }))}
          onChange={(ids) => updatePreferences({ resourceOrder: { ...prefs.resourceOrder, [folder]: ids } })}
        />
        {!resources.length && <p className="muted">Esta pasta ainda não tem recursos.</p>}
      </div>
      <div className="surface">
        <h2>Ordem das etiquetas</h2>
        <p>
          Aplicada à conexão selecionada, às listas de etiquetas e às colunas do CRM. Esta alteração fica
          salva no servidor.
        </p>
        {!sessionId ? (
          <p>Selecione uma conexão.</p>
        ) : (
          <>
            <ReorderList
              label="Ordem das etiquetas"
              items={labels.map((item) => ({ id: item.id, name: item.name }))}
              disabled={busy}
              onChange={(ids) => {
                setBusy(true);
                void request(`/operations/sessions/${sessionId}/label-order`, 'PUT', { ids })
                  .then(() => {
                    setLabels(orderItems(labels, ids, (item) => item.id));
                    onRefresh();
                  })
                  .catch((error) => notify(errorMessage(error), true))
                  .finally(() => setBusy(false));
              }}
            />
            <p className="muted">As cores e ícones abaixo personalizam a exibição no CRM desta conta. Etiquetas sincronizadas do WhatsApp mantêm a cor original no WhatsApp.</p>
            <div className="label-style-list">
              {labels.map((label) => {
                const style = prefs.labelStyles[label.id] ?? { color: label.color, icon: '' };
                return (
                  <div className="label-style-row" key={label.id}>
                    <span className="label-style-name"><i style={{ background: style.color }} />{style.icon && <b>{style.icon}</b>}{label.name}</span>
                    <label>Cor visual<input aria-label={`Cor visual de ${label.name}`} type="color" value={style.color} onChange={(event) => updatePreferences({ labelStyles: { ...prefs.labelStyles, [label.id]: { ...style, color: event.target.value } } })} /></label>
                    <label>Ícone<input aria-label={`Ícone de ${label.name}`} className="label-icon-input" maxLength={4} value={style.icon} placeholder="🏷️" onChange={(event) => updatePreferences({ labelStyles: { ...prefs.labelStyles, [label.id]: { ...style, icon: event.target.value } } })} /></label>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="button"
        onClick={() =>
          updatePreferences({ menuGroupOrder: [], menuOrder: [], folderOrder: [], resourceOrder: {} })
        }
      >
        Restaurar ordem visual padrão
      </button>
    </>
  );
}
