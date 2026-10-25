import { useEffect, useState } from 'react';
import {
  UserRound,
  StickyNote,
  Inbox,
  Settings2,
  Zap,
  Tag,
  Archive,
  Pin,
  Mail,
  ShieldBan,
  ArrowRightLeft,
} from 'lucide-react';
import type { Conversation, Label } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { ContactWorkspace } from './ContactWorkspace';
import { ContactDetails } from './ContactDetails';
import { Avatar, Modal } from './ui';

export const toolboxSections = [
  { id: 'responses', name: 'Respostas', icon: Zap },
  { id: 'profile', name: 'Cliente', icon: UserRound },
  { id: 'notes', name: 'Notas', icon: StickyNote },
  { id: 'transfers', name: 'Caixa', icon: Inbox },
  { id: 'settings', name: 'Ações', icon: Settings2 },
];
interface Transfer {
  id: string;
  name: string;
  target: string;
  from: string;
  note: string;
  status: string;
  createdAt: string;
}
export function ToolboxWorkspace({
  section,
  chat,
  sessionId,
  revision,
  onRefresh,
}: {
  section: string;
  chat: Conversation | null;
  sessionId: string;
  revision: number;
  onRefresh: () => void;
}) {
  const { request, notify } = useApi();
  const [details, setDetails] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [finished, setFinished] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    path: string;
    method: string;
    body: unknown;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState<{ email: string; name: string; department: string; active: boolean }[]>(
    [],
  );
  const [teamSearch, setTeamSearch] = useState('');
  const [teamOpen, setTeamOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (section !== 'transfers' || !sessionId) return;
    const controller = new AbortController();
    void request<{ items: Transfer[] }>(
      `/operations/toolbox/sessions/${sessionId}/transfers`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => setTransfers(data.items))
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [section, sessionId, refresh, revision, request, notify]);
  useEffect(() => {
    setDetails(false);
    setConfirm(null);
    setTransfer(false);
  }, [chat?.id, sessionId]);
  const act = async (path: string, method: string, body: unknown) => {
    setBusy(true);
    try {
      await request(path, method, body);
      setConfirm(null);
      setTransfer(false);
      setRefresh((value) => value + 1);
      onRefresh();
      notify('Alteração salva.');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const showDetails = async () => {
    try {
      const data = await request<{ items: Label[] }>(`/whatsapp/sessions/${sessionId}/labels`);
      setLabels(data.items);
      setDetails(true);
    } catch (error) {
      notify(errorMessage(error), true);
    }
  };
  const base = `/attendance/sessions/${sessionId}/conversations/${chat?.id}`;
  useEffect(() => {
    if (!transfer) return;
    void request<{ items: { email: string; name: string; department: string; active: boolean }[] }>(
      '/operations/team',
    )
      .then((data) => setTeam(data.items.filter((item) => item.active)))
      .catch(() => setTeam([]));
  }, [transfer, request]);
  return (
    <div className="toolbox-workspace">
      {section === 'transfers' ? (
        <>
          <h3>Transferências</h3>
          <p className="muted">Atendimentos enviados e recebidos pela equipe.</p>
          <div className="tools-mode">
            <button aria-pressed={!finished} onClick={() => setFinished(false)}>
              Pendentes
            </button>
            <button aria-pressed={finished} onClick={() => setFinished(true)}>
              Finalizadas
            </button>
          </div>
          {chat && (
            <button className="button toolbox-wide" onClick={() => setTransfer(true)}>
              <ArrowRightLeft size={15} />
              Transferir conversa atual
            </button>
          )}
          {transfers
            .filter((item) => (item.status !== 'PENDING') === finished)
            .map((item) => (
              <article className="transfer-card" key={item.id}>
                <strong>{item.name}</strong>
                <small>Para: {item.target}</small>
                <p>{item.note || 'Sem observações'}</p>
                <small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small>
                {item.status === 'PENDING' ? (
                  <div className="button-row">
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          `/operations/toolbox/sessions/${sessionId}/transfers/${encodeURIComponent(item.id)}`,
                          'PUT',
                          { status: 'ACCEPTED' },
                        )
                      }
                    >
                      Aceitar
                    </button>
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          `/operations/toolbox/sessions/${sessionId}/transfers/${encodeURIComponent(item.id)}`,
                          'PUT',
                          { status: 'DECLINED' },
                        )
                      }
                    >
                      Recusar
                    </button>
                  </div>
                ) : (
                  <span className="subtle-badge">{item.status === 'ACCEPTED' ? 'Aceita' : 'Recusada'}</span>
                )}
              </article>
            ))}
          {!transfers.some((item) => (item.status !== 'PENDING') === finished) && (
            <div className="tools-empty">
              <Inbox size={25} />
              <p>Nenhuma transferência {finished ? 'finalizada' : 'pendente'}.</p>
            </div>
          )}
        </>
      ) : !chat ? (
        <div className="tools-empty">Selecione uma conversa para acessar as ferramentas do cliente.</div>
      ) : (
        <>
          <button className="toolbox-client" onClick={() => void showDetails()}>
            <Avatar contact={chat.contact} />
            <span>
              <strong>{chat.contact.name}</strong>
              <small>Abrir informações completas</small>
            </span>
          </button>
          {['profile', 'notes'].includes(section) && (
            <ContactWorkspace
              key={`${chat.id}:${section}`}
              chat={chat}
              sessionId={sessionId}
              initialTab={section === 'notes' ? 'notes' : 'profile'}
              onRefresh={onRefresh}
            />
          )}
          {section === 'settings' && (
            <>
              <h3>Ações da conversa</h3>
              <p className="muted">Confira os detalhes antes de aplicar.</p>
              <div className="toolbox-action-list">
                <button onClick={() => void showDetails()}>
                  <Tag size={17} />
                  <span>
                    Etiquetas e dados do cliente<small>Consultar e editar as informações</small>
                  </span>
                </button>
                <button onClick={() => setTransfer(true)}>
                  <ArrowRightLeft size={17} />
                  <span>
                    Transferir atendimento<small>Enviar para outro membro da equipe</small>
                  </span>
                </button>
                <button
                  onClick={() =>
                    setConfirm({
                      title:
                        chat.status === 'CLOSED'
                          ? 'Reabrir conversa na operação'
                          : 'Arquivar conversa na operação',
                      path: base,
                      method: 'PUT',
                      body: { status: chat.status === 'CLOSED' ? 'OPEN' : 'CLOSED' },
                    })
                  }
                >
                  <Archive size={17} />
                  <span>{chat.status === 'CLOSED' ? 'Reabrir' : 'Arquivar'} conversa</span>
                </button>
                <button
                  onClick={() =>
                    setConfirm({
                      title: chat.pinned ? 'Desfixar conversa' : 'Fixar conversa',
                      path: `/operations/sessions/${sessionId}/contacts/${chat.id}`,
                      method: 'PUT',
                      body: { pinned: !chat.pinned },
                    })
                  }
                >
                  <Pin size={17} />
                  <span>{chat.pinned ? 'Desfixar' : 'Fixar'} conversa</span>
                </button>
                <button
                  onClick={() =>
                    setConfirm({
                      title: 'Marcar como não lida',
                      path: `${base}/unread`,
                      method: 'POST',
                      body: {},
                    })
                  }
                >
                  <Mail size={17} />
                  <span>Marcar como não lida</span>
                </button>
                <button
                  className="danger-text"
                  onClick={() =>
                    setConfirm({
                      title: chat.contact.metadata.blocked
                        ? 'Desbloquear contato no WhatsApp'
                        : 'Bloquear contato no WhatsApp',
                      path: `${base}/block`,
                      method: 'POST',
                      body: { blocked: !chat.contact.metadata.blocked },
                    })
                  }
                >
                  <ShieldBan size={17} />
                  <span>{chat.contact.metadata.blocked ? 'Desbloquear' : 'Bloquear'} contato</span>
                </button>
              </div>
            </>
          )}
        </>
      )}
      {details && chat && (
        <ContactDetails
          chat={chat}
          labels={labels}
          sessionId={sessionId}
          onClose={() => setDetails(false)}
          onRefresh={onRefresh}
        />
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p>
            Aplicar a alteração à conversa de <strong>{chat?.contact.name}</strong>?
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void act(confirm.path, confirm.method, confirm.body)}
            >
              Confirmar alteração
            </button>
          </div>
        </Modal>
      )}
      {transfer && chat && (
        <Modal title="Transferir atendimento" onClose={() => setTransfer(false)}>
          <p>
            Conversa: <strong>{chat.contact.name}</strong>. O novo responsável será definido quando a
            transferência for aceita.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void act(`/operations/toolbox/sessions/${sessionId}/transfers`, 'POST', {
                conversationId: chat.id,
                target: form.get('target'),
                note: form.get('note'),
              });
            }}
          >
            <label>
              Atendente ou setor
              <input
                type="hidden"
                name="target"
                value={
                  teamSearch.includes('@')
                    ? teamSearch
                    : (team.find((item) => item.name === teamSearch)?.email ?? '')
                }
              />
              <input
                autoComplete="off"
                required
                value={teamSearch}
                onFocus={() => setTeamOpen(true)}
                onChange={(event) => {
                  setTeamSearch(event.target.value);
                  setTeamOpen(true);
                }}
                placeholder="Busque por nome, setor ou e-mail"
              />
              {teamOpen && (
                <div className="team-suggestions">
                  {team
                    .filter((item) =>
                      `${item.name} ${item.department} ${item.email}`
                        .toLocaleLowerCase()
                        .includes(teamSearch.toLocaleLowerCase()),
                    )
                    .map((item) => (
                      <button
                        type="button"
                        key={item.email}
                        onClick={() => {
                          setTeamSearch(item.name);
                          setTeamOpen(false);
                        }}
                      >
                        <span className="team-initial">{item.name.slice(0, 1).toUpperCase()}</span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            {item.department || 'Sem setor'} · {item.email}
                          </small>
                        </span>
                        <i>Ativo</i>
                      </button>
                    ))}
                  {teamSearch.includes('@') && !team.some((item) => item.email === teamSearch) && (
                    <small>Confirme se este membro está cadastrado e ativo.</small>
                  )}
                </div>
              )}
            </label>
            <label>
              Observações
              <textarea name="note" maxLength={2000} rows={4} />
            </label>
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setTransfer(false)}>
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={
                  busy || (!teamSearch.includes('@') && !team.some((item) => item.name === teamSearch))
                }
              >
                Solicitar transferência
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
