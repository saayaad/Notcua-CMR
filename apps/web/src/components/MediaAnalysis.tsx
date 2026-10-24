import { useEffect, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';
export function MediaAnalysis({ sessionId, conversationId }: { sessionId: string; conversationId: string }) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<
    { id: string; type: string; sentAt: string; analysis: { text: string } | null }[]
  >([]);
  const [id, setId] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const path = `/operations/sessions/${sessionId}/contacts/${conversationId}/media-analysis`;
  useEffect(() => {
    void request<{ items: typeof items }>(path)
      .then((data) => setItems(data.items))
      .catch((error) => notify(errorMessage(error), true));
  }, [path, request, notify]);
  const selected = items.find((item) => item.id === id);
  return (
    <details className="surface">
      <summary>Transcrever áudio ou descrever mídia</summary>
      <label>
        Arquivo da conversa
        <select value={id} onChange={(event) => setId(event.target.value)}>
          <option value="">Selecione uma mídia</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {new Date(item.sentAt).toLocaleString('pt-BR')} ·{' '}
              {/audio/.test(item.type) ? 'Áudio' : /image/.test(item.type) ? 'Imagem' : 'Vídeo'}
              {item.analysis ? ' · analisado' : ''}
            </option>
          ))}
        </select>
      </label>
      {selected?.analysis ? (
        <textarea readOnly rows={8} aria-label="Análise da mídia" value={selected.analysis.text} />
      ) : (
        <>
          <label className="checkbox">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            Enviar este arquivo ao provedor de IA configurado para análise
          </label>
          <button
            type="button"
            className="button"
            disabled={!id || !consent || busy}
            onClick={() => {
              setBusy(true);
              void request<{ text: string }>(path, 'POST', { messageId: id, consent: true })
                .then((analysis) =>
                  setItems((current) =>
                    current.map((item) => (item.id === id ? { ...item, analysis } : item)),
                  ),
                )
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            {busy && <Spinner />}Analisar mídia
          </button>
        </>
      )}
    </details>
  );
}
