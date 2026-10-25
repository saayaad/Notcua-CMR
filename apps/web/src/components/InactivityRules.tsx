import {Select} from './Select';
import { useEffect, useState } from 'react';
import { Plus, Play, Pause } from 'lucide-react';
import type { FlowSummary } from '../pages/flows/flow.types';
import type { Label } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal } from './ui';
interface Rule {
  id: string;
  name: string;
  flowId: string;
  labelId: string;
  inactiveMinutes: number;
  enabled: boolean;
}
export function InactivityRules({ sessionId }: { sessionId: string }) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<Rule[]>([]);
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [tick, setTick] = useState(0);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<Rule | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/operations/sessions/${sessionId}/inactivity-rules`;
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      request<{ items: Rule[] }>(base, 'GET', undefined, controller.signal),
      request<{ items: FlowSummary[] }>(
        `/automation/sessions/${sessionId}/flows`,
        'GET',
        undefined,
        controller.signal,
      ),
      request<{ items: Label[] }>(
        `/whatsapp/sessions/${sessionId}/labels`,
        'GET',
        undefined,
        controller.signal,
      ),
    ])
      .then(([rules, available, tags]) => {
        setItems(rules.items);
        setFlows(available.items.filter((item) => item.enabled));
        setLabels(tags.items);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [base, sessionId, tick, request, notify]);
  const toggle = (rule: Rule, enabled: boolean) => {
    setBusy(true);
    void request(`${base}/${rule.id}`, 'PUT', { enabled })
      .then(() => {
        setConfirm(null);
        setTick(tick + 1);
      })
      .catch((error) => notify(errorMessage(error), true))
      .finally(() => setBusy(false));
  };
  return (
    <section>
      <div className="flow-info">
        Inicie um fluxo quando uma conversa ficar sem interação pelo tempo configurado. Usa a versão publicada
        e ativa. Conversas com outra automação ou com saída de campanhas são ignoradas.
      </div>
      <button className="button primary" onClick={() => setCreating(true)}>
        <Plus size={15} />
        Nova regra de inatividade
      </button>
      <div className="batch-list" style={{ marginTop: 20 }}>
        {items.map((rule) => (
          <article className="surface" key={rule.id}>
            <div>
              <span className="flow-status">{rule.enabled ? 'Ativa' : 'Pausada'}</span>
              <h2>{rule.name}</h2>
              <p>
                {rule.inactiveMinutes >= 1440
                  ? `${rule.inactiveMinutes / 1440} dias`
                  : `${rule.inactiveMinutes} minutos`}{' '}
                sem interação · {flows.find((flow) => flow.id === rule.flowId)?.name ?? 'Fluxo selecionado'}
              </p>
            </div>
            <button
              className="button"
              disabled={busy}
              onClick={() => (rule.enabled ? toggle(rule, false) : setConfirm(rule))}
            >
              {rule.enabled ? <Pause size={14} /> : <Play size={14} />}
              {rule.enabled ? 'Pausar' : 'Ativar'}
            </button>
          </article>
        ))}
      </div>
      {!items.length && <p className="operation-empty">Nenhuma regra de inatividade cadastrada.</p>}
      {creating && (
        <Modal title="Regra de inatividade" onClose={() => setCreating(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy(true);
              void request(base, 'POST', {
                name: form.get('name'),
                flowId: form.get('flowId'),
                labelId: form.get('labelId'),
                inactiveMinutes: Math.round(Number(form.get('amount')) * Number(form.get('unit'))),
              })
                .then(() => {
                  setCreating(false);
                  setTick(tick + 1);
                  notify('Regra salva pausada. Ative para iniciar o monitoramento.');
                })
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Nome
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Fluxo ativo
              <Select name="flowId" required>
                <option value="">Selecione</option>
                {flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Etiqueta
              <Select name="labelId">
                <option value="">Todas as conversas individuais</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="form-grid">
              <label>
                Sem interação há pelo menos
                <input name="amount" type="number" min={1} max={3650} defaultValue={10} required />
              </label>
              <label>
                Unidade
                <Select name="unit" defaultValue="1440">
                  <option value="1440">Dias</option>
                  <option value="60">Horas</option>
                  <option value="1">Minutos</option>
                </Select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setCreating(false)}>
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                Salvar pausada
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal title="Ativar regra de inatividade" onClose={() => setConfirm(null)}>
          <p>
            A regra <strong>{confirm.name}</strong> poderá iniciar fluxos e enviar mensagens para conversas
            que já estejam inativas pelo tempo escolhido. O servidor precisa estar ligado.
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setConfirm(null)}>
              Voltar
            </button>
            <button className="button primary" disabled={busy} onClick={() => toggle(confirm, true)}>
              Confirmar ativação
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
