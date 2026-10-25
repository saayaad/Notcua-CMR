import { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  Plus,
  Search,
  Pencil,
  Send,
  RefreshCw,
  GripVertical,
  X,
  Eye,
  Archive,
} from 'lucide-react';
import type { Asset, Conversation, Library } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { insertDraft } from '../context/attendance';
import { Modal, Spinner } from './ui';
import { AssetPreview } from './AssetPreview';
import { ReorderList } from './ReorderList';

interface Reply {
  id: string;
  question: string;
  variants: string[];
  text: string;
  assetIds: string[];
  category: string;
  active: boolean;
  match?: number;
}
interface Suggestion {
  id: string;
  question: string;
  clients: number;
  occurrences: number;
  variants: string[];
  suggestedText: string;
}
type Draft = Omit<Reply, 'id' | 'match'> & { id?: string };
const emptyDraft = (): Draft => ({
  question: '',
  variants: [],
  text: '',
  assetIds: [],
  category: '',
  active: true,
});
export function StandardReplies({
  sessionId,
  chat,
  library,
  connected,
  revision,
  question,
  questionStamp,
  onSent,
  onCloseTools,
  onCreateResource,
}: {
  sessionId: string;
  chat: Conversation | null;
  library: Library;
  connected: boolean;
  revision: number;
  question?: string;
  questionStamp?: number;
  onSent: () => void;
  onCloseTools: () => void;
  onCreateResource: (kind: Asset['kind']) => void;
}) {
  const { request, notify } = useApi();
  const base = `/operations/sessions/${sessionId}/standard-replies`;
  const [items, setItems] = useState<Reply[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tab, setTab] = useState<'saved' | 'suggestions'>('saved');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Draft | null>(null);
  const [variants, setVariants] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [preview, setPreview] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [organize, setOrganize] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [removing, setRemoving] = useState<Reply | null>(null);
  const [sendId, setSendId] = useState('');
  const [sendError, setSendError] = useState('');
  const latestQuestion = chat?.messages[0]?.direction === 'INBOUND' ? (chat.messages[0].text ?? '') : '';
  useEffect(() => {
    if (question) {
      setEditor({ ...emptyDraft(), question: question.slice(0, 400) });
      setVariants('');
      setAssetSearch('');
    }
  }, [question, questionStamp]);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    setLoading(true);
    void request<{ items: Reply[] }>(
      `${base}?question=${encodeURIComponent(latestQuestion.slice(0, 500))}`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((result) => setItems(result.items))
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [base, sessionId, latestQuestion, tick, request, notify]);
  useEffect(() => {
    if (tab !== 'suggestions' || !sessionId) return;
    const controller = new AbortController();
    setLoading(true);
    void request<{ items: Suggestion[] }>(`${base}/suggestions`, 'GET', undefined, controller.signal)
      .then((result) => setSuggestions(result.items))
      .catch((error) => {
        if (!controller.signal.aborted) notify(errorMessage(error), true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [tab, base, sessionId, tick, request, notify]);
  const edit = (value: Draft) => {
    setEditor(value);
    setVariants(value.variants.join('\n'));
    setAssetSearch('');
  };
  const openPreview = (value: Reply) => {
    setPreview(value);
    setSendId(crypto.randomUUID());
    setSendError('');
  };
  const save = async () => {
    if (!editor) return;
    setBusy(true);
    try {
      await request(
        editor.id ? `${base}/${encodeURIComponent(editor.id)}` : base,
        editor.id ? 'PUT' : 'POST',
        {
          ...editor,
          variants: variants
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
      );
      setEditor(null);
      setTab('saved');
      setTick((value) => value + 1);
      notify('Resposta padrão salva. A aplicação continua sob seu controle.');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!preview || !chat) return;
    setBusy(true);
    setSendError('');
    try {
      await request(`${base}/${encodeURIComponent(preview.id)}/send`, 'POST', {
        conversationId: chat.id,
        requestId: sendId,
        confirmed: true,
      });
      setPreview(null);
      onSent();
      onCloseTools();
      notify('Resposta padrão enviada.');
    } catch (error) {
      const reason = errorMessage(error);
      setSendError(
        `${reason} Algumas partes podem já ter sido enviadas. Confira a conversa antes de continuar; esta janela mantém o mesmo identificador para evitar duplicação.`,
      );
    } finally {
      setBusy(false);
    }
  };
  const filtered = items
    .filter((item) =>
      `${item.question} ${item.text} ${item.variants.join(' ')} ${item.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => (b.match ?? 0) - (a.match ?? 0));
  return (
    <div className="standard-replies">
      <div className="tool-section-intro">
        <BookOpenCheck size={24} />
        <h3>Respostas padrão</h3>
        <p>
          Uma pergunta, uma resposta aprovada. Combine texto, áudio e arquivos sem precisar procurar tudo
          novamente.
        </p>
      </div>
      <div className="workbench-button-row">
        <button
          className="button primary"
          disabled={!sessionId}
          onClick={() => edit({ ...emptyDraft(), question: latestQuestion.slice(0, 400) })}
        >
          <Plus size={15} />
          Cadastrar pergunta
        </button>
        <button
          className="icon-button"
          title="Reordenar respostas padrão"
          aria-label="Reordenar respostas padrão"
          onClick={() => {
            setDraftOrder(items.map((item) => item.id));
            setOrganize(true);
          }}
        >
          <GripVertical size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Atualizar respostas padrão"
          title="Atualizar"
          onClick={() => setTick((value) => value + 1)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="workbench-tabs">
        <button aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>
          Cadastradas ({items.length})
        </button>
        <button aria-pressed={tab === 'suggestions'} onClick={() => setTab('suggestions')}>
          Perguntas repetidas
        </button>
      </div>
      {tab === 'saved' && (
        <>
          <label className="workbench-search">
            <Search size={16} />
            <input
              aria-label="Buscar respostas padrão"
              placeholder="Pergunta, resposta ou categoria"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {latestQuestion && items.some((item) => (item.match ?? 0) >= 0.67) && (
            <p className="workbench-match-hint">
              Encontramos padrões parecidos com a última pergunta deste cliente. Revise antes de usar.
            </p>
          )}
          {filtered.map((item) => (
            <article
              className={`standard-reply-card ${(item.match ?? 0) >= 0.67 ? 'matching' : ''}`}
              key={item.id}
            >
              <div className="resource-card-top">
                <span>
                  {item.category || 'Pergunta cadastrada'}
                  {!item.active && ' · Desativada'}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Editar ${item.question}`}
                  onClick={() => edit(item)}
                >
                  <Pencil size={15} />
                </button>
              </div>
              <h4>{item.question}</h4>
              <p>{item.text || 'Resposta com arquivos da Biblioteca.'}</p>
              {item.assetIds.length > 0 && (
                <small>
                  {item.assetIds.length} recurso(s):{' '}
                  {item.assetIds
                    .map(
                      (id) => library.assets.find((asset) => asset.id === id)?.name ?? 'Recurso indisponível',
                    )
                    .join(' · ')}
                </small>
              )}
              <div className="resource-card-actions">
                {item.text && (
                  <button
                    className="button small"
                    disabled={!chat || !item.active}
                    onClick={() => {
                      insertDraft(chat!.id, item.text);
                      onCloseTools();
                    }}
                  >
                    Inserir texto
                  </button>
                )}
                <button className="button small" onClick={() => openPreview(item)}>
                  <Eye size={14} />
                  Prévia e envio
                </button>
                <button
                  className="icon-button"
                  title="Arquivar padrão"
                  aria-label={`Arquivar ${item.question}`}
                  onClick={() => setRemoving(item)}
                >
                  <Archive size={14} />
                </button>
              </div>
            </article>
          ))}
          {!filtered.length && !loading && (
            <div className="workbench-empty">
              <BookOpenCheck size={28} />
              <strong>Cadastre sua primeira resposta padrão</strong>
              <p>Exemplo: “Qual o prazo para finalizar o vídeo?” Associe uma resposta e suas variações.</p>
            </div>
          )}
        </>
      )}
      {tab === 'suggestions' && (
        <>
          <p className="workbench-explanation">
            Sugestões por semelhança de texto, em até 3.000 mensagens dos últimos 60 dias. A mesma pergunta
            precisa aparecer em conversas de pelo menos dois clientes. Não há envio automático.
          </p>
          {suggestions.map((item) => (
            <article className="standard-reply-card" key={item.id}>
              <span className="resource-kind">
                {item.clients} clientes · {item.occurrences} ocorrências
              </span>
              <h4>{item.question}</h4>
              <details>
                <summary>Ver variações encontradas</summary>
                {item.variants.map((variant) => (
                  <p key={variant}>{variant}</p>
                ))}
              </details>
              {item.suggestedText && (
                <p className="historical-answer">
                  <strong>Resposta encontrada no histórico — revise:</strong>
                  {item.suggestedText}
                </p>
              )}
              <div className="resource-card-actions">
                <button
                  className="button primary small"
                  onClick={() =>
                    edit({
                      ...emptyDraft(),
                      question: item.question.slice(0, 400),
                      variants: item.variants
                        .filter((variant) => variant !== item.question)
                        .map((variant) => variant.slice(0, 400)),
                      text: item.suggestedText,
                    })
                  }
                >
                  Revisar e cadastrar
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    void request(`${base}/suggestions/${item.id}/dismiss`, 'POST')
                      .then(() =>
                        setSuggestions((current) => current.filter((entry) => entry.id !== item.id)),
                      )
                      .catch((error) => notify(errorMessage(error), true))
                  }
                >
                  Ignorar
                </button>
              </div>
            </article>
          ))}
          {!suggestions.length && !loading && (
            <div className="workbench-empty">
              <BookOpenCheck size={27} />
              <strong>Nenhuma pergunta repetida para revisar</strong>
              <p>Você pode cadastrar manualmente e voltar aqui quando houver novas conversas.</p>
            </div>
          )}
          <button
            className="text-button"
            onClick={() =>
              void request(`${base}/suggestions/reset`, 'POST')
                .then(() => setTick((value) => value + 1))
                .catch((error) => notify(errorMessage(error), true))
            }
          >
            Restaurar sugestões ignoradas
          </button>
        </>
      )}
      {loading && (
        <div className="workbench-loading">
          <Spinner />
          Buscando respostas…
        </div>
      )}
      {editor && (
        <Modal
          title={editor.id ? 'Editar resposta padrão' : 'Cadastrar resposta padrão'}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
          wide
        >
          <form
            className="standard-reply-editor"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label>
              Pergunta principal
              <input
                required
                minLength={5}
                maxLength={400}
                value={editor.question}
                onChange={(event) => setEditor({ ...editor, question: event.target.value })}
                placeholder="Qual o prazo para finalizar o vídeo?"
              />
            </label>
            <label>
              Outras formas de perguntar · uma por linha
              <textarea
                rows={3}
                value={variants}
                onChange={(event) => setVariants(event.target.value)}
                placeholder={'Quanto tempo demora o vídeo?\nEm quantos dias fica pronto?'}
              />
            </label>
            <label>
              Categoria
              <input
                maxLength={80}
                value={editor.category}
                onChange={(event) => setEditor({ ...editor, category: event.target.value })}
                placeholder="Ex.: Prazos, pagamentos, produção"
              />
            </label>
            <label>
              Texto da resposta
              <textarea
                rows={5}
                maxLength={20000}
                value={editor.text}
                onChange={(event) => setEditor({ ...editor, text: event.target.value })}
                placeholder="Escreva a resposta aprovada. Você pode usar #nome."
              />
            </label>
            <div className="faq-media-heading">
              <strong>Áudios, imagens e outros recursos</strong>
              <div className="workbench-button-row">
                <button type="button" className="button small" onClick={() => onCreateResource('AUDIO')}>
                  Novo áudio
                </button>
                <button type="button" className="button small" onClick={() => onCreateResource('MEDIA')}>
                  Nova mídia
                </button>
                <button type="button" className="button small" onClick={() => onCreateResource('DOCUMENT')}>
                  Novo arquivo
                </button>
              </div>
            </div>
            <input
              aria-label="Buscar arquivos para resposta padrão"
              placeholder="Buscar na Biblioteca"
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
            />
            <div className="faq-asset-picker">
              {library.assets
                .filter((asset) => asset.name.toLowerCase().includes(assetSearch.toLowerCase()))
                .slice(0, 60)
                .map((asset) => (
                  <label className="checkbox" key={asset.id}>
                    <input
                      type="checkbox"
                      checked={editor.assetIds.includes(asset.id)}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          assetIds: event.target.checked
                            ? [...editor.assetIds, asset.id]
                            : editor.assetIds.filter((id) => id !== asset.id),
                        })
                      }
                    />
                    <span>
                      {asset.name}
                      <small>{asset.kind}</small>
                    </span>
                  </label>
                ))}
            </div>
            {editor.assetIds.length > 0 && (
              <ReorderList
                label="Ordem dos recursos da resposta"
                items={editor.assetIds.map((id) => ({
                  id,
                  name: library.assets.find((asset) => asset.id === id)?.name ?? 'Recurso indisponível',
                }))}
                onChange={(ids) => setEditor({ ...editor, assetIds: ids })}
              />
            )}
            <small className="muted">
              O texto é enviado primeiro, seguido dos recursos na ordem acima. O cadastro não envia mensagens.
            </small>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editor.active}
                onChange={(event) => setEditor({ ...editor, active: event.target.checked })}
              />
              Disponível para usar no atendimento
            </label>
            <div className="modal-actions">
              <button type="button" className="button" disabled={busy} onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={busy || (!editor.text.trim() && !editor.assetIds.length)}
              >
                {busy ? <Spinner /> : <BookOpenCheck size={15} />}Salvar resposta padrão
              </button>
            </div>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal
          title="Conferir resposta padrão"
          onClose={() => {
            if (!busy) setPreview(null);
          }}
          wide
        >
          <div className="faq-full-preview">
            <h3>{preview.question}</h3>
            {preview.text && <p>{preview.text.replaceAll('#nome', chat?.contact.name ?? '#nome')}</p>}
            {preview.assetIds.map((id, index) => {
              const asset = library.assets.find((item) => item.id === id);
              return (
                <section key={id}>
                  <strong>
                    {index + 1}. {asset?.name ?? 'Recurso indisponível'}
                  </strong>
                  {asset && <AssetPreview asset={asset} name={chat?.contact.name} />}
                </section>
              );
            })}
          </div>
          {sendError && (
            <p className="field-error" role="alert">
              {sendError}
            </p>
          )}
          <p className="notice">
            {chat
              ? `Destino: ${chat.contact.name}. ${preview.assetIds.length + (preview.text.trim() ? 1 : 0)} parte(s) serão enviadas, na ordem exibida.`
              : 'Selecione uma conversa para enviar.'}
          </p>
          <div className="modal-actions">
            <button className="button" disabled={busy} onClick={() => setPreview(null)}>
              Fechar prévia
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                !chat ||
                !connected ||
                !preview.active ||
                preview.assetIds.some((id) => !library.assets.some((asset) => asset.id === id))
              }
              onClick={() => void send()}
            >
              {busy ? <Spinner /> : <Send size={15} />}
              {sendError ? 'Continuar o mesmo envio' : 'Confirmar envio'}
            </button>
          </div>
        </Modal>
      )}
      {organize && (
        <Modal title="Reordenar respostas padrão" onClose={() => setOrganize(false)}>
          <ReorderList
            label="Ordem das respostas padrão"
            items={draftOrder.map((id) => ({
              id,
              name: items.find((item) => item.id === id)?.question ?? id,
            }))}
            onChange={setDraftOrder}
          />
          <div className="modal-actions">
            <button className="button" onClick={() => setOrganize(false)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void request(`${base}/order`, 'PUT', { ids: draftOrder })
                  .then(() => {
                    setOrganize(false);
                    setTick((value) => value + 1);
                  })
                  .catch((error) => notify(errorMessage(error), true))
                  .finally(() => setBusy(false));
              }}
            >
              Confirmar ordem
            </button>
          </div>
        </Modal>
      )}
      {removing && (
        <Modal title="Arquivar resposta padrão" onClose={() => setRemoving(null)}>
          <p>Arquivar “{removing.question}”? As mensagens já enviadas não são alteradas.</p>
          <div className="modal-actions">
            <button className="button" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void request(`${base}/${encodeURIComponent(removing.id)}`, 'DELETE')
                  .then(() => {
                    setRemoving(null);
                    setTick((value) => value + 1);
                  })
                  .catch((error) => notify(errorMessage(error), true))
                  .finally(() => setBusy(false));
              }}
            >
              Arquivar padrão
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
