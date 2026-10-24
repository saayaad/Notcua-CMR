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
  ChevronDown,
} from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Conversation, Message, Paged } from '../types';
import { Avatar, Empty, FormattedText, Spinner, phone, time } from './ui';
import { Composer } from './Composer';

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
}) {
  const { request, notify } = useApi();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [flowOpen, setFlowOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
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
  return (
    <main className="chat-pane">
      <header className="chat-header">
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
            <small>Clique no nome para ver informações</small>
          </span>
        </button>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Iniciar fluxo"
            title="Iniciar fluxo"
            onClick={() => setFlowOpen(true)}
          >
            <Workflow size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Assistente de IA"
            title="Assistente de IA"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Agendar mensagem"
            title="Agendar mensagem"
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarDays size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => void close()}
            title={chat.status === 'OPEN' ? 'Encerrar atendimento' : 'Reabrir atendimento'}
            aria-label={chat.status === 'OPEN' ? 'Encerrar atendimento' : 'Reabrir atendimento'}
          >
            {chat.status === 'OPEN' ? <Archive size={19} /> : <ArchiveRestore size={19} />}
          </button>
        </div>
      </header>
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
            !previous || new Date(previous.sentAt).toDateString() !== new Date(message.sentAt).toDateString();
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
                <div className={`message-bubble ${message.status === 'FAILED' ? 'message-failed' : ''}`}>
                  {media && <MessageMedia message={message} base={base} />}
                  {(message.text || message.caption) && (
                    <div className="message-text">
                      <FormattedText text={message.text || message.caption || ''} />
                    </div>
                  )}
                  <div className="message-meta">
                    <time>{time(message.sentAt)}</time>
                    {message.direction === 'OUTBOUND' &&
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
      <FlowIndicator sessionId={sessionId} conversationId={chat.id} revision={revision} />
      <AiControl sessionId={sessionId} conversationId={chat.id} revision={revision} />
      <div className="composer-container">
        <Composer
          key={chat.id}
          base={base}
          connected={connected}
          onSent={() => {
            setPage(1);
            onRefresh();
          }}
          onQuick={onQuick}
        />
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
    </main>
  );
}
