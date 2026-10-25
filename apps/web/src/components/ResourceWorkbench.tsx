import { Select } from './Select';
import { useHudPlacement, HudMoveHandle } from './HudPlacement';
import { useEffect, useState, useRef } from 'react';
import {
  Search,
  Plus,
  Star,
  Clock3,
  TrendingUp,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Send,
  Play,
  X,
  GripVertical,
  MessageSquare,
  Mic,
  Image,
  FileText,
  GitBranch,
  Layers,
  Wallet,
  ChevronDown,
  Workflow,
} from 'lucide-react';
import type { Asset, Conversation, Funnel, Library, Macro, PixKey, Sequence } from '../types';
import type { ToolIntent } from '../context/attendance';
import { insertDraft } from '../context/attendance';
import { usePreferences } from '../context/PreferencesContext';
import { completeOrder } from '../context/hud';
import { orderItems, libraryFolders } from '../context/ordering';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from './ui';
import { AssetPreview } from './AssetPreview';
import { AssetEditor, FunnelEditor, PixEditor } from '../pages/LibraryPage';
import { MacroEditor } from './MacroEditor';
import { PixModal } from './PixModal';
import { LibraryCategories, useLibraryOrganization } from './LibraryCategories';
import { ToolboxWorkspace, toolboxSections } from './ToolboxWorkspace';
import { StandardReplies } from './StandardReplies';
import { NextAction } from './NextAction';
import { ReorderList } from './ReorderList';
import { openAttendanceCustomization, PinnedShelf } from './PinnedShelf';
import type { FlowSummary } from '../pages/flows/flow.types';

type Kind = Asset['kind'] | 'FUNNEL' | 'MACRO' | 'PIX' | 'FLOW';
type Resource = {
  id: string;
  name: string;
  kind: Kind;
  excerpt: string;
  asset?: Asset;
  funnel?: Funnel;
  macro?: Macro;
  pix?: PixKey;
  flow?: FlowSummary;
};
const kindIcons = {
  MESSAGE: MessageSquare,
  AUDIO: Mic,
  MEDIA: Image,
  DOCUMENT: FileText,
  FUNNEL: GitBranch,
  MACRO: Layers,
  PIX: Wallet,
  FLOW: Workflow,
};
const kindNames: Record<Kind, string> = {
  MESSAGE: 'Texto',
  AUDIO: 'Áudio',
  MEDIA: 'Foto ou vídeo',
  DOCUMENT: 'Documento',
  FUNNEL: 'Funil',
  MACRO: 'Macro',
  PIX: 'PIX',
  FLOW: 'Fluxo',
};

export function ResourceWorkbench({
  chat,
  library,
  sessionId,
  revision,
  connected,
  open,
  compact,
  onToggleSize,
  quick,
  intent,
  onClose,
  onRefresh,
  onLibraryRefresh,
}: {
  chat: Conversation | null;
  library: Library;
  sessionId: string;
  revision: number;
  connected: boolean;
  open: boolean;
  compact: boolean;
  onToggleSize: () => void;
  quick: number;
  intent?: ToolIntent;
  onClose: () => void;
  onRefresh: () => void;
  onLibraryRefresh: () => Promise<void>;
}) {
  const { request, notify } = useApi();
  const { preferences, updatePreferences, savePreferences } = usePreferences();
  const organization = useLibraryOrganization();
  const placement = useHudPlacement('tools');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<'library' | 'pinned'>('library');
  const [section, setSection] = useState('responses');
  const [kind, setKind] = useState<Kind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'recent' | 'used'>('all');
  const [category, setCategory] = useState('');
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [runs, setRuns] = useState<Sequence[]>([]);
  const [preview, setPreview] = useState<Resource | null>(null);
  const [requestId, setRequestId] = useState('');
  const [sendError, setSendError] = useState('');
  const [busy, setBusy] = useState(false);
  const directRequests = useRef<Record<string, string>>({});
  const sending = useRef(false);
  const [assetEditor, setAssetEditor] = useState<{ kind: Asset['kind']; asset?: Asset } | null>(null);
  const [funnelEditor, setFunnelEditor] = useState<Funnel | 'new' | null>(null);
  const [macroEditor, setMacroEditor] = useState<string | null>(null);
  const [pixEditor, setPixEditor] = useState(false);
  const [pixSend, setPixSend] = useState(false);
  const [pixInitial, setPixInitial] = useState('');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [organize, setOrganize] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [draftFolders, setDraftFolders] = useState<string[]>([]);
  const [removing, setRemoving] = useState<Asset | null>(null);
  const base = `/attendance/sessions/${sessionId}/conversations/${chat?.id ?? ''}`;
  useEffect(() => {
    if (!intent) {
      setSection('responses');
      setCatalogOpen(false);
      setPreview(null);
      return;
    }
    if (intent) {
      setSection(intent.section === 'catalog' ? 'responses' : intent.section);
      setCatalogOpen(false);
      if (intent.section === 'responses' || intent.section === 'catalog') {
        setPaneMode('library');
        setKind((intent.kind as Kind | 'ALL') || 'ALL');
      }
      if (intent.kind) setKind(intent.kind as Kind | 'ALL');
      setSearch('');
      setFilter('all');
      setCategory('');
    }
  }, [intent]);
  useEffect(() => {
    if (quick && !intent) {
      setSection('responses');
      setKind('ALL');
    }
  }, [quick, intent]);
  useEffect(() => {
    if (!open && !catalogOpen && section === 'responses') return;
    void request<Record<string, number>>('/operations/toolbox/usage')
      .then(setUsage)
      .catch(() => undefined);
  }, [open, catalogOpen, section, request]);
  useEffect(() => {
    if (!chat || (!open && !catalogOpen && section === 'responses')) {
      setRuns([]);
      return;
    }
    const controller = new AbortController();
    void request<{ items: Sequence[] }>(`${base}/sequences`, 'GET', undefined, controller.signal)
      .then((result) => setRuns(result.items))
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [base, chat?.id, open, catalogOpen, section, revision, request, notify]);
  useEffect(() => {
    setPreview(null);
    setSendError('');
    directRequests.current = {};
  }, [chat?.id, sessionId]);
  useEffect(() => {
    if (!open && !catalogOpen && section === 'responses') return;
    const controller = new AbortController();
    void request<{ items: FlowSummary[] }>(
      `/automation/sessions/${sessionId}/flows`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => setFlows(data.items.filter((flow) => !flow.archived)))
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [open, catalogOpen, section, sessionId, request, notify]);
  const resources: Resource[] = [
    ...flows.map((flow) => ({
      id: `flow:${flow.id}`,
      name: flow.name,
      kind: 'FLOW' as const,
      excerpt:
        flow.enabled && flow.published
          ? 'Fluxo publicado e ativo.'
          : 'Fluxo desativado ou sem versão publicada.',
      flow,
    })),
    ...library.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      excerpt:
        asset.kind === 'MESSAGE'
          ? (asset.text ?? '')
          : asset.caption || asset.file?.filename || kindNames[asset.kind],
      asset,
    })),
    ...library.funnels.map((funnel) => ({
      id: funnel.id,
      name: funnel.name,
      kind: 'FUNNEL' as const,
      excerpt: `${funnel.items.length} etapas · ${funnel.items
        .slice(0, 3)
        .map((step) => step.asset.name)
        .join(' → ')}`,
      funnel,
    })),
    ...library.macros.map((macro) => ({
      id: macro.id,
      name: macro.name,
      kind: 'MACRO' as const,
      excerpt: `${macro._count.actions} ações · ${macro.text ?? 'Envios, etiquetas e ações combinadas.'}`,
      macro,
    })),
    ...library.pixKeys.map((pix) => ({
      id: pix.id,
      name: pix.name,
      kind: 'PIX' as const,
      excerpt: `${pix.merchantName} · ${pix.value}`,
      pix,
    })),
  ];
  const favorite = (item: Resource) =>
    Boolean(item.asset?.isFavorite || preferences.favoriteResourceIds.includes(item.id));
  const ordered = orderItems(resources, preferences.workbenchResourceOrder, (item) => item.id);
  const matching = ordered.filter(
    (item) =>
      (kind === 'ALL' || item.kind === kind) &&
      `${item.name} ${item.excerpt} ${organization.assignments[item.id] ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')) &&
      (!category || organization.assignments[item.id] === category) &&
      (filter !== 'favorites' || favorite(item)) &&
      (filter !== 'recent' || preferences.recentResourceIds.includes(item.id)),
  );
  if (filter === 'used') matching.sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0));
  if (filter === 'recent')
    matching.sort(
      (a, b) => preferences.recentResourceIds.indexOf(a.id) - preferences.recentResourceIds.indexOf(b.id),
    );
  const remember = (item: Resource, sent = false) => {
    updatePreferences({
      recentResourceIds: [item.id, ...preferences.recentResourceIds.filter((id) => id !== item.id)].slice(
        0,
        40,
      ),
    });
    if (sent && item.kind !== 'PIX')
      void request<{ count: number }>('/operations/toolbox/usage', 'POST', { id: item.id })
        .then((result) => setUsage((current) => ({ ...current, [item.id]: result.count })))
        .catch(() => undefined);
  };
  const toggleFavorite = async (item: Resource) => {
    if (item.asset?.isFavorite) {
      try {
        await request(`/attendance/assets/${encodeURIComponent(item.id)}`, 'PUT', {
          ...item.asset,
          isFavorite: false,
        });
        await onLibraryRefresh();
        updatePreferences({
          favoriteResourceIds: preferences.favoriteResourceIds.filter((id) => id !== item.id),
        });
      } catch (error) {
        notify(errorMessage(error), true);
      }
    } else
      updatePreferences({
        favoriteResourceIds: preferences.favoriteResourceIds.includes(item.id)
          ? preferences.favoriteResourceIds.filter((id) => id !== item.id)
          : [...preferences.favoriteResourceIds, item.id],
      });
  };
  const openPreview = (item: Resource) => {
    setPreview(item);
    setRequestId(crypto.randomUUID());
    setSendError('');
  };
  const insert = (item: Resource) => {
    if (chat && item.asset?.text) {
      insertDraft(chat.id, item.asset.text);
      setCatalogOpen(false);
      setSection('responses');
      remember(item);
      if (!preferences.toolsDocked) onClose();
    }
  };
  const activeRun = runs.find((item) => ['QUEUED', 'RUNNING', 'PAUSED'].includes(item.status));
  const send = async (item = preview, sendId = requestId) => {
    if (!item || !chat || !connected || sending.current) return;
    sending.current = true;
    setBusy(true);
    setSendError('');
    try {
      if (item.flow)
        await request(`/automation/sessions/${sessionId}/flows/${item.flow.id}/launch`, 'POST', {
          conversationId: chat.id,
        });
      else if (item.pix)
        await request(`${base}/send`, 'POST', {
          requestId: sendId,
          kind: 'text',
          text: `Segue a chave PIX para pagamento:\n\n${item.pix.value}`,
        });
      else if (item.asset)
        await request(`${base}/send-asset`, 'POST', { assetId: item.id, requestId: sendId });
      else if (item.kind === 'FUNNEL' || item.kind === 'MACRO')
        await request(`${base}/sequences`, 'POST', { kind: item.kind, sourceId: item.id, requestId: sendId });
      remember(item, true);
      delete directRequests.current[item.id];
      setPreview(null);
      onRefresh();
      notify(
        item.flow || item.kind === 'FUNNEL' || item.kind === 'MACRO'
          ? 'Sequência iniciada. Você pode acompanhar e pausar no chat.'
          : 'Recurso enviado.',
      );
    } catch (error) {
      notify(errorMessage(error), true);
      setSendError(
        `${errorMessage(error)} Confira o histórico antes de tentar novamente. A confirmação nesta janela mantém o mesmo identificador de envio.`,
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const edit = (item: Resource) => {
    if (item.asset) setAssetEditor({ kind: item.asset.kind, asset: item.asset });
    else if (item.funnel) setFunnelEditor(item.funnel);
    else if (item.macro) setMacroEditor(item.id);
    else if (item.flow) notify('Edite e publique este fluxo na aba Autoatendimento.');
    else setPixEditor(true);
  };
  const create = (type: Kind) => {
    if (type === 'FUNNEL') setFunnelEditor('new');
    else if (type === 'MACRO') setMacroEditor('new');
    else if (type === 'PIX') setPixEditor(true);
    else if (type === 'FLOW') notify('Crie fluxos na aba Autoatendimento.');
    else setAssetEditor({ kind: type });
  };
  const saved = async () => {
    await onLibraryRefresh();
    setAssetEditor(null);
    setFunnelEditor(null);
    setMacroEditor(null);
    setPixEditor(false);
  };
  const showPreviewFor = (item: Resource) =>
    preferences.pinnedButtonSettings[item.id]?.preview === 'always' ||
    (preferences.pinnedButtonSettings[item.id]?.preview !== 'never' && preferences.showPinnedPreview);
  const chooseContent = (item: Resource) => {
    if (item.pix && showPreviewFor(item)) {
      setPixInitial(item.id);
      setPixSend(true);
      return;
    }
    if (showPreviewFor(item)) {
      openPreview(item);
      return;
    }
    if (!directRequests.current[item.id]) directRequests.current[item.id] = crypto.randomUUID();
    void send(item, directRequests.current[item.id]);
  };
  const resourceCatalog = (
    <div className="workbench-library-body">
      <div className="workbench-library-header">
        <label className="workbench-search">
          <Search size={16} />
          <input
            aria-label="Buscar em toda a Biblioteca"
            placeholder="Buscar texto, áudio, arquivo ou funil…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (event.target.value) setKind('ALL');
            }}
          />
        </label>
        <div className="workbench-kind-chips">
          <button aria-pressed={kind === 'ALL'} onClick={() => setKind('ALL')}>
            Tudo
          </button>
          {orderItems(libraryFolders, preferences.folderOrder, (item) => item[0]!).map(([id, name]) => {
            const Icon = kindIcons[id as Kind];
            return (
              <button
                key={id}
                aria-pressed={kind === id}
                title={preferences.folderLabels[id!] || name}
                onClick={() => setKind(id as Kind)}
              >
                <Icon size={13} />
                {preferences.folderLabels[id!] || name}
              </button>
            );
          })}
          <button aria-pressed={kind === 'FLOW'} onClick={() => setKind('FLOW')}>
            <Workflow size={13} />
            Fluxos
          </button>
        </div>
        <div className="workbench-library-options">
          <div>
            {(
              [
                { id: 'all', name: 'Todos', icon: null },
                { id: 'favorites', name: 'Favoritos', icon: Star },
                { id: 'recent', name: 'Recentes', icon: Clock3 },
                { id: 'used', name: 'Mais usados', icon: TrendingUp },
              ] as const
            ).map(({ id, name, icon: Icon }) => (
              <button key={id} aria-pressed={filter === id} title={name} onClick={() => setFilter(id)}>
                {Icon && <Icon size={13} />}
                <span>{name}</span>
              </button>
            ))}
          </div>
          <details className="workbench-create">
            <summary className="button small">
              <Plus size={14} />
              Criar
              <ChevronDown size={12} />
            </summary>
            <div>
              {libraryFolders.map(([id, name]) => (
                <button
                  key={id}
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    create(id as Kind);
                  }}
                >
                  {preferences.folderLabels[id!] || name}
                </button>
              ))}
            </div>
          </details>
        </div>
        <div className="workbench-results-heading">
          <span>{matching.length} recurso(s)</span>
          <Select
            className="workbench-category-select"
            aria-label="Filtrar por categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {organization.categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <button
            className="icon-button"
            title="Organizar categorias"
            aria-label="Organizar categorias"
            onClick={() => setCategoriesOpen(true)}
          >
            <Pencil size={13} />
          </button>
          <button
            className="text-button"
            onClick={() => {
              setDraftOrder(ordered.map((item) => item.id));
              setDraftFolders(
                completeOrder(
                  preferences.folderOrder,
                  libraryFolders.map((item) => item[0]!),
                ),
              );
              setOrganize(true);
            }}
          >
            <GripVertical size={13} />
            Reordenar
          </button>
        </div>
      </div>
      <div className="workbench-scroll resource-results">
        {matching.map((item) => {
          const Icon = kindIcons[item.kind];
          return (
            <article className="workbench-resource-card" key={item.id}>
              <div className="resource-card-top">
                <span className={`resource-kind kind-${item.kind.toLowerCase()}`}>
                  <Icon size={13} />
                  {kindNames[item.kind]}
                </span>
                <button
                  className={`icon-button resource-favorite ${favorite(item) ? 'selected' : ''}`}
                  aria-label={`${favorite(item) ? 'Desfavoritar' : 'Favoritar'} ${item.name}`}
                  onClick={() => void toggleFavorite(item)}
                >
                  <Star size={15} fill={favorite(item) ? 'currentColor' : 'none'} />
                </button>

                <details className="resource-more">
                  <summary className="icon-button" aria-label={`Opções de ${item.name}`}>
                    <ChevronDown size={16} />
                  </summary>
                  <div>
                    <button onClick={() => edit(item)}>
                      <Pencil size={14} />
                      {item.kind === 'PIX' ? 'Cadastrar outra chave' : 'Editar recurso'}
                    </button>
                    {item.asset && (
                      <>
                        <button
                          onClick={() =>
                            void request(
                              `/attendance/assets/${encodeURIComponent(item.id)}/duplicate`,
                              'POST',
                            )
                              .then(onLibraryRefresh)
                              .catch((error) => notify(errorMessage(error), true))
                          }
                        >
                          <Copy size={14} />
                          Duplicar
                        </button>
                        <button onClick={() => setRemoving(item.asset!)}>
                          <Trash2 size={14} />
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </details>
              </div>
              <button className="workbench-resource-name" onClick={() => openPreview(item)}>
                {item.name}
              </button>
              <p>{item.excerpt}</p>
              {organization.assignments[item.id] && (
                <small className="workbench-category-tag">{organization.assignments[item.id]}</small>
              )}
              <div className="resource-card-actions">
                <button
                  className="button primary small"
                  disabled={!chat || busy || (!connected && !showPreviewFor(item))}
                  onClick={() => chooseContent(item)}
                >
                  <Send size={14} />
                  Enviar
                </button>
              </div>
            </article>
          );
        })}
        {!matching.length && (
          <div className="workbench-empty">
            <Search size={28} />
            <strong>Nenhum recurso neste filtro</strong>
            <p>Tente outra busca, troque a categoria ou use “Criar” para adicionar conteúdo.</p>
            <button
              className="button"
              onClick={() => {
                setSearch('');
                setKind('ALL');
                setFilter('all');
                setCategory('');
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return (
    <aside
      {...placement.attributes}
      style={placement.style}
      id="message-tools"
      hidden={!open}
      data-tool-nav={preferences.hudToolNav}
      className={`contact-panel tools-panel resource-workbench ${open ? 'panel-open' : ''}`}
      aria-label="Ferramentas de atendimento"
    >
      <header className="workbench-heading">
        <HudMoveHandle placement={placement} name="tools" />
        <div>
          <strong>{paneMode === 'library' ? 'Biblioteca de atendimento' : 'Mensagens fixadas'}</strong>
          <small>{chat ? chat.contact.name : 'Biblioteca e organização'}</small>
        </div>
        <div>
          <button
            className="icon-button"
            title="Personalizar posição das mensagens fixadas"
            aria-label="Personalizar posição das mensagens fixadas"
            onClick={() => openAttendanceCustomization('panels')}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button"
            title="Fechar ferramentas"
            aria-label="Fechar ferramentas"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <nav className="workbench-mode-tabs" aria-label="Conteúdos da lateral">
        <button aria-pressed={paneMode === 'library'} onClick={() => setPaneMode('library')}>
          Biblioteca
        </button>
        <button aria-pressed={paneMode === 'pinned'} onClick={() => setPaneMode('pinned')}>
          Fixados
        </button>
      </nav>
      {paneMode === 'library' ? (
        resourceCatalog
      ) : (
        <PinnedShelf
          resources={ordered}
          library={library}
          chat={chat}
          selectedKind={kind}
          onKind={setKind}
          connected={connected}
          busy={busy}
          onSend={(item, showPreview) => {
            if (item.pix && showPreview) {
              setPixInitial(item.id);
              setPixSend(true);
              return;
            }
            if (showPreview) {
              openPreview({ ...item, name: preferences.pinnedButtonSettings[item.id]?.label || item.name });
              return;
            }
            if (!directRequests.current[item.id]) directRequests.current[item.id] = crypto.randomUUID();
            void send(item, directRequests.current[item.id]);
          }}
        />
      )}
      {section !== 'responses' && (
        <Modal
          title={
            section === 'responses'
              ? 'Biblioteca completa'
              : (toolboxSections.find((item) => item.id === section)?.name ?? 'Ferramenta de atendimento')
          }
          className="workbench-function-modal"
          onClose={() => {
            setSection('responses');
            setCatalogOpen(false);
          }}
        >
          <div className="workbench-function-body">
            {section === 'faq' ? (
              <div className="workbench-scroll">
                <StandardReplies
                  sessionId={sessionId}
                  chat={chat}
                  library={library}
                  connected={connected}
                  revision={revision}
                  question={intent?.question}
                  questionStamp={intent?.stamp}
                  onSent={onRefresh}
                  onCloseTools={() => {
                    setSection('responses');
                    setCatalogOpen(false);
                  }}
                  onCreateResource={(kind) => setAssetEditor({ kind })}
                />
              </div>
            ) : section === 'next' ? (
              <div className="workbench-scroll">
                {chat ? (
                  <NextAction sessionId={sessionId} conversationId={chat.id} revision={revision} />
                ) : (
                  <p className="workbench-empty">Selecione uma conversa para definir a próxima ação.</p>
                )}
              </div>
            ) : section !== 'responses' ? (
              <ToolboxWorkspace
                section={section}
                chat={chat}
                sessionId={sessionId}
                revision={revision}
                onRefresh={onRefresh}
              />
            ) : (
              resourceCatalog
            )}
          </div>
        </Modal>
      )}
      <footer className="workbench-footer">
        {!chat
          ? 'Selecione um cliente para inserir ou enviar respostas.'
          : !connected
            ? 'WhatsApp desconectado · prévias e rascunhos continuam disponíveis.'
            : 'Prévia e envio conforme Personalizar Atendimento.'}
      </footer>
      {preview && (
        <Modal
          title={preview.name}
          onClose={() => {
            if (!busy) setPreview(null);
          }}
          wide
        >
          <div className="resource-full-preview">
            {preview.asset && <AssetPreview asset={preview.asset} name={chat?.contact.name} />}
            {preview.funnel && (
              <>
                <p>Confira a sequência antes de iniciar.</p>
                <ol className="resource-funnel-steps">
                  {preview.funnel.items.map((step, index) => (
                    <li key={`${step.assetId}:${index}`}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{step.asset.name}</strong>
                        <small>
                          Espera de {(step.delayBeforeSendMs / 1000).toLocaleString('pt-BR')}s antes desta
                          etapa · {step.asset.kind}
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          const asset = library.assets.find((item) => item.id === step.assetId);
                          if (asset)
                            openPreview({
                              id: asset.id,
                              name: asset.name,
                              kind: asset.kind,
                              excerpt: asset.text ?? '',
                              asset,
                            });
                        }}
                      >
                        Prévia
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {preview.macro && (
              <>
                <p>
                  {preview.macro._count.actions} ações combinadas. Esta macro pode enviar conteúdos e alterar
                  etiquetas ou informações do atendimento.
                </p>
                <button className="button" onClick={() => setMacroEditor(preview.id)}>
                  Revisar ações no editor
                </button>
              </>
            )}
            {preview.flow && (
              <>
                <p>
                  Este fluxo usa a versão publicada e pode enviar mensagens, aplicar etiquetas e aguardar
                  respostas.
                </p>
                <p className="notice">
                  {preview.flow.enabled && preview.flow.published
                    ? 'Fluxo ativo. Confirme para iniciar neste cliente.'
                    : 'Ative e publique este fluxo em Autoatendimento antes de iniciar.'}
                </p>
              </>
            )}
            {preview.pix && <p>{preview.pix.value}</p>}
          </div>
          {sendError && (
            <p className="field-error" role="alert">
              {sendError}
            </p>
          )}
          {activeRun && (preview.funnel || preview.macro) && (
            <p className="notice">Já existe uma sequência em andamento ou pausada nesta conversa.</p>
          )}
          <div className="modal-actions">
            <button className="button" disabled={busy} onClick={() => setPreview(null)}>
              Fechar
            </button>
            {preview.kind === 'MESSAGE' && (
              <button
                className="button"
                disabled={!chat || busy}
                onClick={() => {
                  insert(preview);
                  setPreview(null);
                }}
              >
                Inserir no rascunho
              </button>
            )}
            {preview.kind !== 'PIX' && (
              <button
                className="button primary"
                disabled={
                  busy ||
                  !chat ||
                  !connected ||
                  Boolean(preview.flow && (!preview.flow.enabled || !preview.flow.published)) ||
                  Boolean(activeRun && (preview.funnel || preview.macro))
                }
                onClick={() => void send()}
              >
                {busy ? (
                  <Spinner />
                ) : preview.funnel || preview.macro ? (
                  <Play size={15} />
                ) : (
                  <Send size={15} />
                )}
                {preview.flow || preview.funnel || preview.macro
                  ? 'Confirmar início da sequência'
                  : `Enviar para ${chat?.contact.name ?? 'cliente'}`}
              </button>
            )}
          </div>
        </Modal>
      )}
      {assetEditor && (
        <AssetEditor
          initial={assetEditor.asset}
          kind={assetEditor.kind}
          onClose={() => setAssetEditor(null)}
          onSaved={saved}
        />
      )}
      {funnelEditor && (
        <FunnelEditor
          initial={funnelEditor === 'new' ? undefined : funnelEditor}
          library={library}
          onClose={() => setFunnelEditor(null)}
          onSaved={saved}
        />
      )}
      {macroEditor && (
        <MacroEditor
          initialId={macroEditor === 'new' ? undefined : macroEditor}
          sessionId={sessionId}
          library={library}
          onClose={() => setMacroEditor(null)}
          onSaved={saved}
        />
      )}
      {pixEditor && <PixEditor onClose={() => setPixEditor(false)} onSaved={saved} />}
      {pixSend && chat && (
        <PixModal
          initialKeyId={pixInitial}
          library={library}
          base={base}
          onClose={() => setPixSend(false)}
          onSent={onRefresh}
        />
      )}
      {pixSend && !chat && (
        <Modal title="Selecione um cliente" onClose={() => setPixSend(false)}>
          <p>Abra uma conversa para preparar o envio da chave PIX.</p>
        </Modal>
      )}
      {categoriesOpen && <LibraryCategories library={library} onClose={() => setCategoriesOpen(false)} />}
      {organize && (
        <Modal title="Organizar Biblioteca do Atendimento" onClose={() => setOrganize(false)} wide>
          <h3>Ordem dos tipos de recurso</h3>
          <ReorderList
            label="Ordem dos tipos"
            items={draftFolders.map((id) => ({
              id,
              name: preferences.folderLabels[id] || libraryFolders.find((item) => item[0] === id)?.[1] || id,
            }))}
            onChange={setDraftFolders}
          />
          <h3>Ordem dos recursos</h3>
          <p className="muted">
            A ordem personalizada é usada em “Todos”. Favoritos, recentes e mais usados continuam disponíveis.
          </p>
          <ReorderList
            label="Ordem dos recursos"
            items={draftOrder.map((id) => ({
              id,
              name: resources.find((item) => item.id === id)?.name ?? id,
            }))}
            onChange={setDraftOrder}
          />
          <div className="modal-actions">
            <button className="button" onClick={() => setOrganize(false)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void savePreferences({ workbenchResourceOrder: draftOrder, folderOrder: draftFolders })
                  .then(() => {
                    setOrganize(false);
                    notify('Organização salva.');
                  })
                  .catch((error) => notify(errorMessage(error), true))
                  .finally(() => setBusy(false));
              }}
            >
              Confirmar organização
            </button>
          </div>
        </Modal>
      )}
      {removing && (
        <Modal title="Excluir recurso" onClose={() => setRemoving(null)}>
          <p>Excluir “{removing.name}” da Biblioteca?</p>
          <div className="modal-actions">
            <button className="button" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void request(`/attendance/assets/${encodeURIComponent(removing.id)}`, 'DELETE')
                  .then(async () => {
                    setRemoving(null);
                    await onLibraryRefresh();
                  })
                  .catch((error) => notify(errorMessage(error), true))
                  .finally(() => setBusy(false));
              }}
            >
              Excluir recurso
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
}
