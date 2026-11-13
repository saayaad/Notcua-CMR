import { CircleX, PencilLine } from 'lucide-react';

export function MessageRevision({
  deleted,
  editedAt,
  editedByClient,
  originalText,
}: {
  deleted?: boolean;
  editedAt?: string;
  editedByClient?: boolean;
  originalText?: string;
}) {
  if (deleted)
    return (
      <small className="deleted-message-badge" aria-label="Mensagem apagada pelo cliente">
        <CircleX size={13} aria-hidden="true" /> Apagada pelo cliente
      </small>
    );
  if (!editedAt) return null;
  return (
    <div className="edited-message-badge">
      <small><PencilLine size={12} aria-hidden="true" /> {editedByClient ? 'Editada pelo cliente' : 'Editada por você'}</small>
      {originalText?.trim() && (
        <details className="edited-original">
          <summary>Ver texto original</summary>
          <div>{originalText}</div>
        </details>
      )}
    </div>
  );
}
