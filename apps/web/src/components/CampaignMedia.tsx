import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Asset } from '../types';
import { fileBase64 } from './Composer';
export function CampaignMedia({ onCreated }: { onCreated: (asset: Asset) => void }) {
  const { request, notify } = useApi();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const start = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error('Este navegador não oferece gravação. Escolha um arquivo de áudio.');
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
        clearTimeout(timer.current);
        media.getTracks().forEach((track) => track.stop());
        if (alive.current) {
          setRecording(false);
          setFile(new File(chunks, 'gravacao-campanha.webm', { type: instance.mimeType || 'audio/webm' }));
        }
      };
      recorder.current = instance;
      instance.start(250);
      setRecording(true);
      timer.current = setTimeout(() => {
        if (instance.state === 'recording') instance.stop();
      }, 300000);
    } catch (error) {
      stream.current?.getTracks().forEach((track) => track.stop());
      notify(errorMessage(error), true);
    }
  };
  return (
    <div className="surface">
      <p>Adicionar mídia à sequência</p>
      <div className="operation-actions">
        <label className="button">
          <Upload size={15} />
          Escolher arquivo
          <input
            type="file"
            hidden
            disabled={busy || recording}
            accept="audio/*,image/*,video/*"
            onChange={(event) => {
              const value = event.target.files?.[0];
              if (value && value.size <= 20 * 1024 * 1024) setFile(value);
              else notify('Selecione um arquivo de até 20 MiB.', true);
            }}
          />
        </label>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => (recording ? recorder.current?.stop() : void start())}
        >
          {recording ? <Square size={15} /> : <Mic size={15} />}
          {recording ? 'Parar gravação' : 'Gravar áudio'}
        </button>
      </div>
      {file && (
        <>
          <p>{file.name}</p>
          {preview &&
            (file.type.startsWith('audio/') ? (
              <audio controls src={preview} />
            ) : file.type.startsWith('video/') ? (
              <video controls src={preview} style={{ maxWidth: '100%', maxHeight: 180 }} />
            ) : (
              <img alt="Prévia da mídia" src={preview} style={{ maxWidth: '100%', maxHeight: 180 }} />
            ))}
          <button
            type="button"
            className="button"
            disabled={busy || recording}
            onClick={async () => {
              setBusy(true);
              try {
                const audio = file.type.startsWith('audio/');
                const uploaded = await request<{ id: string }>('/attendance/files', 'POST', {
                  base64: await fileBase64(file),
                  filename: file.name,
                  mimeType: file.type,
                  voice: audio,
                });
                const asset = await request<Asset>('/attendance/assets', 'POST', {
                  name: file.name.slice(0, 100),
                  kind: audio ? 'AUDIO' : 'MEDIA',
                  fileId: uploaded.id,
                  isPtt: audio,
                });
                onCreated(asset);
                setFile(null);
                notify('Mídia adicionada à sequência e à biblioteca.');
              } catch (error) {
                notify(errorMessage(error), true);
              } finally {
                setBusy(false);
              }
            }}
          >
            Usar esta mídia na sequência
          </button>
        </>
      )}
    </div>
  );
}
