import { useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  onIdTokenChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { LockKeyhole, Mail, Eye, EyeOff, ArrowRight, Building2 } from 'lucide-react';
import { firebaseAuth } from './firebase';
import { API_BASE } from '../config';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from '../components/ui';
import './access.css';
function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === 'auth/popup-closed-by-user'
    ? 'A janela de acesso foi fechada. Tente novamente.'
    : code === 'auth/invalid-credential'
      ? 'Confira o e-mail e a senha.'
      : code === 'auth/weak-password'
        ? 'Escolha uma senha com pelo menos 8 caracteres.'
        : code === 'auth/email-already-in-use'
          ? 'Este e-mail já está cadastrado. Entre ou recupere sua senha.'
          : code === 'auth/unauthorized-domain'
            ? 'Autorize este domínio nas configurações do Firebase.'
            : code?.startsWith('auth/')
              ? 'Não foi possível entrar. Confira o acesso e a configuração do Firebase.'
              : errorMessage(error);
}
export function AuthGate({ children }: { children: ReactNode }) {
  const { setToken } = useApi();
  const [mode, setMode] = useState<'loading' | 'local' | 'firebase' | 'error'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${API_BASE}/api/public/runtime`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Servidor indisponível.');
        const data = await response.json();
        setMode(data.authMode === 'firebase' ? 'firebase' : 'local');
      })
      .catch(() => {
        if (!controller.signal.aborted) setMode('error');
      });
    return () => controller.abort();
  }, [tick]);
  useEffect(() => {
    if (mode !== 'firebase' || !firebaseAuth) return;
    let generation = 0;
    const unsubscribe = onIdTokenChanged(firebaseAuth, (current) => {
      const pending = ++generation;
      setUser(current);
      setReady(false);
      setMessage('');
      if (!current) setToken('');
      if (current?.emailVerified)
        void current
          .getIdToken()
          .then(async (token) => {
            const response = await fetch(`${API_BASE}/api/operations/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error?.message ?? 'Acesso não autorizado.');
            if (pending === generation) {
              setToken(token);
              setReady(true);
            }
          })
          .catch((error) => {
            if (pending === generation) setMessage(errorMessage(error));
          });
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, [mode, setToken, tick]);
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage(authError(error));
    } finally {
      setBusy(false);
    }
  };
  if (mode === 'local' || ready) return <OnboardingGate>{children}</OnboardingGate>;
  return (
    <main className="access-page">
      <div className="access-brand">
        <span className="access-owl">◉</span>
        <h1>
          noctua<span>.</span>
        </h1>
        <p>Seu atendimento, com mais presença.</p>
      </div>
      <section className="access-card">
        {mode === 'loading' ? (
          <div className="access-wait">
            <Spinner />
            Preparando seu espaço…
          </div>
        ) : mode === 'error' ? (
          <>
            <h2>Vamos reconectar</h2>
            <p>O servidor não respondeu. Confira se ele está iniciado.</p>
            <button
              className="button primary"
              onClick={() => {
                setMode('loading');
                setTick((value) => value + 1);
              }}
            >
              Tentar novamente
            </button>
          </>
        ) : !firebaseAuth ? (
          <>
            <h2>Acesso em configuração</h2>
            <p>
              Configure as variáveis públicas do Firebase no painel da hospedagem e publique novamente para
              habilitar o login.
            </p>
          </>
        ) : user ? (
          <>
            <h2>{user.emailVerified ? 'Acesso à operação' : 'Confirme seu e-mail'}</h2>
            <p>
              {user.emailVerified
                ? 'Seu administrador precisa autorizar esta conta na equipe.'
                : `Enviamos uma verificação para ${user.email}. Abra o link recebido para continuar.`}
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await user.reload();
                  await user.getIdToken(true);
                  setTick((value) => value + 1);
                })
              }
            >
              Já confirmei / verificar acesso
            </button>
            {!user.emailVerified && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await sendEmailVerification(user);
                    setMessage('E-mail de verificação enviado.');
                  })
                }
              >
                Reenviar verificação
              </button>
            )}
            <button className="text-button" onClick={() => void signOut(firebaseAuth!)}>
              Usar outra conta
            </button>
          </>
        ) : (
          <>
            <div className="access-tabs">
              <button className={!signup ? 'selected' : ''} onClick={() => setSignup(false)}>
                Entrar
              </button>
              <button className={signup ? 'selected' : ''} onClick={() => setSignup(true)}>
                Criar conta
              </button>
            </div>
            <button
              className="button access-google"
              disabled={busy}
              onClick={() => void act(() => signInWithPopup(firebaseAuth!, new GoogleAuthProvider()))}
            >
              Continuar com o Google
            </button>
            <div className="access-divider">OU COM E-MAIL</div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const password = String(new FormData(event.currentTarget).get('password'));
                void act(async () => {
                  if (signup) {
                    const result = await createUserWithEmailAndPassword(firebaseAuth!, email, password);
                    await sendEmailVerification(result.user);
                  } else await signInWithEmailAndPassword(firebaseAuth!, email, password);
                });
              }}
            >
              <label>
                <Mail size={15} />
                E-mail
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                />
              </label>
              <label>
                <LockKeyhole size={15} />
                Senha
                <div className="access-password">
                  <input
                    name="password"
                    type={passwordVisible ? 'text' : 'password'}
                    required
                    minLength={signup ? 8 : 1}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    placeholder={signup ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setPasswordVisible(!passwordVisible)}
                  >
                    {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              {!signup && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy || !email}
                  onClick={() =>
                    void act(async () => {
                      await sendPasswordResetEmail(firebaseAuth!, email);
                      setMessage(
                        'Se este e-mail estiver cadastrado, você receberá as instruções de recuperação.',
                      );
                    })
                  }
                >
                  Esqueci minha senha
                </button>
              )}
              <button className="button primary access-submit" disabled={busy}>
                {busy ? <Spinner /> : <ArrowRight size={16} />}
                {signup ? 'Criar minha conta' : 'Entrar no Noctua'}
              </button>
            </form>
            <small>Contas novas precisam de convite para acessar os dados da operação.</small>
          </>
        )}
        {message && (
          <p role="alert" className="field-error">
            {message}
          </p>
        )}
      </section>
      <p className="access-footer">Atendimento e relacionamento em um só lugar</p>
    </main>
  );
}
function OnboardingGate({ children }: { children: ReactNode }) {
  const { request, notify, setToken } = useApi();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void request<{ profile: Record<string, unknown> }>('/operations/me', 'GET', undefined, controller.signal)
      .then((data) => setProfile(data.profile))
      .catch((issue) => {
        if (!controller.signal.aborted) setError(errorMessage(issue));
      });
    return () => controller.abort();
  }, [request, tick]);
  if (profile?.completed) return children;
  if (!profile)
    return (
      <div className="access-page">
        <section className="access-card">
          {error ? (
            <>
              <p role="alert">{error}</p>
              {/token/i.test(error) && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setError('');
                    setToken(String(new FormData(event.currentTarget).get('token')).trim());
                  }}
                >
                  <label>
                    Token de acesso local
                    <input name="token" type="password" autoComplete="off" required />
                  </label>
                  <button className="button primary">Aplicar acesso</button>
                </form>
              )}
              <button
                className="button"
                onClick={() => {
                  setError('');
                  setTick((value) => value + 1);
                }}
              >
                Tentar novamente
              </button>
            </>
          ) : (
            <Spinner />
          )}
        </section>
      </div>
    );
  return (
    <main className="onboarding-page">
      <section className="onboarding-story">
        <span className="access-owl">◉</span>
        <small>SEU ESPAÇO DE RELACIONAMENTO</small>
        <h1>
          Vamos conhecer
          <br />
          sua operação.
        </h1>
        <p>Organize conversas, acompanhe oportunidades e prepare um atendimento com a sua identidade.</p>
        <span className="onboarding-step">01 / Boas-vindas ao Noctua</span>
      </section>
      <section className="onboarding-form">
        <Building2 size={27} />
        <h2>Conte um pouco sobre você</h2>
        <p>Esses dados ficam no perfil da sua operação.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setBusy(true);
            void request('/operations/me', 'PUT', { ...data, completed: true })
              .then(() => setProfile({ ...data, completed: true }))
              .catch((issue) => notify(errorMessage(issue), true))
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Seu nome
            <input name="name" required maxLength={100} />
          </label>
          <div className="form-grid">
            <label>
              Empresa
              <input name="company" maxLength={120} required />
            </label>
            <label>
              Segmento
              <input name="segment" maxLength={100} placeholder="Ex.: Serviços" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Tamanho da equipe
              <select name="employees">
                <option>Somente eu</option>
                <option>2 a 5 pessoas</option>
                <option>6 a 20 pessoas</option>
                <option>Mais de 20 pessoas</option>
              </select>
            </label>
            <label>
              Contato
              <input name="phone" maxLength={30} placeholder="Telefone comercial" />
            </label>
          </div>
          <label>
            Seu principal objetivo
            <textarea
              name="objective"
              rows={2}
              maxLength={1000}
              placeholder="Ex.: Organizar meus leads e automatizar o primeiro atendimento"
            />
          </label>
          <label>
            Rede social ou site
            <input name="social" maxLength={150} />
          </label>
          <button className="button primary" disabled={busy}>
            Começar meu atendimento
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
