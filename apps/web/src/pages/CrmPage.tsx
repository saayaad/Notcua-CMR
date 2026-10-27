import {Select} from '../components/Select';
import { useLabelActions, LabelRulesButton } from '../components/LabelActions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  KanbanSquare,
  BarChart3,
  Plus,
  Search,
  RefreshCw,
  GripVertical,
  MessageSquare,
  Tag,
  ArrowRight,
  Trophy,
  Clock3,
  AlertCircle,
  Settings2,
  Trash2,
  Pencil,
  Wifi,
  Check,
  X,
} from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Avatar, Empty, Modal, Spinner, phone } from '../components/ui';
import { MetricCards, CrmDashboard } from './CrmDashboard';
import {
  money,
  statusName,
  type CrmBoard,
  type CrmCard,
  type CrmColumn,
  type CrmMetrics,
  type OpportunityStatus,
} from './crm.types';
import './crm.css';

const blankBoard: CrmBoard = {
  cards: [],
  columns: [],
  total: 0,
  loaded: 0,
  limit: 500,
  pendingSync: 0,
  failedSync: 0,
};
export function CrmPage({
  sessionId,
  revision,
  connected,
  onOpenChat,
  labelStyles,
}: {
  sessionId: string;
  revision: number;
  connected: boolean;
  onOpenChat: (conversationId: string) => void;
  labelStyles: Record<string, { color: string; icon: string }>;
}) {
  const { request, notify } = useApi();
  const {prepare,prompt} = useLabelActions(sessionId);
  const [board, setBoard] = useState<CrmBoard>(blankBoard);
  const [metrics, setMetrics] = useState<CrmMetrics | null>(null);
  const [mode, setMode] = useState<'board' | 'dashboard'>('board');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(500);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reload, setReload] = useState(0);
  const [labels, setLabels] = useState(false);
  const [newLabel, setNewLabel] = useState(false);
  const [selected, setSelected] = useState<{ card: CrmCard; column: CrmColumn } | null>(null);
  const boardRequest = useRef(0);
  const base = `/crm/sessions/${sessionId}`;
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const refresh = useCallback(() => setReload((value) => value + 1), []);
  useEffect(() => {
    if (!sessionId || busy || dragging) return;
    const controller = new AbortController();
    const generation = ++boardRequest.current;
    setLoading(true);
    const query = new URLSearchParams({ search: debounced, status: filter, limit: String(limit) });
    void request<CrmBoard>(`${base}/board?${query}`, 'GET', undefined, controller.signal)
      .then((data) => {
        if (generation === boardRequest.current && !controller.signal.aborted) setBoard(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sessionId, base, debounced, filter, limit, revision, reload, busy, dragging, request, notify]);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    void request<CrmMetrics>(`${base}/metrics?days=${days}`, 'GET', undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setMetrics(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [sessionId, base, days, revision, reload, request, notify]);
  const cards = useMemo(() => new Map(board.cards.map((card) => [card.conversationId, card])), [board]);
  const move = async (
    card: CrmCard,
    source: CrmColumn,
    target: CrmColumn,
    beforeConversationId: string | null,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await request(`${base}/move`, 'POST', {
        ...(source.labelId !== target.labelId && !card.contact.labels.some(link=>link.labelId===target.labelId) ? await prepare(target.labelId) : {}),
        conversationId: card.conversationId,
        sourceLabelId: source.labelId,
        targetLabelId: target.labelId,
        beforeConversationId,
        version: card.version,
      });
      setSelected(null);
      notify(
        source.id === target.id
          ? 'Ordem salva.'
          : target.whatsappId || source.whatsappId
            ? connected
              ? 'Cartão movido. Sincronizando etiquetas com o WhatsApp…'
              : 'Cartão movido. A sincronização aguarda o WhatsApp conectar.'
            : 'Cartão movido.',
      );
    } catch (error) {
      setBoard(board);
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
      refresh();
    }
  };
  const drop = (result: DropResult) => {
    setDragging(false);
    const { source, destination } = result;
    if (
      !destination ||
      (source.droppableId === destination.droppableId && source.index === destination.index)
    )
      return;
    const from = board.columns.find((column) => column.id === source.droppableId);
    const target = board.columns.find((column) => column.id === destination.droppableId);
    const conversationId = from?.conversationIds[source.index];
    const card = conversationId ? cards.get(conversationId) : undefined;
    if (!from || !target || !card) return;
    const ordered = target.conversationIds.filter((id) => id !== card.conversationId);
    const beforeId = ordered[destination.index] ?? null;
    const nextColumns = board.columns.map((column) => {
      let ids = column.conversationIds.filter((id) =>
        column.id === from.id || column.id === target.id ? id !== card.conversationId : true,
      );
      if (column.id === target.id) {
        ids = [...ids];
        ids.splice(destination.index, 0, card.conversationId);
      }
      return { ...column, conversationIds: ids };
    });
    setBoard({ ...board, columns: nextColumns });
    void move(card, from, target, beforeId);
  };
  if (!sessionId)
    return (
      <div className="workspace-page">
        <Empty title="Escolha uma conexão">
          Conecte seu WhatsApp para organizar contatos e acompanhar seus resultados.
        </Empty>
      </div>
    );
  return (
    <div className="crm-page">
      {prompt}
      <LabelRulesButton sessionId={sessionId}/>
      <header className="crm-heading">
        <div>
          <p className="eyebrow">RELACIONAMENTOS QUE EVOLUEM</p>
          <h1>
            CRM e negócios
            <span className="crm-live">
              <i />
              Atualização ao vivo
            </span>
          </h1>
          <p>Do primeiro contato à próxima conquista.</p>
        </div>
        <div className="crm-heading-actions">
          <label className="crm-period">
            <Clock3 size={15} />
            <Select
              aria-label="Período dos indicadores"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </Select>
          </label>
          <button className="button primary" onClick={() => setNewLabel(true)}>
            <Plus size={16} />
            Nova etapa
          </button>
        </div>
      </header>
      <MetricCards metrics={metrics} />
      <div className="crm-toolbar">
        <div className="crm-view-tabs">
          <button className={mode === 'board' ? 'selected' : ''} onClick={() => setMode('board')}>
            <KanbanSquare size={16} />
            Quadro
          </button>
          <button className={mode === 'dashboard' ? 'selected' : ''} onClick={() => setMode('dashboard')}>
            <BarChart3 size={16} />
            Indicadores
          </button>
        </div>
        {mode === 'board' && (
          <>
            <label className="crm-search">
              <Search size={16} />
              <input
                aria-label="Buscar no CRM"
                placeholder="Buscar contato ou telefone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <Select
              className="crm-status-filter"
              aria-label="Filtrar negociações"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="ALL">Todas as negociações</option>
              <option value="OPEN">Em negociação</option>
              <option value="WON">Ganhas</option>
              <option value="LOST">Perdidas</option>
            </Select>
            <button className="button" onClick={() => setLabels(true)}>
              <Settings2 size={15} />
              Etapas
            </button>
          </>
        )}
        <button
          className="icon-button"
          title="Atualizar CRM"
          aria-label="Atualizar CRM"
          disabled={busy || dragging}
          onClick={refresh}
        >
          {loading ? <Spinner /> : <RefreshCw size={17} />}
        </button>
      </div>
      {mode === 'dashboard' ? (
        <CrmDashboard metrics={metrics} />
      ) : (
        <>
          {(board.pendingSync > 0 || board.failedSync > 0) && (
            <div className={`crm-sync ${board.failedSync ? 'sync-error' : ''}`}>
              {board.failedSync ? <AlertCircle size={16} /> : <RefreshCw size={15} />}
              <span>
                {board.failedSync
                  ? `${board.failedSync} alterações precisam de uma nova tentativa.`
                  : `${board.pendingSync} alterações aguardam confirmação do WhatsApp${connected ? '.' : ' — conecte para sincronizar.'}`}
              </span>
              {board.failedSync > 0 && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void request(`${base}/retry-sync`, 'POST')
                      .then(() => notify('Nova tentativa agendada.'))
                      .catch((error) => notify(errorMessage(error), true))
                      .finally(() => {
                        setBusy(false);
                        refresh();
                      });
                  }}
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
          <div className="crm-board-caption">
            <span>
              {board.total.toLocaleString('pt-BR')} contatos
              {filter !== 'ALL' || search ? ' neste filtro' : ' no quadro'} · {board.columns.length - 1}{' '}
              etapas
            </span>
            <small>Arraste pela alça ou abra o cartão para mover.</small>
            {busy && (
              <span>
                <Spinner />
                Salvando…
              </span>
            )}
          </div>
          <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={drop}>
            <div className="kanban-board" aria-label="Quadro de negociações">
              {board.columns.map((column) => (
                <section
                  className="kanban-column"
                  key={`column:${column.id}`}
                  aria-label={`Etapa ${column.name}`}
                >
                  <header>
                    <div>
                      <i style={{ background: labelStyles[column.id]?.color || column.color }} />
                      {labelStyles[column.id]?.icon && <b className="kanban-column-icon">{labelStyles[column.id]?.icon}</b>}
                      <h2 title={column.name}>{column.name}</h2>
                      <span>{column.conversationIds.length}</span>
                      {column.whatsappId && <Wifi size={13} aria-label="Etiqueta do WhatsApp" />}
                    </div>
                    <p>
                      {money(column.totalValueInCents)}
                      <small>
                        {column.whatsappId
                          ? 'Sincronizada com WhatsApp'
                          : column.labelId
                            ? 'Etapa local'
                            : 'Aguardando uma etapa'}
                      </small>
                    </p>
                  </header>
                  <Droppable droppableId={column.id} isDropDisabled={busy}>
                    {(provided, snapshot) => (
                      <div
                        className={`kanban-drop ${snapshot.isDraggingOver ? 'drop-active' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {column.conversationIds.map((conversationId, index) => {
                          const card = cards.get(conversationId);
                          if (!card) return null;
                          return (
                            <Draggable
                              key={`card:${column.id}:${conversationId}`}
                              draggableId={`${column.id}|${conversationId}`}
                              index={index}
                              disableInteractiveElementBlocking
                              isDragDisabled={busy}
                            >
                              {(drag, state) => {
                                const element = (
                                  <article
                                    className={`kanban-card ${state.isDragging ? 'card-dragging' : ''}`}
                                    ref={drag.innerRef}
                                    {...drag.draggableProps}
                                    style={drag.draggableProps.style}
                                  >
                                    <div className="kanban-card-top">
                                      <span
                                        className={`opportunity-status status-${card.status.toLowerCase()}`}
                                      >
                                        {card.status === 'WON' && <Trophy size={11} />}
                                        <i />
                                        {statusName[card.status]}
                                      </span>
                                      <button
                                        className="card-grip"
                                        {...drag.dragHandleProps}
                                        aria-label={`Arrastar ${card.contact.name} de ${column.name}`}
                                        title="Arraste ou use espaço e as setas"
                                      >
                                        <GripVertical size={17} />
                                      </button>
                                    </div>
                                    <button
                                      className="kanban-card-body"
                                      onClick={() => setSelected({ card, column })}
                                      aria-label={`Editar negociação de ${card.contact.name} em ${column.name}`}
                                    >
                                      <div className="kanban-contact">
                                        <Avatar contact={card.contact} />
                                        <span>
                                          <strong>{card.contact.name}</strong>
                                          <small>{phone(card.contact.phoneNumber)}</small>
                                        </span>
                                      </div>
                                      {card.title && <p className="kanban-card-title">{card.title}</p>}
                                      <div className="kanban-card-value">
                                        {card.valueInCents ? (
                                          money(card.valueInCents)
                                        ) : (
                                          <span>Adicionar valor</span>
                                        )}
                                        <ArrowRight size={14} />
                                      </div>
                                    </button>
                                    <footer>
                                      <span className={`card-sync ${card.sync.toLowerCase()}`}>
                                        {card.sync === 'FAILED' ? (
                                          <>
                                            <AlertCircle size={12} />
                                            Sincronização falhou
                                          </>
                                        ) : card.sync === 'PENDING' ? (
                                          <>
                                            <Clock3 size={12} />
                                            Sincronizando
                                          </>
                                        ) : (
                                          <>
                                            <Tag size={12} />
                                            {card.contact.labels.length} etiquetas
                                          </>
                                        )}
                                      </span>
                                      <button
                                        onClick={() => onOpenChat(card.conversationId)}
                                        aria-label={`Abrir conversa com ${card.contact.name}`}
                                        title="Abrir atendimento"
                                      >
                                        <MessageSquare size={15} />
                                        {card.unreadCount > 0 && <b>{card.unreadCount}</b>}
                                      </button>
                                    </footer>
                                  </article>
                                );
                                return state.isDragging ? createPortal(element, document.body) : element;
                              }}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        {!column.conversationIds.length && (
                          <div className="kanban-empty">
                            <Plus size={18} />
                            <p>{loading ? 'Carregando…' : 'Arraste um contato para cá'}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </section>
              ))}
            </div>
          </DragDropContext>
          <div className="crm-footer">
            <span>
              Um contato pode aparecer em várias etapas se tiver várias etiquetas. Os indicadores contam cada
              negociação uma vez.
            </span>
            {board.loaded < board.total && (
              <button
                className="text-button"
                disabled={limit >= 5000 || busy}
                onClick={() => setLimit((value) => Math.min(value + 500, 5000))}
              >
                {limit >= 5000
                  ? 'Refine a busca para ver os demais'
                  : `Carregar mais (${board.loaded} de ${board.total})`}
              </button>
            )}
          </div>
        </>
      )}
      {selected && (
        <OpportunityEditor
          key={`${selected.column.id}:${selected.card.conversationId}`}
          selected={selected}
          columns={board.columns}
          busy={busy}
          onClose={() => setSelected(null)}
          onChat={() => onOpenChat(selected.card.conversationId)}
          onMove={(target) => move(selected.card, selected.column, target, null)}
          onSave={async (input) => {
            setBusy(true);
            try {
              await request(`${base}/opportunities/${selected.card.conversationId}`, 'PUT', {
                ...input,
                version: selected.card.version,
              });
              setSelected(null);
              notify('Negociação atualizada.');
            } catch (error) {
              setSelected(null);
              notify(errorMessage(error), true);
            } finally {
              setBusy(false);
              refresh();
            }
          }}
        />
      )}
      {labels && (
        <StageManager
          board={board}
          base={base}
          onClose={() => setLabels(false)}
          onNew={() => setNewLabel(true)}
          refresh={refresh}
        />
      )}
      {newLabel && (
        <StageEditor
          base={base}
          onClose={() => setNewLabel(false)}
          onSaved={() => {
            setNewLabel(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function OpportunityEditor({
  selected: { card, column },
  columns,
  busy,
  onClose,
  onSave,
  onMove,
  onChat,
}: {
  selected: { card: CrmCard; column: CrmColumn };
  columns: CrmColumn[];
  busy: boolean;
  onClose: () => void;
  onSave: (value: { title: string; valueInCents: number; status: OpportunityStatus }) => Promise<void>;
  onMove: (target: CrmColumn) => Promise<void>;
  onChat: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [value, setValue] = useState((card.valueInCents / 100).toFixed(2));
  const [status, setStatus] = useState(card.status);
  const [stage, setStage] = useState(column.id);
  return (
    <Modal
      title="Detalhes da negociação"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="opportunity-contact">
        <Avatar contact={card.contact} />
        <div>
          <strong>{card.contact.name}</strong>
          <p>{phone(card.contact.phoneNumber)}</p>
        </div>
        <button
          className="icon-button"
          title="Abrir conversa"
          aria-label="Abrir conversa desta negociação"
          onClick={onChat}
        >
          <MessageSquare size={19} />
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ title, valueInCents: Math.round(Number(value.replace(',', '.')) * 100), status });
        }}
      >
        <label>
          Título da negociação
          <input
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Pacote de atendimento mensal"
          />
        </label>
        <div className="form-grid">
          <label>
            Valor (R$)
            <input
              type="number"
              min="0"
              max="20000000"
              step="0.01"
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <label>
            Resultado
            <Select value={status} onChange={(event) => setStatus(event.target.value as OpportunityStatus)}>
              <option value="OPEN">Em negociação</option>
              <option value="WON">Ganho</option>
              <option value="LOST">Perdido</option>
            </Select>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Spinner /> : <Check size={16} />}Salvar negociação
          </button>
        </div>
      </form>
      <div className="opportunity-move">
        <label>
          Mover de “{column.name}” para
          <Select value={stage} onChange={(event) => setStage(event.target.value)}>
            {columns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>
        <button
          className="button"
          disabled={busy || stage === column.id}
          onClick={() => {
            const target = columns.find((item) => item.id === stage);
            if (target) void onMove(target);
          }}
        >
          <ArrowRight size={15} />
          Mover cartão
        </button>
        <p>Move o cartão sem salvar os campos acima. Outras etiquetas do contato são preservadas.</p>
      </div>
    </Modal>
  );
}

function StageEditor({
  base,
  column,
  onClose,
  onSaved,
}: {
  base: string;
  column?: CrmColumn;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, notify } = useApi();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(column?.name ?? '');
  const [color, setColor] = useState(column?.color ?? '#a68bfa');
  const [description, setDescription] = useState(column?.description ?? '');
  return (
    <Modal title={column ? 'Editar etapa local' : 'Nova etapa do CRM'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void request(
            `${base}/labels${column ? `/${encodeURIComponent(column.id)}` : ''}`,
            column ? 'PUT' : 'POST',
            { name, color, description },
          )
            .then(() => {
              notify('Etapa salva.');
              onSaved();
            })
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Nome da etapa
          <input
            required
            value={name}
            maxLength={100}
            placeholder="Ex.: Orçamento enviado"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Cor
          <div className="stage-colors">
            {['#a68bfa', '#64c4ff', '#55ccb3', '#e6ac54', '#f28b9b', '#a6d5cb'].map((choice) => (
              <button
                key={choice}
                type="button"
                aria-label={`Cor ${choice}`}
                style={{ background: choice }}
                onClick={() => setColor(choice)}
                className={choice === color ? 'selected' : ''}
              >
                {choice === color && <Check size={15} />}
              </button>
            ))}
            <input
              aria-label="Cor personalizada"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </div>
        </label>
        <label>
          Descrição
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="O que acontece nesta etapa?"
          />
        </label>
        <p className="muted">
          Esta etapa será uma etiqueta local do Noctua. Para criar uma etiqueta também no WhatsApp, crie-a no
          aplicativo e sincronize.
        </p>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Spinner /> : <Plus size={16} />}Salvar etapa
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StageManager({
  board,
  base,
  onClose,
  onNew,
  refresh,
}: {
  board: CrmBoard;
  base: string;
  onClose: () => void;
  onNew: () => void;
  refresh: () => void;
}) {
  const { request, notify } = useApi();
  const [editing, setEditing] = useState<CrmColumn | null>(null);
  const [removing, setRemoving] = useState<CrmColumn | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Modal title="Etapas e etiquetas" onClose={onClose} wide>
        <p className="muted">
          Cada etiqueta é uma coluna do quadro. Etiquetas importadas são mantidas pelo WhatsApp; você pode
          editar as etapas locais aqui.
        </p>
        <div className="stage-list">
          {board.columns
            .filter((column) => column.labelId)
            .map((column) => (
              <div key={column.id}>
                <i style={{ background: column.color }} />
                <span>
                  <strong>{column.name}</strong>
                  <small>
                    {column.whatsappId
                      ? 'Etiqueta do WhatsApp · edite no aplicativo'
                      : column.description || 'Etapa local'}
                  </small>
                </span>
                {column.whatsappId ? (
                  <Wifi size={15} />
                ) : (
                  <>
                    <button
                      className="icon-button"
                      aria-label={`Editar etapa ${column.name}`}
                      onClick={() => setEditing(column)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button text-danger"
                      aria-label={`Excluir etapa ${column.name}`}
                      onClick={() => setRemoving(column)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            ))}
        </div>
        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            Fechar
          </button>
          <button className="button primary" onClick={onNew}>
            <Plus size={16} />
            Nova etapa
          </button>
        </div>
      </Modal>
      {editing && (
        <StageEditor
          base={base}
          column={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {removing && (
        <Modal title="Excluir etapa local" onClose={() => setRemoving(null)}>
          <p>
            Excluir a etapa <strong>{removing.name}</strong>? A exclusão só é permitida quando ela não tem
            vínculos com contatos, macros ou negócios.
          </p>
          <div className="modal-actions">
            <button className="button" disabled={busy} onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void request(`${base}/labels/${encodeURIComponent(removing.id)}`, 'DELETE')
                  .then(() => {
                    setRemoving(null);
                    refresh();
                    notify('Etapa excluída.');
                  })
                  .catch((error) => notify(errorMessage(error), true))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? <Spinner /> : <Trash2 size={15} />}Excluir etapa
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
