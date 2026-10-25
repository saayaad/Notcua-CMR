import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, MessageCircle, Send, Sparkles, Upload, X } from 'lucide-react';
import type { Conversation, Message } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from './ui';
import { Select } from './Select';

type ThreadEntry = { id: string; role: 'user' | 'assistant'; kind: 'text' | 'image'; text: string; fileId?: string; createdAt: string };
type ReferenceImage = { data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; name: string; url: string };
const apiPath = (sessionId: string, conversationId: string) => `/operations/client-ai/sessions/${encodeURIComponent(sessionId)}/contacts/${encodeURIComponent(conversationId)}/ai-thread`;

export function ClientAiStudio({ chat, sessionId, messages, onClose }: { chat: Conversation; sessionId: string; messages: Message[]; onClose: () => void }) {
  const { request, blob, notify } = useApi();
  const [tab, setTab] = useState<'chat' | 'image'>('chat');
  const [entries, setEntries] = useState<ThreadEntry[]>([]);
  const [text, setText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [template, setTemplate] = useState('mascot-3d');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16'>('1:1');
  const [reference, setReference] = useState<ReferenceImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const log = useRef<HTMLDivElement>(null);
  const base = apiPath(sessionId, chat.id);

  useEffect(() => {
    const controller = new AbortController();
    void request<{ entries: ThreadEntry[] }>(base, 'GET', undefined, controller.signal)
      .then((result) => setEntries(result.entries))
      .catch((error) => { if (!controller.signal.aborted) notify(errorMessage(error), true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base, request, notify]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [entries]);

  useEffect(() => () => { if (reference?.url) URL.revokeObjectURL(reference.url); }, [reference]);

  const setReferenceFile = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      notify('Escolha uma imagem PNG, JPEG ou WebP.', true);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify('A imagem de referência deve ter até 8 MiB.', true);
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.readAsDataURL(file);
    });
    setReference({ data, mimeType: file.type as ReferenceImage['mimeType'], name: file.name, url: URL.createObjectURL(file) });
  };

  const chooseCustomerImage = async (message: Message) => {
    try {
      const file = await blob(`/attendance/sessions/${encodeURIComponent(sessionId)}/conversations/${encodeURIComponent(chat.id)}/messages/${encodeURIComponent(message.id)}/media`);
      const mimeType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
      const picked = new File([file], `imagem-${message.id}`, { type: mimeType });
      await setReferenceFile(picked);
    } catch (error) {
      notify(errorMessage(error), true);
    }
  };

  const sendText = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const result = await request<{ entries: ThreadEntry[] }>(`${base}/messages`, 'POST', { text: value });
      setEntries((current) => [...current, ...result.entries]);
      setText('');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const generateImage = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || prompt.trim().length < 3) return;
    setBusy(true);
    try {
      const result = await request<{ entries: ThreadEntry[]; model: string }>(`${base}/images`, 'POST', {
        prompt: prompt.trim(), template, aspectRatio,
        ...(reference ? { reference: { data: reference.data, mimeType: reference.mimeType } } : {}),
      });
      setEntries((current) => [...current, ...result.entries]);
      notify(`Imagem gerada com ${result.model} e salva no histórico deste cliente.`);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const imageMessages = messages.filter((message) => message.direction === 'INBOUND' && !message.asViewOnce && message.type.toLowerCase().includes('image'));

  return (
    <Modal title={`Estúdio de IA · ${chat.contact.name}`} onClose={onClose} wide className="client-ai-modal">
      <p className="muted">Este histórico criativo fica separado por cliente. Solicitações e imagens não são enviadas ao WhatsApp automaticamente.</p>
      <div className="client-ai-tabs">
        <button className={`button small ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}><MessageCircle size={14}/>Conversar</button>
        <button className={`button small ${tab === 'image' ? 'active' : ''}`} onClick={() => setTab('image')}><ImagePlus size={14}/>Gerar imagem</button>
      </div>
      {tab === 'chat' ? (
        <>
          <div className="client-ai-log" ref={log} aria-live="polite">
            {loading ? <Spinner/> : entries.length ? entries.map((entry) => <ThreadBubble key={entry.id} entry={entry}/>) : <p className="empty-text">Nenhuma criação ainda. Este espaço é exclusivo para este cliente.</p>}
          </div>
          <form className="client-ai-composer" onSubmit={sendText}>
            <textarea rows={2} maxLength={6000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Converse com a IA sobre este cliente…" />
            <button className="button primary" disabled={busy || !text.trim()}>{busy ? <Spinner/> : <Send size={15}/>}Enviar</button>
          </form>
        </>
      ) : (
        <form className="client-ai-image-form" onSubmit={generateImage} onPaste={(event) => {
          const item = [...event.clipboardData.items].find((clipboardItem) => clipboardItem.type.startsWith('image/'));
          const file = item?.getAsFile();
          if (file) { event.preventDefault(); void setReferenceFile(file).catch((error) => notify(errorMessage(error), true)); }
        }}>
          <div className="form-grid">
            <label>Modelo de criação
              <Select value={template} onChange={(event) => setTemplate(event.target.value)}>
                <option value="mascot-3d">Mascote 3D</option>
                <option value="mascot-realistic">Mascote realista</option>
                <option value="product">Objeto comercial</option>
              </Select>
            </label>
            <label>Proporção
              <Select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as '1:1' | '9:16')}>
                <option value="1:1">Quadrada · 1:1</option>
                <option value="9:16">Vertical · 9:16</option>
              </Select>
            </label>
          </div>
          <label>Descreva a imagem
            <textarea rows={4} maxLength={5000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: mascote sorrindo, uniforme roxo, fundo claro e pose de boas-vindas…" />
          </label>
          <div className="client-ai-reference">
            <div><strong>Imagem de referência</strong><small>Envie um arquivo, cole uma imagem com Ctrl+V ou selecione uma imagem recebida deste cliente.</small></div>
            <label className="button small"><Upload size={14}/>Escolher arquivo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void setReferenceFile(file).catch((error) => notify(errorMessage(error), true)); event.currentTarget.value = ''; }}/></label>
          </div>
          {imageMessages.length > 0 && <div className="client-ai-customer-images"><small>Imagens recebidas nesta conversa</small>{imageMessages.slice(-8).reverse().map((message) => <button type="button" className="button small" key={message.id} onClick={() => void chooseCustomerImage(message)}>Usar imagem de {new Date(message.sentAt).toLocaleDateString('pt-BR')}</button>)}</div>}
          {reference && <div className="client-ai-reference-preview"><img src={reference.url} alt="Imagem de referência"/><span>{reference.name}</span><button type="button" className="icon-button" aria-label="Remover referência" onClick={() => setReference(null)}><X size={15}/></button></div>}
          <p className="muted">A criação usa a chave Gemini salva no servidor e pode consumir cota ou gerar custo conforme sua conta Google. Use apenas imagens que você tem permissão para enviar.</p>
          <button className="button primary" disabled={busy || prompt.trim().length < 3}>{busy ? <Spinner/> : <Sparkles size={15}/>}Gerar e salvar no histórico</button>
        </form>
      )}
    </Modal>
  );
}

function ThreadBubble({ entry }: { entry: ThreadEntry }) {
  const { blob, notify } = useApi();
  const [url, setUrl] = useState('');
  const urlRef = useRef('');
  useEffect(() => {
    if (!entry.fileId) return;
    let active = true;
    void blob(`/files/${encodeURIComponent(entry.fileId)}`).then((file) => {
      const objectUrl = URL.createObjectURL(file);
      if (active) { urlRef.current = objectUrl; setUrl(objectUrl); } else URL.revokeObjectURL(objectUrl);
    }).catch((error) => { if (active) notify(errorMessage(error), true); });
    return () => { active = false; if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [blob, entry.fileId, notify]);
  return <article className={`client-ai-bubble ${entry.role}`}><small>{entry.role === 'user' ? 'Você' : 'Assistente'}</small><p>{entry.text}</p>{entry.fileId && (url ? <img src={url} alt="Imagem gerada para este cliente"/> : <Spinner/>)}</article>;
}
