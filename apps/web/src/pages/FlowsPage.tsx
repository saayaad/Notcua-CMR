import { InactivityRules } from '../components/InactivityRules';
import { useEffect, useState } from 'react';
import { Workflow, Plus, ArrowRight, Play, Pause, Archive, RotateCcw, RefreshCw, Square } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from '../components/ui';
import type { Library } from '../types';
import { FlowEditor } from './flows/FlowEditor';
import { executionNames, type FlowDetail, type FlowSummary, type FlowRun } from './flows/flow.types';
export function FlowsPage({
  sessionId,
  revision,
  library,
}: {
  sessionId: string;
  revision: number;
  library: Library;
}) {
  const { request, notify } = useApi();
  const [items, setItems] = useState<FlowSummary[]>([]);
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [editor, setEditor] = useState<FlowDetail | null>(null);
  const [tab, setTab] = useState('flows');
  const [archived, setArchived] = useState(false);
  const [create, setCreate] = useState(false);
  const [activate, setActivate] = useState<FlowSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const base = `/automation/sessions/${sessionId}`;
  const refresh = () => setTick((value) => value + 1);
  useEffect(() => {
    if (!sessionId || editor) return;
    const controller = new AbortController();
    setLoading(true);
    void Promise.all([
      request<{ items: FlowSummary[] }>(
        `${base}/flows?archived=${archived}`,
        'GET',
        undefined,
        controller.signal,
      ),
      request<{ items: FlowRun[] }>(`${base}/runs`, 'GET', undefined, controller.signal),
    ])
      .then(([flows, executions]) => {
        setItems(flows.items);
        setRuns(executions.items);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sessionId, base, revision, archived, tick, editor, request, notify]);
  const configure = (flow: FlowSummary, changes: object) => {
    setBusy(true);
    void request(`${base}/flows/${flow.id}/settings`, 'PUT', { revision: flow.revision, ...changes })
      .then(() => {
        setActivate(null);
        refresh();
      })
      .catch((error) => notify(errorMessage(error), true))
      .finally(() => setBusy(false));
  };
  if (!sessionId)
    return <div className="flows-empty">Selecione uma conexão para montar suas automações.</div>;
  if (editor)
    return (
      <FlowEditor
        key={editor.id}
        initial={editor}
        base={`${base}/flows/${editor.id}`}
        library={library}
        onBack={() => {
          setEditor(null);
          refresh();
        }}
      />
    );
  return (
    <section className="flows-page">
      <header className="flows-heading">
        <div>
          <span className="flow-eyebrow">AUTOMAÇÃO DO ATENDIMENTO</span>
          <h1>Fluxos de conversa</h1>
          <p>Uma mensagem inicia o caminho. Você escolhe os próximos passos.</p>
        </div>
        <button className="button primary" onClick={() => setCreate(true)}>
          <Plus size={17} />
          Novo fluxo
        </button>
      </header>
      <div className="flows-tabs">
        <button className={tab === 'flows' ? 'active' : ''} onClick={() => setTab('flows')}>
          Meus fluxos
        </button>
        <button className={tab === 'runs' ? 'active' : ''} onClick={() => setTab('runs')}>
          Execuções recentes
        </button>
        <button className={tab === 'inactivity' ? 'active' : ''} onClick={() => setTab('inactivity')}>
          Por inatividade
        </button>
        <span />
        {tab === 'flows' && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
            />
            Arquivados
          </label>
        )}
        <button className="icon-button" aria-label="Atualizar fluxos" onClick={refresh}>
          <RefreshCw size={16} />
        </button>
      </div>
      {loading && (
        <div className="flow-loading">
          <Spinner />
        </div>
      )}
      {tab === 'inactivity' ? (
        <InactivityRules sessionId={sessionId} />
      ) : tab === 'flows' ? (
        <>
          <div className="flow-info">
            Salve o rascunho, teste na simulação e publique. A ativação é feita separadamente e responde
            apenas a novas mensagens.
          </div>
          <div className="flow-cards">
            {items.map((flow) => (
              <article className="flow-card" key={flow.id}>
                <div className="flow-card-top">
                  <span className="flow-card-icon">
                    <Workflow size={23} />
                  </span>
                  <span className={`flow-status ${flow.enabled ? 'enabled' : ''}`}>
                    {flow.archived ? 'Arquivado' : flow.enabled ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
                <h2>{flow.name}</h2>
                <p>
                  {flow.published ? `Publicação v${flow.published.version}` : 'Rascunho · sem publicação'}
                  {flow.imported && ' · importado'}
                </p>
                <small>Atualizado em {new Date(flow.updatedAt).toLocaleDateString('pt-BR')}</small>
                <footer>
                  {!flow.archived && (
                    <>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void request<FlowDetail>(`${base}/flows/${flow.id}`)
                            .then(setEditor)
                            .catch((error) => notify(errorMessage(error), true))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Editar
                        <ArrowRight size={15} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`${flow.enabled ? 'Pausar' : 'Ativar'} ${flow.name}`}
                        title={flow.enabled ? 'Pausar e cancelar execuções' : 'Ativar fluxo'}
                        onClick={() =>
                          flow.enabled ? configure(flow, { enabled: false }) : setActivate(flow)
                        }
                      >
                        {flow.enabled ? <Pause size={17} /> : <Play size={17} />}
                      </button>
                    </>
                  )}
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`${flow.archived ? 'Restaurar' : 'Arquivar'} ${flow.name}`}
                    title={flow.archived ? 'Restaurar pausado' : 'Arquivar e cancelar execuções'}
                    onClick={() => configure(flow, { archived: !flow.archived })}
                  >
                    {flow.archived ? <RotateCcw size={17} /> : <Archive size={17} />}
                  </button>
                </footer>
              </article>
            ))}
          </div>
          {!loading && !items.length && (
            <div className="flows-empty">
              <Workflow size={40} />
              <h2>{archived ? 'Nenhum fluxo arquivado' : 'Seu próximo atendimento pode começar aqui'}</h2>
              <p>Combine mensagens, áudios, esperas e respostas em um caminho visual.</p>
              {!archived && (
                <button className="button primary" onClick={() => setCreate(true)}>
                  Criar meu primeiro fluxo
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flow-runs">
          {!runs.length && <div className="flows-empty">Nenhuma execução nesta conexão.</div>}
          {runs.map((run) => (
            <article key={run.id}>
              <div>
                <strong>{run.version.flow.name}</strong>
                <span>
                  {run.contact.name} · v{run.version.version}
                </span>
                <small>
                  {new Date(run.createdAt).toLocaleString('pt-BR')}
                  {run.nextRunAt && ` · Próxima etapa: ${new Date(run.nextRunAt).toLocaleString('pt-BR')}`}
                </small>
                {run.error && <p className="error-text">{run.error}</p>}
              </div>
              <span className="flow-status">{executionNames[run.status] ?? run.status}</span>
              {['QUEUED', 'RUNNING', 'WAITING_INPUT'].includes(run.status) && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void request(`${base}/runs/${run.id}/cancel`, 'POST')
                      .then(refresh)
                      .catch((error) => notify(errorMessage(error), true))
                      .finally(() => setBusy(false));
                  }}
                >
                  <Square size={13} />
                  Cancelar
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {create && (
        <Modal title="Novo fluxo" onClose={() => setCreate(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = new FormData(event.currentTarget).get('name');
              setBusy(true);
              void request<FlowDetail>(`${base}/flows`, 'POST', { name })
                .then((flow) => {
                  setEditor(flow);
                  setCreate(false);
                })
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Nome do fluxo
              <input name="name" required maxLength={100} placeholder="Ex.: Primeiro atendimento" autoFocus />
            </label>
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setCreate(false)}>
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                Criar fluxo
              </button>
            </div>
          </form>
        </Modal>
      )}
      {activate && (
        <Modal title="Ativar automação" onClose={() => setActivate(null)}>
          <p>
            O fluxo <strong>{activate.name}</strong> responderá automaticamente às novas mensagens que
            correspondam às regras publicadas, nesta conexão.
          </p>
          <p className="muted">
            Se mais de um fluxo corresponder, o mais antigo terá prioridade. Uma conversa usa uma automação
            por vez.
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setActivate(null)}>
              Voltar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => configure(activate, { enabled: true })}
            >
              <Play size={15} />
              Ativar fluxo
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
