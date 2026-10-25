import { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Sequence } from '../types';
import { Modal } from './ui';
export function SequenceMonitor({
  base,
  revision,
  onRefresh,
}: {
  base: string;
  revision: number;
  onRefresh: () => void;
}) {
  const { request, notify } = useApi();
  const [run, setRun] = useState<Sequence | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void request<{ items: Sequence[] }>(`${base}/sequences`, 'GET', undefined, controller.signal)
      .then((result) =>
        setRun(result.items.find((item) => ['QUEUED', 'RUNNING', 'PAUSED'].includes(item.status)) ?? null),
      )
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [base, revision, request, notify]);
  if (!run) return null;
  const change = async (operation: 'pause' | 'cancel') => {
    setBusy(true);
    try {
      await request(
        `${base}/sequences/${run.id}/${operation}`,
        'POST',
        operation === 'pause' ? { paused: run.status !== 'PAUSED' } : undefined,
      );
      setCancel(false);
      onRefresh();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const step = run.steps[run.position] as { send?: { kind?: string; text?: string } } | undefined;
  return (
    <>
      <div className="sequence-monitor">
        <span>
          <strong>{run.name}</strong>
          <small>
            Etapa {Math.min(run.position + 1, run.steps.length)} de {run.steps.length} ·{' '}
            {run.status === 'PAUSED'
              ? 'Pausado'
              : run.status === 'RUNNING'
                ? 'Enviando etapa atual'
                : `Próxima: ${step?.send?.kind === 'audio' ? 'áudio' : step?.send?.kind === 'text' ? 'texto' : 'ação'} · ${new Date(run.nextRunAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </small>
        </span>
        <button
          className="icon-button"
          disabled={busy || run.status === 'RUNNING'}
          title={run.status === 'PAUSED' ? 'Retomar sequência' : 'Pausar sequência'}
          aria-label={run.status === 'PAUSED' ? 'Retomar sequência' : 'Pausar sequência'}
          onClick={() => void change('pause')}
        >
          {run.status === 'PAUSED' ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <button
          className="icon-button"
          disabled={busy}
          title="Cancelar sequência"
          aria-label="Cancelar sequência"
          onClick={() => setCancel(true)}
        >
          <Square size={14} />
        </button>
      </div>
      {cancel && (
        <Modal title="Cancelar sequência" onClose={() => setCancel(false)}>
          <p>Cancelar as próximas etapas de “{run.name}”? Uma etapa já em envio pode terminar.</p>
          <div className="modal-actions">
            <button className="button" onClick={() => setCancel(false)}>
              Manter sequência
            </button>
            <button className="button danger" disabled={busy} onClick={() => void change('cancel')}>
              Cancelar próximas etapas
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
