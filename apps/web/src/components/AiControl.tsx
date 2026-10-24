import { useEffect, useState } from 'react';
import { Pause, Play, UserRound } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
interface Control {
  paused: boolean;
  reason: string;
  enabled: boolean;
}
export function AiControl({
  sessionId,
  conversationId,
  revision,
}: {
  sessionId: string;
  conversationId: string;
  revision: number;
}) {
  const { request, notify } = useApi();
  const [control, setControl] = useState<Control | null>(null);
  const [busy, setBusy] = useState(false);
  const path = `/operations/sessions/${sessionId}/contacts/${conversationId}/ai-control`;
  useEffect(() => {
    let active = true;
    void request<Control>(path)
      .then((value) => {
        if (active) setControl(value);
      })
      .catch((error) => {
        if (active) notify(errorMessage(error), true);
      });
    return () => {
      active = false;
    };
  }, [path, revision, request, notify]);
  if (!control) return null;
  return (
    <div className="flow-indicator">
      <span title={control.reason}>
        {control.paused ? <UserRound size={15} /> : <Play size={15} />}{' '}
        {control.paused
          ? 'Atendimento humano · IA pausada'
          : control.enabled
            ? 'IA ativa nesta conversa'
            : 'IA automática desativada'}
      </span>
      <button
        className="text-button"
        disabled={busy || (!control.enabled && !control.paused)}
        onClick={() => {
          setBusy(true);
          void request<Control>(path, 'PUT', { paused: !control.paused })
            .then((value) => setControl({ ...value, enabled: control.enabled }))
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        {control.paused ? (
          <>
            <Play size={14} />
            Retomar IA
          </>
        ) : (
          <>
            <Pause size={14} />
            Assumir atendimento
          </>
        )}
      </button>
    </div>
  );
}
