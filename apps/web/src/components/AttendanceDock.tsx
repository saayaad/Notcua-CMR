import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DockviewReact,
  themeDark,
  themeLight,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type IDockviewHeaderActionsProps,
} from 'dockview-react';
import {
  AppWindow,
  ExternalLink,
  Maximize2,
  Minimize2,
  Minus,
  Save,
  RotateCcw,
  PanelsTopLeft,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { useApi, errorMessage } from '../context/ApiContext';
import { DockingContext } from '../context/docking';
import { Spinner } from './ui';
import { dockPanels, readDockLayout, type DockPanelId } from '../context/dock-layout';
import 'dockview-react/dist/styles/dockview.css';
import './attendance-dock.css';

const Content = createContext<Record<DockPanelId, ReactNode>>({ list: null, chat: null, tools: null });
const Editing = createContext(false);
const HiddenPanels = createContext<{ hidden: Set<DockPanelId>; open: (id: DockPanelId) => void; hide: (id: DockPanelId) => void }>({ hidden: new Set(), open: () => undefined, hide: () => undefined });
function Panel({ api }: IDockviewPanelProps) {
  const content = useContext(Content);
  const { hidden, open } = useContext(HiddenPanels);
  const id = api.id as DockPanelId;
  if (hidden.has(id))
    return <div className="noctua-dock-content"><div className="dock-hidden-panel"><span>{dockPanels[id]} recolhido</span><button className="button small" onClick={() => open(id)}>Reabrir painel</button></div></div>;
  return <div className="noctua-dock-content">{content[id]}</div>;
}
const components = { workspace: Panel };
function EmptyDock() {
  return (
    <div className="operation-empty">
      <PanelsTopLeft size={30} />
      <p>Reabra Conversas, Conversa ou Biblioteca pelos botões acima.</p>
    </div>
  );
}
function Actions({ api, containerApi, activePanel }: IDockviewHeaderActionsProps) {
  const { notify } = useApi();
  const editing = useContext(Editing);
  const hidden = useContext(HiddenPanels);
  const action = async (kind: 'float' | 'popout') => {
    if (!activePanel) return;
    try {
      if (kind === 'float')
        containerApi.addFloatingGroup(activePanel, {
          width: Math.min(520, containerApi.width - 16),
          height: Math.min(480, containerApi.height - 16),
          x: 8,
          y: 8,
        });
      else {
        let disconnectTheme = () => {};
        const opened = await containerApi.addPopoutGroup(activePanel, {
          popoutUrl: '/popout.html',
          onDidOpen: ({ window: target }) => {
            const sync = () => {
              target.document.documentElement.dataset.theme =
                document.documentElement.dataset.theme ?? 'dark';
              target.document.documentElement.dataset.density =
                document.documentElement.dataset.density ?? 'compact';
              target.document.documentElement.style.cssText = document.documentElement.style.cssText;
              target.document.documentElement.className = document.documentElement.className;
              target.document.documentElement.dataset.dockEditing =
                document.documentElement.dataset.dockEditing ?? 'false';
            };
            sync();
            const observer = new MutationObserver(sync);
            observer.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['class', 'style', 'data-theme', 'data-density', 'data-dock-editing'],
            });
            disconnectTheme = () => observer.disconnect();
          },
          onWillClose: () => disconnectTheme(),
        });
        if (!opened)
          notify('O navegador bloqueou a janela. Permita pop-ups para este site e tente novamente.', true);
      }
    } catch (error) {
      notify(errorMessage(error), true);
    }
  };
  if (!editing)
    return activePanel ? (
      <div className="dock-panel-quick">
        <button
          className="icon-button"
          aria-label={`Recolher ${activePanel.title}`}
          title="Recolher painel"
          onClick={() => hidden.hide(activePanel.id as DockPanelId)}
        >
          <Minus size={15} />
        </button>
      </div>
    ) : null;
  return (
    <div className="noctua-dock-actions">
      <button
        type="button"
        title="Painel flutuante"
        aria-label="Tornar painel flutuante"
        onClick={() => void action('float')}
      >
        <AppWindow size={14} />
      </button>
      <button
        type="button"
        title="Abrir em outra janela"
        aria-label="Abrir painel em outra janela"
        onClick={() => void action('popout')}
      >
        <ExternalLink size={14} />
      </button>
      <button
        type="button"
        title="Maximizar ou restaurar grupo"
        aria-label="Maximizar ou restaurar painel"
        onClick={() => (api.isMaximized() ? api.exitMaximized() : api.maximize())}
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}

export function AttendanceDock({
  children,
  toolsOpen,
  onToolsChange,
  onClassic,
  editRequest = 0,
  onEditRequestHandled,
}: {
  children: Record<DockPanelId, ReactNode>;
  toolsOpen: boolean;
  onToolsChange: (open: boolean) => void;
  onClassic: () => void;
  editRequest?: number;
  onEditRequestHandled?: () => void;
}) {
  const { preferences, preferencesLoaded, savePreferences, updatePreferences } = usePreferences();
  const { notify } = useApi();
  const api = useRef<DockviewApi | null>(null);
  const [instance, setInstance] = useState<DockviewApi | null>(null);
  const latest = useRef({ preferences, toolsOpen, onToolsChange, savePreferences, updatePreferences, notify });
  latest.current = { preferences, toolsOpen, onToolsChange, savePreferences, updatePreferences, notify };
  const saved = useRef(preferences.dockingLayout);
  const rememberedWidths = useRef(preferences.dockingPanelWidths);
  const rememberedSizes = useRef(preferences.dockingPanelSizes);
  const [hiddenPanels, setHiddenPanels] = useState<DockPanelId[]>(preferences.dockingHiddenPanels);
  const knownPanelIds = useRef<string[]>([]);
  const preserveWidthsAfterPanelChange = useRef(false);
  const sashDragging = useRef(false);
  const disposables = useRef<{ dispose(): void }[]>([]);
  const layoutSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [present, setPresent] = useState<string[]>([]);
  const [active, setActive] = useState('chat');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  if (preferencesLoaded) {
    saved.current = preferences.dockingLayout;
    rememberedWidths.current = preferences.dockingPanelWidths;
    rememberedSizes.current = preferences.dockingPanelSizes;
  }
  const hide = (id: DockPanelId) => {
    const next = hiddenPanels.includes(id) ? hiddenPanels : [...hiddenPanels, id];
    setHiddenPanels(next);
    latest.current.updatePreferences({ dockingHiddenPanels: next });
    if (id === 'tools') latest.current.onToolsChange(false);
  };
  const show = (id: DockPanelId) => {
    const next = hiddenPanels.filter((panelId) => panelId !== id);
    setHiddenPanels(next);
    latest.current.updatePreferences({ dockingHiddenPanels: next });
    if (id === 'tools') latest.current.onToolsChange(true);
    api.current?.getPanel(id)?.api.setActive();
  };
  useEffect(() => {
    if (editRequest) {
      setEditing(true);
      onEditRequestHandled?.();
    }
  }, [editRequest]);
  useEffect(() => {
    if (!preferencesLoaded) return;
    saved.current = preferences.dockingLayout;
    rememberedWidths.current = preferences.dockingPanelWidths;
    rememberedSizes.current = preferences.dockingPanelSizes;
    setHiddenPanels(preferences.dockingHiddenPanels);
  }, [preferencesLoaded]);
  const ready = useRef(false);
  const open = (id: DockPanelId) => {
    const dock = api.current;
    if (!dock) return;
    const existing = dock.getPanel(id);
    if (existing) {
      if (hiddenPanels.includes(id)) show(id);
      existing.api.setActive();
      return;
    }
    const reference =
      (id === 'tools' && dock.width < 1100 ? dock.getPanel('list') : undefined) ??
      dock.getPanel('chat') ??
      dock.panels[0];
    const minimumWidth = id === 'chat' ? 320 : id === 'tools' ? 260 : 220;
    const defaultWidth = id === 'chat' ? 650 : id === 'tools' ? 300 : 260;
    const rememberedWidth = rememberedWidths.current[id];
    const initialWidth = Number.isFinite(rememberedWidth)
      ? Math.max(minimumWidth, Math.min(rememberedWidth!, dock.width - minimumWidth))
      : defaultWidth;
    dock.addPanel({
      id,
      component: 'workspace',
      title: dockPanels[id],
      renderer: 'always',
      minimumWidth,
      minimumHeight: 130,
      ...(reference
        ? {
            position: {
              referencePanel: reference,
              direction:
                dock.width < 650 || (id === 'tools' && dock.width < 1100)
                  ? 'within'
                  : id === 'list'
                    ? 'left'
                    : 'right',
            },
          }
        : {}),
      initialWidth,
    });
  };
  const reset = () => {
    const dock = api.current;
    if (!dock) return;
    ready.current = false;
    setHiddenPanels([]);
    latest.current.updatePreferences({ dockingHiddenPanels: [] });
    rememberedWidths.current = {};
    rememberedSizes.current = {};
    open('chat');
    open('list');
    if (latest.current.toolsOpen) open('tools');
    const chat = dock.getPanel('chat')!;
    chat.api.moveTo({ position: 'right' });
    dock.getPanel('list')!.api.moveTo({ group: chat.group, position: dock.width < 650 ? 'center' : 'left' });
    dock.getPanel('tools')?.api.moveTo({
      group: dock.width < 1100 ? dock.getPanel('list')!.group : chat.group,
      position: dock.width < 1100 ? 'center' : 'right',
    });
    dock.getPanel('chat')?.api.setActive();
    ready.current = true;
    setPresent(dock.panels.map((p) => p.id));
    setDirty(true);
  };
  const restore = (raw: string) => {
    const dock = api.current;
    if (!dock) return;
    const state = readDockLayout(raw, dock.width, dock.height);
    ready.current = false;
    try {
      if (!state) {
        reset();
        return;
      }
      dock.fromJSON(state, { reuseExistingPanels: true });
      setPresent(dock.panels.map((p) => p.id));
      latest.current.onToolsChange(Boolean(dock.getPanel('tools') && !latest.current.preferences.dockingHiddenPanels.includes('tools')));
    } catch {
      reset();
      notify('O layout salvo não pôde ser aberto. Os painéis padrão foram recuperados.', true);
    } finally {
      ready.current = true;
    }
  };
  const onReady = (event: DockviewReadyEvent) => {
    api.current = event.api;
    setHiddenPanels(preferences.dockingHiddenPanels);
    restore(saved.current);
    knownPanelIds.current = event.api.panels.map((panel) => panel.id).sort();
    setDirty(!saved.current);
    setInstance(event.api);
    ready.current = true;
  };
  const captureLayout = (captureLiveSizes = true) => {
    const dock = api.current;
    if (!dock) return null;
    const widths = { ...rememberedWidths.current };
    const sizes = { ...rememberedSizes.current };
    if (captureLiveSizes)
      for (const panel of dock.panels) {
        if (!Object.hasOwn(dockPanels, panel.id)) continue;
        const width = panel.api.group.api.width;
        const height = panel.api.group.api.height;
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
          widths[panel.id as DockPanelId] = Math.round(width);
          sizes[panel.id as DockPanelId] = { width: Math.round(width), height: Math.round(height) };
        }
      }
    const state = readDockLayout(
      JSON.stringify(dock.toJSON()),
      dock.width,
      dock.height,
    );
    if (!state) return null;
    rememberedWidths.current = widths;
    rememberedSizes.current = sizes;
    return { raw: JSON.stringify(state), widths, sizes };
  };
  const persistLayout = async (manual = false, captureLiveWidths = true) => {
    const snapshot = captureLayout(captureLiveWidths);
    if (!snapshot) throw new Error('Não foi possível validar este layout. Restaure os painéis e tente novamente.');
    if (manual) setBusy(true);
    try {
      await latest.current.savePreferences({
        dockingLayout: snapshot.raw,
        dockingPanelWidths: snapshot.widths,
        dockingPanelSizes: snapshot.sizes,
      });
      saved.current = snapshot.raw;
      rememberedWidths.current = snapshot.widths;
      rememberedSizes.current = snapshot.sizes;
      setDirty(false);
      if (manual) {
        setEditing(false);
        latest.current.notify('Layout salvo. As larguras também serão mantidas ao recolher e reabrir os painéis.');
      }
    } finally {
      if (manual) setBusy(false);
    }
  };
  useEffect(() => {
    if (!instance) return;
    const event = { api: instance };
    const dockElement = document.querySelector('.noctua-dock');
    const onResizeIntent = (pointerEvent: Event) => {
      if (pointerEvent.target instanceof Element && pointerEvent.target.closest('.dv-sash')) {
        preserveWidthsAfterPanelChange.current = false;
        sashDragging.current = true;
      }
    };
    const onResizeEnd = () => {
      if (!sashDragging.current) return;
      sashDragging.current = false;
      window.setTimeout(() => void persistLayout(false, true).catch(() => undefined), 0);
    };
    dockElement?.addEventListener('pointerdown', onResizeIntent, true);
    window.addEventListener('pointerup', onResizeEnd);
    window.addEventListener('pointercancel', onResizeEnd);
    ready.current = true;
    disposables.current = [
      event.api.onDidLayoutChange(() => {
        if (!ready.current) return;
        const ids = event.api.panels.map((panel) => panel.id).sort();
        const structureChanged = ids.join('|') !== knownPanelIds.current.join('|');
        knownPanelIds.current = ids;
        if (structureChanged) preserveWidthsAfterPanelChange.current = true;
        setPresent(event.api.panels.map((p) => p.id));
        setDirty(true);
        if (!preserveWidthsAfterPanelChange.current && sashDragging.current) captureLayout(true);
        if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
        layoutSaveTimer.current = setTimeout(() => {
          layoutSaveTimer.current = null;
          void persistLayout(false, !preserveWidthsAfterPanelChange.current && sashDragging.current).catch(() => undefined);
        }, 450);
      }),
      event.api.onDidActivePanelChange(() => setActive(event.api.activePanel?.id ?? '')),
      event.api.onDidRemovePanel((panel) => {
        if (ready.current && panel.id === 'tools') queueMicrotask(() => latest.current.onToolsChange(false));
      }),
    ];
    return () => {
      dockElement?.removeEventListener('pointerdown', onResizeIntent, true);
      window.removeEventListener('pointerup', onResizeEnd);
      window.removeEventListener('pointercancel', onResizeEnd);
      if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
      layoutSaveTimer.current = null;
      ready.current = false;
      disposables.current.forEach((item) => item.dispose());
    };
  }, [instance]);
  useEffect(() => {
    const focus = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (Object.hasOwn(dockPanels, id)) open(id as DockPanelId);
    };
    window.addEventListener('noctua:dock-focus', focus);
    return () => window.removeEventListener('noctua:dock-focus', focus);
  }, []);
  useEffect(() => {
    const edit = () => setEditing(true);
    window.addEventListener('noctua:dock-edit', edit);
    return () => window.removeEventListener('noctua:dock-edit', edit);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.dockEditing = String(editing);
    return () => {
      delete document.documentElement.dataset.dockEditing;
    };
  }, [editing]);
  useEffect(() => {
    if (!ready.current || !api.current) return;
    if (toolsOpen && preferences.dockingHiddenPanels.includes('tools')) {
      latest.current.onToolsChange(false);
      return;
    }
    if (toolsOpen) open('tools');
    else if (api.current.getPanel('tools') && !hiddenPanels.includes('tools')) hide('tools');
  }, [toolsOpen]);
  const save = async () => {
    if (!api.current) return;
    if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
    layoutSaveTimer.current = null;
    try { await persistLayout(true); }
    catch (error) { notify(errorMessage(error), true); }
  };
  const move = (direction: 'left' | 'right' | 'above' | 'below' | 'within') => {
    const dock = api.current;
    const panel = dock?.activePanel;
    const reference = dock?.panels.find((p) => p.id !== panel?.id);
    if (!dock || !panel || !reference) return;
    panel.api.moveTo({
      group: reference.group,
      position:
        direction === 'within'
          ? 'center'
          : direction === 'below'
            ? 'bottom'
            : direction === 'above'
              ? 'top'
              : direction,
    });
  };
  if (!preferencesLoaded)
    return <div className="operation-empty"><Spinner /> Carregando o layout salvo…</div>;
  return (
    <DockingContext.Provider value={true}>
      <Content.Provider value={children}>
        <Editing.Provider value={editing}>
          <HiddenPanels.Provider value={{ hidden: new Set(hiddenPanels), open: show, hide }}>
          <section
            className={`noctua-dock-workspace ${editing ? 'is-editing' : ''}`}
            aria-label="Atendimento com painéis encaixáveis"
          >
            {editing && (
              <div className="noctua-dock-editor">
                <div className="noctua-dock-toolbar">
                  <strong>
                    <PanelsTopLeft size={15} />
                    Organizar espaço
                  </strong>
                  <label className="dock-control-label">
                    Painel
                    <select
                      aria-label="Painel para organizar"
                      value={active}
                      onChange={(event) => {
                        const id = event.target.value as DockPanelId;
                        if (id === 'tools') onToolsChange(true);
                        open(id);
                      }}
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {Object.entries(dockPanels).map(([id, title]) => (
                        <option key={id} value={id}>
                          {present.includes(id) ? '' : 'Reabrir · '}
                          {title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dock-control-label">
                    Posição
                    <select
                      aria-label="Posicionar painel"
                      defaultValue=""
                      onChange={(event) => {
                        move(event.target.value as 'left' | 'right' | 'above' | 'below' | 'within');
                        event.target.value = '';
                      }}
                    >
                      <option value="" disabled>
                        Escolher encaixe
                      </option>
                      <option value="left">À esquerda</option>
                      <option value="right">À direita</option>
                      <option value="above">Em cima</option>
                      <option value="below">Embaixo</option>
                      <option value="within">Agrupar em abas</option>
                    </select>
                  </label>
                  <button className="button small primary" disabled={busy} onClick={() => void save()}>
                    <Save size={14} />
                    Confirmar layout
                  </button>
                  <button
                    className="button small"
                    disabled={busy}
                    onClick={() => {
                      restore(saved.current);
                      setDirty(false);
                      setEditing(false);
                    }}
                  >
                    Cancelar
                  </button>
                  <details className="dock-more-menu">
                    <summary className="button small">Mais opções</summary>
                    <div>
                      <button className="button small" onClick={reset}>
                        <RotateCcw size={14} />
                        Restaurar layout padrão
                      </button>
                      <button className="button small" onClick={() => api.current?.exitMaximizedGroup()}>
                        <Minimize2 size={14} />
                        Restaurar tamanho
                      </button>
                      <button
                        className="button small"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent('noctua:customize-attendance', { detail: 'panels' }),
                          )
                        }
                      >
                        Atalhos e aparência
                      </button>
                      <button className="button small" onClick={onClassic}>
                        Voltar ao layout clássico
                      </button>
                    </div>
                  </details>
                </div>
                <p className="dock-edit-hint">
                  Arraste as abas para encaixar. Use as divisórias para ajustar o tamanho.{' '}
                  {dirty ? 'Há alterações para confirmar.' : 'Os painéis ficam protegidos fora deste modo.'}
                </p>
              </div>
            )}
            <DockviewReact
              className="noctua-dock"
              components={components}
              watermarkComponent={EmptyDock}
              onReady={onReady}
              theme={preferences.theme === 'light' ? themeLight : themeDark}
              rightHeaderActionsComponent={Actions}
              popoutUrl="/popout.html"
              disableDnd={!editing}
              floatingGroupBounds="boundedWithinViewport"
            />
            {!editing && (hiddenPanels.length > 0 || Object.keys(dockPanels).some((id) => !present.includes(id))) && (
              <div className="dock-reopen-tray" aria-label="Painéis recolhidos">
                {Object.entries(dockPanels)
                  .filter(([id]) => hiddenPanels.includes(id as DockPanelId) || !present.includes(id))
                  .map(([id, title]) => (
                    <button
                      key={id}
                      className="button small"
                      onClick={() => {
                        if (hiddenPanels.includes(id as DockPanelId)) show(id as DockPanelId);
                        else open(id as DockPanelId);
                      }}
                    >
                      Abrir {title}
                    </button>
                  ))}
              </div>
            )}
            {!present.includes('tools') && <div className="noctua-dock-parking">{children.tools}</div>}
          </section>
          </HiddenPanels.Provider>
        </Editing.Provider>
      </Content.Provider>
    </DockingContext.Provider>
  );
}
