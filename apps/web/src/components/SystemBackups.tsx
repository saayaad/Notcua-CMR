import { useEffect, useState } from 'react';
import { Download, ShieldCheck, Plus } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
export function SystemBackups() {
  const { request, blob, notify } = useApi();
  const [items, setItems] = useState<{ id: string; filename: string; createdAt: string }[]>([]);
  const [automatic, setAutomatic] = useState(false);
  const [time, setTime] = useState('00:00');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    window.addEventListener('noctua:backup-imported', refresh);
    return () => window.removeEventListener('noctua:backup-imported', refresh);
  }, []);
  useEffect(() => {
    void request<{ items: typeof items; automatic: boolean; time: string }>('/operations/system-backups')
      .then((data) => {
        setItems(data.items);
        setAutomatic(data.automatic);
        setTime(data.time);
      })
      .catch((error) => notify(errorMessage(error), true));
  }, [tick, request, notify]);
  return (
    <div className="surface">
      <h2>
        <ShieldCheck size={18} /> Backup integral do sistema
      </h2>
      <p>
        Inclui banco de dados e chave das sessões em um ZIP privado. Guarde o arquivo em local seguro. A
        exportação de biblioteca abaixo continua disponível separadamente.
      </p>
      <label className="preference-row">
        <span>
          Backup automático diário
          <small>
            Uma cópia por dia, enquanto o servidor estiver ligado. As cópias ficam no disco do servidor.
          </small>
        </span>
        <input
          type="checkbox"
          checked={automatic}
          disabled={busy}
          onChange={(event) => {
            const value = event.target.checked;
            setBusy(true);
            void request('/operations/system-backups/settings', 'PUT', { automatic: value, time })
              .then(() => setAutomatic(value))
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        />
      </label>
      <label>
        Horário diário da cópia · São Paulo
        <input
          type="time"
          value={time}
          disabled={busy}
          onChange={(event) => setTime(event.target.value)}
          onBlur={() => {
            if (!time) return;
            setBusy(true);
            void request('/operations/system-backups/settings', 'PUT', { automatic, time })
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        />
      </label>
      <button
        className="button primary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void request('/operations/system-backups', 'POST')
            .then(() => {
              setTick(tick + 1);
              notify('Backup integral criado.');
            })
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        <Plus size={15} />
        Criar cópia agora
      </button>
      <div className="task-list">
        {items.map((item) => (
          <div key={item.id}>
            <strong>{new Date(item.createdAt).toLocaleString('pt-BR')}</strong>
            <button
              className="button small"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void blob(`/operations/system-backups/${encodeURIComponent(item.id)}/download`)
                  .then((file) => {
                    const url = URL.createObjectURL(file);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${item.filename}.zip`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                  .catch((error) => notify(errorMessage(error), true))
                  .finally(() => setBusy(false));
              }}
            >
              <Download size={14} />
              Baixar ZIP
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
