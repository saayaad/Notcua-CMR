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
  speedMultiplier?: 1 | 1.5 | 2;
  remainingMessages?: number;
  estimatedRemainingSeconds?: number;
  nextAllowedAt?: string;
  nextTaskAt?: string;
  counts: { status: string; _count: number }[];
  batchSize?: number;
  sentTotal?: number;
  batchNumber?: number;
  approaches?: string[];
  variationNames?: string[];
  pauseEvery?: number;
  pauseSeconds?: number;
  ctaMessages?: { keyword: string; replyText: string }[];
  followUpMessages?: { waitMinutes: number; text: string }[];
  sendWindow?: { timezone: string; days: number[]; start: string; end: string };
}
interface ApproachStats {
  index: number;
  name: string;
  sent: number;
  replied: number;
  responseRate: number;
}
function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}min`;
  if (minutes) return `${minutes}min ${total % 60}s`;
  return `${total}s`;
}
export function CampaignMonitor({ sessionId, connected }: { sessionId: string; connected: boolean }) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<Batch[]>([]);
  const [now, setNow] = useState(Date.now());
  const [minimized, setMinimized] = useState(false);
  const [cancel, setCancel] = useState<Batch | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [nextBatchSize, setNextBatchSize] = useState(50);
  const [nextApproaches, setNextApproaches] = useState<string[]>([]);
  const [nextMinSeconds, setNextMinSeconds] = useState(15);
  const [nextMaxSeconds, setNextMaxSeconds] = useState(45);
  const [nextSpeedMultiplier, setNextSpeedMultiplier] = useState<1 | 1.5 | 2>(1);
  const [nextPauseEvery, setNextPauseEvery] = useState(0);
  const [nextPauseSeconds, setNextPauseSeconds] = useState(300);
  const [nextCtas, setNextCtas] = useState<{ keyword: string; replyText: string }[]>([]);
  const [nextFollowUps, setNextFollowUps] = useState<{ waitMinutes: number; text: string }[]>([]);
  const [limitHours, setLimitHours] = useState(false);
  const [hoursStart, setHoursStart] = useState('09:00');
  const [hoursEnd, setHoursEnd] = useState('18:00');
  const [hoursTimezone, setHoursTimezone] = useState('America/Sao_Paulo');
  const [hoursDays, setHoursDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [approachStats, setApproachStats] = useState<Record<string, ApproachStats[]>>({});
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
        .then((data) => {
          const campaigns = data.items.filter(
            (item) =>
              item.mode === 'CAMPAIGN' &&
              ['ACTIVE', 'PAUSED', 'PAUSED_CONNECTION', 'BATCH_COMPLETE'].includes(item.status),
          );
          setItems(campaigns);
          for (const batch of campaigns.filter((item) => item.approaches?.length))
            void request<{ items: ApproachStats[] }>(
              `/operations/sessions/${sessionId}/batches/${batch.id}/approaches`,
            )
              .then((result) => setApproachStats((current) => ({ ...current, [batch.id]: result.items })))
              .catch(() => undefined);
        })
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
  const continueBatch = async () => {
    if (!editing) return;
    setBusy(true);
    const scaleDelay = (seconds: number, minimum = 0) => Math.max(minimum, Math.floor(seconds / nextSpeedMultiplier));
    try {
      await request(`/operations/sessions/${sessionId}/batches/${editing.id}/continue`, 'POST', {
        batchSize: nextBatchSize,
        approaches: nextApproaches,
        minSeconds: scaleDelay(nextMinSeconds, 1),
        maxSeconds: scaleDelay(nextMaxSeconds, 1),
        speedMultiplier: nextSpeedMultiplier,
        pauseEvery: nextPauseEvery,
        pauseSeconds: scaleDelay(nextPauseSeconds),
        ctas: nextCtas,
        followUps: nextFollowUps,
        sendWindow: limitHours
          ? { timezone: hoursTimezone, days: hoursDays, start: hoursStart, end: hoursEnd }
          : null,
      });
      setEditing(null);
      notify('Próximo lote iniciado. Os contatos já processados permanecem excluídos.');
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
          const sent =
            item.sentTotal ?? item.counts.find((count) => count.status === 'COMPLETED')?._count ?? 0;
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
          const remainingLeads = Math.max(0, item.count - sent);
          const estimatedSeconds = item.estimatedRemainingSeconds ?? Math.ceil(
            seconds + Math.max(0, remainingLeads - 1) * ((item.minSeconds + item.maxSeconds) / 2),
          );
          const eta = formatDuration(estimatedSeconds);
          return (
            <section key={item.id}>
              <strong>{item.name}</strong>
              <span>
                Enviados: {sent} de {item.count}
                {item.sentTotal !== undefined ? ` · Restantes: ${Math.max(0, item.count - sent)}` : ''}
              </span>
              <progress value={sent} max={Math.max(item.count, 1)} />
              {item.status !== 'BATCH_COMPLETE' && (item.remainingMessages ?? remainingLeads) > 0 && (
                <small>
                  Tempo estimado até finalizar: ~{eta} ·{' '}
                  {item.remainingMessages !== undefined
                    ? `${item.remainingMessages} mensagens restantes`
                    : `${remainingLeads} contatos restantes`}
                </small>
              )}
              {approachStats[item.id]?.map((stat) => (
                <small key={stat.index}>
                  {stat.name}: {stat.sent} enviados · {stat.replied} respostas (
                  {Math.round(stat.responseRate * 100)}%)
                </small>
              ))}
              <small>
                {item.status === 'BATCH_COMPLETE'
                  ? 'Lote concluído, aguardando próximo'
                  : item.status === 'PAUSED_CONNECTION'
                    ? 'Pausada por falha de conexão'
                    : item.status === 'PAUSED'
                      ? 'Pausada'
                      : running
                        ? 'Envio em andamento'
                        : seconds
                          ? `Próximo envio em ${seconds}s${connected ? '' : ' · aguardando conexão do WhatsApp'}`
                          : connected
                            ? 'Preparando próximo envio'
                            : 'Aguardando conexão do WhatsApp'}
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
                <span>{pressure}{item.speedMultiplier ? ` · ${item.speedMultiplier}×` : ''}</span>
              </div>
              <div className="campaign-monitor-actions">
                {item.status === 'BATCH_COMPLETE' && (
                  <button
                    className="button small"
                    disabled={busy}
                    onClick={() => {
                      setEditing(item);
                      setNextBatchSize(item.batchSize ?? 50);
                      setNextApproaches(item.approaches ?? []);
                      const multiplier = item.speedMultiplier ?? 1;
                      setNextMinSeconds(Math.round(item.minSeconds * multiplier));
                      setNextMaxSeconds(Math.round(item.maxSeconds * multiplier));
                      setNextSpeedMultiplier(item.speedMultiplier ?? 1);
                      setNextPauseEvery(item.pauseEvery ?? 0);
                      setNextPauseSeconds(Math.round((item.pauseSeconds ?? 300) * multiplier));
                      setNextCtas(item.ctaMessages ?? []);
                      setNextFollowUps(item.followUpMessages ?? []);
                      setLimitHours(Boolean(item.sendWindow));
                      setHoursStart(item.sendWindow?.start ?? '09:00');
                      setHoursEnd(item.sendWindow?.end ?? '18:00');
                      setHoursTimezone(item.sendWindow?.timezone ?? 'America/Sao_Paulo');
                      setHoursDays(item.sendWindow?.days ?? [1, 2, 3, 4, 5]);
                    }}
                  >
                    Editar e continuar próximo lote
                  </button>
                )}
                {item.status !== 'BATCH_COMPLETE' && (
                  <button
                    className="button small"
                    disabled={busy}
                    onClick={() =>
                      void change(
                        item,
                        ['PAUSED', 'PAUSED_CONNECTION'].includes(item.status) ? 'ACTIVE' : 'PAUSED',
                      )
                    }
                  >
                    {['PAUSED', 'PAUSED_CONNECTION'].includes(item.status) ? (
                      <Play size={14} />
                    ) : (
                      <Pause size={14} />
                    )}{' '}
                    {['PAUSED', 'PAUSED_CONNECTION'].includes(item.status) ? 'Retomar' : 'Pausar'}
                  </button>
                )}
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
      {editing && (
        <Modal title="Revisar próximo lote" onClose={() => setEditing(null)}>
          <p>O público fica congelado na ordem original; os contatos já enviados não entram novamente.</p>
          <label>
            Tamanho do próximo lote
            <input
              type="number"
              min={1}
              max={5000}
              value={nextBatchSize}
              onChange={(event) => setNextBatchSize(Number(event.target.value))}
            />
          </label>
          {nextApproaches.map((text, index) => (
            <label key={index}>
              {editing.variationNames?.[index] ?? `Variação ${index + 1}`}
              <textarea
                maxLength={10000}
                value={text}
                onChange={(event) =>
                  setNextApproaches((current) =>
                    current.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
              />
            </label>
          ))}
          <div className="form-grid">
            <label>
              Intervalo mínimo (s)
              <input
                type="number"
                min={1}
                value={nextMinSeconds}
                onChange={(event) => setNextMinSeconds(Number(event.target.value))}
              />
            </label>
            <label>
              Intervalo máximo (s)
              <input
                type="number"
                min={nextMinSeconds}
                value={nextMaxSeconds}
                onChange={(event) => setNextMaxSeconds(Number(event.target.value))}
              />
            </label>
            <label>
              Pausa longa a cada (0 desativa)
              <input
                type="number"
                min={0}
                value={nextPauseEvery}
                onChange={(event) => setNextPauseEvery(Number(event.target.value))}
              />
            </label>
            <label>
              Duração da pausa longa (s)
              <input
                type="number"
                min={0}
                value={nextPauseSeconds}
                onChange={(event) => setNextPauseSeconds(Number(event.target.value))}
              />
            </label>
            <label>
              Velocidade do próximo lote
              <select
                value={nextSpeedMultiplier}
                onChange={(event) => setNextSpeedMultiplier(Number(event.target.value) as 1 | 1.5 | 2)}
              >
                <option value={1}>Normal (1×)</option>
                <option value={1.5}>Acelerado (1,5×)</option>
                <option value={2}>Mais rápido (2×)</option>
              </select>
            </label>
          </div>
          <h3>Respostas de CTA</h3>
          {nextCtas.map((cta, index) => (
            <div className="form-grid" key={index}>
              <label>
                Palavra-chave
                <input
                  required
                  value={cta.keyword}
                  onChange={(event) =>
                    setNextCtas((current) =>
                      current.map((row, i) => (i === index ? { ...row, keyword: event.target.value } : row)),
                    )
                  }
                />
              </label>
              <label>
                Resposta automática
                <input
                  required
                  value={cta.replyText}
                  onChange={(event) =>
                    setNextCtas((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, replyText: event.target.value } : row,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() => setNextCtas((current) => current.filter((_row, i) => i !== index))}
              >
                Remover CTA
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button small"
            disabled={nextCtas.length >= 20}
            onClick={() => setNextCtas((current) => [...current, { keyword: '', replyText: '' }])}
          >
            Adicionar CTA
          </button>
          <h3>Follow-up</h3>
          {nextFollowUps.map((step, index) => (
            <div className="form-grid" key={index}>
              <label>
                Aguardar (minutos)
                <input
                  type="number"
                  min={1}
                  value={step.waitMinutes}
                  onChange={(event) =>
                    setNextFollowUps((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, waitMinutes: Number(event.target.value) } : row,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Mensagem
                <textarea
                  required
                  maxLength={10000}
                  value={step.text}
                  onChange={(event) =>
                    setNextFollowUps((current) =>
                      current.map((row, i) => (i === index ? { ...row, text: event.target.value } : row)),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() => setNextFollowUps((current) => current.filter((_row, i) => i !== index))}
              >
                Remover follow-up
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button small"
            disabled={nextFollowUps.length >= 100}
            onClick={() => setNextFollowUps((current) => [...current, { waitMinutes: 60, text: '' }])}
          >
            Adicionar follow-up
          </button>
          <label>
            <input
              type="checkbox"
              checked={limitHours}
              onChange={(event) => setLimitHours(event.target.checked)}
            />{' '}
            Restringir horário permitido
          </label>
          {limitHours && (
            <div className="form-grid">
              <label>
                Fuso horário
                <input value={hoursTimezone} onChange={(event) => setHoursTimezone(event.target.value)} />
              </label>
              <label>
                Início
                <input
                  type="time"
                  value={hoursStart}
                  onChange={(event) => setHoursStart(event.target.value)}
                />
              </label>
              <label>
                Fim
                <input type="time" value={hoursEnd} onChange={(event) => setHoursEnd(event.target.value)} />
              </label>
              <label>
                Dias (0 domingo a 6 sábado)
                <input
                  value={hoursDays.join(',')}
                  onChange={(event) =>
                    setHoursDays(
                      event.target.value
                        .split(',')
                        .map(Number)
                        .filter((day) => day >= 0 && day <= 6),
                    )
                  }
                />
              </label>
            </div>
          )}
          <div className="modal-actions">
            <button className="button" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                nextApproaches.some((text) => !text.trim()) ||
                nextMaxSeconds < nextMinSeconds ||
                nextCtas.some((cta) => !cta.keyword.trim() || !cta.replyText.trim()) ||
                nextFollowUps.some((step) => !step.text.trim()) ||
                (limitHours && (!hoursDays.length || hoursStart >= hoursEnd))
              }
              onClick={() => void continueBatch()}
            >
              Continuar próximo lote
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
