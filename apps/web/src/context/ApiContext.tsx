import { API_BASE } from '../config';
import { firebaseAuth } from '../auth/firebase';
import { authenticatedFetch } from './authenticated-request';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface Api {
  token: string;
  setToken: (value: string) => void;
  request: <T>(path: string, method?: string, body?: unknown, signal?: AbortSignal) => Promise<T>;
  blob: (path: string) => Promise<Blob>;
  notify: (message: string, error?: boolean) => void;
}
const Context = createContext<Api | null>(null);
function Notification({ message, error, onClose }: { message: string; error: boolean; onClose: () => void }) {
  const [host, setHost] = useState<HTMLElement>(document.body);
  useLayoutEffect(() => {
    // A z-index cannot place a body element above a native modal's top layer.
    const syncHost = () =>
      setHost(
        Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1) ?? document.body,
      );
    syncHost();
    const observer = new MutationObserver(syncHost);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => observer.disconnect();
  }, []);
  return createPortal(
    <div className={`toast ${error ? 'toast-error' : ''}`} role={error ? 'alert' : 'status'}>
      {error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
      <span>{message}</span>
      <button type="button" className="icon-button" aria-label="Fechar aviso" onClick={onClose}>
        <X size={17} />
      </button>
      <i className="toast-progress" aria-hidden="true" />
    </div>,
    host,
  );
}
export function ApiProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState('');
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.error ? 7000 : 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const request = useCallback(
    async <T,>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> => {
      const response = await authenticatedFetch(`${API_BASE}/api${path}`, {
        method,
        signal,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }, { token, user: token ? firebaseAuth?.currentUser : null });
      const data = await response.json();
      if (response.status === 402) window.dispatchEvent(new Event('noctua:access-required'));
      if (!response.ok) throw new Error(data.error?.message ?? 'Não foi possível concluir a operação.');
      return data as T;
    },
    [token],
  );
  const blob = useCallback(
    async (path: string) => {
      const response = await authenticatedFetch(`${API_BASE}/api${path}`, {}, {
        token, user: token ? firebaseAuth?.currentUser : null,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message ?? 'Arquivo indisponível.');
      }
      return response.blob();
    },
    [token],
  );
  const api = useMemo(() => ({ token, setToken, request, blob, notify }), [token, request, blob, notify]);
  return (
    <Context.Provider value={api}>
      {children}
      {toast && <Notification {...toast} onClose={() => setToast(null)} />}
    </Context.Provider>
  );
}
export function useApi() {
  const api = useContext(Context);
  if (!api) throw new Error('API não inicializada.');
  return api;
}
export function errorMessage(error: unknown) {
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return 'Não foi possível acessar o servidor. Inicie o Noctua e aguarde a reconexão.';
  if (error instanceof SyntaxError) return 'O servidor não respondeu corretamente. Aguarde a inicialização e tente novamente.';
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}
