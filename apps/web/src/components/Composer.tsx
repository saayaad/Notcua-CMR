import { optimizeImage, createVideoWatermark, type Watermark } from '../image-processing';
import { captureMicrophone } from '../microphone';
import { usePreferences } from '../context/PreferencesContext';
import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Mic, Square, Trash2, Zap, Smile, Eye, FileText, MessageSquare } from 'lucide-react';
import { errorMessage, useApi } from '../context/ApiContext';
import { AiOnly, useAiFeatures } from '../context/AiFeatures';
import { Modal, Spinner } from './ui';
import type { Asset, Library } from '../types';
import { WandSparkles, LockKeyhole, LibraryBig } from 'lucide-react';
import { firebaseAuth } from '../auth/firebase';
import type { DraftInsert, AttachmentDraftInsert } from '../context/attendance';

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
  sessionId,
  conversationId,
  library,
  onInternalNote,
}: {
  base: string;
  sessionId: string;
  conversationId: string;
  library: Library;
  connected: boolean;
  onSent: () => void;
  onQuick: () => void;
  onInternalNote: (text: string) => Promise<void>;
}) {
  const { request, notify } = useApi();
  const { preferences } = usePreferences();
  const draftKey = `noctua:draft:${firebaseAuth?.currentUser?.uid ?? 'local'}:${sessionId}:${conversationId}`;
  const [restored] = useState<{ text?: string; id?: string; internal?: boolean }>(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) ?? '{}');
    } catch {
      return {};
    }
  });
  const [draft, setDraft] = useState({
    text: typeof restored.text === 'string' ? restored.text.slice(0, 20000) : '',
    id: typeof restored.id === 'string' ? restored.id : crypto.randomUUID(),
  });
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [ptt, setPtt] = useState(false);
  const [ptv, setPtv] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [microphonePending, setMicrophonePending] = useState(false);
  const [microphoneError, setMicrophoneError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [watermarkSettings, setWatermarkSettings] = useState<{
    enabledByDefault?: boolean;
    activeId?: string;
    marks?: (Watermark & { id: string; name: string })[];
  }>({});
  const [applyWatermark, setApplyWatermark] = useState(false);
  const [internalMode, setInternalMode] = useState(Boolean(restored.internal));
  const [slashQuery, setSlashQuery] = useState('');
  const [slashOpen, setSlashOpen] = useState(false);
  const [recordingWave, setRecordingWave] = useState<number[]>(Array.from({ length: 28 }, () => 4));
  const [copilotAction, setCopilotAction] = useState<'improve' | 'objection' | ''>('');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotConsent, setCopilotConsent] = useState(false);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotText, setCopilotText] = useState('');
  const { enabled: aiEnabled } = useAiFeatures();
  useEffect(() => { if (!aiEnabled) setCopilotOpen(false); }, [aiEnabled]);
  const upload = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const waveTimer = useRef<number | null>(null);
  const alive = useRef(true);
  const recordingGeneration = useRef(0);
  useEffect(() => {
    try {
      if (draft.text) localStorage.setItem(draftKey, JSON.stringify({ ...draft, internal: internalMode }));
      else localStorage.removeItem(draftKey);
    } catch {
      /* Writing remains usable when local storage is unavailable. */
    }
  }, [draft, draftKey, internalMode]);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<DraftInsert>).detail;
      if (detail?.conversationId !== conversationId) return;
      if (internalMode) {
        notify('Troque de Nota interna para Mensagem ao cliente antes de inserir uma resposta.', true);
        return;
      }
      setDraft((current) => ({
        text: [current.text.trimEnd(), detail.text].filter(Boolean).join('\n\n'),
        id: crypto.randomUUID(),
      }));
      window.requestAnimationFrame(() => input.current?.focus());
    };
    window.addEventListener('noctua:insert-draft', receive);
    return () => window.removeEventListener('noctua:insert-draft', receive);
  }, [conversationId, internalMode, notify]);
  useEffect(() => {
    alive.current = true;
    setMicrophonePending(false);
    setRecording(false);
    return () => {
      alive.current = false;
      recordingGeneration.current++;
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      if (waveTimer.current) window.clearInterval(waveTimer.current);
      void audioContext.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    void request<typeof watermarkSettings>('/operations/settings/watermarks')
      .then((value) => {
        setWatermarkSettings(value);
        setApplyWatermark(Boolean(value.enabledByDefault));
      })
      .catch(() => undefined);
  }, [request]);
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
    if (!draft.text.trim() || busy || (!connected && !internalMode)) return;
    if (internalMode) {
      setBusy(true);
      try {
        await onInternalNote(draft.text.trim());
        setDraft({ text: '', id: crypto.randomUUID() });
        setInternalMode(false);
      } catch (error) {
        notify(errorMessage(error), true);
      } finally {
        setBusy(false);
      }
      return;
    }
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
    setAttachmentError('');
    if (selected.size > 20 * 1024 * 1024) {
      notify('Escolha um arquivo de até 20 MiB.', true);
      return;
    }
    setFile(selected);
    setCaption('');
    setViewOnce(false);
    setPtt(voice || selected.type.startsWith('audio/'));
    setPtv(false);
    setApplyWatermark(Boolean(watermarkSettings.enabledByDefault));
  };
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<AttachmentDraftInsert>).detail;
      if (
        detail?.sessionId !== sessionId ||
        detail.conversationId !== conversationId ||
        file ||
        busy ||
        recording ||
        internalMode ||
        detail.file.size > 20 * 1024 * 1024
      )
        return;
      event.preventDefault();
      setFile(detail.file);
      setCaption('');
      setViewOnce(false);
      setPtt(false);
      setPtv(false);
      setApplyWatermark(Boolean(watermarkSettings.enabledByDefault));
    };
    window.addEventListener('noctua:prepare-attachment', receive);
    return () => window.removeEventListener('noctua:prepare-attachment', receive);
  }, [sessionId, conversationId, file, busy, recording, internalMode, watermarkSettings.enabledByDefault]);
  const startRecording = async () => {
    if (microphonePending || recording || busy) return;
    const generation = recordingGeneration.current;
    setMicrophonePending(true);
    setMicrophoneError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          'Este navegador não oferece gravação de áudio. Você pode anexar um arquivo de áudio.',
        );
      const media = await captureMicrophone({
        isActive: () => alive.current && generation === recordingGeneration.current,
      });
      if (!alive.current || generation !== recordingGeneration.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'].find((mime) =>
        MediaRecorder.isTypeSupported(mime),
      );
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      const context = new AudioContext();
      void context.resume().catch(() => undefined);
      const meter = context.createAnalyser();
      meter.fftSize = 64;
      context.createMediaStreamSource(media).connect(meter);
      audioContext.current = context;
      analyser.current = meter;
      const data = new Uint8Array(meter.fftSize);
      waveTimer.current = window.setInterval(() => {
        meter.getByteTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => sum + (value - 128) ** 2, 0) / data.length) / 128;
        setRecordingWave((current) => [...current.slice(1), Math.max(3, Math.min(30, 3 + rms * 120))]);
      }, 70);
      const chunks: BlobPart[] = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        if (waveTimer.current) window.clearInterval(waveTimer.current);
        void context.close();
        if (!alive.current || generation !== recordingGeneration.current) return;
        setRecording(false);
        const audio = new File(chunks, 'gravacao.webm', { type: instance.mimeType || 'audio/webm' });
        if (audio.size) choose(audio, true);
      };
      recorder.current = instance;
      setSeconds(0);
      setRecording(true);
      instance.start(250);
    } catch (error) {
      if (!alive.current || generation !== recordingGeneration.current) return;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      if (waveTimer.current) window.clearInterval(waveTimer.current);
      void audioContext.current?.close();
      setRecording(false);
      setMicrophoneError(errorMessage(error));
      notify(errorMessage(error), true);
    } finally {
      if (alive.current && generation === recordingGeneration.current) setMicrophonePending(false);
    }
  };
  const kind = file?.type.startsWith('image/')
    ? 'image'
    : file?.type.startsWith('video/')
      ? 'video'
      : file?.type.startsWith('audio/')
        ? 'audio'
        : 'document';
  const quickAssets = library.assets
    .filter((asset) =>
      `${asset.name} ${asset.text ?? ''} ${asset.caption ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(slashQuery.toLocaleLowerCase('pt-BR')),
    )
    .slice(0, 8);
  const sendQuickAsset = async (asset: Asset) => {
    if (!connected || busy || internalMode) return;
    setBusy(true);
    try {
      await request(`${base}/send-asset`, 'POST', { assetId: asset.id, requestId: crypto.randomUUID() });
      setDraft((current) => ({
        text: current.text.replace(/(?:^|\s)\/[\wÀ-ÿ_-]*$/, '').trimEnd(),
        id: crypto.randomUUID(),
      }));
      setSlashOpen(false);
      onSent();
      notify(`“${asset.name}” enviado.`);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const runCopilot = async () => {
    if (!copilotConsent || !copilotAction) return;
    if (copilotAction === 'improve' && !draft.text.trim()) {
      notify('Escreva um rascunho antes de pedir para melhorar.', true);
      return;
    }
    setCopilotBusy(true);
    try {
      const task =
        copilotAction === 'improve'
          ? `Revise e melhore o rascunho abaixo para ficar claro, elegante, persuasivo e correto em português. Preserve todos os fatos e valores. Retorne somente a mensagem revisada, sem comentários. Rascunho: ${draft.text}`
          : 'Leia a conversa e proponha exatamente três respostas curtas e diferentes para lidar com a dúvida ou objeção mais recente do cliente. Considere as regras e estilo configurados. Não invente políticas, preço ou disponibilidade. Retorne somente um array JSON com exatamente três strings, uma resposta por string, sem títulos ou comentários.';
      const result = await request<{ text: string }>(
        `/operations/sessions/${sessionId}/contacts/${conversationId}/ai`,
        'POST',
        { task, consent: true },
      );
      setCopilotText(result.text);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setCopilotBusy(false);
    }
  };
  const objectionChoices = (() => {
    try {
      const parsed: unknown = JSON.parse(copilotText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string'))
        return parsed.slice(0, 3);
    } catch {
      /* Non-JSON provider responses are presented as numbered alternatives. */
    }
    return copilotText
      .split(/(?:^|\n)\s*(?:\d+[.)\-:]|[-•])\s*/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);
  })();
  const sendFile = async () => {
    if (!file || busy) return;
    setAttachmentError('');
    setBusy(true);
    try {
      const mark = applyWatermark
        ? (watermarkSettings.marks?.find((item) => item.id === watermarkSettings.activeId) ??
          watermarkSettings.marks?.[0])
        : undefined;
      if ((kind === 'image' || kind === 'video') && applyWatermark && !mark)
        throw new Error('Configure um modelo de marca d’água antes de enviar a amostra.');
      const sourceFile = kind === 'image' ? await optimizeImage(file, mark) : file;
      const watermark = kind === 'video' && mark ? await createVideoWatermark(file, mark) : undefined;
      const uploaded = await request<{ id: string }>('/attendance/files', 'POST', {
        base64: await fileBase64(sourceFile),
        filename: sourceFile.name,
        mimeType: sourceFile.type || 'application/octet-stream',
        voice: kind === 'audio' && ptt,
        watermark,
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
      if (kind === 'image' && sourceFile.size < file.size)
        notify(
          `Imagem otimizada: ${(file.size / 1024 / 1024).toFixed(2)} MiB → ${(sourceFile.size / 1024 / 1024).toFixed(2)} MiB${applyWatermark ? ' com marca d’água' : ''}.`,
        );
    } catch (error) {
      setAttachmentError(errorMessage(error));
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="composer-wrap">
      {microphonePending && (
        <p className="muted" role="status">
          Aguardando permissão do microfone no navegador…
        </p>
      )}
      {microphoneError && (
        <p className="notice" role="alert">
          {microphoneError}
        </p>
      )}
      <div className="composer-shortcuts">
        <button onClick={onQuick}>
          <Zap size={14} />
          Respostas rápidas
        </button>
        <AiOnly><button
          className={`copilot-trigger ${copilotOpen ? 'selected' : ''}`}
          onClick={() => {
            setCopilotAction('');
            setCopilotConsent(false);
            setCopilotText('');
            setCopilotOpen(true);
          }}
        >
          <WandSparkles size={14} /> Copiloto IA
        </button></AiOnly>
        <button
          className={`internal-note-toggle ${internalMode ? 'selected' : ''}`}
          onClick={() => {
            setSlashOpen(false);
            setInternalMode((value) => !value);
          }}
          aria-pressed={internalMode}
        >
          <LockKeyhole size={14} /> {internalMode ? 'Nota interna ativa' : 'Nota interna'}
        </button>
        <span>
          Personalize com <code>#nome</code>
        </span>
      </div>
      {slashOpen && (
        <div className="library-slash-menu" role="listbox" aria-label="Respostas rápidas da Biblioteca">
          <div className="library-slash-heading">
            <LibraryBig size={15} />
            <span>Biblioteca</span>
            <small>Digite para filtrar · Enter para enviar</small>
          </div>
          {quickAssets.length ? (
            quickAssets.map((asset) => (
              <button key={asset.id} role="option" disabled={busy} onClick={() => void sendQuickAsset(asset)}>
                <span className="library-slash-icon">
                  {asset.kind === 'MESSAGE'
                    ? 'T'
                    : asset.kind === 'AUDIO'
                      ? '♫'
                      : asset.kind === 'DOCUMENT'
                        ? '▤'
                        : '▧'}
                </span>
                <span>
                  <strong>{asset.name}</strong>
                  <small>{asset.kind === 'MESSAGE' ? asset.text : asset.caption || asset.kind}</small>
                </span>
                <Send size={14} />
              </button>
            ))
          ) : (
            <p>Nenhum item encontrado.</p>
          )}
        </div>
      )}
      <div className={`composer ${internalMode ? 'composer-internal' : ''}`}>
        {recording ? (
          <div className="recording">
            <span className="record-dot" />
            Gravando áudio{' '}
            <strong>
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </strong>
            <div className="audio-waveform" role="img" aria-label="Nível do áudio gravado">
              {recordingWave.map((height, index) => (
                <i key={index} style={{ height: `${height}px` }} />
              ))}
            </div>
            <button className="button small" onClick={() => recorder.current?.stop()}>
              <Square size={14} />
              Parar e revisar
            </button>
          </div>
        ) : (
          <textarea
            ref={input}
            aria-label="Mensagem"
            className={internalMode ? 'internal-note-draft' : ''}
            placeholder={
              internalMode
                ? 'Escreva uma nota privada para a equipe…'
                : connected
                  ? 'Escreva sua mensagem… Use / para abrir a Biblioteca'
                  : 'Prepare seu rascunho… Conecte o WhatsApp para enviar'
            }
            rows={2}
            value={draft.text}
            disabled={busy}
            onChange={(event) => {
              const text = event.target.value;
              setDraft({ text, id: crypto.randomUUID() });
              const match = internalMode ? null : text.match(/(?:^|\s)\/([^\s]*)$/);
              setSlashQuery(match?.[1] ?? '');
              setSlashOpen(Boolean(match));
            }}
            onKeyDown={(event) => {
              if (slashOpen && event.key === 'Escape') {
                event.preventDefault();
                setSlashOpen(false);
                return;
              }
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (slashOpen && quickAssets[0]) void sendQuickAsset(quickAssets[0]);
                else void sendText();
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
              aria-label={
                microphonePending
                  ? 'Aguardando acesso ao microfone'
                  : recording
                    ? 'Parar gravação'
                    : 'Gravar áudio'
              }
              disabled={!connected || busy || microphonePending}
              onClick={() => (recording ? recorder.current?.stop() : void startRecording())}
            >
              {recording ? <Square size={19} /> : <Mic size={20} />}
            </button>
          </div>
          <div>
            <small>
              {internalMode ? 'Enter para salvar nota' : 'Enter para enviar'} · Shift + Enter para nova linha
            </small>
            <button
              className="send-button"
              aria-label={internalMode ? 'Salvar nota interna' : 'Enviar mensagem'}
              title={internalMode ? 'Salvar nota privada, sem enviar ao WhatsApp' : 'Enviar mensagem'}
              disabled={(!connected && !internalMode) || busy || recording || !draft.text.trim()}
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
      {draft.text && (
        <small className="composer-draft-hint">
          {internalMode ? 'Rascunho de nota privada' : 'Rascunho'} salvo neste navegador
        </small>
      )}
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
            <p className="muted">
              Este áudio será convertido para OGG/Opus e enviado como mensagem de voz. Para enviar música como
              arquivo, escolha Documento.
            </p>
          )}
          {kind === 'video' && (
            <label className="checkbox">
              <input type="checkbox" checked={ptv} onChange={(event) => setPtv(event.target.checked)} />
              Enviar como recado circular (MP4)
            </label>
          )}
          {(kind === 'image' || kind === 'video') && watermarkSettings.marks?.length ? (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={applyWatermark}
                onChange={(event) => setApplyWatermark(event.target.checked)}
              />
              Aplicar marca d’água de aprovação
            </label>
          ) : null}
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
          {attachmentError && <p className="notice" role="alert">{attachmentError}</p>}
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
      {aiEnabled && copilotOpen && (
        <Modal
          title="✨ Copiloto IA"
          onClose={() => {
            setCopilotOpen(false);
            setCopilotAction('');
          }}
        >
          <div className="copilot-modal">
            {!copilotAction && (
              <div className="copilot-action-picker">
                <p>Escolha como quer usar o copiloto:</p>
                <button className="button" onClick={() => setCopilotAction('improve')}>
                  <WandSparkles size={15} /> Melhorar e corrigir meu rascunho
                </button>
                <button className="button" onClick={() => setCopilotAction('objection')}>
                  <MessageSquare size={15} /> Sugerir quebra de objeção
                </button>
              </div>
            )}
            {copilotAction && !copilotText && (
              <>
                <p>
                  {copilotAction === 'improve'
                    ? 'A IA vai revisar o rascunho atual e sugerir uma versão melhor para você conferir.'
                    : 'A IA vai analisar a conversa e sugerir três respostas para a objeção mais recente.'}
                </p>
                <label className="checkbox copilot-consent">
                  <input
                    type="checkbox"
                    checked={copilotConsent}
                    onChange={(event) => setCopilotConsent(event.target.checked)}
                  />
                  Enviar o histórico recente e a base de atendimento ao provedor de IA configurado.
                </label>
                <button
                  className="button primary"
                  disabled={!copilotConsent || copilotBusy}
                  onClick={() => void runCopilot()}
                >
                  {copilotBusy ? <Spinner /> : <WandSparkles size={15} />}
                  {copilotAction === 'improve' ? 'Melhorar e corrigir' : 'Sugerir respostas'}
                </button>
              </>
            )}
            {copilotText && copilotAction === 'improve' && (
              <>
                <p>Confira a sugestão. Seu rascunho só será substituído ao confirmar.</p>
                <textarea
                  rows={5}
                  value={copilotText}
                  onChange={(event) => setCopilotText(event.target.value)}
                />
                <button
                  className="button primary"
                  onClick={() => {
                    setDraft({ text: copilotText, id: crypto.randomUUID() });
                    setCopilotOpen(false);
                  }}
                >
                  Usar no rascunho
                </button>
              </>
            )}
            {copilotText && copilotAction === 'objection' && (
              <div className="copilot-options">
                {objectionChoices.slice(0, 3).map((choice, index) => (
                  <button
                    key={index}
                    className="surface"
                    onClick={() => {
                      setDraft({ text: choice, id: crypto.randomUUID() });
                      setCopilotOpen(false);
                    }}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
