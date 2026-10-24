import { ContactWorkspace } from './ContactWorkspace';
import { useState } from 'react';
import { Check, Plus, Tag } from 'lucide-react';
import type { Conversation, Label } from '../types';
import { errorMessage, useApi } from '../context/ApiContext';
import { Avatar, Modal, phone, Spinner } from './ui';

export function ContactDetails({
  chat,
  labels,
  sessionId,
  onClose,
  onRefresh,
}: {
  chat: Conversation;
  labels: Label[];
  sessionId: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { request, notify } = useApi();
  const [note, setNote] = useState(chat.contact.metadata?.note ?? '');
  const [editingTags, setEditingTags] = useState(false);
  const [busy, setBusy] = useState('');
  const base = `/attendance/sessions/${sessionId}/conversations/${chat.id}`;
  const action = async (id: string, work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(id);
    try {
      await work();
      onRefresh();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal title="Informações do cliente" onClose={onClose}>
      <div className="contact-profile client-profile">
        <Avatar contact={chat.contact} size="large" />
        <h2>{chat.contact.name}</h2>
        <p>{phone(chat.contact.phoneNumber)}</p>
        <span className="subtle-badge">{chat.contact.isGroup ? 'Grupo' : 'Contato sincronizado'}</span>
      </div>
      <div className="client-section">
        <div className="section-label">
          <span>
            <Tag size={14} />
            ETIQUETAS
          </span>
          <button
            className="icon-button"
            aria-label="Editar etiquetas do cliente"
            onClick={() => setEditingTags(!editingTags)}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="tags-wrap">
          {chat.contact.labels.map(({ label }) => (
            <span
              key={label.id}
              className="tag"
              style={{ color: label.color, background: `${label.color}18`, borderColor: `${label.color}44` }}
            >
              <i style={{ background: label.color }} />
              {label.name}
            </span>
          ))}
          {!chat.contact.labels.length && <p className="muted">Sem etiquetas</p>}
        </div>
        {editingTags && (
          <div className="tag-picker">
            {labels.map((label) => {
              const active = chat.contact.labels.some((link) => link.labelId === label.id);
              return (
                <button
                  key={label.id}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void action(label.id, () =>
                      request(`${base}/labels/${encodeURIComponent(label.id)}`, 'PUT', { active: !active }),
                    )
                  }
                >
                  <i style={{ background: label.color }} />
                  {label.name}
                  {active && <Check size={15} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="client-section">
        <label htmlFor="client-note">Resumo do atendimento</label>
        <textarea
          id="client-note"
          rows={5}
          value={note}
          maxLength={5000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Adicione algo importante sobre este contato…"
        />
      </div>
      <ContactWorkspace chat={chat} sessionId={sessionId} onRefresh={onRefresh} />
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Fechar
        </button>
        <button
          className="button primary"
          disabled={Boolean(busy)}
          onClick={() =>
            void action('note', async () => {
              await request(base, 'PUT', { note });
              notify('Resumo salvo.');
            })
          }
        >
          {busy === 'note' ? <Spinner /> : <Check size={16} />}Salvar resumo
        </button>
      </div>
    </Modal>
  );
}
