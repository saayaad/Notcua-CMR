import { useEffect, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal } from './ui';
import type { FlowRun, FlowSummary } from '../pages/flows/flow.types';
import { executionNames } from '../pages/flows/flow.types';
export function FlowLaunch({
  sessionId,
  conversationId,
  onClose,
}: {
  sessionId: string;
  conversationId: string;
  onClose: () => void;
}) {
  const { request, notify } = useApi();
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void request<{ items: FlowSummary[] }>(`/automation/sessions/${sessionId}/flows`)
      .then((data) => setFlows(data.items.filter((item) => item.enabled)))
      .catch((error) => notify(errorMessage(error), true));
  }, [sessionId, request, notify]);
  return (
    <Modal title="Iniciar fluxo nesta conversa" onClose={onClose}>
      <p className="muted">
        A execução usa a versão publicada e pode enviar mensagens ao cliente. A etiqueta inicial também será
        aplicada.
      </p>
      <label>
        Fluxo
        <select value={id} onChange={(event) => setId(event.target.value)}>
          <option value="">Selecione um fluxo ativo</option>
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>
      </label>
      {!flows.length && (
        <p className="notice">Publique e ative um fluxo em Autoatendimento antes de iniciar.</p>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={!id || busy}
          onClick={() => {
            setBusy(true);
            void request(`/automation/sessions/${sessionId}/flows/${id}/launch`, 'POST', { conversationId })
              .then(() => {
                notify('Fluxo iniciado.');
                onClose();
              })
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        >
          Iniciar fluxo
        </button>
      </div>
    </Modal>
  );
}
export function FlowIndicator({
  sessionId,
  conversationId,
  revision,
}: {
  sessionId: string;
  conversationId: string;
  revision: number;
}) {
  const { request, notify } = useApi();
  const [run, setRun] = useState<FlowRun | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void request<{ items: FlowRun[] }>(
      `/automation/sessions/${sessionId}/runs?conversationId=${encodeURIComponent(conversationId)}`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) =>
        setRun(
          data.items.find((item) => ['QUEUED', 'RUNNING', 'WAITING_INPUT'].includes(item.status)) ?? null,
        ),
      )
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [sessionId, conversationId, revision, request, notify]);
  return (
    run && (
      <div className="flow-indicator">
        <span>
          <strong>{run.version.flow.name}</strong> · {executionNames[run.status]}
        </span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void request(`/automation/sessions/${sessionId}/runs/${run.id}/cancel`, 'POST')
              .then(() => setRun(null))
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        >
          Cancelar fluxo
        </button>
      </div>
    )
  );
}
