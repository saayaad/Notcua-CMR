import { useEffect, useState } from 'react';
import { Select } from './Select';
import { Modal, Spinner } from './ui';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Conversation } from '../types';
export function TransferDialog({
  chat,
  sessionId,
  onClose,
  onSaved,
}: {
  chat: Conversation;
  sessionId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, notify } = useApi();
  const [mode, setMode] = useState('MEMBER');
  const [target, setTarget] = useState('');
  const [members, setMembers] = useState<
    { email: string; name: string; department: string; avatar?: string; online?: boolean }[]
  >([]);
  const [departments, setDepartments] = useState<{ name: string }[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      void request<{ items: typeof members; departments: typeof departments }>(
        '/operations/directory',
        'GET',
        undefined,
        controller.signal,
      )
        .then((data) => {
          setMembers(data.items);
          setDepartments(data.departments);
        })
        .catch((error) => {
          if (!controller.signal.aborted) notify(errorMessage(error), true);
        });
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [request, notify]);
  return (
    <Modal
      title="Transferir atendimento"
      onClose={() => {
        if (!busy) onClose();
      }}
      className="transfer-dialog"
    >
      <p>
        Conversa: <strong>{chat.contact.name}</strong>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void request(`/operations/toolbox/sessions/${sessionId}/transfers`, 'POST', {
            conversationId: chat.id,
            target,
            targetType: mode,
            note,
          })
            .then(() => {
              notify('Transferência solicitada. A conversa será atribuída quando aceita.');
              onSaved();
              onClose();
            })
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        <div className="recipient-mode">
          <button
            type="button"
            aria-pressed={mode === 'MEMBER'}
            onClick={() => {
              setMode('MEMBER');
              setTarget('');
            }}
          >
            Atendente
          </button>
          <button
            type="button"
            aria-pressed={mode === 'DEPARTMENT'}
            onClick={() => {
              setMode('DEPARTMENT');
              setTarget('');
            }}
          >
            Fila de setor
          </button>
        </div>
        <label>
          {mode === 'MEMBER' ? 'Escolha um atendente' : 'Escolha um setor'}
          <Select searchable required value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Pesquisar e selecionar…</option>
            {mode === 'MEMBER'
              ? members.map((member) => (
                  <option value={member.email} key={member.email}>
                    <span className="recipient-card">
                      <span className="recipient-avatar">
                        {member.avatar ? (
                          <img src={member.avatar} alt="" />
                        ) : (
                          member.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span>
                        <strong>{member.name}</strong>
                        <small>
                          {member.department || 'Sem setor'} · {member.online ? 'Online' : 'Offline'}
                        </small>
                      </span>
                      <i className={member.online ? 'online' : 'offline'} />
                    </span>
                  </option>
                ))
              : departments.map((item) => (
                  <option value={item.name} key={item.name}>
                    {item.name}
                  </option>
                ))}
          </Select>
        </label>
        <label>
          Observações
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            rows={4}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy || !target}>
            {busy && <Spinner />}Solicitar transferência
          </button>
        </div>
      </form>
    </Modal>
  );
}
