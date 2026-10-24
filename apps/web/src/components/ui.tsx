import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageCircle, LoaderCircle } from 'lucide-react';
import type { Contact } from '../types';

export function Avatar({
  contact,
  size = 'normal',
}: {
  contact: Pick<Contact, 'name' | 'profilePicture'>;
  size?: 'normal' | 'large';
}) {
  const initials = contact.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();
  return (
    <span className={`avatar avatar-${size}`}>
      <span>{initials || '?'}</span>
      {contact.profilePicture && (
        <img
          src={contact.profilePicture}
          alt=""
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const backdropPress = useRef(false);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const outside = (x: number, y: number) => {
    const rect = ref.current?.getBoundingClientRect();
    return Boolean(rect && (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom));
  };
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === ref.current && outside(event.clientX, event.clientY);
      }}
      onClick={(event) => {
        if (event.target === ref.current && backdropPress.current && outside(event.clientX, event.clientY))
          onClose();
        backdropPress.current = false;
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar janela">
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>,
    document.body,
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <MessageCircle size={30} />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function Spinner() {
  return <LoaderCircle size={18} className="spin" aria-label="Carregando" />;
}
export function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[\s\S]+?```)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('```') ? (
          <code key={index}>{part.slice(3, -3)}</code>
        ) : part.startsWith('*') && part.endsWith('*') ? (
          <strong key={index}>{part.slice(1, -1)}</strong>
        ) : part.startsWith('_') && part.endsWith('_') ? (
          <em key={index}>{part.slice(1, -1)}</em>
        ) : part.startsWith('~') && part.endsWith('~') ? (
          <s key={index}>{part.slice(1, -1)}</s>
        ) : (
          part
        ),
      )}
    </>
  );
}
export const time = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const phone = (value: string) =>
  value.startsWith('lid:')
    ? 'Identificador WhatsApp'
    : value.startsWith('group:')
      ? 'Conversa em grupo'
      : `+${value}`;
