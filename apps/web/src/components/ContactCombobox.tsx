import { useId, useRef, useState, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import type { Conversation } from '../types';
import {
  validScheduledContacts,
  contactMatches,
  formatContactPhone,
  newContactPhone,
} from '../context/contact-search';
import { Avatar } from './ui';
import { useApi, errorMessage } from '../context/ApiContext';
export function ContactCombobox({
  people,
  value,
  onChange,
  onCreated,
  sessionId,
}: {
  people: Conversation[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (people: Conversation[]) => void;
  sessionId: string;
}) {
  const { request, notify } = useApi();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [remote, setRemote] = useState<Conversation[]>([]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void request<{ items: Conversation[] }>(
        `/operations/sessions/${sessionId}/contact-search?q=${encodeURIComponent(query)}`,
        'GET',
        undefined,
        controller.signal,
      )
        .then((data) => setRemote(data.items))
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, sessionId, request]);
  const valid = validScheduledContacts([
    ...people,
    ...remote.filter((item) => !people.some((existing) => existing.id === item.id)),
  ]);
  const matches = valid.filter((item) => contactMatches(item.contact, query)).slice(0, 40);
  const selected = valid.find((item) => item.id === value);
  const newPhone = newContactPhone(query);
  const canCreate = newPhone && !valid.some((item) => item.contact.phoneNumber === newPhone);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const choose = (item: Conversation) => {
    onChange(item.id);
    setQuery('');
    setOpen(false);
  };
  return (
    <div className="contact-picker" ref={ref}>
      <div className="contact-picker-input">
        <Search size={16} />
        <input
          aria-label="Contato para agendamento"
          role="combobox"
          aria-expanded={open}
          aria-controls={id}
          autoComplete="off"
          placeholder="Busque por nome ou telefone"
          value={open ? query : (selected?.contact.name ?? '')}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
            onChange('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
              );
            } else if (event.key === 'Enter' && open) {
              event.preventDefault();
              if (matches[active]) choose(matches[active]);
            }
          }}
        />
      </div>
      {selected && !open && <small>{formatContactPhone(selected.contact.phoneNumber)}</small>}
      {open && (
        <div className="contact-picker-options" role="listbox" id={id}>
          {matches.map((item, index) => (
            <button
              type="button"
              role="option"
              aria-selected={item.id === value}
              className={index === active ? 'keyboard-active' : ''}
              key={item.id}
              onClick={() => choose(item)}
            >
              <Avatar contact={item.contact} />
              <span>
                <strong>{item.contact.name}</strong>
                <small>{formatContactPhone(item.contact.phoneNumber)}</small>
                <span className="contact-picker-labels" aria-label="Etiquetas do cliente">
                  {(item.contact.labels ?? []).map(({ label }) => (
                    <span className="subtle-badge" key={label.id} style={{ borderColor: label.color }}>
                      {label.name}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="contact-picker-new"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void request(`/operations/sessions/${sessionId}/contacts`, 'POST', {
                  name: formatContactPhone(newPhone),
                  phoneNumber: newPhone,
                  tags: [],
                  optIn: false,
                  email: '',
                })
                  .then(() =>
                    request<{ items: Conversation[] }>(
                      `/operations/sessions/${sessionId}/contacts?search=${newPhone}`,
                    ),
                  )
                  .then((result) => {
                    onCreated(result.items);
                    const item = validScheduledContacts(result.items).find(
                      (item) => item.contact.phoneNumber === newPhone,
                    );
                    if (item) choose(item);
                    else throw new Error('Contato criado. Atualize a busca para selecioná-lo.');
                    notify('Contato preparado para agendamento. Nenhuma mensagem enviada.');
                  })
                  .catch((error) => notify(errorMessage(error), true))
                  .finally(() => setBusy(false));
              }}
            >
              <Plus size={17} />
              <span>
                Agendar para novo número<small>{formatContactPhone(newPhone)}</small>
              </span>
            </button>
          )}
          {!matches.length && !canCreate && (
            <p>Nenhum contato encontrado. Digite um telefone completo com DDD para cadastrar.</p>
          )}
        </div>
      )}
    </div>
  );
}
