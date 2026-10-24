import { usePreferences } from '../context/PreferencesContext';
import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Mic, Square, Trash2, Zap, Smile, Eye, FileText } from 'lucide-react';
import { errorMessage, useApi } from '../context/ApiContext';
import { Modal, Spinner } from './ui';

export async function fileBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

export function Composer({
  base,
  connected,
  onSent,
  onQuick,
}: {
  base: string;
  connected: boolean;
  onSent: () => void;
  onQuick: () => void;
}) {
  const { request, notify } = useApi();
  const { preferences } = usePreferences();
  const [draft, setDraft] = useState({ text: '', id: crypto.randomUUID() });
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [ptt, setPtt] = useState(false);
  const [ptv, setPtv] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(
      () =>
        setSeconds((value) => {
          if (value >= 299) recorder.current?.stop();
          return value + 1;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [recording]);
  const prepareText = (original: string) => {
    let text = original;
    for (const line of preferences.replacements.split('\n')) {
      const split = line.indexOf('=');
      if (split > 0) {
        const from = line.slice(0, split).trim();
        if (from) text = text.split(from).join(line.slice(split + 1));
      }
    }
    return preferences.signatureEnabled && preferences.signature.trim()
      ? `${text}\n\n${preferences.signature.trim()}`
      : text;
  };
  const sendText = async () => {
    if (!draft.text.trim() || busy || !connected) return;
    setBusy(true);
    try {
      await request(`${base}/send`, 'POST', {
        requestId: draft.id,
        kind: 'text',
        text: prepareText(draft.text),
      });
      setDraft({ text: '', id: crypto.randomUUID() });
      onSent();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const choose = (selected: File, voice = false) => {
    if (selected.size > 20 * 1024 * 1024) {
      notify('Escolha um arquivo de até 20 MiB.', true);
      return;
    }
    setFile(selected);
    setCaption('');
    setViewOnce(false);
    setPtt(voice);
    setPtv(false);
  };
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          'Este navegador não oferece gravação de áudio. Você pode anexar um arquivo de áudio.',
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'].find((mime) =>
        MediaRecorder.isTypeSupported(mime),
      );
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        if (!alive.current) return;
        setRecording(false);
        const audio = new File(chunks, 'gravacao.webm', { type: instance.mimeType || 'audio/webm' });
        if (audio.size) choose(audio, true);
      };
      recorder.current = instance;
      setSeconds(0);
      setRecording(true);
      instance.start(250);
    } catch (error) {
      notify(errorMessage(error), true);
    }
  };
  const kind = file?.type.startsWith('image/')
    ? 'image'
    : file?.type.startsWith('video/')
      ? 'video'
      : file?.type.startsWith('audio/')
        ? 'audio'
        : 'document';
  const sendFile = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const uploaded = await request<{ id: string }>('/attendance/files', 'POST', {
        base64: await fileBase64(file),
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        voice: kind === 'audio' && ptt,
      });
      await request(`${base}/send`, 'POST', {
        requestId: crypto.randomUUID(),
        kind,
        fileId: uploaded.id,
        caption: caption || undefined,
        isPtt: ptt,
        isPtv: ptv,
        asViewOnce: viewOnce,
      });
      setFile(null);
      onSent();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="composer-wrap">
      <div className="composer-shortcuts">
        <button onClick={onQuick}>
          <Zap size={14} />
          Respostas rápidas
        </button>
        <span>
          Personalize com <code>#nome</code>
        </span>
      </div>
      <div className="composer">
        {recording ? (
          <div className="recording">
            <span className="record-dot" />
            Gravando áudio{' '}
            <strong>
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </strong>
            <button className="button small" onClick={() => recorder.current?.stop()}>
              <Square size={14} />
              Parar e revisar
            </button>
          </div>
        ) : (
          <textarea
            aria-label="Mensagem"
            placeholder={connected ? 'Escreva sua mensagem…' : 'Conecte o WhatsApp para enviar mensagens'}
            rows={2}
            value={draft.text}
            disabled={!connected || busy}
            onChange={(event) => setDraft({ text: event.target.value, id: crypto.randomUUID() })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void sendText();
              }
            }}
          />
        )}
        <div className="composer-toolbar">
          <div>
            {preferences.pasteName && (
              <button
                className="text-button"
                type="button"
                disabled={busy || recording}
                onClick={() =>
                  setDraft((current) => ({ text: current.text + '#nome', id: crypto.randomUUID() }))
                }
              >
                #nome
              </button>
            )}
            <button
              className="icon-button"
              title="Inserir emoji"
              aria-label="Inserir emoji"
              disabled={recording || busy}
              onClick={() => setDraft((current) => ({ text: `${current.text} 😊`, id: crypto.randomUUID() }))}
            >
              <Smile size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Anexar arquivo"
              disabled={!connected || busy || recording}
              onClick={() => upload.current?.click()}
            >
              <Paperclip size={20} />
            </button>
            <button
              className={`icon-button ${recording ? 'text-danger' : ''}`}
              aria-label={recording ? 'Parar gravação' : 'Gravar áudio'}
              disabled={!connected || busy}
              onClick={() => (recording ? recorder.current?.stop() : void startRecording())}
            >
              {recording ? <Square size={19} /> : <Mic size={20} />}
            </button>
          </div>
          <div>
            <small>Enter para enviar · Shift + Enter para nova linha</small>
            <button
              className="send-button"
              aria-label="Enviar mensagem"
              disabled={!connected || busy || recording || !draft.text.trim()}
              onClick={() => void sendText()}
            >
              {busy ? <Spinner /> : <Send size={19} />}
            </button>
          </div>
        </div>
      </div>
      <input
        ref={upload}
        type="file"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) choose(selected);
          event.target.value = '';
        }}
      />
      {file && (
        <Modal
          title={kind === 'audio' ? 'Revisar áudio' : 'Enviar arquivo'}
          onClose={() => {
            if (!busy) setFile(null);
          }}
        >
          <div className="attachment-preview">
            {kind === 'image' ? (
              <img src={previewUrl} alt="Prévia do anexo" />
            ) : kind === 'video' ? (
              <video src={previewUrl} controls />
            ) : kind === 'audio' ? (
              <audio src={previewUrl} controls />
            ) : (
              <FileText size={42} />
            )}
            <strong>{file.name}</strong>
            <small>{(file.size / 1024 / 1024).toFixed(2)} MiB</small>
          </div>
          {kind !== 'audio' && (
            <label>
              Legenda
              <textarea
                rows={3}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Adicione uma legenda. Você pode usar #nome."
              />
            </label>
          )}
          {kind === 'audio' && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={ptt}
                onChange={(event) => {
                  setPtt(event.target.checked);
                  if (!event.target.checked) setViewOnce(false);
                }}
              />
              Enviar como mensagem de voz (OGG/Opus)
            </label>
          )}
          {kind === 'video' && (
            <label className="checkbox">
              <input type="checkbox" checked={ptv} onChange={(event) => setPtv(event.target.checked)} />
              Enviar como recado circular (MP4)
            </label>
          )}
          {(kind === 'image' || kind === 'video' || (kind === 'audio' && ptt)) && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={viewOnce}
                onChange={(event) => setViewOnce(event.target.checked)}
              />
              <Eye size={16} />
              Visualização única
            </label>
          )}
          <div className="modal-actions">
            <button className="button" disabled={busy} onClick={() => setFile(null)}>
              <Trash2 size={15} />
              Descartar
            </button>
            <button className="button primary" disabled={busy || !connected} onClick={() => void sendFile()}>
              {busy ? <Spinner /> : <Send size={16} />}Enviar {kind === 'audio' ? 'áudio' : 'arquivo'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
