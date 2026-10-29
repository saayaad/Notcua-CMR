import { Select } from './Select';
import { useAiFeatures } from '../context/AiFeatures';
import { aiHeaderVisible, reorderVisibleHeaders } from '../context/ai-visibility';
import { useState, useEffect, type CSSProperties } from 'react';
import {
  Check,
  GripVertical,
  Monitor,
  Smartphone,
  RotateCcw,
  Search,
  Send,
  WandSparkles,
  CalendarDays,
  Archive,
  Workflow,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { usePreferences, type Preferences } from '../context/PreferencesContext';
import { completeOrder, hudActions, hudPanels, hudTools, hudGrid, panelOrder } from '../context/hud';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from './ui';
import { ReorderList } from './ReorderList';
import type { Library } from '../types';
import {
  ShortcutSettings,
  KeyboardSettings,
  PinnedSettings,
  FreePlacementSettings,
} from './AttendanceCustomization';
import { shortcutOptions } from '../context/attendance';
import { normalizeFloatingPositions } from '../context/hud-placement';

type HudDraft = Pick<
  Preferences,
  | 'dockingEnabled'
  | 'attendanceShortcutOrder'
  | 'attendanceHiddenShortcuts'
  | 'shortcutLabels'
  | 'shortcutKeys'
  | 'pinnedResourceIds'
  | 'pinnedButtonSettings'
  | 'showPinnedPreview'
  | 'hudBlockPositions'
  | 'density'
  | 'toolsVisible'
  | 'toolsCompact'
  | 'toolsDocked'
  | 'hudPanelOrder'
  | 'hudHeaderOrder'
  | 'hudHiddenActions'
  | 'hudToolOrder'
  | 'hudHiddenTools'
  | 'hudListWidth'
  | 'hudToolsWidth'
  | 'hudToolNav'
  | 'hudPanelLayout'
  | 'attendanceShortcutPosition'
  | 'attendanceFunctionsPosition'
>;
function draftFrom(value: Preferences): HudDraft {
  return {
    dockingEnabled: value.dockingEnabled,
    attendanceShortcutOrder: value.attendanceShortcutOrder,
    attendanceHiddenShortcuts: value.attendanceHiddenShortcuts,
    shortcutLabels: value.shortcutLabels,
    shortcutKeys: value.shortcutKeys,
    pinnedResourceIds: value.pinnedResourceIds,
    pinnedButtonSettings: value.pinnedButtonSettings,
    showPinnedPreview: value.showPinnedPreview,
    hudBlockPositions: value.hudBlockPositions,
    density: value.density,
    toolsVisible: value.toolsVisible,
    toolsCompact: value.toolsCompact,
    toolsDocked: value.toolsDocked,
    hudPanelOrder: panelOrder(value),
    hudHeaderOrder: completeOrder(
      value.hudHeaderOrder,
      hudActions.map((item) => item.id),
    ),
    hudHiddenActions: value.hudHiddenActions,
    hudToolOrder: completeOrder(
      value.hudToolOrder,
      hudTools.map((item) => item.id),
    ),
    hudHiddenTools: value.hudHiddenTools,
    hudListWidth: value.hudListWidth,
    hudToolsWidth: value.hudToolsWidth,
    hudToolNav: value.hudToolNav,
    hudPanelLayout: value.hudPanelLayout,
    attendanceShortcutPosition: value.attendanceShortcutPosition,
    attendanceFunctionsPosition: value.attendanceFunctionsPosition,
  };
}
export function HudEditor({
  onClose,
  initialTab = 'panels',
  library = { assets: [], funnels: [], macros: [], pixKeys: [] },
  sessionId = '',
}: {
  onClose: () => void;
  initialTab?: string;
  library?: Library;
  sessionId?: string;
}) {
  const { preferences, savePreferences } = usePreferences();
  const { enabled: aiEnabled } = useAiFeatures();
  const { notify, request } = useApi();
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    void request<{ items: { id: string; name: string }[] }>(
      `/automation/sessions/${sessionId}/flows`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => setFlows(data.items))
      .catch(() => undefined);
    return () => controller.abort();
  }, [sessionId, request]);
  const [draft, setDraft] = useState(() => ({
    ...draftFrom(preferences),
    hudBlockPositions: normalizeFloatingPositions(preferences.hudBlockPositions),
  }));
  const [tab, setTab] = useState(initialTab);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [mobileView, setMobileView] = useState('chat');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [dragging, setDragging] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (value: Partial<HudDraft>) => setDraft((current) => ({
    ...current,
    ...value,
    ...(value.hudBlockPositions
      ? { hudBlockPositions: normalizeFloatingPositions(value.hudBlockPositions) }
      : {}),
  }));
  const movePanel = (target: string) => {
    if (!dragging || dragging === target) return;
    const next = [...draft.hudPanelOrder];
    const from = next.indexOf(dragging);
    const to = next.indexOf(target);
    next.splice(to, 0, next.splice(from, 1)[0]!);
    change({ hudPanelOrder: next });
    setDragging('');
  };
  const shownPanels = draft.hudPanelOrder.filter((id) => id !== 'tools' || draft.toolsVisible);
  const shownShortcuts = draft.attendanceShortcutOrder.filter(
    (id) => !draft.attendanceHiddenShortcuts.includes(id),
  );
  const shownFunctions = draft.hudToolOrder.filter((id) => !draft.hudHiddenTools.includes(id));
  const previewPanels = shownPanels.filter(
    (id) => (id !== 'tools' || draft.toolsDocked) && draft.hudBlockPositions[id]?.mode !== 'floating',
  );
  const previewLeft = draft.hudPanelOrder.indexOf('tools') < draft.hudPanelOrder.indexOf('chat');
  const previewGrid = hudGrid(previewPanels, { ...draft, panelPosition: previewLeft ? 'left' : 'right' });
  const allValue = { ...preferences, ...draft };
  const previewResources = [
    ...library.assets.map((item) => ({
      id: item.id,
      name: item.name,
      text: item.text || item.caption || item.file?.filename || '',
      kind: item.kind,
    })),
    ...library.funnels.map((item) => ({
      id: item.id,
      name: item.name,
      text: `${item.items.length} etapas`,
      kind: 'FUNNEL',
    })),
    ...library.macros.map((item) => ({
      id: item.id,
      name: item.name,
      text: `${item._count.actions} ações`,
      kind: 'MACRO',
    })),
    ...library.pixKeys.map((item) => ({ id: item.id, name: item.name, text: item.value, kind: 'PIX' })),
    ...flows.map((item) => ({
      id: `flow:${item.id}`,
      name: item.name,
      text: 'Fluxo de atendimento',
      kind: 'FLOW',
    })),
  ];
  const previewPinned = draft.pinnedResourceIds.map((id) => ({
    id,
    name:
      draft.pinnedButtonSettings[id]?.label ||
      previewResources.find((item) => item.id === id)?.name ||
      'Conteúdo salvo',
    text: previewResources.find((item) => item.id === id)?.text || '',
  }));
  const apply = async () => {
    const keys = Object.values(draft.shortcutKeys)
      .filter(Boolean)
      .map((value) => value.toLowerCase().replace(/\s/g, ''));
    if (keys.some((key) => !/^(?:(?:ctrl|alt|shift|meta)\+)+[a-z]$/.test(key))) {
      notify('Use uma combinação com Ctrl, Alt, Shift ou Meta e uma letra, por exemplo Alt+M.', true);
      return;
    }
    if (new Set(keys).size !== keys.length || keys.includes('ctrl+k')) {
      notify('Escolha teclas diferentes para cada botão. Ctrl+K está reservado para a busca global.', true);
      return;
    }

    setBusy(true);
    try {
      await savePreferences({
        ...draft,
        panelPosition:
          draft.hudPanelOrder.indexOf('tools') < draft.hudPanelOrder.indexOf('chat') ? 'left' : 'right',
      });
      notify('Atendimento personalizado e salvo na sua conta.');
      onClose();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Personalizar Atendimento"
      onClose={() => {
        if (!busy) onClose();
      }}
      className="hud-editor-modal"
    >
      <div className="hud-editor">
        <p className="hud-editor-explanation">
          Monte o seu espaço de trabalho. Arraste os painéis e use a prévia para conferir. As alterações só
          entram em vigor ao confirmar.
        </p>
        <div className="hud-editor-tabs" role="tablist" aria-label="Configurações do atendimento">
          {(
            [
              ['panels', 'Painéis'],
              ['actions', 'Botões'],
              ['tools', 'Funções'],
              ['shortcuts', 'Atalhos'],
              ['pinned', 'Mensagens fixadas'],
              ['keys', 'Teclas de atalho'],
              ['free', 'Posição livre'],
            ] as const
          ).map(([id, name]) => (
            <button role="tab" key={id} aria-selected={tab === id} onClick={() => { setTab(id); setPreviewExpanded(false); }}>
              {name}
            </button>
          ))}
        </div>
      <div className={`hud-editor-layout ${previewExpanded ? 'preview-expanded' : ''}`}>
          <aside className="hud-editor-controls">
            {tab === 'shortcuts' && (
              <ShortcutSettings value={allValue} onChange={(value) => change(value)} disabled={busy} />
            )}
            {tab === 'keys' && <KeyboardSettings value={allValue} onChange={(value) => change(value)} />}
            {tab === 'pinned' && (
              <PinnedSettings
                value={allValue}
                onChange={(value) =>
                  change({
                    ...value,
                    ...(value.pinnedResourceIds?.length ? { toolsVisible: true, toolsDocked: true } : {}),
                  })
                }
                library={library}
                sessionId={sessionId}
              />
            )}
            {tab === 'free' && <FreePlacementSettings value={allValue} onChange={(value) => change(value)} />}
            {tab === 'panels' && (
              <div className="hud-control-section">
                <label className="checkbox">
                  <input type="checkbox" checked={draft.dockingEnabled} onChange={event => change({ dockingEnabled: event.target.checked })}/>
                  Usar abas e painéis encaixáveis
                </label>
                <p className="muted">No computador, arraste as abas, redimensione as divisões ou destaque janelas. A disposição é ajustada diretamente no Atendimento e confirmada em Salvar layout. A prévia abaixo e as posições livres desta tela representam o layout clássico.</p>
                <label>
                  Tamanho dos controles
                  <Select
                    value={draft.density}
                    onChange={(event) => change({ density: event.target.value as HudDraft['density'] })}
                  >
                    <option value="compact">Compacto</option>
                    <option value="medium">Médio</option>
                    <option value="expanded">Expandido</option>
                  </Select>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={draft.toolsVisible}
                    onChange={(event) => change({ toolsVisible: event.target.checked })}
                  />
                  Mostrar mensagens fixadas
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={draft.toolsDocked}
                    onChange={(event) => change({ toolsDocked: event.target.checked })}
                  />
                  Manter ferramentas abertas no layout
                </label>
                <label>
                  Distribuição dos painéis
                  <Select
                    value={draft.hudPanelLayout}
                    onChange={(event) =>
                      change({ hudPanelLayout: event.target.value as HudDraft['hudPanelLayout'] })
                    }
                  >
                    <option value="columns">Lado a lado · esquerda e direita</option>
                    <option value="rows">Empilhados · em cima e embaixo</option>
                  </Select>
                </label>
                <label>
                  Posição dos atalhos de atendimento
                  <Select
                    value={draft.attendanceShortcutPosition}
                    onChange={(event) =>
                      change({
                        attendanceShortcutPosition: event.target
                          .value as HudDraft['attendanceShortcutPosition'],
                      })
                    }
                  >
                    <option value="top">Em cima da conversa</option>
                    <option value="bottom">Perto da mensagem</option>
                    <option value="left">Lateral esquerda</option>
                    <option value="right">Lateral direita</option>
                  </Select>
                </label>
                <label>
                  Largura da lista · {draft.hudListWidth} rem
                  <input
                    type="range"
                    min="14"
                    max="20"
                    step="0.5"
                    value={draft.hudListWidth}
                    onChange={(event) => change({ hudListWidth: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Largura das mensagens fixadas · {draft.hudToolsWidth} rem
                  <input
                    type="range"
                    min="15"
                    max="22"
                    step="0.5"
                    value={draft.hudToolsWidth}
                    onChange={(event) =>
                      change({
                        hudToolsWidth: Number(event.target.value),
                        toolsCompact: Number(event.target.value) <= 18,
                      })
                    }
                  />
                </label>
                <ReorderList
                  label="Posição dos painéis"
                  items={draft.hudPanelOrder.map((id) => hudPanels.find((item) => item.id === id)!)}
                  onChange={(ids) => change({ hudPanelOrder: ids })}
                />
                <p className="muted">
                  A ordem define a posição da lista e da conversa. As mensagens fixadas continuam na lateral.
                  Em telas menores, as ferramentas abrem em gaveta para preservar o espaço da conversa.
                </p>
              </div>
            )}
            {tab === 'actions' && (
              <div className="hud-control-section">
                <p>
                  Organize os botões e escolha quais aparecem no cabeçalho. Os ocultos continuam em “Mais
                  ações”.
                </p>
                <ReorderList
                  label="Ordem dos botões"
                  items={draft.hudHeaderOrder.filter(id => aiHeaderVisible(id, aiEnabled)).map((id) => ({
                    ...hudActions.find((item) => item.id === id)!,
                    visible: !draft.hudHiddenActions.includes(id),
                    locked: false,
                  }))}
                  onVisibilityChange={(id, visible) =>
                    change({
                      hudHiddenActions: visible
                        ? draft.hudHiddenActions.filter((entry) => entry !== id)
                        : [...draft.hudHiddenActions, id],
                    })
                  }
                  onChange={(ids) => change({ hudHeaderOrder: reorderVisibleHeaders(draft.hudHeaderOrder, ids, aiEnabled) })}
                />
              </div>
            )}
            {tab === 'tools' && (
              <div className="hud-control-section">
                <label>
                  Navegação na biblioteca completa
                  <Select
                    value={draft.hudToolNav}
                    onChange={(event) => change({ hudToolNav: event.target.value as HudDraft['hudToolNav'] })}
                  >
                    <option value="top">Abas no topo</option>
                    <option value="side">Ícones na lateral</option>
                  </Select>
                </label>
                <label>
                  Barra de funções do atendimento
                  <Select
                    value={draft.attendanceFunctionsPosition}
                    onChange={(event) =>
                      change({ attendanceFunctionsPosition: event.target.value as 'top' | 'bottom' })
                    }
                  >
                    <option value="top">Em cima da conversa</option>
                    <option value="bottom">Embaixo da conversa</option>
                  </Select>
                </label>
                <p className="muted">
                  Cliente, Notas, Padrões e demais funções ficam nesta barra. A lateral fica reservada aos
                  conteúdos fixados.
                </p>
                <ReorderList
                  label="Ordem das ferramentas"
                  items={draft.hudToolOrder.map((id) => ({
                    ...hudTools.find((item) => item.id === id)!,
                    visible: !draft.hudHiddenTools.includes(id),
                    locked: false,
                  }))}
                  onVisibilityChange={(id, visible) =>
                    change({
                      hudHiddenTools: visible
                        ? draft.hudHiddenTools.filter((entry) => entry !== id)
                        : [...draft.hudHiddenTools, id],
                    })
                  }
                  onChange={(ids) => change({ hudToolOrder: ids })}
                />
              </div>
            )}
          </aside>
          <section className="hud-editor-preview-section">
            <div className="hud-preview-toolbar">
              <span>Prévia do layout</span>
              <div role="group" aria-label="Dispositivo da prévia">
                <button aria-pressed={previewExpanded} onClick={() => setPreviewExpanded(value => !value)}>
                  {previewExpanded ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
                  {previewExpanded ? 'Voltar aos ajustes' : 'Ampliar prévia'}
                </button>
                <button aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
                  <Monitor size={15} />
                  Computador
                </button>
                <button aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>
                  <Smartphone size={15} />
                  Celular
                </button>
              </div>
            </div>
            {device === 'mobile' && (
              <div className="hud-mobile-selector">
                {shownPanels.map((id) => (
                  <button key={id} aria-pressed={mobileView === id} onClick={() => setMobileView(id)}>
                    {hudPanels.find((panel) => panel.id === id)?.name}
                  </button>
                ))}
              </div>
            )}
            <div
              className={`hud-preview hud-preview-${device} hud-preview-${draft.density} hud-preview-layout-${draft.hudPanelLayout} ${!draft.toolsDocked ? 'hud-preview-floating' : ''}`}
              style={
                {
                  '--preview-areas': device === 'mobile' ? 'none' : previewGrid['--hud-areas'],
                  '--preview-rows':
                    draft.hudPanelLayout === 'rows'
                      ? previewPanels
                          .filter((id) => id !== 'tools')
                          .map((id) => (id === 'chat' ? 'minmax(0,1fr)' : '8rem'))
                          .join(' ')
                      : 'minmax(0,1fr)',
                  '--preview-columns':
                    draft.hudPanelLayout === 'rows'
                      ? previewPanels.includes('tools')
                        ? previewLeft
                          ? '1fr 2fr'
                          : '2fr 1fr'
                        : 'minmax(0,1fr)'
                      : previewPanels
                          .map((id) =>
                            id === 'chat'
                              ? 'minmax(0,1.8fr)'
                              : id === 'list'
                                ? `${draft.hudListWidth / 17}fr`
                                : `${draft.hudToolsWidth / 18}fr`,
                          )
                          .join(' '),
                } as CSSProperties
              }
            >
              {shownPanels
                .filter((id) => device !== 'mobile' || id === mobileView)
                .map((id) => (
                  <section
                    key={id}
                    style={
                      device === 'desktop'
                        ? draft.hudBlockPositions[id]?.mode === 'floating'
                          ? {
                              position: 'absolute',
                              left: `${draft.hudBlockPositions[id].x}%`,
                              top: `${draft.hudBlockPositions[id].y}%`,
                              width: `${draft.hudBlockPositions[id].width}%`,
                              height: `${draft.hudBlockPositions[id].height}%`,
                              zIndex: 5,
                              border: '1px solid var(--accent)',
                            }
                          : { gridArea: id }
                        : undefined
                    }
                    className={`hud-preview-panel hud-preview-panel-${id} ${dragging === id ? 'hud-is-dragging' : ''}`}
                    onDragOver={(event) => {
                      if (dragging) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      movePanel(id);
                    }}
                  >
                    <header
                      draggable={device === 'desktop'}
                      onDragStart={(event) => {
                        setDragging(id);
                        event.dataTransfer.setData('text/plain', id);
                      }}
                      onDragEnd={() => setDragging('')}
                    >
                      <GripVertical size={13} />
                      {hudPanels.find((item) => item.id === id)?.name}
                    </header>
                    {id === 'list' && (
                      <div className="hud-sample-list">
                        <div className="hud-sample-search">
                          <Search size={12} />
                          Buscar contato
                        </div>
                        {['Ana Costa', 'Bruno Martins', 'Carolina Alves'].map((name, index) => (
                          <div className={index === 0 ? 'selected' : ''} key={name}>
                            <i>{name[0]}</i>
                            <span>
                              <strong>{name}</strong>
                              <small>Olá, gostaria de saber mais.</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {id === 'chat' && (
                      <div
                        className={`hud-sample-chat hud-sample-shortcuts-${draft.attendanceShortcutPosition} hud-sample-functions-${draft.attendanceFunctionsPosition}`}
                      >
                        <div className="hud-sample-chat-header">
                          <strong>Ana Costa</strong>
                          <div>
                            {draft.hudHeaderOrder
                              .filter((action) => aiHeaderVisible(action, aiEnabled) && !draft.hudHiddenActions.includes(action))
                              .slice(0, 3)
                              .map((action) => (
                                <span
                                  title={hudActions.find((item) => item.id === action)?.name}
                                  key={action}
                                >
                                  {action === 'summary' ? (
                                    <WandSparkles size={12} />
                                  ) : action === 'schedule' ? (
                                    <CalendarDays size={12} />
                                  ) : action === 'archive' ? (
                                    <Archive size={12} />
                                  ) : action === 'flow' ? (
                                    <Workflow size={12} />
                                  ) : (
                                    <Sparkles size={12} />
                                  )}
                                </span>
                              ))}
                            <span>···</span>
                          </div>
                        </div>
                        {shownFunctions.length > 0 &&
                          draft.hudBlockPositions.functions?.mode !== 'floating' && (
                            <div className="hud-sample-functions">
                              {shownFunctions.map((id) => (
                                <span key={id}>{hudTools.find((item) => item.id === id)?.name}</span>
                              ))}
                            </div>
                          )}
                        {shownShortcuts.length > 0 &&
                          draft.hudBlockPositions.shortcuts?.mode !== 'floating' && (
                            <div className="hud-sample-shortcuts">
                              {shownShortcuts.map((id) => (
                                <span key={id}>
                                  {draft.shortcutLabels[id] ||
                                    shortcutOptions.find((item) => item.id === id)?.name}
                                </span>
                              ))}
                            </div>
                          )}
                        <div className="hud-sample-messages">
                          <p>Olá! Pode me ajudar?</p>
                          <p>Claro, Ana. Como podemos ajudar?</p>
                        </div>
                        <div className="hud-sample-composer">
                          <span>Escreva sua mensagem…</span>
                          <Send size={15} />
                        </div>
                      </div>
                    )}
                    {id === 'tools' && (
                      <div className={`hud-sample-tools hud-sample-tools-${draft.hudToolNav}`}>
                        <div className="hud-sample-tool-content">
                          <strong>Biblioteca de atendimento</strong>
                          <div className="hud-sample-search">
                            <Search size={12} />
                            Buscar conteúdos salvos…
                          </div>
                          <small>
                            {previewResources.length} conteúdos disponíveis · {previewPinned.length} fixados
                          </small>
                          {(previewPinned.length ? previewPinned : previewResources.slice(0, 3))
                            .slice(0, 4)
                            .map((item) => (
                              <div className="hud-sample-resource" key={item.id}>
                                <b>{item.name}</b>
                                {draft.showPinnedPreview && <p>{item.text}</p>}
                                <span className="hud-sample-action">Enviar</span>
                              </div>
                            ))}
                          {!previewPinned.length && !previewResources.length && (
                            <p>Seus conteúdos aparecerão aqui.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                ))}
              {device === 'desktop' &&
                ['functions', 'shortcuts']
                  .filter((id) => draft.hudBlockPositions[id]?.mode === 'floating')
                  .map((id) => {
                    const position = draft.hudBlockPositions[id]!;
                    return (
                      <section
                        className="hud-preview-free-bar"
                        key={id}
                        style={{
                          position: 'absolute',
                          left: `${position.x}%`,
                          top: `${position.y}%`,
                          width: `${position.width}%`,
                          height: `${position.height}%`,
                        }}
                      >
                        <GripVertical size={12} />
                        {id === 'functions' ? 'Barra de funções' : 'Barra de atalhos'}
                      </section>
                    );
                  })}
            </div>
            {!draft.toolsVisible && (
              <p className="hud-preview-caption">
                As mensagens fixadas ficarão acessíveis pelo botão do cabeçalho. As funções continuam na barra
                de atendimento.
              </p>
            )}
            <p className="hud-preview-caption">
              Exemplo visual com dados fictícios. Use as alças ou as setas para mover os painéis. A prateleira
              de mensagens permanece na lateral.
            </p>
          </section>
        </div>
        <footer className="hud-editor-footer">
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              change({
                density: 'compact',
                toolsVisible: true,
                toolsDocked: false,
                toolsCompact: true,
                hudPanelOrder: ['list', 'chat', 'tools'],
                hudHeaderOrder: hudActions.map((item) => item.id),
                hudHiddenActions: ['flow', 'ai'],
                hudToolOrder: hudTools.map((item) => item.id),
                hudHiddenTools: hudTools.map((item) => item.id),
                attendanceHiddenShortcuts: shortcutOptions.map((item) => item.id),
                pinnedResourceIds: [],
                pinnedButtonSettings: {},
                shortcutLabels: {},
                shortcutKeys: {},
                hudBlockPositions: {},
                showPinnedPreview: true,
                hudListWidth: 17,
                hudToolsWidth: 18,
                hudToolNav: 'top',
                hudPanelLayout: 'columns',
                attendanceShortcutPosition: 'bottom',
                attendanceFunctionsPosition: 'top',
              })
            }
          >
            <RotateCcw size={15} />
            Restaurar padrão
          </button>
          <div>
            <button className="button" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button className="button primary" disabled={busy} onClick={() => void apply()}>
              {busy ? <Spinner /> : <Check size={16} />}Confirmar alterações
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
