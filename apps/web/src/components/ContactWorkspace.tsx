import { useState } from 'react';
import { MediaAnalysis } from './MediaAnalysis';
import { Download, Sparkles, Copy, Save, CalendarDays } from 'lucide-react';
import type { Conversation } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from './ui';
export function ContactWorkspace({
  chat,
  sessionId,
  onRefresh,
  initialTab = 'profile',
}: {
  chat: Conversation;
  sessionId: string;
  onRefresh: () => void;
  initialTab?: string;
}) {
  const { request, blob, notify } = useApi();
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);
  const meta = chat.contact.metadata as Record<string, unknown>;
  const base = `/operations/sessions/${sessionId}/contacts/${chat.id}`;
  const download = async (media: boolean) => {
    setBusy(true);
    try {
      const file = await blob(`${base}/export?media=${media}`);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'historico-atendimento.zip';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const fields =
    tab === 'profile'
      ? [
          ['email', 'E-mail'],
          ['gender', 'Sexo / gênero'],
          ['birthday', 'Data de nascimento'],
          ['language', 'Idioma'],
          ['country', 'País'],
          ['state', 'Estado'],
          ['city', 'Cidade'],
        ]
      : [
          ['source', 'Origem do lead'],
          ['enteredAt', 'Data de entrada'],
          ['exitedAt', 'Data de saída'],
          ['company', 'Empresa'],
          ['jobTitle', 'Cargo'],
          ['interests', 'Produtos de interesse'],
          ['department', 'Departamento'],
          ['assignedTo', 'Responsável (e-mail da equipe)'],
        ];
  return (
    <div className="contact-workspace">
      <div className="contact-profile-tabs">
        {[
          ['profile', 'Perfil'],
          ['business', 'Negócio'],
          ['notes', 'Anotações'],
          ['history', 'Histórico'],
        ].map(([id, name]) => (
          <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id!)}>
            {name}
          </button>
        ))}
      </div>
      {['profile', 'business'].includes(tab) && (
        <form
          key={tab}
          className="compact-contact-fields"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            void request(base, 'PUT', {
              ...Object.fromEntries(form),
              ...(tab === 'profile'
                ? { optIn: form.has('optIn'), optOut: form.has('optOut'), pinned: form.has('pinned') }
                : {}),
            })
              .then(() => {
                notify('Dados do cliente salvos.');
                onRefresh();
              })
              .catch((error) => notify(errorMessage(error), true))
              .finally(() => setBusy(false));
          }}
        >
          {tab === 'profile' && (
            <label>
              Nome
              <input name="name" required maxLength={100} defaultValue={chat.contact.name} />
            </label>
          )}
          <div className="form-grid">
            {fields.map(([key, name]) => (
              <label key={key}>
                {name}
                <input
                  name={key}
                  type={
                    key === 'birthday' || key === 'enteredAt' || key === 'exitedAt'
                      ? 'date'
                      : key === 'email'
                        ? 'email'
                        : 'text'
                  }
                  maxLength={key === 'interests' ? 1000 : 150}
                  defaultValue={String(
                    key === 'assignedTo' ? (chat.assignedTo ?? meta.assignedTo ?? '') : (meta[key!] ?? ''),
                  )}
                />
              </label>
            ))}
          </div>
          {tab === 'profile' && (
            <>
              <label className="checkbox">
                <input name="optIn" type="checkbox" defaultChecked={Boolean(meta.optIn)} />
                Contato autorizou campanhas
              </label>
              <label className="checkbox">
                <input name="optOut" type="checkbox" defaultChecked={Boolean(meta.optOut)} />
                Não receber campanhas
              </label>
              <label className="checkbox">
                <input name="pinned" type="checkbox" defaultChecked={Boolean(chat.pinned ?? meta.pinned)} />
                Fixar conversa nesta operação
              </label>
            </>
          )}
          {tab === 'business' && (
            <label>
              Valor do negócio (R$)
              <input
                name="dealValue"
                inputMode="decimal"
                placeholder="0,00"
                maxLength={24}
                defaultValue={String(meta.dealValue ?? '')}
              />
            </label>
          )}
          {tab === 'business' && (
            <label>
              Observações
              <textarea
                name="observation"
                rows={3}
                maxLength={5000}
                defaultValue={String(meta.observation ?? '')}
              />
            </label>
          )}
          <button className="button primary" disabled={busy}>
            <Save size={15} />
            Salvar dados
          </button>
        </form>
      )}
      {tab === 'notes' && (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const text = new FormData(form).get('text');
              setBusy(true);
              void request(`${base}/notes`, 'POST', { text })
                .then(() => {
                  form.reset();
                  onRefresh();
                })
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Nova anotação
              <textarea name="text" rows={3} maxLength={5000} required />
            </label>
            <button className="button" disabled={busy}>
              Adicionar anotação
            </button>
          </form>
          <div className="task-list">
            {((meta.notes ?? []) as { id: string; text: string; author: string; at: string }[])
              .slice()
              .reverse()
              .map((note) => (
                <div key={note.id}>
                  <p>{note.text}</p>
                  <small>
                    {note.author} · {new Date(note.at).toLocaleString('pt-BR')}
                  </small>
                </div>
              ))}
          </div>
        </>
      )}
      {tab === 'history' && (
        <>
          <p className="muted">
            Exporte textos e mídias disponíveis para arquivo ou revisão. O ZIP informa quais mídias não
            puderam ser obtidas. Visualização única fica fora da exportação.
          </p>
          <div className="contact-tools-row">
            <button className="button" disabled={busy} onClick={() => void download(false)}>
              <Download size={15} />
              Exportar textos
            </button>
            <button className="button" disabled={busy} onClick={() => void download(true)}>
              <Download size={15} />
              Exportar com mídias
            </button>
          </div>
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void request<{ examples: number }>(`${base}/knowledge`, 'POST')
                .then((data) =>
                  notify(
                    `${data.examples} exemplos de respostas adicionados à base local da IA. Nada foi enviado ao provedor.`,
                  ),
                )
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            <Sparkles size={15} />
            Aprovar respostas como exemplos da IA
          </button>
          <a
            className="button"
            style={{ marginTop: 12 }}
            target="_blank"
            rel="noreferrer"
            href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Atendimento: ${chat.contact.name}`)}&details=${encodeURIComponent('Retorno de atendimento Noctua')}`}
          >
            <CalendarDays size={15} />
            Preparar evento no Google Agenda
          </a>
        </>
      )}
    </div>
  );
}
export function AiAssistant({
  chat,
  sessionId,
  onClose,
}: {
  chat: Conversation;
  sessionId: string;
  onClose: () => void;
}) {
  const { request, notify } = useApi();
  const [task, setTask] = useState('Sugira a próxima resposta seguindo o roteiro de vendas e o contexto.');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  return (
    <Modal title="Assistente de atendimento" onClose={onClose} wide>
      <MediaAnalysis sessionId={sessionId} conversationId={chat.id} />
      <p className="muted">
        A IA gera uma sugestão para sua revisão. Copie o texto para a conversa quando estiver de acordo.
      </p>
      <label>
        O que você precisa?
        <textarea rows={3} maxLength={2000} value={task} onChange={(event) => setTask(event.target.value)} />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        Enviar as últimas mensagens desta conversa e a base aprovada ao provedor de IA configurado.
      </label>
      <button
        className="button primary"
        disabled={busy || !consent || !task.trim()}
        onClick={() => {
          setBusy(true);
          void request<{ text: string }>(`/operations/sessions/${sessionId}/contacts/${chat.id}/ai`, 'POST', {
            task,
            consent: true,
          })
            .then((result) => setSuggestion(result.text))
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Spinner /> : <Sparkles size={15} />}Gerar sugestão
      </button>
      {suggestion && (
        <>
          <label>
            Sugestão para revisar
            <textarea rows={8} value={suggestion} onChange={(event) => setSuggestion(event.target.value)} />
          </label>
          <button
            className="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(suggestion)
                .then(() => notify('Sugestão copiada.'))
                .catch(() => notify('Selecione o texto da sugestão e copie manualmente.', true))
            }
          >
            <Copy size={15} />
            Copiar texto revisado
          </button>
        </>
      )}
    </Modal>
  );
}
