import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Download, Eye, Image as ImageIcon, LoaderCircle, Play, RotateCcw } from 'lucide-react';
import type { Message } from '../types';
import { errorMessage, useApi } from '../context/ApiContext';
import { AudioTurboPlayer } from './AudioTurboPlayer';
import { MediaLightbox } from './MediaLightbox';
import {
  createMediaFilename,
  downloadMedia,
  mediaBlobCache,
  mediaDownloadQueue,
  observeMediaNearViewport,
} from './media-controls';
import './message-media.css';

export function isImageMessage(message: Message) {
  const type = message.type.toLowerCase();
  return !message.asViewOnce && (type.includes('image') || type.includes('sticker'));
}

export function mediaCategory(message: Message): 'audio' | 'image' | 'video' | 'document' {
  const type = message.type.toLowerCase();
  if (type.includes('audio')) return 'audio';
  if (type.includes('image') || type.includes('sticker')) return 'image';
  if (type.includes('video') || message.isPtv) return 'video';
  return 'document';
}

export function ConversationMedia({
  message,
  base,
  rootRef,
  priority,
  contactName,
  autoDownload,
  onOpenLightbox,
}: {
  message: Message;
  base: string;
  rootRef: RefObject<HTMLDivElement | null>;
  priority: number;
  contactName: string;
  autoDownload: boolean;
  onOpenLightbox: (messageId: string) => void;
}) {
  const { blob } = useApi();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageReady, setImageReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const shell = useRef<HTMLDivElement>(null);
  const urlRef = useRef('');
  const mounted = useRef(true);
  const loadingRef = useRef(false);
  const kind = mediaCategory(message);
  const cacheKey = `${base}/messages/${message.id}/media`;
  const filename = createMediaFilename(kind === 'document' ? 'image' : kind, contactName, message.sentAt);

  const attachBlob = useCallback((data: Blob) => {
    if (!mounted.current) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const nextUrl = URL.createObjectURL(data);
    urlRef.current = nextUrl;
    setUrl(nextUrl);
    setError('');
    setImageReady(false);
    setVideoReady(false);
  }, []);

  const load = useCallback(async (retry = false) => {
    if (loadingRef.current || (urlRef.current && !retry)) return;
    loadingRef.current = true;
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
      }, priority);
      attachBlob(data);
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      loadingRef.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [attachBlob, blob, cacheKey, priority]);

  useEffect(() => {
    mounted.current = true;
    const cached = message.asViewOnce ? undefined : mediaBlobCache.get(cacheKey);
    if (cached) attachBlob(cached);
    if (!autoDownload || message.asViewOnce || !shell.current) return;
    return observeMediaNearViewport(shell.current, rootRef.current, () => { void load(); });
  }, [attachBlob, autoDownload, cacheKey, load, message.asViewOnce, rootRef]);

  useEffect(() => () => {
    mounted.current = false;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const downloadCurrent = async () => {
    let data = mediaBlobCache.get(cacheKey);
    if (!data && url) {
      try { data = await fetch(url).then((response) => response.blob()); } catch { /* A URL revogada será recarregada pelo controle explícito. */ }
    }
    if (data) downloadMedia(data, createMediaFilename(kind === 'document' ? 'image' : kind, contactName, message.sentAt, data.type));
  };

  if (message.asViewOnce) {
    return <div className="conversation-media-unavailable"><Eye size={16} /><span>Visualização única<small>Abra esta mídia diretamente no WhatsApp.</small></span></div>;
  }

  if (!url) {
    const label = kind === 'audio' ? 'Áudio' : kind === 'image' ? 'Imagem' : kind === 'video' ? 'Vídeo' : 'Documento';
    return (
      <div className={kind === 'image' ? 'conversation-image-media' : kind === 'video' ? 'conversation-video-media' : ''}>
        <div ref={shell} data-media-id={message.id} className={`conversation-media-frame conversation-media-${kind}`} aria-busy={loading}>
          {loading ? (
            <div className={`conversation-media-skeleton ${loading ? 'is-loading' : 'is-pending'}`} role={loading ? 'status' : undefined} aria-label={loading ? `Carregando ${label.toLowerCase()}` : `Aguardando a mídia entrar na área visível`}>
              <LoaderCircle size={16} /> Carregando {label.toLowerCase()}…
            </div>
          ) : error ? (
            <div className="conversation-media-error" role="alert"><span>{kind} indisponível · {error}</span><button type="button" onClick={() => void load(true)}><RotateCcw size={14} /> Tentar novamente</button></div>
          ) : autoDownload ? (
            <div className="conversation-media-skeleton is-pending" aria-label="Aguardando a mídia entrar na área visível"><span aria-hidden="true" /></div>
          ) : (
            <button type="button" className="conversation-media-load" aria-label={`Carregar ${label.toLowerCase()}`} onClick={() => void load()}>
              {kind === 'image' ? <ImageIcon size={18} /> : kind === 'video' ? <Play size={18} /> : <Download size={18} />}
              Carregar {label.toLowerCase()}
            </button>
          )}
        </div>
        {(kind === 'image' || kind === 'video') && <button type="button" className="conversation-media-download" disabled><Download size={14} /> Baixar {label.toLowerCase()}</button>}
      </div>
    );
  }

  if (kind === 'audio') {
    return <AudioTurboPlayer src={url} id={message.id} downloadName={filename} onDownload={() => void downloadCurrent()} onRetry={() => void load(true)} />;
  }

  if (kind === 'image') {
    return (
      <div className="conversation-image-media">
        <div ref={shell} data-media-id={message.id} className={`conversation-media-frame conversation-media-image ${imageReady ? 'is-ready' : ''}`}>
          {!imageReady && <div className="conversation-media-skeleton" aria-hidden="true"><LoaderCircle size={16} /> Carregando imagem…</div>}
          <button type="button" className="conversation-image-open" aria-label="Abrir imagem em tela cheia" onClick={() => onOpenLightbox(message.id)}>
            <img src={url} alt={message.caption || 'Imagem da conversa'} onLoad={() => setImageReady(true)} onError={() => { setImageReady(false); setError('Falha ao decodificar a imagem.'); }} />
          </button>
          {error && <div className="conversation-image-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load(true)}>Tentar novamente</button></div>}
        </div>
        <button type="button" className="conversation-media-download" onClick={() => void downloadCurrent()}><Download size={14} /> Baixar imagem</button>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="conversation-video-media">
        <div ref={shell} data-media-id={message.id} className="conversation-media-frame conversation-media-video">
          <video
            src={url}
            className={message.isPtv ? 'circular-video' : ''}
            controls={videoPlaying}
            preload="metadata"
            playsInline
            onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration || 0); setVideoReady(true); }}
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
            onEnded={() => setVideoPlaying(false)}
          />
          {!videoReady && <div className="conversation-media-skeleton" role="status"><LoaderCircle size={16} /> Carregando vídeo…</div>}
          {videoReady && !videoPlaying && <button type="button" className="conversation-video-play" aria-label="Reproduzir vídeo" onClick={(event) => { const video = event.currentTarget.parentElement?.querySelector('video'); void video?.play(); }}><Play size={24} fill="currentColor" /><span>{formatVideoDuration(duration)}</span></button>}
        </div>
        <button type="button" className="conversation-media-download" onClick={() => void downloadCurrent()}><Download size={14} /> Baixar vídeo</button>
      </div>
    );
  }

  return <a className="conversation-media-download" href={url} download={filename}><Download size={14} /> Baixar arquivo</a>;
}

function formatVideoDuration(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function ConversationMediaLightbox({
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
  return <MediaLightbox messages={messages} messageId={messageId} base={base} contactName={contactName} onClose={onClose} />;
}
