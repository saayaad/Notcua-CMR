import { useEffect, useRef, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from './ui';

type Rule = {
  enabled: boolean;
  recordSale: boolean;
  askValue: boolean;
  fixedValueInCents: number;
  internalNote: string;
  pinConversation: boolean;
  investmentInCents: number;
};
type Row = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  rule: Rule;
  sales: number;
  revenueInCents: number;
  roiPercent: number | null;
};
type ActionInput = { confirmActions?: boolean; saleValueInCents?: number };
const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function cents(value: string) {
  const clean = value.trim().replace(/R\$|\s/g, '');
  const amount = Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean);
  return clean && Number.isFinite(amount) && amount >= 0 && amount <= 20_000_000
    ? Math.round(amount * 100)
    : NaN;
}
export function useLabelActions(sessionId: string) {
  const { request } = useApi();
  const [pending, setPending] = useState<Rule | null>(null),
    [value, setValue] = useState(''),
    [error, setError] = useState('');
  const finish = useRef<((value: ActionInput | null) => void) | null>(null);
  useEffect(
    () => () => {
      finish.current?.(null);
      finish.current = null;
    },
    [],
  );
  const prepare = async (labelId: string | null): Promise<ActionInput> => {
    if (!labelId) return {};
    const rule = await request<Rule>(
      `/operations/sessions/${sessionId}/label-rules/${encodeURIComponent(labelId)}`,
    );
    if (!rule.enabled || (!rule.recordSale && !rule.internalNote && !rule.pinConversation)) return {};
    setValue('');
    setError('');
    setPending(rule);
    const result = await new Promise<ActionInput | null>((resolve) => {
      finish.current = resolve;
    });
    if (!result) throw new Error('Aplicação da etiqueta cancelada. Nada foi alterado.');
    return result;
  };
  const complete = (result: ActionInput | null) => {
    finish.current?.(result);
    finish.current = null;
    setPending(null);
  };
  const prompt = pending && (
    <Modal
      title={pending.recordSale ? 'Registrar venda ao aplicar etiqueta' : 'Confirmar ações da etiqueta'}
      onClose={() => complete(null)}
    >
      {pending.recordSale && (
        <>
          <p>
            O negócio desta conversa será marcado como ganho. Ele terá uma única etiqueta de atribuição
            financeira, sem duplicar a venda.
          </p>
          {pending.askValue ? (
            <label>
              Qual foi o valor da venda? (R$)
              <input
                autoFocus
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Ex.: 89,90"
              />
            </label>
          ) : (
            <p>
              Valor configurado: <strong>{money(pending.fixedValueInCents)}</strong>
            </p>
          )}
        </>
      )}
      {pending.internalNote && <p>Nota interna: {pending.internalNote}</p>}
      {pending.pinConversation && <p>A conversa será fixada.</p>}
      <small className="muted">
        Nenhuma mensagem será enviada ao cliente. Retirar a etiqueta depois não estorna a venda; ajuste o
        negócio no CRM.
      </small>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button" onClick={() => complete(null)}>
          Cancelar
        </button>
        <button
          className="button primary"
          onClick={() => {
            const amount = pending.askValue ? cents(value) : pending.fixedValueInCents;
            if (pending.recordSale && (!Number.isInteger(amount) || amount <= 0)) {
              setError('Informe um valor de venda válido, maior que zero.');
              return;
            }
            complete({ confirmActions: true, ...(pending.recordSale ? { saleValueInCents: amount } : {}) });
          }}
        >
          Confirmar e aplicar etiqueta
        </button>
      </div>
    </Modal>
  );
  return { prepare, prompt };
}

function RuleEditor({
  row,
  sessionId,
  onClose,
  onSaved,
}: {
  row: Row;
  sessionId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, notify } = useApi();
  const [rule, setRule] = useState(row.rule),
    [busy, setBusy] = useState(false);
  const [fixed, setFixed] = useState((rule.fixedValueInCents / 100).toFixed(2)),
    [investment, setInvestment] = useState((rule.investmentInCents / 100).toFixed(2));
  return (
    <Modal title={`Ações · ${row.name}`} onClose={onClose}>
      <p>
        Estas ações só acontecem ao aplicar a etiqueta manualmente e confirmar. Não alteram conversas antigas.
      </p>
      <button
        className="button"
        onClick={() =>
          setRule((current) => ({ ...current, enabled: true, recordSale: true, askValue: true }))
        }
      >
        Usar modelo “Pagamento concluído”
      </button>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
        />
        Ativar ações desta etiqueta
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={rule.recordSale}
          onChange={(e) => setRule({ ...rule, recordSale: e.target.checked })}
        />
        Registrar venda e marcar negócio como ganho
      </label>
      {rule.recordSale && (
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={rule.askValue}
              onChange={(e) => setRule({ ...rule, askValue: e.target.checked })}
            />
            Perguntar o valor a cada venda
          </label>
          {!rule.askValue && (
            <label>
              Valor fixo (R$)
              <input inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} />
            </label>
          )}
        </>
      )}
      <label>
        Adicionar nota interna (opcional)
        <textarea
          rows={3}
          maxLength={2000}
          value={rule.internalNote}
          onChange={(e) => setRule({ ...rule, internalNote: e.target.value })}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={rule.pinConversation}
          onChange={(e) => setRule({ ...rule, pinConversation: e.target.checked })}
        />
        Fixar a conversa ao aplicar
      </label>
      <label>
        Investimento atribuído a esta etiqueta (R$)
        <input inputMode="decimal" value={investment} onChange={(e) => setInvestment(e.target.value)} />
      </label>
      <small className="muted">
        O ROI compara receita de vendas ganhas e investimento informado, em todo o histórico. Não representa
        lucro líquido.
      </small>
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => {
            const investmentInCents = cents(investment),
              fixedValueInCents = cents(fixed);
            if (!Number.isInteger(investmentInCents) || !Number.isInteger(fixedValueInCents)) {
              notify('Confira os valores informados.', true);
              return;
            }
            setBusy(true);
            void request(
              `/operations/sessions/${sessionId}/label-rules/${encodeURIComponent(row.id)}`,
              'PUT',
              { ...rule, investmentInCents, fixedValueInCents },
            )
              .then(() => {
                notify('Ações da etiqueta salvas.');
                onSaved();
              })
              .catch((e) => notify(errorMessage(e), true))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? <Spinner /> : 'Salvar ações'}
        </button>
      </div>
    </Modal>
  );
}
export function LabelFinance({ sessionId }: { sessionId: string }) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<Row[]>([]),
    [tick, setTick] = useState(0),
    [selected, setSelected] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError('');
    void request<{ items: Row[] }>(
      `/operations/sessions/${sessionId}/label-finance`,
      'GET',
      undefined,
      c.signal,
    )
      .then((data) => {
        if (!c.signal.aborted) setItems(data.items);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [sessionId, tick, request]);
  return (
    <section className="surface label-finance">
      <h3>Etiquetas, ações e receita</h3>
      <p className="muted">
        Uma venda é atribuída a uma etiqueta financeira. Totais usam negócios ganhos; reabrir ou perder o
        negócio retira seu valor da receita.
      </p>
      {loading && <Spinner />}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="label-finance-list">
        {items.map((row) => (
          <article key={row.id}>
            <div>
              <strong>
                <i style={{ background: row.color }} />
                {row.name}
                {row.archived ? ' · arquivada' : ''}
              </strong>
              <small>
                {row.sales} vendas · Receita {money(row.revenueInCents)} · Investimento{' '}
                {money(row.rule.investmentInCents)}
              </small>
              <small>
                {row.roiPercent === null
                  ? 'ROI: informe investimento'
                  : `Retorno estimado: ${row.roiPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
              </small>
            </div>
            <button className="button small" disabled={row.archived} onClick={() => setSelected(row)}>
              Configurar ações
            </button>
          </article>
        ))}
      </div>
      {!loading && !error && !items.length && (
        <p>Crie ou sincronize uma etiqueta para configurar suas ações.</p>
      )}
      {selected && (
        <RuleEditor
          row={selected}
          sessionId={sessionId}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setTick((x) => x + 1);
          }}
        />
      )}
    </section>
  );
}
export function LabelRulesButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button small" onClick={() => setOpen(true)}>
        Etiquetas e ações
      </button>
      {open && (
        <Modal title="Etiquetas e ações" wide onClose={() => setOpen(false)}>
          <LabelFinance sessionId={sessionId} />
        </Modal>
      )}
    </>
  );
}
