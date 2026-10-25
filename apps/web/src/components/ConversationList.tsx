import {Select} from './Select';
import { useHudPlacement, HudMoveHandle } from './HudPlacement';
import { useEffect, useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { Pin, Search, Plus, ChevronLeft, ChevronRight, CheckCheck, MessageSquare } from 'lucide-react';
import type { Conversation, Label } from '../types';
import { Avatar, Spinner, time } from './ui';

interface Props {
  chats: Conversation[];
  total: number;
  active: string;
  onSelect: (chat: Conversation) => void;
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  label: string;
  setLabel: (value: string) => void;
  labels: Label[];
  page: number;
  setPage: (page: number) => void;
  loading: boolean;
  onNew: () => void;
}
export function ConversationList(p: Props) {
  const { preferences } = usePreferences();
  const placement = useHudPlacement('list');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const orderedChats = [...p.chats].sort((left, right) => {
    const isUrgent = (chat: Conversation) =>
      p.filter !== 'archived' &&
      chat.messages[0]?.direction === 'INBOUND' &&
      Boolean(chat.lastMessageAt) &&
      now - new Date(chat.lastMessageAt!).getTime() >= preferences.waitingRed * 60000;
    const urgentDifference = Number(isUrgent(right)) - Number(isUrgent(left));
    if (urgentDifference) return urgentDifference;
    if (isUrgent(left) && isUrgent(right))
      return new Date(left.lastMessageAt ?? 0).getTime() - new Date(right.lastMessageAt ?? 0).getTime();
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return 0;
  });
  return (
    <section
      {...placement.attributes}
      style={placement.style}
      className={`conversation-column ${p.active ? 'has-selection' : ''}`}
      aria-label="Lista de conversas"
    >
      <div className="list-heading">
        <HudMoveHandle placement={placement} name="list" />
        <div>
          <h1>
            Atendimento <span className="count-chip">{p.total}</span>
          </h1>
          <p>Cada conversa, uma oportunidade.</p>
        </div>
        <button className="icon-button add-button" onClick={p.onNew} aria-label="Nova conversa">
          <Plus size={20} />
        </button>
      </div>
      <label className="search-box">
        <Search size={17} />
        <input
          placeholder="Buscar nome ou telefone"
          value={p.search}
          onChange={(e) => p.setSearch(e.target.value)}
          aria-label="Buscar conversas"
        />
        <kbd>⌕</kbd>
      </label>
      <div className="filter-tabs">
        {[
          ['all', 'Ativas'],
          ['unread', 'Não lidas'],
          ['mine', 'Minhas'],
          ['archived', 'Arquivadas'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={p.filter === value ? 'selected' : ''}
            onClick={() => p.setFilter(value!)}
          >
            {label}
          </button>
        ))}
      </div>
      <Select
        className="label-filter"
        aria-label="Filtrar por etiqueta"
        value={p.label}
        onChange={(e) => p.setLabel(e.target.value)}
      >
        <option value="">Todas as etiquetas</option>
        {p.labels.map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
      </Select>
      <div className="chat-list">
        {p.loading && !p.chats.length ? (
          <div className="list-placeholder">
            <Spinner />
            Carregando conversas…
          </div>
        ) : !p.chats.length ? (
          <div className="list-placeholder">
            <MessageSquare size={25} />
            <span>Nenhuma conversa por aqui.</span>
            <small>Conecte seu WhatsApp ou tente outra busca.</small>
          </div>
        ) : (
          orderedChats.map((chat) => {
            const last = chat.messages[0];
            const label = chat.contact.labels[0]?.label;
            const urgent =
              p.filter !== 'archived' &&
              last?.direction === 'INBOUND' &&
              Boolean(chat.lastMessageAt) &&
              now - new Date(chat.lastMessageAt!).getTime() >= preferences.waitingRed * 60000;
            return (
              <button
                key={chat.id}
                className={`chat-item ${p.active === chat.id ? 'active' : ''} ${urgent ? 'sla-urgent' : ''}`}
                onClick={() => p.onSelect(chat)}
              >
                <Avatar contact={chat.contact} />
                <span className="chat-item-content">
                  <span className="chat-item-top">
                    <strong>
                      {chat.pinned && <Pin size={11} style={{ display: 'inline', marginRight: 4 }} />}
                      {chat.contact.name}
                    </strong>
                    <time>{chat.lastMessageAt ? time(chat.lastMessageAt) : ''}</time>
                  </span>
                  <span className="chat-preview">
                    {last?.direction === 'OUTBOUND' && <CheckCheck size={14} />}
                    <span>
                      {last?.text || last?.caption || (last ? 'Arquivo de mídia' : 'Comece uma conversa')}
                    </span>
                  </span>
                  <span className="chat-item-bottom">
                    {label && (
                      <span
                        className="tag"
                        style={{
                          color: label.color,
                          borderColor: `${label.color}55`,
                          background: `${label.color}14`,
                        }}
                      >
                        <i style={{ background: label.color }} />
                        {label.name}
                      </span>
                    )}
                    {preferences.waitingTimer && last?.direction === 'INBOUND' && chat.lastMessageAt && (
                      <small
                        className={
                          now - new Date(chat.lastMessageAt).getTime() >= preferences.waitingRed * 60000
                            ? 'wait-age urgent'
                            : now - new Date(chat.lastMessageAt).getTime() >=
                                preferences.waitingYellow * 60000
                              ? 'wait-age warning'
                              : 'wait-age'
                        }
                      >
                        {Math.max(0, Math.floor((now - new Date(chat.lastMessageAt).getTime()) / 60000))} min
                        aguardando
                      </small>
                    )}
                    {chat.unreadCount > 0 && <b className="unread-count">{chat.unreadCount}</b>}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="list-footer">
        <span>
          {p.total
            ? `${(p.page - 1) * 50 + 1}–${Math.min(p.page * 50, p.total)} de ${p.total}`
            : 'Sem conversas'}
        </span>
        <div>
          <button
            className="icon-button"
            disabled={p.page <= 1}
            aria-label="Página anterior"
            onClick={() => p.setPage(p.page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="icon-button"
            disabled={p.page * 50 >= p.total}
            aria-label="Próxima página"
            onClick={() => p.setPage(p.page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
