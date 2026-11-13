import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Message } from './types';
import { ApiProvider } from './context/ApiContext';
import { ConversationMedia, ConversationMediaLightbox, isImageMessage, mediaCategory } from './components/ConversationMedia';
import './styles.css';
import './attendance.css';
import './dev-media-preview.css';

declare global {
  interface Window {
    __releaseMediaDownloads?: () => void;
  }
}

const base = '/dev/fixture/conversation';
const makeMessage = (id: string, type: string, direction: Message['direction'], caption: string | null = null): Message => ({
  id,
  text: null,
  caption,
  direction,
  status: direction === 'OUTBOUND' ? 'READ' : 'DELIVERED',
  type,
  sentAt: '2026-11-13T13:35:00.000Z',
  isPtt: type.toLowerCase().includes('audio'),
  isPtv: false,
  asViewOnce: false,
  fileId: `fixture-${id}`,
  error: null,
});

const messages: Message[] = [
  makeMessage('audio-short-in', 'audioMessage', 'INBOUND'),
  makeMessage('text-1', 'conversation', 'INBOUND'),
  makeMessage('audio-long-out', 'audioMessage', 'OUTBOUND'),
  makeMessage('audio-error', 'audioMessage', 'INBOUND'),
  makeMessage('audio-loading', 'audioMessage', 'OUTBOUND'),
  makeMessage('image-landscape', 'imageMessage', 'INBOUND', 'Imagem horizontal de teste, gerada localmente.'),
  makeMessage('image-portrait', 'imageMessage', 'OUTBOUND', 'Imagem vertical com legenda de exemplo.'),
  makeMessage('video-sample', 'videoMessage', 'INBOUND', 'Vídeo curto gerado no navegador para conferir miniatura e controles.'),
];

function wavFile(duration: number) {
  const rate = 8000;
  const count = Math.floor(rate * duration);
  const bytes = new ArrayBuffer(44 + count * 2);
  const view = new DataView(bytes);
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, count * 2, true);
  for (let index = 0; index < count; index++) {
    const envelope = Math.min(1, index / 2400, (count - index) / 2400);
    view.setInt16(44 + index * 2, Math.sin(2 * Math.PI * 440 * index / rate) * 4800 * envelope, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

function svgImage(width: number, height: number, title: string) {
  const safeTitle = title.replace(/[<&>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#7859d6"/><stop offset="1" stop-color="#2b8c83"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${Math.round(width * .7)}" cy="${Math.round(height * .35)}" r="${Math.min(width, height) * .16}" fill="#ffffff35"/><path d="M0 ${height * .78} Q${width * .32} ${height * .45} ${width * .58} ${height * .78} T${width} ${height * .7} V${height} H0Z" fill="#11182799"/><text x="${width / 2}" y="${height * .9}" fill="white" font-family="sans-serif" font-size="${Math.max(18, Math.round(Math.min(width, height) / 16))}" text-anchor="middle">${safeTitle}</text></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

async function webmFile() {
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 270;
  const context = canvas.getContext('2d');
  if (!context || !canvas.captureStream || !window.MediaRecorder) throw new Error('Geração local de vídeo não disponível neste navegador.');
  const stream = canvas.captureStream(10);
  const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  const result = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error('Não foi possível gerar o WebM de teste.'));
    recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' })); };
  });
  recorder.start();
  const started = performance.now();
  const draw = () => {
    const elapsed = (performance.now() - started) / 1000;
    context.fillStyle = '#151621'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#a68bfa'; context.beginPath(); context.arc(120 + (elapsed * 65) % 250, 135, 48, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#f1edf9'; context.font = '24px sans-serif'; context.textAlign = 'center'; context.fillText('Vídeo de teste local', 240, 235);
  };
  draw();
  const timer = window.setInterval(draw, 100);
  window.setTimeout(() => { window.clearInterval(timer); recorder.stop(); }, 1800);
  return result;
}

const fixtureFiles = new Map<string, Promise<Blob>>([
  ['audio-short-in', Promise.resolve(wavFile(7))],
  ['audio-long-out', Promise.resolve(wavFile(22))],
  ['audio-loading', Promise.resolve(wavFile(9))],
  ['audio-error', Promise.resolve(wavFile(6))],
  ['image-landscape', Promise.resolve(svgImage(1280, 720, 'Imagem horizontal'))],
  ['image-portrait', Promise.resolve(svgImage(600, 1000, 'Imagem vertical'))],
  ['video-sample', webmFile()],
]);
const attempts = new Map<string, number>();
let holdRequests = new URLSearchParams(location.search).has('hold');
let releasePending: (() => void)[] = [];
window.__releaseMediaDownloads = () => {
  holdRequests = false;
  releasePending.splice(0).forEach((release) => release());
};
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const match = new URL(href, location.href).pathname.match(/\/messages\/([^/]+)\/media$/);
  if (!match) return nativeFetch(input, init);
  const id = decodeURIComponent(match[1]!);
  if (holdRequests) await new Promise<void>((resolve) => releasePending.push(resolve));
  if (id === 'audio-loading') await new Promise((resolve) => window.setTimeout(resolve, 2400));
  const attempt = (attempts.get(id) ?? 0) + 1;
  attempts.set(id, attempt);
  if (id === 'audio-error' && attempt === 1) return new Response(JSON.stringify({ error: { message: 'O arquivo de áudio expirou.' } }), { status: 410, headers: { 'Content-Type': 'application/json' } });
  const file = await fixtureFiles.get(id);
  if (!file) return new Response(JSON.stringify({ error: { message: 'Fixture local não encontrada.' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  return new Response(file, { status: 200, headers: { 'Content-Type': file.type } });
};

function Preview() {
  const scrollRoot = useRef<HTMLDivElement>(null);
  const [lightboxId, setLightboxId] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showFiller, setShowFiller] = useState(true);
  document.documentElement.dataset.theme = theme;
  const filler = showFiller ? Array.from({ length: 24 }, (_, index) => makeMessage(`filler-${index}`, 'conversation', index % 2 ? 'OUTBOUND' : 'INBOUND')) : [];
  const allMessages = [...filler, ...messages];
  const imageMessages = allMessages.filter(isImageMessage);

  return (
    <main className="media-fixture">
      <header className="media-fixture-toolbar">
        <strong>Prévia local · mensagens de exemplo</strong>
        <span>Arquivos sintéticos · nenhum contato real</span>
        <div>
          <button type="button" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}>Tema {theme === 'dark' ? 'claro' : 'escuro'}</button>
          <button type="button" onClick={() => setShowFiller((value) => !value)}>{showFiller ? 'Ocultar histórico longo' : 'Mostrar histórico longo'}</button>
        </div>
      </header>
      <div ref={scrollRoot} className="media-fixture-scroll" data-testid="chat-scroll-container" aria-label="Conversa de demonstração">
        {allMessages.map((message, index) => {
          if (message.type === 'conversation') return (
            <div className={`message-row ${message.direction === 'OUTBOUND' ? 'outbound' : ''}`} key={message.id}>
              <div className="message-bubble"><p className="message-text">Mensagem de texto fictícia para testar a rolagem do histórico.</p><div className="message-meta"><time>13:35</time>{message.direction === 'OUTBOUND' && <span>✓✓</span>}</div></div>
            </div>
          );
          const category = mediaCategory(message);
          return (
            <div className={`message-row ${message.direction === 'OUTBOUND' ? 'outbound' : ''}`} key={message.id} data-fixture-message={message.id}>
              <div className="message-bubble">
                <ConversationMedia
                  message={message}
                  base={base}
                  rootRef={scrollRoot}
                  priority={index}
                  contactName="Contato de demonstração"
                  autoDownload={category === 'audio' || category === 'image'}
                  onOpenLightbox={setLightboxId}
                />
                {message.caption && <div className="message-text">{message.caption}</div>}
                <div className="message-meta"><time>13:35</time>{message.direction === 'OUTBOUND' && <span>✓✓</span>}</div>
              </div>
            </div>
          );
        })}
      </div>
      {lightboxId && <ConversationMediaLightbox messages={imageMessages} messageId={lightboxId} base={base} contactName="Contato de demonstração" onClose={() => setLightboxId('')} />}
    </main>
  );
}

createRoot(document.getElementById('media-preview-root')!).render(<ApiProvider><Preview /></ApiProvider>);
