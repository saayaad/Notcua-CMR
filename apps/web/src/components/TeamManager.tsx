import { useState, useEffect } from 'react';
import { Select } from './Select';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';
interface Member {
  email: string;
  name: string;
  department: string;
  role: string;
  active: boolean;
  avatar?: string;
  online?: boolean;
}
export function TeamManager() {
  const { request, notify } = useApi();
  const [items, setItems] = useState<Member[]>([]);
  const [groups, setGroups] = useState<{ name: string }[]>([]);
  const empty = { email: '', name: '', department: '', role: 'MEMBER', active: true, avatar: '' };
  const [draft, setDraft] = useState<Member>(empty);
  const [busy, setBusy] = useState(false);
  const [distribution, setDistribution] = useState(false);
  const [distributionReady, setDistributionReady] = useState(false);
  const [distributionBusy, setDistributionBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void request<{ distribution?: boolean }>(
      '/operations/settings/business',
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => {
        setDistribution(Boolean(data.distribution));
        setDistributionReady(true);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [request, notify]);
  const load = () =>
    Promise.all([
      request<{ items: Member[] }>('/operations/team'),
      request<{ departments: { name: string }[] }>('/operations/directory'),
    ]).then(([members, directory]) => {
      setItems(members.items);
      setGroups(directory.departments);
    });
  useEffect(() => {
    void load().catch((error) => notify(errorMessage(error), true));
    const timer = window.setInterval(() => void load().catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, [request]);
  const save = async (item: Member) => {
    setBusy(true);
    try {
      await request('/operations/team', 'PUT', item);
      await load();
      notify('Cadastro da equipe atualizado.');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="surface team-manager">
      <h2>Equipe e setores</h2>
      <section className="team-distribution" aria-label="Distribuição automática">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={distribution}
            disabled={!distributionReady || distributionBusy}
            onChange={(event) => {
              const enabled = event.target.checked;
              setDistributionBusy(true);
              void request<Record<string, unknown>>('/operations/settings/business')
                .then((settings) =>
                  request('/operations/settings/business', 'PUT', { ...settings, distribution: enabled }),
                )
                .then(() => {
                  setDistribution(enabled);
                  notify(
                    enabled ? 'Distribuição automática habilitada.' : 'Distribuição automática desabilitada.',
                  );
                })
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setDistributionBusy(false));
            }}
          />
          Distribuir atendimentos automaticamente entre a equipe online
        </label>
        <small className="muted">
          O rodízio considera atendentes ativos, presença recente e o setor do cliente. Conversas que já têm
          responsável são preservadas.
        </small>
      </section>
      <p>
        Cadastre o e-mail usado no login. Os setores são criados em Configurações → Departamentos. Online
        indica presença recente no painel.
      </p>
      <div className="team-member-list">
        {items.map((member) => (
          <article key={member.email}>
            <span className="recipient-avatar">
              {member.avatar ? <img src={member.avatar} alt="" /> : member.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{member.name}</strong>
              <small>
                {member.department || 'Sem setor'} · {member.email}
              </small>
              <small className={member.online ? 'presence-online' : ''}>
                {member.online ? 'Online' : 'Offline'} ·{' '}
                {member.active ? 'Acesso ativo' : 'Acesso desativado'}
              </small>
            </div>
            <button className="button small" onClick={() => setDraft(member)}>
              Editar
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() => void save({ ...member, active: !member.active })}
            >
              {member.active ? 'Desativar' : 'Ativar'}
            </button>
          </article>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(draft);
        }}
      >
        <h3>
          {items.some((item) => item.email === draft.email) ? 'Editar atendente' : 'Cadastrar atendente'}
        </h3>
        <div className="form-grid">
          <label>
            Nome
            <input
              required
              maxLength={100}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            E-mail do login
            <input
              type="email"
              required
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value.toLowerCase() })}
            />
          </label>
          <label>
            Função
            <Select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
              <option value="MEMBER">Atendente</option>
              <option value="ADMIN">Administrador / gerente</option>
            </Select>
          </label>
          <label>
            Setor
            <Select
              value={draft.department}
              onChange={(event) => setDraft({ ...draft, department: event.target.value })}
            >
              <option value="">Sem setor</option>
              {groups.map((group) => (
                <option key={group.name}>{group.name}</option>
              ))}
            </Select>
          </label>
        </div>
        <label>
          Foto / avatar
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 250000) {
                notify('Escolha uma foto de até 250 KB.', true);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setDraft((current) => ({ ...current, avatar: String(reader.result) }));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {draft.avatar && <img className="team-avatar-preview" src={draft.avatar} alt="Prévia do avatar" />}
        <div className="modal-actions">
          <button type="button" className="button" onClick={() => setDraft(empty)}>
            Novo cadastro
          </button>
          <button className="button primary" disabled={busy}>
            {busy && <Spinner />}Salvar atendente
          </button>
        </div>
      </form>
    </div>
  );
}
