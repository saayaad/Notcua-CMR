import { useEffect, useState } from 'react';
import { AlarmClock, Check, Pencil } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';
interface Action {
  title: string;
  dueAt: string;
  completed: boolean;
}
export function NextAction({
  sessionId,
  conversationId,
  revision,
  compact = false,
  onEdit,
}: {
  sessionId: string;
  conversationId: string;
  revision: number;
  compact?: boolean;
  onEdit?: () => void;
}) {
  const { request, notify } = useApi();
  const [action, setAction] = useState<Action | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const path = `/operations/sessions/${sessionId}/contacts/${conversationId}/next-action`;
  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      void request<Action | null>(path, 'GET', undefined, controller.signal)
        .then((value) => {
          setAction(value);
          setTitle(value?.title ?? '');
          const date = value ? new Date(value.dueAt) : new Date(Date.now() + 3600000);
          setDue(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        })
        .catch((error) => {
          if (!controller.signal.aborted) notify(errorMessage(error), true);
        });
    load();
    window.addEventListener('noctua:next-action', load);
    return () => {
      controller.abort();
      window.removeEventListener('noctua:next-action', load);
    };
  }, [path, revision, tick, request, notify]);
  const save = async (completed: boolean) => {
    if (!title.trim() || !due) return;
    setBusy(true);
    try {
      await request(path, 'PUT', { title, dueAt: new Date(due).toISOString(), completed });
      window.dispatchEvent(new Event('noctua:next-action'));
      setTick((value) => value + 1);
      notify(completed ? 'Próxima ação concluída.' : 'Próxima ação salva com lembrete.');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  if (compact)
    return action && !action.completed ? (
      <div className={`next-action-banner ${new Date(action.dueAt) < new Date() ? 'overdue' : ''}`}>
        <AlarmClock size={15} />
        <button onClick={onEdit}>
          <strong>{action.title}</strong>
          <span>
            {new Date(action.dueAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </button>
        <button
          className="icon-button"
          aria-label="Concluir próxima ação"
          disabled={busy}
          onClick={() => void save(true)}
        >
          <Check size={15} />
        </button>
      </div>
    ) : null;
  return (
    <form
      className="next-action-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <div className="tool-section-intro">
        <AlarmClock size={23} />
        <h3>Próxima ação</h3>
        <p>Defina o próximo passo deste atendimento e quando quer ser lembrado.</p>
      </div>
      <label>
        O que precisa fazer?
        <input
          required
          maxLength={300}
          placeholder="Ex.: Cobrar comprovante ou retornar orçamento"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Data e horário
        <input required type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} />
      </label>
      <small className="muted">
        O lembrete aparece nos avisos da operação. O servidor precisa estar ligado para processá-lo.
      </small>
      {action?.completed && (
        <p className="notice">A ação anterior foi concluída. Você pode cadastrar o próximo passo.</p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? <Spinner /> : <Pencil size={15} />}Salvar próxima ação
      </button>
      {action && !action.completed && (
        <button type="button" className="button" disabled={busy} onClick={() => void save(true)}>
          <Check size={15} />
          Marcar como concluída
        </button>
      )}
    </form>
  );
}
