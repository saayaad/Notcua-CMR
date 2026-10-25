import { AssetPreview } from './AssetPreview';
import { LibraryCategories, useLibraryOrganization } from './LibraryCategories';
import { ToolboxWorkspace, toolboxSections } from './ToolboxWorkspace';
import { MacroEditor } from './MacroEditor';
import { usePreferences } from '../context/PreferencesContext';
import { orderItems } from '../context/ordering';
import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import {
  X,
  Plus,
  Search,
  Pencil,
  Star,
  Trash2,
  Send,
  Play,
  Square,
  MessageSquare,
  Mic,
  Image,
  FileText,
  GitBranch,
  Layers,
  Wallet,
  PanelRightClose,
  Maximize2,
  Minimize2,
  MoreHorizontal,
} from 'lucide-react';
import type { Asset, Conversation, Funnel, Library, Sequence } from '../types';
import { errorMessage, useApi } from '../context/ApiContext';
import { Modal, Spinner } from './ui';
import { AssetEditor, FunnelEditor, PixEditor } from '../pages/LibraryPage';
import { PixModal } from './PixModal';

type Tab = Asset['kind'] | 'FUNNEL' | 'MACRO' | 'PIX';
const tabs = [
  { id: 'MESSAGE', name: 'Textos', icon: MessageSquare },
  { id: 'AUDIO', name: 'Áudios', icon: Mic },
  { id: 'MEDIA', name: 'Mídias', icon: Image },
  { id: 'DOCUMENT', name: 'Documentos', icon: FileText },
  { id: 'FUNNEL', name: 'Funis', icon: GitBranch },
  { id: 'MACRO', name: 'Macros', icon: Layers },
  { id: 'PIX', name: 'PIX', icon: Wallet },
] as const;
export function ToolsPanel({
  chat,
  library,
  sessionId,
  revision,
  connected,
  open,
  compact,
  onToggleSize,
  quick,
  onClose,
  onRefresh,
  onLibraryRefresh,
}: {
  chat: Conversation | null;
  library: Library;
  sessionId: string;
  revision: number;
  connected: boolean;
  open: boolean;
  compact: boolean;
  onToggleSize: () => void;
  quick: number;
  onClose: () => void;
  onRefresh: () => void;
  onLibraryRefresh: () => Promise<void>;
}) {
  const { request, notify } = useApi();
  const { preferences } = usePreferences();
  const [section, setSection] = useState('responses');
  const organization = useLibraryOrganization();
  const [category, setCategory] = useState('');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [mostUsed, setMostUsed] = useState(false);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>('MESSAGE');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [mode, setMode] = useState<'use' | 'manage'>('use');
  const [menu, setMenu] = useState('');
  const [runs, setRuns] = useState<Sequence[]>([]);
  const [macroEditor, setMacroEditor] = useState<string | null>(null);
  const [editor, setEditor] = useState<Asset | 'new' | null>(null);
  const [funnel, setFunnel] = useState<Funnel | 'new' | null>(null);
  const [pixEditor, setPixEditor] = useState(false);
  const [pixSend, setPixSend] = useState(false);
  const [preview, setPreview] = useState<Asset | null>(null);
  const [removing, setRemoving] = useState<Asset | null>(null);
  const base = `/attendance/sessions/${sessionId}/conversations/${chat?.id ?? ''}`;
  useEffect(() => {
    void request<Record<string, number>>('/operations/toolbox/usage')
      .then(setUsage)
      .catch(() => undefined);
  }, [revision, request]);
  useEffect(() => {
    setPreview(null);
    setPixSend(false);
    setRuns([]);
  }, [chat?.id, sessionId]);
  useEffect(() => {
    if (quick) {
      setSection('responses');
      setTab('MESSAGE');
      setSearch('');
      setMode('use');
    }
  }, [quick]);
  useEffect(() => {
    if (!chat) return;
    const controller = new AbortController();
    void request<{ items: Sequence[] }>(`${base}/sequences`, 'GET', undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRuns(data.items);
      })
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      });
    return () => controller.abort();
  }, [base, chat?.id, revision, request, notify]);
  const action = async (id: string, work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(id);
    try {
      await work();
      onRefresh();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy('');
    }
  };
  const run = runs.find((item) => ['QUEUED', 'RUNNING'].includes(item.status));
  const failed = runs.find((item) => item.status === 'FAILED');
  const canSend = Boolean(chat && connected && !busy);
  const matches = (name: string) => name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const assets = library.assets
    .filter(
      (asset) =>
        asset.kind === tab &&
        matches(asset.name) &&
        (!favorites || asset.isFavorite) &&
        (!category ||
          (category === '__none'
            ? !organization.assignments[asset.id]
            : organization.assignments[asset.id] === category)),
    )
    .sort((a, b) => (mostUsed ? (usage[b.id] ?? 0) - (usage[a.id] ?? 0) : 0));
  const enqueue = (kind: 'FUNNEL' | 'MACRO', sourceId: string) =>
    action(sourceId, async () => {
      await request(`${base}/sequences`, 'POST', { kind, sourceId, requestId: crypto.randomUUID() });
      notify('Sequência iniciada. Acompanhe a execução abaixo.');
    });
  const add = () =>
    tab === 'FUNNEL'
      ? setFunnel('new')
      : tab === 'PIX'
        ? setPixEditor(true)
        : tab === 'MACRO'
          ? setMacroEditor('new')
          : setEditor('new');
  return (
    <aside
      id="message-tools"
      hidden={!open}
      className={`contact-panel tools-panel ${open ? 'panel-open' : ''}`}
      aria-label="Ferramentas de mensagens"
    >
      <header className="tools-heading">
        <span>Ferramentas</span>
        <div className="tools-heading-actions">
          <button
            className="icon-button tools-size"
            aria-label={compact ? 'Ampliar painel' : 'Compactar painel'}
            title={compact ? 'Ampliar painel' : 'Compactar painel'}
            onClick={onToggleSize}
          >
            {compact ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
          </button>
          <button
            className="icon-button"
            aria-label="Ocultar painel de ferramentas"
            title="Ocultar ferramentas"
            onClick={onClose}
          >
            <PanelRightClose size={18} />
          </button>
        </div>
      </header>
      <nav className="toolbox-rail" aria-label="Ferramentas do atendimento">
        {toolboxSections.map(({ id, name, icon: Icon }) => (
          <button key={id} aria-pressed={section === id} title={name} onClick={() => setSection(id)}>
            <Icon size={18} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {section !== 'responses' && (
        <ToolboxWorkspace
          section={section}
          chat={chat}
          sessionId={sessionId}
          revision={revision}
          onRefresh={onRefresh}
        />
      )}
      <div className="tools-responses" hidden={section !== 'responses'}>
        <div className="tools-mode" role="group" aria-label="Modo das ferramentas">
          <button
            aria-pressed={mode === 'use'}
            onClick={() => {
              setMode('use');
              setMenu('');
            }}
          >
            <Send size={14} />
            Usar
          </button>
          <button aria-pressed={mode === 'manage'} onClick={() => setMode('manage')}>
            <Pencil size={14} />
            Gerenciar
          </button>
        </div>
        <div className="tools-category">
          <label htmlFor="tools-category">Tipo de recurso</label>
          <select
            id="tools-category"
            value={tab}
            onChange={(event) => {
              setTab(event.target.value as Tab);
              setSearch('');
              setMenu('');
            }}
          >
            {orderItems(tabs, preferences.folderOrder, (item) => item.id).map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="tools-toolbar">
          <label className="tools-search">
            <Search size={15} />
            <input
              aria-label="Buscar ferramenta"
              placeholder="Buscar por nome…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {mode === 'manage' && (
            <button className="tools-add" onClick={add}>
              <Plus size={15} />
              {tab === 'FUNNEL'
                ? 'Criar funil'
                : tab === 'PIX'
                  ? 'Cadastrar chave'
                  : tab === 'MACRO'
                    ? 'Criar macro'
                    : 'Criar resposta'}
            </button>
          )}
        </div>
        <div className="toolbox-filters">
          <button
            className={!favorites && !mostUsed ? 'selected' : ''}
            onClick={() => {
              setFavorites(false);
              setMostUsed(false);
              setCategory('');
            }}
          >
            Tudo
          </button>
          <button
            className={favorites ? 'selected' : ''}
            onClick={() => {
              setFavorites(!favorites);
              setMostUsed(false);
            }}
          >
            <Star size={12} /> Favoritos
          </button>
          <button
            className={mostUsed ? 'selected' : ''}
            onClick={() => {
              setMostUsed(!mostUsed);
              setFavorites(false);
            }}
          >
            <Play size={12} /> Mais usadas
          </button>
          <select
            aria-label="Filtrar por categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            <option value="__none">Sem categoria</option>
            {organization.categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <button onClick={() => setCategoriesOpen(true)} title="Criar categorias e organizar respostas">
            <Plus size={13} /> Categorias
          </button>
        </div>
        <div className="tools-content">
          {['MESSAGE', 'AUDIO', 'MEDIA', 'DOCUMENT'].includes(tab) && (
            <>
              {assets.map((asset) => (
                <article className="tool-card" key={asset.id}>
                  <div className="tool-card-heading">
                    <button className="tool-resource-title" onClick={() => setPreview(asset)}>
                      {asset.name}
                    </button>
                    {asset.isFavorite && <Star className="favorite" size={12} fill="currentColor" />}
                  </div>
                  <p>{asset.kind === 'MESSAGE' ? asset.text : asset.file?.filename}</p>
                  {asset.caption && <small>{asset.caption}</small>}
                  {mode === 'use' ? (
                    <button className="tool-send" disabled={!canSend} onClick={() => setPreview(asset)}>
                      <Send size={13} />
                      Usar resposta
                    </button>
                  ) : (
                    <div className="tool-manage-actions">
                      <button className="tool-edit" onClick={() => setEditor(asset)}>
                        <Pencil size={13} />
                        Editar
                      </button>
                      <div className="tool-menu">
                        <button
                          className="icon-button"
                          aria-label={`Mais opções de ${asset.name}`}
                          aria-expanded={menu === asset.id}
                          onClick={() => setMenu(menu === asset.id ? '' : asset.id)}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menu === asset.id && (
                          <div className="tool-menu-options">
                            <button
                              onClick={() => {
                                setMenu('');
                                void action(asset.id, async () => {
                                  await request(`/attendance/assets/${encodeURIComponent(asset.id)}`, 'PUT', {
                                    ...asset,
                                    isFavorite: !asset.isFavorite,
                                  });
                                  await onLibraryRefresh();
                                });
                              }}
                            >
                              <Star size={13} />
                              {asset.isFavorite ? 'Remover favorito' : 'Favoritar'}
                            </button>
                            <button
                              onClick={() => {
                                setMenu('');
                                void action(asset.id, async () => {
                                  await request(
                                    `/attendance/assets/${encodeURIComponent(asset.id)}/duplicate`,
                                    'POST',
                                  );
                                  await onLibraryRefresh();
                                  notify('Resposta duplicada.');
                                });
                              }}
                            >
                              <Copy size={13} /> Duplicar resposta
                            </button>
                            <button
                              onClick={() => {
                                setMenu('');
                                setRemoving(asset);
                              }}
                            >
                              <Trash2 size={13} />
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {!assets.length && (
                <div className="tools-empty">
                  Nenhum recurso encontrado. Use Gerenciar para criar suas respostas.
                </div>
              )}
            </>
          )}
          {tab === 'FUNNEL' && (
            <>
              {library.funnels
                .filter(
                  (item) =>
                    matches(item.name) &&
                    (!category ||
                      (category === '__none'
                        ? !organization.assignments[item.id]
                        : organization.assignments[item.id] === category)),
                )
                .sort((a, b) => (mostUsed ? (usage[b.id] ?? 0) - (usage[a.id] ?? 0) : 0))
                .map((item) => (
                  <article className="tool-card" key={item.id}>
                    <div className="tool-card-heading">
                      <strong>{item.name}</strong>
                      {mode === 'manage' && (
                        <button
                          className="icon-button"
                          aria-label={`Editar funil ${item.name}`}
                          onClick={() => setFunnel(item)}
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                    </div>
                    <p>
                      {item.items.length} etapas ·{' '}
                      {Math.round(item.items.reduce((sum, step) => sum + step.delayBeforeSendMs, 0) / 1000)}s
                      de intervalo
                    </p>
                    {mode === 'use' && (
                      <button
                        className="tool-send"
                        disabled={!canSend || Boolean(run)}
                        onClick={() => void enqueue('FUNNEL', item.id)}
                      >
                        <Play size={13} />
                        Iniciar funil
                      </button>
                    )}
                  </article>
                ))}
              {!library.funnels.length && (
                <div className="tools-empty">Crie um funil para organizar seus envios em sequência.</div>
              )}
            </>
          )}
          {tab === 'MACRO' && (
            <>
              <p className="tools-hint">
                Combine textos, recursos, etiquetas e utilitários em uma sequência.
              </p>
              {library.macros
                .filter(
                  (item) =>
                    matches(item.name) &&
                    (!category ||
                      (category === '__none'
                        ? !organization.assignments[item.id]
                        : organization.assignments[item.id] === category)),
                )
                .sort((a, b) => (mostUsed ? (usage[b.id] ?? 0) - (usage[a.id] ?? 0) : 0))
                .map((item) => (
                  <article className="tool-card" key={item.id}>
                    <strong>{item.name}</strong>
                    {mode === 'manage' && (
                      <button className="text-button" onClick={() => setMacroEditor(item.id)}>
                        Editar macro
                      </button>
                    )}
                    <p>{item._count.actions} ações combinadas</p>
                    <button
                      className="tool-send"
                      disabled={!canSend || Boolean(run)}
                      onClick={() => void enqueue('MACRO', item.id)}
                    >
                      <Play size={13} />
                      Executar macro
                    </button>
                  </article>
                ))}
              {!library.macros.length && <div className="tools-empty">Nenhuma macro importada.</div>}
            </>
          )}
          {tab === 'PIX' && (
            <>
              {library.pixKeys
                .filter((item) => matches(item.name))
                .map((item) => (
                  <article className="tool-card" key={item.id}>
                    <strong>{item.name}</strong>
                    <p>{item.value}</p>
                    <small>{item.merchantName}</small>
                  </article>
                ))}
              {!library.pixKeys.length && (
                <div className="tools-empty">Cadastre uma chave que já exista na sua conta bancária.</div>
              )}
              {mode === 'use' && (
                <button
                  className="button pix-tools-send"
                  disabled={!canSend || !library.pixKeys.length}
                  onClick={() => setPixSend(true)}
                >
                  <Wallet size={16} />
                  Preparar envio de PIX
                </button>
              )}
            </>
          )}
        </div>
        {run && (
          <div className="run-card">
            <strong>{run.name}</strong>
            <p>
              Etapa {Math.min(run.position + 1, run.steps.length)} de {run.steps.length} ·{' '}
              {run.status === 'RUNNING'
                ? 'Executando'
                : connected
                  ? 'Aguardando intervalo'
                  : 'Aguardando conexão'}
            </p>
            <button
              className="button small"
              disabled={Boolean(busy)}
              onClick={() => void action(run.id, () => request(`${base}/sequences/${run.id}/cancel`, 'POST'))}
            >
              <Square size={12} />
              Cancelar sequência
            </button>
          </div>
        )}
        {!run && failed && <p className="field-error panel-section">{failed.error}</p>}
        {(!chat || !connected) && (
          <footer className="tools-footer">
            {!chat ? 'Selecione uma conversa para habilitar os envios.' : 'Conecte o WhatsApp para enviar.'}
          </footer>
        )}
      </div>
      {categoriesOpen && <LibraryCategories library={library} onClose={() => setCategoriesOpen(false)} />}
      {macroEditor && (
        <MacroEditor
          initialId={macroEditor === 'new' ? undefined : macroEditor}
          sessionId={sessionId}
          library={library}
          onClose={() => setMacroEditor(null)}
          onSaved={async () => {
            setMacroEditor(null);
            await onLibraryRefresh();
          }}
        />
      )}{' '}
      {editor && (
        <AssetEditor
          key={editor === 'new' ? `new:${tab}` : editor.id}
          initial={editor === 'new' ? undefined : editor}
          kind={editor === 'new' ? (tab as Asset['kind']) : editor.kind}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await onLibraryRefresh();
          }}
        />
      )}
      {funnel && (
        <FunnelEditor
          initial={funnel === 'new' ? undefined : funnel}
          library={library}
          onClose={() => setFunnel(null)}
          onSaved={async () => {
            setFunnel(null);
            await onLibraryRefresh();
          }}
        />
      )}
      {pixEditor && (
        <PixEditor
          onClose={() => setPixEditor(false)}
          onSaved={async () => {
            setPixEditor(false);
            await onLibraryRefresh();
          }}
        />
      )}
      {pixSend && chat && (
        <PixModal library={library} base={base} onClose={() => setPixSend(false)} onSent={onRefresh} />
      )}
      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)}>
          <p className="muted">
            {chat ? (
              <>
                Será enviado para <strong>{chat.contact.name}</strong>.
              </>
            ) : (
              'Prévia do recurso da biblioteca.'
            )}
          </p>
          <AssetPreview asset={preview} name={chat?.contact.name} />
          <div className="modal-actions">
            <button className="button" onClick={() => setPreview(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={!canSend}
              onClick={() =>
                void action(preview.id, async () => {
                  await request(`${base}/send-asset`, 'POST', {
                    assetId: preview.id,
                    requestId: crypto.randomUUID(),
                  });
                  const next = await request<{ count: number }>('/operations/toolbox/usage', 'POST', {
                    id: preview.id,
                  });
                  setUsage((current) => ({ ...current, [preview.id]: next.count }));
                  setPreview(null);
                  notify('Resposta enviada.');
                })
              }
            >
              {busy ? <Spinner /> : <Send size={16} />}Enviar resposta
            </button>
          </div>
        </Modal>
      )}
      {removing && (
        <Modal title="Excluir resposta" onClose={() => setRemoving(null)}>
          <p>
            Excluir a resposta <strong>{removing.name}</strong> da biblioteca?
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={Boolean(busy)}
              onClick={() =>
                void action(removing.id, async () => {
                  await request(`/attendance/assets/${encodeURIComponent(removing.id)}`, 'DELETE');
                  setRemoving(null);
                  await onLibraryRefresh();
                  notify('Resposta excluída.');
                })
              }
            >
              Excluir resposta
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
}
