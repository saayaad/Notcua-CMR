import { useHudPlacement, HudMoveHandle } from './HudPlacement';
import { FlowLaunch, FlowIndicator } from './FlowActions';
import { AiAssistant } from './ContactWorkspace';
import { AiControl } from './AiControl';
import { CampaignsPage } from '../pages/OperationsPages';
import type { Library } from '../types';
import { useEffect, useRef, useState } from 'react';
import {
  Workflow,
  Sparkles,
  CalendarDays,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  AlertCircle,
  Wrench,
  Archive,
  ArchiveRestore,
  Download,
  Eye,
  FileText,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  WandSparkles,
  LockKeyhole,
} from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Conversation, Message, Paged } from '../types';
import { Avatar, Empty, FormattedText, Modal, Spinner, phone, time } from './ui';
import { Composer } from './Composer';
import { AttendanceFunctions } from './AttendanceFunctions';
import { AttendanceShortcuts } from './AttendanceShortcuts';
import { NextAction } from './NextAction';
import { SequenceMonitor } from './SequenceMonitor';
import { BookOpenCheck } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { completeOrder } from '../context/hud';
import { Ellipsis } from 'lucide-react';

function MessageMedia({ message, base }: { message: Message; base: string }) {
  const { blob, notify } = useApi();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const urlRef = useRef('');
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  const load = async () => {
    setBusy(true);
    try {
      const data = await blob(`${base}/messages/${encodeURIComponent(message.id)}/media`);
      const objectUrl = URL.createObjectURL(data);
      urlRef.current = objectUrl;
      setUrl(objectUrl);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  if (message.asViewOnce)
    return (
      <div className="media-placeholder">
        <Eye size={18} />
        <span>
          Visualização única<small>Abra esta mídia no WhatsApp.</small>
        </span>
      </div>
    );
  const kind = message.type.toLowerCase();
  return url ? (
    kind.includes('image') || kind.includes('sticker') ? (
      <img className="message-image" src={url} alt="Imagem da conversa" />
    ) : kind.includes('video') || message.isPtv ? (
      <video className={`message-video ${message.isPtv ? 'circular-video' : ''}`} src={url} controls />
    ) : kind.includes('audio') ? (
      <audio src={url} controls />
    ) : (
      <a href={url} download="arquivo" className="media-placeholder">
        <FileText size={20} />
        Baixar documento
      </a>
    )
  ) : (
    <button className="media-placeholder" disabled={busy} onClick={() => void load()}>
      {busy ? <Spinner /> : <Download size={19} />}
      <span>
        {kind.includes('audio')
          ? 'Ouvir áudio'
          : kind.includes('image')
            ? 'Carregar imagem'
            : kind.includes('video') || message.isPtv
              ? 'Carregar vídeo'
              : 'Carregar documento'}
        <small>Carregar arquivo da conversa</small>
      </span>
    </button>
  );
}

export function ChatPane({
  chat,
  sessionId,
  connected,
  revision,
  library,
  onBack,
  onDetails,
  onQuick,
  onRefresh,
  toolsVisible,
  toolsCompact,
  onToggleTools,
  onToggleToolSize,
  onCustomize,
  onToolRequest,
}: {
  library: Library;
  chat: Conversation | null;
  sessionId: string;
  connected: boolean;
  revision: number;
  onBack: () => void;
  onDetails: () => void;
  onQuick: () => void;
  onRefresh: () => void;
  toolsVisible: boolean;
  toolsCompact: boolean;
  onToggleTools: () => void;
  onToggleToolSize: () => void;
  onCustomize: () => void;
  onToolRequest: (section: string, kind?: string, question?: string) => void;
}) {
  const { request, notify } = useApi();
  const { preferences } = usePreferences();
  const placement = useHudPlacement('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [flowOpen, setFlowOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>({});
  const [transcribing, setTranscribing] = useState('');
  const messageArea = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);
  const base = `/attendance/sessions/${sessionId}/conversations/${chat?.id ?? ''}`;
  useEffect(() => {
    setMessages([]);
    setPage(1);
    previousCount.current = 0;
  }, [chat?.id]);
  useEffect(() => {
    if (!chat) return;
    const controller = new AbortController();
    setLoading(true);
    void request<Paged<Message>>(`${base}/messages?page=1&pageSize=50`, 'GET', undefined, controller.signal)
      .then((data) => {
        setMessages((current) => {
          const merged = new Map(current.map((item) => [item.id, item]));
          for (const item of data.items) merged.set(item.id, item);
          return [...merged.values()].sort(
            (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime() || a.id.localeCompare(b.id),
          );
        });
        setTotal(data.total);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [base, chat?.id, revision, request, notify]);
  useEffect(() => {
    if (chat && connected && chat.unreadCount)
      void request(`${base}/read`, 'POST').catch((error) => notify(errorMessage(error), true));
  }, [chat?.id, connected, base, request, notify]);
  useEffect(() => {
    if (page === 1 && messages.length !== previousCount.current)
      messageArea.current?.scrollTo({
        top: messageArea.current.scrollHeight,
        behavior: previousCount.current ? 'smooth' : 'instant',
      });
    previousCount.current = messages.length;
  }, [messages, page]);
  if (!chat)
    return (
      <main className="chat-pane chat-idle">
        <Empty title="Seu próximo atendimento começa aqui">
          Selecione uma conversa ao lado para continuar de onde parou.
        </Empty>
        <div className="privacy-note">Conversas sincronizadas com seu WhatsApp</div>
      </main>
    );
  const loadOlder = async () => {
    setLoading(true);
    try {
      const data = await request<Paged<Message>>(`${base}/messages?page=${page + 1}&pageSize=50`);
      setMessages((current) => {
        const merged = new Map(current.map((item) => [item.id, item]));
        for (const item of data.items) merged.set(item.id, item);
        return [...merged.values()].sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime() || a.id.localeCompare(b.id),
        );
      });
      setPage((value) => value + 1);
      setTotal(data.total);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setLoading(false);
    }
  };
  const close = async () => {
    try {
      await request(base, 'PUT', { status: chat.status === 'OPEN' ? 'CLOSED' : 'OPEN' });
      onRefresh();
      onBack();
      notify(chat.status === 'OPEN' ? 'Atendimento encerrado.' : 'Atendimento reaberto.');
    } catch (error) {
      notify(errorMessage(error), true);
    }
  };
  const addInternalNote = async (text: string) => {
    const note = await request<Message>(`${base}/internal-notes`, 'POST', { text });
    setMessages((current) =>
      [...current, note].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()),
    );
    setTotal((current) => current + 1);
  };
  const transcribe = async (messageId: string) => {
    setTranscribing(messageId);
    try {
      const result = await request<{ result?: { text?: string }; text?: string }>(
        `/operations/sessions/${sessionId}/contacts/${chat.id}/media-analysis`,
        'POST',
        { messageId, consent: true },
      );
      const text = result.result?.text ?? result.text ?? '';
      setTranscriptions((current) => ({ ...current, [messageId]: text }));
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setTranscribing('');
    }
  };
  const summarize = async () => {
    setSummaryBusy(true);
    try {
      const result = await request<{ text: string }>(
        `/operations/sessions/${sessionId}/contacts/${chat.id}/ai`,
        'POST',
        {
          consent: true,
          task: 'Crie um resumo executivo em exatamente três tópicos: Objetivo principal do cliente; Dúvidas ou objeções apresentadas; Próximo passo recomendado. Seja conciso, use somente informações do histórico e identifique claramente cada tópico.',
        },
      );
      setSummary(result.text);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setSummaryBusy(false);
    }
  };
  const actions = [
    {
      id: 'summary',
      name: 'Resumir conversa',
      icon: WandSparkles,
      run: () => {
        setSummary('');
        setSummaryOpen(true);
      },
    },
    { id: 'schedule', name: 'Agendar mensagem', icon: CalendarDays, run: () => setScheduleOpen(true) },
    {
      id: 'archive',
      name: chat.status === 'OPEN' ? 'Arquivar conversa' : 'Reabrir conversa',
      icon: chat.status === 'OPEN' ? Archive : ArchiveRestore,
      run: () => void close(),
    },
    { id: 'flow', name: 'Iniciar fluxo', icon: Workflow, run: () => setFlowOpen(true) },
    { id: 'ai', name: 'Assistente de IA', icon: Sparkles, run: () => setAiOpen(true) },
  ];
  const orderedActions = completeOrder(
    preferences.hudHeaderOrder,
    actions.map((item) => item.id),
  ).map((id) => actions.find((item) => item.id === id)!);
  const shortcut = (id: string) => {
    if (id === 'client') onDetails();
    else if (id === 'schedule') setScheduleOpen(true);
    else if (['faq', 'notes', 'next', 'transfers'].includes(id)) onToolRequest(id);
    else onToolRequest('responses', id);
  };
  return (
    <main className="chat-pane" {...placement.attributes} style={placement.style}>
      <header className="chat-header">
        <HudMoveHandle placement={placement} name="chat" />
        <button className="icon-button mobile-back" onClick={onBack} aria-label="Voltar à lista">
          <ArrowLeft size={20} />
        </button>
        <button
          className="client-name-button"
          onClick={onDetails}
          aria-label={`Informações de ${chat.contact.name}`}
          title="Ver informações do cliente"
        >
          <Avatar contact={chat.contact} />
          <span className="chat-heading">
            <strong>{chat.contact.name}</strong>
            <span>
              <i className={connected ? 'online-dot' : 'offline-dot'} />
              {phone(chat.contact.phoneNumber)}
            </span>
          </span>
        </button>
        <div className="header-actions">
          {orderedActions
            .filter((action) => !preferences.hudHiddenActions.includes(action.id))
            .slice(0, 3)
            .map(({ id, name, icon: Icon, run }) => (
              <button
                key={id}
                className="icon-button chat-main-action"
                aria-label={name}
                title={name}
                onClick={run}
              >
                <Icon size={17} />
              </button>
            ))}
          <details
            className="chat-more-actions"
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.currentTarget.removeAttribute('open');
            }}
          >
            <summary className="icon-button" aria-label="Mais ações do atendimento" title="Mais ações">
              <Ellipsis size={19} />
            </summary>
            <div className="chat-action-menu">
              {orderedActions.map(({ id, name, icon: Icon, run }) => (
                <button
                  key={id}
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    run();
                  }}
                >
                  <Icon size={16} />
                  {name}
                </button>
              ))}
              <button onClick={onToggleTools}>
                <Wrench size={16} />
                {toolsVisible ? 'Ocultar mensagens fixadas' : 'Mostrar mensagens fixadas'}
              </button>
              <button onClick={onToggleToolSize}>
                {toolsCompact ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                {toolsCompact ? 'Ampliar ferramentas' : 'Compactar ferramentas'}
              </button>
              <button onClick={onCustomize}>
                <SlidersHorizontal size={16} />
                Personalizar Atendimento
              </button>
            </div>
          </details>
          <button
            className="icon-button chat-customize-button"
            aria-label="Personalizar Atendimento com prévia"
            title="Personalizar Atendimento"
            onClick={onCustomize}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
      </header>
      <NextAction
        sessionId={sessionId}
        conversationId={chat.id}
        revision={revision}
        compact
        onEdit={() => onToolRequest('next')}
      />
      <SequenceMonitor base={base} revision={revision} onRefresh={onRefresh} />
      <div
        className={`attendance-chat-body shortcuts-position-${preferences.attendanceShortcutPosition} functions-position-${preferences.attendanceFunctionsPosition}`}
      >
        <AttendanceFunctions onAction={(section) => onToolRequest(section)} />
        <AttendanceShortcuts onAction={shortcut} />
        <div ref={messageArea} className="message-area" role="log" aria-label="Mensagens da conversa">
          <div className="history-notice">Histórico sincronizado · horários locais</div>
          {messages.length < total && (
            <button className="load-history" disabled={loading} onClick={() => void loadOlder()}>
              {loading ? 'Carregando…' : 'Carregar mensagens anteriores'}
            </button>
          )}
          {loading && !messages.length && (
            <div className="list-placeholder">
              <Spinner />
              Carregando histórico…
            </div>
          )}
          {!loading && !messages.length && (
            <div className="history-empty">Envie a primeira mensagem desta conversa.</div>
          )}
          {messages.map((message, index) => {
            const date = new Date(message.sentAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
            });
            const previous = messages[index - 1];
            const dateChanged =
              !previous ||
              new Date(previous.sentAt).toDateString() !== new Date(message.sentAt).toDateString();
            const media =
              !['text', 'conversation', 'extendedTextMessage'].includes(message.type) && !message.text;
            return (
              <div key={message.id}>
                {dateChanged && (
                  <div className="date-divider">
                    <span>{date}</span>
                  </div>
                )}
                <div className={`message-row ${message.direction === 'OUTBOUND' ? 'outbound' : ''}`}>
                  <div
                    className={`message-bubble ${message.status === 'FAILED' ? 'message-failed' : ''} ${message.internal ? 'internal-note-bubble' : ''}`}
                  >
                    {message.internal && (
                      <div className="internal-note-label">
                        <LockKeyhole size={13} /> Nota interna · {message.author || 'Atendente'}
                      </div>
                    )}
                    {media && <MessageMedia message={message} base={base} />}
                    {(message.text || message.caption) && (
                      <div className="message-text">
                        <FormattedText text={message.text || message.caption || ''} />
                      </div>
                    )}
                    {message.direction === 'INBOUND' && message.text && (
                      <button
                        className="message-save-question"
                        title="Cadastrar resposta padrão para esta pergunta"
                        aria-label="Cadastrar resposta padrão a partir desta mensagem"
                        onClick={() => onToolRequest('faq', undefined, message.text!)}
                      >
                        <BookOpenCheck size={14} />
                      </button>
                    )}
                    {message.direction === 'INBOUND' &&
                      /audio/i.test(message.type) &&
                      !message.asViewOnce && (
                        <div className="transcription-actions">
                          <button
                            className="text-button"
                            disabled={transcribing === message.id}
                            onClick={() => void transcribe(message.id)}
                          >
                            {transcribing === message.id ? <Spinner /> : <FileText size={14} />}{' '}
                            {transcriptions[message.id] ? 'Atualizar transcrição' : 'Ler transcrição'}
                          </button>
                        </div>
                      )}
                    {transcriptions[message.id] && (
                      <div className="transcription-text">
                        <strong>Transcrição</strong>
                        <p>{transcriptions[message.id]}</p>
                      </div>
                    )}
                    {message.deletedByClient && (
                      <small className="deleted-message-badge">🗑️ Apagada pelo cliente</small>
                    )}
                    <div className="message-meta">
                      <time>{time(message.sentAt)}</time>
                      {message.direction === 'OUTBOUND' &&
                        !message.internal &&
                        (message.status === 'PENDING' ? (
                          <Clock3 size={12} />
                        ) : message.status === 'FAILED' ? (
                          <AlertCircle size={13} />
                        ) : message.status === 'SENT' ? (
                          <Check size={15} />
                        ) : (
                          <CheckCheck size={15} className={message.status === 'READ' ? 'read-status' : ''} />
                        ))}
                    </div>
                    {message.error && <small className="message-error">{message.error}</small>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="attendance-flow-slot">
          <FlowIndicator sessionId={sessionId} conversationId={chat.id} revision={revision} />
        </div>
        <div className="attendance-ai-slot">
          <AiControl sessionId={sessionId} conversationId={chat.id} revision={revision} />
        </div>
        <div className="composer-container">
          <Composer
            key={chat.id}
            base={base}
            sessionId={sessionId}
            conversationId={chat.id}
            library={library}
            connected={connected}
            onInternalNote={addInternalNote}
            onSent={() => {
              setPage(1);
              onRefresh();
            }}
            onQuick={onQuick}
          />
        </div>
      </div>
      {flowOpen && (
        <FlowLaunch sessionId={sessionId} conversationId={chat.id} onClose={() => setFlowOpen(false)} />
      )}{' '}
      {aiOpen && <AiAssistant chat={chat} sessionId={sessionId} onClose={() => setAiOpen(false)} />}{' '}
      {scheduleOpen && (
        <CampaignsPage
          sessionId={sessionId}
          library={library}
          schedule
          initialConversation={chat}
          onClose={() => setScheduleOpen(false)}
        />
      )}
      {summaryOpen && (
        <Modal title="✨ Resumo da conversa" onClose={() => setSummaryOpen(false)}>
          {!summary ? (
            <div className="ai-summary-intro">
              <p>A IA vai analisar o histórico e a base aprovada para preparar um resumo em três tópicos.</p>
              <small>O histórico será enviado ao provedor configurado em Integração de IA.</small>
              <button className="button primary" disabled={summaryBusy} onClick={() => void summarize()}>
                {summaryBusy ? <Spinner /> : <WandSparkles size={16} />} Gerar resumo
              </button>
            </div>
          ) : (
            <div className="ai-summary-result">
              <p>{summary}</p>
              <button
                className="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(summary)
                    .then(() => notify('Resumo copiado.'))
                    .catch(() => notify('Não foi possível copiar o resumo.', true))
                }
              >
                Copiar resumo
              </button>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}
