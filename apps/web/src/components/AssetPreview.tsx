import { useEffect, useState } from 'react';
import type { Asset } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';

export function AssetPreview({
  asset,
  name,
  compact = false,
}: {
  asset: Asset;
  name?: string;
  compact?: boolean;
}) {
  const { blob } = useApi();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    if (asset.fileId)
      void blob(`/attendance/assets/${encodeURIComponent(asset.id)}/file`)
        .then((file) => {
          objectUrl = URL.createObjectURL(file);
          if (alive) setUrl(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        })
        .catch((reason) => {
          if (alive) setError(errorMessage(reason));
        });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.id, asset.fileId, blob]);
  const mime = asset.file?.mimeType ?? '';
  return (
    <div className="asset-preview resource-preview">
      {asset.kind === 'MESSAGE' ? (
        <p>{name ? asset.text?.replaceAll('#nome', name) : asset.text}</p>
      ) : (
        <>
          {error ? (
            <p role="alert">{error}</p>
          ) : !url ? (
            <Spinner />
          ) : mime.startsWith('image/') ? (
            <img src={url} alt={asset.name} />
          ) : mime.startsWith('audio/') ? (
            <audio controls src={url} />
          ) : mime.startsWith('video/') ? (
            <video controls src={url} />
          ) : (
            <p>Documento disponível para baixar.</p>
          )}
          {!compact && <p>{asset.file?.filename}</p>}
          <small hidden={compact}>
            {mime} · {Math.ceil((asset.file?.byteLength ?? 0) / 1024)} KB
          </small>
          {url && !compact && (
            <a className="button" href={url} download={asset.file?.filename}>
              Baixar arquivo
            </a>
          )}
        </>
      )}
      {asset.caption && <p>{asset.caption}</p>}
      {(asset.isPtt || asset.isPtv || asset.asViewOnce) && (
        <small>
          {[
            asset.isPtt && 'Mensagem de voz',
            asset.isPtv && 'Recado circular',
            asset.asViewOnce && 'Envio de visualização única',
          ]
            .filter(Boolean)
            .join(' · ')}
        </small>
      )}
    </div>
  );
}
