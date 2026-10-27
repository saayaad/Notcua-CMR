import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from '../components/ui';
import { Select } from '../components/Select';

interface AccessKey {
  id: string;
  label: string;
  intendedEmail: string;
  suffix: string;
  months: number | null;
  trialDays: number | null;
  status: 'AVAILABLE' | 'ACTIVATED' | 'REVOKED';
  activatedAt: string | null;
  activatedEmail: string | null;
  expiresAt: string | null;
  activeLicense: boolean;
}
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não ativada';
export function AccessKeysPage() {
  const { request, notify } = useApi();
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('1');
  const [days, setDays] = useState(7);
  const [secret, setSecret] = useState('');
  const [revoke, setRevoke] = useState<AccessKey | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const previous = document.title;
    document.title = 'Noctua · Chaves de acesso';
    return () => {
      document.title = previous;
    };
  }, []);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setKeys((await request<{ items: AccessKey[] }>('/access/keys')).items);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [request]);
  return (
    <main className="access-keys-page">
      <header className="access-keys-header">
        <a className="button" href="/atendimento">
          <ArrowLeft size={16} />
          Voltar ao Noctua
        </a>
        <span>
          <ShieldCheck size={16} /> Área exclusiva do proprietário
        </span>
      </header>
      <section className="access-keys-title">
        <span className="access-keys-symbol">
          <KeyRound size={25} />
        </span>
        <div>
          <h1>Chaves de acesso</h1>
          <p>Gere acessos de teste e assinaturas para operações independentes.</p>
        </div>
      </section>
      {loading && !keys.length ? (
        <div className="surface">
          <Spinner />
          Consultando suas chaves…
        </div>
      ) : error ? (
        <section className="surface">
          <h2>Não foi possível abrir esta área</h2>
          <p role="alert">{error}</p>
          <button className="button" onClick={() => void load()}>
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          <section className="surface access-keys-form">
            <h2>
              <Plus size={18} /> Gerar nova chave
            </h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (busy) return;
                setBusy(true);
                void request<{ secret: string }>('/access/keys', 'POST', {
                  label: label.trim(),
                  intendedEmail: email.trim(),
                  months: plan === 'trial' ? null : Number(plan),
                  trialDays: plan === 'trial' ? days : null,
                })
                  .then(async (result) => {
                    setSecret(result.secret);
                    setLabel('');
                    setEmail('');
                    await load();
                  })
                  .catch((failure) => notify(errorMessage(failure), true))
                  .finally(() => setBusy(false));
              }}
            >
              <label>
                Identificação do cliente
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  required
                  maxLength={120}
                  placeholder="Ex.: Cliente — Empresa"
                />
              </label>
              <label>
                E-mail reservado (opcional)
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  placeholder="Vazio: a primeira conta que ativar fica com a chave"
                />
              </label>
              <label>
                Validade
                <Select value={plan} onChange={(event) => setPlan(event.target.value)}>
                  <option value="trial">Teste por dias</option>
                  <option value="1">1 mês</option>
                  <option value="3">3 meses</option>
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                </Select>
              </label>
              {plan === 'trial' && (
                <label>
                  Dias de teste
                  <input
                    type="number"
                    value={days}
                    min={1}
                    max={30}
                    required
                    onChange={(event) => setDays(Number(event.target.value))}
                  />
                </label>
              )}
              <button className="button primary" disabled={busy || !label.trim()}>
                <KeyRound size={16} />
                {busy ? 'Gerando…' : 'Gerar chave'}
              </button>
            </form>
            <p>
              Cada chave é de uso único. O prazo começa na ativação. Uma nova chave na mesma conta renova sua
              operação, preservando os dados.
            </p>
          </section>
          <section className="surface">
            <div className="access-keys-list-heading">
              <h2>
                Chaves geradas <small>{keys.length}</small>
              </h2>
              <button className="button" disabled={loading} onClick={() => void load()}>
                <RefreshCw size={15} />
                Atualizar
              </button>
            </div>
            <input
              aria-label="Buscar chaves"
              placeholder="Buscar cliente, e-mail ou final da chave…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={120}
            />
            {!keys.length && (
              <p className="access-keys-empty">Nenhuma chave gerada. Crie a primeira acima.</p>
            )}
            <div className="access-keys-list">
              {keys
                .filter((key) =>
                  `${key.label} ${key.intendedEmail} ${key.suffix}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((key) => (
                  <article className="access-key-card" key={key.id}>
                    <div>
                      <strong>{key.label}</strong>
                      <span>
                        {key.activatedEmail || key.intendedEmail || 'Sem reserva de e-mail'} · final{' '}
                        {key.suffix}
                      </span>
                      <small>
                        {key.months
                          ? `${key.months} ${key.months === 1 ? 'mês' : 'meses'}`
                          : `Teste de ${key.trialDays} dias`}{' '}
                        ·{' '}
                        {key.status === 'AVAILABLE'
                          ? 'Disponível'
                          : key.status === 'REVOKED'
                            ? 'Revogada'
                            : key.activeLicense
                              ? 'Ativada'
                              : 'Ativada · acesso vencido ou suspenso'}
                      </small>
                      {key.activatedAt && (
                        <small>
                          Ativação: {date(key.activatedAt)} · Validade da operação: {date(key.expiresAt)}
                        </small>
                      )}
                    </div>
                    <button
                      className="button danger"
                      disabled={key.status === 'REVOKED' || busy}
                      onClick={() => setRevoke(key)}
                    >
                      <ShieldX size={15} />
                      Revogar
                    </button>
                  </article>
                ))}
            </div>
          </section>
        </>
      )}
      {secret && (
        <Modal title="Chave gerada" onClose={() => setSecret('')}>
          <p>
            Copie agora e entregue ao cliente. Por segurança, o código completo não poderá ser consultado
            novamente.
          </p>
          <output className="access-key-secret">{secret}</output>
          <button
            className="button primary"
            onClick={() => {
              void navigator.clipboard
                .writeText(secret)
                .then(() => notify('Chave copiada.'))
                .catch(() =>
                  notify('Não foi possível copiar. Selecione o código e copie manualmente.', true),
                );
            }}
          >
            <Copy size={16} />
            Copiar chave
          </button>
          <button className="button" onClick={() => setSecret('')}>
            Já guardei a chave
          </button>
        </Modal>
      )}
      {revoke && (
        <Modal
          title="Revogar esta chave?"
          onClose={() => {
            if (!busy) setRevoke(null);
          }}
        >
          <p>
            A chave de <strong>{revoke.label}</strong> deixará de funcionar. Se ela for a licença atual do
            cliente, o acesso será suspenso. Os dados serão preservados.
          </p>
          <div className="modal-actions">
            <button className="button" disabled={busy} onClick={() => setRevoke(null)}>
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void request(`/access/keys/${encodeURIComponent(revoke.id)}/revoke`, 'POST', {})
                  .then(async () => {
                    setRevoke(null);
                    notify('Chave revogada.');
                    await load();
                  })
                  .catch((failure) => notify(errorMessage(failure), true))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? 'Revogando…' : 'Confirmar revogação'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
