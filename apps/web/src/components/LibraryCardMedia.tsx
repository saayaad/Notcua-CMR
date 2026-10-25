import { useState, useEffect, useRef } from 'react';
import { Play, Maximize2 } from 'lucide-react';
import type { Asset } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';
export function LibraryCardMedia({ asset, onExpand }: { asset: Asset; onExpand: () => void }) {
  const { blob, notify } = useApi();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef('');
  useEffect(
    () => () => {
      if (ref.current) URL.revokeObjectURL(ref.current);
    },
    [],
  );
  if (asset.kind === 'AUDIO')
    return (
      <div className="library-card-audio">
        {url ? (
          <audio controls autoPlay src={url} aria-label={`Áudio ${asset.name}`} />
        ) : (
          <button
            className="button small"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void blob(`/attendance/assets/${encodeURIComponent(asset.id)}/file`)
                .then((data) => {
                  const next = URL.createObjectURL(data);
                  ref.current = next;
                  setUrl(next);
                })
                .catch((error) => notify(errorMessage(error), true))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? <Spinner /> : <Play size={15} />}Ouvir aqui
          </button>
        )}
      </div>
    );
  return (
    <button className="button small" onClick={onExpand}>
      <Maximize2 size={15} />
      {asset.kind === 'MEDIA' ? 'Visualizar mídia' : 'Prévia completa'}
    </button>
  );
}
