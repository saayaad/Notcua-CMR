import { useEffect, useState } from 'react';
import { Pause, Play, Square, ChevronDown, Send } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal } from './ui';
interface Batch {
  id: string;
  name: string;
  mode: string;
  status: string;
  count: number;
  minSeconds: number;
  maxSeconds: number;
  nextAllowedAt?: string;
  nextTaskAt?: string;
  counts: { status: string; _count: number }[];
}
export function CampaignMonitor({ sessionId, connected }: { sessionId: string; connected: boolean }) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<Batch[]>([]);
  const [now, setNow] = useState(Date.now());
  const [minimized, setMinimized] = useState(false);
  const [cancel, setCancel] = useState<Batch | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!sessionId) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const load = () =>
      void request<{ items: Batch[] }>(
        `/operations/sessions/${sessionId}/batches`,
        'GET',
        undefined,
        controller.signal,
      )
        .then((data) =>
          setItems(
            data.items.filter(
              (item) => item.mode === 'CAMPAIGN' && ['ACTIVE', 'PAUSED'].includes(item.status),
            ),
          ),
        )
        .catch(() => undefined);
    load();
    const poll = window.setInterval(load, 4000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      controller.abort();
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [sessionId, request]);
  const change = async (batch: Batch, status: string) => {
    setBusy(true);
    try {
      await request(`/operations/sessions/${sessionId}/batches/${batch.id}`, 'PUT', { status });
      setItems((current) =>
        current
          .map((item) => (item.id === batch.id ? { ...item, status } : item))
          .filter((item) => item.status !== 'CANCELLED'),
      );
      setCancel(null);
      notify(
        status === 'PAUSED'
          ? 'Campanha pausada.'
          : status === 'ACTIVE'
            ? 'Campanha retomada.'
            : 'Próximos envios cancelados.',
      );
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  if (!items.length) return null;
  if (minimized)
    return (
      <button className="campaign-monitor-pill" onClick={() => setMinimized(false)}>
        <Send size={15} />
        {items.length} campanha(s) em acompanhamento
      </button>
    );
  return (
    <>
      <aside className="campaign-monitor" aria-label="Monitor de campanhas">
        <header>
          <strong>Disparos em acompanhamento</strong>
          <button className="icon-button" aria-label="Minimizar monitor" onClick={() => setMinimized(true)}>
            <ChevronDown size={16} />
          </button>
        </header>
        {items.slice(0, 3).map((item) => {
          const sent = item.counts.find((count) => count.status === 'COMPLETED')?._count ?? 0;
          const failed = item.counts.find((count) => count.status === 'FAILED')?._count ?? 0;
          const running = item.counts.find((count) => count.status === 'RUNNING')?._count ?? 0;
          const seconds = Math.max(
            0,
            Math.ceil(
              (Math.max(
                new Date(item.nextAllowedAt ?? 0).getTime(),
                new Date(item.nextTaskAt ?? 0).getTime(),
              ) -
                now) /
                1000,
            ),
          );
          const pressure = failed
            ? 'Falhas: confira antes de retomar'
            : item.minSeconds < 15
              ? 'Intervalo curto'
              : item.minSeconds < 30
                ? 'Ritmo moderado'
                : 'Envios mais espaçados';
          return (
            <section key={item.id}>
              <strong>{item.name}</strong>
              <span>
                Enviados: {sent} de {item.count}
              </span>
              <progress value={sent} max={Math.max(item.count, 1)} />
              <small>
                {item.status === 'PAUSED'
                  ? 'Pausada'
                  : !connected
                    ? 'Aguardando conexão do WhatsApp'
                    : running
                      ? 'Envio em andamento'
                      : seconds
                        ? `Próximo envio em ${seconds}s`
                        : 'Preparando próximo envio'}
              </small>
              <div
                className="campaign-pace"
                title="Estimativa baseada no intervalo e nas falhas. Não mede nem garante proteção do número."
              >
                <i
                  className={
                    failed || item.minSeconds < 15
                      ? 'pace-high'
                      : item.minSeconds < 30
                        ? 'pace-medium'
                        : 'pace-low'
                  }
                />
                <span>{pressure}</span>
              </div>
              <div className="campaign-monitor-actions">
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => void change(item, item.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')}
                >
                  {item.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}{' '}
                  {item.status === 'PAUSED' ? 'Retomar' : 'Pausar'}
                </button>
                <button className="button small" disabled={busy} onClick={() => setCancel(item)}>
                  <Square size={13} />
                  Cancelar
                </button>
              </div>
            </section>
          );
        })}
      </aside>
      {cancel && (
        <Modal title="Cancelar próximos envios?" onClose={() => setCancel(null)}>
          <p>
            Os envios pendentes de <strong>{cancel.name}</strong> serão cancelados. Um envio que já começou
            pode terminar.
          </p>
          <div className="modal-actions">
            <button className="button" disabled={busy} onClick={() => setCancel(null)}>
              Voltar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void change(cancel, 'CANCELLED')}
            >
              Confirmar cancelamento
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
