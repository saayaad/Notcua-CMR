import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';

export function ActivationPanel({ onActivated }: { onActivated: () => void }) {
  const { request } = useApi();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="activation-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        void request('/access/activate', 'POST', { key: key.trim() })
          .then(() => {
            setKey('');
            onActivated();
          })
          .catch((failure) => setError(errorMessage(failure)))
          .finally(() => setBusy(false));
      }}
    >
      <label>
        <KeyRound size={16} /> Chave de ativação
        <input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          minLength={20}
          maxLength={100}
          required
          placeholder="NOCTUA-…"
          disabled={busy}
        />
      </label>
      <p>
        Use a chave recebida do administrador. A validade começa na ativação e fica vinculada à sua conta.
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy || key.trim().length < 20}>
        {busy ? 'Ativando seu acesso…' : 'Ativar minha operação'}
      </button>
    </form>
  );
}
