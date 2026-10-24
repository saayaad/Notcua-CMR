import { MacroEditor } from '../components/MacroEditor';
import { ResourcePicker } from '../components/ResourcePicker';
import { useState, type FormEvent } from 'react';
import {
  Plus,
  Search,
  Star,
  Pencil,
  Trash2,
  MessageSquare,
  Mic,
  Image,
  FileText,
  GitBranch,
  Layers,
  Wallet,
  ArrowUp,
  ArrowDown,
  Upload,
} from 'lucide-react';
import type { Asset, Funnel, Library } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from '../components/ui';
import { fileBase64 } from '../components/Composer';

export function LibraryPage({
  library,
  refresh,
  sessionId,
}: {
  sessionId: string;
  library: Library;
  refresh: () => Promise<void>;
}) {
  const { request, notify } = useApi();
  const [macroEditor, setMacroEditor] = useState<string | null>(null);
  const [tab, setTab] = useState('MESSAGE');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Asset | 'new' | null>(null);
  const [funnel, setFunnel] = useState<Funnel | 'new' | null>(null);
  const [pix, setPix] = useState(false);
  const tabs = [
    { id: 'MESSAGE', name: 'Textos', icon: MessageSquare },
    { id: 'AUDIO', name: 'Áudios', icon: Mic },
    { id: 'MEDIA', name: 'Mídias', icon: Image },
    { id: 'DOCUMENT', name: 'Documentos', icon: FileText },
    { id: 'FUNNEL', name: 'Funis', icon: GitBranch },
    { id: 'MACRO', name: 'Macros', icon: Layers },
    { id: 'PIX', name: 'PIX', icon: Wallet },
  ];
  const assets = library.assets.filter(
    (asset) => asset.kind === tab && asset.name.toLowerCase().includes(search.toLowerCase()),
  );
  const favorite = async (asset: Asset) => {
    try {
      await request(`/attendance/assets/${encodeURIComponent(asset.id)}`, 'PUT', {
        ...asset,
        isFavorite: !asset.isFavorite,
      });
      await refresh();
    } catch (error) {
      notify(errorMessage(error), true);
    }
  };
  const remove = async (asset: Asset) => {
    if (!window.confirm(`Excluir a resposta “${asset.name}”?`)) return;
    try {
      await request(`/attendance/assets/${encodeURIComponent(asset.id)}`, 'DELETE');
      await refresh();
      notify('Resposta excluída.');
    } catch (error) {
      notify(errorMessage(error), true);
    }
  };
  return (
    <main className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEUS RECURSOS, SEMPRE À MÃO</p>
          <h1>Biblioteca</h1>
          <p>Prepare uma vez. Atenda com mais agilidade, todos os dias.</p>
        </div>
        {
          <button
            className="button primary"
            onClick={() =>
              tab === 'FUNNEL'
                ? setFunnel('new')
                : tab === 'PIX'
                  ? setPix(true)
                  : tab === 'MACRO'
                    ? setMacroEditor('new')
                    : setEditor('new')
            }
          >
            <Plus size={17} />
            {tab === 'FUNNEL'
              ? 'Criar funil'
              : tab === 'PIX'
                ? 'Cadastrar chave'
                : tab === 'MACRO'
                  ? 'Criar macro'
                  : 'Nova resposta'}
          </button>
        }
      </div>
      <div className="library-tabs">
        {tabs.map(({ id, name, icon: Icon }) => (
          <button className={tab === id ? 'selected' : ''} key={id} onClick={() => setTab(id)}>
            <Icon size={17} />
            {name}
          </button>
        ))}
      </div>
      <label className="search-box library-search">
        <Search size={17} />
        <input
          aria-label="Buscar na biblioteca"
          placeholder="Buscar na biblioteca…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="library-grid">
        {['MESSAGE', 'AUDIO', 'MEDIA', 'DOCUMENT'].includes(tab) &&
          assets.map((asset) => (
            <article className="resource-card" key={asset.id}>
              <div className="resource-heading">
                <span className="asset-icon">
                  {asset.kind === 'AUDIO' ? (
                    <Mic size={20} />
                  ) : asset.kind === 'MEDIA' ? (
                    <Image size={20} />
                  ) : (
                    <FileText size={20} />
                  )}
                </span>
                <button
                  className={`icon-button ${asset.isFavorite ? 'favorite' : ''}`}
                  aria-label={asset.isFavorite ? 'Remover favorito' : 'Favoritar'}
                  onClick={() => void favorite(asset)}
                >
                  <Star size={17} fill={asset.isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <h2>{asset.name}</h2>
              <p>{asset.text || asset.caption || asset.file?.filename}</p>
              <div className="resource-footer">
                <span>
                  {asset.isPtt
                    ? 'Mensagem de voz'
                    : asset.isPtv
                      ? 'Recado circular'
                      : asset.kind === 'MESSAGE'
                        ? 'Texto personalizado'
                        : asset.file?.mimeType.split(';')[0]}
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label={`Editar ${asset.name}`}
                    onClick={() => setEditor(asset)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Excluir ${asset.name}`}
                    onClick={() => void remove(asset)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        {tab === 'FUNNEL' &&
          library.funnels
            .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
            .map((item) => (
              <article className="resource-card" key={item.id}>
                <span className="asset-icon">
                  <GitBranch size={21} />
                </span>
                <h2>{item.name}</h2>
                <p>
                  {item.items.length} etapas ·{' '}
                  {Math.round(item.items.reduce((sum, step) => sum + step.delayBeforeSendMs, 0) / 1000)}{' '}
                  segundos de espera
                </p>
                <ol className="funnel-preview">
                  {item.items.slice(0, 3).map((step, index) => (
                    <li key={index}>{step.asset.name}</li>
                  ))}
                </ol>
                <div className="resource-footer">
                  <span>Disparo pelo painel do contato</span>
                  <button
                    className="icon-button"
                    aria-label={`Editar ${item.name}`}
                    onClick={() => setFunnel(item)}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              </article>
            ))}
        {tab === 'MACRO' &&
          library.macros.map((item) => (
            <article className="resource-card" key={item.id}>
              <span className="asset-icon">
                <Layers size={21} />
              </span>
              <h2>{item.name}</h2>
              <p>{item.text || `${item._count.actions} ações combinadas`}</p>
              <button className="button small" onClick={() => setMacroEditor(item.id)}>
                Editar macro
              </button>
            </article>
          ))}
        {tab === 'PIX' &&
          library.pixKeys.map((key) => (
            <article className="resource-card" key={key.id}>
              <span className="asset-icon pix">
                <Wallet size={21} />
              </span>
              <h2>{key.name}</h2>
              <p className="break-word">{key.value}</p>
              <div className="resource-footer">
                <span>
                  {key.type === 'RANDOM' ? 'Chave aleatória' : key.type} · {key.merchantName}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Excluir chave ${key.name}`}
                  onClick={() => {
                    if (window.confirm('Remover esta chave da biblioteca local?'))
                      void request(`/attendance/pix-keys/${key.id}`, 'DELETE')
                        .then(refresh)
                        .catch((error) => notify(errorMessage(error), true));
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
      </div>
      {((['MESSAGE', 'AUDIO', 'MEDIA', 'DOCUMENT'].includes(tab) && !assets.length) ||
        (tab === 'FUNNEL' && !library.funnels.length) ||
        (tab === 'PIX' && !library.pixKeys.length) ||
        (tab === 'MACRO' && !library.macros.length)) && (
        <div className="library-empty">
          <Layers size={30} />
          <h2>Sua biblioteca começa aqui</h2>
          <p>
            {tab === 'MACRO'
              ? 'Importe suas macros em Configurações → Importar backup.'
              : 'Adicione um recurso para deixá-lo pronto no seu próximo atendimento.'}
          </p>
        </div>
      )}
      {macroEditor && (
        <MacroEditor
          initialId={macroEditor === 'new' ? undefined : macroEditor}
          sessionId={sessionId}
          library={library}
          onClose={() => setMacroEditor(null)}
          onSaved={async () => {
            setMacroEditor(null);
            await refresh();
          }}
        />
      )}{' '}
      {editor && (
        <AssetEditor
          initial={editor === 'new' ? undefined : editor}
          kind={tab as Asset['kind']}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await refresh();
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
            await refresh();
          }}
        />
      )}
      {pix && (
        <PixEditor
          onClose={() => setPix(false)}
          onSaved={async () => {
            setPix(false);
            await refresh();
          }}
        />
      )}
    </main>
  );
}

export function AssetEditor({
  initial,
  kind,
  onClose,
  onSaved,
}: {
  initial?: Asset;
  kind: Asset['kind'];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { request, notify } = useApi();
  const [name, setName] = useState(initial?.name ?? '');
  const [text, setText] = useState(initial?.text ?? '');
  const [caption, setCaption] = useState(initial?.caption ?? '');
  const [ptt, setPtt] = useState(initial?.isPtt ?? kind === 'AUDIO');
  const [ptv, setPtv] = useState(initial?.isPtv ?? false);
  const [viewOnce, setViewOnce] = useState(initial?.asViewOnce ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      let fileId = initial?.fileId ?? undefined;
      if (file) {
        if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo deve ter até 20 MiB.');
        fileId = (
          await request<{ id: string }>('/attendance/files', 'POST', {
            base64: await fileBase64(file),
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            voice: kind === 'AUDIO' && ptt,
          })
        ).id;
      }
      await request(
        initial ? `/attendance/assets/${encodeURIComponent(initial.id)}` : '/attendance/assets',
        initial ? 'PUT' : 'POST',
        {
          name,
          kind,
          text: kind === 'MESSAGE' ? text : undefined,
          caption: caption || undefined,
          fileId,
          isPtt: ptt,
          isPtv: ptv,
          asViewOnce: viewOnce,
          isFavorite: initial?.isFavorite ?? false,
        },
      );
      await onSaved();
      notify('Resposta salva na biblioteca.');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? 'Editar resposta' : 'Nova resposta rápida'} onClose={onClose}>
      <form onSubmit={(event) => void save(event)}>
        <label>
          Nome
          <input
            required
            maxLength={100}
            placeholder="Ex.: Boas-vindas"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {kind === 'MESSAGE' ? (
          <label>
            Mensagem
            <textarea
              required
              rows={6}
              placeholder="Olá, #nome! Como posso ajudar?"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <small className="muted">Use #nome, *negrito*, _itálico_ e ~riscado~.</small>
          </label>
        ) : (
          <>
            <label className="file-upload">
              <Upload size={22} />
              <span>{file?.name || initial?.file?.filename || 'Escolha um arquivo de até 20 MiB'}</span>
              <input
                type="file"
                required={!initial?.fileId}
                accept={kind === 'AUDIO' ? 'audio/*' : kind === 'MEDIA' ? 'image/*,video/*' : undefined}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label>
              Legenda
              <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </label>
            {kind === 'AUDIO' && (
              <label className="checkbox">
                <input type="checkbox" checked={ptt} onChange={(e) => setPtt(e.target.checked)} />
                Mensagem de voz · converter para OGG/Opus
              </label>
            )}
            {kind === 'MEDIA' && (
              <>
                <label className="checkbox">
                  <input type="checkbox" checked={ptv} onChange={(e) => setPtv(e.target.checked)} />
                  Recado circular · apenas MP4
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={viewOnce} onChange={(e) => setViewOnce(e.target.checked)} />
                  Visualização única
                </label>
              </>
            )}
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy && <Spinner />}Salvar resposta
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function FunnelEditor({
  initial,
  library,
  onClose,
  onSaved,
}: {
  initial?: Funnel;
  library: Library;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { request, notify } = useApi();
  const [name, setName] = useState(initial?.name ?? '');
  const [steps, setSteps] = useState(
    initial?.items.map((item) => ({
      uiId: crypto.randomUUID(),
      itemId: item.assetId,
      delayBeforeSend: item.delayBeforeSendMs,
    })) ?? [{ uiId: crypto.randomUUID(), itemId: library.assets[0]?.id ?? '', delayBeforeSend: 1000 }],
  );
  const [busy, setBusy] = useState(false);
  const move = (index: number, by: number) =>
    setSteps((current) => {
      const next = [...current];
      const target = index + by;
      if (!next[target]) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await request(
        initial ? `/attendance/funnels/${encodeURIComponent(initial.id)}` : '/attendance/funnels',
        initial ? 'PUT' : 'POST',
        { name, itemsSequence: steps },
      );
      await onSaved();
      notify('Funil salvo.');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? 'Editar funil' : 'Criar funil de atendimento'} onClose={onClose} wide>
      <form onSubmit={(event) => void save(event)}>
        <label>
          Nome do funil
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Apresentação do serviço"
          />
        </label>
        <p className="muted">
          As etapas serão enviadas na ordem abaixo, com o intervalo definido antes de cada envio.
        </p>
        {steps.map((step, index) => (
          <div className="funnel-step" key={step.uiId}>
            <b>{index + 1}</b>
            <ResourcePicker
              library={library}
              value={step.itemId}
              onChange={(itemId) =>
                setSteps((current) => current.map((item, i) => (i === index ? { ...item, itemId } : item)))
              }
            />
            <label>
              Espera (s)
              <input
                type="number"
                min={0}
                max={86400}
                step={0.1}
                value={step.delayBeforeSend / 1000}
                onChange={(e) =>
                  setSteps((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, delayBeforeSend: Math.round(Number(e.target.value) * 1000) }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <div>
              <button
                type="button"
                className="icon-button"
                disabled={index === 0}
                aria-label="Mover etapa para cima"
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={index === steps.length - 1}
                aria-label="Mover etapa para baixo"
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={steps.length === 1}
                aria-label="Remover etapa"
                onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="button"
          onClick={() =>
            setSteps((current) => [
              ...current,
              { uiId: crypto.randomUUID(), itemId: library.assets[0]?.id ?? '', delayBeforeSend: 1000 },
            ])
          }
        >
          <Plus size={16} />
          Adicionar etapa
        </button>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy || !library.assets.length}>
            {busy && <Spinner />}Salvar funil
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PixEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { request, notify } = useApi();
  const [type, setType] = useState('RANDOM');
  const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    try {
      await request('/attendance/pix-keys', 'POST', { ...data, type });
      await onSaved();
      notify('Chave salva no CRM.');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Cadastrar chave PIX" onClose={onClose}>
      <form onSubmit={(e) => void save(e)}>
        <p className="muted">
          Copie uma chave existente no aplicativo do seu banco. A chave aleatória também deve ter sido gerada
          pelo banco.
        </p>
        <label>
          Nome de identificação
          <input name="name" required maxLength={80} placeholder="Ex.: Conta principal" />
        </label>
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="RANDOM">Chave aleatória</option>
            <option value="EMAIL">E-mail</option>
            <option value="PHONE">Telefone com +55</option>
            <option value="CPF">CPF · somente números</option>
            <option value="CNPJ">CNPJ · somente números</option>
          </select>
        </label>
        <label>
          Chave cadastrada no banco
          <input name="value" required maxLength={77} />
        </label>
        <div className="form-grid">
          <label>
            Nome do recebedor
            <input name="merchantName" required maxLength={25} />
          </label>
          <label>
            Cidade
            <input name="merchantCity" required maxLength={15} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy && <Spinner />}Salvar chave
          </button>
        </div>
      </form>
    </Modal>
  );
}
