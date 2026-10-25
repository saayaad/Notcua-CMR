import {Select} from '../components/Select';
import { useEffect, useState } from 'react';
import { Wifi, Plus, QrCode, Pause, Unplug, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { Label, Session } from '../types';
import { errorMessage, useApi } from '../context/ApiContext';
import { Spinner } from '../components/ui';

export function ConnectionsPage({
  sessions,
  sessionId,
  select,
  refresh,
  labels,
}: {
  sessions: Session[];
  sessionId: string;
  select: (id: string) => void;
  refresh: () => Promise<void>;
  labels: Label[];
}) {
  const { request, notify } = useApi();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [auto, setAuto] = useState(false);
  const [labelId, setLabelId] = useState('');
  const session = sessions.find((item) => item.id === sessionId);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void request<{ autoLabelFirstMessage: boolean; firstMessageLabelId: string | null }>(
      `/whatsapp/sessions/${sessionId}/settings`,
    )
      .then((data) => {
        if (active) {
          setAuto(data.autoLabelFirstMessage);
          setLabelId(data.firstMessageLabelId ?? '');
        }
      })
      .catch((error) => notify(errorMessage(error), true));
    return () => {
      active = false;
    };
  }, [sessionId, request, notify]);
  const act = async (key: string, task: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    try {
      await task();
      await refresh();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy('');
    }
  };
  return (
    <main className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SUA OPERAÇÃO, EM TEMPO REAL</p>
          <h1>Conexões</h1>
          <p>Conecte seu WhatsApp e mantenha seus atendimentos sincronizados.</p>
        </div>
        <span className="subtle-badge">
          <Wifi size={14} />
          {sessions.filter((item) => item.status === 'CONNECTED').length} ativa(s)
        </span>
      </div>
      <div className="connections-layout">
        <section className="surface connection-picker">
          <h2>Seus números</h2>
          {sessions.map((item) => (
            <button
              key={item.id}
              className={`connection-option ${item.id === sessionId ? 'selected' : ''}`}
              onClick={() => select(item.id)}
            >
              <span className={item.status === 'CONNECTED' ? 'online-dot' : 'offline-dot'} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.phoneNumber ? `+${item.phoneNumber}` : 'Não vinculado'}</small>
              </span>
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act('create', async () => {
                const result = await request<Session>('/whatsapp/sessions', 'POST', { name });
                setName('');
                select(result.id);
              });
            }}
          >
            <label>
              Nova conexão
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Atendimento principal"
                maxLength={100}
              />
            </label>
            <button className="button primary" disabled={Boolean(busy)}>
              {busy === 'create' ? <Spinner /> : <Plus size={16} />}Criar conexão
            </button>
          </form>
        </section>
        <section className="surface connection-detail">
          {session ? (
            <>
              <div className="section-label">
                <h2>{session.name}</h2>
                <span className={`status-pill ${session.status === 'CONNECTED' ? 'connected' : ''}`}>
                  {session.status === 'CONNECTED'
                    ? 'Conectado'
                    : session.status === 'AWAITING_QR'
                      ? 'Aguardando leitura'
                      : session.status === 'CONNECTING'
                        ? 'Conectando…'
                        : 'Desconectado'}
                </span>
              </div>
              <div className={`connection-qr ${session.status === 'CONNECTED' ? 'is-connected' : ''}`}>
                {session.status === 'CONNECTED' ? (
                  <>
                    <CheckCircle2 size={48} />
                    <h2>Seu WhatsApp está conectado</h2>
                    <p>O vínculo está salvo. Não é necessário ler outro QR Code.</p>
                  </>
                ) : session.qrDataUrl &&
                  session.qrExpiresAt &&
                  Date.parse(session.qrExpiresAt) > Date.now() ? (
                  <img src={session.qrDataUrl} alt="QR Code para conectar o WhatsApp" />
                ) : (
                  <>
                    <QrCode size={48} />
                    <p>
                      {session.status === 'CONNECTING'
                        ? 'Preparando a conexão…'
                        : 'Clique em Conectar para gerar o QR Code.'}
                    </p>
                  </>
                )}
              </div>
              {session.status !== 'CONNECTED' && (
                <p className="muted text-center">
                  No celular, abra WhatsApp → Aparelhos conectados → Conectar um aparelho.
                </p>
              )}
              {session.error && <p className="notice">{session.error}</p>}
              <div className="connection-actions">
                <button
                  className="button primary"
                  disabled={Boolean(busy) || session.status !== 'DISCONNECTED'}
                  onClick={() =>
                    void act('connect', () => request(`/whatsapp/sessions/${session.id}/connect`, 'POST'))
                  }
                >
                  <Wifi size={16} />
                  Conectar
                </button>
                <button
                  className="button"
                  disabled={Boolean(busy) || session.status === 'DISCONNECTED'}
                  onClick={() =>
                    void act('pause', () => request(`/whatsapp/sessions/${session.id}/disconnect`, 'POST'))
                  }
                >
                  <Pause size={16} />
                  Pausar
                </button>
                <button
                  className="button danger"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Desvincular esta conta? Será necessário escanear um novo QR para conectar novamente.',
                      )
                    )
                      void act('logout', () => request(`/whatsapp/sessions/${session.id}/logout`, 'POST'));
                  }}
                >
                  <Unplug size={16} />
                  Desvincular
                </button>
              </div>
              <div className="rule-box">
                <h3>Primeira mensagem, próxima etapa</h3>
                <p className="muted">
                  Etiquete automaticamente as próximas conversas novas. Histórico e grupos ficam fora da
                  regra.
                </p>
                <label className="checkbox">
                  <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                  Ativar etiqueta automática
                </label>
                <Select
                  aria-label="Etiqueta automática"
                  value={labelId}
                  onChange={(e) => setLabelId(e.target.value)}
                >
                  <option value="">Escolha uma etiqueta</option>
                  {labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
                </Select>
                <div className="rule-actions">
                  <button
                    className="button small primary"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void act('rule', async () => {
                        await request(`/whatsapp/sessions/${session.id}/settings`, 'PUT', {
                          autoLabelFirstMessage: auto,
                          firstMessageLabelId: labelId || null,
                        });
                        notify('Regra salva.');
                      })
                    }
                  >
                    Salvar regra
                  </button>
                  <button
                    className="button small"
                    disabled={Boolean(busy) || session.status !== 'CONNECTED'}
                    onClick={() =>
                      void act('labels', () =>
                        request(`/whatsapp/sessions/${session.id}/resync-labels`, 'POST'),
                      )
                    }
                  >
                    <RefreshCw size={13} />
                    Sincronizar etiquetas
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty">
              <QrCode size={40} />
              <h2>Crie sua primeira conexão</h2>
              <p>Dê um nome à sua operação para começar.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
