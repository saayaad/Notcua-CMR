import type { FlowSummary } from './flows/flow.types';
import { CampaignMedia } from '../components/CampaignMedia';
import { HistoryExport } from '../components/HistoryExport';
import type { Asset } from '../types';
import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Upload,
  Users,
  Send,
  Clock3,
  Search,
  RefreshCw,
  Pause,
  Play,
  Square,
  ArrowRight,
  MessageSquare,
  Wifi,
} from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Conversation, Label, Library } from '../types';
import { Modal, Spinner } from '../components/ui';
import { fileBase64 } from '../components/Composer';
import './operations.css';
export function OverviewPage({
  sessionId,
  onNavigate,
}: {
  sessionId: string;
  onNavigate: (view: 'inbox' | 'campaigns' | 'contacts' | 'flows') => void;
}) {
  const { request, notify } = useApi();
  const [metrics, setMetrics] = useState<{
    people: number;
    messages: number;
    waiting: number;
    ai: { todayTokens: number };
    batches: { status: string; _count: number }[];
  } | null>(null);
  useEffect(() => {
    if (sessionId)
      void request<typeof metrics>(`/operations/sessions/${sessionId}/overview`)
        .then(setMetrics)
        .catch((error) => notify(errorMessage(error), true));
  }, [sessionId, request, notify]);
  return (
    <main className="workspace-page operations-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CADA CONVERSA CONTA</p>
          <h1>Uma visão da sua operação</h1>
          <p>Acompanhe o movimento e escolha seu próximo passo.</p>
        </div>
      </div>
      <div className="operation-metrics">
        {[
          { title: 'Contatos', value: metrics?.people ?? 0, icon: Users },
          { title: 'Mensagens enviadas', value: metrics?.messages ?? 0, icon: Send },
          { title: 'Conversas não lidas', value: metrics?.waiting ?? 0, icon: MessageSquare },
          { title: 'Tokens de IA hoje · operação', value: metrics?.ai.todayTokens ?? 0, icon: MessageSquare },
          {
            title: 'Envios pendentes',
            value: metrics?.batches.find((row) => row.status === 'QUEUED')?._count ?? 0,
            icon: Clock3,
          },
        ].map(({ title, value, icon: Icon }) => (
          <article className="surface" key={title}>
            <Icon size={21} />
            <strong>{value}</strong>
            <span>{title}</span>
          </article>
        ))}
      </div>
      <div className="operation-launchers">
        {[
          {
            title: 'Continuar um atendimento',
            text: 'Retome suas conversas e mantenha o contato próximo.',
            view: 'inbox' as const,
            icon: MessageSquare,
          },
          {
            title: 'Organizar meus contatos',
            text: 'Importe uma planilha, revise os dados e segmente por etiquetas.',
            view: 'contacts' as const,
            icon: Users,
          },
          {
            title: 'Preparar uma campanha',
            text: 'Escolha o público, o conteúdo e o melhor momento.',
            view: 'campaigns' as const,
            icon: Send,
          },
          {
            title: 'Desenhar um autoatendimento',
            text: 'Monte o caminho e simule antes de ativar.',
            view: 'flows' as const,
            icon: Wifi,
          },
        ].map(({ title, text, view, icon: Icon }) => (
          <button key={view} className="surface operation-launcher" onClick={() => onNavigate(view)}>
            <Icon size={24} />
            <h2>{title}</h2>
            <p>{text}</p>
            <span>
              Abrir
              <ArrowRight size={15} />
            </span>
          </button>
        ))}
      </div>
      {!sessionId && <p className="notice">Selecione ou crie uma conexão para visualizar seus dados.</p>}
    </main>
  );
}
interface Lead {
  name: string;
  phoneNumber: string;
  tags: string[];
  email: string;
  optIn: boolean;
}
interface ImportPreview {
  headers: string[];
  phoneColumn: number;
  nameColumn: number;
  items: Lead[];
  rejected: { row: number; reason: string }[];
  total: number;
  inferred: boolean;
}
export function ContactsPage({ sessionId, onOpen }: { sessionId: string; onOpen: (id: string) => void }) {
  const { request, notify } = useApi();
  const [rows, setRows] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tick, setTick] = useState(0);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        void request<{ items: Conversation[]; total: number }>(
          `/operations/sessions/${sessionId}/contacts?page=${page}&search=${encodeURIComponent(search)}`,
          'GET',
          undefined,
          controller.signal,
        )
          .then((data) => {
            setRows(data.items);
            setTotal(data.total);
          })
          .catch((error) => {
            if (!controller.signal.aborted) notify(errorMessage(error), true);
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sessionId, page, search, tick, request, notify]);
  return (
    <main className="workspace-page operations-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RELACIONAMENTOS ORGANIZADOS</p>
          <h1>Contatos</h1>
          <p>Uma base para conversar, segmentar e acompanhar.</p>
        </div>
        <div className="operation-actions">
          <button className="button" disabled={!sessionId} onClick={() => setImporting(true)}>
            <Upload size={16} />
            Importar Excel / CSV
          </button>
          <button className="button" disabled={!sessionId} onClick={() => setExporting(true)}>
            Exportar históricos
          </button>
          <button className="button primary" disabled={!sessionId} onClick={() => setCreating(true)}>
            <Plus size={16} />
            Novo contato
          </button>
        </div>
      </div>
      <label className="search-box library-search">
        <Search size={17} />
        <input
          aria-label="Buscar contatos"
          placeholder="Buscar nome ou telefone"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </label>
      <p className="muted">{total} contatos nesta conexão</p>
      <div className="contacts-table">
        {rows.map((chat) => (
          <button key={chat.id} onClick={() => onOpen(chat.id)}>
            <div>
              <strong>{chat.contact.name}</strong>
              <small>+{chat.contact.phoneNumber}</small>
            </div>
            <div className="tags-wrap">
              {chat.contact.labels.map(({ label }) => (
                <span className="tag" key={label.id} style={{ color: label.color }}>
                  {label.name}
                </span>
              ))}
            </div>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      <div className="operation-actions">
        <button className="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>Página {page}</span>
        <button className="button" disabled={page * 100 >= total} onClick={() => setPage(page + 1)}>
          Próxima
        </button>
      </div>
      {!rows.length && <p className="operation-empty">Nenhum contato encontrado.</p>}
      {importing && (
        <LeadImport
          sessionId={sessionId}
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            setTick(tick + 1);
          }}
        />
      )}
      {exporting && <HistoryExport sessionId={sessionId} onClose={() => setExporting(false)} />}
      {creating && (
        <Modal title="Novo contato" onClose={() => setCreating(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = Object.fromEntries(new FormData(event.currentTarget));
              setBusy(true);
              void request(`/operations/sessions/${sessionId}/contacts`, 'POST', {
                ...data,
                tags: [],
                optIn: false,
                email: data.email || '',
              })
                .then(() => {
                  setCreating(false);
                  setTick(tick + 1);
                })
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Nome
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Telefone com DDI e DDD
              <input name="phoneNumber" required pattern="[0-9]{8,15}" placeholder="5511999999999" />
            </label>
            <label>
              E-mail
              <input name="email" type="email" />
            </label>
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setCreating(false)}>
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                Criar contato
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
function LeadImport({
  sessionId,
  onClose,
  onImported,
}: {
  sessionId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const { request, notify } = useApi();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [countryCode, setCountryCode] = useState('55');
  const [areaCode, setAreaCode] = useState('');
  const [listName, setListName] = useState('');
  const inspect = async (phoneColumn?: number, nameColumn?: number) => {
    if (!file) return;
    setBusy(true);
    try {
      setPreview(
        await request<ImportPreview>('/operations/contacts/import/preview', 'POST', {
          filename: file.name,
          base64: await fileBase64(file),
          countryCode,
          areaCode,
          phoneColumn,
          nameColumn,
        }),
      );
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Importar contatos de uma planilha" onClose={onClose} wide>
      <p className="muted">
        Leia a prévia e confira as colunas antes de importar. Nenhuma mensagem será enviada.
      </p>
      <label className="file-upload">
        <Upload size={22} />
        {file?.name ?? 'Escolher .xlsx ou .csv de até 10 MiB'}
        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={busy}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen && chosen.size <= 10 * 1024 * 1024) {
              setFile(chosen);
              setListName(chosen.name.replace(/\.(xlsx|csv)$/i, '').slice(0, 100));
              setPreview(null);
            } else notify('Escolha um arquivo de até 10 MiB.', true);
          }}
        />
      </label>
      <label>
        DDI padrão
        <input
          value={countryCode}
          maxLength={3}
          onChange={(event) => {
            setCountryCode(event.target.value.replace(/\D/g, ''));
            setPreview(null);
          }}
        />
      </label>
      <button className="button" disabled={!file || busy} onClick={() => void inspect()}>
        {busy ? <Spinner /> : <Search size={15} />}Ler planilha
      </button>
      <label>
        DDD padrão para números locais (opcional)
        <input
          value={areaCode}
          maxLength={2}
          placeholder="Ex.: 11"
          onChange={(event) => {
            setAreaCode(event.target.value.replace(/\D/g, ''));
            setPreview(null);
          }}
        />
      </label>
      <label>
        Nome da lista de contatos
        <input
          value={listName}
          maxLength={100}
          onChange={(event) => setListName(event.target.value)}
          placeholder="Ex.: Leads de outubro"
        />
        <small>A lista ficará disponível no público das campanhas.</small>
      </label>
      {preview && (
        <>
          <div className="form-grid">
            <label>
              Coluna do telefone
              <select
                disabled={busy}
                value={preview.phoneColumn}
                onChange={(event) => void inspect(Number(event.target.value), preview.nameColumn)}
              >
                {preview.headers.map((header, index) => (
                  <option key={index} value={index}>
                    {header || `Coluna ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Coluna do nome
              <select
                disabled={busy}
                value={preview.nameColumn}
                onChange={(event) => void inspect(preview.phoneColumn, Number(event.target.value))}
              >
                {preview.headers.map((header, index) => (
                  <option key={index} value={index}>
                    {header || `Coluna ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="notice">
            {preview.items.length} contatos válidos · {preview.rejected.length} linhas ignoradas
            {preview.inferred ? ' · colunas inferidas: confira o mapeamento acima' : ''}
          </p>
          <div className="import-preview">
            {preview.items.slice(0, 50).map((lead) => (
              <div key={lead.phoneNumber}>
                <strong>{lead.name}</strong>
                <span>+{lead.phoneNumber}</span>
                <small>{lead.tags.join(' · ')}</small>
              </div>
            ))}
          </div>
          {preview.items.length > 50 && (
            <small className="muted">Mostrando os primeiros 50 contatos da prévia.</small>
          )}
          {preview.rejected.length > 0 && (
            <details>
              <summary>Ver linhas ignoradas</summary>
              {preview.rejected.slice(0, 50).map((row, index) => (
                <p key={index}>
                  Linha {row.row}: {row.reason}
                </p>
              ))}
            </details>
          )}
          <label>
            Etiqueta adicional para este lote
            <input
              value={tag}
              maxLength={80}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Ex.: Leads outubro"
            />
          </label>
        </>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={!preview?.items.length || busy}
          onClick={() => {
            setBusy(true);
            void request<{ imported: number }>(`/operations/sessions/${sessionId}/contacts/import`, 'POST', {
              items: preview!.items,
              extraTag: tag,
              listName,
            })
              .then((data) => {
                notify(`${data.imported} contatos importados. Nenhuma mensagem enviada.`);
                onImported();
              })
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        >
          Importar {preview?.items.length ?? 0} contatos
        </button>
      </div>
    </Modal>
  );
}
interface BatchRow {
  id: string;
  name: string;
  mode: string;
  status: string;
  count: number;
  createdAt: string;
  counts: { status: string; _count: number }[];
}
const batchStatus: Record<string, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo / agendado',
  PAUSED: 'Pausado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Concluído',
};
export function CampaignsPage({
  sessionId,
  library,
  schedule = false,
  initialConversation,
  onClose,
}: {
  sessionId: string;
  library: Library;
  schedule?: boolean;
  initialConversation?: Conversation;
  onClose?: () => void;
}) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<BatchRow[]>([]);
  const [tick, setTick] = useState(0);
  const [create, setCreate] = useState(Boolean(initialConversation));
  const [activate, setActivate] = useState<BatchRow | null>(null);
  const [tasks, setTasks] = useState<{ status: string; error?: string; runAt: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    void request<{ items: BatchRow[] }>(
      `/operations/sessions/${sessionId}/batches`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) =>
        setItems(
          data.items.filter((item) => (schedule ? item.mode !== 'CAMPAIGN' : item.mode === 'CAMPAIGN')),
        ),
      )
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [sessionId, tick, schedule, request, notify]);
  const change = (item: BatchRow, status: string) => {
    setBusy(true);
    void request(`/operations/sessions/${sessionId}/batches/${item.id}`, 'PUT', { status })
      .then(() => {
        setActivate(null);
        setTick(tick + 1);
      })
      .catch((error) => notify(errorMessage(error), true))
      .finally(() => setBusy(false));
  };
  if (initialConversation)
    return (
      <BatchEditor
        sessionId={sessionId}
        library={library}
        schedule
        initialConversation={initialConversation}
        onClose={onClose!}
        onSaved={() => {
          notify('Agendamento salvo como rascunho. Ative na Agenda para confirmar o envio.');
          onClose?.();
        }}
      />
    );
  return (
    <main className="workspace-page operations-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{schedule ? 'NO MOMENTO CERTO' : 'MENSAGENS COM PROPÓSITO'}</p>
          <h1>{schedule ? 'Agenda e lembretes' : 'Campanhas'}</h1>
          <p>
            {schedule
              ? 'Mensagens individuais e lembretes salvos no servidor.'
              : 'Segmente por etiquetas e inatividade, revise e ative quando estiver pronto.'}
          </p>
        </div>
        <div className="operation-actions">
          <button className="icon-button" aria-label="Atualizar envios" onClick={() => setTick(tick + 1)}>
            <RefreshCw size={17} />
          </button>
          <button className="button primary" disabled={!sessionId} onClick={() => setCreate(true)}>
            <Plus size={16} />
            {schedule ? 'Novo agendamento' : 'Nova campanha'}
          </button>
        </div>
      </div>
      <div className="batch-list">
        {items.map((item) => (
          <article className="surface" key={item.id}>
            <div>
              <span className={`flow-status ${item.status === 'ACTIVE' ? 'enabled' : ''}`}>
                {batchStatus[item.status]}
              </span>
              <h2>{item.name}</h2>
              <p>
                {item.count} contatos · {item.counts.find((row) => row.status === 'COMPLETED')?._count ?? 0}{' '}
                encaminhados · {item.counts.find((row) => row.status === 'FAILED')?._count ?? 0} falhas
              </p>
              <small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small>
            </div>
            <div className="operation-actions">
              <button
                className="button"
                onClick={() =>
                  void request<{ items: NonNullable<typeof tasks> }>(
                    `/operations/sessions/${sessionId}/batches/${item.id}/tasks`,
                  )
                    .then((data) => setTasks(data.items))
                    .catch((error) => notify(errorMessage(error), true))
                }
              >
                Ver envios
              </button>
              {['DRAFT', 'PAUSED'].includes(item.status) && (
                <button className="button primary" disabled={busy} onClick={() => setActivate(item)}>
                  <Play size={14} />
                  Ativar
                </button>
              )}
              {item.status === 'ACTIVE' && (
                <button className="button" disabled={busy} onClick={() => change(item, 'PAUSED')}>
                  <Pause size={14} />
                  Pausar
                </button>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(item.status) && (
                <button className="button" disabled={busy} onClick={() => change(item, 'CANCELLED')}>
                  <Square size={13} />
                  Cancelar
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <div className="operation-empty">
          <Send size={36} />
          <h2>{schedule ? 'Sua agenda está livre' : 'Prepare sua primeira campanha'}</h2>
          <p>Os envios começam somente depois da ativação.</p>
        </div>
      )}
      {create && (
        <BatchEditor
          sessionId={sessionId}
          library={library}
          schedule={schedule}
          onClose={() => setCreate(false)}
          onSaved={() => {
            setCreate(false);
            setTick(tick + 1);
          }}
        />
      )}
      {activate && (
        <Modal title="Confirmar ativação" onClose={() => setActivate(null)}>
          <p>
            <strong>{activate.name}</strong> será ativado para {activate.count} contatos. Os envios vencidos
            começam assim que o WhatsApp estiver conectado.
          </p>
          <p className="muted">
            Pausar ou cancelar impede as próximas etapas. Um envio que já começou pode terminar.
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setActivate(null)}>
              Voltar
            </button>
            <button className="button primary" disabled={busy} onClick={() => change(activate, 'ACTIVE')}>
              Confirmar ativação
            </button>
          </div>
        </Modal>
      )}
      {tasks && (
        <Modal title="Envios desta execução" onClose={() => setTasks(null)}>
          <div className="task-list">
            {tasks.map((task, index) => (
              <div key={index}>
                <strong>
                  {task.status === 'COMPLETED'
                    ? 'Encaminhado'
                    : task.status === 'QUEUED'
                      ? 'Aguardando'
                      : task.status === 'FAILED'
                        ? 'Falha'
                        : task.status === 'CANCELLED'
                          ? 'Cancelado'
                          : 'Executando'}
                </strong>
                <small>{new Date(task.runAt).toLocaleString('pt-BR')}</small>
                {task.error && <p className="field-error">{task.error}</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
function BatchEditor({
  sessionId,
  library,
  schedule,
  initialConversation,
  onClose,
  onSaved,
}: {
  sessionId: string;
  library: Library;
  schedule: boolean;
  initialConversation?: Conversation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, notify } = useApi();
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [people, setPeople] = useState<Conversation[]>(initialConversation ? [initialConversation] : []);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [labelId, setLabelId] = useState('');
  const [match, setMatch] = useState('AND');
  const [extraAssets, setExtraAssets] = useState<Asset[]>([]);
  const [listIds, setListIds] = useState<string[]>([]);
  const [listId, setListId] = useState('');
  const [lists, setLists] = useState<{ id: string; name: string; count: number }[]>([]);
  const [steps, setSteps] = useState<
    { id: string; kind: string; text: string; assetId: string; waitSeconds: number }[]
  >([{ id: crypto.randomUUID(), kind: 'text', text: '', assetId: '', waitSeconds: 1 }]);
  const [days, setDays] = useState(0);
  const [conversationId, setConversationId] = useState(initialConversation?.id ?? '');
  const [contactQuery, setContactQuery] = useState('');
  const [kind, setKind] = useState('text');
  const [preview, setPreview] = useState<{
    count: number;
    items: { id: string; name: string; phoneNumber: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void request<{ items: typeof lists }>(`/operations/sessions/${sessionId}/lead-lists`)
      .then((result) => setLists(result.items))
      .catch((error) => notify(errorMessage(error), true));
    void request<{ items: FlowSummary[] }>('/automation/sessions/' + sessionId + '/flows')
      .then((data) => setFlows(data.items.filter((item) => item.enabled)))
      .catch((error) => notify(errorMessage(error), true));
    void request<{ items: Label[] }>(`/whatsapp/sessions/${sessionId}/labels`)
      .then((data) => setLabels(data.items))
      .catch((error) => notify(errorMessage(error), true));
    if (schedule && !initialConversation)
      void request<{ items: Conversation[] }>(`/operations/sessions/${sessionId}/contacts`)
        .then((data) => setPeople(data.items))
        .catch((error) => notify(errorMessage(error), true));
  }, [sessionId, schedule, initialConversation, request, notify]);
  const audience = {
    labelId,
    labelIds,
    match,
    listId,
    listIds,
    inactiveDays: days,
    conversationIds: schedule && conversationId ? [conversationId] : [],
  };
  return (
    <Modal
      title={schedule ? 'Agendar mensagem ou lembrete' : 'Nova campanha segmentada'}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!preview) return;
          const data = new FormData(event.currentTarget);
          setBusy(true);
          void request(`/operations/sessions/${sessionId}/batches`, 'POST', {
            name: data.get('name'),
            mode: kind === 'reminder' ? 'REMINDER' : schedule ? 'SCHEDULE' : 'CAMPAIGN',
            audience: { conversationIds: preview.items.map((item) => item.id) },
            delivery: {
              kind,
              steps:
                kind === 'sequence'
                  ? steps.map((step) => ({
                      kind: step.kind,
                      waitSeconds: step.waitSeconds,
                      text: step.kind === 'text' ? step.text : undefined,
                      assetId: step.kind === 'asset' ? step.assetId : undefined,
                    }))
                  : undefined,
              text: data.get('text') || undefined,
              assetId: data.get('assetId') || undefined,
              funnelId: data.get('funnelId') || undefined,
              flowId: data.get('flowId') || undefined,
            },
            minSeconds: Number(data.get('minSeconds') || 15),
            maxSeconds: Number(data.get('maxSeconds') || 45),
            pauseEvery: Number(data.get('pauseEvery') || 0),
            pauseSeconds: Number(data.get('pauseSeconds') || 0),
            runAt: data.get('runAt') ? new Date(String(data.get('runAt'))).toISOString() : undefined,
          })
            .then(onSaved)
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Nome
          <input
            name="name"
            required
            maxLength={100}
            placeholder={schedule ? 'Ex.: Retorno do orçamento' : 'Ex.: Remarketing de outubro'}
          />
        </label>
        {schedule ? (
          <label className="contact-combobox-label">
            Contato
            <input type="hidden" name="conversationId" value={conversationId} />
            <input
              autoComplete="off"
              role="combobox"
              aria-expanded={Boolean(contactQuery)}
              aria-controls="scheduled-contact-options"
              placeholder="Busque por nome ou telefone"
              value={contactQuery || people.find((item) => item.id === conversationId)?.contact.name || ''}
              onChange={(event) => {
                setContactQuery(event.target.value);
                setConversationId('');
                setPreview(null);
              }}
              onFocus={() =>
                setContactQuery(people.find((item) => item.id === conversationId)?.contact.name ?? '')
              }
            />
            {contactQuery && (
              <div id="scheduled-contact-options" className="contact-combobox-options" role="listbox">
                {people
                  .filter((item) => {
                    const q = contactQuery.toLocaleLowerCase();
                    const digits = q.replace(/\D/g, '').replace(/^55/, '');
                    return (
                      item.contact.name.toLocaleLowerCase().includes(q) ||
                      item.contact.phoneNumber.includes(q.replace(/\D/g, '')) ||
                      item.contact.phoneNumber.endsWith(digits)
                    );
                  })
                  .slice(0, 25)
                  .map((item) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={conversationId === item.id}
                      key={item.id}
                      onClick={() => {
                        setConversationId(item.id);
                        setContactQuery('');
                        setPreview(null);
                      }}
                    >
                      <span className="schedule-avatar">
                        {item.contact.profilePicture ? (
                          <img src={item.contact.profilePicture} alt="" />
                        ) : (
                          item.contact.name
                            .trim()
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join('')
                            .toUpperCase()
                        )}
                      </span>
                      <span>
                        <strong>{item.contact.name}</strong>
                        <small>
                          +
                          {item.contact.phoneNumber.replace(
                            /^(\d{2})(\d{2})(\d{4,5})(\d{4})$/,
                            '+$1 ($2) $3-$4',
                          )}
                        </small>
                      </span>
                    </button>
                  ))}
                {!people.some((item) => {
                  const q = contactQuery.toLocaleLowerCase();
                  return (
                    item.contact.name.toLocaleLowerCase().includes(q) ||
                    item.contact.phoneNumber.includes(q.replace(/\D/g, ''))
                  );
                }) && <p>Nenhum contato encontrado nesta conexão.</p>}
              </div>
            )}
            <small className="muted">Busque por nome ou por qualquer parte do telefone.</small>
          </label>
        ) : (
          <div className="form-grid">
            <fieldset className="audience-multiselect">
              <legend>Listas importadas</legend>
              <p className="muted">Nenhuma selecionada inclui todos os contatos compatíveis.</p>
              {lists.map((list) => (
                <label key={list.id}>
                  <input
                    type="checkbox"
                    checked={listIds.includes(list.id)}
                    onChange={(event) => {
                      setListIds((current) =>
                        event.target.checked ? [...current, list.id] : current.filter((id) => id !== list.id),
                      );
                      setPreview(null);
                    }}
                  />
                  {list.name} · {list.count}
                </label>
              ))}
            </fieldset>
            <label>
              Combinar etiqueta e inatividade
              <select
                value={match}
                onChange={(event) => {
                  setMatch(event.target.value);
                  setPreview(null);
                }}
              >
                <option value="AND">E · atender aos dois filtros</option>
                <option value="OR">OU · atender a qualquer filtro</option>
              </select>
            </label>
            <fieldset className="audience-multiselect">
              <legend>Etiquetas</legend>
              <p className="muted">Contatos com qualquer etiqueta selecionada.</p>
              {labels.map((label) => (
                <label key={label.id}>
                  <input
                    type="checkbox"
                    checked={labelIds.includes(label.id)}
                    onChange={(event) => {
                      setLabelIds((current) =>
                        event.target.checked
                          ? [...current, label.id]
                          : current.filter((id) => id !== label.id),
                      );
                      setPreview(null);
                    }}
                  />
                  <i style={{ background: label.color }} />
                  {label.name}
                </label>
              ))}
            </fieldset>
            <label>
              Sem interação há pelo menos (dias)
              <input
                type="number"
                value={days}
                min={0}
                max={3650}
                onChange={(event) => {
                  setDays(Number(event.target.value));
                  setPreview(null);
                }}
              />
            </label>
          </div>
        )}
        <label>
          Conteúdo
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="text">Mensagem de texto</option>
            <option value="sequence">Sequência de textos e mídias</option>
            <option value="asset">Recurso da biblioteca</option>
            <option value="funnel">Funil de atendimento</option>
            <option value="flow">Fluxo de autoatendimento</option>
            {schedule && <option value="reminder">Lembrete interno · sem envio ao cliente</option>}
          </select>
        </label>
        {kind === 'sequence' ? (
          <div className="surface">
            <p className="muted">
              As mensagens serão enviadas na ordem abaixo. Use {'{{nome}}'} e {'{{saudacao}}'} nos textos.
            </p>
            {steps.map((step, index) => (
              <section className="surface" key={step.id}>
                <div className="form-grid">
                  <label>
                    Etapa {index + 1}
                    <select
                      value={step.kind}
                      onChange={(event) =>
                        setSteps((current) =>
                          current.map((item) =>
                            item.id === step.id ? { ...item, kind: event.target.value } : item,
                          ),
                        )
                      }
                    >
                      <option value="text">Texto</option>
                      <option value="asset">Áudio, imagem, vídeo ou recurso</option>
                    </select>
                  </label>
                  <label>
                    Espera antes da etapa (s)
                    <input
                      type="number"
                      min={0}
                      max={86400}
                      value={step.waitSeconds}
                      onChange={(event) =>
                        setSteps((current) =>
                          current.map((item) =>
                            item.id === step.id ? { ...item, waitSeconds: Number(event.target.value) } : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                {step.kind === 'text' ? (
                  <label>
                    Mensagem
                    <textarea
                      required
                      maxLength={10000}
                      value={step.text}
                      onChange={(event) =>
                        setSteps((current) =>
                          current.map((item) =>
                            item.id === step.id ? { ...item, text: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                ) : (
                  <label>
                    Recurso da biblioteca
                    <select
                      required
                      value={step.assetId}
                      onChange={(event) =>
                        setSteps((current) =>
                          current.map((item) =>
                            item.id === step.id ? { ...item, assetId: event.target.value } : item,
                          ),
                        )
                      }
                    >
                      <option value="">Selecione</option>
                      {[...library.assets, ...extraAssets].map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="modal-actions">
                  <button
                    className="button small"
                    type="button"
                    disabled={!index}
                    onClick={() =>
                      setSteps((current) => {
                        const next = [...current];
                        [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                        return next;
                      })
                    }
                  >
                    Subir
                  </button>
                  <button
                    className="button small"
                    type="button"
                    disabled={index === steps.length - 1}
                    onClick={() =>
                      setSteps((current) => {
                        const next = [...current];
                        [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
                        return next;
                      })
                    }
                  >
                    Descer
                  </button>
                  <button
                    className="button small"
                    type="button"
                    disabled={steps.length === 1}
                    onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))}
                  >
                    Remover
                  </button>
                </div>
              </section>
            ))}
            {steps.length < 30 && (
              <CampaignMedia
                onCreated={(asset) => {
                  setExtraAssets((current) => [...current, asset]);
                  setSteps((current) => [
                    ...current,
                    { id: crypto.randomUUID(), kind: 'asset', text: '', assetId: asset.id, waitSeconds: 1 },
                  ]);
                }}
              />
            )}
            <button
              type="button"
              className="button"
              disabled={steps.length >= 30}
              onClick={() =>
                setSteps((current) => [
                  ...current,
                  { id: crypto.randomUUID(), kind: 'text', text: '', assetId: '', waitSeconds: 1 },
                ])
              }
            >
              Adicionar mensagem
            </button>
          </div>
        ) : ['text', 'reminder'].includes(kind) ? (
          <label>
            {kind === 'reminder' ? 'Texto do lembrete' : 'Mensagem'}
            <textarea
              name="text"
              rows={4}
              required
              maxLength={10000}
              placeholder="Use {{nome}} e {{saudacao}} para personalizar"
            />
          </label>
        ) : kind === 'asset' ? (
          <label>
            Recurso
            <select name="assetId" required>
              <option value="">Selecione</option>
              {library.assets.map((asset) => (
                <option value={asset.id} key={asset.id}>
                  {asset.kind === 'MESSAGE'
                    ? 'Texto'
                    : asset.kind === 'AUDIO'
                      ? 'Áudio'
                      : asset.kind === 'DOCUMENT'
                        ? 'Documento'
                        : 'Mídia'}{' '}
                  · {asset.name}
                </option>
              ))}
            </select>
          </label>
        ) : kind === 'flow' ? (
          <label>
            Fluxo ativo
            <select name="flowId" required>
              <option value="">Selecione</option>
              {flows.map((flow) => (
                <option value={flow.id} key={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
            <small className="muted">Usa a versão publicada no momento em que iniciar.</small>
          </label>
        ) : (
          <label>
            Funil
            <select name="funnelId" required>
              <option value="">Selecione</option>
              {library.funnels.map((funnel) => (
                <option value={funnel.id} key={funnel.id}>
                  {funnel.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {schedule ? 'Data e hora' : 'Agendar início (opcional)'}
          <input name="runAt" type="datetime-local" required={schedule} />
          <small className="muted">
            Horário local do seu navegador. O envio também depende do servidor e do WhatsApp conectados.
          </small>
        </label>
        {!schedule && (
          <>
            <div className="form-grid">
              <label>
                Intervalo mínimo (s)
                <input name="minSeconds" type="number" min={1} max={86400} defaultValue={15} required />
              </label>
              <label>
                Intervalo máximo (s)
                <input name="maxSeconds" type="number" min={1} max={86400} defaultValue={45} required />
              </label>
            </div>
            <p className="muted">Intervalos variáveis não garantem proteção contra bloqueios.</p>
            <div className="form-grid">
              <label>
                Pausa longa a cada quantas mensagens?{' '}
                <input name="pauseEvery" type="number" min={0} max={5000} defaultValue={0} />
                <small>0 desativa a pausa por lote.</small>
              </label>
              <label>
                Duração da pausa longa (s)
                <input name="pauseSeconds" type="number" min={0} max={86400} defaultValue={300} />
              </label>
            </div>
          </>
        )}
        <button
          type="button"
          className="button"
          disabled={busy || (schedule && !conversationId)}
          onClick={() => {
            setBusy(true);
            void request<NonNullable<typeof preview>>(
              `/operations/sessions/${sessionId}/audience`,
              'POST',
              audience,
            )
              .then(setPreview)
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        >
          <Users size={15} />
          Conferir público
        </button>
        {preview && (
          <div className="audience-preview">
            <strong>{preview.count} contatos na seleção</strong>
            {preview.items.slice(0, 15).map((item) => (
              <span key={item.id}>
                {item.name} · +{item.phoneNumber}
              </span>
            ))}
            {preview.count > 15 && <small>Mais {preview.count - 15} contatos.</small>}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy || !preview?.count}>
            {busy ? <Spinner /> : <Plus size={15} />}Salvar rascunho
          </button>
        </div>
      </form>
    </Modal>
  );
}
