import {Select} from './Select';
import { useEffect, useState } from 'react';
import { Copy, Send, QrCode } from 'lucide-react';
import type { Library } from '../types';
import { errorMessage, useApi } from '../context/ApiContext';
import { Modal, Spinner } from './ui';

export function PixModal({
  library,
  initialKeyId,
  base,
  onClose,
  onSent,
}: {
  library: Library;
  initialKeyId?: string;
  base: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { request, notify } = useApi();
  const [keyId, setKeyId] = useState(initialKeyId || library.pixKeys[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [proof, setProof] = useState(true);
  const [audioId, setAudioId] = useState('');
  const [preview, setPreview] = useState<{ payload: string; qrDataUrl: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    if (!keyId) return;
    if (amount && !/^\d+(?:[.,]\d{1,2})?$/.test(amount)) {
      setPreviewError('Informe um valor como 150,00.');
      return;
    }
    const cents = amount ? Math.round(Number(amount.replace(',', '.')) * 100) : undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void request<{ payload: string; qrDataUrl: string; key: string }>(
        '/attendance/pix-preview',
        'POST',
        { keyId, amountInCents: cents },
        controller.signal,
      )
        .then(setPreview)
        .catch((error) => {
          if (!controller.signal.aborted) setPreviewError(errorMessage(error));
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [keyId, amount, request]);
  const send = async (copyPaste: boolean) => {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const value = copyPaste ? preview.payload : preview.key;
      await request(`${base}/send`, 'POST', {
        requestId: crypto.randomUUID(),
        kind: 'text',
        text: `Segue ${copyPaste ? 'o PIX Copia e Cola' : 'a chave PIX'} para pagamento:\n\n${value}${proof ? '\n\nApós o pagamento, pode me enviar o comprovante, #nome?' : ''}`,
      });
      if (audioId) {
        try {
          await request(`${base}/send-asset`, 'POST', { assetId: audioId, requestId: crypto.randomUUID() });
        } catch (error) {
          notify(`PIX enviado. O áudio não foi confirmado: ${errorMessage(error)}`, true);
          onSent();
          onClose();
          return;
        }
      }
      notify('PIX enviado para a conversa.');
      onSent();
      onClose();
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Enviar PIX" onClose={onClose}>
      <p className="muted">
        Selecione uma chave já cadastrada no seu banco. Este painel gera o código e não confirma pagamentos.
      </p>
      {!library.pixKeys.length ? (
        <p className="notice">Cadastre sua chave em Biblioteca → PIX antes de enviar.</p>
      ) : (
        <>
          <label>
            Chave PIX
            <Select value={keyId} onChange={(e) => setKeyId(e.target.value)}>
              {library.pixKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name} · {key.type === 'RANDOM' ? 'Aleatória' : key.type}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Valor em reais (opcional)
            <input
              inputMode="decimal"
              value={amount}
              placeholder="0,00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          {previewError && <p className="field-error">{previewError}</p>}
          {preview && (
            <div className="pix-preview">
              <img src={preview.qrDataUrl} alt="Prévia do QR Code PIX" />
              <div>
                <QrCode size={22} />
                <strong>PIX pronto para copiar</strong>
                <small>{library.pixKeys.find((key) => key.id === keyId)?.merchantName}</small>
                <button
                  className="button small"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(preview.payload)
                      .then(() => notify('Código copiado.'))
                      .catch(() => notify('Não foi possível copiar o código.', true))
                  }
                >
                  <Copy size={14} />
                  Copiar código
                </button>
              </div>
            </div>
          )}
          <label className="checkbox">
            <input type="checkbox" checked={proof} onChange={(e) => setProof(e.target.checked)} />
            Incluir pedido de comprovante
          </label>
          <label>
            Áudio de solicitação (opcional)
            <Select value={audioId} onChange={(e) => setAudioId(e.target.value)}>
              <option value="">Sem áudio adicional</option>
              {library.assets
                .filter((asset) => asset.kind === 'AUDIO')
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
            </Select>
          </label>
          <div className="modal-actions">
            <button className="button" disabled={!preview || busy} onClick={() => void send(false)}>
              Enviar só a chave
            </button>
            <button className="button primary" disabled={!preview || busy} onClick={() => void send(true)}>
              {busy ? <Spinner /> : <Send size={16} />}Enviar Copia e Cola
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
