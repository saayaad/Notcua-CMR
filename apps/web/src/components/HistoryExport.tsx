import { AiOnly } from '../context/AiFeatures';
import { useEffect, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Conversation } from '../types';
import { Modal, Spinner } from './ui';
import { HistoryPreprocessing } from './HistoryPreprocessing';
export function HistoryExport({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { request, blob, notify } = useApi();
  const [rows, setRows] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [media, setMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void request<{ items: Conversation[]; total: number }>(
        `/operations/sessions/${sessionId}/contacts?search=${encodeURIComponent(search)}&assignedTo=${encodeURIComponent(owner)}&page=${page}`,
        'GET',
        undefined,
        controller.signal,
      )
        .then((result) => {
          setRows(result.items);
          setTotal(result.total);
        })
        .catch((error) => {
          if (!controller.signal.aborted) notify(errorMessage(error), true);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sessionId, search, owner, page, request, notify]);
  return (
    <Modal
      title="Exportar históricos para conhecimento"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <p>
        Selecione até 100 conversas. O ZIP inclui a ordem das mensagens, papéis cliente/atendente, JSONL, TXT
        e CSV, além das mídias e análises disponíveis.
      </p>
      <div className="form-grid">
        <label>
          Buscar contato
          <input
            disabled={busy}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Responsável atual · e-mail ou identificador
          <input
            disabled={busy}
            value={owner}
            placeholder="Opcional"
            onChange={(event) => {
              setOwner(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <p className="muted">
        O responsável atual filtra as conversas, sem atribuir todas as mensagens históricas a esse vendedor.
      </p>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={() =>
          setSelected((current) => [...new Set([...current, ...rows.map((row) => row.id)])].slice(0, 100))
        }
      >
        Selecionar esta página
      </button>
      <div className="import-preview">
        {rows.map((row) => (
          <label key={row.id} className="checkbox">
            <input
              type="checkbox"
              checked={selected.includes(row.id)}
              disabled={busy || (!selected.includes(row.id) && selected.length >= 100)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                )
              }
            />
            {row.contact.name}
          </label>
        ))}
      </div>
      <div className="operation-actions">
        <button type="button" className="button" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>Página {page}</span>
        <button
          type="button"
          className="button"
          disabled={busy || page * 100 >= total}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </button>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={media} onChange={(event) => setMedia(event.target.checked)} />
        Incluir arquivos de áudio, imagem e vídeo disponíveis
      </label>
      <p className="muted">
        Mídias expiradas ou de visualização única são identificadas como indisponíveis. O download do ZIP
        não envia dados à IA. A análise opcional abaixo exige autorização separada.
      </p>
      <AiOnly><HistoryPreprocessing sessionId={sessionId} conversationIds={selected} disabled={busy} onBusyChange={setBusy}/></AiOnly>
      <div className="modal-actions">
        <button type="button" className="button" disabled={busy} onClick={onClose}>
          Fechar
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy || !selected.length}
          onClick={async () => {
            setBusy(true);
            try {
              const file = await blob(
                `/operations/sessions/${sessionId}/history-export?ids=${encodeURIComponent(selected.join(','))}&media=${media}`,
              );
              const url = URL.createObjectURL(file);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'noctua-historicos.zip';
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              notify('Históricos exportados.');
            } catch (error) {
              notify(errorMessage(error), true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner />}Exportar {selected.length} conversas
        </button>
      </div>
    </Modal>
  );
}
