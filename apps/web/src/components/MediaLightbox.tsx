import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, LoaderCircle, Minus, Plus, X } from 'lucide-react';
import type { Message } from '../types';
import { errorMessage, useApi } from '../context/ApiContext';
import { createMediaFilename, downloadMedia, mediaBlobCache, mediaDownloadQueue } from './media-controls';

export function MediaLightbox({
  messages,
  messageId,
  base,
  contactName,
  onClose,
}: {
  messages: Message[];
  messageId: string;
  base: string;
  contactName: string;
  onClose: () => void;
}) {
  const { blob } = useApi();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const urlRef = useRef('');
  const [currentId, setCurrentId] = useState(messageId);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const retryKey = useRef('');
  const index = Math.max(0, messages.findIndex((item) => item.id === currentId));
  const current = messages[index];
  const cacheKey = `${base}/messages/${encodeURIComponent(currentId)}/media`;

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    closeButton.current?.focus();
    return () => {
      if (element?.open) element.close();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = '';
    setUrl('');
    setError('');
    setZoom(1);
    let cancelled = false;
    const retry = retryKey.current === cacheKey;
    retryKey.current = '';
    const loadCurrent = async (retry = false) => {
      setLoading(true);
      setError('');
      try {
        if (retry) mediaBlobCache.delete(cacheKey);
        const data = await mediaDownloadQueue.enqueue(cacheKey, async () => {
          const cached = retry ? undefined : mediaBlobCache.get(cacheKey);
          if (cached) return cached;
          const downloaded = await blob(cacheKey);
          mediaBlobCache.set(cacheKey, downloaded);
          return downloaded;
        }, messages.length - index);
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(data);
        urlRef.current = nextUrl;
        setUrl(nextUrl);
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadCurrent(retry);
    return () => { cancelled = true; };
  }, [blob, cacheKey, currentId, index, messages.length, refresh]);

  const move = (direction: -1 | 1) => {
    if (!messages.length) return;
    const next = (index + direction + messages.length) % messages.length;
    setCurrentId(messages[next]!.id);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); move(-1); }
    if (event.key === 'ArrowRight' && index < messages.length - 1) { event.preventDefault(); move(1); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom((value) => Math.min(3, value + 0.25)); }
    if (event.key === '-') { event.preventDefault(); setZoom((value) => Math.max(1, value - 0.25)); }
  };

  return (
    <dialog
      ref={dialog}
      className="conversation-lightbox"
      aria-label="Visualizador de mídia da conversa"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
      onKeyDown={onKeyDown}
    >
      <header className="conversation-lightbox-toolbar">
        <span>{index + 1} de {messages.length}</span>
        <div>
          <button type="button" className="conversation-lightbox-action" aria-label="Reduzir zoom" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.25))}><Minus size={18} /></button>
          <span className="conversation-lightbox-zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" className="conversation-lightbox-action" aria-label="Ampliar zoom" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><Plus size={18} /></button>
          <button type="button" className="conversation-lightbox-action" aria-label="Baixar imagem" disabled={!url || !current} onClick={() => {
            const downloadCurrent = async () => {
              let cached = mediaBlobCache.get(cacheKey);
              if (!cached && url) cached = await fetch(url).then((response) => response.blob()).catch(() => undefined);
              if (cached && current) downloadMedia(cached, createMediaFilename('image', contactName, current.sentAt, cached.type));
            };
            void downloadCurrent();
          }}><Download size={18} /></button>
          <button ref={closeButton} type="button" className="conversation-lightbox-action" aria-label="Fechar visualizador" onClick={onClose}><X size={20} /></button>
        </div>
      </header>
      {index > 0 && <button type="button" className="conversation-lightbox-nav previous" aria-label="Imagem anterior" onClick={() => move(-1)}><ChevronLeft size={26} /></button>}
      <div className="conversation-lightbox-stage">
        {loading && <div className="conversation-lightbox-state" role="status"><LoaderCircle size={20} /> Carregando imagem…</div>}
        {error && <div className="conversation-lightbox-state" role="alert"><span>Não foi possível abrir a imagem. {error}</span><button type="button" onClick={() => {
          retryKey.current = cacheKey;
          setRefresh((value) => value + 1);
        }}>Tentar novamente</button></div>}
        {url && current && <img src={url} alt={current.caption || 'Imagem da conversa'} style={{ transform: `scale(${zoom})` }} />}
      </div>
      {index < messages.length - 1 && <button type="button" className="conversation-lightbox-nav next" aria-label="Próxima imagem" onClick={() => move(1)}><ChevronRight size={26} /></button>}
      {current?.caption && <p className="conversation-lightbox-caption">{current.caption}</p>}
    </dialog>
  );
}
