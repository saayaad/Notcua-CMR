import { useEffect, useRef, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';

type Check = {
  phoneNumber: string;
  status: 'REGISTERED' | 'NOT_REGISTERED' | 'UNKNOWN';
  canonicalPhone?: string;
  checkedAt: string;
  cached?: boolean;
};
export function NumberValidation({
  sessionId,
  phoneNumbers,
  disabled,
  onBusyChange,
  onRemove,
}: {
  sessionId: string;
  phoneNumbers: string[];
  disabled: boolean;
  onBusyChange: (value: boolean) => void;
  onRemove: (numbers: string[]) => void;
}) {
  const { request } = useApi();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const key = phoneNumbers.join(',');
  useEffect(() => {
    if (controller.current) {
      controller.current.abort();
      controller.current = null;
      setRunning(false);
      onBusyChange(false);
    }
    setChecks([]);
    setError('');
  }, [sessionId, key, onBusyChange]);
  useEffect(
    () => () => {
      controller.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );
  const run = async () => {
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    onBusyChange(true);
    setError('');
    setChecks([]);
    try {
      const numbers = [...new Set(phoneNumbers)];
      for (let index = 0; index < numbers.length && !abort.signal.aborted; index += 20) {
        const result = await request<{ items: Check[]; inconclusive: boolean }>(
          `/operations/sessions/${sessionId}/validate-numbers`,
          'POST',
          { phoneNumbers: numbers.slice(index, index + 20) },
          abort.signal,
        );
        if (abort.signal.aborted) break;
        setChecks((current) => [...current, ...result.items]);
        if (result.inconclusive) {
          setError(
            'Consulta interrompida: o WhatsApp não confirmou um resultado. Contatos inconclusivos foram preservados.',
          );
          break;
        }
      }
    } catch (cause) {
      if (!abort.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (controller.current === abort) {
        setRunning(false);
        onBusyChange(false);
      }
    }
  };
  const absent = checks.filter((item) => item.status === 'NOT_REGISTERED').map((item) => item.phoneNumber);
  return (
    <section className="surface" aria-label="Validação de números WhatsApp">
      <h3>Conferir contas WhatsApp</h3>
      <p className="muted">
        Consulta a existência da conta sem enviar mensagem. Não comprova presença online nem autorização para
        campanhas. Resultados anteriores podem ser reutilizados por até 24 horas.
      </p>
      <div className="operation-actions">
        <button
          type="button"
          className="button"
          disabled={disabled || running || !phoneNumbers.length}
          onClick={() => void run()}
        >
          {running && <Spinner />}Verificar números no WhatsApp
        </button>
        {running && (
          <button
            type="button"
            className="button"
            onClick={() => {
              controller.current?.abort();
              setRunning(false);
              onBusyChange(false);
            }}
          >
            Parar consulta
          </button>
        )}
        {absent.length > 0 && (
          <button
            type="button"
            className="button"
            disabled={running || disabled}
            onClick={() => onRemove(absent)}
          >
            Remover {absent.length} sem conta da prévia
          </button>
        )}
      </div>
      {checks.length > 0 && (
        <>
          <p role="status">
            {checks.filter((item) => item.status === 'REGISTERED').length} com conta · {absent.length} sem
            conta · {checks.filter((item) => item.status === 'UNKNOWN').length} inconclusivos ·{' '}
            {checks.length} consultados de {new Set(phoneNumbers).size}
          </p>
          <details>
            <summary>Ver resultados</summary>
            {checks.map((item) => (
              <p key={item.phoneNumber}>
                +{item.phoneNumber}:{' '}
                {item.status === 'REGISTERED'
                  ? 'Conta encontrada'
                  : item.status === 'NOT_REGISTERED'
                    ? 'Conta não encontrada'
                    : 'Consulta inconclusiva'}
                {item.cached ? ' · resultado salvo' : ''}
              </p>
            ))}
          </details>
        </>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
