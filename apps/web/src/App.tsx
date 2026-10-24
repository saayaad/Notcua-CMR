import { Fragment, lazy, Suspense, useEffect, useState } from 'react';
import { menuGroups, orderItems } from './context/ordering';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
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
import { OverviewPage, ContactsPage, CampaignsPage } from './pages/OperationsPages';
import { usePreferences } from './context/PreferencesContext';

type View =
  | 'inbox'
  | 'library'
  | 'connections'
  | 'settings'
  | 'crm'
  | 'flows'
  | 'overview'
  | 'contacts'
  | 'campaigns'
  | 'schedule';
export default function App() {
  const workspace = useWorkspace();
  const { request, notify } = useApi();
  const [view, setView] = useState<View>('overview');
  const { preferences, updatePreferences } = usePreferences();
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
  const [toolsOpen, setToolsOpen] = useState(
    () => window.innerWidth > 1100 && localStorage.getItem('noctua-tools-open') !== 'false',
  );
  const [compactTools, setCompactTools] = useState(
    () => localStorage.getItem('noctua-tools-size') !== 'comfortable',
  );
  const [quick, setQuick] = useState(0);
  const [newChat, setNewChat] = useState(false);
  const [busy, setBusy] = useState(false);
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
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, filter, labelId]);
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
  }, [workspace.sessionId, workspace.revision, debounced, filter, labelId, page, request, notify]);
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
    { id: 'contacts' as const, name: 'Contatos', icon: Users },
    { id: 'crm' as const, name: 'CRM e negócios', icon: KanbanSquare },
    { id: 'connections' as const, name: 'Conexões', icon: Wifi },
    { id: 'settings' as const, name: 'Configurações', icon: Settings },
  ];
  const session = workspace.session;
  const connected = workspace.serverConnected && session?.status === 'CONNECTED';
  return (
    <div className="app-shell">
      <aside className="navigation">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView('inbox');
          }}
        >
          <span className="owl-mark">
            <i />
            <i />
          </span>
          noctua<span className="brand-dot">.</span>
        </a>
        <div className="workspace-name">
          <span className="workspace-avatar">N</span>
          <div>
            <strong>Meu workspace</strong>
            <small>Atendimento & relacionamento</small>
          </div>
        </div>
        <p className="nav-group-label">WORKSPACE</p>
        <nav>
          {orderItems(menuGroups, preferences.menuGroupOrder, (group) => group.id).map((group) => (
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
                      onClick={() => setView(id)}
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
            onClick={() => {
              setView('settings');
              notify('O guia completo está na pasta docs do projeto.');
            }}
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
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronDown size={12} />
            <strong>{navigation.find((item) => item.id === view)?.name}</strong>
          </div>
          <div className="topbar-right">
            {view === 'inbox' && (
              <button
                className={`tools-toggle ${toolsOpen ? 'active' : ''}`}
                aria-label={toolsOpen ? 'Ocultar ferramentas' : 'Mostrar ferramentas'}
                aria-expanded={toolsOpen}
                aria-controls="message-tools"
                onClick={() => setToolsOpen((value) => !value)}
              >
                {toolsOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                <span>Ferramentas</span>
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
              <select
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
              </select>
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
          <div
            className={`inbox-layout ${selected ? 'chat-selected' : ''} ${toolsOpen ? 'tools-visible' : 'tools-hidden'} ${compactTools ? 'tools-compact' : 'tools-comfortable'}`}
          >
            <ConversationList
              chats={chats}
              total={total}
              active={selected?.id ?? ''}
              onSelect={(chat) => {
                setSelected(chat);
                setDetailsOpen(false);
              }}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
              label={labelId}
              setLabel={setLabelId}
              labels={labels}
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
              onDetails={() => setDetailsOpen(true)}
              onQuick={() => {
                setToolsOpen(true);
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
              onToggleSize={() => setCompactTools((value) => !value)}
              quick={quick}
              onClose={() => setToolsOpen(false)}
              onRefresh={workspace.refresh}
              onLibraryRefresh={workspace.loadLibrary}
            />
          </div>
        ) : view === 'overview' ? (
          <OverviewPage sessionId={workspace.sessionId} onNavigate={setView} />
        ) : view === 'campaigns' || view === 'schedule' ? (
          <CampaignsPage
            key={view + workspace.sessionId}
            sessionId={workspace.sessionId}
            library={workspace.library}
            schedule={view === 'schedule'}
          />
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
          />
        ) : view === 'connections' ? (
          <ConnectionsPage
            sessions={workspace.sessions}
            sessionId={workspace.sessionId}
            select={workspace.setSessionId}
            refresh={workspace.loadSessions}
            labels={labels}
          />
        ) : (
          <WorkspaceSettings
            sessionId={workspace.sessionId}
            library={workspace.library}
            onOrderRefresh={workspace.refresh}
            onImported={async () => {
              await workspace.loadLibrary();
              workspace.refresh();
            }}
          />
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
    </div>
  );
}
