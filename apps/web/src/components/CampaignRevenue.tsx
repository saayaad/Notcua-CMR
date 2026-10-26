import { useEffect, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from './ui';
type Sale = {
  conversationId: string;
  name: string;
  title: string;
  valueInCents: number;
  campaignId: string | null;
};
export function CampaignRevenue({
  sessionId,
  campaignId,
  onClose,
  onSaved,
}: {
  sessionId: string;
  campaignId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const base = `/operations/sessions/${sessionId}/batches/${campaignId}/revenue`;
  useEffect(() => {
    const controller = new AbortController();
    void request<{ items: Sale[]; selectedIds: string[] }>(base, 'GET', undefined, controller.signal)
      .then((result) => {
        setItems(result.items);
        setSelected(result.selectedIds);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [base, request]);
  return (
    <Modal
      title="Vincular vendas do CRM"
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        Escolha vendas ganhas atribuídas a esta campanha. Uma venda só pode pertencer a uma campanha. O total
        acompanha alterações no valor e deixa de contar se a venda for reaberta ou perdida.
      </p>
      <p className="muted">
        Salvar ativa a receita do CRM no financeiro desta campanha. Ela substitui a receita manual no cálculo,
        sem somar as duas.
      </p>
      <label>
        Buscar venda
        <input value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {busy ? (
        <Spinner />
      ) : (
        <div className="import-preview">
          {items
            .filter((item) => `${item.name} ${item.title}`.toLowerCase().includes(search.toLowerCase()))
            .map((item) => (
              <label className="checkbox" key={item.conversationId}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.conversationId)}
                  disabled={Boolean(item.campaignId && item.campaignId !== campaignId)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, item.conversationId]
                        : current.filter((id) => id !== item.conversationId),
                    )
                  }
                />
                <span>
                  {item.name} · {item.title} ·{' '}
                  {(item.valueInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  {item.campaignId && item.campaignId !== campaignId ? ' · vinculada a outra campanha' : ''}
                </span>
              </label>
            ))}
          {!items.length && <p>Nenhuma venda ganha nesta conexão.</p>}
        </div>
      )}
      <p>
        {selected.length} vendas selecionadas ·{' '}
        {(
          items
            .filter((item) => selected.includes(item.conversationId))
            .reduce((sum, item) => sum + item.valueInCents, 0) / 100
        ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
      <div className="modal-actions">
        <button className="button" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy || Boolean(error)}
          onClick={() => {
            setBusy(true);
            void request(base, 'PUT', { conversationIds: selected })
              .then(() => {
                notify('Vendas vinculadas. Receita do CRM atualizada.');
                onSaved();
              })
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        >
          Confirmar vínculos
        </button>
      </div>
    </Modal>
  );
}
