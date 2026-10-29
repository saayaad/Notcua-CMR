import { CampaignPhonePreview } from '../components/CampaignPhonePreview';
import { AiOnly, useAiFeatures } from '../context/AiFeatures';
import { LabelFinance } from '../components/LabelActions';
import { NumberValidation } from '../components/NumberValidation';
import { CampaignRevenue } from '../components/CampaignRevenue';
import { usePreferences } from '../context/PreferencesContext';
import { formatContactPhone, cleanContactName, cleanPhone } from '../context/contact-search';
import { ContactCombobox } from '../components/ContactCombobox';
import { Select, MultiSelect } from '../components/Select';
import type { FlowSummary } from './flows/flow.types';
import { CampaignMedia } from '../components/CampaignMedia';
import { HistoryExport } from '../components/HistoryExport';
import type { Asset } from '../types';
import { Fragment, useCallback, useEffect, useState } from 'react';
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
  const { enabled: aiEnabled } = useAiFeatures();
  const { request, notify } = useApi();
  const [metrics, setMetrics] = useState<{
    people: number;
    messages: number;
    waiting: number;
    ai: { todayTokens: number };
    batches: { status: string; _count: number }[];
    campaignFinance?: { revenueInCents: number; investmentInCents: number; sales: number; campaigns: number; roiPercent: number | null };
  } | null>(null);
  const [crmMoney, setCrmMoney] = useState<{ openValueInCents: number; wonValueInCents: number } | null>(
    null,
  );
  useEffect(() => {
    if (sessionId)
      void request<typeof metrics>(`/operations/sessions/${sessionId}/overview`)
        .then(setMetrics)
        .catch((error) => notify(errorMessage(error), true));
  }, [sessionId, request, notify]);
  useEffect(() => {
    if (!sessionId) {
      setCrmMoney(null);
      return;
    }
    const controller = new AbortController();
    void request<{ openValueInCents: number; wonValueInCents: number }>(
      `/crm/sessions/${sessionId}/metrics?days=30`,
      'GET',
      undefined,
      controller.signal,
    )
      .then(setCrmMoney)
      .catch(() => undefined);
    return () => controller.abort();
  }, [sessionId, request]);
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
          {
            title: 'Vendas ganhas · CRM',
            value: (crmMoney?.wonValueInCents ?? 0) / 100,
            icon: Send,
            currency: true,
          },
          {
            title: 'Valor em negociação · CRM',
            value: (crmMoney?.openValueInCents ?? 0) / 100,
            icon: Clock3,
            currency: true,
          },
          { title: 'Tokens de IA hoje · operação', value: metrics?.ai.todayTokens ?? 0, icon: MessageSquare },
          {
            title: 'Envios pendentes',
            value: metrics?.batches.find((row) => row.status === 'QUEUED')?._count ?? 0,
            icon: Clock3,
          },
        ].filter(item => aiEnabled || !item.title.includes('Tokens de IA')).map(({ title, value, icon: Icon, currency }) => (
          <article className="surface" key={title}>
            <Icon size={21} />
            <strong>
              {currency ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value}
            </strong>
            <span>{title}</span>
          </article>
        ))}
      </div>
      {metrics?.campaignFinance && <section className="surface">
        <h2>Campanhas com vendas vinculadas · histórico completo</h2>
        <p>{metrics.campaignFinance.sales} vendas ganhas em {metrics.campaignFinance.campaigns} campanhas · Receita: {(metrics.campaignFinance.revenueInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Investimento informado: {(metrics.campaignFinance.investmentInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        <strong>{metrics.campaignFinance.roiPercent === null ? 'Informe investimento no financeiro para calcular o retorno.' : `Retorno estimado: ${metrics.campaignFinance.roiPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}</strong>
        <small className="muted">Somente campanhas usando receita do CRM. Não representa lucro líquido e não inclui custos de produção, impostos ou outras despesas.</small>
      </section>}
      <div className="operation-launchers">
        {sessionId && <LabelFinance sessionId={sessionId}/>}
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
  sheets: string[];
  sheetIndex: number;
  phoneColumn: number;
  nameColumn: number;
  items: Lead[];
  rejected: { row: number; reason: string }[];
  total: number;
  inferred: boolean;
}
export function SpreadsheetsPage({ sessionId, onCampaign }: { sessionId: string; onCampaign: () => void }) {
  const { request, notify } = useApi();
  const [lists, setLists] = useState<{ id: string; name: string; count: number }[]>([]);
  const [importing, setImporting] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    void request<{ items: typeof lists }>(`/operations/sessions/${sessionId}/lead-lists`, 'GET', undefined, controller.signal)
      .then((result) => setLists(result.items))
      .catch((error) => { if (!controller.signal.aborted) notify(errorMessage(error), true); });
    return () => controller.abort();
  }, [sessionId, revision, request, notify]);
  return <main className="workspace-page operations-page">
    <div className="page-heading"><div><p className="eyebrow">IMPORTAÇÃO DE LEADS</p><h1>Planilhas</h1>
      <p>Importe Excel ou CSV, confira os números e use a lista em uma campanha.</p></div>
      <button className="button primary" disabled={!sessionId} onClick={() => setImporting(true)}><Upload size={16} />Adicionar planilha</button>
    </div>
    <div className="contacts-table">{lists.map((list) => <button key={list.id} onClick={onCampaign}>
      <div><strong>{list.name}</strong><small>{list.count} leads · selecione esta lista no público da campanha</small></div>
      <span>Preparar campanha</span><ArrowRight size={16} />
    </button>)}</div>
    {!lists.length && <p className="operation-empty">Nenhuma planilha importada nesta conexão.</p>}
    {importing && <LeadImport sessionId={sessionId} onClose={() => setImporting(false)} onImported={() => { setImporting(false); setRevision((value) => value + 1); }} />}
  </main>;
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
  const [sheetIndex, setSheetIndex] = useState(0);
  const inspect = async (phoneColumn?: number, nameColumn?: number, selectedSheet = sheetIndex) => {
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
          sheetIndex: selectedSheet,
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
        {file?.name ?? 'Escolher .xls, .xlsx, .csv ou .json de até 10 MiB'}
        <input
          type="file"
          accept=".xls,.xlsx,.csv,.json"
          disabled={busy}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen && chosen.size <= 10 * 1024 * 1024) {
              setFile(chosen);
              setListName((current) => current || chosen.name.replace(/\.(xls|xlsx|csv|json)$/i, '').slice(0, 100));
              setPreview(null);
              setSheetIndex(0);
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
          {(preview.sheets?.length ?? 0) > 1 && <label>Aba do arquivo
            <Select value={preview.sheetIndex} disabled={busy} onChange={(event) => { const index = Number(event.target.value); setSheetIndex(index); void inspect(undefined, undefined, index); }}>
              {preview.sheets?.map((name, index) => <option key={index} value={index}>{name}</option>)}
            </Select>
          </label>}
          <div className="form-grid">
            <label>
              Coluna do telefone
              <Select
                disabled={busy}
                value={preview.phoneColumn}
                onChange={(event) => void inspect(Number(event.target.value), preview.nameColumn)}
              >
                {preview.headers.map((header, index) => (
                  <option key={index} value={index}>
                    {header || `Coluna ${index + 1}`}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Coluna do nome
              <Select
                disabled={busy}
                value={preview.nameColumn}
                onChange={(event) => void inspect(preview.phoneColumn, Number(event.target.value))}
              >
                <option value={-1}>Usar telefone (sem coluna de nome)</option>
                {preview.headers.map((header, index) => (
                  <option key={index} value={index}>
                    {header || `Coluna ${index + 1}`}
                  </option>
                ))}
              </Select>
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
          <NumberValidation sessionId={sessionId} phoneNumbers={preview.items.map(item => item.phoneNumber)} disabled={busy} onBusyChange={setBusy} onReplace={changes => {
            const replacements = new Map(changes.map(({ from, to }) => [from, to]));
            setPreview(current => current ? { ...current, items: current.items.map(item => ({ ...item,
              phoneNumber: replacements.get(item.phoneNumber) ?? item.phoneNumber,
              name: item.name === item.phoneNumber ? replacements.get(item.phoneNumber) ?? item.name : item.name,
            })).filter((item, index, items) => items.findIndex(other => other.phoneNumber === item.phoneNumber) === index) } : null);
            notify(`${changes.length} número(s) substituído(s) pela variante confirmada no WhatsApp. Revise a prévia antes de importar.`);
          }} onRemove={numbers => {
            const excluded = new Set(numbers);
            setPreview(current => current ? { ...current, items: current.items.filter(item => !excluded.has(item.phoneNumber)) } : null);
            notify(`${numbers.length} número(s) sem conta removido(s) da prévia. Nenhum contato existente foi apagado.`);
          }}/>
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
  investmentInCents?: number;
  attributedRevenueInCents?: number;
  manualRevenueInCents?: number;
  revenueSource?: 'MANUAL' | 'CRM';
  crmSales?: number;
  approaches?: string[];
  followUpCount?: number;
  ctaKeyword?: string;
}
interface ApproachResult { index: number; text: string; assigned: number; sent: number; delivered: number; read: number; replied: number; sales: number; revenueInCents: number }
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
  initialSearch = '',
}: {
  sessionId: string;
  library: Library;
  schedule?: boolean;
  initialConversation?: Conversation;
  onClose?: () => void;
  initialSearch?: string;
}) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<BatchRow[]>([]);
  const [tick, setTick] = useState(0);
  const [create, setCreate] = useState(Boolean(initialConversation));
  const [activate, setActivate] = useState<BatchRow | null>(null);
  const [tasks, setTasks] = useState<{ status: string; error?: string; runAt: string; contact?: { name: string; phoneNumber: string } | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [financeBatch, setFinanceBatch] = useState('');
  const [finance, setFinance] = useState({ investment: '0.00', revenue: '0.00', revenueSource: 'MANUAL' as 'MANUAL' | 'CRM' });
  const [revenueBatch, setRevenueBatch] = useState('');
  const [approachReport, setApproachReport] = useState<{ name: string; items: ApproachResult[] } | null>(null);
  useEffect(() => setSearch(initialSearch), [initialSearch]);
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
          {!schedule && (
            <label className="crm-search">
              <Search size={16} />
              <input
                aria-label="Buscar campanha"
                placeholder="Buscar campanha"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          )}
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
        {items
          .filter(
            (item) =>
              !search || item.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
          )
          .map((item) => (
            <Fragment key={item.id}>
              <article className="surface">
                <div>
                  <span className={`flow-status ${item.status === 'ACTIVE' ? 'enabled' : ''}`}>
                    {batchStatus[item.status]}
                  </span>
                  <h2>{item.name}</h2>
                  <p>
                    {item.count} contatos ·{' '}
                    {item.counts.find((row) => row.status === 'COMPLETED')?._count ?? 0} encaminhados ·{' '}
                    {item.counts.find((row) => row.status === 'FAILED')?._count ?? 0} falhas
                  </p>
                  {!schedule && (item.followUpCount || item.ctaKeyword) && <small>
                    {item.followUpCount ? `${item.followUpCount} follow-up(s) por lead` : ''}
                    {item.followUpCount && item.ctaKeyword ? ' · ' : ''}
                    {item.ctaKeyword ? `CTA: ${item.ctaKeyword}` : ''}
                  </small>}
                  <small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small>
                  {!schedule && (
                    <div className="campaign-financial-summary">
                      <small>{item.revenueSource === 'CRM' ? `${item.crmSales ?? 0} vendas ganhas vinculadas · CRM` : 'Receita informada manualmente'}</small>
                      <strong>
                        Receita atribuída:{' '}
                        {(Number(item.attributedRevenueInCents ?? 0) / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </strong>
                      <span>
                        Investimento:{' '}
                        {(Number(item.investmentInCents ?? 0) / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                      <b>
                        {(item.investmentInCents ?? 0) > 0
                          ? `ROI ${((100 * ((item.attributedRevenueInCents ?? 0) - (item.investmentInCents ?? 0))) / (item.investmentInCents ?? 1)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                          : 'Informe o investimento para calcular o ROI'}
                      </b>
                    </div>
                  )}
                </div>
                <div className="operation-actions">
                  {!schedule && (
                    <button
                      className="button"
                      onClick={() => {
                        setFinanceBatch(financeBatch === item.id ? '' : item.id);
                        setFinance({
                          investment: ((item.investmentInCents ?? 0) / 100).toFixed(2),
                          revenue: ((item.manualRevenueInCents ?? item.attributedRevenueInCents ?? 0) / 100).toFixed(2),
                          revenueSource: item.revenueSource ?? 'MANUAL',
                        });
                      }}
                    >
                      Financeiro
                    </button>
                  )}
                  {!schedule && <button className="button" onClick={() => setRevenueBatch(item.id)}>Vincular vendas do CRM</button>}
                  {!schedule && item.approaches?.length && <button className="button" onClick={() => {
                    void request<{ items: ApproachResult[] }>(`/operations/sessions/${sessionId}/batches/${item.id}/approaches`)
                      .then((data) => setApproachReport({ name: item.name, items: data.items }))
                      .catch((error) => notify(errorMessage(error), true));
                  }}>Resultados por mensagem</button>}
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
              {financeBatch === item.id && !schedule && (
                <form
                  className="surface campaign-financial-editor"
                  key={`finance:${item.id}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    setBusy(true);
                    void request(`/operations/sessions/${sessionId}/batches/${item.id}`, 'PUT', {
                      investmentInCents: Math.round(Number(finance.investment.replace(',', '.')) * 100),
                      attributedRevenueInCents: Math.round(Number(finance.revenue.replace(',', '.')) * 100),
                      revenueSource: finance.revenueSource,
                    })
                      .then(() => {
                        setItems((current) =>
                          current.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  investmentInCents: Math.round(
                                    Number(finance.investment.replace(',', '.')) * 100,
                                  ),
                                  attributedRevenueInCents: Math.round(
                                    Number(finance.revenue.replace(',', '.')) * 100,
                                  ),
                                }
                              : row,
                          ),
                        );
                        setFinanceBatch('');
                        setTick(value => value + 1);
                        notify('Valores da campanha salvos.');
                      })
                      .catch((error) => notify(errorMessage(error), true))
                      .finally(() => setBusy(false));
                  }}
                >
                  <label>
                    Investimento da campanha (R$)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={finance.investment}
                      onChange={(event) =>
                        setFinance((current) => ({ ...current, investment: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Origem da receita
                    <Select value={finance.revenueSource} onChange={event => setFinance(current => ({ ...current, revenueSource: event.target.value as 'MANUAL' | 'CRM' }))}>
                      <option value="MANUAL">Valor informado manualmente</option><option value="CRM">Vendas ganhas vinculadas no CRM</option>
                    </Select>
                  </label>
                  <label>
                    Receita atribuída (R$)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={finance.revenue}
                      disabled={finance.revenueSource === 'CRM'}
                      onChange={(event) =>
                        setFinance((current) => ({ ...current, revenue: event.target.value }))
                      }
                    />
                  </label>
                  <small className="muted">
                    O retorno compara receita atribuída e investimento informado. Não representa lucro líquido: custos de produção, impostos e outras despesas não estão incluídos.
                  </small>
                  <button className="button primary" disabled={busy}>
                    Salvar valores
                  </button>
                </form>
              )}
            </Fragment>
          ))}
        {!schedule &&
          search &&
          !items.some((item) =>
            item.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
          ) && <p className="muted">Nenhuma campanha corresponde a “{search}”.</p>}
      </div>
      {revenueBatch && <CampaignRevenue sessionId={sessionId} campaignId={revenueBatch} onClose={() => setRevenueBatch('')} onSaved={() => { setRevenueBatch(''); setTick(value => value + 1); }}/>}
      {approachReport && <Modal title={`Resultados por mensagem · ${approachReport.name}`} onClose={() => setApproachReport(null)} wide>
        <p className="muted">Enviadas = aceitas pelo conector. Entregues e lidas dependem da confirmação do WhatsApp. Vendas incluem apenas negócios ganhos vinculados à campanha.</p>
        <div className="batch-list">{approachReport.items.map((row) => <section className="surface" key={row.index}>
          <strong>Mensagem {row.index + 1}</strong><p>{row.text}</p>
          <p>{row.assigned} atribuídos · {row.sent} enviados · {row.delivered} entregues · {row.read} lidos · {row.replied} responderam · {row.sales} vendas · {(row.revenueInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </section>)}</div>
      </Modal>}
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
            <strong>{activate.name}</strong>{' '}
            {activate.mode === 'REMINDER'
              ? `gerará ${activate.count} lembrete(s) interno(s). Nenhuma mensagem será enviada ao WhatsApp.`
              : `será ativado para ${activate.count} contatos. Os envios vencidos começam assim que o WhatsApp estiver conectado.`}
          </p>
          <p className="muted">
            {activate.mode === 'REMINDER'
              ? 'Pausar ou cancelar impede os próximos lembretes.'
              : 'Pausar ou cancelar impede as próximas etapas. Um envio que já começou pode terminar.'}
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
                {task.contact && <p><b>{task.contact.name}</b> · +{task.contact.phoneNumber}</p>}
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
export function BatchEditor({
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
  const { preferences } = usePreferences();
  const [message, setMessage] = useState('');
  const [variants, setVariants] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<{ id: string; waitMinutes: number; text: string }[]>([]);
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaKeyword, setCtaKeyword] = useState('');
  const [ctaReplyText, setCtaReplyText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [variantIndex, setVariantIndex] = useState(0);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showLeads, setShowLeads] = useState(false);
  const [leadQuery, setLeadQuery] = useState('');
  const [audienceLoading, setAudienceLoading] = useState(false);

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
  const [conversationId, setConversationId] = useState(
    initialConversation && cleanPhone(initialConversation.contact.phoneNumber) ? initialConversation.id : '',
  );
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
  useEffect(() => {
    if (schedule && !conversationId) {
      setAudienceLoading(false);
      setPreview(null);
      setSelectedLeads([]);
      return;
    }
    const controller = new AbortController();
    setAudienceLoading(true);
    const timer = window.setTimeout(() => {
      void request<NonNullable<typeof preview>>(
        `/operations/sessions/${sessionId}/audience`,
        'POST',
        audience,
        controller.signal,
      )
        .then((data) => {
          setPreview(data);
          setSelectedLeads(data.items.map((item) => item.id));
        })
        .catch((error) => {
          if (!controller.signal.aborted) notify(errorMessage(error), true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setAudienceLoading(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    sessionId,
    schedule,
    conversationId,
    labelId,
    JSON.stringify(labelIds),
    match,
    listId,
    JSON.stringify(listIds),
    days,
    request,
    notify,
  ]);
  const previewAssets = selectedAssets
    .map((id) => library.assets.find((asset) => asset.id === id))
    .filter((asset): asset is Asset => Boolean(asset));
  const displayText =
    kind === 'text' || kind === 'reminder'
      ? ([message, ...variants][variantIndex] ?? message)
      : kind === 'sequence'
        ? steps
            .filter((step) => step.kind === 'text')
            .map((step) => step.text)
            .join('\n\n')
        : kind === 'funnel'
          ? 'Sequência de atendimento: confira as etapas antes de ativar.'
          : kind === 'flow'
            ? 'Fluxo de atendimento: usa a versão publicada.'
            : '';
  return (
    <Modal
      title={schedule ? 'Agendar mensagem ou lembrete' : 'Nova campanha segmentada'}
      className="batch-editor-modal"
      onClose={onClose}
      wide
    >
      <div className="batch-editor-layout">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!preview) return;
            const data = new FormData(event.currentTarget);
            setBusy(true);
            void request(`/operations/sessions/${sessionId}/batches`, 'POST', {
              name: data.get('name'),
              mode: kind === 'reminder' ? 'REMINDER' : schedule ? 'SCHEDULE' : 'CAMPAIGN',
              investmentInCents: Math.round(
                Number(String(data.get('investment') || '0').replace(',', '.')) * 100,
              ),
              attributedRevenueInCents: Math.round(
                Number(String(data.get('revenue') || '0').replace(',', '.')) * 100,
              ),
              audience: { ...audience, conversationIds: selectedLeads },
              delivery: {
                kind: kind === 'asset' && selectedAssets.length > 1 ? 'sequence' : kind,
                textVariations: kind === 'text' ? variants : undefined,
                followUps: !schedule && kind === 'text'
                  ? followUps.map(({ waitMinutes, text }) => ({ waitMinutes, text })) : undefined,
                cta: !schedule && kind === 'text' && ctaEnabled
                  ? { keyword: ctaKeyword, replyText: ctaReplyText } : undefined,
                steps:
                  kind === 'asset' && selectedAssets.length > 1
                    ? selectedAssets.map((assetId) => ({ kind: 'asset', assetId, waitSeconds: 1 }))
                    : kind === 'sequence'
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
                labelTransition: data.get('fromLabelId') || data.get('toLabelId')
                  ? { fromLabelId: data.get('fromLabelId') || undefined, toLabelId: data.get('toLabelId') || undefined }
                  : undefined,
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
          {!schedule && (
            <div className="form-grid">
              <label>
                Investimento inicial (R$)
                <input name="investment" type="number" min="0" step="0.01" defaultValue="0" />
              </label>
              <label>
                Receita já atribuída (R$)
                <input name="revenue" type="number" min="0" step="0.01" defaultValue="0" />
              </label>
              <small className="muted">
                Pode preencher depois; o ROI usa os valores informados manualmente.
              </small>
            </div>
          )}
          {schedule ? (
            <label className="contact-combobox-label">
              Contato
              <ContactCombobox
                people={people}
                value={conversationId}
                sessionId={sessionId}
                onChange={(id) => {
                  setConversationId(id);
                  setPreview(null);
                }}
                onCreated={(items) =>
                  setPeople((current) => [
                    ...current,
                    ...items.filter((item) => !current.some((existing) => existing.id === item.id)),
                  ])
                }
              />
            </label>
          ) : (
            <div className="form-grid">
              <label>
                Listas importadas
                <MultiSelect
                  label="Listas importadas"
                  options={lists.map((list) => ({ value: list.id, label: `${list.name} · ${list.count}` }))}
                  value={listIds}
                  onChange={(ids) => {
                    setListIds(ids);
                    setPreview(null);
                  }}
                  placeholder="Todas as listas"
                />
              </label>
              <label>
                Combinar etiqueta e inatividade
                <Select
                  value={match}
                  onChange={(event) => {
                    setMatch(event.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="AND">E · atender aos dois filtros</option>
                  <option value="OR">OU · atender a qualquer filtro</option>
                </Select>
              </label>
              <label>
                Etiquetas
                <MultiSelect
                  label="Etiquetas"
                  options={labels.map((label) => ({
                    value: label.id,
                    label: label.name,
                    color: preferences.labelStyles[label.id]?.color || label.color,
                  }))}
                  value={labelIds}
                  onChange={(ids) => {
                    setLabelIds(ids);
                    setPreview(null);
                  }}
                  placeholder="Todas as etiquetas"
                />
              </label>
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
            <Select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="text">Mensagem de texto</option>
              <option value="sequence">Sequência de textos e mídias</option>
              <option value="asset">Recurso da biblioteca</option>
              <option value="funnel">Funil de atendimento</option>
              <option value="flow">Fluxo de autoatendimento</option>
              {schedule && <option value="reminder">Lembrete interno · sem envio ao cliente</option>}
            </Select>
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
                      <Select
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
                      </Select>
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
                              item.id === step.id
                                ? { ...item, waitSeconds: Number(event.target.value) }
                                : item,
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
                      <Select
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
                      </Select>
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
            <div>
              <label>
                {kind === 'reminder' ? 'Texto do lembrete' : 'Mensagem'}
                <textarea
                  name="text"
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                  }}
                  rows={4}
                  required
                  maxLength={10000}
                  placeholder="Use {{nome}} e {{saudacao}} para personalizar"
                />
              </label>
              {kind === 'text' && (
                <>
                  <AiOnly><button
                    type="button"
                    className="button"
                    disabled={generating || message.trim().length < 3}
                    onClick={() => {
                      setGenerating(true);
                      void request<{ variants: string[] }>(
                        `/operations/sessions/${sessionId}/campaign-variations`,
                        'POST',
                        { text: message, count: 4 },
                      )
                        .then((data) => {
                          setVariants(data.variants);
                          setVariantIndex(0);
                          notify('Variações geradas. Revise antes de ativar a campanha.');
                        })
                        .catch((error) => notify(errorMessage(error), true))
                        .finally(() => setGenerating(false));
                    }}
                  >
                    {generating ? <Spinner /> : '✨'}Gerar variações com IA
                  </button></AiOnly>
                  <p className="muted">
                    Teste de abordagens: a mensagem principal é a 1; as mensagens seguintes alternam entre os leads em rodízio.
                    Variações e intervalos não garantem proteção contra bloqueios.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    disabled={variants.length >= 4}
                    onClick={() => setVariants((current) => [...current, message])}
                  >
                    Adicionar mensagem ao teste
                  </button>
                  {variants.map((text, index) => (
                    <div className="variation-editor" key={index}>
                      <label>
                        Mensagem {index + 2}
                        <textarea
                          maxLength={10000}
                          required
                          value={text}
                          onChange={(event) =>
                            setVariants((current) =>
                              current.map((item, i) => (i === index ? event.target.value : item)),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}
                      >
                        Remover variação
                      </button>
                    </div>
                  ))}
                  {variants.length > 0 && (
                    <button
                      type="button"
                      className="button small"
                      onClick={() => setVariantIndex((index) => (index + 1) % (variants.length + 1))}
                    >
                      Ver próxima mensagem na prévia
                    </button>
                  )}
                  {!schedule && <fieldset className="surface">
                    <legend>Resposta automática por CTA</legend>
                    <label><input type="checkbox" checked={ctaEnabled} onChange={(event) => setCtaEnabled(event.target.checked)} /> Ativar resposta por palavra-chave</label>
                    {ctaEnabled && <>
                      <label>Palavra-chave esperada
                        <input value={ctaKeyword} onChange={(event) => setCtaKeyword(event.target.value)} maxLength={100} required placeholder="Ex.: QUERO" />
                      </label>
                      <label>Mensagem após a resposta
                        <textarea value={ctaReplyText} onChange={(event) => setCtaReplyText(event.target.value)} maxLength={10000} required rows={3} placeholder="Ex.: Ótimo! Vou te passar os detalhes…" />
                      </label>
                      <small className="muted">Inclua a palavra-chave no texto de cada abordagem. A resposta do lead deve ser apenas essa palavra ou frase; maiúsculas, acentos e pontuação são ignorados. Cada lead recebe esta resposta automática uma vez por campanha.</small>
                    </>}
                  </fieldset>}
                  {!schedule && <fieldset className="surface">
                    <legend>Follow-up se o lead não responder</legend>
                    <p className="muted">O prazo de cada etapa começa após a mensagem anterior. Qualquer resposta do lead cancela as etapas restantes para ele.</p>
                    {followUps.map((step, index) => <div className="variation-editor" key={step.id}>
                      <strong>Follow-up {index + 1}</strong>
                      <label>Esperar (minutos)
                        <input type="number" min={1} max={43200} required value={step.waitMinutes} onChange={(event) => setFollowUps((current) => current.map((item) => item.id === step.id ? { ...item, waitMinutes: Number(event.target.value) } : item))} />
                      </label>
                      <label>Mensagem
                        <textarea required maxLength={10000} value={step.text} onChange={(event) => setFollowUps((current) => current.map((item) => item.id === step.id ? { ...item, text: event.target.value } : item))} />
                      </label>
                      <button type="button" className="text-button" onClick={() => setFollowUps((current) => current.filter((item) => item.id !== step.id))}>Remover follow-up</button>
                    </div>)}
                    <button type="button" className="button small" disabled={followUps.length >= 100} onClick={() => setFollowUps((current) => [...current, { id: crypto.randomUUID(), waitMinutes: 1440, text: '' }])}>Adicionar follow-up</button>
                    <small className="muted">Até 100 etapas por campanha.</small>
                  </fieldset>}
                </>
              )}
            </div>
          ) : kind === 'asset' ? (
            <label>
              Recursos da biblioteca
              <input type="hidden" name="assetId" value={selectedAssets[0] ?? ''} />
              <MultiSelect
                label="Recursos da biblioteca"
                options={library.assets.map((asset) => ({ value: asset.id, label: asset.name }))}
                value={selectedAssets}
                onChange={setSelectedAssets}
                placeholder="Selecione um ou mais recursos"
              />
            </label>
          ) : kind === 'flow' ? (
            <label>
              Fluxo ativo
              <Select name="flowId" required>
                <option value="">Selecione</option>
                {flows.map((flow) => (
                  <option value={flow.id} key={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </Select>
              <small className="muted">Usa a versão publicada no momento em que iniciar.</small>
            </label>
          ) : (
            <label>
              Funil
              <Select name="funnelId" required>
                <option value="">Selecione</option>
                {library.funnels.map((funnel) => (
                  <option value={funnel.id} key={funnel.id}>
                    {funnel.name}
                  </option>
                ))}
              </Select>
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
          {kind !== 'reminder' && labels.length > 0 && (
            <fieldset className="surface">
              <legend>Organização automática após o envio</legend>
              <div className="form-grid">
                <label>Remover etiqueta (opcional)<Select name="fromLabelId" defaultValue=""><option value="">Manter etiquetas atuais</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</Select></label>
                <label>Adicionar etiqueta ao concluir<Select name="toLabelId" defaultValue=""><option value="">Não alterar etiqueta</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</Select></label>
              </div>
              <small className="muted">A mudança acontece somente depois que a última mensagem da sequência for enviada.</small>
            </fieldset>
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
                .then((data) => {
                  setPreview(data);
                  setSelectedLeads(data.items.map((item) => item.id));
                })
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            <Users size={15} />
            Conferir público
          </button>
          <div className="audience-preview">
            <strong>
              🎯{' '}
              {audienceLoading
                ? 'Consultando contatos…'
                : `${preview?.count ?? 0} contatos correspondem ao filtro`}
            </strong>
            {!schedule && kind === 'text' && variants.length > 0 && preview && <div className="surface">
              <strong>Distribuição do teste de abordagens</strong>
              <p className="muted">Cada lead recebe uma mensagem. A distribuição fica fixa ao salvar o rascunho.</p>
              {[message, ...variants].map((text, index) => <p key={index}>
                Mensagem {index + 1}: {selectedLeads.filter((_, leadIndex) => leadIndex % (variants.length + 1) === index).length} lead(s) · {text.slice(0, 100)}{text.length > 100 ? '…' : ''}
              </p>)}
            </div>}
            {preview && (
              <>
                <span>{selectedLeads.length} selecionados para esta campanha</span>
                <button type="button" className="button small" onClick={() => setShowLeads(!showLeads)}>
                  Ver/Selecionar leads manualmente
                </button>
                {showLeads && (
                  <div className="manual-leads">
                    <input
                      aria-label="Buscar leads da campanha"
                      placeholder="Buscar na seleção…"
                      value={leadQuery}
                      onChange={(event) => setLeadQuery(event.target.value)}
                    />
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setSelectedLeads(selectedLeads.length ? [] : preview.items.map((item) => item.id))
                      }
                    >
                      {selectedLeads.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                    {preview.items
                      .filter((item) =>
                        `${item.name} ${item.phoneNumber}`.toLowerCase().includes(leadQuery.toLowerCase()),
                      )
                      .map((item) => (
                        <label key={item.id}>
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(item.id)}
                            onChange={(event) =>
                              setSelectedLeads((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                          />
                          <span>
                            {cleanContactName(item.name, item.phoneNumber)}
                            <small>{formatContactPhone(item.phoneNumber)}</small>
                          </span>
                        </label>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
          {!schedule && preview && <NumberValidation sessionId={sessionId} phoneNumbers={preview.items.filter(item => selectedLeads.includes(item.id)).map(item => item.phoneNumber)} disabled={busy} onBusyChange={setBusy} onRemove={numbers => {
            const absent = new Set(numbers);
            const excluded = new Set(preview.items.filter(item => absent.has(item.phoneNumber)).map(item => item.id));
            setSelectedLeads(current => current.filter(id => !excluded.has(id)));
            notify('Números sem conta foram desmarcados. Confira o público antes de salvar.');
          }}/>}
          <div className="modal-actions">
            <button type="button" className="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                audienceLoading ||
                !selectedLeads.length ||
                (kind === 'asset' && !selectedAssets.length)
              }
            >
              {busy ? <Spinner /> : <Plus size={15} />}Salvar rascunho
            </button>
          </div>
        </form>
        <CampaignPhonePreview
          text={displayText}
          assets={
            kind === 'asset'
              ? previewAssets
              : kind === 'sequence'
                ? steps
                    .filter((step) => step.kind === 'asset')
                    .map(
                      (step) =>
                        library.assets.find((asset) => asset.id === step.assetId) ||
                        extraAssets.find((asset) => asset.id === step.assetId),
                    )
                    .filter((asset): asset is Asset => Boolean(asset))
                : []
          }
          name={preview?.items.find((item) => selectedLeads.includes(item.id))?.name || 'Ana'}
        />
      </div>
    </Modal>
  );
}
