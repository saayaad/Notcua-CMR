import { AttendanceSettingsMenu } from './components/AttendanceSettingsMenu';
import { CampaignMonitor } from './components/CampaignMonitor';
import { AttendanceLayout } from './components/AttendanceLayout';
import { Select } from './components/Select';
import { toolTarget } from './context/attendance';
import { Fragment, lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { HudEditor } from './components/HudEditor';
import { hudGrid, panelOrder } from './context/hud';
import type { ToolIntent } from './context/attendance';
import { menuGroups, orderItems } from './context/ordering';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Table2,
  Send,
  Workflow,
  KanbanSquare,
  MessageSquare,
  Library as LibraryIcon,
  Wifi,
  Settings,
  Moon,
  Sun,
  ChevronDown,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
  CircleHelp,
  Plus,
  Search,
  Palette,
  SlidersHorizontal,
  FlaskConical,
} from 'lucide-react';
import { useWorkspace } from './hooks/useWorkspace';
import { useApi, errorMessage } from './context/ApiContext';
import type { Conversation, Label, Paged } from './types';
import { ConversationList } from './components/ConversationList';
import { ChatPane } from './components/ChatPane';
import { ToolsPanel } from './components/ToolsPanel';
import { ContactDetails } from './components/ContactDetails';
import { Modal, Spinner } from './components/ui';
import { LibraryPage } from './pages/LibraryPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
const FlowsPage = lazy(() => import('./pages/FlowsPage').then((module) => ({ default: module.FlowsPage })));
import { CrmPage } from './pages/CrmPage';
import { WorkspaceSettings } from './pages/WorkspaceSettings';
import { OverviewPage, ContactsPage, CampaignsPage, SpreadsheetsPage } from './pages/OperationsPages';
import { usePreferences } from './context/PreferencesContext';
import { HelpCenter } from './pages/HelpCenter';
import { SandboxPage } from './pages/SandboxPage';

type View =
  | 'inbox'
  | 'library'
  | 'connections'
  | 'settings'
  | 'personalization'
  | 'crm'
  | 'flows'
  | 'overview'
  | 'contacts'
  | 'spreadsheets'
  | 'campaigns'
  | 'schedule'
  | 'sandbox'
  | 'help';
const personalizationSearchItems = [
  { name: 'Cores, tema e identidade', terms: 'paleta logotipo favicon claro escuro', target: 'personalization-identity' },
  { name: 'Layout do atendimento', terms: 'hud paineis ferramentas botoes', target: 'personalization-layout' },
  { name: 'Renomear menus e pastas', terms: 'nomes secoes grupos', target: 'personalization-names' },
  { name: 'Ordem das etiquetas', terms: 'reordenar etiquetas kanban', target: 'personalization-order' },
  { name: 'Marca d’água', terms: 'imagem video amostra', target: 'personalization-watermark' },
] as const;
export default function App() {
  const workspace = useWorkspace();
  const { request, notify } = useApi();
  const [view, setView] = useState<View>(() =>
    window.location.pathname.replace(/\/+$/, '') === '/atendimento' ? 'inbox' : 'overview',
  );
  const { preferences, updatePreferences } = usePreferences();
  const leadSort = preferences.leadSort ?? 'priority';
  const leadResponse = preferences.leadResponse ?? 'all';
  const theme = preferences.theme;
  const setTheme = (value: string) => updatePreferences({ theme: value });
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState('all');
  const [labelId, setLabelId] = useState('');
  const [page, setPage] = useState(1);
  const [chats, setChats] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [toolsOpen, setToolsOpenState] = useState(
    () => window.innerWidth >= 1120 && preferences.toolsVisible && preferences.toolsDocked,
  );
  const [compactTools, setCompactToolsState] = useState(preferences.toolsCompact);
  const [quick, setQuick] = useState(0);
  const [newChat, setNewChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [commandCampaigns, setCommandCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [commandChats, setCommandChats] = useState<Conversation[]>([]);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [focusResourceId, setFocusResourceId] = useState('');
  const [personalizationFocus, setPersonalizationFocus] = useState<{ target: string; request: number } | null>(null);
  const [hudOpen, setHudOpen] = useState(false);
  const [dockEditRequest, setDockEditRequest] = useState(0);
  const [hudTab, setHudTab] = useState('panels');
  useEffect(() => {
    const open = (event: Event) => {
      setHudTab((event as CustomEvent<string>).detail || 'panels');
      setHudOpen(true);
    };
    window.addEventListener('noctua:customize-attendance', open);
    return () => window.removeEventListener('noctua:customize-attendance', open);
  }, []);
  const [toolIntent, setToolIntent] = useState<ToolIntent>();
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === 'visible')
        void request('/operations/directory/presence', 'POST', {}).catch(() => undefined);
    };
    ping();
    const timer = window.setInterval(ping, 45000);
    return () => window.clearInterval(timer);
  }, [request]);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    setToolIntent(undefined);
  }, [view]);
  const [narrowNavigation, setNarrowNavigation] = useState(() => window.innerWidth <= 900);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openTool = (section: string, kind?: string, question?: string) => {
    if (toolTarget(section) === 'shelf') {
      setToolsOpenState(true);
      updatePreferences({
        toolsVisible: true,
        toolsDocked: true,
        hudBlockPositions: {
          ...preferences.hudBlockPositions,
          tools: {
            ...(preferences.hudBlockPositions.tools ?? { x: 70, y: 10, width: 28, height: 75 }),
            mode: 'dock',
          },
        },
      });
    }
    setToolIntent({ section, kind, question, stamp: Date.now() });
  };
  useEffect(() => {
    const resize = () => {
      setViewportWidth(window.innerWidth);
      setNarrowNavigation(window.innerWidth <= 900);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const setToolsOpen = (value: boolean) => {
    setToolsOpenState(value);
    updatePreferences({ toolsVisible: value });
  };
  const setCompactTools = (value: boolean) => {
    setCompactToolsState(value);
    updatePreferences({ toolsCompact: value, hudToolsWidth: value ? 17 : 20 });
  };
  useEffect(() => {
    if (window.innerWidth >= 1120 && preferences.toolsDocked) setToolsOpenState(preferences.toolsVisible);
    else if (!preferences.toolsVisible) setToolsOpenState(false);
  }, [preferences.toolsVisible, preferences.toolsDocked]);
  useEffect(() => {
    let docked = window.innerWidth >= 1120;
    const resize = () => {
      const next = window.innerWidth >= 1120;
      if (next !== docked) {
        setToolsOpenState(next && preferences.toolsVisible && preferences.toolsDocked);
        docked = next;
      }
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [preferences.toolsVisible, preferences.toolsDocked]);
  useEffect(() => setCompactToolsState(preferences.toolsCompact), [preferences.toolsCompact]);
  useEffect(() => {
    localStorage.setItem('noctua-tools-open', String(toolsOpen));
  }, [toolsOpen]);
  useEffect(() => {
    localStorage.setItem('noctua-tools-size', compactTools ? 'compact' : 'comfortable');
  }, [compactTools]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('noctua-theme', theme);
  }, [theme]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  useEffect(() => {
    if (!commandOpen || !workspace.sessionId) return;
    const controller = new AbortController();
    void request<{ items: { id: string; name: string; mode: string }[] }>(
      `/operations/sessions/${workspace.sessionId}/batches`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((result) => setCommandCampaigns(result.items.filter((item) => item.mode === 'CAMPAIGN')))
      .catch(() => undefined);
    return () => controller.abort();
  }, [commandOpen, workspace.sessionId, request]);
  useEffect(() => {
    if (!commandOpen || commandSearch.trim().length < 2 || !workspace.sessionId) {
      setCommandChats([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        page: '1',
        pageSize: '8',
        search: commandSearch.trim(),
        filter: 'all',
      });
      void request<Paged<Conversation>>(
        `/attendance/sessions/${workspace.sessionId}/conversations?${query}`,
        'GET',
        undefined,
        controller.signal,
      )
        .then((result) => setCommandChats(result.items))
        .catch(() => undefined);
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [commandOpen, commandSearch, workspace.sessionId, request]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, filter, labelId, leadSort, leadResponse]);
  useEffect(() => {
    setSelected(null);
    setChats([]);
    setLabels([]);
    setPage(1);
    setDetailsOpen(false);
    setLabelId('');
  }, [workspace.sessionId]);
  useEffect(() => {
    if (!workspace.sessionId) return;
    const controller = new AbortController();
    setLoading(true);
    const query = new URLSearchParams({
      page: String(page),
      pageSize: '50',
      search: debounced,
      filter,
      sort: leadSort, response: leadResponse,
      ...(labelId ? { labelId } : {}),
    });
    void request<Paged<Conversation>>(
      `/attendance/sessions/${workspace.sessionId}/conversations?${query}`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => {
        setChats(data.items);
        setTotal(data.total);
        setSelected((current) => data.items.find((item) => item.id === current?.id) ?? current);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [workspace.sessionId, workspace.revision, debounced, filter, labelId, leadSort, leadResponse, page, request, notify]);
  useEffect(() => {
    if (!workspace.sessionId) return;
    const controller = new AbortController();
    void request<{ items: Label[] }>(
      `/whatsapp/sessions/${workspace.sessionId}/labels`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => setLabels(data.items))
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [workspace.sessionId, workspace.revision, request, notify]);
  useEffect(() => {
    if (!selected?.id || !workspace.sessionId) return;
    const controller = new AbortController();
    void request<Conversation>(
      `/attendance/sessions/${workspace.sessionId}/conversations/${selected.id}`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setSelected(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [selected?.id, workspace.sessionId, workspace.revision, request, notify]);
  const navigation = [
    { id: 'overview' as const, name: 'Visão geral', icon: LayoutDashboard },
    { id: 'inbox' as const, name: 'Atendimento', icon: MessageSquare },
    { id: 'campaigns' as const, name: 'Campanhas', icon: Send },
    { id: 'schedule' as const, name: 'Agenda', icon: CalendarDays },
    { id: 'library' as const, name: 'Biblioteca', icon: LibraryIcon },
    { id: 'flows' as const, name: 'Autoatendimento', icon: Workflow },
    { id: 'sandbox' as const, name: 'Espaço de Teste', icon: FlaskConical },
    { id: 'contacts' as const, name: 'Contatos', icon: Users },
    { id: 'spreadsheets' as const, name: 'Planilhas', icon: Table2 },
    { id: 'crm' as const, name: 'CRM e negócios', icon: KanbanSquare },
    { id: 'connections' as const, name: 'Conexões', icon: Wifi },
    { id: 'settings' as const, name: 'Configurações', icon: Settings },
    { id: 'personalization' as const, name: 'Personalização', icon: Palette },
  ].map((item) => ({ ...item, name: preferences.menuLabels[item.id] || item.name }));
  const session = workspace.session;
  const connected = workspace.serverConnected && session?.status === 'CONNECTED';
  const hudOrder = panelOrder(preferences).filter(
    (id) =>
      (id !== 'tools' || (toolsOpen && preferences.toolsDocked)) &&
      !(viewportWidth > 760 && preferences.hudBlockPositions[id]?.mode === 'floating'),
  );
  const hudStyle = hudGrid(hudOrder, preferences) as CSSProperties;
  return (
    <div className="app-shell">
      <aside
        className={`navigation ${narrowNavigation ? (mobileNavOpen ? 'nav-is-expanded' : 'nav-is-compact') : preferences.compactNav ? 'nav-is-compact' : 'nav-is-expanded'}`}
      >
        <button
          className="wordmark"
          title="Clique na coruja para recolher ou expandir o menu"
          aria-label="Recolher ou expandir menu principal"
          onClick={() =>
            narrowNavigation
              ? setMobileNavOpen((value) => !value)
              : updatePreferences({ compactNav: !preferences.compactNav })
          }
        >
          {preferences.brandingLogo ? (
            <img className="branding-mark" src={preferences.brandingLogo} alt="" />
          ) : (
            <span className="owl-mark">
              <i />
              <i />
            </span>
          )}
          noctua
          <span className="brand-dot">.</span>
        </button>
        <div className="workspace-name">
          {preferences.brandingLogo ? (
            <img className="workspace-avatar branding-mark" src={preferences.brandingLogo} alt="" />
          ) : (
            <span className="workspace-avatar">
              {(preferences.brandingName || 'N').slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{preferences.brandingName || 'Meu workspace'}</strong>
            <small>Atendimento & relacionamento</small>
          </div>
        </div>
        <p className="nav-group-label">WORKSPACE</p>
        <nav>
          {orderItems(
            menuGroups.map((group) => ({
              ...group,
              name: preferences.menuLabels['group:' + group.id] || group.name,
            })),
            preferences.menuGroupOrder,
            (group) => group.id,
          ).map((group) => (
            <Fragment key={group.id}>
              <small className="nav-section-label">{group.name.toLocaleUpperCase('pt-BR')}</small>
              {orderItems(
                navigation.filter((item) => group.items.some(([id]) => id === item.id)),
                preferences.menuOrder,
                (item) => item.id,
              )
                .filter(
                  (item) =>
                    ['inbox', 'connections', 'settings'].includes(item.id) ||
                    !preferences.hiddenViews.includes(item.id),
                )
                .map(({ id, name, icon: Icon }) => (
                  <Fragment key={id}>
                    <button
                      title={name}
                      aria-label={name}
                      className={view === id ? 'selected' : ''}
                      onClick={() => {
                        setView(id);
                        setToolIntent(undefined);
                        setMobileNavOpen(false);
                      }}
                    >
                      <Icon size={19} />
                      <span>{name}</span>
                      {id === 'inbox' && total > 0 && <b>{total}</b>}
                    </button>
                  </Fragment>
                ))}
            </Fragment>
          ))}
        </nav>
        <div className="nav-tip">
          <span>
            <Sparkles size={16} />
            Um toque mais humano
          </span>
          <p>
            Use <strong>#nome</strong> nas respostas para personalizar cada atendimento.
          </p>
        </div>
        <div className="nav-bottom">
          <button
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>Tema {theme === 'dark' ? 'claro' : 'escuro'}</span>
          </button>
          <button
            aria-label="Ajuda e configurações"
            title="Ajuda e configurações"
            onClick={() => { setView('help'); setMobileNavOpen(false); }}
          >
            <CircleHelp size={18} />
            <span>Ajuda e configurações</span>
          </button>
          <div className="local-account">
            <span className="user-avatar">EU</span>
            <div>
              <strong>Minha operação</strong>
              <small>Ambiente local</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {narrowNavigation && mobileNavOpen && (
        <button
          className="navigation-scrim"
          aria-label="Recolher menu principal"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronDown size={12} />
            <strong>{navigation.find((item) => item.id === view)?.name}</strong>
          </div>
          <div className="topbar-right">
            {view === 'inbox' && <AttendanceSettingsMenu
              enabled={preferences.dockingEnabled}
              onArrange={() => {if(viewportWidth<=480){setHudOpen(true);return;} updatePreferences({dockingEnabled:true}); setDockEditRequest(value => value + 1);}}
              onHud={() => setHudOpen(true)}
              onClassic={() => updatePreferences({dockingEnabled:false})}
            />}
            <button
              className="global-search-trigger"
              onClick={() => setCommandOpen(true)}
              aria-label="Busca rápida"
              title="Busca rápida (Ctrl+K)"
            >
              <Search size={16} />
              <span>Buscar</span>
              <kbd>Ctrl K</kbd>
            </button>
            {view === 'inbox' && (
              <button
                className={`tools-toggle ${toolsOpen ? 'active' : ''}`}
                aria-label={toolsOpen ? 'Ocultar biblioteca lateral' : 'Mostrar biblioteca lateral'}
                aria-expanded={toolsOpen}
                aria-controls="message-tools"
                onClick={() => setToolsOpen(!toolsOpen)}
              >
                {toolsOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                <span>Biblioteca lateral</span>
              </button>
            )}
            <span className={`connection-status ${connected ? 'connected' : ''}`}>
              <i />
              {!workspace.serverConnected
                ? 'Servidor desconectado'
                : connected
                  ? 'WhatsApp conectado'
                  : session?.status === 'AWAITING_QR'
                    ? 'Aguardando QR'
                    : session?.status === 'CONNECTING'
                      ? 'Conectando…'
                      : 'WhatsApp desconectado'}
            </span>
            <label className="session-select">
              <Wifi size={14} />
              <Select
                aria-label="Selecionar conexão"
                value={workspace.sessionId}
                onChange={(e) => workspace.setSessionId(e.target.value)}
              >
                <option value="" disabled>
                  Selecione uma conexão
                </option>
                {workspace.sessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <button
              className="topbar-avatar"
              onClick={() => setView('settings')}
              aria-label="Abrir configurações"
            >
              EU
            </button>
          </div>
        </header>
        {view === 'inbox' ? (
          <AttendanceLayout
            enabled={preferences.dockingEnabled && viewportWidth > 480}
            editRequest={dockEditRequest}
            onEditRequestHandled={() => setDockEditRequest(0)}
            toolsOpen={toolsOpen}
            onToolsChange={setToolsOpen}
            onClassic={() => updatePreferences({ dockingEnabled: false })}
            style={hudStyle}
            className={`inbox-layout hud-layout-${preferences.hudPanelLayout} ${selected ? 'chat-selected' : ''} ${toolsOpen ? 'tools-visible' : 'tools-hidden'} ${preferences.toolsDocked ? 'tools-docked' : 'tools-floating'} ${compactTools ? 'tools-compact' : 'tools-comfortable'} ${preferences.panelPosition === 'left' ? 'tools-left' : ''}`}
          >
            <ConversationList
              chats={chats}
              total={total}
              active={selected?.id ?? ''}
              onSelect={(chat) => {
                setSelected(chat);
                setDetailsOpen(false);
                window.dispatchEvent(new CustomEvent('noctua:dock-focus', { detail: 'chat' }));
              }}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
              label={labelId}
              setLabel={setLabelId}
              labels={labels}
              sort={leadSort} response={leadResponse}
              onSort={value => updatePreferences({leadSort:value})} onResponse={value => updatePreferences({leadResponse:value})}
              page={page}
              setPage={setPage}
              loading={loading || workspace.loading}
              onNew={() => (workspace.sessionId ? setNewChat(true) : setView('connections'))}
            />
            <ChatPane
              key={`chat:${workspace.sessionId}:${selected?.id ?? 'empty'}`}
              chat={selected}
              sessionId={workspace.sessionId}
              connected={connected}
              revision={workspace.revision}
              library={workspace.library}
              onBack={() => setSelected(null)}
              toolsVisible={toolsOpen}
              toolsCompact={compactTools}
              onToggleTools={() => setToolsOpen(!toolsOpen)}
              onToggleToolSize={() => setCompactTools(!compactTools)}
              onCustomize={() => setHudOpen(true)}
              onToolRequest={openTool}
              onDetails={() => setDetailsOpen(true)}
              onQuick={() => {
                openTool('responses', 'ALL');
                setQuick((value) => value + 1);
              }}
              onRefresh={workspace.refresh}
            />
            <ToolsPanel
              key={`tools:${workspace.sessionId}`}
              chat={selected}
              library={workspace.library}
              sessionId={workspace.sessionId}
              revision={workspace.revision}
              connected={connected}
              open={toolsOpen}
              compact={compactTools}
              onToggleSize={() => setCompactTools(!compactTools)}
              quick={quick}
              intent={toolIntent}
              onClose={() => setToolsOpen(false)}
              onRefresh={workspace.refresh}
              onLibraryRefresh={workspace.loadLibrary}
            />
            {toolsOpen && (
              <button
                className="tools-drawer-scrim"
                aria-label="Fechar painel de ferramentas"
                onClick={() => setToolsOpen(false)}
              />
            )}
          </AttendanceLayout>
        ) : view === 'overview' ? (
          <OverviewPage sessionId={workspace.sessionId} onNavigate={setView} />
        ) : view === 'campaigns' || view === 'schedule' ? (
          <CampaignsPage
            key={view + workspace.sessionId}
            sessionId={workspace.sessionId}
            library={workspace.library}
            schedule={view === 'schedule'}
            initialSearch={view === 'campaigns' ? campaignSearch : ''}
          />
        ) : view === 'spreadsheets' ? (
          <SpreadsheetsPage sessionId={workspace.sessionId} onCampaign={() => setView('campaigns')} />
        ) : view === 'contacts' ? (
          <ContactsPage
            sessionId={workspace.sessionId}
            onOpen={(conversationId) => {
              void request<Conversation>(
                `/attendance/sessions/${workspace.sessionId}/conversations/${conversationId}`,
              )
                .then((chat) => {
                  setSelected(chat);
                  setDetailsOpen(true);
                  setView('inbox');
                })
                .catch((error) => notify(errorMessage(error), true));
            }}
          />
        ) : view === 'crm' ? (
          <CrmPage
            key={`crm:${workspace.sessionId}`}
            sessionId={workspace.sessionId}
            revision={workspace.revision}
            connected={connected}
            labelStyles={preferences.labelStyles}
            onOpenChat={(conversationId) => {
              void request<Conversation>(
                `/attendance/sessions/${workspace.sessionId}/conversations/${conversationId}`,
              )
                .then((chat) => {
                  setSelected(chat);
                  setDetailsOpen(false);
                  setView('inbox');
                })
                .catch((error) => notify(errorMessage(error), true));
            }}
          />
        ) : view === 'flows' ? (
          <Suspense fallback={<div className="flows-empty">Carregando editor…</div>}>
            <FlowsPage
              key={workspace.sessionId}
              sessionId={workspace.sessionId}
              revision={workspace.revision}
              library={workspace.library}
            />
          </Suspense>
        ) : view === 'library' ? (
          <LibraryPage
            sessionId={workspace.sessionId}
            library={workspace.library}
            refresh={workspace.loadLibrary}
            focusResourceId={focusResourceId}
            onFocusResourceHandled={() => setFocusResourceId('')}
          />
        ) : view === 'connections' ? (
          <ConnectionsPage
            sessions={workspace.sessions}
            sessionId={workspace.sessionId}
            select={workspace.setSessionId}
            refresh={workspace.loadSessions}
            labels={labels}
          />
        ) : view === 'sandbox' ? (
          <SandboxPage />
        ) : view === 'help' ? (
          <HelpCenter onNavigate={(target) => setView(target)} />
        ) : view === 'settings' || view === 'personalization' ? (
          <WorkspaceSettings
            key={view}
            initialTab={view === 'personalization' ? 'personalization' : 'general'}
            focusSection={view === 'personalization' ? personalizationFocus : null}
            sessionId={workspace.sessionId}
            library={workspace.library}
            onOrderRefresh={workspace.refresh}
            onImported={async () => {
              await workspace.loadLibrary();
              workspace.refresh();
            }}
          />
        ) : (
          <OverviewPage sessionId={workspace.sessionId} onNavigate={setView} />
        )}
      </div>
      {detailsOpen && selected && (
        <ContactDetails
          key={`details:${selected.id}`}
          chat={selected}
          labels={labels}
          sessionId={workspace.sessionId}
          onClose={() => setDetailsOpen(false)}
          onRefresh={workspace.refresh}
        />
      )}
      {newChat && (
        <Modal title="Nova conversa" onClose={() => setNewChat(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = Object.fromEntries(new FormData(event.currentTarget));
              setBusy(true);
              void request<{ id: string }>(
                `/attendance/sessions/${workspace.sessionId}/conversations`,
                'POST',
                data,
              )
                .then(() => {
                  setNewChat(false);
                  setSearch('');
                  setFilter('all');
                  workspace.refresh();
                  notify('Contato criado. Selecione a conversa para enviar uma mensagem.');
                })
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Nome
              <input name="name" required maxLength={100} placeholder="Nome do contato" />
            </label>
            <label>
              Telefone com DDI e DDD
              <input
                name="phoneNumber"
                required
                pattern="[0-9]{8,15}"
                inputMode="tel"
                placeholder="5511999999999"
              />
              <small className="muted">Somente números. Nenhuma mensagem será enviada ao criar.</small>
            </label>
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setNewChat(false)}>
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? <Spinner /> : <Plus size={15} />}Criar conversa
              </button>
            </div>
          </form>
        </Modal>
      )}
      <CampaignMonitor sessionId={workspace.sessionId} connected={Boolean(connected)} />
      {hudOpen && (
        <HudEditor
          initialTab={hudTab}
          library={workspace.library}
          sessionId={workspace.sessionId}
          onClose={() => setHudOpen(false)}
        />
      )}
      {commandOpen && (
        <Modal
          title="Busca rápida"
          onClose={() => {
            setCommandOpen(false);
            setCommandSearch('');
          }}
        >
          <div className="command-palette">
            <label className="command-search-field">
              <Search size={18} />
              <input
                autoFocus
                value={commandSearch}
                onChange={(event) => setCommandSearch(event.target.value)}
                placeholder="Buscar conversas, telas e recursos…"
              />
              <kbd>ESC</kbd>
            </label>
            <div className="command-results">
              <p className="eyebrow">TELAS</p>
              {navigation
                .filter((item) =>
                  item.name.toLocaleLowerCase('pt-BR').includes(commandSearch.toLocaleLowerCase('pt-BR')),
                )
                .map(({ id, name, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setView(id);
                      setCommandOpen(false);
                      setCommandSearch('');
                    }}
                  >
                    <Icon size={17} />
                    <span>{name}</span>
                    <small>Abrir tela</small>
                  </button>
                ))}
              {personalizationSearchItems
                .filter((item) =>
                  commandSearch.trim().length > 1 &&
                  `${item.name} ${item.terms}`.toLocaleLowerCase('pt-BR').includes(commandSearch.trim().toLocaleLowerCase('pt-BR')),
                )
                .map((item) => (
                  <button
                    key={item.target}
                    onClick={() => {
                      setPersonalizationFocus({ target: item.target, request: Date.now() });
                      setView('personalization');
                      setCommandOpen(false);
                      setCommandSearch('');
                    }}
                  >
                    <Palette size={17} />
                    <span>{item.name}</span>
                    <small>Personalização</small>
                  </button>
                ))}
              {commandChats.slice(0, 8).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setSelected(chat);
                    setView('inbox');
                    setCommandOpen(false);
                    setCommandSearch('');
                  }}
                >
                  <MessageSquare size={17} />
                  <span>{chat.contact.name}</span>
                  <small>Conversa</small>
                </button>
              ))}
              {commandCampaigns
                .filter(
                  (item) =>
                    commandSearch.length > 1 &&
                    item.name.toLocaleLowerCase('pt-BR').includes(commandSearch.toLocaleLowerCase('pt-BR')),
                )
                .slice(0, 6)
                .map((item) => (
                  <button
                    key={`campaign:${item.id}`}
                    onClick={() => {
                      setCampaignSearch(item.name);
                      setView('campaigns');
                      setCommandOpen(false);
                      setCommandSearch('');
                    }}
                  >
                    <Send size={17} />
                    <span>{item.name}</span>
                    <small>Campanha</small>
                  </button>
                ))}
              {[
                ...workspace.library.assets.map((item) => ({
                  id: item.id,
                  name: item.name,
                  kind: 'Biblioteca',
                })),
                ...workspace.library.funnels.map((item) => ({ id: item.id, name: item.name, kind: 'Funil' })),
                ...workspace.library.macros.map((item) => ({ id: item.id, name: item.name, kind: 'Macro' })),
              ]
                .filter(
                  (item) =>
                    commandSearch.length > 1 &&
                    item.name.toLocaleLowerCase('pt-BR').includes(commandSearch.toLocaleLowerCase('pt-BR')),
                )
                .slice(0, 6)
                .map((item) => (
                  <button
                    key={`${item.kind}:${item.id}`}
                    onClick={() => {
                      setFocusResourceId(item.id);
                      setView('library');
                      setCommandOpen(false);
                      setCommandSearch('');
                    }}
                  >
                    <LibraryIcon size={17} />
                    <span>{item.name}</span>
                    <small>{item.kind}</small>
                  </button>
                ))}
              {commandSearch.length > 1 && commandChats.length === 0 && (
                <small className="muted">Nenhuma conversa corresponde à busca.</small>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
