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
  Save,
  RotateCcw,
  PanelsTopLeft,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Layers,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { useApi, errorMessage } from '../context/ApiContext';
import { DockingContext } from '../context/docking';
import { dockPanels, readDockLayout, type DockPanelId } from '../context/dock-layout';
import 'dockview-react/dist/styles/dockview.css';
import './attendance-dock.css';

const Content = createContext<Record<DockPanelId, ReactNode>>({ list: null, chat: null, tools: null });
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
            };
            sync();
            const observer = new MutationObserver(sync);
            observer.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['class', 'style', 'data-theme', 'data-density'],
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
  const latest = useRef({ preferences, toolsOpen, onToolsChange });
  latest.current = { preferences, toolsOpen, onToolsChange };
  const saved = useRef(preferences.dockingLayout);
  const disposables = useRef<{ dispose(): void }[]>([]);
  const [present, setPresent] = useState<string[]>([]);
  const [active, setActive] = useState('chat');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
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
    disposables.current = [
      event.api.onDidLayoutChange(() => {
        if (!ready.current) return;
        setPresent(event.api.panels.map((p) => p.id));
        setDirty(true);
      }),
      event.api.onDidActivePanelChange(() => setActive(event.api.activePanel?.id ?? '')),
      event.api.onDidRemovePanel((panel) => {
        if (ready.current && panel.id === 'tools') latest.current.onToolsChange(false);
      }),
    ];
    ready.current = true;
  };
  useEffect(
    () => () => {
      ready.current = false;
      disposables.current.forEach((item) => item.dispose());
    },
    [],
  );
  useEffect(() => {
    const focus = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (Object.hasOwn(dockPanels, id)) open(id as DockPanelId);
    };
    window.addEventListener('noctua:dock-focus', focus);
    return () => window.removeEventListener('noctua:dock-focus', focus);
  }, []);
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
        <section className="noctua-dock-workspace" aria-label="Atendimento com painéis encaixáveis">
          <div className="noctua-dock-toolbar">
            <strong>
              <PanelsTopLeft size={15} /> Painéis
            </strong>
            <div className="noctua-dock-panel-switches">
              {Object.entries(dockPanels).map(([id, title]) => (
                <button
                  type="button"
                  key={id}
                  className={`button small ${active === id ? 'active' : ''}`}
                  onClick={() => {
                    if (id === 'tools') onToolsChange(true);
                    open(id as DockPanelId);
                  }}
                >
                  {present.includes(id) ? '' : '+ '}
                  {title}
                </button>
              ))}
            </div>
            <span className="noctua-dock-save-state" role="status">
              {dirty ? 'Alterações não salvas' : saved.current ? 'Layout salvo' : 'Disposição inicial'}
            </span>
            <button className="button small primary" disabled={!dirty || busy} onClick={() => void save()}>
              <Save size={14} />
              Salvar layout
            </button>
            <button
              className="button small"
              disabled={!dirty || busy}
              onClick={() => {
                restore(saved.current);
                setDirty(false);
              }}
            >
              Cancelar
            </button>
            <button
              className="icon-button"
              title="Restaurar disposição padrão"
              aria-label="Restaurar disposição padrão dos painéis"
              onClick={reset}
            >
              <RotateCcw size={15} />
            </button>
            <button className="button small" onClick={onClassic}>
              Layout clássico
            </button>
          </div>
          <div className="noctua-dock-placement" aria-label="Posicionar painel ativo">
            <small>Arraste as abas ou posicione o painel ativo:</small>
            <button className="button small" onClick={() => move('left')}>
              <ArrowLeft size={13} />
              Esquerda
            </button>
            <button className="button small" onClick={() => move('right')}>
              <ArrowRight size={13} />
              Direita
            </button>
            <button className="button small" onClick={() => move('above')}>
              <ArrowUp size={13} />
              Em cima
            </button>
            <button className="button small" onClick={() => move('below')}>
              <ArrowDown size={13} />
              Embaixo
            </button>
            <button className="button small" onClick={() => move('within')}>
              <Layers size={13} />
              Juntar em abas
            </button>
            <button className="button small" onClick={() => api.current?.exitMaximizedGroup()}>
              <Minimize2 size={13} />
              Restaurar tamanho
            </button>
          </div>
          <DockviewReact
            className="noctua-dock"
            components={components}
            watermarkComponent={EmptyDock}
            onReady={onReady}
            theme={preferences.theme === 'light' ? themeLight : themeDark}
            rightHeaderActionsComponent={Actions}
            popoutUrl="/popout.html"
          />
          {!present.includes('tools') && <div className="noctua-dock-parking">{children.tools}</div>}
        </section>
      </Content.Provider>
    </DockingContext.Provider>
  );
}
