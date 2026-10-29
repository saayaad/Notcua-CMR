import {Select} from './Select';
import { useEffect, useState } from 'react';
import { Trash2, Settings2, Search } from 'lucide-react';
import type { Preferences } from '../context/PreferencesContext';
import type { Library } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { useLibraryOrganization } from './LibraryCategories';
import { pinnedKinds } from './PinnedShelf';
import { snapFloatingPosition } from '../context/hud-placement';
import { shortcutOptions } from '../context/attendance';
import { completeOrder, hudPanels } from '../context/hud';
import { ReorderList } from './ReorderList';
type EditorProps = {
  value: Preferences;
  onChange: (value: Partial<Preferences>) => void;
  disabled?: boolean;
};
export function ShortcutSettings({ value, onChange, disabled }: EditorProps) {
  const [selected, setSelected] = useState('');
  const order = completeOrder(
    value.attendanceShortcutOrder,
    shortcutOptions.map((item) => item.id),
  );
  return (
    <div className="hud-settings-content">
      <h3>Organizar atalhos do Atendimento</h3>
      <p className="muted">
        Ative apenas os botões que deseja usar. Cada botão tem seu próprio nome e sua tecla configurável.
      </p>
      <ReorderList
        label="Ordem dos atalhos"
        disabled={disabled}
        items={order.map((id) => ({
          id,
          name: value.shortcutLabels[id] || shortcutOptions.find((item) => item.id === id)!.name,
          visible: !value.attendanceHiddenShortcuts.includes(id),
        }))}
        onChange={(ids) => onChange({ attendanceShortcutOrder: ids })}
        onVisibilityChange={(id, visible) =>
          onChange({
            attendanceHiddenShortcuts: visible
              ? value.attendanceHiddenShortcuts.filter((item) => item !== id)
              : [...value.attendanceHiddenShortcuts, id],
          })
        }
        onEdit={setSelected}
      />
      {selected && (
        <div className="hud-individual-editor">
          <h4>Configurar {shortcutOptions.find((item) => item.id === selected)?.name}</h4>
          <label>
            Nome deste botão
            <input
              maxLength={80}
              value={value.shortcutLabels[selected] ?? ''}
              placeholder={shortcutOptions.find((item) => item.id === selected)?.name}
              onChange={(event) =>
                onChange({ shortcutLabels: { ...value.shortcutLabels, [selected]: event.target.value } })
              }
            />
          </label>
          <label>
            Tecla de atalho
            <input
              maxLength={40}
              placeholder="Ex.: Alt+M"
              value={value.shortcutKeys[selected] ?? ''}
              onChange={(event) =>
                onChange({ shortcutKeys: { ...value.shortcutKeys, [selected]: event.target.value } })
              }
            />
          </label>
        </div>
      )}
      <button
        className="button small"
        onClick={() => onChange({ attendanceHiddenShortcuts: shortcutOptions.map((item) => item.id) })}
      >
        Remover todos da barra
      </button>
    </div>
  );
}
export function KeyboardSettings({ value, onChange }: EditorProps) {
  return (
    <div className="hud-settings-content">
      <h3>Teclas de atalho</h3>
      <p className="muted">
        Use Ctrl, Alt, Shift ou Meta e uma letra. Deixe em branco para desativar. As teclas só acionam botões
        ativos.
      </p>
      {shortcutOptions.map((item) => (
        <label className="hud-key-row" key={item.id}>
          <span>{value.shortcutLabels[item.id] || item.name}</span>
          <input
            aria-label={`Tecla para ${item.name}`}
            placeholder="Sem atalho"
            value={value.shortcutKeys[item.id] ?? ''}
            onChange={(event) =>
              onChange({ shortcutKeys: { ...value.shortcutKeys, [item.id]: event.target.value } })
            }
          />
        </label>
      ))}
      <p className="muted">Busca global: Ctrl+K. Mensagem: Enter para enviar; Shift+Enter para nova linha.</p>
    </div>
  );
}
export function PinnedSettings({
  value,
  onChange,
  library,
  sessionId,
}: {
  value: Preferences;
  onChange: EditorProps['onChange'];
  library: Library;
  sessionId: string;
}) {
  const { request, notify } = useApi();
  const organization = useLibraryOrganization();
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('ALL');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    void request<{ items: { id: string; name: string; archived?: boolean }[] }>(
      `/automation/sessions/${sessionId}/flows`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => setFlows(data.items.filter((item) => !item.archived)))
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [sessionId, request, notify]);
  const resources = [
    ...library.assets.map((item) => ({ id: item.id, name: item.name, kind: item.kind })),
    ...library.funnels.map((item) => ({ id: item.id, name: item.name, kind: 'FUNNEL' })),
    ...library.macros.map((item) => ({ id: item.id, name: item.name, kind: 'MACRO' })),
    ...library.pixKeys.map((item) => ({ id: item.id, name: item.name, kind: 'PIX' })),
    ...flows.map((item) => ({ id: `flow:${item.id}`, name: item.name, kind: 'FLOW' })),
  ];
  const categoryOf = (id: string) =>
    value.pinnedButtonSettings[id]?.category ?? organization.assignments[id] ?? '';
  const categories = [
    ...new Set(
      [
        ...organization.categories,
        ...Object.values(value.pinnedButtonSettings).map((item) => item.category ?? ''),
      ].filter(Boolean),
    ),
  ];
  const matches = resources.filter(
    (item) =>
      (kind === 'ALL' || item.kind === kind) &&
      (!category || (category === '__none' ? !categoryOf(item.id) : categoryOf(item.id) === category)) &&
      `${value.pinnedButtonSettings[item.id]?.label || item.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const item = resources.find((item) => item.id === selected);
  const config = value.pinnedButtonSettings[selected] ?? {};
  const configure = (patch: typeof config) =>
    onChange({
      pinnedButtonSettings: { ...value.pinnedButtonSettings, [selected]: { ...config, ...patch } },
    });
  return (
    <div className="hud-settings-content">
      <h3>Organizar mensagens fixadas</h3>
      <p className="muted">
        A seleção começa vazia. Adicionar ou remover aqui altera apenas seus botões; o conteúdo original
        permanece na Biblioteca.
      </p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.showPinnedPreview}
          onChange={(event) => onChange({ showPinnedPreview: event.target.checked })}
        />
        Mostrar prévia de mensagem nos atalhos
      </label>
      <p className="muted">
        Ativado: Enviar abre a prévia. Desativado: Enviar faz o envio diretamente. Você também pode escolher
        separadamente em cada botão.
      </p>
      <div className="hud-pin-filters">
        <label className="workbench-search">
          <Search size={14} />
          <input
            placeholder="Buscar conteúdo…"
            aria-label="Buscar conteúdo para fixar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Select
          aria-label="Filtrar fixados por tipo"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {pinnedKinds.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar fixados por categoria"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">Todas as categorias</option>
          <option value="__none">Sem categoria</option>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Select>
      </div>
      <div className="hud-pin-picker">
        {matches.map((item) => (
          <div key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={value.pinnedResourceIds.includes(item.id)}
                onChange={(event) =>
                  onChange({
                    pinnedResourceIds: event.target.checked
                      ? [...value.pinnedResourceIds, item.id]
                      : value.pinnedResourceIds.filter((id) => id !== item.id),
                  })
                }
              />
              <span>
                {value.pinnedButtonSettings[item.id]?.label || item.name}
                <small>
                  {categoryOf(item.id) || 'Sem categoria'} ·{' '}
                  {pinnedKinds.find((kind) => kind.id === item.kind)?.name}
                </small>
              </span>
            </label>
            <button
              className="icon-button"
              title={`Configurar ${item.name}`}
              aria-label={`Configurar ${item.name}`}
              onClick={() => setSelected(item.id)}
            >
              <Settings2 size={14} />
            </button>
            {value.pinnedResourceIds.includes(item.id) && (
              <button
                className="icon-button"
                aria-label={`Remover ${item.name} dos fixados`}
                onClick={() =>
                  onChange({ pinnedResourceIds: value.pinnedResourceIds.filter((id) => id !== item.id) })
                }
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!matches.length && <p className="muted">Nenhum conteúdo neste filtro.</p>}
      {item && (
        <div className="hud-individual-editor">
          <h4>Somente este botão: {item.name}</h4>
          <label>
            Nome do botão
            <input
              placeholder={item.name}
              value={config.label ?? ''}
              onChange={(event) => configure({ label: event.target.value })}
            />
          </label>
          <label>
            Categoria deste botão
            <input
              list="hud-pinned-categories"
              value={config.category ?? organization.assignments[selected] ?? ''}
              onChange={(event) => configure({ category: event.target.value })}
            />
            <datalist id="hud-pinned-categories">
              {categories.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </datalist>
          </label>
          <label>
            Prévia deste botão
            <Select
              value={config.preview ?? 'inherit'}
              onChange={(event) =>
                configure({ preview: event.target.value as 'inherit' | 'always' | 'never' })
              }
            >
              <option value="inherit">Usar configuração geral</option>
              <option value="always">Mostrar prévia antes de enviar</option>
              <option value="never">Enviar diretamente</option>
            </Select>
          </label>
        </div>
      )}
      <ReorderList
        label="Ordem das mensagens fixadas"
        items={value.pinnedResourceIds.map((id) => ({
          id,
          name:
            value.pinnedButtonSettings[id]?.label ||
            resources.find((item) => item.id === id)?.name ||
            'Conteúdo indisponível',
        }))}
        onChange={(ids) => onChange({ pinnedResourceIds: ids })}
      />
      <button className="button small" onClick={() => onChange({ pinnedResourceIds: [] })}>
        <Trash2 size={14} />
        Remover todos os fixados
      </button>
    </div>
  );
}
export function FreePlacementSettings({ value, onChange }: EditorProps) {
  const [selected, setSelected] = useState('tools');
  const fallback = {
    mode: 'dock' as const,
    x: 20,
    y: 15,
    width: selected === 'functions' || selected === 'shortcuts' ? 45 : selected === 'chat' ? 55 : 25,
    height: selected === 'functions' || selected === 'shortcuts' ? 8 : 60,
  };
  const position = value.hudBlockPositions[selected] ?? fallback;
  const change = (patch: Partial<typeof position>) => {
    const next = { ...position, ...patch };
    next.x = Math.max(0, Math.min(next.x, 100 - next.width));
    next.y = Math.max(0, Math.min(next.y, 100 - next.height));
    onChange({
      hudBlockPositions: {
        ...value.hudBlockPositions,
        [selected]: snapFloatingPosition(selected, next, value.hudBlockPositions),
      },
    });
  };
  return (
    <div className="hud-settings-content">
      <h3>Posicionamento livre</h3>
      <p className="muted">
        Desencaixe um bloco, escolha sua posição e confira na prévia. Depois de confirmar, a alça permite
        movê-lo pela tela. Em celulares os blocos voltam ao encaixe para manter a leitura.
      </p>
      <label>
        Bloco
        <Select value={selected} onChange={(event) => setSelected(event.target.value)}>
          {[
            ...hudPanels,
            { id: 'functions', name: 'Barra de funções' },
            { id: 'shortcuts', name: 'Barra de atalhos' },
          ].map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <label>
        Modo
        <Select
          value={position.mode}
          onChange={(event) => change({ mode: event.target.value as 'dock' | 'floating' })}
        >
          <option value="dock">Encaixado no layout</option>
          <option value="floating">Posição livre na tela</option>
        </Select>
      </label>
      {position.mode === 'floating' && (
        <>
          {(['x', 'y', 'width', 'height'] as const).map((field) => (
            <label key={field}>
              {{ x: 'Posição horizontal', y: 'Posição vertical', width: 'Largura', height: 'Altura' }[field]}
              <input
                type="range"
                min={field === 'width' ? 20 : field === 'height' ? 8 : 0}
                max={field === 'x' ? 100 - position.width : field === 'y' ? 100 - position.height : 90}
                value={position[field]}
                onChange={(event) => change({ [field]: Number(event.target.value) })}
              />
            </label>
          ))}
        </>
      )}
    </div>
  );
}
