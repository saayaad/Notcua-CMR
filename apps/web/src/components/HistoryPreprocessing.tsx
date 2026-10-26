import { useEffect, useRef, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';

type Result = {
  total: number; done: boolean; snapshot: string; nextCursor?: string; fatal?: boolean;
  item?: { id: string; type: string; status: string; error?: string };
};
export function HistoryPreprocessing({ sessionId, conversationIds, disabled, onBusyChange }: {
  sessionId: string; conversationIds: string[]; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const { request } = useApi();
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, reused: 0 });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const controller = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; controller.current?.abort(); onBusyChange(false); };
  }, [onBusyChange]);
  const run = async () => {
    if (!consent || running || !conversationIds.length) return;
    const abort = new AbortController(); controller.current = abort;
    setRunning(true); onBusyChange(true); setWarnings([]); setStatus('Preparando as mídias selecionadas…');
    setProgress({ processed: 0, total: 0, reused: 0 });
    let cursor: string | undefined; let snapshot: string | undefined;
    let processed = 0; let reused = 0;
    try {
      while (!abort.signal.aborted) {
        const result = await request<Result>(`/operations/sessions/${sessionId}/history-preprocessing`, 'POST', {
          conversationIds, consent: true, cursor, snapshot,
        }, abort.signal);
        if (!active.current || abort.signal.aborted) break;
        snapshot = result.snapshot;
        if (result.item) {
          processed++; if (result.item.status === 'CACHED') reused++;
          if (result.item.error) setWarnings(current => [...current, `${result.item!.id}: ${result.item!.error}`]);
        }
        setProgress({ processed, total: result.total, reused });
        if (result.fatal) { setStatus('Interrompido por configuração ou limite da IA. As análises concluídas foram preservadas. Você ainda pode exportar os dados disponíveis.'); break; }
        if (result.done) { setStatus('Pré-processamento concluído. Confira eventuais avisos e exporte o histórico.'); break; }
        if (!result.nextCursor || result.nextCursor === cursor) throw new Error('Não foi possível avançar no histórico.');
        cursor = result.nextCursor;
        setStatus('Analisando um arquivo por vez…');
      }
    } catch (error) {
      if (active.current && !abort.signal.aborted) setStatus(errorMessage(error));
    } finally {
      if (active.current && controller.current === abort) { setRunning(false); onBusyChange(false); }
    }
  };
  return <section className="surface" aria-label="Pré-processamento multimídia">
    <h3>Preparar transcrições e descrições</h3>
    <p className="muted">Opcional: analisa áudios, imagens, vídeos e PDFs das conversas selecionadas. Reutiliza análises salvas e preserva as concluídas ao cancelar. Arquivos expirados, incompatíveis ou de visualização única não são enviados à IA.</p>
    <label className="checkbox"><input type="checkbox" checked={consent} disabled={disabled || running} onChange={event => setConsent(event.target.checked)}/>
      Autorizo enviar as mídias dessas conversas ao provedor de IA configurado. Pode consumir cota e gerar custo na conta do provedor.
    </label>
    <div className="operation-actions">
      <button type="button" className="button" disabled={disabled || running || !consent || !conversationIds.length} onClick={() => void run()}>{running && <Spinner/>}Analisar mídias antes de exportar</button>
      {running && <button type="button" className="button" onClick={() => {
        controller.current?.abort(); setRunning(false); onBusyChange(false);
        setStatus('Cancelado. O arquivo já iniciado pode terminar no servidor; nenhum próximo arquivo será iniciado por esta tarefa.');
      }}>Cancelar análise</button>}
    </div>
    {status && <p role="status">{status}</p>}
    {progress.total > 0 && <><progress max={progress.total} value={progress.processed}/><small>{progress.processed} de {progress.total} mídias conferidas · {progress.reused} análises reutilizadas</small></>}
    {warnings.length > 0 && <details><summary>{warnings.length} arquivo(s) com aviso</summary>{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details>}
  </section>;
}
