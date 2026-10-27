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
import { AppWindow, ExternalLink, Maximize2, Minimize2, Save, RotateCcw, PanelsTopLeft } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { useApi, errorMessage } from '../context/ApiContext';
import { DockingContext } from '../context/docking';
import { dockPanels, readDockLayout, type DockPanelId } from '../context/dock-layout';
import 'dockview-react/dist/styles/dockview.css';
import './attendance-dock.css';

const Content = createContext<Record<DockPanelId, ReactNode>>({ list: null, chat: null, tools: null });
const Editing = createContext(false);
function Panel({ api }: IDockviewPanelProps) {
  const content = useContext(Content);
  return <div className="noctua-dock-content">{content[api.id as DockPanelId]}</div>;
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
  if (!editing) return null;
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
}: {
  children: Record<DockPanelId, ReactNode>;
  toolsOpen: boolean;
  onToolsChange: (open: boolean) => void;
  onClassic: () => void;
}) {
  const { preferences, savePreferences } = usePreferences();
  const { notify } = useApi();
  const api = useRef<DockviewApi | null>(null);
  const [instance, setInstance] = useState<DockviewApi | null>(null);
  const latest = useRef({ preferences, toolsOpen, onToolsChange });
  latest.current = { preferences, toolsOpen, onToolsChange };
  const saved = useRef(preferences.dockingLayout);
  const disposables = useRef<{ dispose(): void }[]>([]);
  const [present, setPresent] = useState<string[]>([]);
  const [active, setActive] = useState('chat');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const ready = useRef(false);
  const open = (id: DockPanelId) => {
    const dock = api.current;
    if (!dock) return;
    const existing = dock.getPanel(id);
    if (existing) {
      existing.api.setActive();
      return;
    }
    const reference =
      (id === 'tools' && dock.width < 1100 ? dock.getPanel('list') : undefined) ??
      dock.getPanel('chat') ??
      dock.panels[0];
    dock.addPanel({
      id,
      component: 'workspace',
      title: dockPanels[id],
      renderer: 'always',
      minimumWidth: id === 'chat' ? 320 : id === 'tools' ? 260 : 220,
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
      initialWidth: id === 'chat' ? 650 : id === 'tools' ? 300 : 260,
    });
  };
  const reset = () => {
    const dock = api.current;
    if (!dock) return;
    ready.current = false;
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
      latest.current.onToolsChange(Boolean(dock.getPanel('tools')));
    } catch {
      reset();
      notify('O layout salvo não pôde ser aberto. Os painéis padrão foram recuperados.', true);
    } finally {
      ready.current = true;
    }
  };
  const onReady = (event: DockviewReadyEvent) => {
    api.current = event.api;
    restore(saved.current);
    setDirty(!saved.current);
    setInstance(event.api);
    ready.current = true;
  };
  useEffect(() => {
    if (!instance) return;
    const event = { api: instance };
    ready.current = true;
    disposables.current = [
      event.api.onDidLayoutChange(() => {
        if (!ready.current) return;
        setPresent(event.api.panels.map((p) => p.id));
        setDirty(true);
      }),
      event.api.onDidActivePanelChange(() => setActive(event.api.activePanel?.id ?? '')),
      event.api.onDidRemovePanel((panel) => {
        if (ready.current && panel.id === 'tools')
          queueMicrotask(() => {
            if (ready.current && !event.api.getPanel('tools')) latest.current.onToolsChange(false);
          });
      }),
    ];
    return () => {
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
    if (toolsOpen) open('tools');
    else api.current.getPanel('tools')?.api.close();
  }, [toolsOpen]);
  const save = async () => {
    if (!api.current) return;
    setBusy(true);
    try {
      const state = readDockLayout(
        JSON.stringify(api.current.toJSON()),
        api.current.width,
        api.current.height,
      );
      if (!state)
        throw new Error('Não foi possível validar este layout. Restaure os painéis e tente novamente.');
      const raw = JSON.stringify(state);
      await savePreferences({ dockingLayout: raw });
      saved.current = raw;
      setDirty(false);
      setEditing(false);
      notify(
        'Layout salvo na sua conta. Janelas externas serão recuperadas dentro do Atendimento ao reabrir.',
      );
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
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
  return (
    <DockingContext.Provider value={true}>
      <Content.Provider value={children}>
        <Editing.Provider value={editing}>
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
                        Recuperar painéis
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
            {!present.includes('tools') && <div className="noctua-dock-parking">{children.tools}</div>}
          </section>
        </Editing.Provider>
      </Content.Provider>
    </DockingContext.Provider>
  );
}
