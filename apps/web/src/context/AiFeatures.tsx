import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApi, errorMessage } from './ApiContext';
import './AiFeatures.css';

const Context = createContext({
  enabled: false,
  loading: true,
  saving: false,
  canManage: false,
  error: '',
  reload: () => {},
  setEnabled: async (_enabled: boolean) => {},
});
export const useAiFeatures = () => useContext(Context);
export function AiOnly({ children }: { children: ReactNode }) {
  return useAiFeatures().enabled ? <>{children}</> : null;
}

export function AiFeaturesProvider({ children }: { children: ReactNode }) {
  const { request, notify } = useApi();
  const [enabled, setValue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const changing = useRef(false);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (changing.current) return;
      const current = ++revision.current;
      const valid = () => active && current === revision.current;
      void request<{ aiEnabled: boolean; canManage: boolean }>('/operations/features')
        .then((data) => {
          if (valid()) {
            setValue(data.aiEnabled);
            setCanManage(data.canManage);
            setError('');
          }
        })
        .catch((error) => {
          if (valid()) {
            setValue(false);
            setCanManage(false);
            setError(errorMessage(error));
          }
        })
        .finally(() => {
          if (valid()) setLoading(false);
        });
    };
    load();
    window.addEventListener('focus', load);
    window.addEventListener('noctua:reload-ai-features', load);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener('noctua:reload-ai-features', load);
    };
  }, [request]);
  const setEnabled = async (value: boolean) => {
    if (changing.current || !canManage) return;
    changing.current = true;
    revision.current++;
    setSaving(true);
    try {
      await request('/operations/features', 'PUT', { aiEnabled: value });
      setValue(value);
      setError('');
      notify(
        value
          ? 'Ferramentas de I.A. habilitadas. O atendimento automático tem ativação separada.'
          : 'I.A. desabilitada. As ferramentas foram ocultadas.',
      );
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      changing.current = false;
      setSaving(false);
      setLoading(false);
    }
  };
  return (
    <Context.Provider
      value={{
        enabled,
        loading,
        saving,
        canManage,
        error,
        reload: () => {
          window.dispatchEvent(new Event('noctua:reload-ai-features'));
        },
        setEnabled,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function AiFeatureSwitch() {
  const { enabled, loading, saving, canManage, error, reload, setEnabled } = useAiFeatures();
  return (
    <section className="surface ai-feature-switch">
      <div>
        <h2>Habilitar I.A.</h2>
        <p>
          Mostre ou oculte os recursos de inteligência artificial em todo o sistema. Suas configurações são
          preservadas.
        </p>
      </div>
      <button
        type="button"
        className={`button ${enabled ? 'primary' : ''}`}
        role="switch"
        aria-label="Habilitar I.A."
        aria-checked={enabled}
        disabled={loading || saving || !canManage}
        onClick={() => void setEnabled(!enabled)}
      >
        {saving ? 'Salvando…' : loading ? 'Carregando…' : enabled ? 'I.A. habilitada' : 'I.A. desabilitada'}
      </button>
      <small className="muted">
        Ao desabilitar, novas chamadas de IA e respostas automáticas são interrompidas. Para usar novamente,
        habilite as ferramentas e configure a chave. O atendimento automático tem ativação separada.
      </small>
      {error && (
        <p className="notice" role="alert">
          Não foi possível consultar a configuração: {error}{' '}
          <button type="button" className="text-button" onClick={reload}>
            Tentar novamente
          </button>
        </p>
      )}
      {!loading && !error && !canManage && (
        <small className="muted">Somente um administrador pode alterar esta opção.</small>
      )}
    </section>
  );
}
