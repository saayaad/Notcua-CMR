import type { Label } from '../../types';
import { useState } from 'react';
import { FlaskConical, CheckCircle2 } from 'lucide-react';
import { useApi, errorMessage } from '../../context/ApiContext';
import { Modal, Spinner } from '../../components/ui';
import type { FlowGraph } from './flow.types';
export function FlowSimulation({
  base,
  graph,
  labels,
  onClose,
}: {
  labels: Label[];
  base: string;
  graph: FlowGraph;
  onClose: () => void;
}) {
  const { request, notify } = useApi();
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [text, setText] = useState('oi');
  const [answers, setAnswers] = useState('');
  const [expire, setExpire] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    matches: boolean;
    sends: number;
    trace: { nodeId: string; title: string; action: string; text?: string }[];
  } | null>(null);
  return (
    <Modal title="Simular fluxo sem enviar mensagens" onClose={onClose} wide>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void request<typeof result>(`${base}/simulate`, 'POST', {
            graph,
            text,
            replies: answers ? answers.split('\n') : [],
            expire,
            labelIds,
          })
            .then(setResult)
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        <p className="muted">
          Usa um contato fictício. Nenhuma mensagem será enviada ao WhatsApp e nenhuma execução real será
          criada.
        </p>
        <fieldset>
          <legend>Etiquetas do contato fictício</legend>
          {labels.map((label) => (
            <label className="checkbox" key={label.id}>
              <input
                type="checkbox"
                checked={labelIds.includes(label.id)}
                onChange={(event) =>
                  setLabelIds(
                    event.target.checked ? [...labelIds, label.id] : labelIds.filter((id) => id !== label.id),
                  )
                }
              />
              {label.name}
            </label>
          ))}
        </fieldset>
        <label>
          Mensagem inicial
          <input value={text} maxLength={1000} onChange={(event) => setText(event.target.value)} />
        </label>
        <label>
          Respostas simuladas (uma por linha)
          <textarea
            rows={3}
            value={answers}
            onChange={(event) => setAnswers(event.target.value)}
            placeholder={'sim\ntenho interesse'}
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={expire} onChange={(event) => setExpire(event.target.checked)} />
          Simular falta de resposta quando acabarem as respostas acima
        </label>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Fechar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Spinner /> : <FlaskConical size={16} />}Executar simulação
          </button>
        </div>
      </form>
      {result && (
        <div className="flow-simulation-result">
          <h3>
            <CheckCircle2 size={17} />
            {result.matches
              ? `${result.sends} envios simulados · nenhum envio real`
              : 'O gatilho não foi acionado'}
          </h3>
          <ol>
            {result.trace.map((step, index) => (
              <li key={`${index}:${step.nodeId}`}>
                <strong>{step.title}</strong>
                <span>{step.action}</span>
                {step.text && <p>{step.text}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}
