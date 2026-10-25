import { SafetyZone } from '../components/SafetyZone';
import { TeamManager } from '../components/TeamManager';
import { Select } from '../components/Select';
import { useEffect, useState } from 'react';
import { AiSettings } from '../components/AiSettings';
import { OrderingSettings } from '../components/OrderingSettings';
import { ColorPalette } from '../components/ColorPalette';
import { HudEditor } from '../components/HudEditor';
import type { Library } from '../types';
import { LogOut, Plus, Bell, ShieldCheck, Palette } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '../auth/firebase';
import { useApi, errorMessage } from '../context/ApiContext';
import { usePreferences, type Preferences } from '../context/PreferencesContext';
import { SettingsPage } from './SettingsPage';
import { Spinner } from '../components/ui';
import { SystemBackups } from '../components/SystemBackups';
import './operations.css';
const menuItems = [
  ['overview', 'Visão geral'],
  ['campaigns', 'Campanhas'],
  ['schedule', 'Agenda'],
  ['contacts', 'Contatos'],
  ['library', 'Biblioteca'],
  ['flows', 'Autoatendimento'],
  ['crm', 'CRM'],
] as const;
export function WorkspaceSettings({
  onImported,
  sessionId,
  library,
  onOrderRefresh,
  initialTab = 'general',
}: {
  onImported: () => Promise<void>;
  sessionId: string;
  library: Library;
  onOrderRefresh: () => void;
  initialTab?: string;
}) {
  const { request, notify } = useApi();
  const { preferences, updatePreferences } = usePreferences();
  const [tab, setTab] = useState(initialTab);
  const [hudOpen, setHudOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [notices, setNotices] = useState<
    { id: string; data: { title: string; text: string; createdAt: string; read: boolean } }[]
  >([]);
  const [me, setMe] = useState<{ email: string; role: string; profile: Record<string, string> } | null>(null);
  useEffect(() => {
    void request<typeof me>('/operations/me')
      .then(setMe)
      .catch((error) => notify(errorMessage(error), true));
  }, [request, notify]);
  useEffect(() => {
    setData({});
    const path = tab === 'business' || tab === 'departments' ? `/operations/settings/${tab}` : '';
    if (path)
      void request<Record<string, unknown>>(path)
        .then((result) => {
          setData(result);
        })
        .catch((error) => notify(errorMessage(error), true));
    if (tab === 'notifications')
      void request<{ items: typeof notices }>('/operations/notices')
        .then((result) => setNotices(result.items))
        .catch((error) => notify(errorMessage(error), true));
  }, [tab, request, notify]);
  const save = async (path: string, body: unknown) => {
    setBusy(true);
    try {
      await request(path, 'PUT', body);
      notify('Configurações salvas.');
      return true;
    } catch (error) {
      notify(errorMessage(error), true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const toggle = (key: keyof Preferences, title: string, hint?: string) => (
    <label className="preference-row">
      <span>
        {title}
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        checked={Boolean(preferences[key])}
        onChange={(event) => updatePreferences({ [key]: event.target.checked })}
      />
    </label>
  );
  const departments = Array.isArray(data.items) ? (data.items as { name: string; label: string }[]) : [];
  return (
    <main className="workspace-page operations-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SUA OPERAÇÃO, DO SEU JEITO</p>
          <h1>Configurações</h1>
          <p>Preferências, equipe e integrações em um só lugar.</p>
        </div>
        {firebaseAuth && (
          <button className="button" onClick={() => void signOut(firebaseAuth!)}>
            <LogOut size={16} />
            Sair da conta
          </button>
        )}
      </div>
      <div className="settings-layout">
        <aside className="settings-nav">
          {[
            ['general', 'Geral'],
            ['personalization', 'Personalização'],
            ['profile', 'Meu perfil'],
            ['privacy', 'Privacidade'],
            ['notifications', 'Notificações'],
            ['menu', 'Menu e atalhos'],
            ['chat', 'Conversas'],
            ['business', 'Negócio'],
            ['departments', 'Departamentos'],
            ['team', 'Equipe'],
            ['integrations', 'Integração de IA'],
            ['backup', 'Backups e acesso'],
          ].map(([id, title]) => (
            <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id!)}>
              {title}
            </button>
          ))}
        </aside>
        <section className="settings-content">
          {tab === 'general' && (
            <div className="surface personalization-card">
              <h2>Preferências da operação</h2>
              <p>
                O nome da plataforma é Noctua. Cores, aparência e organização do atendimento ficam em
                Personalização.
              </p>
              <button className="button primary" onClick={() => setTab('personalization')}>
                <Palette size={16} />
                Abrir Personalização
              </button>
              <button className="button" onClick={() => setHudOpen(true)}>
                Personalizar Atendimento com prévia
              </button>
              <p>Idioma: Português (Brasil).</p>{me?.role==='ADMIN'&&<SafetyZone/>}
            </div>
          )}
          {tab === 'personalization' && (
            <>
              <div className="surface personalization-card">
                <h2>
                  <Palette size={18} /> Identidade e cores
                </h2>
                <p>As alterações são salvas na sua conta e acompanham você em outros dispositivos.</p>
                <div className="fixed-platform-name">
                  <strong>noctua.</strong>
                  <span>Nome oficial da plataforma</span>
                </div>
                <ColorPalette />
                <div className="form-grid">
                  <label>
                    Logotipo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file)
                          void compressBrandImage(file, 128)
                            .then((image) => updatePreferences({ brandingLogo: image }))
                            .catch(() => notify('Não foi possível abrir esta imagem.', true));
                      }}
                    />
                    {preferences.brandingLogo && (
                      <button
                        type="button"
                        className="button small"
                        onClick={() => updatePreferences({ brandingLogo: '' })}
                      >
                        Remover logotipo
                      </button>
                    )}
                  </label>
                  <label>
                    Ícone do navegador (favicon)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/x-icon"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file)
                          void compressBrandImage(file, 64)
                            .then((image) => updatePreferences({ favicon: image }))
                            .catch(() => notify('Não foi possível abrir esta imagem.', true));
                      }}
                    />
                    {preferences.favicon && (
                      <button
                        type="button"
                        className="button small"
                        onClick={() => updatePreferences({ favicon: '' })}
                      >
                        Remover ícone
                      </button>
                    )}
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    Tema
                    <Select
                      value={preferences.theme}
                      onChange={(event) => updatePreferences({ theme: event.target.value })}
                    >
                      <option value="dark">Escuro</option>
                      <option value="light">Claro</option>
                    </Select>
                  </label>
                </div>
                <div className="hud-settings-entry">
                  <h3>Organização do Atendimento</h3>
                  <p>
                    Posição dos painéis, tamanho, ordem dos botões e ferramentas, com prévia antes de salvar.
                  </p>
                  <button className="button primary" onClick={() => setHudOpen(true)}>
                    Personalizar Atendimento com prévia
                  </button>
                </div>
                {toggle('compactNav', 'Menu lateral compacto', 'Mostra apenas os ícones e libera espaço.')}
              </div>
              <div className="surface personalization-card">
                <h2>Renomear grupos e pastas</h2>
                <p>Deixe os nomes da navegação e da Biblioteca com a linguagem da sua equipe.</p>
                <div className="form-grid">
                  {[
                    ['overview', 'Visão geral'],
                    ['inbox', 'Atendimento'],
                    ['campaigns', 'Campanhas'],
                    ['schedule', 'Agenda'],
                    ['library', 'Biblioteca'],
                    ['flows', 'Autoatendimento'],
                    ['contacts', 'Contatos'],
                    ['crm', 'CRM e negócios'],
                    ['connections', 'Conexões'],
                    ['settings', 'Configurações'],
                    ['personalization', 'Personalização'],
                  ].map(([id, title]) => (
                    <label key={id}>
                      Menu · {title}
                      <input
                        maxLength={50}
                        value={preferences.menuLabels[id!] ?? title}
                        onChange={(event) =>
                          updatePreferences({
                            menuLabels: { ...preferences.menuLabels, [id!]: event.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                  {[
                    ['group:messaging', 'Mensageria'],
                    ['group:relationships', 'Relacionamentos'],
                    ['group:account', 'Conta'],
                  ].map(([id, title]) => (
                    <label key={id}>
                      Grupo · {title}
                      <input
                        maxLength={40}
                        value={preferences.menuLabels[id!] ?? title}
                        onChange={(event) =>
                          updatePreferences({
                            menuLabels: { ...preferences.menuLabels, [id!]: event.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                  {[
                    ['MESSAGE', 'Textos'],
                    ['AUDIO', 'Áudios'],
                    ['MEDIA', 'Mídias'],
                    ['DOCUMENT', 'Documentos'],
                    ['FUNNEL', 'Funis'],
                    ['MACRO', 'Macros'],
                    ['PIX', 'PIX'],
                  ].map(([id, title]) => (
                    <label key={id}>
                      Pasta · {title}
                      <input
                        maxLength={40}
                        value={preferences.folderLabels[id!] ?? title}
                        onChange={(event) =>
                          updatePreferences({
                            folderLabels: { ...preferences.folderLabels, [id!]: event.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
              <OrderingSettings sessionId={sessionId} library={library} onRefresh={onOrderRefresh} />
            </>
          )}
          {tab === 'profile' && (
            <div className="surface">
              <h2>Meu perfil</h2>
              <p>
                {me?.email || 'Operador local'} · {me?.role === 'ADMIN' ? 'Administrador' : 'Membro'}
              </p>
              {me && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save('/operations/me', {
                      ...Object.fromEntries(new FormData(event.currentTarget)),
                      completed: true,
                    });
                  }}
                >
                  {[
                    ['name', 'Nome'],
                    ['company', 'Empresa'],
                    ['segment', 'Segmento'],
                    ['employees', 'Tamanho da equipe'],
                    ['objective', 'Objetivo'],
                    ['social', 'Rede social / site'],
                    ['phone', 'Contato'],
                  ].map(([name, title]) => (
                    <label key={name}>
                      {title}
                      <input
                        name={name}
                        maxLength={name === 'objective' ? 1000 : 100}
                        required={name === 'name'}
                        defaultValue={me.profile[name!] ?? ''}
                      />
                    </label>
                  ))}
                  <button className="button primary" disabled={busy}>
                    Salvar perfil
                  </button>
                </form>
              )}
            </div>
          )}
          {tab === 'privacy' && (
            <div className="surface">
              <h2>
                <ShieldCheck size={18} /> Privacidade visual
              </h2>
              <p>
                Oculta informações na sua tela sem alterar os dados salvos. Alguns textos são revelados ao
                passar o cursor.
              </p>
              {toggle('hideNames', 'Ocultar nomes dos contatos')}
              {toggle('hidePhotos', 'Ocultar fotos de perfil')}
              {toggle('hidePreviews', 'Ocultar a prévia da última mensagem')}
              {toggle('hideMessages', 'Ocultar mensagens no chat')}
              {toggle('hideMedia', 'Ocultar visualização de imagens e vídeos')}
            </div>
          )}
          {tab === 'menu' && (
            <OrderingSettings sessionId={sessionId} library={library} onRefresh={onOrderRefresh} />
          )}
          {tab === 'chat' && (
            <div className="surface">
              <h2>Composição de mensagens</h2>
              {toggle('waitingTimer', 'Mostrar tempo de espera do cliente')}
              <div className="form-grid">
                <label>
                  Alerta amarelo (min)
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={preferences.waitingYellow}
                    onChange={(event) => updatePreferences({ waitingYellow: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Alerta vermelho (min)
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={preferences.waitingRed}
                    onChange={(event) => updatePreferences({ waitingRed: Number(event.target.value) })}
                  />
                </label>
              </div>
              {toggle('signatureEnabled', 'Adicionar assinatura aos textos digitados')}
              <label>
                Assinatura
                <input
                  maxLength={200}
                  value={preferences.signature}
                  onChange={(event) => updatePreferences({ signature: event.target.value })}
                  placeholder="Ex.: Equipe Noctua"
                />
              </label>
              {toggle('pasteName', 'Oferecer atalho para inserir #nome')}
              <label>
                Substituições automáticas (uma por linha)
                <textarea
                  rows={5}
                  value={preferences.replacements}
                  onChange={(event) => updatePreferences({ replacements: event.target.value })}
                  placeholder={'/site=https://seusite.com.br\n/prazo=Nosso prazo é de 3 dias úteis.'}
                />
                <small className="muted">
                  Formato: atalho=texto. Aplicado ao enviar textos digitados, antes da assinatura.
                </small>
              </label>
            </div>
          )}
          {tab === 'notifications' && (
            <>
              <div className="surface">
                <h2>Notificações</h2>
                {toggle('desktopNotifications', 'Notificar novas mensagens neste navegador')}
                <button
                  className="button"
                  onClick={() => {
                    if (!('Notification' in window)) {
                      notify('Notificações não são suportadas neste navegador.', true);
                      return;
                    }
                    void Notification.requestPermission().then((permission) =>
                      notify(
                        permission === 'granted' ? 'Notificações autorizadas.' : 'Permissão não concedida.',
                      ),
                    );
                  }}
                >
                  <Bell size={15} />
                  Autorizar notificações do navegador
                </button>
                <p>
                  O servidor precisa estar ligado para processar lembretes. Notificações deste navegador
                  dependem de uma aba aberta.
                </p>
              </div>
              <div className="surface">
                <h2>Caixa de avisos</h2>
                {!notices.length && <p>Nenhum aviso ou lembrete recebido.</p>}
                {notices.map((notice) => (
                  <div className="task-list" key={notice.id}>
                    <div>
                      <strong>{notice.data.title}</strong>
                      <p>{notice.data.text}</p>
                      <small>{new Date(notice.data.createdAt).toLocaleString('pt-BR')}</small>
                      {!notice.data.read && (
                        <button
                          className="text-button"
                          onClick={() =>
                            void request(`/operations/notices/${notice.id}/read`, 'PUT').then(() =>
                              setNotices((current) =>
                                current.map((item) =>
                                  item.id === notice.id
                                    ? { ...item, data: { ...item.data, read: true } }
                                    : item,
                                ),
                              ),
                            )
                          }
                        >
                          Marcar como lido
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'business' && (
            <div className="surface">
              <h2>Funcionamento da empresa</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void save('/operations/settings/business', {
                    company: form.get('company'),
                    schedule: form.get('scheduleEnabled')
                      ? { days: [1, 2, 3, 4, 5], minTime: form.get('minTime'), maxTime: form.get('maxTime') }
                      : null,
                    autoCloseMinutes: Number(form.get('autoCloseMinutes') || 0),
                    distribution: form.has('distribution'),
                  });
                }}
              >
                <label>
                  Empresa
                  <input name="company" defaultValue={String(data.company ?? me?.profile.company ?? '')} />
                </label>
                <label className="checkbox">
                  <input name="scheduleEnabled" type="checkbox" defaultChecked={Boolean(data.schedule)} />
                  Definir horário de atendimento de segunda a sexta
                </label>
                <div className="form-grid">
                  <label>
                    Abertura
                    <input
                      name="minTime"
                      type="time"
                      defaultValue={(data.schedule as { minTime?: string })?.minTime ?? '08:00'}
                    />
                  </label>
                  <label>
                    Fechamento
                    <input
                      name="maxTime"
                      type="time"
                      defaultValue={(data.schedule as { maxTime?: string })?.maxTime ?? '18:00'}
                    />
                  </label>
                </div>
                <p>Horário de São Paulo. Cada fluxo também pode ter seu próprio horário de funcionamento.</p>
                <label className="checkbox">
                  <input name="distribution" type="checkbox" defaultChecked={Boolean(data.distribution)} />
                  Distribuir conversas sem responsável por rodízio entre convites ativos da equipe
                </label>
                <label>
                  Encerrar conversas sem retorno do cliente após (minutos)
                  <input
                    name="autoCloseMinutes"
                    type="number"
                    min={0}
                    max={43200}
                    defaultValue={Number(data.autoCloseMinutes ?? 0)}
                  />
                  <small className="muted">
                    0 desativa. Encerra somente quando a última mensagem é do atendente.
                  </small>
                </label>
                <button className="button primary" disabled={busy}>
                  Salvar negócio
                </button>
              </form>
            </div>
          )}
          {tab === 'departments' && (
            <div className="surface">
              <h2>Departamentos</h2>
              <p>
                Use os nomes dos departamentos no perfil de contato e na equipe para organizar atribuições.
              </p>
              {departments.map((department, index) => (
                <div className="preference-row" key={index}>
                  <strong>{department.name}</strong>
                  <button
                    className="text-button"
                    onClick={() => {
                      const next = departments.filter((_, i) => i !== index);
                      setData({ items: next });
                      void save('/operations/settings/departments', { items: next });
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const name = String(new FormData(form).get('name')).trim();
                  if (!name) return;
                  const next = [...departments, { name, label: '' }];
                  setData({ items: next });
                  void save('/operations/settings/departments', { items: next });
                  form.reset();
                }}
              >
                <label>
                  Novo departamento
                  <input name="name" required maxLength={100} placeholder="Ex.: Comercial" />
                </label>
                <button className="button" disabled={busy}>
                  <Plus size={15} />
                  Adicionar
                </button>
              </form>
            </div>
          )}
          {tab === 'team' && <TeamManager />}
          {tab === 'integrations' && <AiSettings />}
          {tab === 'backup' && (
            <>
              <SystemBackups />
              <SettingsPage onImported={onImported} sessionId={sessionId} />
            </>
          )}
        </section>
      </div>
      {hudOpen && <HudEditor onClose={() => setHudOpen(false)} />}
    </main>
  );
}

function compressBrandImage(file: File, size: number): Promise<string> {
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Imagem acima de 5 MB.'));
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(source);
        reject(new Error('Canvas indisponível.'));
        return;
      }
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      URL.revokeObjectURL(source);
      resolve(canvas.toDataURL('image/webp', 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('Imagem inválida.'));
    };
    image.src = source;
  });
}
